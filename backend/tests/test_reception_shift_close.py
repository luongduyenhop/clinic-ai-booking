import pytest
from datetime import date
from app.services.appointment_service import clinic_now
from app.services.queue_service import queue_service
from app.schemas.queue import (
    CloseReceptionShiftRequest,
    CloseReceptionShiftResponse,
    PreCloseShiftAuditResponse,
)


@pytest.mark.asyncio
async def test_get_shift_pre_close_audit_service(db_session):
    today = clinic_now().date()
    audit_res = await queue_service.get_shift_pre_close_audit(
        ca_kham="sang",
        query_date=today,
        db=db_session
    )

    assert isinstance(audit_res, PreCloseShiftAuditResponse)
    assert audit_res.ca_kham == "sang"
    assert audit_res.ngay == today
    assert audit_res.canh_bao is not None
    assert isinstance(audit_res.canh_bao.so_dang_kham, int)
    assert isinstance(audit_res.canh_bao.so_cho_kham_chua_kham, int)
    assert isinstance(audit_res.chi_tiet.dang_kham, list)
    assert isinstance(audit_res.chi_tiet.cho_kham, list)
    assert audit_res.de_xuat_hanh_dong is not None
    assert audit_res.de_xuat_hanh_dong.de_xuat_xu_ly_cho_kham == "CHUYEN_CA_TIEP_THEO"


@pytest.mark.asyncio
async def test_api_reception_shift_close_endpoints(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    today_str = clinic_now().date().isoformat()

    resp_audit = await api_client.get(
        f"/api/v1/reception/shift/pre-close-audit?ca_kham=sang&query_date={today_str}",
        headers=token_admin
    )
    assert resp_audit.status_code == 200, f"Error: {resp_audit.text}"
    data_audit = resp_audit.json()
    assert data_audit["success"] is True
    assert "canh_bao" in data_audit["data"]
    assert "chi_tiet" in data_audit["data"]
    assert "de_xuat_hanh_dong" in data_audit["data"]

    close_payload = {
        "ca_kham": "sang",
        "ngay": today_str,
        "xu_ly_cho_kham": "CHUYEN_CA_TIEP_THEO",
        "tu_dong_chot_no_show": True,
        "ghi_chu_ban_giao": "Bàn giao các ca chờ cho Lễ tân ca chiều tiếp tục điều phối",
    }
    resp_close = await api_client.post(
        "/api/v1/reception/shift/close",
        json=close_payload,
        headers=token_admin
    )
    assert resp_close.status_code == 200, f"Error: {resp_close.text}"
    data_close = resp_close.json()
    assert data_close["success"] is True
    assert data_close["data"]["ca_kham_dong"] == "sang"
    assert "so_ve_chuyen_ca_chieu" in data_close["data"]
    assert "nguoi_dong_ca" in data_close["data"]
    assert data_close["data"]["nguoi_dong_ca"] is not None


@pytest.mark.asyncio
async def test_api_reception_rbac_and_time_validation(api_client, booking, db_session):
    token_patient = booking.tokens["bn_a"]
    token_admin = booking.tokens["admin"]

    resp_patient = await api_client.post(
        "/api/v1/reception/shift/close",
        json={"ca_kham": "sang", "xu_ly_cho_kham": "CHUYEN_CA_TIEP_THEO"},
        headers=token_patient
    )
    assert resp_patient.status_code == 403

    future_date = date(2099, 1, 1).isoformat()
    resp_future = await api_client.post(
        "/api/v1/reception/shift/close",
        json={"ca_kham": "sang", "ngay": future_date, "xu_ly_cho_kham": "CHUYEN_CA_TIEP_THEO"},
        headers=token_admin
    )
    assert resp_future.status_code == 400
    assert "tương lai" in resp_future.json()["message"]

