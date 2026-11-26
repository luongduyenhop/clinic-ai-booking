import logging
from datetime import datetime, time, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AppException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.appointment import (
    CANCELLED_STATUSES,
    OCCUPYING_SLOT_STATUSES,
    CaLamViecEnum,
    HangDoiKham,
    LichKham,
    LichLamViec,
    PhanTichAI,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.appointment import (
    AppointmentCancelRequest,
    AppointmentCancelResponse,
    AppointmentConfirmResponse,
    AppointmentCreateRequest,
    AppointmentRescheduleRequest,
    AppointmentResponse,
)
from app.services.appointment.slot_builder import (
    CANCELLABLE_STATUSES,
    build_appointment_code,
    build_appointment_response,
    overlaps_any,
)

logger = logging.getLogger("clinic_backend")


class _ReleasedSlotRef:
    def __init__(self, bac_si_id: int, ngay_kham, gio_kham):
        self.id = None
        self.bac_si_id = bac_si_id
        self.ngay_kham = ngay_kham
        self.gio_kham = gio_kham
        self.ma_lich_kham = f"SLOT-{bac_si_id}-{ngay_kham}-{gio_kham.strftime('%H%M')}"


class AppointmentBookingMixin:
    async def _resolve_locked_booking_patient(
        self,
        payload: AppointmentCreateRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> Tuple[BenhNhan, NguoiDung]:
        is_staff_proxy = user.vai_tro in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value)
        target_patient_id = getattr(payload, "benh_nhan_id", None) if is_staff_proxy else None

        stmt = select(BenhNhan, NguoiDung).join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
        if target_patient_id:
            stmt = stmt.where(BenhNhan.id == target_patient_id)
        else:
            stmt = stmt.where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        stmt = stmt.with_for_update(of=BenhNhan)

        row = (await db.execute(stmt)).first()
        if not row:
            raise ForbiddenException("Không tìm thấy hồ sơ Bệnh nhân hợp lệ!")
        return row

    async def _claim_triage_analysis(
        self,
        phan_tich_ai_id: Optional[int],
        benh_nhan_id: int,
        db: AsyncSession,
    ) -> Optional[PhanTichAI]:
        if phan_tich_ai_id is None:
            return None
        stmt = (
            select(PhanTichAI)
            .where(
                PhanTichAI.id == phan_tich_ai_id,
                PhanTichAI.co_dau_hieu_cap_cuu.is_(False),
                PhanTichAI.lich_kham_id.is_(None),
                (PhanTichAI.benh_nhan_id == benh_nhan_id) | PhanTichAI.benh_nhan_id.is_(None),
            )
            .with_for_update()
        )
        analysis = (await db.execute(stmt)).scalar_one_or_none()
        if not analysis:
            raise UnprocessableEntityException(
                "Kết quả phân tích AI không hợp lệ hoặc đã được sử dụng. Vui lòng phân tích lại triệu chứng."
            )
        return analysis

    async def _assert_appointment_access(
        self,
        lich: LichKham,
        user: TaiKhoan,
        db: AsyncSession,
        action_label: str,
    ) -> None:
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
            bn = (await db.execute(stmt_bn)).scalar_one_or_none()
            if not bn or lich.benh_nhan_id != bn.id:
                raise ForbiddenException(f"Bạn không có quyền {action_label} lịch hẹn của người khác!")
        elif user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs = (await db.execute(stmt_bs)).scalar_one_or_none()
            if not bs or lich.bac_si_id != bs.id:
                raise ForbiddenException(f"Bạn chỉ có thể {action_label} lịch khám thuộc trách nhiệm phụ trách của mình!")

    async def _close_waiting_queue_tickets(
        self,
        lich_kham_id: int,
        reason_note: str,
        db: AsyncSession,
    ) -> None:
        stmt_ticket = select(HangDoiKham).where(
            HangDoiKham.lich_kham_id == lich_kham_id,
            HangDoiKham.trang_thai.in_(
                [
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                ]
            ),
        )
        active_tickets = (await db.execute(stmt_ticket)).scalars().all()
        for ticket in active_tickets:
            ticket.trang_thai = TrangThaiHangDoiEnum.BO_KHAM.value
            ticket.muc_do_uu_tien = 7
            ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | {reason_note}".strip(" |")

    async def create_booking(
        self,
        payload: AppointmentCreateRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> AppointmentResponse:
        benh_nhan, bn_info = await self._resolve_locked_booking_patient(payload, user, db)
        phan_tich_ai = await self._claim_triage_analysis(payload.phan_tich_ai_id, benh_nhan.id, db)

        if benh_nhan.is_blocked_booking:
            if user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
                raise ForbiddenException(
                    "Tài khoản của bạn đang bị tạm khóa đặt lịch trực tuyến do vắng mặt không báo trước nhiều lần. "
                    "Vui lòng liên hệ Hotline phòng khám để được hỗ trợ!"
                )
            logger.info(f"Lễ tân/Admin ID {user.id} bảo lãnh đặt lịch cho bệnh nhân bị khóa ID {benh_nhan.id}")

        bac_si, bs_info, specialty_name = await self._get_active_doctor(payload.bac_si_id, db)

        from app.services.auth.credential_service import credential_service

        await credential_service.check_doctor_license_valid(db, payload.bac_si_id)

        slot_minutes = settings.SLOT_DURATION_MINUTES
        booking_dt = datetime.combine(payload.ngay_kham, payload.gio_kham)
        booking_end = booking_dt + timedelta(minutes=slot_minutes)
        if booking_dt < self._current_clinic_time():
            raise AppException("Không thể đặt lịch khám trong quá khứ!")

        patient_ranges = await self._get_occupied_ranges(LichKham.benh_nhan_id == benh_nhan.id, payload.ngay_kham, db)
        if overlaps_any(booking_dt, booking_end, patient_ranges):
            raise ConflictException("Bạn đã có một lịch hẹn khám khác trong khung giờ này!")

        slots = await self._compute_day_slots(
            payload.bac_si_id, payload.ngay_kham, db, lock_shifts=True, slot_minutes=slot_minutes
        )
        chosen_slot = next((slot for slot in slots if slot.time_val == payload.gio_kham), None)
        if chosen_slot is None:
            raise AppException(
                f"Khung giờ đã chọn không nằm trong lịch làm việc của Bác sĩ! "
                f"Vui lòng chọn một mốc {slot_minutes} phút còn trống trong ca."
            )
        if chosen_slot.status == "booked":
            raise ConflictException("Rất tiếc! Khung giờ này vừa được người bệnh khác giữ chỗ trước.")
        if chosen_slot.status != "available":
            raise AppException("Không thể đặt lịch khám trong quá khứ!")

        stmt_active_shift = select(LichLamViec).where(
            and_(
                LichLamViec.bac_si_id == payload.bac_si_id,
                LichLamViec.ngay_lam_viec == payload.ngay_kham,
                LichLamViec.gio_bat_dau <= payload.gio_kham,
                LichLamViec.gio_ket_thuc >= booking_end.time(),
                LichLamViec.is_active.is_(True),
            )
        )
        active_shift = (await db.execute(stmt_active_shift)).scalar_one_or_none()
        if active_shift and active_shift.gioi_han_ca_kham:
            stmt_shift_bookings = select(func.count(LichKham.id)).where(
                and_(
                    LichKham.bac_si_id == payload.bac_si_id,
                    LichKham.ngay_kham == payload.ngay_kham,
                    LichKham.gio_kham >= active_shift.gio_bat_dau,
                    LichKham.gio_kham < active_shift.gio_ket_thuc,
                    LichKham.trang_thai.in_(OCCUPYING_SLOT_STATUSES),
                )
            )
            booked_in_shift = (await db.execute(stmt_shift_bookings)).scalar() or 0
            if booked_in_shift >= active_shift.gioi_han_ca_kham:
                raise ConflictException(
                    f"Ca khám này của Bác sĩ đã đạt giới hạn tiếp nhận tối đa ({active_shift.gioi_han_ca_kham} người bệnh). "
                    "Vui lòng chọn ca khám khác!"
                )

        stmt_count = select(func.count(LichKham.id), func.coalesce(func.max(LichKham.so_thu_tu), 0)).where(
            and_(
                LichKham.bac_si_id == payload.bac_si_id,
                LichKham.ngay_kham == payload.ngay_kham,
            )
        )
        total_count, max_so_thu_tu = (await db.execute(stmt_count)).one()
        so_thu_tu = max_so_thu_tu + 1
        ma_lich = build_appointment_code(payload.ngay_kham, payload.bac_si_id, total_count + 1)

        if getattr(payload, "ca_kham", None):
            effective_ca = payload.ca_kham
        elif active_shift and active_shift.ca_lam_viec:
            effective_ca = active_shift.ca_lam_viec
        else:
            effective_ca = CaLamViecEnum.SANG.value if payload.gio_kham < time(12, 0) else CaLamViecEnum.CHIEU.value

        lich_kham = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=benh_nhan.id,
            bac_si_id=payload.bac_si_id,
            chuyen_khoa_id=bac_si.chuyen_khoa_id,
            lich_lam_viec_id=active_shift.id if active_shift else None,
            ca_kham=effective_ca,
            ngay_kham=payload.ngay_kham,
            gio_kham=payload.gio_kham,
            thoi_luong_phut=slot_minutes,
            so_thu_tu=so_thu_tu,
            ly_do_kham=payload.ly_do_kham,
            trieu_chung_ban_dau=payload.trieu_chung_ban_dau,
            phan_tich_ai_id=phan_tich_ai.id if phan_tich_ai else None,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        )
        db.add(lich_kham)
        if phan_tich_ai:
            phan_tich_ai.benh_nhan_id = benh_nhan.id
            phan_tich_ai.lich_kham = lich_kham
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            violated = str(exc.orig)
            if "uq_active_patient_slot" in violated:
                raise ConflictException("Bạn đã có một lịch hẹn khám khác trong khung giờ này!")
            if "uq_active_doctor_slot" in violated:
                logger.warning(f"⚠️ [BOOKING CONFLICT] Bác sĩ {payload.bac_si_id} | {booking_dt} | vi phạm ràng buộc CSDL")
                raise ConflictException("Rất tiếc! Khung giờ này vừa được người bệnh khác giữ chỗ trước.")
            raise
        await db.refresh(lich_kham)

        logger.info(f"✅ [APPOINTMENT CREATED] Mã: {ma_lich} | Bệnh nhân: {bn_info.ho_ten} | Bác sĩ: {bs_info.ho_ten}")
        return build_appointment_response(lich_kham, bac_si, bs_info, specialty_name, benh_nhan, bn_info)

    async def cancel_booking(
        self,
        appointment_id: int,
        payload: AppointmentCancelRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> AppointmentCancelResponse:
        stmt = select(LichKham).where(LichKham.id == appointment_id).with_for_update()
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        await self._assert_appointment_access(lich, user, db, "hủy")

        if lich.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Lịch hẹn này đã bị hủy trước đó!")
        if lich.trang_thai not in CANCELLABLE_STATUSES:
            raise ConflictException(
                f"Lịch hẹn đang ở trạng thái '{lich.trang_thai}' (đang khám/đã khám/vắng mặt) nên không thể hủy!"
            )
        if lich.trang_thai == TrangThaiLichEnum.DA_TIEP_NHAN.value and user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            raise ConflictException("Lịch hẹn đã được tiếp nhận tại quầy! Vui lòng liên hệ Lễ tân để hủy hoặc đổi lịch.")

        appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        diff_hours = (appointment_dt - self._current_clinic_time()).total_seconds() / 3600.0
        if diff_hours <= 0:
            raise ConflictException("Đã tới hoặc đã qua giờ khám, không thể hủy lịch hẹn này!")
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value and diff_hours < settings.CANCELLATION_MINIMUM_HOURS:
            raise AppException(
                f"Theo quy định phòng khám, bạn chỉ có thể hủy lịch trước giờ khám tối thiểu "
                f"{settings.CANCELLATION_MINIMUM_HOURS} tiếng. Vui lòng gọi Hotline để được hỗ trợ khẩn cấp!"
            )

        lich.trang_thai = TrangThaiLichEnum.DA_HUY.value
        lich.ly_do_huy = payload.ly_do_huy
        lich.thoi_gian_huy = datetime.now(timezone.utc)
        lich.nguoi_huy_vai_tro = user.vai_tro
        lich.nguoi_huy_id = user.nguoi_dung_id

        await self._close_waiting_queue_tickets(
            lich.id,
            "Đóng vé sảnh do hủy lịch hẹn (Quy tắc Bahmni)",
            db,
        )
        await db.commit()

        promoted = await self._promote_waitlist_candidate(lich, db)
        if promoted:
            await db.commit()

        logger.info(f"🚫 [APPOINTMENT CANCELLED] ID: {appointment_id} | Người hủy: {user.vai_tro} | Lý do: {payload.ly_do_huy}")
        return AppointmentCancelResponse(
            appointment_id=lich.id,
            ma_lich_kham=lich.ma_lich_kham,
            trang_thai=lich.trang_thai,
            ly_do_huy=lich.ly_do_huy,
            thoi_gian_huy=lich.thoi_gian_huy,
            nguoi_huy_vai_tro=lich.nguoi_huy_vai_tro,
            nguoi_huy_id=lich.nguoi_huy_id,
        )

    async def reschedule_booking(
        self,
        appointment_id: int,
        payload: AppointmentRescheduleRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> AppointmentResponse:
        stmt = select(LichKham).where(LichKham.id == appointment_id).with_for_update()
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        await self._assert_appointment_access(lich, user, db, "đổi")

        if lich.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Lịch hẹn này đã bị hủy trước đó!")
        if lich.trang_thai not in CANCELLABLE_STATUSES:
            raise ConflictException(f"Lịch hẹn đang ở trạng thái '{lich.trang_thai}' nên không thể đổi lịch!")

        old_appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        diff_hours = (old_appointment_dt - self._current_clinic_time()).total_seconds() / 3600.0
        if diff_hours <= 0 and user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            raise ConflictException("Đã tới hoặc đã qua giờ khám cũ, không thể đổi lịch hẹn này!")
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value and diff_hours < settings.CANCELLATION_MINIMUM_HOURS:
            raise AppException(
                f"Theo quy định phòng khám, bạn chỉ có thể đổi lịch trước giờ khám cũ tối thiểu "
                f"{settings.CANCELLATION_MINIMUM_HOURS} tiếng. Vui lòng gọi Hotline để được hỗ trợ khẩn cấp!"
            )

        target_bs_id = payload.bac_si_id_moi or lich.bac_si_id
        bac_si, bs_info, specialty_name = await self._get_active_doctor(target_bs_id, db)

        slot_minutes = settings.SLOT_DURATION_MINUTES
        new_booking_dt = datetime.combine(payload.ngay_kham_moi, payload.gio_kham_moi)
        new_booking_end = new_booking_dt + timedelta(minutes=slot_minutes)
        if new_booking_dt < self._current_clinic_time():
            raise AppException("Không thể đổi sang khung giờ trong quá khứ!")

        shift = await self._find_doctor_shift(
            target_bs_id, payload.ngay_kham_moi, payload.gio_kham_moi, new_booking_end.time(), db
        )
        is_off, off_reason = await self._is_doctor_off(target_bs_id, payload.ngay_kham_moi, db)
        if is_off:
            raise ConflictException(f"Bác sĩ có lịch nghỉ đột xuất vào ngày {payload.ngay_kham_moi}: {off_reason}")

        stmt_shift_lock = select(LichLamViec).where(LichLamViec.id == shift.id).with_for_update()
        shift = (await db.execute(stmt_shift_lock)).scalar_one()

        stmt_dup = select(LichKham).where(
            LichKham.id != lich.id,
            LichKham.benh_nhan_id == lich.benh_nhan_id,
            LichKham.ngay_kham == payload.ngay_kham_moi,
            LichKham.gio_kham == payload.gio_kham_moi,
            LichKham.trang_thai.in_(OCCUPYING_SLOT_STATUSES),
        )
        if (await db.execute(stmt_dup)).first():
            raise ConflictException("Bạn đã có một lịch hẹn khám khác trong khung giờ này!")

        stmt_slot = select(LichKham).where(
            LichKham.id != lich.id,
            LichKham.bac_si_id == target_bs_id,
            LichKham.ngay_kham == payload.ngay_kham_moi,
            LichKham.gio_kham == payload.gio_kham_moi,
            LichKham.trang_thai.in_(OCCUPYING_SLOT_STATUSES),
        )
        if (await db.execute(stmt_slot)).first():
            raise ConflictException(
                f"Rất tiếc! Khung giờ {payload.gio_kham_moi.strftime('%H:%M')} ngày {payload.ngay_kham_moi} vừa được người bệnh khác đặt trước."
            )

        stmt_stt = select(func.max(LichKham.so_thu_tu)).where(
            LichKham.id != lich.id,
            LichKham.bac_si_id == target_bs_id,
            LichKham.ngay_kham == payload.ngay_kham_moi,
            LichKham.ca_kham == shift.ca_lam_viec,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        new_stt = ((await db.execute(stmt_stt)).scalar() or 0) + 1

        old_bs_id = lich.bac_si_id
        old_ngay = lich.ngay_kham
        old_gio = lich.gio_kham

        if payload.ly_do_doi:
            note_change = f"[Đổi từ {old_ngay} {old_gio.strftime('%H:%M')} (BS ID {old_bs_id}): {payload.ly_do_doi}]"
            lich.ly_do_kham = f"{lich.ly_do_kham} - {note_change}" if lich.ly_do_kham else note_change
        lich.ngay_kham = payload.ngay_kham_moi
        lich.gio_kham = payload.gio_kham_moi
        lich.bac_si_id = target_bs_id
        lich.lich_lam_viec_id = shift.id
        lich.ca_kham = shift.ca_lam_viec
        lich.so_thu_tu = new_stt
        lich.trang_thai = TrangThaiLichEnum.DA_XAC_NHAN.value

        await self._close_waiting_queue_tickets(
            lich.id,
            f"Đóng vé sảnh do dời lịch sang {payload.ngay_kham_moi} (Quy tắc Bahmni)",
            db,
        )

        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise ConflictException("Khung giờ mới vừa có xung đột đặt chỗ!")

        promoted = await self._promote_waitlist_candidate(_ReleasedSlotRef(old_bs_id, old_ngay, old_gio), db)
        if promoted:
            await db.commit()

        stmt_bn_info = (
            select(BenhNhan, NguoiDung)
            .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
            .where(BenhNhan.id == lich.benh_nhan_id)
        )
        benh_nhan, bn_info = (await db.execute(stmt_bn_info)).first()

        logger.info(f"🔄 [APPOINTMENT RESCHEDULED] Mã: {lich.ma_lich_kham} | Sang ngày: {payload.ngay_kham_moi} {payload.gio_kham_moi}")
        return build_appointment_response(lich, bac_si, bs_info, specialty_name, benh_nhan, bn_info)

    async def confirm_appointment(
        self,
        appointment_id: int,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> AppointmentConfirmResponse:
        stmt = select(LichKham).where(LichKham.id == appointment_id).with_for_update()
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            await self._assert_appointment_access(lich, user, db, "xác nhận")

        if lich.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Lịch hẹn này đã bị hủy trước đó, không thể xác nhận!")
        if lich.trang_thai == TrangThaiLichEnum.DA_XAC_NHAN.value and lich.is_reconfirmed_24h:
            raise ConflictException("Lịch hẹn này đã được xác nhận trước đó!")
        if lich.trang_thai not in (TrangThaiLichEnum.CHO_XAC_NHAN.value, TrangThaiLichEnum.DA_XAC_NHAN.value):
            raise ConflictException(f"Lịch hẹn đang ở trạng thái '{lich.trang_thai}', không thể xác nhận!")

        appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        if (appointment_dt - self._current_clinic_time()).total_seconds() <= 0:
            raise ConflictException("Đã tới hoặc đã qua giờ khám, không thể xác nhận lịch hẹn này!")

        now = datetime.now(timezone.utc)
        lich.is_reconfirmed_24h = True
        lich.trang_thai = TrangThaiLichEnum.DA_XAC_NHAN.value
        lich.thoi_gian_xac_nhan = now
        await db.commit()

        logger.info(f"✅ [APPOINTMENT CONFIRMED] Mã: {lich.ma_lich_kham} | Bệnh nhân: {lich.benh_nhan_id} đã xác nhận 24h.")
        return AppointmentConfirmResponse(
            appointment_id=lich.id,
            ma_lich_kham=lich.ma_lich_kham,
            trang_thai=lich.trang_thai,
            is_reconfirmed_24h=lich.is_reconfirmed_24h,
            thoi_gian_xac_nhan=lich.thoi_gian_xac_nhan,
            message="Xác nhận lịch hẹn khám thành công! Chúc bạn có buổi khám sức khỏe thuận lợi.",
        )
