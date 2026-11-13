import logging
from pathlib import Path
import yaml
import pytest
from pydantic import ValidationError
from app.core.config import Settings, settings
from app.services.email_service import email_service
from seed_data import seed_database
from app.core.seed_5_departments import seed_clinic_5_departments
from scripts.seed_demo_credentials import seed as seed_demo_credentials
from scripts.seed_emergency_e2e_data import seed as seed_emergency_e2e_data
from scripts.seed_master_from_frontend import seed_master_from_frontend
from scripts.seed_rooms import seed_rooms
from seed_reception_full import seed_reception_data


@pytest.mark.asyncio
async def test_seed_database_missing_confirmation_flag():
    with pytest.raises(RuntimeError, match="confirm-seed-demo"):
        await seed_database(confirm_seed_demo=False)


@pytest.mark.asyncio
async def test_seed_database_disabled_in_env(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", False)
    with pytest.raises(RuntimeError, match="ENABLE_DEMO_SEED"):
        await seed_database(confirm_seed_demo=True)


@pytest.mark.asyncio
async def test_seed_database_blocked_in_production(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(RuntimeError, match="PRODUCTION"):
        await seed_database(confirm_seed_demo=True)


@pytest.mark.asyncio
async def test_seed_database_with_session_missing_confirmation_flag(db_session):
    with pytest.raises(RuntimeError, match="confirm-seed-demo"):
        await seed_database(session=db_session, confirm_seed_demo=False)


@pytest.mark.asyncio
async def test_seed_database_with_session_disabled_in_env(db_session, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", False)
    with pytest.raises(RuntimeError, match="ENABLE_DEMO_SEED"):
        await seed_database(session=db_session, confirm_seed_demo=True)


@pytest.mark.asyncio
async def test_seed_database_with_session_blocked_in_production(db_session, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(RuntimeError, match="PRODUCTION"):
        await seed_database(session=db_session, confirm_seed_demo=True)


@pytest.mark.asyncio
async def test_standalone_seeds_missing_confirmation():
    entrypoints = [
        seed_clinic_5_departments,
        seed_demo_credentials,
        seed_emergency_e2e_data,
        seed_master_from_frontend,
        seed_rooms,
        seed_reception_data,
    ]
    for fn in entrypoints:
        with pytest.raises(RuntimeError, match="confirm-seed-demo"):
            await fn(confirm_seed_demo=False)


@pytest.mark.asyncio
async def test_standalone_seeds_disabled_in_env(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", False)
    entrypoints = [
        seed_clinic_5_departments,
        seed_demo_credentials,
        seed_emergency_e2e_data,
        seed_master_from_frontend,
        seed_rooms,
        seed_reception_data,
    ]
    for fn in entrypoints:
        with pytest.raises(RuntimeError, match="ENABLE_DEMO_SEED"):
            await fn(confirm_seed_demo=True)


@pytest.mark.asyncio
async def test_standalone_seeds_blocked_in_production(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    entrypoints = [
        seed_clinic_5_departments,
        seed_demo_credentials,
        seed_emergency_e2e_data,
        seed_master_from_frontend,
        seed_rooms,
        seed_reception_data,
    ]
    for fn in entrypoints:
        with pytest.raises(RuntimeError, match="PRODUCTION"):
            await fn(confirm_seed_demo=True)


@pytest.mark.asyncio
async def test_reset_demo_blocked_in_production(api_client, monkeypatch):
    from app.routers.admin import _require_admin
    from app.models.user import TaiKhoan
    from app.main import app

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    app.dependency_overrides[_require_admin] = lambda: TaiKhoan(id=1, vai_tro="admin", email="admin.demo@clinic-ai.test")
    try:
        response = await api_client.post("/api/v1/admin/reset-demo")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(_require_admin, None)


@pytest.mark.asyncio
async def test_admin_bootstrap_demo_mode_synthetic_flags(api_client, monkeypatch):
    from app.routers.admin import _require_admin
    from app.models.user import TaiKhoan
    from app.main import app

    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", True)

    app.dependency_overrides[_require_admin] = lambda: TaiKhoan(id=1, vai_tro="admin", email="admin.demo@clinic-ai.test")
    try:
        response = await api_client.get("/api/v1/admin/bootstrap")
        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert "patients" in payload["data"]
        assert len(payload["data"]["patients"]) > 0
        assert payload["data"]["authSeed"]["is_synthetic"] is True
        assert payload["data"]["clinicSettings"]["is_synthetic"] is True
    finally:
        app.dependency_overrides.pop(_require_admin, None)


@pytest.mark.asyncio
async def test_admin_bootstrap_production_mode_has_no_demo_records(api_client, monkeypatch):
    from app.routers.admin import _require_admin
    from app.models.user import TaiKhoan
    from app.main import app

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", False)

    app.dependency_overrides[_require_admin] = lambda: TaiKhoan(id=1, vai_tro="admin", email="admin.production@clinic-ai.test")
    try:
        response = await api_client.get("/api/v1/admin/bootstrap")
        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        data = payload["data"]
        assert data["paraclinicalTasks"] == []
        assert data["corporateCheckups"] == []
        assert data["treatmentCourses"] == []
        assert data["servicePackageRegistrations"] == []
        assert data["cashierClosings"] == []
        assert data["nationalDrugSync"] == []
        assert data["nationalEhrSync"] == []
        assert data["systemNotifications"] == []
        assert data["auditLogs"] == []
        assert data.get("authSeed") == {}
        for p in data["patients"]:
            assert p.get("data_classification") != "SYNTHETIC_TEST_FIXTURE_DO_NOT_DEPLOY_TO_PRODUCTION"
    finally:
        app.dependency_overrides.pop(_require_admin, None)


@pytest.mark.asyncio
async def test_bff_admin_service_empty_db_bootstrap_isolated_by_environment(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock
    from app.services.bff_admin_service import BffAdminService

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_res

    service = BffAdminService()

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", False)
    prod_data = await service.get_bootstrap_data(mock_db)
    assert prod_data["patients"] == []
    assert prod_data["appointments"] == []
    assert prod_data["vouchers"] == []
    assert prod_data["registrations"] == []
    assert prod_data["paraclinicalTasks"] == []
    assert prod_data["corporateCheckups"] == []
    assert prod_data["treatmentCourses"] == []
    assert prod_data["servicePackageRegistrations"] == []
    assert prod_data["cashierClosings"] == []
    assert prod_data["nationalDrugSync"] == []
    assert prod_data["nationalEhrSync"] == []
    assert prod_data["systemNotifications"] == []
    assert prod_data["auditLogs"] == []
    assert prod_data.get("authSeed") == {}

    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ENABLE_DEMO_SEED", True)
    demo_data = await service.get_bootstrap_data(mock_db)
    assert len(demo_data["patients"]) > 0
    assert len(demo_data["appointments"]) > 0
    assert len(demo_data["vouchers"]) > 0
    assert len(demo_data["registrations"]) > 0
    assert len(demo_data["paraclinicalTasks"]) > 0
    assert demo_data["authSeed"]["is_synthetic"] is True


def test_settings_secret_key_validation(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("PAYMENT_WEBHOOK_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="short_key",
            PAYMENT_WEBHOOK_SECRET="payment_webhook_secret_at_least_32_characters_ok"
        )


def test_settings_payment_webhook_secret_validation(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("PAYMENT_WEBHOOK_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="secret_key_at_least_32_characters_long_for_test",
            PAYMENT_WEBHOOK_SECRET="short_secret"
        )


def test_settings_valid_secrets():
    valid = Settings(
        SECRET_KEY="secret_key_at_least_32_characters_long_for_test",
        PAYMENT_WEBHOOK_SECRET="payment_webhook_secret_at_least_32_characters_ok"
    )
    assert len(valid.SECRET_KEY) >= 32
    assert len(valid.PAYMENT_WEBHOOK_SECRET) >= 32


def test_settings_placeholder_secrets_fail_closed(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("PAYMENT_WEBHOOK_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="replace_with_min_32_chars_random_secret_key",
            PAYMENT_WEBHOOK_SECRET="valid_webhook_secret_for_test_at_least_32_chars"
        )
    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="valid_secret_key_for_test_at_least_32_chars",
            PAYMENT_WEBHOOK_SECRET="replace_with_min_32_chars_random_webhook_secret"
        )
    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="placeholder_key_min_32_characters_long_value",
            PAYMENT_WEBHOOK_SECRET="valid_webhook_secret_for_test_at_least_32_chars"
        )


def test_settings_empty_secrets_fail_closed(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("PAYMENT_WEBHOOK_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="",
            PAYMENT_WEBHOOK_SECRET="valid_webhook_secret_for_test_at_least_32_chars"
        )
    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="valid_secret_key_for_test_at_least_32_chars",
            PAYMENT_WEBHOOK_SECRET=""
        )


def test_docker_compose_backend_environments():
    root_compose = Path(__file__).resolve().parents[2] / "docker-compose.yml"
    backend_compose = Path(__file__).resolve().parents[1] / "docker-compose.yml"

    for compose_path in (root_compose, backend_compose):
        with open(compose_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        env_list = data["services"]["backend"]["environment"]
        env_str = " ".join(str(item) for item in env_list)
        assert "ENVIRONMENT" in env_str
        assert "ENABLE_DEMO_SEED" in env_str
        assert "ENABLE_OUTBOUND_NOTIFICATIONS" in env_str


def test_settings_production_mode_from_env(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ENABLE_DEMO_SEED", "false")
    monkeypatch.setenv("ENABLE_OUTBOUND_NOTIFICATIONS", "true")
    custom_settings = Settings(
        SECRET_KEY="test_production_secret_key_minimum_32_characters_long",
        PAYMENT_WEBHOOK_SECRET="test_production_payment_webhook_secret_minimum_32_chars"
    )
    assert custom_settings.ENVIRONMENT == "production"
    assert custom_settings.ENABLE_DEMO_SEED is False
    assert custom_settings.ENABLE_OUTBOUND_NOTIFICATIONS is True


@pytest.mark.asyncio
async def test_email_service_outbound_disabled_no_recipient_in_log(caplog):
    caplog.set_level(logging.INFO)
    sensitive_recipient = "sensitive_patient_email@clinic-ai.test"
    await email_service.send_otp_email(
        recipient_email=sensitive_recipient,
        otp_code="123456"
    )
    assert "Outbound notifications disabled" in caplog.text
    assert sensitive_recipient not in caplog.text
