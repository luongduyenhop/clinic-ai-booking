from datetime import date, datetime, time, timedelta
import pytest
from app.core.config import settings
from app.models.appointment import CaLamViecEnum, LichLamViec, TrangThaiLichEnum
from app.services.appointment_service import build_day_slots, clinic_now

APPOINTMENT_API = f"{settings.API_V1_STR}/appointments"
NGAY = date(2026, 10, 1)
CA_SANG = (time(7, 30), time(11, 30))
CA_CHIEU = (time(13, 30), time(17, 0))
DAU_NGAY = datetime.combine(NGAY, time(0, 0))  # "Bây giờ" trước mọi slot trong ngày


def _at(hour, minute=0):
    return datetime.combine(NGAY, time(hour, minute))


def _booked(hour, minute=0, minutes=30):
    return (_at(hour, minute), _at(hour, minute) + timedelta(minutes=minutes))


def _status_map(slots):
    return {slot.time_str: slot.status for slot in slots}


def _status_map_json(response):
    return {slot["time_str"]: slot["status"] for slot in response.json()["data"]["slots"]}


# ------------------------------------------------------------------------------
# 1. Kiểm thử thuật toán chia slot (hàm thuần, không cần CSDL)
# ------------------------------------------------------------------------------

def test_full_day_generates_15_slots_skipping_lunch_break():
    """Ca sáng 07:30-11:30 = 8 slot, ca chiều 13:30-17:00 = 7 slot, không có slot giờ nghỉ trưa"""
    slots = build_day_slots(NGAY, [CA_SANG, CA_CHIEU], [], DAU_NGAY)

    times = [slot.time_str for slot in slots]
    assert len(times) == 15
    assert times[:8] == ["07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"]
    assert times[8:] == ["13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
    assert all(slot.status == "available" for slot in slots)


def test_slots_are_sorted_even_if_shifts_come_unordered():
    """CSDL không đảm bảo thứ tự ca nên kết quả phải tự sắp xếp theo giờ"""
    slots = build_day_slots(NGAY, [CA_CHIEU, CA_SANG], [], DAU_NGAY)
    assert slots[0].time_str == "07:30"
    assert slots[-1].time_str == "16:30"


def test_overlapping_shifts_do_not_duplicate_slots():
    """2 ca chồng lấn (dữ liệu nhập sai) vẫn chỉ sinh mỗi mốc giờ 1 lần"""
    slots = build_day_slots(NGAY, [(time(8, 0), time(10, 0)), (time(9, 0), time(11, 0))], [], DAU_NGAY)
    assert [slot.time_str for slot in slots] == ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"]


def test_misaligned_overlapping_shifts_do_not_produce_overlapping_slots():
    """Ca 08:00-10:00 và 08:15-10:15 được gộp thành 08:00-10:15, không sinh slot 08:15, 08:45... đè lên nhau"""
    slots = build_day_slots(NGAY, [(time(8, 0), time(10, 0)), (time(8, 15), time(10, 15))], [], DAU_NGAY)
    assert [slot.time_str for slot in slots] == ["08:00", "08:30", "09:00", "09:30"]


@pytest.mark.parametrize("shift_end", [time(0, 0), time(1, 0)])
def test_shift_ending_at_or_after_midnight_keeps_slots_of_the_day(shift_end):
    """Ca 22:30-00:00 (hoặc vắt qua nửa đêm) vẫn có slot trong ngày thay vì bị bỏ trống"""
    slots = build_day_slots(NGAY, [(time(22, 30), shift_end)], [], DAU_NGAY)
    assert [slot.time_str for slot in slots] == ["22:30", "23:00", "23:30"]


def test_slot_length_follows_current_settings(monkeypatch):
    """Độ dài slot đọc từ settings lúc gọi hàm, không bị gắn cứng lúc import"""
    monkeypatch.setattr(settings, "SLOT_DURATION_MINUTES", 60)
    slots = build_day_slots(NGAY, [CA_SANG], [], DAU_NGAY)
    assert [slot.time_str for slot in slots] == ["07:30", "08:30", "09:30", "10:30"]


def test_leftover_shorter_than_slot_is_dropped():
    """Ca 07:30-08:45: slot 08:30 kết thúc 09:00 vượt quá giờ hết ca nên bị bỏ"""
    slots = build_day_slots(NGAY, [(time(7, 30), time(8, 45))], [], DAU_NGAY)
    assert [slot.time_str for slot in slots] == ["07:30", "08:00"]


def test_no_shift_means_no_slot():
    """Bác sĩ không có ca (nghỉ) thì không có slot nào"""
    assert build_day_slots(NGAY, [], [_booked(9)], DAU_NGAY) == []


def test_aligned_booking_marks_only_its_slot():
    statuses = _status_map(build_day_slots(NGAY, [CA_SANG], [_booked(9)], DAU_NGAY))
    assert statuses["09:00"] == "booked"
    assert statuses["08:30"] == "available"
    assert statuses["09:30"] == "available"


def test_misaligned_booking_blocks_both_overlapping_slots():
    """Lịch lệch mốc 08:15-08:45 chồng lên cả slot 08:00 và 08:30"""
    statuses = _status_map(build_day_slots(NGAY, [CA_SANG], [_booked(8, 15)], DAU_NGAY))
    assert statuses["08:00"] == "booked"
    assert statuses["08:30"] == "booked"
    assert statuses["09:00"] == "available"


def test_long_booking_blocks_consecutive_slots():
    """Lịch dài 60 phút lúc 09:00 chiếm cả slot 09:00 và 09:30"""
    statuses = _status_map(build_day_slots(NGAY, [CA_SANG], [_booked(9, minutes=60)], DAU_NGAY))
    assert statuses["09:00"] == "booked"
    assert statuses["09:30"] == "booked"
    assert statuses["10:00"] == "available"


def test_booking_ending_at_slot_start_does_not_block_it():
    """Khoảng nửa mở [bắt đầu, kết thúc): lịch 08:00-08:30 không chạm slot 08:30"""
    statuses = _status_map(build_day_slots(NGAY, [CA_SANG], [_booked(8)], DAU_NGAY))
    assert statuses["08:30"] == "available"


def test_past_and_in_progress_slots_are_past():
    """Lúc 09:10: slot 09:00 đang diễn ra cũng là 'past'; slot 09:30 trở đi còn 'available'"""
    statuses = _status_map(build_day_slots(NGAY, [CA_SANG], [], _at(9, 10)))
    assert statuses["07:30"] == "past"
    assert statuses["09:00"] == "past"
    assert statuses["09:30"] == "available"


def test_slot_starting_exactly_now_is_available():
    statuses = _status_map(build_day_slots(NGAY, [CA_SANG], [], _at(9, 30)))
    assert statuses["09:00"] == "past"
    assert statuses["09:30"] == "available"


def test_booked_takes_priority_over_past():
    statuses = _status_map(build_day_slots(NGAY, [CA_SANG], [_booked(8)], _at(10)))
    assert statuses["08:00"] == "booked"
    assert statuses["08:30"] == "past"


# ------------------------------------------------------------------------------
# 2. Kiểm thử tích hợp API trên PostgreSQL thật (fixture db_session/api_client/booking ở tests/conftest.py)
# ------------------------------------------------------------------------------

async def _get_slots(api_client, doctor_id, ngay):
    return await api_client.get(f"{APPOINTMENT_API}/doctors/{doctor_id}/slots", params={"query_date": ngay.isoformat()})


async def _add_shift(db_session, bac_si, ngay, ca, is_active=True):
    """Thêm ca sáng/chiều đúng nhãn ca_lam_viec (ràng buộc uq_doctor_shift: 1 ca sáng + 1 ca chiều mỗi ngày)"""
    ca_lam_viec = CaLamViecEnum.SANG.value if ca == CA_SANG else CaLamViecEnum.CHIEU.value
    db_session.add(LichLamViec(
        bac_si_id=bac_si.id, ngay_lam_viec=ngay, ca_lam_viec=ca_lam_viec,
        gio_bat_dau=ca[0], gio_ket_thuc=ca[1], is_active=is_active
    ))
    await db_session.flush()


async def test_api_returns_full_day_slots(api_client, db_session, booking):
    ngay = (clinic_now() + timedelta(days=3)).date()
    await _add_shift(db_session, booking.bs_x, ngay, CA_SANG)
    await _add_shift(db_session, booking.bs_x, ngay, CA_CHIEU)

    response = await _get_slots(api_client, booking.bs_x.id, ngay)

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["doctor_id"] == booking.bs_x.id
    assert data["date"] == ngay.isoformat()
    assert len(data["slots"]) == 15
    assert all(slot["status"] == "available" for slot in data["slots"])


@pytest.mark.parametrize(
    "trang_thai, expected_status",
    [
        (TrangThaiLichEnum.DA_XAC_NHAN.value, "booked"),
        (TrangThaiLichEnum.DA_TIEP_NHAN.value, "booked"),
        (TrangThaiLichEnum.DANG_KHAM.value, "booked"),
        (TrangThaiLichEnum.DA_HUY.value, "available"),
        (TrangThaiLichEnum.TU_DONG_HUY.value, "available"),  # Slot được module No-show tự động giải phóng
        (TrangThaiLichEnum.DA_KHAM.value, "available"),      # Ca đã hoàn tất không còn giữ capacity tương lai
    ],
)
async def test_api_booked_status_follows_appointment_state(
    api_client, db_session, booking, trang_thai, expected_status
):
    ngay = (clinic_now() + timedelta(days=3)).date()
    await _add_shift(db_session, booking.bs_x, ngay, CA_SANG)
    await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.combine(ngay, time(9, 0)), trang_thai)

    response = await _get_slots(api_client, booking.bs_x.id, ngay)

    assert response.status_code == 200, response.text
    assert _status_map_json(response)["09:00"] == expected_status


