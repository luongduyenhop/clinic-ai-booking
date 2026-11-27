from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from app.core.config import settings


def clinic_tz() -> timezone:
    """Trả về múi giờ cấu hình của phòng khám theo CLINIC_UTC_OFFSET_HOURS."""
    return timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))


def utc_now() -> datetime:
    """Trả về thời điểm hiện tại ở múi giờ UTC (timezone-aware)."""
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    """Chuẩn hóa datetime về UTC aware (coi naive datetime từ DB là UTC)."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def to_clinic_aware(dt: datetime) -> datetime:
    """Chuyển datetime sang múi giờ phòng khám (timezone-aware)."""
    return ensure_utc(dt).astimezone(clinic_tz())


def to_clinic_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """Chuyển datetime sang giờ phòng khám dạng naive để so sánh với clinic_now()."""
    if dt is None:
        return None
    return to_clinic_aware(dt).replace(tzinfo=None)


def clinic_shift_start_utc(ngay_kham: date, start_time: time = time(7, 30)) -> datetime:
    """Quy đổi giờ bắt đầu ca khám tại phòng khám sang UTC aware."""
    return datetime.combine(ngay_kham, start_time, tzinfo=clinic_tz()).astimezone(timezone.utc)


def clinic_day_start_utc(ngay: date) -> datetime:
    """Quy đổi thời điểm 00:00:00 của ngày phòng khám sang UTC aware."""
    return datetime.combine(ngay, time.min, tzinfo=clinic_tz()).astimezone(timezone.utc)
