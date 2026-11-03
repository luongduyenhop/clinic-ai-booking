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
    """
    Kiểm thử service quét đối soát trước khi đóng ca trực:
    - Đảm bảo trả về đúng cấu trúc PreCloseShiftAuditResponse
    - Có cảnh báo tổng quan và danh sách chi tiết
    """
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
    """
    Kiểm thử 2 HTTP Endpoints:
    1. GET /api/v1/reception/shift/pre-close-audit?ca_kham=sang
    2. POST /api/v1/reception/shift/close (Bàn giao ca sáng sang ca chiều)
    """
    token_admin = booking.tokens["admin"]
    today_str = clinic_now().date().isoformat()

    # 1. Gọi Pre-close audit
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

    # 2. Thực hiện Đóng ca trực
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

