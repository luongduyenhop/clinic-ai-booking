from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from app.core.config import settings


def clinic_tz() -> timezone:
    return timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def to_clinic_aware(dt: datetime) -> datetime:
    return ensure_utc(dt).astimezone(clinic_tz())


def to_clinic_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return to_clinic_aware(dt).replace(tzinfo=None)


def clinic_shift_start_utc(ngay_kham: date, start_time: time = time(7, 30)) -> datetime:
    return datetime.combine(ngay_kham, start_time, tzinfo=clinic_tz()).astimezone(timezone.utc)


def clinic_day_start_utc(ngay: date) -> datetime:
    return datetime.combine(ngay, time.min, tzinfo=clinic_tz()).astimezone(timezone.utc)
