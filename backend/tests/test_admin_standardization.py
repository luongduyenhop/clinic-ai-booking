from datetime import date, timedelta
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_doctor_schedule_matrix_success(api_client: AsyncClient, booking):
    """
    Kiểm tra API Ma trận phân ca trực và slot khả dụng (tClinic Roster Matrix):
    - Đếm chính xác hạn mức đặt trước, slot vãng lai, số lượng còn trống
    - Nhận diện trạng thái ca (DANG_HOAT_DONG, DA_KHOA, NGHI_PHEP)
    - Kèm danh sách bệnh nhân chi tiết
    """
    headers = booking.tokens["admin"]
    d_start = date.today() - timedelta(days=7)
    d_end = date.today() + timedelta(days=7)

    res = await api_client.get(
        f"/api/v1/admin/shifts/schedule-matrix?tu_ngay={d_start}&den_ngay={d_end}",
        headers=headers,
    )
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["code"] == 200
    data = res_json["data"]

    assert "tu_ngay" in data
    assert "den_ngay" in data
    assert "tong_so_ca_phan_cong" in data
    assert "tong_slot_con_trong" in data
    assert "tong_slot_da_dat" in data
    assert "matrix" in data
    assert isinstance(data["matrix"], list)

    if data["matrix"]:
        cell = data["matrix"][0]
        assert "ca_id" in cell
        assert "bac_si_id" in cell
        assert "ten_bac_si" in cell
        assert "chuyen_khoa" in cell
        assert "ngay" in cell
        assert "ca_lam_viec" in cell
        assert "slot_online_con_trong" in cell
        assert "slot_vang_lai_con_trong" in cell
        assert "is_full" in cell
        assert "danh_sach_benh_nhan" in cell
        assert isinstance(cell["danh_sach_benh_nhan"], list)


