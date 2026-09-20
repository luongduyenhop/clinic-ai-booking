from typing import List
from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.user import TaiKhoan, VaiTroEnum


async def get_current_user(
    authorization: str = Header(None, description="Bearer <token>"),
    db: AsyncSession = Depends(get_db)
) -> TaiKhoan:
    """Xác thực token JWT từ Header và lấy đối tượng tài khoản hiện tại từ PostgreSQL"""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException("Yêu cầu gửi kèm Authorization Bearer Token hợp lệ")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedException("Mã Token không hợp lệ hoặc đã hết hạn sử dụng")
    
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


def require_roles(allowed_roles: List[VaiTroEnum]):
    """Kiểm tra quyền truy cập theo vai trò (Role-Based Access Control - RBAC)"""
    async def role_checker(current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan:
        if current_user.vai_tro not in [r.value for r in allowed_roles]:
            raise ForbiddenException(
                f"Bạn không có quyền truy cập chức năng này. Yêu cầu quyền: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker
