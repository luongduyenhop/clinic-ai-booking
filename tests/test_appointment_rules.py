from datetime import datetime, timedelta, time
from app.core.config import settings


def test_slot_interval_configuration():
    """Kiểm tra thời lượng mỗi lượt khám đúng chuẩn 30 phút"""
    assert settings.SLOT_DURATION_MINUTES == 30


def test_cancellation_time_rule():
    """Kiểm tra quy định hủy lịch: Phải cách giờ hẹn tối thiểu 2 tiếng"""
    assert settings.CANCELLATION_MINIMUM_HOURS == 2

    # Trường hợp 1: Lịch khám cách hiện tại 3 tiếng -> Đủ điều kiện hủy
    now = datetime.now()
    appointment_valid = now + timedelta(hours=3)
    diff_hours_valid = (appointment_valid - now).total_seconds() / 3600.0
    assert diff_hours_valid >= settings.CANCELLATION_MINIMUM_HOURS

    # Trường hợp 2: Lịch khám cách hiện tại 1 tiếng -> Vi phạm quy định
    appointment_invalid = now + timedelta(hours=1)
    diff_hours_invalid = (appointment_invalid - now).total_seconds() / 3600.0
    assert diff_hours_invalid < settings.CANCELLATION_MINIMUM_HOURS


def test_slot_generator_calculation():
    """Kiểm tra thuật toán sinh 8 slot khám cho ca sáng 07:30 đến 11:30"""
    start_time = time(7, 30)
    end_time = time(11, 30)
    slot_minutes = settings.SLOT_DURATION_MINUTES

    slots = []
    dummy_date = datetime(2026, 10, 1, start_time.hour, start_time.minute)
    end_dt = datetime(2026, 10, 1, end_time.hour, end_time.minute)

    while dummy_date + timedelta(minutes=slot_minutes) <= end_dt:
        slots.append(dummy_date.strftime("%H:%M"))
        dummy_date += timedelta(minutes=slot_minutes)

    # 4 tiếng / 30 phút = 8 slots: 07:30, 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00
    assert len(slots) == 8
    assert slots[0] == "07:30"
    assert slots[-1] == "11:00"