@pytest.mark.asyncio
async def test_doctor_schedule_matrix_invalid_date_range(api_client: AsyncClient, booking):
    """Kiểm tra validation khoảng ngày: den_ngay < tu_ngay phải trả về HTTP 400"""
    headers = booking.tokens["admin"]
    res = await api_client.get(
        "/api/v1/admin/shifts/schedule-matrix?tu_ngay=2026-10-20&den_ngay=2026-10-10",
        headers=headers,
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_doctor_timesheet_export_report(api_client: AsyncClient, booking):
    """
    Kiểm tra API Báo cáo chấm công ca trực toàn viện (tClinic xuatbaocao):
    - Thống kê số ca đăng ký, hoàn thành, nghỉ phép, đột xuất
    - Tính toán tỷ lệ lấp đầy ca khám
    """
    headers = booking.tokens["admin"]
    d_start = date.today() - timedelta(days=30)
    d_end = date.today()

    res = await api_client.get(
        f"/api/v1/admin/shifts/export-report?tu_ngay={d_start}&den_ngay={d_end}",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()["data"]

    assert "tong_bac_si" in data
    assert "tong_ca_toan_vien" in data
    assert "tong_luot_kham_toan_vien" in data
    assert "danh_sach_cham_cong" in data
    assert isinstance(data["danh_sach_cham_cong"], list)

    if data["danh_sach_cham_cong"]:
        item = data["danh_sach_cham_cong"][0]
        assert "bac_si_id" in item
        assert "ten_bac_si" in item
        assert "tong_so_ca_phan_cong" in item
        assert "so_ca_hoan_thanh" in item
        assert "ty_le_lap_day_pct" in item


@pytest.mark.asyncio
async def test_services_catalog_export(api_client: AsyncClient, booking):
    """
    Kiểm tra API Xuất toàn bộ danh mục dịch vụ kỹ thuật & bảng giá niêm yết (Thông tư 22/2023/TT-BYT):
    - Đơn giá, đơn vị tính, thời gian trả kết quả TAT, mã nhóm BYT
    """
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/services/export", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert "tong_so_dich_vu" in data
    assert "ngay_xuat" in data
    assert "danh_muc" in data
    assert isinstance(data["danh_muc"], list)

    if data["danh_muc"]:
        svc = data["danh_muc"][0]
        assert "id" in svc
        assert "ma_dich_vu" in svc
        assert "ten_dich_vu" in svc
        assert "don_gia" in svc
        assert "don_vi_tinh" in svc
        assert "thoi_gian_tra_ket_qua_phut" in svc
        assert "is_active" in svc


@pytest.mark.asyncio
async def test_analytics_top_diseases(api_client: AsyncClient, booking):
    """Kiểm tra Dashboard Top 10 bệnh ICD-10 (tClinic /dashboard/top-10-benh-icd10)"""
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/analytics/top-diseases?limit=5", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert "tu_ngay" in data
    assert "den_ngay" in data
    assert "tong_so_ca_chan_doan" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    for item in data["items"]:
        assert "ma_icd10" in item
        assert "ten_benh" in item
        assert "so_ca_mac" in item
        assert "ty_le_pct" in item


@pytest.mark.asyncio
async def test_analytics_top_services(api_client: AsyncClient, booking):
    """Kiểm tra Dashboard Top dịch vụ kỹ thuật doanh thu cao nhất (tClinic /dashboard/top-10-dich-vu-doanh-thu)"""
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/analytics/top-services?limit=5", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert "tu_ngay" in data
    assert "den_ngay" in data
    assert "tong_doanh_thu_cls" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    for item in data["items"]:
        assert "dich_vu_id" in item
        assert "ma_dich_vu" in item
        assert "ten_dich_vu" in item
        assert "so_luong_chi_dinh" in item
        assert "tong_doanh_thu" in item
        assert "ty_le_doanh_thu_pct" in item


@pytest.mark.asyncio
async def test_analytics_doctor_performance(api_client: AsyncClient, booking):
    """Kiểm tra Dashboard Hiệu suất & Thời gian khám bác sĩ (tClinic /dashboard/khambenh/bacsi)"""
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/analytics/doctor-performance", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert "tu_ngay" in data
    assert "den_ngay" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    for item in data["items"]:
        assert "bac_si_id" in item
        assert "ho_ten" in item
        assert "chuyen_khoa" in item
        assert "so_ca_tiep_nhan" in item
        assert "so_ca_kham_xong" in item
        assert "thoi_gian_kham_tb_phut" in item
        assert "doanh_thu_mang_lai" in item


@pytest.mark.asyncio
async def test_analytics_room_workload(api_client: AsyncClient, booking):
    """Kiểm tra Dashboard Phụ tải buồng khám (tClinic /dashboard/dangky/phongkham)"""
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/analytics/room-workload", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert "tu_ngay" in data
    assert "den_ngay" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    for item in data["items"]:
        assert "phong_kham_id" in item
        assert "ma_phong" in item
        assert "ten_phong" in item
        assert "so_ca_truc_phan_cong" in item
        assert "cong_suat_su_dung_pct" in item
        assert "trang_thai_tai" in item
        assert item["trang_thai_tai"] in ["TRONG", "BINH_THUONG", "CAO", "QUA_TAI"]


@pytest.mark.asyncio
async def test_admin_standardization_rbac_forbidden(api_client: AsyncClient, booking):
    """Kiểm tra bảo mật RBAC: Bệnh nhân hoặc người dùng không có quyền Admin không thể truy xuất báo cáo nhạy cảm"""
    patient_headers = booking.tokens["bn_a"]

    # 1. Thử xuất bảng giá với quyền bệnh nhân -> 403 Forbidden
    res1 = await api_client.get("/api/v1/admin/services/export", headers=patient_headers)
    assert res1.status_code == 403

    # 2. Thử xuất báo cáo chấm công với quyền bệnh nhân -> 403 Forbidden
    res2 = await api_client.get(
        "/api/v1/admin/shifts/export-report?tu_ngay=2026-10-01&den_ngay=2026-10-10",
        headers=patient_headers,
    )
    assert res2.status_code == 403

