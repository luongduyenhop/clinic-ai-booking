from datetime import datetime, time, timedelta
import pytest
from app.core.config import settings
from app.models.appointment import LichLamViec
from app.services.appointment_service import clinic_now

APPOINTMENT_API = f"{settings.API_V1_STR}/appointments"

# Các nghiệp vụ so sánh với "bây giờ" phải dùng giờ phòng khám (UTC+7). Server Docker/CI chạy UTC nên nếu
# dùng datetime.now() sẽ lệch 7 tiếng: slot đã qua vẫn hiện 'available', đặt được lịch trong quá khứ.
# Fixture db_session/api_client/booking ở tests/conftest.py


def _floor_30_minutes(moment: datetime) -> datetime:
    """Làm tròn xuống mốc slot 30 phút gần nhất; tránh ca vắt qua nửa đêm"""
    slot = moment.replace(minute=moment.minute - moment.minute % 30, second=0, microsecond=0)
    if slot.time() >= time(23, 30):
        slot -= timedelta(minutes=30)
    return slot


@pytest.mark.parametrize("hours_from_now, expected_status", [(-2, "past"), (2, "available")])
async def test_slot_status_uses_clinic_time(api_client, db_session, booking, hours_from_now, expected_status):
    """Slot đã qua theo giờ Việt Nam phải là 'past', slot sắp tới là 'available' (UC-B02)"""
    slot_dt = _floor_30_minutes(clinic_now() + timedelta(hours=hours_from_now))
    db_session.add(LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=slot_dt.date(),
        gio_bat_dau=slot_dt.time(),
        gio_ket_thuc=(slot_dt + timedelta(minutes=30)).time()
    ))
    await db_session.flush()

    response = await api_client.get(
        f"{APPOINTMENT_API}/doctors/{booking.bs_x.id}/slots", params={"query_date": slot_dt.date().isoformat()}
    )

    assert response.status_code == 200, response.text
    assert [slot["status"] for slot in response.json()["data"]["slots"]] == [expected_status]


@pytest.mark.parametrize("hours_from_now, expected_code", [(-1, 400), (24, 201)])
async def test_booking_past_check_uses_clinic_time(api_client, booking, hours_from_now, expected_code):
    """Không đặt được lịch đã qua theo giờ Việt Nam; lịch ngày mai đặt bình thường (UC-B03)"""
    thoi_diem = (clinic_now() + timedelta(hours=hours_from_now)).replace(second=0, microsecond=0)
    payload = {
        "bac_si_id": booking.bs_x.id,
        "ngay_kham": thoi_diem.date().isoformat(),
        "gio_kham": thoi_diem.time().isoformat()
    }

    response = await api_client.post(APPOINTMENT_API, json=payload, headers=booking.tokens["bn_a"])

    assert response.status_code == expected_code, response.text
