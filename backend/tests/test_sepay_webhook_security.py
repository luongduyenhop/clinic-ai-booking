from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from app.core.config import DEFAULT_PAYMENT_WEBHOOK_SECRET, Settings
from app.core.exceptions import ForbiddenException
from app.schemas.sepay import SepayWebhookPayload
from app.services.billing.sepay_service import SepayService


@pytest.mark.asyncio
async def test_hosted_missing_sepay_webhook_token_fails_closed():
    svc = SepayService()
    for empty_token in (None, "", "   "):
        with patch("app.services.billing.sepay_service.settings") as mock_settings:
            mock_settings.is_hosted = True
            mock_settings.SEPAY_WEBHOOK_TOKEN = empty_token
            assert svc.verify_token(None) is False
            assert svc.verify_token("Apikey anything") is False
            with pytest.raises(ForbiddenException) as exc:
                await svc.process_webhook(SepayWebhookPayload(transferType="in"), None, AsyncMock())
            assert exc.value.code == 403

    with patch("app.services.billing.sepay_service.settings") as mock_settings:
        mock_settings.is_hosted = False
        mock_settings.SEPAY_WEBHOOK_TOKEN = None
        assert svc.verify_token(None) is True


@pytest.mark.asyncio
async def test_hosted_wrong_or_missing_sepay_header_rejected():
    svc = SepayService()
    with patch("app.services.billing.sepay_service.settings") as mock_settings:
        mock_settings.is_hosted = True
        mock_settings.SEPAY_WEBHOOK_TOKEN = "live_sepay_token_2026"
        invalid_headers = (
            None,
            "",
            "   ",
            "Apikey ",
            "Bearer ",
            "Apikey wrong",
            "Bearer wrong",
            "Apikeylive_sepay_token_2026",
        )
        for bad_header in invalid_headers:
            assert svc.verify_token(bad_header) is False
        with pytest.raises(ForbiddenException) as exc:
            await svc.process_webhook(SepayWebhookPayload(transferType="in"), "Bearer wrong", AsyncMock())
        assert exc.value.code == 403


def test_hosted_valid_sepay_headers_accepted():
    svc = SepayService()
    with patch("app.services.billing.sepay_service.settings") as mock_settings:
        mock_settings.is_hosted = True
        mock_settings.SEPAY_WEBHOOK_TOKEN = "live_sepay_token_2026"
        valid_headers = (
            "Apikey live_sepay_token_2026",
            "Bearer live_sepay_token_2026",
            "apikey live_sepay_token_2026",
            "bearer live_sepay_token_2026",
            "Apikey   live_sepay_token_2026  ",
            "live_sepay_token_2026",
        )
        for valid_header in valid_headers:
            assert svc.verify_token(valid_header) is True


def test_hosted_settings_rejects_default_or_empty_payment_webhook_secret(monkeypatch):
    monkeypatch.delenv("PAYMENT_WEBHOOK_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            ENVIRONMENT="demo",
            DEBUG=False,
            ENABLE_OUTBOUND_NOTIFICATIONS=False,
            SECRET_KEY="a" * 32,
        )

    bad_secrets = (
        None,
        "",
        "   ",
        DEFAULT_PAYMENT_WEBHOOK_SECRET,
        "replace_with_real_secret",
        "change_in_production_secret",
        "placeholder_secret",
    )
    for bad_secret in bad_secrets:
        with pytest.raises(ValidationError):
            Settings(
                _env_file=None,
                ENVIRONMENT="production",
                DEBUG=False,
                SECRET_KEY="a" * 32,
                PAYMENT_WEBHOOK_SECRET=bad_secret,
            )

    demo_settings = Settings(
        _env_file=None,
        ENVIRONMENT="demo",
        DEBUG=False,
        ENABLE_OUTBOUND_NOTIFICATIONS=False,
        SECRET_KEY="a" * 32,
        PAYMENT_WEBHOOK_SECRET="custom_hosted_webhook_secret_2026_xyz",
    )
    assert demo_settings.PAYMENT_WEBHOOK_SECRET == "custom_hosted_webhook_secret_2026_xyz"

    prod_settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a" * 32,
        PAYMENT_WEBHOOK_SECRET="custom_hosted_webhook_secret_2026_xyz",
    )
    assert prod_settings.PAYMENT_WEBHOOK_SECRET == "custom_hosted_webhook_secret_2026_xyz"

    local_settings = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        SECRET_KEY="a" * 32,
    )
    assert local_settings.PAYMENT_WEBHOOK_SECRET == DEFAULT_PAYMENT_WEBHOOK_SECRET


@pytest.mark.asyncio
async def test_http_sepay_webhook_endpoint_enforces_hosted_token(api_client):
    with patch("app.services.billing.cashier_webhook_service.settings") as mock_settings:
        mock_settings.is_hosted = True
        mock_settings.SEPAY_WEBHOOK_TOKEN = None
        mock_settings.SEPAY_API_KEY = None
        res_missing_token = await api_client.post(
            "/api/v1/webhook/sepay",
            json={"transferType": "out"},
        )
        assert res_missing_token.status_code == 403

        mock_settings.SEPAY_WEBHOOK_TOKEN = "hosted_tok_999"
        res_wrong_token = await api_client.post(
            "/api/v1/webhook/sepay",
            headers={"Authorization": "Apikey wrong"},
            json={"transferType": "out"},
        )
        assert res_wrong_token.status_code == 403

        res_valid_token = await api_client.post(
            "/api/v1/webhook/sepay",
            headers={"Authorization": "Apikey hosted_tok_999"},
            json={"transferType": "out"},
        )
        assert res_valid_token.status_code == 200
        assert res_valid_token.json()["data"]["success"] is True
