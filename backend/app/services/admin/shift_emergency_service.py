import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.medical import LuotKham
from app.models.user import BacSi, TaiKhoan
from app.schemas.admin import (
    EmergencyLeaveDeclareRequest,
    EmergencyLeaveSummaryResponse,
    PostponeAndCancelResponse,
    ReassignQueueRequest,
    ReassignQueueResponse,
)

logger = logging.getLogger(__name__)


class ShiftEmergencyMixin:
    async def declare_emergency_leave(
        self, shift_id: int, payload: EmergencyLeaveDeclareRequest, admin_user: TaiKhoan, db: AsyncSession
    ) -> EmergencyLeaveSummaryResponse:
        stmt = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(LichLamViec.id == shift_id)
            .with_for_update()
        )
        shift = (await db.execute(stmt)).scalar_one_or_none()
        if not shift:
            raise NotFoundException(f"Không tìm thấy ca làm việc với ID {shift_id}!")
        if not shift.is_active:
            raise ConflictException("Ca làm việc này đã được đánh dấu nghỉ/khóa trước đó!")

        shift.is_active = False
        shift.ghi_chu_nghi = f"Nghỉ đột xuất: {payload.ly_do_nghi}"

        stmt_cho = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == shift.bac_si_id,
            HangDoiKham.ngay_kham == shift.ngay_lam_viec,
            HangDoiKham.ca_kham == shift.ca_lam_viec,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
        )
        n_cho = (await db.execute(stmt_cho)).scalar() or 0

        stmt_dang = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == shift.bac_si_id,
            HangDoiKham.ngay_kham == shift.ngay_lam_viec,
            HangDoiKham.ca_kham == shift.ca_lam_viec,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value,
        )
        n_dang = (await db.execute(stmt_dang)).scalar() or 0

        stmt_lich = select(func.count(LichKham.id)).where(
            LichKham.bac_si_id == shift.bac_si_id,
            LichKham.ngay_kham == shift.ngay_lam_viec,
            LichKham.gio_kham >= shift.gio_bat_dau,
            LichKham.gio_kham < shift.gio_ket_thuc,
            LichKham.trang_thai.in_(
                [
                    TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    TrangThaiLichEnum.DA_XAC_NHAN.value,
                ]
            ),
        )
        n_lich = (await db.execute(stmt_lich)).scalar() or 0

        await db.commit()
        await db.refresh(shift)
        logger.warning(
            f"🚨 [AUDIT - EMERGENCY_LEAVE] Shift: {shift.id} | Bác sĩ: {shift.bac_si_id} | Admin: {admin_user.id} | "
            f"N1(chờ)={n_cho}, N2(đang khám)={n_dang}, N3(lịch hẹn)={n_lich}"
        )
        return EmergencyLeaveSummaryResponse(
            lich_lam_viec_id=shift.id,
            bac_si_id=shift.bac_si_id,
            ten_bac_si=shift.bac_si.nguoi_dung.ho_ten if shift.bac_si and shift.bac_si.nguoi_dung else "",
            chuyen_khoa=shift.bac_si.chuyen_khoa.ten_chuyen_khoa if shift.bac_si and shift.bac_si.chuyen_khoa else "",
            ngay_lam_viec=shift.ngay_lam_viec,
            ca_lam_viec=shift.ca_lam_viec,
            is_active=shift.is_active,
            ly_do_nghi=shift.ghi_chu_nghi,
            so_ve_cho_kham=n_cho,
            so_ve_dang_kham=n_dang,
            so_lich_chua_checkin=n_lich,
        )

    async def reassign_queue_to_replacement(
        self, shift_id: int, payload: ReassignQueueRequest, admin_user: TaiKhoan, db: AsyncSession
    ) -> ReassignQueueResponse:
        stmt_goc = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(LichLamViec.id == shift_id)
            .with_for_update()
        )
        shift_goc = (await db.execute(stmt_goc)).scalar_one_or_none()
        if not shift_goc:
            raise NotFoundException(f"Không tìm thấy ca làm việc gốc với ID {shift_id}!")
        if shift_goc.is_active:
            raise ConflictException("Ca làm việc này chưa được khai báo nghỉ đột xuất!")

        stmt_bs_thay = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.id == payload.bac_si_thay_the_id)
        )
        bs_thay = (await db.execute(stmt_bs_thay)).scalar_one_or_none()
        if not bs_thay:
            raise NotFoundException(f"Không tìm thấy bác sĩ thay thế với ID {payload.bac_si_thay_the_id}!")
        if bs_thay.id == shift_goc.bac_si_id:
            raise BadRequestException("Bác sĩ thay thế không thể là chính bác sĩ đang nghỉ!")
        if bs_thay.chuyen_khoa_id != shift_goc.bac_si.chuyen_khoa_id:
            raise BadRequestException(
                f"Bác sĩ thay thế thuộc chuyên khoa '{bs_thay.chuyen_khoa.ten_chuyen_khoa if bs_thay.chuyen_khoa else ''}', "
                f"không cùng chuyên khoa với bác sĩ nghỉ ('{shift_goc.bac_si.chuyen_khoa.ten_chuyen_khoa if shift_goc.bac_si.chuyen_khoa else ''}')!"
            )

        stmt_shift_thay = (
            select(LichLamViec)
            .where(
                LichLamViec.bac_si_id == bs_thay.id,
                LichLamViec.ngay_lam_viec == shift_goc.ngay_lam_viec,
                LichLamViec.ca_lam_viec == shift_goc.ca_lam_viec,
            )
            .with_for_update()
        )
        shift_thay = (await db.execute(stmt_shift_thay)).scalar_one_or_none()
        if not shift_thay or not shift_thay.is_active:
            raise ConflictException(
                f"Bác sĩ thay thế {bs_thay.nguoi_dung.ho_ten} không có ca trực đang hoạt động trong ca {shift_goc.ca_lam_viec} ngày {shift_goc.ngay_lam_viec}!"
            )

        stmt_ve_cho = (
            select(HangDoiKham)
            .where(
                HangDoiKham.bac_si_id == shift_goc.bac_si_id,
                HangDoiKham.ngay_kham == shift_goc.ngay_lam_viec,
                HangDoiKham.ca_kham == shift_goc.ca_lam_viec,
                HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
            )
            .order_by(HangDoiKham.thoi_gian_check_in.asc())
            .with_for_update()
        )
        ve_cho_list = (await db.execute(stmt_ve_cho)).scalars().all()

        stmt_count_thay = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == bs_thay.id,
            HangDoiKham.ngay_kham == shift_goc.ngay_lam_viec,
            HangDoiKham.ca_kham == shift_goc.ca_lam_viec,
            HangDoiKham.trang_thai.in_(
                [
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.DANG_KHAM.value,
                    TrangThaiHangDoiEnum.DA_KHAM.value,
                ]
            ),
        )
        so_hien_tai = (await db.execute(stmt_count_thay)).scalar() or 0
        if so_hien_tai + len(ve_cho_list) > shift_thay.gioi_han_ca_kham:
            raise ConflictException(
                f"Bác sĩ thay thế {bs_thay.nguoi_dung.ho_ten} sẽ bị quá tải! "
                f"Hiện tại: {so_hien_tai}, Cần chuyển: {len(ve_cho_list)}, Giới hạn ca: {shift_thay.gioi_han_ca_kham}."
            )

        stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
            HangDoiKham.bac_si_id == bs_thay.id,
            HangDoiKham.ngay_kham == shift_goc.ngay_lam_viec,
            HangDoiKham.ca_kham == shift_goc.ca_lam_viec,
        )
        curr_max_stt = (await db.execute(stmt_max_stt)).scalar() or 0
        ten_goc = shift_goc.bac_si.nguoi_dung.ho_ten
        ten_moi = bs_thay.nguoi_dung.ho_ten

        for ve in ve_cho_list:
            curr_max_stt += 1
            ve.bac_si_id = bs_thay.id
            ve.so_thu_tu_kham = curr_max_stt
            ve.ghi_chu_dieu_phoi = f"Điều phối từ BS {ten_goc} sang BS {ten_moi} do nghỉ đột xuất"
            if ve.lich_kham_id:
                lk_item = await db.get(LichKham, ve.lich_kham_id)
                if lk_item:
                    lk_item.bac_si_id = bs_thay.id

        stmt_dang_kham = (
            select(HangDoiKham)
            .where(
                HangDoiKham.bac_si_id == shift_goc.bac_si_id,
                HangDoiKham.ngay_kham == shift_goc.ngay_lam_viec,
                HangDoiKham.ca_kham == shift_goc.ca_lam_viec,
                HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value,
            )
            .with_for_update()
        )
        dang_kham_list = (await db.execute(stmt_dang_kham)).scalars().all()
        for ve_dang in dang_kham_list:
            ve_dang.bac_si_id = bs_thay.id
            ve_dang.ghi_chu_dieu_phoi = f"BS {ten_moi} tiếp quản do BS {ten_goc} nghỉ đột xuất"
            if ve_dang.lich_kham_id:
                lk = await db.get(LichKham, ve_dang.lich_kham_id)
                if lk:
                    lk.bac_si_id = bs_thay.id
                luot = (
                    await db.execute(select(LuotKham).where(LuotKham.lich_kham_id == ve_dang.lich_kham_id))
                ).scalar_one_or_none()
                if luot:
                    luot.tiep_quan_boi_id = bs_thay.id
                    luot.ly_do_tiep_quan = f"Bàn giao ca do BS {ten_goc} nghỉ đột xuất"

        stmt_lich_chua_den = (
            select(LichKham)
            .where(
                LichKham.bac_si_id == shift_goc.bac_si_id,
                LichKham.ngay_kham == shift_goc.ngay_lam_viec,
                LichKham.gio_kham >= shift_goc.gio_bat_dau,
                LichKham.gio_kham < shift_goc.gio_ket_thuc,
                LichKham.trang_thai.in_(
                    [
                        TrangThaiLichEnum.CHO_XAC_NHAN.value,
                        TrangThaiLichEnum.DA_XAC_NHAN.value,
                    ]
                ),
            )
            .with_for_update()
        )
        lich_chua_den_list = (await db.execute(stmt_lich_chua_den)).scalars().all()
        for lk_cd in lich_chua_den_list:
            lk_cd.bac_si_id = bs_thay.id

        await db.commit()
        logger.info(
            f"✅ [QUEUE REASSIGNED] Shift: {shift_id} | Chuyển từ BS {shift_goc.bac_si_id} sang BS {bs_thay.id} | "
            f"Vé chờ: {len(ve_cho_list)}, Đang khám: {len(dang_kham_list)}, Lịch hẹn: {len(lich_chua_den_list)}"
        )
        return ReassignQueueResponse(
            lich_lam_viec_id=shift_id,
            bac_si_goc_id=shift_goc.bac_si_id,
            ten_bac_si_goc=ten_goc,
            bac_si_thay_the_id=bs_thay.id,
            ten_bac_si_thay_the=ten_moi,
            so_ve_cho_kham_da_chuyen=len(ve_cho_list),
            so_ve_dang_kham_ban_giao=len(dang_kham_list),
            so_lich_chua_checkin_da_chuyen=len(lich_chua_den_list),
            ghi_chu=f"Đã điều phối thành công sang Bác sĩ {ten_moi}",
        )

    async def postpone_and_cancel_unassigned(
        self, shift_id: int, admin_user: TaiKhoan, db: AsyncSession
    ) -> PostponeAndCancelResponse:
        stmt = select(LichLamViec).where(LichLamViec.id == shift_id).with_for_update()
        shift = (await db.execute(stmt)).scalar_one_or_none()
        if not shift:
            raise NotFoundException(f"Không tìm thấy ca làm việc với ID {shift_id}!")
        if shift.is_active:
            raise ConflictException("Ca làm việc này chưa được khai báo nghỉ đột xuất!")

        stmt_ve_cho = (
            select(HangDoiKham)
            .where(
                HangDoiKham.bac_si_id == shift.bac_si_id,
                HangDoiKham.ngay_kham == shift.ngay_lam_viec,
                HangDoiKham.ca_kham == shift.ca_lam_viec,
                HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
            )
            .with_for_update()
        )
        ve_cho_list = (await db.execute(stmt_ve_cho)).scalars().all()
        for ve in ve_cho_list:
            ve.trang_thai = TrangThaiHangDoiEnum.TAM_HOAN.value
            ve.ghi_chu_dieu_phoi = "Tạm hoãn do Bác sĩ nghỉ đột xuất không có người trực thay thế"

        stmt_lich = (
            select(LichKham)
            .where(
                LichKham.bac_si_id == shift.bac_si_id,
                LichKham.ngay_kham == shift.ngay_lam_viec,
                LichKham.gio_kham >= shift.gio_bat_dau,
                LichKham.gio_kham < shift.gio_ket_thuc,
                LichKham.trang_thai.in_(
                    [
                        TrangThaiLichEnum.CHO_XAC_NHAN.value,
                        TrangThaiLichEnum.DA_XAC_NHAN.value,
                    ]
                ),
            )
            .with_for_update()
        )
        lich_list = (await db.execute(stmt_lich)).scalars().all()
        for lk in lich_list:
            lk.trang_thai = TrangThaiLichEnum.TU_DONG_HUY.value
            lk.ghi_chu = "Phòng khám hủy do Bác sĩ nghỉ đột xuất (Bảo lưu điểm tín nhiệm)"

        await db.commit()
        logger.warning(
            f"⚠️ [QUEUE POSTPONED & CANCELLED] Shift: {shift_id} | Vé tạm hoãn: {len(ve_cho_list)} | Lịch hủy: {len(lich_list)}"
        )
        return PostponeAndCancelResponse(
            lich_lam_viec_id=shift_id,
            bac_si_id=shift.bac_si_id,
            so_ve_tam_hoan=len(ve_cho_list),
            so_lich_da_huy=len(lich_list),
            ghi_chu="Đã tạm hoãn hàng đợi và hủy lịch hẹn an toàn (No-fault cancellation)",
        )
