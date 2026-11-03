import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.account_status import ACCOUNT_DISABLED_MESSAGE, OTP_PENDING_MESSAGE
from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.models.user import BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.services.email_service import email_service


STAFF_ROLES = [role.value for role in VaiTroEnum if role != VaiTroEnum.BENH_NHAN]
PASSWORD = "QaDisabled@2026"


@pytest_asyncio.fixture(loop_scope="function")
async def make_account(db_session, monkeypatch):
    # These tests exercise account authorization, not the shared per-IP quota.
    monkeypatch.setattr(limiter, "enabled", False)
    password_hash = hash_password(PASSWORD)

    async def create(role, active=False, otp=False, email=None):
        suffix = uuid.uuid4().hex[:10]
        email = email or f"qa.{suffix}@example.com"
        person = NguoiDung(ho_ten="QA disabled account", email=email)
        db_session.add(person)
        await db_session.flush()
        user = TaiKhoan(
            nguoi_dung_id=person.id, email=email, vai_tro=role,
            mat_khau_hash=password_hash, is_active=active,
            otp_code="123456" if otp else None,
            otp_expired_at=datetime.now(timezone.utc) + timedelta(minutes=5) if otp else None,
            refresh_token=f"qa-refresh-{suffix}",
            refresh_token_expired_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db_session.add(user)
        await db_session.flush()
        return user

    return create


def assert_denied(response, message=ACCOUNT_DISABLED_MESSAGE):
    assert response.status_code == 403, response.text
    body = response.json()
    assert body["success"] is False
    assert body["message"] == message
    assert body.get("data") is None


@pytest.mark.asyncio
@pytest.mark.parametrize("role", STAFF_ROLES)
@pytest.mark.parametrize("retained_otp", [False, True])
async def test_disabled_staff_cannot_login_refresh_access_or_activate_with_otp(
    api_client, db_session, make_account, role, retained_otp,
):
    user = await make_account(role, otp=retained_otp)
    original_refresh = user.refresh_token
    original_otp = user.otp_code
    headers = {"Authorization": f"Bearer {create_access_token(subject=user.id, role=role)}"}

    response = await api_client.post("/api/v1/auth/login", json={"email": user.email, "mat_khau": PASSWORD})
    assert_denied(response)
    response = await api_client.get("/api/v1/auth/me", headers=headers)
    assert_denied(response)
    response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": original_refresh})
    assert_denied(response)
    response = await api_client.post("/api/v1/auth/verify-otp", json={"email": user.email, "otp_code": "123456"})
    assert_denied(response, "Tài khoản nhân viên không được kích hoạt qua OTP. Vui lòng liên hệ quản trị viên.")

    await db_session.refresh(user)
    assert user.is_active is False
    assert user.refresh_token == original_refresh
    assert user.otp_code == original_otp
    assert user.last_login_at is None
    assert (await db_session.execute(select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id))).scalar_one_or_none() is None


@pytest.mark.asyncio
@pytest.mark.parametrize("role", STAFF_ROLES)
async def test_active_staff_can_still_login_and_refresh(api_client, make_account, role):
    user = await make_account(role, active=True)
    response = await api_client.post("/api/v1/auth/login", json={"usernameOrEmail": user.email, "password": PASSWORD})
    assert response.status_code == 200
    tokens = response.json()["data"]
    assert tokens["access_token"] and tokens["vai_tro"] == role
    response = await api_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert response.status_code == 200
    response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refresh_token"]})
    assert response.status_code == 200
    assert response.json()["data"]["refresh_token"] != tokens["refresh_token"]


@pytest.mark.asyncio
async def test_wrong_password_does_not_disclose_disabled_account_status(api_client, make_account):
    user = await make_account("le_tan")
    response = await api_client.post("/api/v1/auth/login", json={"email": user.email, "mat_khau": "WrongPassword@2026"})
    assert response.status_code == 401
    assert response.json()["message"] == "Email hoặc mật khẩu không chính xác!"


@pytest.mark.asyncio
async def test_disabled_admin_cannot_use_legacy_demo_auth_paths(api_client, make_account):
    user = await make_account("admin", email="admin@clinic-ai.vn")
    response = await api_client.get("/api/v1/auth/me", headers={"Authorization": "Bearer demo-clinic-ai-admin-token"})
    # PR #58 removes these tokens entirely (401); this branch also guards inactive accounts (403).
    assert response.status_code in (401, 403)
    assert response.json().get("data") is None
    response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": "demo-clinic-ai-refresh-token"})
    assert response.status_code in (401, 403)
    assert response.json().get("data") is None
    assert user.is_active is False


@pytest.mark.asyncio
async def test_pending_patient_can_complete_otp_but_cannot_reuse_it(api_client, db_session, make_account):
    user = await make_account("benh_nhan", otp=True)
    response = await api_client.post("/api/v1/auth/login", json={"email": user.email, "mat_khau": PASSWORD})
    assert_denied(response, OTP_PENDING_MESSAGE)
    response = await api_client.post("/api/v1/auth/verify-otp", json={"email": user.email, "otp_code": "123456"})
    assert response.status_code == 200
    assert response.json()["data"]["access_token"]
    await db_session.refresh(user)
    assert user.is_active is True
    assert user.otp_code is None and user.otp_expired_at is None
    response = await api_client.post("/api/v1/auth/verify-otp", json={"email": user.email, "otp_code": "123456"})
    assert response.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("expired", [False, True])
async def test_patient_invalid_or_expired_otp_does_not_activate(api_client, db_session, make_account, expired):
    user = await make_account("benh_nhan", otp=True)
    if expired:
        user.otp_expired_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        await db_session.flush()
    response = await api_client.post("/api/v1/auth/verify-otp", json={"email": user.email, "otp_code": "123456" if expired else "000000"})
    assert response.status_code == 401
    await db_session.refresh(user)
    assert user.is_active is False


@pytest.mark.asyncio
async def test_inactive_patient_without_pending_otp_gets_disabled_message(api_client, make_account):
    user = await make_account("benh_nhan")
    response = await api_client.post("/api/v1/auth/login", json={"email": user.email, "mat_khau": PASSWORD})
    assert_denied(response)


@pytest.mark.asyncio
async def test_invalid_refresh_token_still_returns_unauthorized(api_client, make_account):
    await make_account("le_tan")
    response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": "unknown-refresh-token"})
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.usefixtures("make_account")
async def test_real_patient_registration_and_otp_flow_remains_available(api_client, db_session, monkeypatch):
    deliveries = []

    async def send_otp(recipient_email, otp_code):
        deliveries.append((recipient_email, otp_code))

    monkeypatch.setattr(email_service, "send_otp_email", send_otp)
    email = f"qa.register.{uuid.uuid4().hex[:10]}@example.com"
    response = await api_client.post("/api/v1/auth/register", json={
        "ho_ten": "QA patient registration", "email": email,
        "so_dien_thoai": "0987654321", "mat_khau": PASSWORD,
    })
    assert response.status_code == 201, response.text
    user = (await db_session.execute(select(TaiKhoan).where(TaiKhoan.email == email))).scalar_one()
    assert user.is_active is False and user.vai_tro == "benh_nhan"
    assert deliveries == [(email, user.otp_code)]
    response = await api_client.post("/api/v1/auth/login", json={"email": email, "mat_khau": PASSWORD})
    assert_denied(response, OTP_PENDING_MESSAGE)
    response = await api_client.post("/api/v1/auth/verify-otp", json={"email": email, "otp_code": deliveries[0][1]})
    assert response.status_code == 200
    assert response.json()["data"]["vai_tro"] == "benh_nhan"
