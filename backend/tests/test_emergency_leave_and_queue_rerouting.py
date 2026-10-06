import pytest
from datetime import date, datetime, time, timezone
from app.models.appointment import LichLamViec, HangDoiKham, LichKham, CaLamViecEnum, TrangThaiHangDoiEnum, TrangThaiLichEnum
from app.models.medical import LuotKham
from app.models.user import ChuyenKhoa


@pytest.mark.asyncio
async def test_declare_emergency_leave_and_impact_metrics(api_client, booking, db_session):
    """
    Kịch bản 1: Khai báo nghỉ đột xuất và thống kê chính xác số bệnh nhân bị ảnh hưởng (N1, N2, N3).
    """
    token_admin = booking.tokens["admin"]
    today = date.today()

    # Tạo ca làm việc cho bs_x (Ca sáng)
    shift_x = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        gioi_han_ca_kham=10,
        is_active=True
    )
    db_session.add(shift_x)
    await db_session.flush()

    # 1. Tạo 2 vé CHO_KHAM trong hàng đợi của bs_x
    hd1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    hd2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    # 2. Tạo 1 vé DANG_KHAM
    hd3 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=3,
        trang_thai=TrangThaiHangDoiEnum.DANG_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    # 3. Tạo 1 lịch hẹn chưa check-in trong ca sáng
    lk = LichKham(
        ma_lich_kham=f"LK-EMERGENCY-{booking.suffix}-1",
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=time(9, 0),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    db_session.add_all([hd1, hd2, hd3, lk])
    await db_session.flush()

    # Admin gọi API khai báo nghỉ đột xuất
    res = await api_client.post(
        f"/api/v1/admin/shifts/{shift_x.id}/emergency-leave",
        json={"ly_do_nghi": "Bác sĩ sốt cao cấp tính không thể tiếp tục khám"},
        headers=token_admin
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["is_active"] is False
    assert data["so_ve_cho_kham"] == 2
    assert data["so_ve_dang_kham"] == 1
    assert data["so_lich_chua_checkin"] == 1

    # Cố tình gọi khai báo lần 2 -> 409 Conflict
    res_dup = await api_client.post(
        f"/api/v1/admin/shifts/{shift_x.id}/emergency-leave",
        json={"ly_do_nghi": "Thử khai báo trùng"},
        headers=token_admin
    )
    assert res_dup.status_code == 409
    assert "đã được đánh dấu nghỉ" in res_dup.json()["message"]


@pytest.mark.asyncio
async def test_reassign_queue_preconditions_validation(api_client, booking, db_session):
    """
    Kịch bản 2: Kiểm tra các Preconditions khi điều phối hàng đợi:
    - Bác sĩ thay thế khác chuyên khoa -> 400 Bad Request.
    - Bác sĩ thay thế bị quá tải (vượt giới hạn ca) -> 409 Conflict.
    """
    token_admin = booking.tokens["admin"]
    today = date.today()

    # Tạo chuyên khoa mới (khác chuyên khoa của bs_x)
    ck_diff = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-DIFF-{booking.suffix}",
        ten_chuyen_khoa="Chuyên khoa Khác",
        vi_tri_phong="P.999"
    )
    db_session.add(ck_diff)
    await db_session.flush()

    # Gán chuyên khoa khác cho bs_y
    booking.bs_y.chuyen_khoa_id = ck_diff.id
    await db_session.flush()

    # Ca trực bs_x đã nghỉ
    shift_x = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        is_active=False,
        ghi_chu_nghi="Nghỉ đột xuất"
    )
    db_session.add(shift_x)
    await db_session.flush()

    # Thử điều phối sang bs_y (khác chuyên khoa) -> 400 Bad Request
    res_mismatch = await api_client.post(
        f"/api/v1/admin/shifts/{shift_x.id}/reassign",
        json={"bac_si_thay_the_id": booking.bs_y.id},
        headers=token_admin
    )
    assert res_mismatch.status_code == 400
    assert "không cùng chuyên khoa" in res_mismatch.json()["message"]

    # Đưa bs_y về cùng chuyên khoa với bs_x
    booking.bs_y.chuyen_khoa_id = booking.bs_x.chuyen_khoa_id
    await db_session.flush()

    # Tạo ca trực cho bs_y nhưng giới hạn chỉ còn 1 slot
    shift_y = LichLamViec(
        bac_si_id=booking.bs_y.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        gioi_han_ca_kham=2,  # Tối đa 2 bệnh nhân
        is_active=True
    )
    # bs_y đã có sẵn 1 vé
    hd_y1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_y.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    # Trong khi ca của bs_x có tới 2 vé cần chuyển
    hd_x1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    hd_x2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    db_session.add_all([shift_y, hd_y1, hd_x1, hd_x2])
    await db_session.flush()

    # 1 + 2 = 3 > gioi_han_ca_kham (2) -> 409 Conflict quá tải
    res_overload = await api_client.post(
        f"/api/v1/admin/shifts/{shift_x.id}/reassign",
        json={"bac_si_thay_the_id": booking.bs_y.id},
        headers=token_admin
    )
    assert res_overload.status_code == 409
    assert "quá tải" in res_overload.json()["message"]


