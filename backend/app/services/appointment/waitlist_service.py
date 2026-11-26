import logging
from datetime import datetime, time, timedelta, timezone
from typing import List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AppException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.appointment import (
    CANCELLED_STATUSES,
    CaLamViecEnum,
    DanhSachCho,
    LichKham,
    TrangThaiLichEnum,
    TrangThaiWaitlistEnum,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.appointment import (
    AppointmentResponse,
    AutoProcessNoShowResponse,
    NoShowMarkRequest,
    NoShowMarkResponse,
    WaitlistCreateRequest,
    WaitlistResponse,
)
from app.services.appointment.slot_builder import (
    build_appointment_code,
    build_appointment_response,
)
from app.services.patient.medical_service import DEFAULT_SPECIALTY_NAME

logger = logging.getLogger("clinic_backend")


def _build_waitlist_response(
    entry: DanhSachCho,
    doctor_name: str,
    specialty_name: str,
) -> WaitlistResponse:
    return WaitlistResponse(
        id=entry.id,
        benh_nhan_id=entry.benh_nhan_id,
        bac_si_id=entry.bac_si_id,
        bac_si_ho_ten=doctor_name,
        chuyen_khoa=specialty_name,
        ngay_mong_muon=entry.ngay_mong_muon,
        ca_mong_muon=entry.ca_mong_muon,
        trieu_chung=entry.trieu_chung,
        thu_tu_uu_tien=entry.thu_tu_uu_tien,
        trang_thai=entry.trang_thai,
        thoi_gian_thong_bao=entry.thoi_gian_thong_bao,
        thoi_gian_het_han_giu_slot=entry.thoi_gian_het_han_giu_slot,
        slot_duoc_cap_id=entry.slot_duoc_cap_id,
        created_at=entry.created_at,
    )


class AppointmentWaitlistMixin:
    async def _promote_waitlist_candidate(self, lich: LichKham, db: AsyncSession) -> Optional[DanhSachCho]:
        ca = CaLamViecEnum.SANG.value if lich.gio_kham < time(12, 0) else CaLamViecEnum.CHIEU.value
        stmt_candidate = (
            select(DanhSachCho)
            .where(
                and_(
                    DanhSachCho.bac_si_id == lich.bac_si_id,
                    DanhSachCho.ngay_mong_muon == lich.ngay_kham,
                    DanhSachCho.ca_mong_muon == ca,
                    DanhSachCho.trang_thai == TrangThaiWaitlistEnum.DANG_CHO.value,
                )
            )
            .order_by(DanhSachCho.thu_tu_uu_tien.asc(), DanhSachCho.created_at.asc())
            .with_for_update()
        )
        candidate = (await db.execute(stmt_candidate)).scalars().first()
        if not candidate:
            return None

        now = datetime.now(timezone.utc)
        candidate.trang_thai = TrangThaiWaitlistEnum.DA_THONG_BAO.value
        candidate.slot_duoc_cap_id = getattr(lich, "id", None)
        candidate.thoi_gian_thong_bao = now
        candidate.thoi_gian_het_han_giu_slot = now + timedelta(minutes=30)
        slot_code = getattr(lich, "ma_lich_kham", f"BS{lich.bac_si_id}-{lich.ngay_kham}")
        logger.info(
            f"📢 [WAITLIST PROMOTED] Bệnh nhân ID: {candidate.benh_nhan_id} được giữ slot {slot_code} trong 30 phút!"
        )
        return candidate

    async def mark_no_show(
        self,
        appointment_id: int,
        payload: NoShowMarkRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> NoShowMarkResponse:
        if user.vai_tro not in (VaiTroEnum.BAC_SI.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chỉ Bác sĩ phụ trách hoặc Quản trị viên mới có quyền đánh dấu No-show!")

        stmt = select(LichKham).where(LichKham.id == appointment_id).with_for_update()
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        if user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs = (await db.execute(stmt_bs)).scalar_one_or_none()
            if not bs or lich.bac_si_id != bs.id:
                raise ForbiddenException("Bạn chỉ có thể đánh dấu No-show cho lịch khám do mình phụ trách!")

        if lich.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Lịch hẹn này đã bị hủy, không thể đánh dấu No-show!")
        if lich.trang_thai == TrangThaiLichEnum.NO_SHOW.value:
            raise ConflictException("Lịch hẹn này đã được đánh dấu No-show trước đó!")
        if lich.trang_thai in (TrangThaiLichEnum.DANG_KHAM.value, TrangThaiLichEnum.DA_KHAM.value):
            raise ConflictException(
                "Người bệnh đã được tiếp nhận hoặc đã hoàn tất ca khám, không thể ghi nhận No-show!"
            )

        appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        if appointment_dt > self._current_clinic_time() + timedelta(minutes=15):
            raise ConflictException("Chưa đến giờ hẹn khám của người bệnh, không thể đánh dấu No-show trước giờ!")

        lich.trang_thai = TrangThaiLichEnum.NO_SHOW.value

        stmt_bn = select(BenhNhan).where(BenhNhan.id == lich.benh_nhan_id).with_for_update()
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if benh_nhan:
            benh_nhan.so_lan_no_show += 1
            tong_so_lan = benh_nhan.so_lan_no_show
        else:
            tong_so_lan = 1

        await db.commit()

        canh_bao = tong_so_lan >= 3
        logger.warning(
            f"⚠️ [NO-SHOW MARKED] Mã hẹn: {lich.ma_lich_kham} | Bệnh nhân ID: {lich.benh_nhan_id} | Tổng vi phạm: {tong_so_lan}"
        )
        return NoShowMarkResponse(
            appointment_id=lich.id,
            ma_lich_kham=lich.ma_lich_kham,
            trang_thai=lich.trang_thai,
            benh_nhan_id=lich.benh_nhan_id,
            so_lan_no_show=tong_so_lan,
            canh_bao_khoa_tai_khoan=canh_bao,
        )

    async def register_waitlist(
        self,
        payload: WaitlistCreateRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> WaitlistResponse:
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chức năng đăng ký danh sách chờ chỉ dành riêng cho Bệnh nhân!")

        stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not benh_nhan:
            raise ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bệnh nhân hợp lệ!")

        if benh_nhan.so_lan_no_show >= 3:
            raise ForbiddenException(
                "Tài khoản của bạn đã vi phạm No-show quá 3 lần. Vui lòng liên hệ Hotline phòng khám để được hỗ trợ!"
            )

        _, bs_info, specialty_name = await self._get_active_doctor(payload.bac_si_id, db)

        if payload.ngay_mong_muon < self._current_clinic_time().date():
            raise AppException("Không thể đăng ký danh sách chờ cho ngày trong quá khứ!")

        stmt_exist = select(DanhSachCho).where(
            and_(
                DanhSachCho.benh_nhan_id == benh_nhan.id,
                DanhSachCho.bac_si_id == payload.bac_si_id,
                DanhSachCho.ngay_mong_muon == payload.ngay_mong_muon,
                DanhSachCho.ca_mong_muon == payload.ca_mong_muon,
                DanhSachCho.trang_thai == TrangThaiWaitlistEnum.DANG_CHO.value,
            )
        )
        if (await db.execute(stmt_exist)).scalar_one_or_none():
            raise ConflictException("Bạn đã có một yêu cầu trong danh sách chờ cho ca khám này rồi!")

        stmt_max = select(func.coalesce(func.max(DanhSachCho.thu_tu_uu_tien), 0)).where(
            and_(
                DanhSachCho.bac_si_id == payload.bac_si_id,
                DanhSachCho.ngay_mong_muon == payload.ngay_mong_muon,
                DanhSachCho.ca_mong_muon == payload.ca_mong_muon,
                DanhSachCho.trang_thai == TrangThaiWaitlistEnum.DANG_CHO.value,
            )
        )
        thu_tu_uu_tien = ((await db.execute(stmt_max)).scalar() or 0) + 1

        entry = DanhSachCho(
            benh_nhan_id=benh_nhan.id,
            bac_si_id=payload.bac_si_id,
            ngay_mong_muon=payload.ngay_mong_muon,
            ca_mong_muon=payload.ca_mong_muon,
            trieu_chung=payload.trieu_chung,
            thu_tu_uu_tien=thu_tu_uu_tien,
            trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value,
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)

        logger.info(
            f"⏳ [WAITLIST REGISTERED] Bệnh nhân: {benh_nhan.id} | Bác sĩ: {payload.bac_si_id} | Thứ tự: {thu_tu_uu_tien}"
        )
        return _build_waitlist_response(entry, bs_info.ho_ten, specialty_name)

    async def get_my_waitlist(
        self,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> List[WaitlistResponse]:
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chức năng này chỉ dành riêng cho Bệnh nhân!")

        stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not benh_nhan:
            return []

        stmt = (
            select(DanhSachCho, BacSi, NguoiDung, ChuyenKhoa)
            .join(BacSi, DanhSachCho.bac_si_id == BacSi.id)
            .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
            .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
            .where(DanhSachCho.benh_nhan_id == benh_nhan.id)
            .order_by(DanhSachCho.ngay_mong_muon.desc(), DanhSachCho.thu_tu_uu_tien.asc())
        )
        rows = (await db.execute(stmt)).all()
        return [
            _build_waitlist_response(
                entry,
                bs_info.ho_ten,
                ck.ten_chuyen_khoa if ck else DEFAULT_SPECIALTY_NAME,
            )
            for entry, _, bs_info, ck in rows
        ]

    async def accept_waitlist_slot(
        self,
        waitlist_id: int,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> AppointmentResponse:
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chỉ Bệnh nhân mới có quyền xác nhận nhận slot từ danh sách chờ!")

        stmt_bn = (
            select(BenhNhan, NguoiDung)
            .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
            .where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        )
        bn_row = (await db.execute(stmt_bn)).first()
        if not bn_row:
            raise ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bệnh nhân hợp lệ!")
        benh_nhan, bn_info = bn_row

        stmt_entry = select(DanhSachCho).where(DanhSachCho.id == waitlist_id).with_for_update()
        entry = (await db.execute(stmt_entry)).scalar_one_or_none()
        if not entry:
            raise NotFoundException("Không tìm thấy thông tin lượt đăng ký trong danh sách chờ!")
        if entry.benh_nhan_id != benh_nhan.id:
            raise ForbiddenException("Bạn không có quyền thao tác trên lượt đăng ký chờ của người khác!")
        if entry.trang_thai == TrangThaiWaitlistEnum.DA_NHAN_SLOT.value:
            raise ConflictException("Bạn đã xác nhận nhận slot khám này trước đó rồi!")
        if entry.trang_thai != TrangThaiWaitlistEnum.DA_THONG_BAO.value:
            raise ConflictException(
                f"Lượt đăng ký đang ở trạng thái '{entry.trang_thai}', chưa có slot trống được thông báo để nhận!"
            )

        now = datetime.now(timezone.utc)
        expire_time = entry.thoi_gian_het_han_giu_slot
        if expire_time:
            if expire_time.tzinfo is None:
                expire_time = expire_time.replace(tzinfo=timezone.utc)
            if now > expire_time:
                entry.trang_thai = TrangThaiWaitlistEnum.DA_BO_QUA.value
                await db.commit()
                raise ConflictException(
                    "Rất tiếc! Đã quá thời hạn 30 phút giữ chỗ. Khung giờ này đã được chuyển cho người tiếp theo."
                )

        stmt_slot = select(LichKham).where(LichKham.id == entry.slot_duoc_cap_id).with_for_update()
        freed_slot = (await db.execute(stmt_slot)).scalar_one_or_none()
        if not freed_slot:
            raise NotFoundException("Không tìm thấy thông tin khung giờ khám được cấp!")

        bac_si, bs_info, specialty_name = await self._get_active_doctor(entry.bac_si_id, db)

        stmt_count = select(func.count(LichKham.id), func.coalesce(func.max(LichKham.so_thu_tu), 0)).where(
            and_(
                LichKham.bac_si_id == entry.bac_si_id,
                LichKham.ngay_kham == freed_slot.ngay_kham,
            )
        )
        total_count, max_so_thu_tu = (await db.execute(stmt_count)).one()
        so_thu_tu = max_so_thu_tu + 1
        ma_lich = build_appointment_code(freed_slot.ngay_kham, entry.bac_si_id, total_count + 1)

        new_booking = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=benh_nhan.id,
            bac_si_id=entry.bac_si_id,
            ngay_kham=freed_slot.ngay_kham,
            gio_kham=freed_slot.gio_kham,
            thoi_luong_phut=freed_slot.thoi_luong_phut,
            so_thu_tu=so_thu_tu,
            ly_do_kham=f"Đặt từ Danh sách chờ #{entry.id} (OpenMRS Waitlist)",
            trieu_chung_ban_dau=entry.trieu_chung,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
            is_reconfirmed_24h=True,
            thoi_gian_xac_nhan=now,
        )
        db.add(new_booking)
        entry.trang_thai = TrangThaiWaitlistEnum.DA_NHAN_SLOT.value
        await db.commit()
        await db.refresh(new_booking)

        logger.info(f"🎉 [WAITLIST ACCEPTED] Bệnh nhân: {bn_info.ho_ten} đã nhận slot thành công: {ma_lich}")
        return build_appointment_response(new_booking, bac_si, bs_info, specialty_name, benh_nhan, bn_info)

    async def auto_process_unconfirmed_and_waitlist(
        self,
        db: AsyncSession,
        hours_threshold: float = 2.0,
    ) -> AutoProcessNoShowResponse:
        now = self._current_clinic_time()
        stmt = (
            select(LichKham)
            .where(
                and_(
                    LichKham.trang_thai == TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    LichKham.is_reconfirmed_24h.is_(False),
                )
            )
            .with_for_update()
        )
        candidates = (await db.execute(stmt)).scalars().all()

        cancelled_codes: List[str] = []
        promoted_count = 0

        for lich in candidates:
            appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
            diff_hours = (appointment_dt - now).total_seconds() / 3600.0
            if 0 < diff_hours <= hours_threshold:
                lich.trang_thai = TrangThaiLichEnum.TU_DONG_HUY.value
                lich.thoi_gian_huy = datetime.now(timezone.utc)
                lich.ly_do_huy = (
                    f"Hệ thống tự động hủy do người bệnh không xác nhận lịch hẹn trước {hours_threshold:.0f} tiếng theo quy định."
                )
                lich.nguoi_huy_vai_tro = "system"
                cancelled_codes.append(lich.ma_lich_kham)

                promoted = await self._promote_waitlist_candidate(lich, db)
                if promoted:
                    promoted_count += 1

        if cancelled_codes:
            await db.commit()
            logger.info(
                f"🤖 [AUTO CANCEL] Đã tự động hủy {len(cancelled_codes)} lịch chưa xác nhận, đôn {promoted_count} người từ Waitlist."
            )

        return AutoProcessNoShowResponse(
            so_lich_tu_dong_huy=len(cancelled_codes),
            so_nguoi_don_waitlist=promoted_count,
            danh_sach_ma_lich_huy=cancelled_codes,
        )
