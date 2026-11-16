import hashlib
import json
import logging
import unicodedata
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, select, func, and_
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    NotFoundException,
    ConflictException,
    ForbiddenException,
    UnprocessableEntityException,
    BadRequestException,
)
from app.models.production_models import (
    EncounterProduction,
    DiagnosisICD10Production,
    EncounterDiagnosisProduction,
    ClinicalVitalProduction,
    PatientAllergyProduction,
    EmrSignedRecordProduction,
    PatientProduction,
    UserProduction,
)
from app.models.appointment import (
    LichKham,
    TrangThaiLichEnum,
    CANCELLED_STATUSES,
    HangDoiKham,
    TrangThaiHangDoiEnum,
    PhanTichAI,
    PhanTichAIGoiY,
    DanhGiaAI,
)
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
    LuotKhamTheLuc,
    PhieuKhamChuyenKhoa,
)
from app.models.user import TaiKhoan, BacSi, BenhNhan, VaiTroEnum, ChuyenKhoa
from app.models.specialty_exam import (
    KhamNoiKhoa,
    KhamNgoaiKhoa,
    KhamMat,
    KhamTaiMuiHong,
    KhamRangHamMat,
)
from app.schemas.subclinical import PhysicalExamRequest, PhysicalExamResponse
from app.schemas.compliance import TrangThaiDonThuoc
from app.services.audit_trail_service import audit_trail_service
from app.services.prescription_fsm_service import PrescriptionFSMService
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
    Icd10SearchItem,
    VitalsCreateRequest,
    VitalsResponse,
    SealAndSignResponse,
    AllergyCheckRequest,
    AllergyCheckResponse,
)
from app.schemas.ai import AiFeedbackRequest, AiFeedbackResponse

logger = logging.getLogger(__name__)

async def assert_prescription_edit_access(self, prescription_id: int, user: TaiKhoan, db: AsyncSession) -> None:
    if user.vai_tro not in (VaiTroEnum.BAC_SI.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Bạn không có quyền cập nhật đơn thuốc.")
    prescription = await db.get(DonThuoc, prescription_id)
    if not prescription:
        raise NotFoundException("Không tìm thấy đơn thuốc.")
    await self.get_authorized_encounter(prescription.luot_kham_id, user, db)

def _to_prescription_response(self, dt: DonThuoc) -> PrescriptionResponse:
    return PrescriptionResponse(
        id=dt.id,
        luot_kham_id=dt.luot_kham_id,
        bac_si_ke_don_id=dt.bac_si_ke_don_id,
        ngay_ke_don=dt.ngay_ke_don,
        so_ngay_dung=dt.so_ngay_dung,
        loi_dan_uong_thuoc=dt.loi_dan_uong_thuoc,
        ghi_chu_duoc_lam_sang=dt.ghi_chu_duoc_lam_sang,
        trang_thai=dt.trang_thai or "DRAFT",
        ma_don_quoc_gia=dt.ma_don_quoc_gia,
        chu_ky_so=dt.chu_ky_so,
        ngay_ky=dt.ngay_ky,
        idempotency_key=dt.idempotency_key,
        bien_nhan_giao_dich=dt.bien_nhan_giao_dich,
        thoi_gian_gui_cong=dt.thoi_gian_gui_cong,
        ma_ket_qua_cong=dt.ma_ket_qua_cong,
        thong_diep_cong=dt.thong_diep_cong,
        superseded_by_id=dt.superseded_by_id,
        thay_the_cho_don_id=dt.thay_the_cho_don_id,
        ly_do_thay_the=dt.ly_do_thay_the,
        nguoi_ky_id=dt.nguoi_ky_id,
        du_lieu_don_thuoc_hash=dt.du_lieu_don_thuoc_hash,
        danh_sach_chi_tiet=[
            PrescriptionItemResponse(
                id=item.id,
                don_thuoc_id=item.don_thuoc_id,
                ten_thuoc=item.ten_thuoc,
                hoat_chat=item.hoat_chat,
                ham_luong=item.ham_luong,
                don_vi_tinh=item.don_vi_tinh,
                so_luong=item.so_luong,
                lieu_sang=item.lieu_sang or "",
                lieu_trua=item.lieu_trua or "",
                lieu_chieu=item.lieu_chieu or "",
                lieu_toi=item.lieu_toi or "",
                cach_dung=item.cach_dung,
                so_ngay_dung=item.so_ngay_dung,
                ghi_chu=item.ghi_chu
            )
            for item in (dt.danh_sach_chi_tiet or [])
        ],
        created_at=dt.created_at
    )

async def create_prescription(
    self,
    encounter_id: int,
    payload: PrescriptionCreateRequest,
    user: TaiKhoan,
    db: AsyncSession
) -> PrescriptionResponse:
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
        so_ngay_dung=payload.so_ngay_dung or 5,
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
            lieu_sang=item.lieu_sang or "",
            lieu_trua=item.lieu_trua or "",
            lieu_chieu=item.lieu_chieu or "",
            lieu_toi=item.lieu_toi or "",
            cach_dung=item.cach_dung,
            so_ngay_dung=item.so_ngay_dung,
            ghi_chu=item.ghi_chu
        )
        db.add(chi_tiet)

    await db.commit()

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
    luot_kham = await self._get_encounter_with_relations(encounter_id, db)
    if not luot_kham:
        raise NotFoundException(f"Không tìm thấy lượt khám với ID {encounter_id}!")

    await self.assert_encounter_access(luot_kham, user, db)

    if not luot_kham.don_thuoc:
        raise NotFoundException("Lượt khám này chưa có đơn thuốc nào được kê!")

    return self._to_prescription_response(luot_kham.don_thuoc)

