import logging
from datetime import date, datetime, time, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException, ForbiddenException, NotFoundException
from app.models.appointment import (
    OCCUPYING_SLOT_STATUSES,
    HangDoiKham,
    LichKham,
    LichLamViec,
    NghiPhepBacSi,
    TrangThaiNghiPhepEnum,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.appointment import (
    AppointmentResponse,
    DoctorScheduleSlotsResponse,
    TimeSlotResponse,
)
from app.services.appointment.booking_service import AppointmentBookingMixin
from app.services.appointment.slot_builder import (
    CANCELLABLE_STATUSES,
    _merge_shifts,
    build_appointment_code,
    build_appointment_response,
    build_day_slots,
    clinic_now,
    overlaps_any,
)
from app.services.appointment.waitlist_service import AppointmentWaitlistMixin
from app.services.patient.medical_service import DEFAULT_SPECIALTY_NAME, medical_service

logger = logging.getLogger("clinic_backend")

__all__ = [
    "AppointmentService",
    "appointment_service",
    "CANCELLABLE_STATUSES",
    "clinic_now",
    "overlaps_any",
    "_merge_shifts",
    "build_day_slots",
    "build_appointment_code",
]


class AppointmentService(AppointmentBookingMixin, AppointmentWaitlistMixin):
    def _current_clinic_time(self) -> datetime:
        return clinic_now()

    async def _get_active_doctor(self, doctor_id: int, db: AsyncSession) -> Tuple[BacSi, NguoiDung, str]:
        stmt_bs = medical_service._visible_doctors(BacSi, NguoiDung, ChuyenKhoa).where(BacSi.id == doctor_id)
        bs_row = (await db.execute(stmt_bs)).first()
        if not bs_row:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")
        bac_si, nguoi_dung, chuyen_khoa = bs_row
        return bac_si, nguoi_dung, chuyen_khoa.ten_chuyen_khoa if chuyen_khoa else DEFAULT_SPECIALTY_NAME

    async def _get_occupied_ranges(
        self,
        owner_filter,
        query_date: date,
        db: AsyncSession,
    ) -> List[Tuple[datetime, datetime]]:
        stmt_lk = select(LichKham.gio_kham, LichKham.thoi_luong_phut).where(
            and_(
                owner_filter,
                LichKham.ngay_kham == query_date,
                LichKham.trang_thai.in_(OCCUPYING_SLOT_STATUSES),
            )
        )
        occupied_ranges = []
        for gio_kham, thoi_luong_phut in (await db.execute(stmt_lk)).all():
            start_dt = datetime.combine(query_date, gio_kham)
            occupied_ranges.append((start_dt, start_dt + timedelta(minutes=thoi_luong_phut)))
        return occupied_ranges

    async def _compute_day_slots(
        self,
        doctor_id: int,
        query_date: date,
        db: AsyncSession,
        lock_shifts: bool = False,
        slot_minutes: Optional[int] = None,
    ) -> List[TimeSlotResponse]:
        stmt_llv = (
            select(LichLamViec.gio_bat_dau, LichLamViec.gio_ket_thuc)
            .where(
                and_(
                    LichLamViec.bac_si_id == doctor_id,
                    LichLamViec.ngay_lam_viec == query_date,
                    LichLamViec.is_active.is_(True),
                )
            )
            .order_by(LichLamViec.id)
        )
        if lock_shifts:
            stmt_llv = stmt_llv.with_for_update()
        shifts = (await db.execute(stmt_llv)).all()
        booked_ranges = await self._get_occupied_ranges(LichKham.bac_si_id == doctor_id, query_date, db)
        return build_day_slots(query_date, shifts, booked_ranges, self._current_clinic_time(), slot_minutes)

    async def _find_doctor_shift(
        self,
        doctor_id: int,
        target_date: date,
        start_time: time,
        end_time: time,
        db: AsyncSession,
    ) -> LichLamViec:
        stmt = select(LichLamViec).where(
            and_(
                LichLamViec.bac_si_id == doctor_id,
                LichLamViec.ngay_lam_viec == target_date,
                LichLamViec.gio_bat_dau <= start_time,
                LichLamViec.gio_ket_thuc >= end_time,
                LichLamViec.is_active.is_(True),
            )
        )
        shift = (await db.execute(stmt)).scalars().first()
        if not shift:
            raise AppException(
                f"Khung giờ đã chọn ({start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')}) "
                f"không nằm trong ca làm việc hợp lệ của Bác sĩ ngày {target_date}!"
            )
        return shift

    async def _is_doctor_off(
        self,
        doctor_id: int,
        target_date: date,
        db: AsyncSession,
        ca_lam_viec: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        stmt_leave = select(NghiPhepBacSi).where(
            and_(
                NghiPhepBacSi.bac_si_id == doctor_id,
                NghiPhepBacSi.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value,
                NghiPhepBacSi.tu_ngay <= target_date,
                NghiPhepBacSi.den_ngay >= target_date,
            )
        )
        if ca_lam_viec:
            stmt_leave = stmt_leave.where(
                or_(
                    NghiPhepBacSi.ca_lam_viec.is_(None),
                    NghiPhepBacSi.ca_lam_viec == ca_lam_viec,
                )
            )
        leave = (await db.execute(stmt_leave)).scalars().first()
        if leave:
            return True, leave.ly_do or "Nghỉ phép có kế hoạch"

        stmt_shift_off = select(LichLamViec).where(
            and_(
                LichLamViec.bac_si_id == doctor_id,
                LichLamViec.ngay_lam_viec == target_date,
                LichLamViec.is_active.is_(False),
            )
        )
        if ca_lam_viec:
            stmt_shift_off = stmt_shift_off.where(LichLamViec.ca_lam_viec == ca_lam_viec)
        inactive_shift = (await db.execute(stmt_shift_off)).scalars().first()
        if inactive_shift:
            return True, inactive_shift.ghi_chu_nghi or "Ca trực bị đóng đột xuất"

        return False, None

    async def get_doctor_available_slots(
        self,
        doctor_id: int,
        query_date: date,
        db: AsyncSession,
    ) -> DoctorScheduleSlotsResponse:
        bac_si, nguoi_dung, specialty_name = await self._get_active_doctor(doctor_id, db)
        generated_slots = await self._compute_day_slots(doctor_id, query_date, db)
        return DoctorScheduleSlotsResponse(
            doctor_id=bac_si.id,
            doctor_name=nguoi_dung.ho_ten,
            specialty_name=specialty_name,
            date=query_date,
            slots=generated_slots,
        )

    async def get_nearest_available_slots(
        self,
        doctor_ids: List[int],
        db: AsyncSession,
        days_ahead: int = 30,
    ) -> dict[int, Tuple[date, str]]:
        doctor_ids = list(dict.fromkeys(doctor_ids))
        if not doctor_ids:
            return {}

        now_dt = self._current_clinic_time()
        today = now_dt.date()
        last_day = today + timedelta(days=max(days_ahead, 0))
        shifts_stmt = (
            select(
                LichLamViec.bac_si_id,
                LichLamViec.ngay_lam_viec,
                LichLamViec.gio_bat_dau,
                LichLamViec.gio_ket_thuc,
            )
            .where(
                and_(
                    LichLamViec.bac_si_id.in_(doctor_ids),
                    LichLamViec.ngay_lam_viec.between(today, last_day),
                    LichLamViec.is_active.is_(True),
                )
            )
            .order_by(LichLamViec.ngay_lam_viec, LichLamViec.gio_bat_dau)
        )
        shifts_by_doctor_day: dict[tuple[int, date], list[tuple[time, time]]] = {}
        for doc_id, work_date, start_time, end_time in (await db.execute(shifts_stmt)).all():
            shifts_by_doctor_day.setdefault((doc_id, work_date), []).append((start_time, end_time))

        appointments_stmt = select(
            LichKham.bac_si_id,
            LichKham.ngay_kham,
            LichKham.gio_kham,
            LichKham.thoi_luong_phut,
        ).where(
            and_(
                LichKham.bac_si_id.in_(doctor_ids),
                LichKham.ngay_kham.between(today, last_day),
                LichKham.trang_thai.in_(OCCUPYING_SLOT_STATUSES),
                LichKham.gio_kham.is_not(None),
            )
        )
        booked_by_doctor_day: dict[tuple[int, date], list[tuple[datetime, datetime]]] = {}
        for doc_id, appointment_date, start_time, duration in (await db.execute(appointments_stmt)).all():
            start = datetime.combine(appointment_date, start_time)
            booked_by_doctor_day.setdefault((doc_id, appointment_date), []).append(
                (start, start + timedelta(minutes=duration))
            )

        nearest: dict[int, Tuple[date, str]] = {}
        for (doc_id, work_date), shifts in sorted(
            shifts_by_doctor_day.items(), key=lambda item: (item[0][1], item[0][0])
        ):
            if doc_id in nearest:
                continue
            slots = build_day_slots(
                work_date,
                shifts,
                booked_by_doctor_day.get((doc_id, work_date), []),
                now_dt,
            )
            first_available = next((slot for slot in slots if slot.status == "available"), None)
            if first_available:
                nearest[doc_id] = (work_date, first_available.time_str)
        return nearest

    async def get_patient_appointments(
        self,
        user: TaiKhoan,
        db: AsyncSession,
        trang_thai: Optional[str] = None,
    ) -> List[AppointmentResponse]:
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chức năng tra cứu lịch hẹn cá nhân chỉ dành riêng cho Bệnh nhân!")

        stmt_bn = (
            select(BenhNhan, NguoiDung)
            .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
            .where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        )
        bn_row = (await db.execute(stmt_bn)).first()
        if not bn_row:
            raise ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bệnh nhân hợp lệ!")
        benh_nhan, bn_info = bn_row

        stmt_lk = (
            select(LichKham, BacSi, NguoiDung, ChuyenKhoa)
            .join(BacSi, LichKham.bac_si_id == BacSi.id)
            .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
            .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
            .where(LichKham.benh_nhan_id == benh_nhan.id)
        )
        if trang_thai:
            stmt_lk = stmt_lk.where(LichKham.trang_thai == trang_thai)
        stmt_lk = stmt_lk.order_by(LichKham.ngay_kham.desc(), LichKham.gio_kham.desc())

        rows = (await db.execute(stmt_lk)).all()
        appointments = [
            build_appointment_response(
                lk,
                bs,
                bs_info,
                ck.ten_chuyen_khoa if ck else "Nội khoa",
                benh_nhan,
                bn_info,
            )
            for lk, bs, bs_info, ck in rows
        ]
        logger.info(f"📋 [PATIENT APPOINTMENTS] Bệnh nhân ID: {benh_nhan.id} | Số lịch tìm thấy: {len(appointments)}")
        return appointments

    async def get_doctor_shift_appointments(
        self,
        date_str: Optional[str],
        user: TaiKhoan,
        db: AsyncSession,
    ) -> List[dict]:
        bac_si = None
        if user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        elif user.vai_tro == VaiTroEnum.ADMIN.value:
            stmt_bs = select(BacSi).order_by(BacSi.id.asc()).limit(1)
            bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()

        if not bac_si:
            return []

        target_date = self._current_clinic_time().date()
        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                target_date = self._current_clinic_time().date()

        stmt = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.luot_kham),
            )
            .where(
                LichKham.bac_si_id == bac_si.id,
                LichKham.ngay_kham == target_date,
            )
            .order_by(LichKham.gio_kham.asc())
        )
        appointments = (await db.execute(stmt)).scalars().all()

        stmt_tickets = select(HangDoiKham).where(
            HangDoiKham.bac_si_id == bac_si.id,
            HangDoiKham.ngay_kham == target_date,
        )
        tickets = (await db.execute(stmt_tickets)).scalars().all()
        ticket_map = {t.lich_kham_id: t for t in tickets if t.lich_kham_id}

        priority_labels = {
            1: "Cấp cứu",
            2: "Đúng hẹn",
            3: "Trả kết quả CLS",
            4: "Đến sớm",
            5: "Vãng lai / Muộn",
        }

        results = []
        for apt in appointments:
            bn = apt.benh_nhan
            nd = bn.nguoi_dung if bn else None
            enc = apt.luot_kham
            ticket = ticket_map.get(apt.id)

            start_t = apt.gio_kham.strftime("%H:%M") if apt.gio_kham else "08:00"
            duration = apt.thoi_luong_phut or 30
            end_dt = datetime.combine(apt.ngay_kham, apt.gio_kham) + timedelta(minutes=duration)

            vitals = None
            if enc:
                vitals = {
                    "mach": enc.mach_lan_phut or 75,
                    "nhiet_do": float(enc.nhiet_do_c) if enc.nhiet_do_c else 36.8,
                    "huyet_ap_tam_thu": enc.huyet_ap_tam_thu or 120,
                    "huyet_ap_tam_truong": enc.huyet_ap_tam_truong or 80,
                    "nhip_tho": enc.nhip_tho_lan_phut or 18,
                    "spo2": 98,
                    "can_nang": float(enc.can_nang_kg) if enc.can_nang_kg else 60.0,
                    "chieu_cao": float(enc.chieu_cao_cm) if enc.chieu_cao_cm else 165.0,
                }

            priority = ticket.muc_do_uu_tien if ticket else 4
            results.append(
                {
                    "id": apt.id,
                    "appointment_code": apt.ma_lich_kham,
                    "patient_name": nd.ho_ten if nd else "Bệnh nhân",
                    "patient_phone": nd.so_dien_thoai if nd else "",
                    "patient_gender": nd.gioi_tinh if nd else "Nam",
                    "patient_birth_year": nd.ngay_sinh.year if nd and nd.ngay_sinh else 1990,
                    "appointment_date": apt.ngay_kham.isoformat(),
                    "start_time": start_t,
                    "end_time": end_dt.strftime("%H:%M"),
                    "symptoms_text": apt.trieu_chung_ban_dau or apt.ly_do_kham or "",
                    "status": apt.trang_thai,
                    "queue_priority": priority,
                    "priority_label": priority_labels.get(priority, "Đúng hẹn"),
                    "is_locked": enc.is_locked if enc else (apt.trang_thai == "da_kham"),
                    "encounter_id": enc.id if enc else None,
                    "vitals": vitals,
                }
            )
        return results


appointment_service = AppointmentService()
