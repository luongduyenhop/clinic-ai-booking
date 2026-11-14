import pytest
from unittest.mock import AsyncMock, patch
from app.schemas.sepay import SepayWebhookPayload
from app.services.sepay_service import SepayService


def test_sepay_parse_invoice_reference():
    svc = SepayService()
    assert svc.parse_invoice_reference("CLINIC HD 123 BN01", "") == "123"
    assert svc.parse_invoice_reference("TT-HD-456", "") == "456"
    assert svc.parse_invoice_reference("HD-261113-A1B2C3", "") == "HD-261113-A1B2C3"
    assert svc.parse_invoice_reference("Chuyen khoan vien phi 789", "") == "789"
    assert svc.parse_invoice_reference("", "HD-999") == "999"


def test_sepay_verify_token():
    svc = SepayService()
    with patch("app.services.sepay_service.settings") as mock_settings:
        mock_settings.SEPAY_WEBHOOK_TOKEN = "secret123"
        assert svc.verify_token("Apikey secret123") is True
        assert svc.verify_token("Bearer secret123") is True
        assert svc.verify_token("secret123") is True
        assert svc.verify_token("wrong") is False
        assert svc.verify_token(None) is False

        mock_settings.SEPAY_WEBHOOK_TOKEN = None
        assert svc.verify_token(None) is True


@pytest.mark.asyncio
async def test_sepay_process_webhook_out_transfer():
    svc = SepayService()
    db = AsyncMock()
    payload = SepayWebhookPayload(transferType="out")
    res = await svc.process_webhook(payload, None, db)
    assert res.success is True
    assert "Bỏ qua" in res.message