@pytest.mark.asyncio
async def test_reassign_queue_success_and_stt_rescoping(api_client, booking, db_session):
    """
    Kịch bản 3: Điều phối thành công:
    - Cấp lại STT nối tiếp cho BS thay thế (STT rescoped: #2, #3).
    - Bàn giao ca đang khám dở vào LuotKham.tiep_quan_boi_id.
    - Chuyển bác sĩ cho cả các lịch hẹn chưa check-in.
    """
    token_admin = booking.tokens["admin"]
    today = date.today()

    # Đồng bộ chuyên khoa
    booking.bs_y.chuyen_khoa_id = booking.bs_x.chuyen_khoa_id
    await db_session.flush()

    # 1. Ca của bs_x (nghỉ đột xuất)
    shift_x = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.CHIEU.value,
        gio_bat_dau=time(13, 30),
        gio_ket_thuc=time(17, 0),
        gioi_han_ca_kham=7,
        is_active=False,
        ghi_chu_nghi="Bác sĩ có việc đột xuất"
    )
    # 2. Ca của bs_y (hoạt động bình thường, giới hạn 10)
    shift_y = LichLamViec(
        bac_si_id=booking.bs_y.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.CHIEU.value,
        gio_bat_dau=time(13, 30),
        gio_ket_thuc=time(17, 0),
        gioi_han_ca_kham=10,
        is_active=True
    )
    db_session.add_all([shift_x, shift_y])
    await db_session.flush()

    # Bác sĩ Y đã có 1 bệnh nhân STT #1
    hd_y1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_y.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.CHIEU.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )

    # Bác sĩ X có 2 vé chờ khám (STT #1, #2)
    hd_x1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.CHIEU.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    hd_x2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.CHIEU.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )

    # Bác sĩ X có 1 ca đang khám dở
    lich_dang = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.now(timezone.utc))
    hd_x_dang = HangDoiKham(
        lich_kham_id=lich_dang.id,
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.CHIEU.value,
        so_thu_tu_kham=3,
        trang_thai=TrangThaiHangDoiEnum.DANG_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    luot_dang = LuotKham(
        lich_kham_id=lich_dang.id,
        bac_si_id=booking.bs_x.id,
        benh_nhan_id=booking.bn_a.id,
        thoi_gian_bat_dau=datetime.now(timezone.utc),
        is_locked=False
    )

    # Bác sĩ X có 1 lịch hẹn chưa check-in
    lich_chua_den = LichKham(
        ma_lich_kham=f"LK-FUTURE-{booking.suffix}-9",
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=time(15, 0),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    db_session.add_all([hd_y1, hd_x1, hd_x2, hd_x_dang, luot_dang, lich_chua_den])
    await db_session.flush()

    # Thực hiện điều phối
    res = await api_client.post(
        f"/api/v1/admin/shifts/{shift_x.id}/reassign",
        json={"bac_si_thay_the_id": booking.bs_y.id},
        headers=token_admin
    )
    assert res.status_code == 200
    res_data = res.json()["data"]
    assert res_data["so_ve_cho_kham_da_chuyen"] == 2
    assert res_data["so_ve_dang_kham_ban_giao"] == 1
    assert res_data["so_lich_chua_checkin_da_chuyen"] == 1

    # Kiểm tra STT mới trong hàng đợi BS Y
    await db_session.refresh(hd_x1)
    await db_session.refresh(hd_x2)
    await db_session.refresh(hd_x_dang)
    await db_session.refresh(luot_dang)
    await db_session.refresh(lich_chua_den)

    assert hd_x1.bac_si_id == booking.bs_y.id
    assert hd_x1.so_thu_tu_kham == 2  # Nối tiếp sau STT #1 của BS Y
    assert "Điều phối" in hd_x1.ghi_chu_dieu_phoi

    assert hd_x2.bac_si_id == booking.bs_y.id
    assert hd_x2.so_thu_tu_kham == 3  # Nối tiếp sau STT #2

    # Kiểm tra ca đang khám dở: đã ghi nhận BS tiếp quản
    assert hd_x_dang.bac_si_id == booking.bs_y.id
    assert luot_dang.tiep_quan_boi_id == booking.bs_y.id
    assert "Bàn giao ca" in luot_dang.ly_do_tiep_quan

    # Kiểm tra lịch hẹn chưa đến: đã đổi sang BS Y
    assert lich_chua_den.bac_si_id == booking.bs_y.id


@pytest.mark.asyncio
async def test_postpone_and_cancel_unassigned_flow(api_client, booking, db_session):
    """
    Kịch bản 4: Không có bác sĩ thay thế:
    - Vé chờ chuyển sang TAM_HOAN.
    - Lịch hẹn chưa đến chuyển sang TU_DONG_HUY có ghi chú bảo lưu quyền lợi.
    """
    token_admin = booking.tokens["admin"]
    today = date.today()

    shift_x = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        gioi_han_ca_kham=8,
        is_active=False,
        ghi_chu_nghi="Bác sĩ ốm đột xuất"
    )
    db_session.add(shift_x)
    await db_session.flush()

    hd_wait = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc)
    )
    lk_wait = LichKham(
        ma_lich_kham=f"LK-POSTPONE-{booking.suffix}-1",
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=time(10, 0),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    db_session.add_all([hd_wait, lk_wait])
    await db_session.flush()

    res = await api_client.post(
        f"/api/v1/admin/shifts/{shift_x.id}/postpone-and-cancel",
        headers=token_admin
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["so_ve_tam_hoan"] == 1
    assert data["so_lich_da_huy"] == 1

    await db_session.refresh(hd_wait)
    await db_session.refresh(lk_wait)

    assert hd_wait.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value
    assert "Tạm hoãn do Bác sĩ nghỉ đột xuất" in hd_wait.ghi_chu_dieu_phoi

    assert lk_wait.trang_thai == TrangThaiLichEnum.TU_DONG_HUY.value
    assert "Bảo lưu điểm tín nhiệm" in lk_wait.ghi_chu
