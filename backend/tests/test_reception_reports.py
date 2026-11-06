import pytest
from datetime import date
from app.services.appointment_service import clinic_now
from app.services.queue_service import queue_service
from app.schemas.queue import (
    ReceptionReportSummaryResponse,
    ReceptionAuditLogResponse,
)


@pytest.mark.asyncio
async def test_get_reception_report_summary_service(db_session):
    """
    Kiểm thử service báo cáo đối soát vận hành tiếp đón (Phân hệ 9 - API 9.1):
    - Đảm bảo trả về đúng cấu trúc ReceptionReportSummaryResponse
    - Có kpi đầy đủ các trường KPI theo giao diện ReportsPage
    - Có phân bổ chuyên khoa phan_bo_chuyen_khoa
    """
    today = clinic_now().date()

    res = await queue_service.get_reception_report_summary(
        query_date=today,
        ca_kham=None,
        db=db_session
    )

    assert isinstance(res, ReceptionReportSummaryResponse)
    assert res.ngay == today
    assert res.kpi is not None
    assert isinstance(res.kpi.tong_luot_tiep_nhan, int)
    assert isinstance(res.kpi.so_lich_hen, int)
    assert isinstance(res.kpi.so_vang_lai, int)
    assert isinstance(res.kpi.thoi_gian_cho_trung_binh_phut, (int, float))
    assert isinstance(res.kpi.so_lich_huy, int)
    assert isinstance(res.kpi.so_no_show, int)

    assert isinstance(res.phan_bo_chuyen_khoa, list)
    for sp in res.phan_bo_chuyen_khoa:
        assert sp.ten_chuyen_khoa is not None
        assert isinstance(sp.so_luot, int)
        assert isinstance(sp.ti_le_phan_tram, (int, float))
        assert isinstance(sp.thoi_gian_cho_tb_phut, (int, float))


@pytest.mark.asyncio
async def test_get_reception_audit_logs_service(db_session):
    """
    Kiểm thử service nhật ký kiểm toán tiếp đón (Phân hệ 9 - API 9.2):
    - Đảm bảo trả về đúng cấu trúc ReceptionAuditLogResponse
    - Hỗ trợ phân trang chuẩn pagination
    - Các items có đầy đủ id, timestamp, actor, action_type, description
    """
    today = clinic_now().date()

    res = await queue_service.get_reception_audit_logs(
        query_date=today,
        action_type=None,
        search=None,
        page=1,
        page_size=10,
        db=db_session
    )

    assert isinstance(res, ReceptionAuditLogResponse)
    assert isinstance(res.items, list)
    assert res.pagination is not None
    assert res.pagination.page == 1
    assert res.pagination.page_size == 10
    assert res.pagination.total_items >= 0
    assert res.pagination.total_pages >= 1

    for log in res.items:
        assert log.id.startswith("AUDIT-")
        assert log.timestamp is not None
        assert log.actor is not None
        assert log.action_type in (
            "CHECK_IN", "WALK_IN_CREATE", "APPOINTMENT_RESCHEDULE", "APPOINTMENT_CANCEL",
            "QUEUE_TRANSFER_ROOM", "QUEUE_CALL", "QUEUE_DEFER", "LEAVE_QUEUE", "CLOSE_TICKET"
        )


@pytest.mark.asyncio
async def test_api_reception_reports_endpoints(api_client, booking, db_session):
    """
    Kiểm thử HTTP API Endpoints tại /api/v1/reception/reports/...
    1. GET /api/v1/reception/reports/summary?query_date=YYYY-MM-DD
    2. GET /api/v1/reception/reports/audit-logs?query_date=YYYY-MM-DD&page=1&page_size=10
    """
    token_admin = booking.tokens["admin"]
    today_str = clinic_now().date().isoformat()

    # 1. API Summary
    resp_sum = await api_client.get(
        f"/api/v1/reception/reports/summary?query_date={today_str}",
        headers=token_admin
    )
    assert resp_sum.status_code == 200, f"Error: {resp_sum.text}"
    json_sum = resp_sum.json()
    assert json_sum["success"] is True
    assert "kpi" in json_sum["data"]
    assert "tong_luot_tiep_nhan" in json_sum["data"]["kpi"]
    assert "phan_bo_chuyen_khoa" in json_sum["data"]

    # 2. API Audit Logs
    resp_audit = await api_client.get(
        f"/api/v1/reception/reports/audit-logs?query_date={today_str}&page=1&page_size=10",
        headers=token_admin
    )
    assert resp_audit.status_code == 200, f"Error: {resp_audit.text}"
    json_audit = resp_audit.json()
    assert json_audit["success"] is True
    assert "items" in json_audit["data"]
    assert "pagination" in json_audit["data"]
    assert json_audit["data"]["pagination"]["page"] == 1
    assert json_audit["data"]["pagination"]["pageSize"] == 10
