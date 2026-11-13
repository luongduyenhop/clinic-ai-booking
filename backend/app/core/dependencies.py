from typing import List, Optional
from fastapi import Depends, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.account_status import ensure_account_active
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.user import TaiKhoan, VaiTroEnum, VaiTro, VaiTroQuyen, Quyen

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


def require_permission(permission_code: str):
    """Check the persisted RBAC matrix for API operations; admin remains the system superuser."""
    async def permission_checker(
        current_user: TaiKhoan = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> TaiKhoan:
        if current_user.vai_tro == VaiTroEnum.ADMIN.value:
            return current_user
        # Initialize defaults on first use so persisted permissions are
        # effective even before an administrator opens the RBAC screen.
        from app.services.admin_rbac_service import admin_rbac_service
        await admin_rbac_service._ensure_catalog(db)
        stmt = (
            select(Quyen.id)
            .join(VaiTroQuyen, VaiTroQuyen.quyen_id == Quyen.id)
            .join(VaiTro, VaiTro.id == VaiTroQuyen.vai_tro_id)
            .where(VaiTro.ma_vai_tro == current_user.vai_tro, VaiTro.is_active.is_(True))
            .where(Quyen.ma_quyen == permission_code)
        )
        if (await db.execute(stmt)).scalar_one_or_none() is None:
            raise ForbiddenException(f"Vai trò hiện tại chưa được cấp quyền {permission_code}.")
        return current_user
    return permission_checker


def permission_action_for_request(request: Request) -> str:
    endpoint_name = getattr(request.scope.get("endpoint"), "__name__", "")
    if "export" in endpoint_name:
        return "export"
    return {
        "GET": "view",
        "POST": "create",
        "PUT": "update",
        "PATCH": "update",
        "DELETE": "delete",
    }.get(request.method.upper(), "view")


def require_module_permission(module_code: str):
    """Enforce a module's persisted CRUD permission for the current request."""
    async def module_checker(
        request: Request,
        current_user: TaiKhoan = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> TaiKhoan:
        if current_user.vai_tro == VaiTroEnum.ADMIN.value:
            return current_user
        from app.services.admin_rbac_service import admin_rbac_service
        await admin_rbac_service._ensure_catalog(db)
        permission_code = f"{module_code}.{permission_action_for_request(request)}"
        stmt = (
            select(Quyen.id)
            .join(VaiTroQuyen, VaiTroQuyen.quyen_id == Quyen.id)
            .join(VaiTro, VaiTro.id == VaiTroQuyen.vai_tro_id)
            .where(VaiTro.ma_vai_tro == current_user.vai_tro, VaiTro.is_active.is_(True))
            .where(Quyen.ma_quyen == permission_code)
        )
        if (await db.execute(stmt)).scalar_one_or_none() is None:
            raise ForbiddenException(f"Vai trò hiện tại chưa được cấp quyền {permission_code}.")
        return current_user
    return module_checker
