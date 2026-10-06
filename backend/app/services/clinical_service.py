import logging
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, UnprocessableEntityException
from app.models.appointment import LichKham, TrangThaiLichEnum, CANCELLED_STATUSES, HangDoiKham, TrangThaiHangDoiEnum
from app.models.medical import (
    LuotKham,
    ChanDoan,
    ChiDinh,
    DichVu,
    KhaiNiem,
    DonThuoc,
    ChiTietDonThuoc,
    BienBanDinhChinh,
    AmendmentStatus,
)
from app.models.user import TaiKhoan, BacSi, BenhNhan, VaiTroEnum
from app.schemas.clinical import (
    EncounterCreateRequest,
    EncounterCompleteRequest,
    EncounterResponse,
    DiagnosisCreateRequest,
    DiagnosisResponse,
    OrderCreateRequest,
    OrderResponse,
    OrderResultUpdateRequest,
    PrescriptionCreateRequest,
    PrescriptionResponse,
    PrescriptionItemResponse,
    AmendmentCreateRequest,
    AmendmentResponse,
    AmendmentApproveRequest,
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

    @staticmethod
    def _assert_completion_diagnosis_invariant(luot_kham: LuotKham) -> None:
        """INV_DIAG: lượt khám chỉ được hoàn tất khi có đúng 1 chẩn đoán chính kèm mã ICD-10 không rỗng.
        Đồng bộ, không query: danh_sach_chan_doan đã được selectinload trong _get_encounter_with_relations."""
        primary_diagnoses = [
            diagnosis
            for diagnosis in luot_kham.danh_sach_chan_doan
            if diagnosis.loai_chan_doan == "chinh"
        ]

        if len(primary_diagnoses) != 1:
            raise UnprocessableEntityException(
                "Không thể hoàn tất lượt khám: cần có đúng một chẩn đoán chính."
            )

        if not (primary_diagnoses[0].ma_icd10 or "").strip():
            raise UnprocessableEntityException(
                "Không thể hoàn tất lượt khám: chẩn đoán chính phải có mã ICD-10."
            )

    async def _find_icd10_concept(self, ma_icd10: str, db: AsyncSession) -> Optional[KhaiNiem]:
        """Tra từ điển ICD-10: ưu tiên khớp đúng mã, không có thì lùi về nhóm bệnh cha (K29.7 -> K29)"""
        candidates = [ma_icd10]
        if "." in ma_icd10:
            candidates.append(ma_icd10.split(".", 1)[0])
        stmt = select(KhaiNiem).where(
            KhaiNiem.ma_khai_niem.in_(candidates),
            KhaiNiem.loai_khai_niem == "benh_icd10",
            KhaiNiem.is_active.is_(True)
        )
        concepts = {kn.ma_khai_niem: kn for kn in (await db.execute(stmt)).scalars().all()}
        return next((concepts[ma] for ma in candidates if ma in concepts), None)

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
                selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
                selectinload(LuotKham.don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet)
            )
            .where(LuotKham.id == encounter_id)
        )
        if for_update:
            stmt = stmt.with_for_update()
        return (await db.execute(stmt)).scalar_one_or_none()

    def _to_prescription_response(self, dt: DonThuoc) -> PrescriptionResponse:
        """Ánh xạ entity DonThuoc sang PrescriptionResponse DTO"""
        return PrescriptionResponse(
            id=dt.id,
            luot_kham_id=dt.luot_kham_id,
            bac_si_ke_don_id=dt.bac_si_ke_don_id,
            ngay_ke_don=dt.ngay_ke_don,
            loi_dan_uong_thuoc=dt.loi_dan_uong_thuoc,
            ghi_chu_duoc_lam_sang=dt.ghi_chu_duoc_lam_sang,
            danh_sach_chi_tiet=[
                PrescriptionItemResponse(
                    id=item.id,
                    don_thuoc_id=item.don_thuoc_id,
                    ten_thuoc=item.ten_thuoc,
                    hoat_chat=item.hoat_chat,
                    ham_luong=item.ham_luong,
                    don_vi_tinh=item.don_vi_tinh,
                    so_luong=item.so_luong,
                    cach_dung=item.cach_dung,
                    so_ngay_dung=item.so_ngay_dung,
                    ghi_chu=item.ghi_chu
                )
                for item in (dt.danh_sach_chi_tiet or [])
            ],
            created_at=dt.created_at
        )

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
                ket_qua_phan_loai=order.ket_qua_phan_loai or "BINH_THUONG",
                created_at=order.created_at
            )
            for order in (lk.danh_sach_chi_dinh or [])
        ]
        prescription_dto = self._to_prescription_response(lk.don_thuoc) if lk.don_thuoc else None
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
            nguoi_khoa_id=lk.nguoi_khoa_id,
            danh_sach_chan_doan=diagnoses,
            danh_sach_chi_dinh=orders,
            don_thuoc=prescription_dto
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
            if not bac_si or (luot_kham.bac_si_id != bac_si.id and luot_kham.tiep_quan_boi_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value):
                raise ForbiddenException("Bạn chỉ có quyền xem bệnh án do mình phụ trách hoặc tiếp quản!")

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

        stmt = select(LuotKham).where(LuotKham.id == encounter_id).with_for_update()
        luot_kham = (await db.execute(stmt)).scalar_one_or_none()
        if not luot_kham:
            raise NotFoundException("Không tìm thấy thông tin lượt khám!")

        if luot_kham.bac_si_id != bac_si.id and luot_kham.tiep_quan_boi_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bạn không có quyền thêm chẩn đoán cho ca khám của bác sĩ khác!")

        # Ràng buộc Thông tư 32/2023/TT-BYT: Bệnh án đã khóa là Read-only, chống sửa hồi tố
        if luot_kham.is_locked:
            logger.warning(
                f"🔒 [AUDIT - ATTEMPTED_WRITE_ON_LOCKED] action=ADD_DIAGNOSIS encounter_id={encounter_id} user_id={user.id}"
            )
            raise ConflictException(
                "Hồ sơ bệnh án đã hoàn tất và bị khóa (Read-only theo TT 32/2023/TT-BYT), không thể bổ sung chẩn đoán!"
            )

        # Concept Dictionary (OpenMRS): liên kết mã chẩn đoán với từ điển ICD-10 nếu có. Từ điển mới seed vài nhóm bệnh
        # nên không bắt buộc mã phải có sẵn (định dạng đã kiểm ở schema); mã con (K29.7) gắn về nhóm cha (K29)
        khai_niem = await self._find_icd10_concept(payload.ma_icd10, db)
        ten_benh = payload.ten_benh_chan_doan or (khai_niem.ten_khai_niem if khai_niem else None)
        if not ten_benh:
            raise UnprocessableEntityException(
                f"Mã ICD-10 '{payload.ma_icd10}' chưa có trong danh mục bệnh chuẩn, vui lòng nhập tên bệnh chẩn đoán!"
            )

        chan_doan = ChanDoan(
            luot_kham_id=encounter_id,
            khai_niem_id=khai_niem.id if khai_niem else None,
            ma_icd10=payload.ma_icd10,
            # Bác sĩ có thể ghi tên chi tiết hơn; bỏ trống thì lấy tên chuẩn trong từ điển để bệnh án luôn có tên bệnh
            ten_benh_chan_doan=ten_benh,
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

        stmt = select(LuotKham).where(LuotKham.id == encounter_id).with_for_update()
        luot_kham = (await db.execute(stmt)).scalar_one_or_none()
        if not luot_kham:
            raise NotFoundException("Không tìm thấy thông tin lượt khám!")

        if luot_kham.bac_si_id != bac_si.id and luot_kham.tiep_quan_boi_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bạn không có quyền ra chỉ định cho ca khám của bác sĩ khác!")

        if luot_kham.is_locked:
            logger.warning(
                f"🔒 [AUDIT - ATTEMPTED_WRITE_ON_LOCKED] action=ADD_ORDER encounter_id={encounter_id} user_id={user.id}"
            )
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
            ket_qua_phan_loai=chi_dinh.ket_qua_phan_loai or "BINH_THUONG",
            created_at=chi_dinh.created_at
        )

    async def update_order_result(
        self,
        order_id: int,
        payload: OrderResultUpdateRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> OrderResponse:
        """Cập nhật kết quả chỉ định cận lâm sàng (Lab/Imaging Result)"""
        stmt = (
            select(ChiDinh)
            .options(selectinload(ChiDinh.luot_kham), selectinload(ChiDinh.dich_vu))
            .where(ChiDinh.id == order_id)
            .with_for_update()
        )
        chi_dinh = (await db.execute(stmt)).scalar_one_or_none()
        if not chi_dinh:
            raise NotFoundException("Không tìm thấy y lệnh chỉ định cận lâm sàng!")

        luot_kham = chi_dinh.luot_kham
        if luot_kham and luot_kham.is_locked:
            # Mô hình B: Nếu chỉ định này đã có kết quả từ trước -> Cấm sửa đổi hồi tố trực tiếp (bắt buộc qua Four-Eyes Amendment)
            if chi_dinh.trang_thai == "da_co_ket_qua":
                logger.warning(
                    f"🔒 [AUDIT - ATTEMPTED_OVERWRITE_RESULT_ON_LOCKED_ENCOUNTER] order_id={order_id} encounter_id={luot_kham.id} user_id={user.id}"
                )
                raise ConflictException(
                    "Kết quả cận lâm sàng của hồ sơ đã khóa không thể sửa đổi trực tiếp. Vui lòng lập biên bản đính chính (Four-Eyes Amendment)!"
                )
            # Ngược lại, nếu đây là chỉ định treo (chưa có kết quả) được trả muộn sau khi bác sĩ đã khóa phần khám lâm sàng:
            # Cho phép nhân viên CLS hoàn tất kết quả lần đầu kèm ghi vết kiểm toán (Audit Trail)
            logger.info(
                f"📥 [AUDIT - LATE_RESULT_FULFILLMENT_ON_LOCKED_ENCOUNTER] order_id={order_id} encounter_id={luot_kham.id} tech_user_id={user.id}"
            )

        if chi_dinh.trang_thai == "da_huy":
            raise ConflictException("Y lệnh cận lâm sàng này đã bị hủy, không thể nhập kết quả!")

        # Cập nhật kết quả: ép trạng thái sang da_co_ket_qua khi có nội dung kết quả
        chi_dinh.ket_qua_chi_tiet = payload.ket_qua_chi_tiet
        chi_dinh.tep_dinh_kem_url = payload.tep_dinh_kem_url
        chi_dinh.thoi_gian_tra_ket_qua = payload.thoi_gian_tra_ket_qua or datetime.now(timezone.utc)
        chi_dinh.ket_qua_phan_loai = payload.ket_qua_phan_loai or "BINH_THUONG"
        chi_dinh.trang_thai = payload.trang_thai or "da_co_ket_qua"

        await db.commit()
        await db.refresh(chi_dinh)

        logger.info(
            f"🧪 [AUDIT - UPDATE_ORDER_RESULT] order_id={order_id} encounter_id={chi_dinh.luot_kham_id} user_id={user.id}"
        )

        return OrderResponse(
            id=chi_dinh.id,
            luot_kham_id=chi_dinh.luot_kham_id,
            dich_vu_id=chi_dinh.dich_vu_id,
            ten_dich_vu=chi_dinh.dich_vu.ten_dich_vu if chi_dinh.dich_vu else None,
            so_luong=chi_dinh.so_luong,
            don_gia_tai_thoi_diem=float(chi_dinh.don_gia_tai_thoi_diem),
            trang_thai=chi_dinh.trang_thai,
            bac_si_chi_dinh_id=chi_dinh.bac_si_chi_dinh_id,
            ket_qua_chi_tiet=chi_dinh.ket_qua_chi_tiet,
            tep_dinh_kem_url=chi_dinh.tep_dinh_kem_url,
            thoi_gian_tra_ket_qua=chi_dinh.thoi_gian_tra_ket_qua,
            ket_qua_phan_loai=chi_dinh.ket_qua_phan_loai or "BINH_THUONG",
            created_at=chi_dinh.created_at
        )

    async def get_encounter_orders(
        self,
        encounter_id: int,
        user: TaiKhoan,
        db: AsyncSession
    ) -> List[OrderResponse]:
        """Lấy danh sách y lệnh chỉ định cận lâm sàng kèm kết quả của lượt khám"""
        stmt = (
            select(ChiDinh)
            .options(selectinload(ChiDinh.dich_vu))
            .where(ChiDinh.luot_kham_id == encounter_id)
            .order_by(ChiDinh.id.asc())
        )
        orders = (await db.execute(stmt)).scalars().all()
        return [
            OrderResponse(
                id=o.id,
                luot_kham_id=o.luot_kham_id,
                dich_vu_id=o.dich_vu_id,
                ten_dich_vu=o.dich_vu.ten_dich_vu if o.dich_vu else None,
                so_luong=o.so_luong,
                don_gia_tai_thoi_diem=float(o.don_gia_tai_thoi_diem),
                trang_thai=o.trang_thai,
                bac_si_chi_dinh_id=o.bac_si_chi_dinh_id,
                ket_qua_chi_tiet=o.ket_qua_chi_tiet,
                tep_dinh_kem_url=o.tep_dinh_kem_url,
                thoi_gian_tra_ket_qua=o.thoi_gian_tra_ket_qua,
                ket_qua_phan_loai=o.ket_qua_phan_loai or "BINH_THUONG",
                created_at=o.created_at
            )
            for o in orders
        ]

    async def get_patient_encounters_history(
        self,
        patient_id: int,
        user: TaiKhoan,
        db: AsyncSession
    ) -> List[EncounterResponse]:
        """Tra cứu lịch sử bệnh án dài hạn (Longitudinal EMR Record) của bệnh nhân"""
        stmt = (
            select(LuotKham)
            .options(
                selectinload(LuotKham.danh_sach_chan_doan),
                selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
                selectinload(LuotKham.don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet)
            )
            .where(LuotKham.benh_nhan_id == patient_id)
            .order_by(LuotKham.thoi_gian_bat_dau.desc())
        )
        encounters = (await db.execute(stmt)).scalars().all()
        return [self._to_encounter_response(lk) for lk in encounters]

    async def get_my_encounters_history(
        self,
        user: TaiKhoan,
        db: AsyncSession
    ) -> List[EncounterResponse]:
        """Bệnh nhân tự tra cứu toàn bộ hồ sơ bệnh án các lần khám trước của chính mình"""
        stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.id)
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not benh_nhan:
            return []

        return await self.get_patient_encounters_history(benh_nhan.id, user, db)

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

        if luot_kham.bac_si_id != bac_si.id and luot_kham.tiep_quan_boi_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bạn chỉ có quyền hoàn tất ca khám do mình phụ trách hoặc tiếp quản!")

        if luot_kham.is_locked:
            raise ConflictException("Hồ sơ bệnh án này đã được hoàn tất và khóa trước đó!")

        # INV_DIAG: đặt SAU is_locked để hồ sơ đã khóa luôn trả 409 thay vì 422
        self._assert_completion_diagnosis_invariant(luot_kham)

        # Pha 1 (chỉ đọc + validate): khóa mọi vé hàng đợi của lịch trong cùng transaction,
        # sau LuotKham (global lock order). Hàng đợi chỉ là lớp điều phối; LuotKham là nguồn sự thật.
        tickets: list = []
        active_ticket = None
        if luot_kham.lich_kham_id is not None:
            stmt_queue = (
                select(HangDoiKham)
                .where(HangDoiKham.lich_kham_id == luot_kham.lich_kham_id)
                .with_for_update()
            )
            tickets = list((await db.execute(stmt_queue)).scalars().all())
            active_tickets = [
                t for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value
            ]
            if len(active_tickets) > 1:
                # Lỗi dữ liệu: không được chọn bừa một vé -> từ chối trước khi sửa bất cứ thứ gì
                raise ConflictException(
                    "Dữ liệu hàng đợi không nhất quán: lịch khám có nhiều vé đang khám. "
                    "Vui lòng liên hệ quản trị viên."
                )
            active_ticket = active_tickets[0] if active_tickets else None

        # Pha 2 (ghi): cập nhật kết luận điều trị, khóa hồ sơ, lịch khám và vé hàng đợi
        now = datetime.now(timezone.utc)
        luot_kham.ket_luan_dieu_tri = payload.ket_luan_dieu_tri
        luot_kham.loi_dan_bac_si = payload.loi_dan_bac_si
        luot_kham.ngay_hen_tai_kham = payload.ngay_hen_tai_kham
        luot_kham.thoi_gian_ket_thuc = now
        luot_kham.is_locked = True
        luot_kham.thoi_gian_khoa = now
        luot_kham.nguoi_khoa_id = user.nguoi_dung_id

        # Đồng bộ trạng thái lịch khám sang Đã khám
        stmt_lich = select(LichKham).where(LichKham.id == luot_kham.lich_kham_id)
        lich_kham = (await db.execute(stmt_lich)).scalar_one_or_none()
        if lich_kham:
            lich_kham.trang_thai = TrangThaiLichEnum.DA_KHAM.value

        # Chỉ DANG_KHAM -> DA_KHAM; các trạng thái vé khác không bị sửa
        if active_ticket is not None:
            active_ticket.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
            active_ticket.thoi_gian_ket_thuc = now
        else:
            logger.warning(
                f"[QUEUE_SYNC_SKIPPED] encounter_id={encounter_id} "
                f"lich_kham_id={luot_kham.lich_kham_id} "
                f"ticket_states={[t.trang_thai for t in tickets]}"
            )


        # Kiểm tra và ghi vết kiểm toán (Audit Trail) các chỉ định cận lâm sàng còn treo tại thời điểm khóa ca
        pending_orders = [
            cd for cd in (luot_kham.danh_sach_chi_dinh or [])
            if cd.trang_thai in ("da_chi_dinh", "dang_thuc_hien")
        ]
        if pending_orders:
            logger.warning(
                f"⚠️ [AUDIT - ENCOUNTER_COMPLETED_WITH_PENDING_ORDERS] "
                f"encounter_id={encounter_id} doctor_id={bac_si.id} "
                f"pending_count={len(pending_orders)} "
                f"pending_order_ids={[cd.id for cd in pending_orders]}"
            )

        await db.commit()

        # Nạp lại dữ liệu sau khi commit
        encounter = await self._get_encounter_with_relations(luot_kham.id, db)
        if not encounter:
            raise NotFoundException("Lỗi không tìm thấy lượt khám sau khi hoàn tất!")

        logger.info(f"🔒 [ENCOUNTER LOCKED] ID: {encounter.id} | Bác sĩ: {bac_si.id} (NguoiDung: {user.nguoi_dung_id}) đã khóa hồ sơ bệnh án thành công.")
        return self._to_encounter_response(encounter)

    async def create_prescription(
        self,
        encounter_id: int,
        payload: PrescriptionCreateRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> PrescriptionResponse:
        """Kê đơn thuốc ngoại trú gắn chặt vào lượt khám lâm sàng (OpenMRS Drug Order)"""
        bac_si = await self._get_doctor_from_user(user, db)

        luot_kham = await self._get_encounter_with_relations(encounter_id, db, for_update=True)
        if not luot_kham:
            raise NotFoundException(f"Không tìm thấy lượt khám với ID {encounter_id}!")

        if luot_kham.bac_si_id != bac_si.id and luot_kham.tiep_quan_boi_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bác sĩ không phụ trách hoặc tiếp quản ca khám này, không có quyền kê đơn thuốc!")

        if luot_kham.is_locked:
            logger.warning(
                f"🔒 [AUDIT - ATTEMPTED_WRITE_ON_LOCKED] action=CREATE_PRESCRIPTION encounter_id={encounter_id} user_id={user.id}"
            )
            raise ConflictException(
                "Hồ sơ bệnh án đã hoàn tất và bị khóa (Read-only theo TT 32/2023/TT-BYT), không thể kê thêm đơn thuốc!"
            )

        if luot_kham.don_thuoc:
            raise ConflictException(
                "Lượt khám này đã được kê đơn thuốc trước đó! Một ca khám chỉ có một đơn thuốc chính thức."
            )

        now = datetime.now(timezone.utc)
        don_thuoc = DonThuoc(
            luot_kham_id=encounter_id,
            bac_si_ke_don_id=bac_si.id,
            ngay_ke_don=now,
            loi_dan_uong_thuoc=payload.loi_dan_uong_thuoc,
            ghi_chu_duoc_lam_sang=payload.ghi_chu_duoc_lam_sang
        )
        db.add(don_thuoc)
        await db.flush()

        for item in payload.danh_sach_thuoc:
            chi_tiet = ChiTietDonThuoc(
                don_thuoc_id=don_thuoc.id,
                ten_thuoc=item.ten_thuoc,
                hoat_chat=item.hoat_chat,
                ham_luong=item.ham_luong,
                don_vi_tinh=item.don_vi_tinh,
                so_luong=item.so_luong,
                cach_dung=item.cach_dung,
                so_ngay_dung=item.so_ngay_dung,
                ghi_chu=item.ghi_chu
            )
            db.add(chi_tiet)

        await db.commit()

        # Nạp lại dữ liệu đơn thuốc kèm chi tiết thuốc
        stmt_dt = (
            select(DonThuoc)
            .options(selectinload(DonThuoc.danh_sach_chi_tiet))
            .where(DonThuoc.id == don_thuoc.id)
        )
        saved_dt = (await db.execute(stmt_dt)).scalar_one()

        logger.info(f"💊 [PRESCRIPTION CREATED] LuotKham: {encounter_id} | DonThuoc: {saved_dt.id} | Số loại thuốc: {len(payload.danh_sach_thuoc)}")
        return self._to_prescription_response(saved_dt)

    async def get_prescription(
        self,
        encounter_id: int,
        user: TaiKhoan,
        db: AsyncSession
    ) -> PrescriptionResponse:
        """Lấy thông tin đơn thuốc của một ca khám lâm sàng"""
        luot_kham = await self._get_encounter_with_relations(encounter_id, db)
        if not luot_kham:
            raise NotFoundException(f"Không tìm thấy lượt khám với ID {encounter_id}!")

        # Kiểm tra quyền xem: Admin, Bác sĩ phụ trách, hoặc Bệnh nhân sở hữu ca khám
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            stmt_bn = select(BenhNhan.id).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
            bn_id = (await db.execute(stmt_bn)).scalar_one_or_none()
            if luot_kham.benh_nhan_id != bn_id:
                raise ForbiddenException("Bạn không có quyền xem đơn thuốc của người bệnh khác!")
        elif user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi.id).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs_id = (await db.execute(stmt_bs)).scalar_one_or_none()
            if luot_kham.bac_si_id != bs_id and luot_kham.tiep_quan_boi_id != bs_id and user.vai_tro != VaiTroEnum.ADMIN.value:
                raise ForbiddenException("Bạn không phụ trách ca khám này!")

        if not luot_kham.don_thuoc:
            raise NotFoundException("Lượt khám này chưa có đơn thuốc nào được kê!")

        return self._to_prescription_response(luot_kham.don_thuoc)

    def _to_amendment_response(self, bb: BienBanDinhChinh) -> AmendmentResponse:
        """Ánh xạ entity BienBanDinhChinh sang AmendmentResponse DTO"""
        return AmendmentResponse(
            id=bb.id,
            luot_kham_id=bb.luot_kham_id,
            thuc_the_loai=bb.thuc_the_loai,
            thuc_the_id=bb.thuc_the_id,
            ly_do_ma=bb.ly_do_ma,
            ly_do_text=bb.ly_do_text,
            noi_dung_moi_json=bb.noi_dung_moi_json,
            requested_by_id=bb.requested_by_id,
            approved_by_id=bb.approved_by_id,
            approved_at=bb.approved_at,
            trang_thai=bb.trang_thai,
            ghi_chu=bb.ghi_chu,
            created_at=bb.created_at,
            updated_at=bb.updated_at,
        )

    async def request_amendment(
        self,
        encounter_id: int,
        payload: AmendmentCreateRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> AmendmentResponse:
        """Tạo yêu cầu đính chính bệnh án đã khóa (OpenMRS / FHIR Amendment Pattern)"""
        stmt = select(LuotKham).where(LuotKham.id == encounter_id).with_for_update()
        luot_kham = (await db.execute(stmt)).scalar_one_or_none()
        if not luot_kham:
            raise NotFoundException("Không tìm thấy thông tin lượt khám!")

        if not luot_kham.is_locked:
            raise ConflictException("Chỉ được tạo yêu cầu đính chính khi hồ sơ bệnh án đã hoàn tất và khóa!")

        # Kiểm tra quyền: Bác sĩ điều trị hoặc Admin mới có quyền tạo yêu cầu đính chính
        if user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi.id).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs_id = (await db.execute(stmt_bs)).scalar_one_or_none()
            if luot_kham.bac_si_id != bs_id and luot_kham.tiep_quan_boi_id != bs_id and user.vai_tro != VaiTroEnum.ADMIN.value:
                raise ForbiddenException("Bạn không có quyền yêu cầu đính chính trên ca khám của bác sĩ khác!")
        elif user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Chỉ Bác sĩ điều trị hoặc Admin mới có quyền tạo yêu cầu đính chính!")

        amendment = BienBanDinhChinh(
            luot_kham_id=encounter_id,
            thuc_the_loai=payload.thuc_the_loai,
            thuc_the_id=payload.thuc_the_id,
            ly_do_ma=payload.ly_do_ma,
            ly_do_text=payload.ly_do_text,
            noi_dung_moi_json=payload.noi_dung_moi_json,
            requested_by_id=user.nguoi_dung_id,
            trang_thai=AmendmentStatus.CHO_PHE_DUYET.value,
            ghi_chu=payload.ghi_chu
        )
        db.add(amendment)
        await db.commit()
        await db.refresh(amendment)

        logger.info(
            f"📝 [AMENDMENT REQUESTED] ID: {amendment.id} | LuotKham: {encounter_id} | Người yêu cầu: {user.nguoi_dung_id} | Loại: {payload.thuc_the_loai}"
        )
        return self._to_amendment_response(amendment)

    async def approve_amendment(
        self,
        amendment_id: int,
        payload: AmendmentApproveRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> AmendmentResponse:
        """Phê duyệt đính chính bệnh án tuân thủ Four-Eyes Principle"""
        stmt = select(BienBanDinhChinh).where(BienBanDinhChinh.id == amendment_id).with_for_update()
        amendment = (await db.execute(stmt)).scalar_one_or_none()
        if not amendment:
            raise NotFoundException("Không tìm thấy biên bản đính chính!")

        if amendment.trang_thai != AmendmentStatus.CHO_PHE_DUYET.value:
            raise ConflictException(f"Biên bản đính chính không ở trạng thái chờ phê duyệt (hiện tại: {amendment.trang_thai})!")

        # Phân quyền: Chỉ Admin hoặc Bác sĩ (trưởng khoa) mới có quyền duyệt
        if user.vai_tro not in [VaiTroEnum.ADMIN.value, VaiTroEnum.BAC_SI.value]:
            raise ForbiddenException("Bạn không có quyền phê duyệt biên bản đính chính chuyên môn!")

        # Four-Eyes Principle: Người duyệt không được là người yêu cầu
        if user.nguoi_dung_id == amendment.requested_by_id:
            logger.warning(
                f"🚨 [AUDIT - FOUR_EYES_VIOLATION] user_id={user.id} requested_by_id={amendment.requested_by_id} amendment_id={amendment_id}"
            )
            raise ConflictException("Người phê duyệt không được trùng với người yêu cầu (Vi phạm Four-Eyes Principle)!")

        now = datetime.now(timezone.utc)
        amendment.trang_thai = AmendmentStatus.DA_PHE_DUYET.value
        amendment.approved_by_id = user.nguoi_dung_id
        amendment.approved_at = now
        if payload.ghi_chu:
            amendment.ghi_chu = f"{amendment.ghi_chu or ''} | Ghi chú duyệt: {payload.ghi_chu}".strip(" |")

        await db.commit()
        await db.refresh(amendment)

        logger.info(
            f"✅ [AMENDMENT APPROVED] ID: {amendment.id} | Duyệt bởi: {user.nguoi_dung_id} | Thời gian: {now}"
        )
        return self._to_amendment_response(amendment)

    async def reject_amendment(
        self,
        amendment_id: int,
        payload: AmendmentApproveRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> AmendmentResponse:
        """Từ chối yêu cầu đính chính bệnh án"""
        stmt = select(BienBanDinhChinh).where(BienBanDinhChinh.id == amendment_id).with_for_update()
        amendment = (await db.execute(stmt)).scalar_one_or_none()
        if not amendment:
            raise NotFoundException("Không tìm thấy biên bản đính chính!")

        if amendment.trang_thai != AmendmentStatus.CHO_PHE_DUYET.value:
            raise ConflictException(f"Biên bản đính chính không ở trạng thái chờ phê duyệt (hiện tại: {amendment.trang_thai})!")

        if user.vai_tro not in [VaiTroEnum.ADMIN.value, VaiTroEnum.BAC_SI.value]:
            raise ForbiddenException("Bạn không có quyền từ chối biên bản đính chính!")

        if user.nguoi_dung_id == amendment.requested_by_id:
            raise ConflictException("Người đánh giá không được trùng với người yêu cầu!")

        amendment.trang_thai = AmendmentStatus.TU_CHOI.value
        amendment.approved_by_id = user.nguoi_dung_id
        amendment.approved_at = datetime.now(timezone.utc)
        if payload.ghi_chu:
            amendment.ghi_chu = f"{amendment.ghi_chu or ''} | Lý do từ chối: {payload.ghi_chu}".strip(" |")

        await db.commit()
        await db.refresh(amendment)

        logger.info(f"❌ [AMENDMENT REJECTED] ID: {amendment.id} | Từ chối bởi: {user.nguoi_dung_id}")
        return self._to_amendment_response(amendment)

    async def get_amendments(
        self,
        encounter_id: int,
        user: TaiKhoan,
        db: AsyncSession
    ) -> list[AmendmentResponse]:
        """Danh sách biên bản đính chính của một ca khám"""
        stmt_enc = select(LuotKham).where(LuotKham.id == encounter_id)
        enc = (await db.execute(stmt_enc)).scalar_one_or_none()
        if not enc:
            raise NotFoundException("Không tìm thấy thông tin lượt khám!")

        stmt = select(BienBanDinhChinh).where(BienBanDinhChinh.luot_kham_id == encounter_id).order_by(BienBanDinhChinh.created_at.asc())
        amendments = (await db.execute(stmt)).scalars().all()
        return [self._to_amendment_response(a) for a in amendments]


clinical_service = ClinicalService()
