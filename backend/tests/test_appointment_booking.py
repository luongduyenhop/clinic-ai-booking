from datetime import datetime, time, timedelta
import pytest
from sqlalchemy import select
from app.core.config import settings
from app.models.appointment import CaLamViecEnum, LichKham, LichLamViec, TrangThaiLichEnum, OCCUPYING_SLOT_STATUSES
from app.models.user import ChuyenKhoa, NguoiDung
from app.services.appointment_service import clinic_now

APPOINTMENT_API = f"{settings.API_V1_STR}/appointments"

# Đặt lịch (UC-B03) chỉ chấp nhận giờ đang hiển thị 'available' trên API tra cứu slot (UC-B02)
# Fixture db_session/api_client/booking ở tests/conftest.py


def _ngay():
    return (clinic_now() + timedelta(days=3)).date()


async def _add_morning_shift(db_session, bac_si, ngay, is_active=True):
    db_session.add(LichLamViec(
        bac_si_id=bac_si.id, ngay_lam_viec=ngay, ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30), gio_ket_thuc=time(11, 30), is_active=is_active
    ))
    await db_session.flush()


async def _book(api_client, token, bac_si_id, ngay, gio):
    payload = {"bac_si_id": bac_si_id, "ngay_kham": ngay.isoformat(), "gio_kham": gio.isoformat()}
    return await api_client.post(APPOINTMENT_API, json=payload, headers=token)


async def _slot_status(api_client, bac_si_id, ngay, time_str):
    response = await api_client.get(
        f"{APPOINTMENT_API}/doctors/{bac_si_id}/slots", params={"query_date": ngay.isoformat()}
    )
    return next(slot["status"] for slot in response.json()["data"]["slots"] if slot["time_str"] == time_str)


async def test_book_available_slot_then_it_shows_booked(api_client, db_session, booking):
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)

    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(9, 0))

    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["so_thu_tu"] == 1
    assert data["bac_si"]["chuyen_khoa"] == "Đa khoa"
    assert data["trang_thai"] == TrangThaiLichEnum.DA_XAC_NHAN.value
    assert await _slot_status(api_client, booking.bs_x.id, ngay, "09:00") == "booked"


@pytest.mark.parametrize("gio", [time(8, 15), time(12, 0), time(11, 30)])
async def test_time_outside_slot_grid_is_rejected(api_client, db_session, booking, gio):
    """Giờ lệch mốc (08:15), ngoài ca (12:00) hoặc slot vượt giờ hết ca (11:30) đều bị từ chối"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)

    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, gio)

    assert response.status_code == 400, response.text


@pytest.mark.parametrize("is_active", [False, None])
async def test_day_without_active_shift_is_rejected(api_client, db_session, booking, is_active):
    """Ngày bác sĩ nghỉ đột xuất (ca is_active=False) hoặc không có ca thì không đặt được"""
    ngay = _ngay()
    if is_active is not None:
        await _add_morning_shift(db_session, booking.bs_x, ngay, is_active=is_active)

    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(9, 0))

    assert response.status_code == 400, response.text


async def test_slot_partly_taken_by_long_appointment_returns_409(api_client, db_session, booking):
    """Lịch 60 phút lúc 09:00 chiếm cả slot 09:30 - không được đặt chồng lên"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)
    lich = await booking.tao_lich(booking.bn_b, booking.bs_x, datetime.combine(ngay, time(9, 0)))
    lich.thoi_luong_phut = 60
    await db_session.flush()

    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(9, 30))

    assert response.status_code == 409, response.text


async def test_patient_overlapping_appointment_with_other_doctor_returns_409(api_client, db_session, booking):
    """Bệnh nhân đã có lịch 60 phút lúc 09:00 với BS Y thì không đặt được 09:30 với BS X"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_y, datetime.combine(ngay, time(9, 0)))
    lich.thoi_luong_phut = 60
    await db_session.flush()

    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(9, 30))

    assert response.status_code == 409, response.text


async def test_unknown_or_inactive_doctor_returns_404(api_client, db_session, booking):
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_y, ngay)
    booking.bs_y.is_active = False
    await db_session.flush()

    for bac_si_id in (booking.bs_y.id, 987654321):
        response = await _book(api_client, booking.tokens["bn_a"], bac_si_id, ngay, time(9, 0))
        assert response.status_code == 404, response.text


@pytest.mark.parametrize("an_khoi_danh_muc", ["ho_so_da_xoa", "chuyen_khoa_dong"])
async def test_doctor_hidden_from_catalogue_cannot_be_booked(api_client, db_session, booking, an_khoi_danh_muc):
    """Bác sĩ bị ẩn khỏi danh mục UC-B01 (hồ sơ đã xóa / chuyên khoa ngừng hoạt động) cũng không tra slot, không đặt được"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)
    if an_khoi_danh_muc == "ho_so_da_xoa":
        nguoi_dung = await db_session.get(NguoiDung, booking.bs_x.nguoi_dung_id)
        nguoi_dung.is_deleted = True
    else:
        khoa = ChuyenKhoa(
            ma_chuyen_khoa=f"CK-{booking.suffix}", ten_chuyen_khoa=f"Khoa đóng {booking.suffix}", is_active=False
        )
        db_session.add(khoa)
        await db_session.flush()
        booking.bs_x.chuyen_khoa_id = khoa.id
    await db_session.flush()

    slots = await api_client.get(
        f"{APPOINTMENT_API}/doctors/{booking.bs_x.id}/slots", params={"query_date": ngay.isoformat()}
    )
    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(9, 0))

    assert slots.status_code == 404, slots.text
    assert response.status_code == 404, response.text