async def copy_prescription_from_previous(
    self,
    encounter_id: int,
    source_prescription_id: int,
    user: TaiKhoan,
    db: AsyncSession,
) -> PrescriptionResponse:
    stmt_src = (
        select(DonThuoc)
        .options(selectinload(DonThuoc.danh_sach_chi_tiet))
        .where(DonThuoc.id == source_prescription_id)
    )
    src_rx = (await db.execute(stmt_src)).scalar_one_or_none()
    if not src_rx:
        raise NotFoundException("Không tìm thấy đơn thuốc cũ để sao chép!")

    from app.schemas.clinical import PrescriptionItemCreate
    items_payload = [
        PrescriptionItemCreate(
            khai_niem_thuoc_id=item.khai_niem_thuoc_id,
            ten_thuoc=item.ten_thuoc,
            hoat_chat=item.hoat_chat,
            ham_luong=item.ham_luong,
            lieu_dung=item.lieu_dung,
            tan_suat=item.tan_suat,
            thoi_gian_dung_ngay=item.thoi_gian_dung_ngay,
            so_luong=item.so_luong,
            don_vi_tinh=item.don_vi_tinh,
            duong_dung=item.duong_dung,
            ghi_chu=item.ghi_chu,
        )
        for item in (src_rx.danh_sach_chi_tiet or [])
    ]
    create_req = PrescriptionCreateRequest(
        ghi_chu_don_thuoc=f"[Sao chép từ đơn #{src_rx.id}] {src_rx.ghi_chu_don_thuoc or ''}".strip(),
        danh_sach_thuoc=items_payload,
    )
    return await self.create_prescription(encounter_id, create_req, user, db)

async def check_drug_allergy_conflict(
    self, patient_id: int, active_ingredient: str, db: AsyncSession
) -> AllergyCheckResponse:
    normalized_target = self.strip_vietnamese_accents(active_ingredient).replace("ll", "l").replace("cc", "c")
    if not normalized_target:
        return AllergyCheckResponse(has_conflict=False, is_blocked=False)

    stmt_allergies = select(PatientAllergyProduction).where(PatientAllergyProduction.patient_id == patient_id)
    allergies = (await db.execute(stmt_allergies)).scalars().all()

    for a in allergies:
        norm_name = self.strip_vietnamese_accents(a.active_ingredient_name).replace("ll", "l").replace("cc", "c")
        if normalized_target in norm_name or norm_name in normalized_target or (len(norm_name) >= 5 and norm_name[:5] in normalized_target):
            return AllergyCheckResponse(
                has_conflict=True,
                is_blocked=True,
                details=f"Cảnh báo dị ứng nghiêm trọng: Bệnh nhân có tiền sử dị ứng với hoạt chất {a.active_ingredient_name} ({a.severity})",
            )

    stmt_p = select(PatientProduction).where(PatientProduction.id == patient_id)
    p = (await db.execute(stmt_p)).scalar_one_or_none()
    if p:
        stmt_bn = select(BenhNhan).where(BenhNhan.ma_dinh_danh_y_te == p.patient_code)
        bn = (await db.execute(stmt_bn)).scalar_one_or_none()
        if bn and bn.di_ung_thuoc and bn.di_ung_thuoc.strip().lower() not in ("không", "khong", "none", ""):
            norm_bn_diung = self.strip_vietnamese_accents(bn.di_ung_thuoc).replace("ll", "l").replace("cc", "c")
            if normalized_target in norm_bn_diung or norm_bn_diung in normalized_target or (len(norm_bn_diung) >= 5 and norm_bn_diung[:5] in normalized_target):
                return AllergyCheckResponse(
                    has_conflict=True,
                    is_blocked=True,
                    details=f"Cảnh báo dị ứng nghiêm trọng: Bệnh nhân có tiền sử ghi nhận '{bn.di_ung_thuoc}'",
                )

    return AllergyCheckResponse(has_conflict=False, is_blocked=False)
