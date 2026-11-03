import asyncio
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.core.exceptions import UnauthorizedException
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.auth import RefreshTokenRequest
from app.services.auth_service import auth_service


@pytest_asyncio.fixture(loop_scope="function")
async def logged_in(api_client, booking, db_session, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)
    password_hash = hash_password("QaLogout@2026")

    async def login(role):
        person = await booking.tao_tai_khoan("logout-user", role)
        user = (await db_session.execute(select(TaiKhoan).where(TaiKhoan.nguoi_dung_id == person.id))).scalar_one()
        user.mat_khau_hash = password_hash
        await db_session.flush()
        response = await api_client.post("/api/v1/auth/login", json={"email": user.email, "mat_khau": "QaLogout@2026"})
        assert response.status_code == 200
        tokens = response.json()["data"]
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        return user, tokens, headers

    return login


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [role.value for role in VaiTroEnum])
async def test_logout_revokes_refresh_for_all_roles(api_client, db_session, logged_in, role):
    user, tokens, headers = await logged_in(role)
    response = await api_client.post("/api/v1/auth/logout", headers=headers)
    assert response.status_code == 200
    assert response.json()["success"] is True
    await db_session.refresh(user)
    assert user.refresh_token_hash is None
    assert user.refresh_token_expired_at is None
    response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refresh_token"]})
    assert response.status_code == 401
    assert response.json().get("data") is None


@pytest.mark.asyncio
async def test_logout_is_idempotent(api_client, logged_in):
    _, _, headers = await logged_in("benh_nhan")
    for _ in range(2):
        response = await api_client.post("/api/v1/auth/logout", headers=headers)
        assert response.status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("authorization", [None, "Bearer not-a-real-token"])
async def test_logout_requires_authentication(api_client, db_session, logged_in, authorization):
    user, tokens, _ = await logged_in("benh_nhan")
    headers = {"Authorization": authorization} if authorization else {}
    response = await api_client.post("/api/v1/auth/logout", headers=headers)
    assert response.status_code == 401
    await db_session.refresh(user)
    assert user.refresh_token == tokens["refresh_token"]


@pytest.mark.asyncio
async def test_logout_cannot_target_another_account(api_client, db_session, logged_in, booking):
    user, _, headers = await logged_in("benh_nhan")
    other = (await db_session.execute(select(TaiKhoan).where(TaiKhoan.nguoi_dung_id == booking.bn_b.nguoi_dung_id))).scalar_one()
    other.refresh_token = "qa-other-account-refresh"
    other.refresh_token_expired_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db_session.flush()
    response = await api_client.post("/api/v1/auth/logout", headers=headers, json={"user_id": other.id, "refresh_token": other.refresh_token})
    assert response.status_code == 200
    await db_session.refresh(user)
    await db_session.refresh(other)
    assert user.refresh_token is None
    assert other.refresh_token == "qa-other-account-refresh"


@pytest.mark.asyncio
async def test_logout_revokes_rotated_refresh_token(api_client, db_session, logged_in):
    user, tokens, headers = await logged_in("benh_nhan")
    response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refresh_token"]})
    rotated = response.json()["data"]["refresh_token"]
    assert rotated != tokens["refresh_token"]
    assert (await api_client.post("/api/v1/auth/logout", headers=headers)).status_code == 200
    await db_session.refresh(user)
    assert user.refresh_token is None
    for token in (tokens["refresh_token"], rotated):
        response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": token})
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_user_can_login_again_after_logout(api_client, logged_in):
    user, old, headers = await logged_in("benh_nhan")
    await api_client.post("/api/v1/auth/logout", headers=headers)
    response = await api_client.post("/api/v1/auth/login", json={"email": user.email, "mat_khau": "QaLogout@2026"})
    assert response.status_code == 200
    new = response.json()["data"]
    assert new["refresh_token"] != old["refresh_token"]
    assert (await api_client.post("/api/v1/auth/refresh", json={"refreshToken": new["refresh_token"]})).status_code == 200
    assert (await api_client.post("/api/v1/auth/refresh", json={"refreshToken": old["refresh_token"]})).status_code == 401


@pytest.mark.asyncio
async def test_expired_access_requires_refresh_before_logout(api_client, db_session, logged_in):
    user, tokens, _ = await logged_in("benh_nhan")
    expired = create_access_token(subject=user.id, role=user.vai_tro, expires_delta=timedelta(seconds=-1))
    response = await api_client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
    response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refresh_token"]})
    new = response.json()["data"]
    response = await api_client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {new['access_token']}"})
    assert response.status_code == 200
    await db_session.refresh(user)
    assert user.refresh_token_hash is None


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/auth/logout", "/api/Auth/logout"])
async def test_legacy_logout_aliases_use_same_revocation(api_client, db_session, logged_in, path):
    user, _, headers = await logged_in("benh_nhan")
    assert (await api_client.post(path, headers=headers)).status_code == 200
    await db_session.refresh(user)
    assert user.refresh_token is None


@pytest.mark.asyncio
@pytest.mark.parametrize("first", ["refresh", "logout"])
async def test_concurrent_logout_and_refresh_cannot_restore_a_revoked_session(committed_booking, monkeypatch, first):
    factory = committed_booking.session_factory
    old_refresh = f"qa-concurrent-refresh-{committed_booking.suffix}"
    async with factory() as setup:
        user = (await setup.execute(select(TaiKhoan).where(
            TaiKhoan.nguoi_dung_id == committed_booking.bn_a.nguoi_dung_id,
        ))).scalar_one()
        user.refresh_token = old_refresh
        user.refresh_token_expired_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        await setup.commit()

    locked = asyncio.Event()
    second_started = asyncio.Event()
    release = asyncio.Event()
    async with factory() as refresh_db, factory() as logout_db:
        refresh_execute = refresh_db.execute
        logout_execute = logout_db.execute

        async def gated_refresh(statement, *args, **kwargs):
            if first == "refresh":
                result = await refresh_execute(statement, *args, **kwargs)
                locked.set()
                await release.wait()
                return result
            second_started.set()
            return await refresh_execute(statement, *args, **kwargs)

        async def gated_logout(statement, *args, **kwargs):
            if first == "logout":
                result = await logout_execute(statement, *args, **kwargs)
                locked.set()
                await release.wait()
                return result
            second_started.set()
            return await logout_execute(statement, *args, **kwargs)

        monkeypatch.setattr(refresh_db, "execute", gated_refresh)
        monkeypatch.setattr(logout_db, "execute", gated_logout)

        async def refresh():
            try:
                return await auth_service.refresh_access_token(RefreshTokenRequest(refresh_token=old_refresh), refresh_db)
            except UnauthorizedException:
                return None

        operations = {"refresh": refresh, "logout": lambda: auth_service.logout_user(user, logout_db)}
        first_task = asyncio.create_task(operations[first]())
        second_task = None
        try:
            await asyncio.wait_for(locked.wait(), timeout=5)
            second_task = asyncio.create_task(operations["logout" if first == "refresh" else "refresh"]())
            await asyncio.wait_for(second_started.wait(), timeout=5)
            release.set()
            await asyncio.wait_for(asyncio.gather(first_task, second_task), timeout=10)
        finally:
            release.set()
            for task in (first_task, second_task):
                if task and not task.done():
                    task.cancel()
            await asyncio.gather(*(task for task in (first_task, second_task) if task), return_exceptions=True)

    async with factory() as check:
        stored = await check.get(TaiKhoan, user.id)
        assert stored.refresh_token_hash is None
        assert stored.refresh_token_expired_at is None