async def test_api_only_counts_bookings_of_that_doctor(api_client, db_session, booking):
    """Lịch của bác sĩ Y không làm slot của bác sĩ X bị 'booked'"""
    ngay = (clinic_now() + timedelta(days=3)).date()
    await _add_shift(db_session, booking.bs_x, ngay, CA_SANG)
    await booking.tao_lich(booking.bn_a, booking.bs_y, datetime.combine(ngay, time(9, 0)))

    response = await _get_slots(api_client, booking.bs_x.id, ngay)

    assert _status_map_json(response)["09:00"] == "available"


async def test_api_inactive_shift_has_no_slots(api_client, db_session, booking):
    """Ca bác sĩ nghỉ đột xuất (is_active = False) không sinh slot"""
    ngay = (clinic_now() + timedelta(days=3)).date()
    await _add_shift(db_session, booking.bs_x, ngay, CA_SANG, is_active=False)
    await _add_shift(db_session, booking.bs_x, ngay, CA_CHIEU)

    response = await _get_slots(api_client, booking.bs_x.id, ngay)

    assert response.status_code == 200, response.text
    assert [slot["time_str"] for slot in response.json()["data"]["slots"]][0] == "13:30"


async def test_api_unknown_or_inactive_doctor_returns_404(api_client, db_session, booking):
    ngay = (clinic_now() + timedelta(days=3)).date()
    assert (await _get_slots(api_client, 987654321, ngay)).status_code == 404

    booking.bs_y.is_active = False
    await db_session.flush()
    assert (await _get_slots(api_client, booking.bs_y.id, ngay)).status_code == 404


async def test_api_missing_query_date_returns_422(api_client, booking):
    response = await api_client.get(f"{APPOINTMENT_API}/doctors/{booking.bs_x.id}/slots")
    assert response.status_code == 422

