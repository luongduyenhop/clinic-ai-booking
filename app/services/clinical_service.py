import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException
from app.models.appointment import LichKham, TrangThaiLichEnum, CANCELLED_STATUSES
from app.models.medical import LuotKham, ChanDoan, ChiDinh, DichVu
from app.models.user import TaiKhoan, BacSi, BenhNhan, VaiTroEnum
from app.schemas.clinical import (
    EncounterCreateRequest,
    EncounterCompleteRequest,
    EncounterResponse,
    DiagnosisCreateRequest,
    DiagnosisResponse,
    OrderCreateRequest,
    OrderResponse,
)

logger = logging.getLogger(__name__)


class ClinicalService:
    """Nghiệp vụ Phân hệ Khám lâm sàng & Bệnh án điện tử EMR (OpenMRS Encounter Pattern - Package D)"""

    async def _get_doctor_from_user(self, user: TaiKhoan, db: AsyncSession) -> BacSi:
        """Kiểm tra RBAC và lấy thông tin bác sĩ từ tài khoản đăng nhập"""
        if user.vai_tro not in (VaiTroEnum.BAC_SI.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng khám bệnh lâm sàng chỉ dành riêng cho Bác sĩ!")

        stmt = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
        bac_si = (await db.execute(stmt)).scalar_one_or_none()
        if not bac_si:
            raise ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bác sĩ hợp lệ!")
        return bac_si

    async def _get_encounter_with_relations(
        self,
        encounter_id: int,
        db: AsyncSession,
        for_update: bool = False
    ) -> Optional[LuotKham]:
        """Truy vấn thực thể LuotKham cùng danh sách quan hệ con qua eager-loading tránh lỗi MissingGreenlet"""
        stmt = (
            select(LuotKham)
            .options(
                selectinload(LuotKham.danh_sach_chan_doan),
                selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu)
            )
            .where(LuotKham.id == encounter_id)
        )
        if for_update:
            stmt = stmt.with_for_update()
        return (await db.execute(stmt)).scalar_one_or_none()

    def _to_encounter_response(self, lk: LuotKham) -> EncounterResponse:
        """Ánh xạ entity LuotKham sang EncounterResponse DTO"""
        diagnoses = [
            DiagnosisResponse(
                id=cd.id,
                luot_kham_id=cd.luot_kham_id,
                ma_icd10=cd.ma_icd10,
                ten_benh_chan_doan=cd.ten_benh_chan_doan,
                loai_chan_doan=cd.loai_chan_doan,
                ghi_chu_chuyen_mon=cd.ghi_chu_chuyen_mon,
                created_at=cd.created_at
            )
            for cd in (lk.danh_sach_chan_doan or [])
        ]
        orders = [
            OrderResponse(
                id=order.id,
                luot_kham_id=order.luot_kham_id,
                dich_vu_id=order.dich_vu_id,
                ten_dich_vu=order.dich_vu.ten_dich_vu if order.dich_vu else None,
                so_luong=order.so_luong,
                don_gia_tai_thoi_diem=float(order.don_gia_tai_thoi_diem),
                trang_thai=order.trang_thai,
                bac_si_chi_dinh_id=order.bac_si_chi_dinh_id,
                ket_qua_chi_tiet=order.ket_qua_chi_tiet,
                tep_dinh_kem_url=order.tep_dinh_kem_url,
                thoi_gian_tra_ket_qua=order.thoi_gian_tra_ket_qua,
                created_at=order.created_at
            )
            for order in (lk.danh_sach_chi_dinh or [])
        ]
        return EncounterResponse(
            id=lk.id,
            lich_kham_id=lk.lich_kham_id,
            bac_si_id=lk.bac_si_id,
            benh_nhan_id=lk.benh_nhan_id,
            thoi_gian_bat_dau=lk.thoi_gian_bat_dau,
            thoi_gian_ket_thuc=lk.thoi_gian_ket_thuc,
            ly_do_vao_kham=lk.ly_do_vao_kham,
            benh_su=lk.benh_su,
            mach_lan_phut=lk.mach_lan_phut,
            nhiet_do_c=float(lk.nhiet_do_c) if lk.nhiet_do_c is not None else None,
            huyet_ap_tam_thu=lk.huyet_ap_tam_thu,
            huyet_ap_tam_truong=lk.huyet_ap_tam_truong,
            nhip_tho_lan_phut=lk.nhip_tho_lan_phut,
            can_nang_kg=float(lk.can_nang_kg) if lk.can_nang_kg is not None else None,
            chieu_cao_cm=float(lk.chieu_cao_cm) if lk.chieu_cao_cm is not None else None,
            kham_lam_sang_bo_phan=lk.kham_lam_sang_bo_phan,
            ket_luan_dieu_tri=lk.ket_luan_dieu_tri,
            loi_dan_bac_si=lk.loi_dan_bac_si,
            ngay_hen_tai_kham=lk.ngay_hen_tai_kham,
            is_locked=lk.is_locked,
            thoi_gian_khoa=lk.thoi_gian_khoa,
            danh_sach_chan_doan=diagnoses,
            danh_sach_chi_dinh=orders
        )

    async def start_encounter(
        self,
        payload: EncounterCreateRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> EncounterResponse:
        """Bác sĩ tiếp nhận bệnh nhân và khởi tạo lượt khám lâm sàng thực tế (OpenMRS Encounter)"""
        bac_si = await self._get_doctor_from_user(user, db)

        # 1. Kiểm tra lịch hẹn tồn tại và thuộc phụ trách của bác sĩ
        stmt_lich = select(LichKham).where(LichKham.id == payload.lich_kham_id)
        lich_kham = (await db.execute(stmt_lich)).scalar_one_or_none()
        if not lich_kham:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn khám!")

        if lich_kham.bac_si_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bạn chỉ có thể thực hiện ca khám cho lịch hẹn thuộc phụ trách của mình!")

        if lich_kham.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Không thể bắt đầu ca khám cho lịch hẹn đã bị hủy!")

        # 2. Đảm bảo 1 lịch hẹn chỉ có 1 lượt khám thực tế
        stmt_existing = select(LuotKham).where(LuotKham.lich_kham_id == payload.lich_kham_id)
        existing_encounter = (await db.execute(stmt_existing)).scalar_one_or_none()
        if existing_encounter:
            raise ConflictException("Lịch hẹn này đã được tạo lượt khám trước đó!")

        # 3. Tạo bản ghi LuotKham mới
        luot_kham = LuotKham(
            lich_kham_id=lich_kham.id,
            bac_si_id=bac_si.id,
            benh_nhan_id=lich_kham.benh_nhan_id,
            thoi_gian_bat_dau=datetime.now(timezone.utc),
            ly_do_vao_kham=payload.ly_do_vao_kham or lich_kham.ly_do_kham,
            benh_su=payload.benh_su or lich_kham.trieu_chung_ban_dau,
            mach_lan_phut=payload.mach_lan_phut,
            nhiet_do_c=payload.nhiet_do_c,
            huyet_ap_tam_thu=payload.huyet_ap_tam_thu,
            huyet_ap_tam_truong=payload.huyet_ap_tam_truong,
            nhip_tho_lan_phut=payload.nhip_tho_lan_phut,
            can_nang_kg=payload.can_nang_kg,
            chieu_cao_cm=payload.chieu_cao_cm,
            kham_lam_sang_bo_phan=payload.kham_lam_sang_bo_phan,
            is_locked=False
        )
        db.add(luot_kham)

        # Cập nhật trạng thái lịch hẹn sang Đang khám
        lich_kham.trang_thai = TrangThaiLichEnum.DANG_KHAM.value

        await db.commit()

        # Nạp lại thực thể cùng quan hệ đầy đủ qua selectinload
        encounter = await self._get_encounter_with_relations(luot_kham.id, db)
        if not encounter:
            raise NotFoundException("Lỗi không tìm thấy lượt khám vừa khởi tạo!")

        logger.info(f"🩺 [ENCOUNTER STARTED] ID: {encounter.id} | Bác sĩ: {bac_si.id} | Lịch hẹn: {lich_kham.id}")
        return self._to_encounter_response(encounter)

    async def get_encounter_detail(
        self,
        encounter_id: int,
        user: TaiKhoan,
        db: AsyncSession
    ) -> EncounterResponse:
        """Tra cứu chi tiết lượt khám lâm sàng kèm chẩn đoán và chỉ định cận lâm sàng"""
        luot_kham = await self._get_encounter_with_relations(encounter_id, db)
        if not luot_kham:
            raise NotFoundException("Không tìm thấy thông tin lượt khám!")

        # Phân quyền: Bệnh nhân chỉ xem bệnh án của mình, Bác sĩ chỉ xem bệnh án mình phụ trách, Admin xem tất cả
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
            benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
            if not benh_nhan or luot_kham.benh_nhan_id != benh_nhan.id:
                raise ForbiddenException("Bạn không có quyền xem hồ sơ bệnh án của người khác!")
        elif user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
            if not bac_si or (luot_kham.bac_si_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value):
                raise ForbiddenException("Bạn chỉ có quyền xem bệnh án do mình phụ trách!")

        return self._to_encounter_response(luot_kham)

    async def add_diagnosis(
        self,
        encounter_id: int,
        payload: DiagnosisCreateRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> DiagnosisResponse:
        """Thêm kết luận chẩn đoán bệnh theo chuẩn mã quốc tế WHO ICD-10"""
        bac_si = await self._get_doctor_from_user(user, db)

        stmt = select(LuotKham).where(LuotKham.id == encounter_id)
        luot_kham = (await db.execute(stmt)).scalar_one_or_none()
        if not luot_kham:
            raise NotFoundException("Không tìm thấy thông tin lượt khám!")

        if luot_kham.bac_si_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bạn không có quyền thêm chẩn đoán cho ca khám của bác sĩ khác!")

        # Ràng buộc Thông tư 32/2023/TT-BYT: Bệnh án đã khóa là Read-only, chống sửa hồi tố
        if luot_kham.is_locked:
            raise ConflictException(
                "Hồ sơ bệnh án đã hoàn tất và bị khóa (Read-only theo TT 32/2023/TT-BYT), không thể bổ sung chẩn đoán!"
            )

        chan_doan = ChanDoan(
            luot_kham_id=encounter_id,
            ma_icd10=payload.ma_icd10.strip().upper(),
            ten_benh_chan_doan=payload.ten_benh_chan_doan.strip(),
            loai_chan_doan=payload.loai_chan_doan,
            ghi_chu_chuyen_mon=payload.ghi_chu_chuyen_mon
        )
        db.add(chan_doan)
        await db.commit()
        await db.refresh(chan_doan)

        logger.info(f"📋 [DIAGNOSIS ADDED] Encounter: {encounter_id} | ICD-10: {chan_doan.ma_icd10}")
        return DiagnosisResponse(
            id=chan_doan.id,
            luot_kham_id=chan_doan.luot_kham_id,
            ma_icd10=chan_doan.ma_icd10,
            ten_benh_chan_doan=chan_doan.ten_benh_chan_doan,
            loai_chan_doan=chan_doan.loai_chan_doan,
            ghi_chu_chuyen_mon=chan_doan.ghi_chu_chuyen_mon,
            created_at=chan_doan.created_at
        )

    async def add_order(
        self,
        encounter_id: int,
        payload: OrderCreateRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> OrderResponse:
        """Kê y lệnh chỉ định dịch vụ cận lâm sàng (xét nghiệm, X-quang, siêu âm)"""
        bac_si = await self._get_doctor_from_user(user, db)

        stmt = select(LuotKham).where(LuotKham.id == encounter_id)
        luot_kham = (await db.execute(stmt)).scalar_one_or_none()
        if not luot_kham:
            raise NotFoundException("Không tìm thấy thông tin lượt khám!")

        if luot_kham.bac_si_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bạn không có quyền ra chỉ định cho ca khám của bác sĩ khác!")

        if luot_kham.is_locked:
            raise ConflictException("Hồ sơ bệnh án đã bị khóa, không thể kê thêm chỉ định dịch vụ!")

        # Kiểm tra dịch vụ có tồn tại và đang hoạt động không
        stmt_dv = select(DichVu).where(DichVu.id == payload.dich_vu_id)
        dich_vu = (await db.execute(stmt_dv)).scalar_one_or_none()
        if not dich_vu or not dich_vu.is_active:
            raise NotFoundException("Dịch vụ cận lâm sàng không tồn tại hoặc đã tạm dừng cung cấp!")

        chi_dinh = ChiDinh(
            luot_kham_id=encounter_id,
            dich_vu_id=dich_vu.id,
            so_luong=payload.so_luong,
            don_gia_tai_thoi_diem=float(dich_vu.don_gia),
            trang_thai="da_chi_dinh",
            bac_si_chi_dinh_id=bac_si.id
        )
        db.add(chi_dinh)
        await db.commit()
        await db.refresh(chi_dinh)

        logger.info(f"🧪 [ORDER CREATED] Encounter: {encounter_id} | Dịch vụ: {dich_vu.ten_dich_vu}")
        return OrderResponse(
            id=chi_dinh.id,
            luot_kham_id=chi_dinh.luot_kham_id,
            dich_vu_id=chi_dinh.dich_vu_id,
            ten_dich_vu=dich_vu.ten_dich_vu,
            so_luong=chi_dinh.so_luong,
            don_gia_tai_thoi_diem=float(chi_dinh.don_gia_tai_thoi_diem),
            trang_thai=chi_dinh.trang_thai,
            bac_si_chi_dinh_id=chi_dinh.bac_si_chi_dinh_id,
            created_at=chi_dinh.created_at
        )

    async def complete_encounter(
        self,
        encounter_id: int,
        payload: EncounterCompleteRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> EncounterResponse:
        """Hoàn tất ca khám và khóa vĩnh viễn hồ sơ bệnh án thành Read-only (Thông tư 32/2023/TT-BYT)"""
        bac_si = await self._get_doctor_from_user(user, db)

        luot_kham = await self._get_encounter_with_relations(encounter_id, db, for_update=True)
        if not luot_kham:
            raise NotFoundException("Không tìm thấy thông tin lượt khám!")

        if luot_kham.bac_si_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bạn chỉ có quyền hoàn tất ca khám do mình phụ trách!")

        if luot_kham.is_locked:
            raise ConflictException("Hồ sơ bệnh án này đã được hoàn tất và khóa trước đó!")

        # Cập nhật kết luận điều trị và khóa hồ sơ
        now = datetime.now(timezone.utc)
        luot_kham.ket_luan_dieu_tri = payload.ket_luan_dieu_tri
        luot_kham.loi_dan_bac_si = payload.loi_dan_bac_si
        luot_kham.ngay_hen_tai_kham = payload.ngay_hen_tai_kham
        luot_kham.thoi_gian_ket_thuc = now
        luot_kham.is_locked = True
        luot_kham.thoi_gian_khoa = now

        # Đồng bộ trạng thái lịch khám sang Đã khám
        stmt_lich = select(LichKham).where(LichKham.id == luot_kham.lich_kham_id)
        lich_kham = (await db.execute(stmt_lich)).scalar_one_or_none()
        if lich_kham:
            lich_kham.trang_thai = TrangThaiLichEnum.DA_KHAM.value

        await db.commit()

        # Nạp lại dữ liệu sau khi commit
        encounter = await self._get_encounter_with_relations(luot_kham.id, db)
        if not encounter:
            raise NotFoundException("Lỗi không tìm thấy lượt khám sau khi hoàn tất!")

        logger.info(f"🔒 [ENCOUNTER LOCKED] ID: {encounter.id} | Bác sĩ: {bac_si.id} đã khóa hồ sơ bệnh án thành công.")
        return self._to_encounter_response(encounter)


clinical_service = ClinicalService()
