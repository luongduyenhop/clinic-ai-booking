from typing import List, Optional
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.user import TaiKhoan, VaiTroEnum

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> TaiKhoan:
    if not credentials or not credentials.credentials:
        raise UnauthorizedException("Yêu cầu gửi kèm Authorization Bearer Token hợp lệ")
    
    token = credentials.credentials.strip().strip('"').strip("'")
    while token.lower().startswith("bearer "):
        token = token[7:].strip().strip('"').strip("'")
        
    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedException("Mã Token không hợp lệ hoặc đã hết hạn sử dụng")
        
    if payload.get("type") == "refresh":
        raise UnauthorizedException("Không thể sử dụng Refresh Token để truy cập tài nguyên")
    
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Token không chứa thông tin định danh người dùng")
    
    stmt = select(TaiKhoan).where(TaiKhoan.id == int(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise UnauthorizedException("Người dùng tương ứng với Token không tồn tại trong hệ thống")
    
    if not user.is_active:
        raise ForbiddenException("Tài khoản hiện đang bị vô hiệu hóa hoặc chưa xác thực OTP")
        
    return user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[TaiKhoan]:
    """Như get_current_user nhưng cho phép khách vãng lai khi KHÔNG gửi token. Đã gửi token thì phải hợp lệ:
    token hết hạn/sai trả 401 để client làm mới token, thay vì âm thầm coi là khách và mất liên kết hồ sơ bệnh nhân"""
    if not credentials or not credentials.credentials:
        return None
    return await get_current_user(credentials, db)


def require_roles(allowed_roles: List[VaiTroEnum]):
    """Kiểm tra quyền truy cập theo vai trò (Role-Based Access Control - RBAC)"""
    async def role_checker(current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan:
        if current_user.vai_tro not in [r.value for r in allowed_roles]:
            raise ForbiddenException(
                f"Bạn không có quyền truy cập chức năng này. Yêu cầu quyền: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker
