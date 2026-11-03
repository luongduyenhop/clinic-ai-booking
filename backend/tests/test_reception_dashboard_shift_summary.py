import pytest
from datetime import date
from app.services.appointment_service import clinic_now
from app.services.queue_service import queue_service
from app.schemas.queue import ShiftDashboardResponse


@pytest.mark.asyncio
async def test_get_shift_dashboard_service_integration(db_session):
    """
    KIỂM THỬ TỔNG HỢP DASHBOARD CA TRỰC LỄ TÂN (FC-10 & BFF Dashboard):
    - Đảm bảo trả về đầy đủ các chỉ số KPI, các alias fields cho FE.
    - Đảm bảo trả về 7 khung giờ mật độ check-in (mat_do_theo_gio).
    - Đảm bảo trả về danh sách lịch hẹn sắp tới (lich_hen_sap_toi).
    - Đảm bảo trả về danh sách bệnh nhân chờ lâu (benh_nhan_cho_lau).
    - Đảm bảo trả về nhật ký hoạt động gần đây của Lễ tân (hoat_dong_gan_day).
    """
    today = clinic_now().date()

    dashboard = await queue_service.get_shift_dashboard(
        query_date=today,
        ca_kham=None,
        db=db_session
    )

    assert isinstance(dashboard, ShiftDashboardResponse)
    assert dashboard.ngay == today
    assert dashboard.ca_kham in ("sang", "chieu")

    # 1. Kiểm tra KPI fields và Alias fields
    assert isinstance(dashboard.tong_hen_truoc, int)
    assert isinstance(dashboard.so_da_check_in, int)
    assert isinstance(dashboard.da_check_in, int)
    assert dashboard.da_check_in == dashboard.so_da_check_in
    assert dashboard.dang_cho_kham == dashboard.so_dang_cho
    assert dashboard.dang_kham == dashboard.so_dang_kham
    assert dashboard.da_kham == dashboard.so_da_kham
    assert dashboard.vang_mat == dashboard.so_vang_mat_chua_xu_ly
    assert dashboard.bo_kham == dashboard.so_bo_kham
    assert dashboard.vang_lai == dashboard.so_vang_lai

    # 2. Kiểm tra Mật độ check-in theo khung giờ (mat_do_theo_gio)
    assert isinstance(dashboard.mat_do_theo_gio, list)
    assert len(dashboard.mat_do_theo_gio) == 7
    expected_hours = ["07:30", "08:30", "09:30", "10:30", "13:30", "14:30", "15:30"]
    actual_hours = [item.khung_gio for item in dashboard.mat_do_theo_gio]
    assert actual_hours == expected_hours
    for item in dashboard.mat_do_theo_gio:
        assert isinstance(item.so_luong, int)
        assert item.so_luong >= 0

    # 3. Kiểm tra Lịch hẹn sắp tới (lich_hen_sap_toi)
    assert isinstance(dashboard.lich_hen_sap_toi, list)
    assert len(dashboard.lich_hen_sap_toi) <= 5
    for item in dashboard.lich_hen_sap_toi:
        assert item.id > 0
        assert item.ma_lich_kham is not None
        assert item.ten_benh_nhan is not None
        assert item.gio_kham is not None

    # 4. Kiểm tra Bệnh nhân chờ lâu (benh_nhan_cho_lau)
    assert isinstance(dashboard.benh_nhan_cho_lau, list)
    assert len(dashboard.benh_nhan_cho_lau) <= 5
    for item in dashboard.benh_nhan_cho_lau:
        assert item.ticket_id > 0
        assert item.ma_so_thu_tu is not None
        assert item.ten_benh_nhan is not None
        assert item.thoi_gian_cho_phut >= 0

    # 5. Kiểm tra Nhật ký hoạt động gần đây (hoat_dong_gan_day)
    assert isinstance(dashboard.hoat_dong_gan_day, list)
    assert len(dashboard.hoat_dong_gan_day) <= 10
    for item in dashboard.hoat_dong_gan_day:
        assert item.id.startswith("ACT-")
        assert item.loai_thao_tac in ("WALK_IN_CREATE", "CHECK_IN", "TRANSFER_ROOM", "LEAVE_QUEUE", "CLOSE_TICKET")
        assert item.noi_dung is not None
        assert item.thoi_gian is not None
        assert item.nguoi_thuc_hien is not None


@pytest.mark.asyncio
async def test_get_shift_dashboard_http_endpoint(api_client, booking):
    """
    KIỂM THỬ API HTTP GET /api/v1/reception/dashboard/shift-summary
    """
    token_letan = booking.tokens["admin"]
    res = await api_client.get("/api/v1/reception/dashboard/shift-summary", headers=token_letan)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    data = body["data"]

    # Kiểm tra cấu trúc payload
    assert "tong_hen_truoc" in data
    assert "da_check_in" in data
    assert "dang_cho_kham" in data
    assert "dang_kham" in data
    assert "da_kham" in data
    assert "vang_mat" in data
    assert "mat_do_theo_gio" in data
    assert "lich_hen_sap_toi" in data
    assert "benh_nhan_cho_lau" in data
    assert "hoat_dong_gan_day" in data
    assert len(data["mat_do_theo_gio"]) == 7