async def test_patient_blocked_for_no_show_cannot_book(api_client, db_session, booking):
    """Bệnh nhân bị khóa đặt online (is_blocked_booking do vắng mặt nhiều lần) nhận 403, slot vẫn còn trống"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)
    booking.bn_a.is_blocked_booking = True
    await db_session.flush()

    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(9, 0))

    assert response.status_code == 403, response.text
    assert await _slot_status(api_client, booking.bs_x.id, ngay, "09:00") == "available"


async def test_account_without_patient_profile_cannot_book(api_client, db_session, booking):
    """Tài khoản Bác sĩ/Admin không có hồ sơ bệnh nhân thì không đặt lịch trực tuyến được"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)

    response = await _book(api_client, booking.tokens["admin"], booking.bs_x.id, ngay, time(9, 0))

    assert response.status_code == 403, response.text


async def test_time_with_timezone_offset_returns_422(api_client, db_session, booking):
    """Giờ kèm múi giờ (09:00+07:00) bị từ chối ở tầng kiểm tra dữ liệu thay vì lỗi 500 khi so với giờ phòng khám"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)
    payload = {"bac_si_id": booking.bs_x.id, "ngay_kham": ngay.isoformat(), "gio_kham": "09:00:00+07:00"}

    response = await api_client.post(APPOINTMENT_API, json=payload, headers=booking.tokens["bn_a"])

    assert response.status_code == 422, response.text


async def test_booking_after_auto_cancel_gets_new_unique_code(api_client, db_session, booking):
    """Sau khi 1 lịch bị tự động hủy, lịch mới vẫn nhận mã chưa dùng (không lỗi 500 trùng mã)"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)
    first = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(8, 0))
    second = await _book(api_client, booking.tokens["bn_b"], booking.bs_x.id, ngay, time(8, 30))
    assert first.status_code == second.status_code == 201

    lich_dau = (await db_session.execute(
        select(LichKham).where(LichKham.id == first.json()["data"]["id"])
    )).scalar_one()
    lich_dau.trang_thai = TrangThaiLichEnum.TU_DONG_HUY.value
    await db_session.flush()

    third = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(9, 0))

    assert third.status_code == 201, third.text
    codes = {r.json()["data"]["ma_lich_kham"] for r in (first, second, third)}
    assert len(codes) == 3
    # Số thứ tự không tái sử dụng số của lịch đã hủy, nên không trùng với lịch thứ 2 (STT 2) còn hiệu lực
    assert third.json()["data"]["so_thu_tu"] == 3
    # Slot của lịch bị tự động hủy mở lại cho người khác
    assert await _slot_status(api_client, booking.bs_x.id, ngay, "08:00") == "available"


@pytest.mark.parametrize("status", list(OCCUPYING_SLOT_STATUSES))
async def test_booking_conflict_with_occupying_statuses(api_client, db_session, booking, status):
    """Mọi trạng thái trong OCCUPYING_SLOT_STATUSES (da_xac_nhan, da_tiep_nhan, dang_kham) đều chiếm slot và trả về 409 khi đặt trùng"""
    ngay = _ngay()
    await _add_morning_shift(db_session, booking.bs_x, ngay)
    lich = await booking.tao_lich(booking.bn_b, booking.bs_x, datetime.combine(ngay, time(9, 0)), trang_thai=status)
    await db_session.flush()

    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, ngay, time(9, 0))
    assert response.status_code == 409, response.text


async def test_booking_past_slot_rejected_by_server_clock(api_client, db_session, booking):
    """Không được đặt lịch ở quá khứ dù slot đó đã da_kham và không nằm trong OCCUPYING_SLOT_STATUSES"""
    yesterday = (clinic_now() - timedelta(days=1)).date()
    await _add_morning_shift(db_session, booking.bs_x, yesterday)
    response = await _book(api_client, booking.tokens["bn_a"], booking.bs_x.id, yesterday, time(9, 0))
    assert response.status_code == 400, response.text
    assert "quá khứ" in response.json()["message"].lower()
