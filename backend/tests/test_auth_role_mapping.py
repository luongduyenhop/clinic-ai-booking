import uuid

import pytest

from app.core.security import decode_access_token, hash_password
from app.models.user import NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.auth import LoginRequest, RefreshTokenRequest
from app.services.auth_service import auth_service


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("database_role", "frontend_role"),
    [
        (VaiTroEnum.BENH_NHAN, "PATIENT"),
        (VaiTroEnum.ADMIN, "ADMIN"),
        (VaiTroEnum.BAC_SI, "DOCTOR"),
        (VaiTroEnum.LE_TAN, "RECEPTIONIST"),
        (VaiTroEnum.THU_NGAN, "CASHIER"),
        (VaiTroEnum.KY_THUAT_VIEN, "TECHNICIAN"),
    ],
)
async def test_role_survives_login_profile_and_refresh(db_session, database_role, frontend_role):
    """The portal role must stay correct throughout a real authentication session."""
    email = f"role-{uuid.uuid4().hex}@test.local"
    password = "RoleMapping@123456"
    person = NguoiDung(ho_ten="QA Role Mapping", email=email)
    db_session.add(person)
    await db_session.flush()
    account = TaiKhoan(
        nguoi_dung_id=person.id,
        email=email,
        mat_khau_hash=hash_password(password),
        vai_tro=database_role.value,
        is_active=True,
    )
    db_session.add(account)
    await db_session.flush()

    login = await auth_service.login_user(LoginRequest(email=email, mat_khau=password), db_session)
    assert login.vai_tro == database_role.value
    assert login.role == frontend_role
    assert login.user["role"] == frontend_role
    assert decode_access_token(login.access_token)["role"] == database_role.value

    profile = await auth_service.get_user_profile(account, db_session)
    assert profile.role == frontend_role

    refreshed = await auth_service.refresh_access_token(
        RefreshTokenRequest(refresh_token=login.refresh_token), db_session
    )
    assert refreshed.vai_tro == database_role.value
    assert refreshed.role == frontend_role
    assert refreshed.refresh_token != login.refresh_token
    assert decode_access_token(refreshed.access_token)["role"] == database_role.value
