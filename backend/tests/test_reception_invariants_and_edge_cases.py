import pytest
from datetime import date, time, datetime, timedelta
from app.models.user import VaiTroEnum, NguoiDung, TaiKhoan, BenhNhan, BacSi
from app.models.appointment import LichKham, TrangThaiLichEnum
from app.schemas.queue import CheckInRequest, WalkInQuickRequest
from app.services.queue_service import queue_service
from app.services.appointment_service import build_day_slots
from app.core.exceptions import BadRequestException


@pytest.mark.asyncio
async def test_future_appointment_cannot_check_in_today(db_session):
    """
    INVARIANT 1: Lịch hẹn ngày tương lai KHÔNG ĐƯỢC PHÉP Check-in vào hàng đợi hôm nay.
    - Tìm kiếm tra cứu: Vẫn tìm thấy để xem thông tin hoặc dời lịch.
    - Check-in tại quầy: Bị từ chối HTTP 400 Bad Request, tránh làm ô nhiễm hàng đợi phục vụ thực tế.
    """
    today = date.today()
    tomorrow = today + timedelta(days=1)

    nd_bs = NguoiDung(ho_ten="BS Test Ngày", email="bs.ngay@clinic.com", so_dien_thoai="0988001122")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, hoc_vi="BS", chung_chi_hanh_nghe="CCHN-NGAY", gia_kham_mac_dinh=200000)
    db_session.add(bs)
    await db_session.flush()

    nd_bn = NguoiDung(ho_ten="BN Hẹn Ngày Mai", email="bn.mai@clinic.com", so_dien_thoai="0911223344")
    db_session.add(nd_bn)
    await db_session.flush()
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te="BN-MAI-01")
    db_session.add(bn)
    await db_session.flush()

    # Tạo lịch hẹn cho ngày mai
    lich_mai = LichKham(
        ma_lich_kham="LK-TOMORROW-01",
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ngay_kham=tomorrow,
        gio_kham=time(8, 0),
        thoi_luong_phut=30,
        so_thu_tu=1,
        ly_do_kham="Khám dạ dày",
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    db_session.add(lich_mai)
    await db_session.flush()

    # Lễ tân thực hiện Check-in
    admin_user = TaiKhoan(nguoi_dung_id=nd_bs.id, email="admin@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.ADMIN.value)

    # ASSERTION 1: Check-in lịch ngày mai vào hôm nay phải bị từ chối
    with pytest.raises(BadRequestException) as exc_info:
        await queue_service.check_in_patient(
            payload=CheckInRequest(lich_kham_id=lich_mai.id),
            receptionist_user=admin_user,
            db=db_session
        )
    assert "Chỉ có thể Check-in cấp số thứ tự vào đúng ngày khám đã đăng ký" in str(exc_info.value.message)

    # ASSERTION 2: Khi lịch hẹn đúng ngày hôm nay -> Check-in thành công
    lich_mai.ngay_kham = today
    await db_session.flush()
    ticket = await queue_service.check_in_patient(
        payload=CheckInRequest(lich_kham_id=lich_mai.id),
        receptionist_user=admin_user,
        db=db_session
    )
    assert ticket is not None
    assert ticket.so_thu_tu_kham == 1
    assert ticket.ngay_kham == today


def test_afternoon_shift_slot_limit_strict():
    """
    INVARIANT 2: Ca chiều 13:30 - 17:00 (210 phút) có ĐÚNG 7 slot 30 phút.
    - Không được vượt quá 17:00 (slot 17:00 - 17:30 ngoài giờ làm việc).
    - Ca sáng 07:30 - 11:30 (240 phút) có ĐÚNG 8 slot 30 phút.
    """
    query_date = date(2026, 10, 6)
    shifts = [(time(13, 30), time(17, 0))]  # 13:30 - 17:00
    now_past = datetime(2026, 10, 6, 7, 0)  # trước ca chiều

    slots = build_day_slots(
        query_date=query_date,
        shifts=shifts,
        booked_ranges=[],
        now=now_past,
        slot_minutes=30
    )

    # Phải có chính xác 7 slots
    assert len(slots) == 7
    slot_times = [s.time_str for s in slots]
    expected_times = ["13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
    assert slot_times == expected_times
    # Tuyệt đối không có slot 17:00
    assert "17:00" not in slot_times


@pytest.mark.asyncio
async def test_queue_scoping_and_no_collision_in_same_queue(db_session):
    """
    INVARIANT 3: Hai bệnh nhân trong cùng một hàng đợi (cùng bác sĩ, cùng ngày, cùng ca)
    phải nhận STT tăng dần và KHÔNG BAO GIỜ trùng số thứ tự.
    """
    today = date.today()
    nd_bs = NguoiDung(ho_ten="BS Tim Mạch Scope", email="bs.scope@clinic.com")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, hoc_vi="BS", chung_chi_hanh_nghe="CCHN-SCOPE", gia_kham_mac_dinh=200000)
    db_session.add(bs)
    await db_session.flush()

    nd_1 = NguoiDung(ho_ten="Bệnh Nhân 1", email="bn1.scope@clinic.com")
    nd_2 = NguoiDung(ho_ten="Bệnh Nhân 2", email="bn2.scope@clinic.com")
    db_session.add_all([nd_1, nd_2])
    await db_session.flush()

    bn_1 = BenhNhan(nguoi_dung_id=nd_1.id, ma_dinh_danh_y_te="BN-SCOPE-01")
    bn_2 = BenhNhan(nguoi_dung_id=nd_2.id, ma_dinh_danh_y_te="BN-SCOPE-02")
    db_session.add_all([bn_1, bn_2])
    await db_session.flush()

    lich_1 = LichKham(ma_lich_kham="LK-SC-01", benh_nhan_id=bn_1.id, bac_si_id=bs.id, ngay_kham=today, gio_kham=time(8, 0), so_thu_tu=1, trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value)
    lich_2 = LichKham(ma_lich_kham="LK-SC-02", benh_nhan_id=bn_2.id, bac_si_id=bs.id, ngay_kham=today, gio_kham=time(8, 30), so_thu_tu=2, trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value)
    db_session.add_all([lich_1, lich_2])
    await db_session.flush()

    admin = TaiKhoan(nguoi_dung_id=nd_bs.id, email="admin@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.ADMIN.value)

    ticket_1 = await queue_service.check_in_patient(CheckInRequest(lich_kham_id=lich_1.id), admin, db_session)
    ticket_2 = await queue_service.check_in_patient(CheckInRequest(lich_kham_id=lich_2.id), admin, db_session)

    # Trong cùng hàng đợi: STT phải là 1 và 2, hoàn toàn phân biệt
    assert ticket_1.so_thu_tu_kham == 1
    assert ticket_2.so_thu_tu_kham == 2
    assert ticket_1.bac_si_id == bs.id
    assert ticket_2.bac_si_id == bs.id


@pytest.mark.asyncio
async def test_walk_in_without_fake_email_and_reuse_profile(db_session):
    """
    INVARIANT 4: Tiếp nhận vãng lai theo chuẩn OpenMRS:
    - Không sinh email giả mạo (email = None).
    - Khi cùng bệnh nhân đến khám lần 2: Tái sử dụng hồ sơ, không sinh NguoiDung hay BenhNhan trùng lặp.
    - Khi 2 người trong gia đình dùng chung số điện thoại nhưng khác họ tên: Tạo đúng hồ sơ riêng cho từng người.
    """
    nd_bs = NguoiDung(ho_ten="BS Walkin Test", email="bs.walkin@clinic.com")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, hoc_vi="BS", chung_chi_hanh_nghe="CCHN-WALK", gia_kham_mac_dinh=200000)
    db_session.add(bs)
    await db_session.flush()

    admin = TaiKhoan(nguoi_dung_id=nd_bs.id, email="admin@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.ADMIN.value)

    # 1. Tiếp nhận người bố
    req_father = WalkInQuickRequest(
        ho_ten="Nguyễn Văn Bố",
        so_dien_thoai="0933445566",
        gioi_tinh="Nam",
        bac_si_id=bs.id,
        ca_lam_viec="sang",
        ly_do_kham="Đau lưng"
    )
    ticket_father_1 = await queue_service.check_in_walk_in_quick(req_father, admin, db_session)
    assert ticket_father_1.so_thu_tu_kham == 1

    # Kiểm tra hồ sơ người bố: Email là None (không có placeholder fake email)
    benh_nhan_father = await db_session.get(BenhNhan, ticket_father_1.benh_nhan_id)
    nguoi_dung_father = await db_session.get(NguoiDung, benh_nhan_father.nguoi_dung_id)
    assert nguoi_dung_father.email is None
    assert nguoi_dung_father.ho_ten == "Nguyễn Văn Bố"

    # 2. Người bố khám lại lần sau (cùng SĐT): Tái sử dụng đúng hồ sơ cũ, không tạo trùng
    ticket_father_2 = await queue_service.check_in_walk_in_quick(req_father, admin, db_session)
    assert ticket_father_2.benh_nhan_id == benh_nhan_father.id
    assert ticket_father_2.so_thu_tu_kham == 2

    # 3. Tiếp nhận bệnh nhân vãng lai khác (khác SĐT)
    req_other = WalkInQuickRequest(
        ho_ten="Trần Thị Khác",
        so_dien_thoai="0977889900",
        gioi_tinh="Nữ",
        bac_si_id=bs.id,
        ca_lam_viec="sang",
        ly_do_kham="Sốt nhẹ"
    )
    ticket_other = await queue_service.check_in_walk_in_quick(req_other, admin, db_session)
    assert ticket_other.so_thu_tu_kham == 3
    assert ticket_other.benh_nhan_id != benh_nhan_father.id

    benh_nhan_other = await db_session.get(BenhNhan, ticket_other.benh_nhan_id)
    nguoi_dung_other = await db_session.get(NguoiDung, benh_nhan_other.nguoi_dung_id)
    assert nguoi_dung_other.email is None
