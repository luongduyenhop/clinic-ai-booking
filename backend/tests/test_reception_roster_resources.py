import pytest
from datetime import date
from app.services.appointment_service import clinic_now
from app.services.queue_service import queue_service


@pytest.mark.asyncio
async def test_get_roster_resources_success(db_session):
    """
    KIỂM THỬ ENDPOINT /api/v1/reception/resources/roster:
    - Tra cứu lịch phân ca trực thực tế trong ngày của Bác sĩ (FC-15)
    - Kiểm tra chữ ký hàm nhận đủ 4 tham số: query_date, ca_kham, chuyen_khoa_id, db
    - Không bị lỗi 500 TypeError mismatch argument
    """
    today = clinic_now().date()

    # 1. Gọi không lọc (lấy toàn bộ ca trực trong ngày)
    rosters = await queue_service.get_roster_resources(
        query_date=today,
        ca_kham=None,
        chuyen_khoa_id=None,
        db=db_session
    )
    assert isinstance(rosters, list)

    # 2. Gọi có lọc ca khám
    rosters_sang = await queue_service.get_roster_resources(
        query_date=today,
        ca_kham="sang",
        chuyen_khoa_id=None,
        db=db_session
    )
    assert isinstance(rosters_sang, list)
    for r in rosters_sang:
        assert r.ca_lam_viec == "sang"
        assert r.lich_lam_viec_id is not None
        assert r.ten_bac_si is not None

