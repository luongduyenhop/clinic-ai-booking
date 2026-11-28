import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import Settings
from app.models.compliance import HealthDataAccessAction, HealthDataResourceType
from app.models.medical import HoaDon
from app.models.user import VaiTroEnum
from app.schemas.sepay import SepayWebhookPayload
from app.services.billing.sepay_service import SepayService


@pytest.mark.asyncio
async def test_patient_denied_internal_compliance_endpoints_and_cross_patient_audit(api_client, booking):
    patient_headers = booking.tokens["bn_a"]
    doctor_headers = booking.tokens["bs_x"]
    other_patient_id = booking.bn_b.id

    for path in (
        f"/api/v1/compliance/doctors/{booking.bs_x.id}/license",
        f"/api/v1/compliance/doctors/{booking.bs_x.id}/license/history",
        "/api/v1/compliance/alerts/expiring-licenses",
        "/api/v1/compliance/facility-licenses",
        "/api/v1/compliance/gateway-ping",
    ):
        res = await api_client.get(path, headers=patient_headers)
        assert res.status_code == 403, f"Expected 403 on {path}, got {res.status_code}"

    res_doc = await api_client.get(
        f"/api/v1/compliance/doctors/{booking.bs_x.id}/license",
        headers=doctor_headers,
    )
    assert res_doc.status_code == 200

    res_cross_audit = await api_client.post(
        "/api/v1/compliance/audit/log",
        json={
            "patient_id": other_patient_id,
            "action": HealthDataAccessAction.VIEW.value,
            "resource_type": HealthDataResourceType.ENCOUNTER.value,
            "resource_id": 1,
            "purpose": "KHAM_BENH",
        },
        headers=patient_headers,
    )
    assert res_cross_audit.status_code == 403


def test_sepay_parse_rejects_bare_numbers_and_keeps_payment_keywords():
    svc = SepayService()
    assert svc.parse_invoice_reference("Chuyen tien dot 1 ngay 15", "") is None
    assert svc.parse_invoice_reference("CLINIC HD 123 BN01", "") == "123"
    assert svc.parse_invoice_reference("Chuyen khoan vien phi 789", "") == "789"


@pytest.mark.asyncio
async def test_sepay_webhook_rejects_underpayment_and_bare_number_collision(api_client, booking, db_session):
    await booking.tao_tai_khoan("thungan_sec", VaiTroEnum.THU_NGAN.value)
    invoice = HoaDon(
        ma_hoa_don="HD-261126-UNDER1",
        benh_nhan_id=booking.bn_a.id,
        tong_tien=Decimal("500000.00"),
        mien_giam=Decimal("0.00"),
        so_tien_phai_thu=Decimal("500000.00"),
        thuc_thu=Decimal("500000.00"),
        phuong_thuc_thanh_toan="tien_mat",
        trang_thai="chua_thu",
    )
    db_session.add(invoice)
    await db_session.flush()

    svc = SepayService()
    with patch("app.services.billing.sepay_service.settings") as mock_settings:
        mock_settings.is_hosted = False
        mock_settings.SEPAY_WEBHOOK_TOKEN = None
        res_under = await svc.process_webhook(
            SepayWebhookPayload(
                transferType="in",
                transferAmount=1000,
                content=f"CLINIC HD {invoice.ma_hoa_don}",
            ),
            None,
            db_session,
        )
        assert res_under.success is False
        assert "chưa đủ" in res_under.message

    await db_session.refresh(invoice)
    assert invoice.trang_thai == "chua_thu"

    with patch("app.services.billing.cashier_webhook_service.settings") as mock_wh_settings:
        mock_wh_settings.is_hosted = False
        mock_wh_settings.SEPAY_WEBHOOK_TOKEN = None
        mock_wh_settings.SEPAY_API_KEY = None
        res_bare = await api_client.post(
            "/api/v1/webhook/sepay",
            json={
                "transferType": "in",
                "transferAmount": 500000,
                "content": f"Chuyen tien dot {invoice.id} ngay {datetime.now(timezone.utc).day}",
            },
        )
        assert res_bare.status_code == 200
        assert res_bare.json()["data"]["success"] is False

    await db_session.refresh(invoice)
    assert invoice.trang_thai == "chua_thu"


def test_ai_metrics_report_leakage_free_holdout():
    metrics_path = Path(__file__).resolve().parents[1] / "app" / "ml" / "triage_assets" / "model_metrics_v2.json"
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    assert metrics["leakage_free_holdout"] is True
    assert 0.80 <= metrics["accuracy"] < 0.995
    assert metrics["specialty_macro_f1"] >= 0.85
    assert metrics["nl_benchmark_accuracy"] >= 0.85


def test_docs_enabled_matches_environment_policy():
    demo_settings = Settings(
        _env_file=None,
        ENVIRONMENT="demo",
        DEBUG=False,
        ENABLE_OUTBOUND_NOTIFICATIONS=False,
        SECRET_KEY="a" * 32,
        PAYMENT_WEBHOOK_SECRET="custom_hosted_webhook_secret_2026_xyz",
    )
    prod_settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a" * 32,
        PAYMENT_WEBHOOK_SECRET="custom_hosted_webhook_secret_2026_xyz",
    )
    assert demo_settings.docs_enabled is True
    assert prod_settings.docs_enabled is False
