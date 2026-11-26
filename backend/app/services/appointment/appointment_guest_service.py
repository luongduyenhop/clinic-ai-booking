import logging
from datetime import datetime, time, timedelta
from typing import Tuple
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AppException,
    ConflictException,
    ForbiddenException,
    UnprocessableEntityException,
)
from app.models.appointment import (
    CaLamViecEnum,
    LichKham,
    LichLamViec,
    OCCUPYING_SLOT_STATUSES,
    PhanTichAI,
    TrangThaiLichEnum,
)
from app.models.user import BenhNhan, NguoiDung
from app.schemas.appointment import (
    AppointmentResponse,
    DoctorBriefResponse,
    GuestAppointmentCreateRequest,
    PatientBriefResponse,
)
from app.services.appointment.appointment_service import (
    appointment_service,
    build_appointment_code,
    clinic_now,
    overlaps_any,
)
from app.services.auth.credential_service import credential_service

logger = logging.getLogger("clinic_backend")


class GuestAppointmentService:
    async def _resolve_or_create_guest_patient(
        self,
        payload: GuestAppointmentCreateRequest,
        db: AsyncSession,
    ) -> Tuple[BenhNhan, NguoiDung]:
        clean_phone = payload.so_dien_thoai.strip()
        stmt_bn = (
            select(BenhNhan, NguoiDung)
            .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
            .where(NguoiDung.so_dien_thoai == clean_phone)
            .with_for_update(of=BenhNhan)
        )
        bn_row = (await db.execute(stmt_bn)).first()
        if bn_row:
            benh_nhan, bn_info = bn_row
            if benh_nhan.is_blocked_booking:
                raise ForbiddenException(
                    "Số điện thoại này đang bị tạm khóa đặt lịch trực tuyến do vắng mặt không báo trước nhiều lần. "
                    "Vui lòng liên hệ Hotline phòng khám để được hỗ trợ!"
                )
            return benh_nhan, bn_info

        try:
            async with db.begin_nested():
                stmt_nd = select(NguoiDung).where(NguoiDung.so_dien_thoai == clean_phone)
                existing_nd = (await db.execute(stmt_nd)).scalar_one_or_none()
                if existing_nd:
                    bn_info = existing_nd
                else:
                    bn_info = NguoiDung(
                        ho_ten=payload.ho_ten.strip(),
                        so_dien_thoai=clean_phone,
                        ngay_sinh=payload.ngay_sinh,
                        gioi_tinh=payload.gioi_tinh or "Khác",
                    )
                    db.add(bn_info)
                    await db.flush()

                benh_nhan = BenhNhan(
                    nguoi_dung_id=bn_info.id,
                    ma_dinh_danh_y_te=f"BN-GUEST-{bn_info.id:05d}",
                    di_ung_thuoc="Chưa khai báo",
                    tien_su_benh="Chưa khai báo",
                )
                db.add(benh_nhan)
                await db.flush()
                return benh_nhan, bn_info
        except IntegrityError:
            retry_row = (await db.execute(stmt_bn)).first()
            if not retry_row:
                raise ConflictException("Không thể khởi tạo hồ sơ khách đặt lịch do xung đột dữ liệu, vui lòng thử lại!")
            benh_nhan, bn_info = retry_row
            if benh_nhan.is_blocked_booking:
                raise ForbiddenException(
                    "Số điện thoại này đang bị tạm khóa đặt lịch trực tuyến do vắng mặt không báo trước nhiều lần. "
                    "Vui lòng liên hệ Hotline phòng khám để được hỗ trợ!"
                )
            return benh_nhan, bn_info

    async def create_guest_booking(
        self,
        payload: GuestAppointmentCreateRequest,
        db: AsyncSession,
    ) -> AppointmentResponse:
        benh_nhan, bn_info = await self._resolve_or_create_guest_patient(payload, db)

        phan_tich_ai = None
        if payload.phan_tich_ai_id is not None:
            stmt_ai = (
                select(PhanTichAI)
                .where(
                    PhanTichAI.id == payload.phan_tich_ai_id,
                    PhanTichAI.co_dau_hieu_cap_cuu.is_(False),
                    PhanTichAI.lich_kham_id.is_(None),
                    (PhanTichAI.benh_nhan_id == benh_nhan.id) | PhanTichAI.benh_nhan_id.is_(None),
                )
                .with_for_update()
            )
            phan_tich_ai = (await db.execute(stmt_ai)).scalar_one_or_none()
            if not phan_tich_ai:
                raise UnprocessableEntityException(
                    "Kết quả phân tích AI không hợp lệ hoặc đã được sử dụng. Vui lòng phân tích lại triệu chứng."
                )

        bac_si, bs_info, specialty_name = await appointment_service._get_active_doctor(payload.bac_si_id, db)
        await credential_service.check_doctor_license_valid(db, payload.bac_si_id)

        slot_minutes = settings.SLOT_DURATION_MINUTES
        booking_dt = datetime.combine(payload.ngay_kham, payload.gio_kham)
        booking_end = booking_dt + timedelta(minutes=slot_minutes)
        if booking_dt < clinic_now():
            raise AppException("Không thể đặt lịch khám trong quá khứ!")

        patient_ranges = await appointment_service._get_occupied_ranges(
            LichKham.benh_nhan_id == benh_nhan.id, payload.ngay_kham, db
        )
        if overlaps_any(booking_dt, booking_end, patient_ranges):
            raise ConflictException("Số điện thoại này đã có một lịch hẹn khám khác trong khung giờ này!")

        slots = await appointment_service._compute_day_slots(
            payload.bac_si_id,
            payload.ngay_kham,
            db,
            lock_shifts=True,
            slot_minutes=slot_minutes,
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

        stmt_count = select(
            func.count(LichKham.id),
            func.coalesce(func.max(LichKham.so_thu_tu), 0),
        ).where(
            and_(
                LichKham.bac_si_id == payload.bac_si_id,
                LichKham.ngay_kham == payload.ngay_kham,
            )
        )
        total_count, max_so_thu_tu = (await db.execute(stmt_count)).one()
        so_thu_tu = max_so_thu_tu + 1
        ma_lich = build_appointment_code(payload.ngay_kham, payload.bac_si_id, total_count + 1)

        if payload.ca_kham:
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
                raise ConflictException("Số điện thoại này đã có một lịch hẹn khám khác trong khung giờ này!")
            if "uq_active_doctor_slot" in violated:
                logger.warning(f"[GUEST BOOKING CONFLICT] Bac si {payload.bac_si_id} | {booking_dt}")
                raise ConflictException("Rất tiếc! Khung giờ này vừa được người bệnh khác giữ chỗ trước.")
            raise

        await db.refresh(lich_kham)
        logger.info(f"[GUEST APPOINTMENT CREATED] Ma: {ma_lich} | Khach: {bn_info.ho_ten} | Bac si: {bs_info.ho_ten}")

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


guest_appointment_service = GuestAppointmentService()
