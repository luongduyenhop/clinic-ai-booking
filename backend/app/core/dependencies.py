from typing import List, Optional
from fastapi import Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.account_status import ensure_account_active
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.user import TaiKhoan, VaiTroEnum

security = HTTPBearer(auto_error=False)


async def get_user_by_token(raw_token: str, db: AsyncSession) -> TaiKhoan:
    token = raw_token.strip().strip('"').strip("'")
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
    
    ensure_account_active(user)
    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> TaiKhoan:
    if not credentials or not credentials.credentials:
        raise UnauthorizedException("Yêu cầu gửi kèm Authorization Bearer Token hợp lệ")
    return await get_user_by_token(credentials.credentials, db)


async def get_current_user_flexible(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> TaiKhoan:
    raw_token = (credentials.credentials if credentials and credentials.credentials else None) or token
    if not raw_token:
        raise UnauthorizedException("Yêu cầu gửi kèm Authorization Bearer Token hoặc tham số token hợp lệ")
    return await get_user_by_token(raw_token, db)


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[TaiKhoan]:
    if not credentials or not credentials.credentials:
        return None
    return await get_current_user(credentials, db)


def require_roles(allowed_roles: List[VaiTroEnum]):
    async def role_checker(current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan:
        if current_user.vai_tro not in [r.value for r in allowed_roles]:
            raise ForbiddenException(
                f"Bạn không có quyền truy cập chức năng này. Yêu cầu quyền: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker
