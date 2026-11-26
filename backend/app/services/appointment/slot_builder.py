from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, List, Optional, Tuple

from app.core.config import settings
from app.models.appointment import LichKham, TrangThaiLichEnum
from app.models.user import BacSi, BenhNhan, NguoiDung
from app.schemas.appointment import (
    AppointmentResponse,
    DoctorBriefResponse,
    PatientBriefResponse,
    TimeSlotResponse,
)

CANCELLABLE_STATUSES = {
    TrangThaiLichEnum.CHO_XAC_NHAN.value,
    TrangThaiLichEnum.DA_XAC_NHAN.value,
    TrangThaiLichEnum.DA_TIEP_NHAN.value,
}


def clinic_now() -> datetime:
    clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
    return datetime.now(clinic_tz).replace(tzinfo=None)


def overlaps_any(start: datetime, end: datetime, ranges: Iterable[Tuple[datetime, datetime]]) -> bool:
    return any(range_start < end and start < range_end for range_start, range_end in ranges)


def _merge_shifts(query_date: date, shifts: Iterable[Tuple[time, time]]) -> List[List[datetime]]:
    intervals = []
    for shift_start, shift_end in shifts:
        start_dt = datetime.combine(query_date, shift_start)
        end_dt = datetime.combine(query_date, shift_end)
        if shift_end == time(0) or end_dt < start_dt:
            end_dt = datetime.combine(query_date + timedelta(days=1), time(0))
        intervals.append([start_dt, end_dt])

    merged = []
    for start_dt, end_dt in sorted(intervals):
        if merged and start_dt <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end_dt)
        else:
            merged.append([start_dt, end_dt])
    return merged


def build_day_slots(
    query_date: date,
    shifts: Iterable[Tuple[time, time]],
    booked_ranges: Iterable[Tuple[datetime, datetime]],
    now: datetime,
    slot_minutes: Optional[int] = None,
) -> List[TimeSlotResponse]:
    if slot_minutes is None:
        slot_minutes = settings.SLOT_DURATION_MINUTES
    slot_length = timedelta(minutes=slot_minutes)
    booked_list = list(booked_ranges)
    slots: List[TimeSlotResponse] = []

    for curr_dt, end_dt in _merge_shifts(query_date, shifts):
        while curr_dt + slot_length <= end_dt:
            if overlaps_any(curr_dt, curr_dt + slot_length, booked_list):
                slot_status = "booked"
            elif curr_dt < now:
                slot_status = "past"
            else:
                slot_status = "available"

            slot_time = curr_dt.time()
            slots.append(
                TimeSlotResponse(
                    time_str=slot_time.strftime("%H:%M"),
                    time_val=slot_time,
                    status=slot_status,
                )
            )
            curr_dt += slot_length

    return slots


def build_appointment_code(appointment_date: date, doctor_id: int, sequence: int) -> str:
    return f"LK-{appointment_date.strftime('%Y%m%d')}-BS{doctor_id:02d}{sequence:03d}"


def build_appointment_response(
    lich_kham: LichKham,
    bac_si: BacSi,
    bs_info: NguoiDung,
    specialty_name: str,
    benh_nhan: BenhNhan,
    bn_info: NguoiDung,
) -> AppointmentResponse:
    return AppointmentResponse(
        id=lich_kham.id,
        ma_lich_kham=lich_kham.ma_lich_kham,
        ngay_kham=lich_kham.ngay_kham,
        gio_kham=lich_kham.gio_kham,
        so_thu_tu=lich_kham.so_thu_tu,
        trang_thai=lich_kham.trang_thai,
        ly_do_kham=lich_kham.ly_do_kham,
        trieu_chung_ban_dau=lich_kham.trieu_chung_ban_dau,
        bac_si=DoctorBriefResponse(
            id=bac_si.id,
            ho_ten=bs_info.ho_ten,
            chuyen_khoa=specialty_name,
            hoc_vi=bac_si.hoc_vi,
        ),
        benh_nhan=PatientBriefResponse(
            id=benh_nhan.id,
            ho_ten=bn_info.ho_ten,
            so_dien_thoai=bn_info.so_dien_thoai,
        ),
    )
