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
from app.services.compliance.audit_trail_service import audit_trail_service
from app.services.compliance.prescription_fsm_service import PrescriptionFSMService
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

_SPECIALTY_MODEL_MAP = {
    "noi": KhamNoiKhoa,
    "noi-khoa": KhamNoiKhoa,
    "ngoai": KhamNgoaiKhoa,
    "ngoai-khoa": KhamNgoaiKhoa,
    "mat": KhamMat,
    "tmh": KhamTaiMuiHong,
    "tai-mui-hong": KhamTaiMuiHong,
    "rhm": KhamRangHamMat,
    "rang-ham-mat": KhamRangHamMat,
}

async def save_physical_exam(
    self,
    encounter_id: int,
    payload: PhysicalExamRequest,
    user: TaiKhoan,
    db: AsyncSession,
) -> PhysicalExamResponse:
    bac_si = await self._get_doctor_from_user(user, db)

    stmt = select(LuotKham).where(LuotKham.id == encounter_id).with_for_update()
    luot_kham = (await db.execute(stmt)).scalar_one_or_none()
    if not luot_kham:
        raise NotFoundException("Không tìm thấy thông tin lượt khám!")

    if luot_kham.bac_si_id != bac_si.id and luot_kham.tiep_quan_boi_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Bạn không có quyền cập nhật khám thể lực cho ca khám của bác sĩ khác!")

    if luot_kham.is_locked:
        raise ConflictException("Hồ sơ bệnh án đã hoàn tất và bị khóa (Read-only), không thể cập nhật khám thể lực!")

    from decimal import Decimal
    bmi = None
    if payload.chieu_cao and payload.can_nang and payload.chieu_cao > 0:
        h_m = float(payload.chieu_cao) / 100.0
        bmi_val = float(payload.can_nang) / (h_m * h_m)
        bmi = Decimal(str(round(bmi_val, 1)))

    stmt_pe = select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == encounter_id)
    pe = (await db.execute(stmt_pe)).scalar_one_or_none()
    if not pe:
        pe = LuotKhamTheLuc(
            luot_kham_id=encounter_id,
            chieu_cao=payload.chieu_cao,
            can_nang=payload.can_nang,
            bmi=bmi,
            mach=payload.mach,
            huyet_ap_tam_thu=payload.huyet_ap_tam_thu,
            huyet_ap_tam_truong=payload.huyet_ap_tam_truong,
            nhiet_do=payload.nhiet_do,
            nhip_tho=payload.nhip_tho,
            thi_luc_mat_phai=payload.thi_luc_mat_phai,
            thi_luc_mat_trai=payload.thi_luc_mat_trai,
            tai_mui_hong=payload.tai_mui_hong,
            rang_ham_mat=payload.rang_ham_mat,
            tuan_hoan=payload.tuan_hoan,
            ho_hap=payload.ho_hap,
            tieu_hoa=payload.tieu_hoa,
            than_kinh=payload.than_kinh,
            da_lieu=payload.da_lieu,
            phan_loai_the_luc=payload.phan_loai_the_luc,
            bac_si_ket_luan_id=bac_si.id,
        )
        db.add(pe)
    else:
        pe.chieu_cao = payload.chieu_cao
        pe.can_nang = payload.can_nang
        pe.bmi = bmi
        pe.mach = payload.mach
        pe.huyet_ap_tam_thu = payload.huyet_ap_tam_thu
        pe.huyet_ap_tam_truong = payload.huyet_ap_tam_truong
        pe.nhiet_do = payload.nhiet_do
        pe.nhip_tho = payload.nhip_tho
        pe.thi_luc_mat_phai = payload.thi_luc_mat_phai
        pe.thi_luc_mat_trai = payload.thi_luc_mat_trai
        pe.tai_mui_hong = payload.tai_mui_hong
        pe.rang_ham_mat = payload.rang_ham_mat
        pe.tuan_hoan = payload.tuan_hoan
        pe.ho_hap = payload.ho_hap
        pe.tieu_hoa = payload.tieu_hoa
        pe.than_kinh = payload.than_kinh
        pe.da_lieu = payload.da_lieu
        pe.phan_loai_the_luc = payload.phan_loai_the_luc
        pe.bac_si_ket_luan_id = bac_si.id

    await db.commit()
    await db.refresh(pe)

    return PhysicalExamResponse.model_validate(pe)

async def get_physical_exam(
    self,
    encounter_id: int,
    user: TaiKhoan,
    db: AsyncSession,
) -> Optional[PhysicalExamResponse]:
    await self.get_authorized_encounter(encounter_id, user, db)
    stmt = select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == encounter_id)
    pe = (await db.execute(stmt)).scalar_one_or_none()
    if not pe:
        return None
    return PhysicalExamResponse.model_validate(pe)

async def save_specialty_exam(
    self,
    encounter_id: int,
    dept_code: str,
    payload_data: dict,
    user: TaiKhoan,
    db: AsyncSession,
) -> dict:
    key = (dept_code or "").strip().lower()
    model_cls = self._SPECIALTY_MODEL_MAP.get(key)
    if not model_cls:
        raise UnprocessableEntityException(
            f"Mã chuyên khoa '{dept_code}' không hợp lệ! Hỗ trợ: noi-khoa, ngoai-khoa, mat, tai-mui-hong, rang-ham-mat"
        )

    bac_si = await self._get_doctor_from_user(user, db)
    stmt = select(LuotKham).where(LuotKham.id == encounter_id).with_for_update()
    luot_kham = (await db.execute(stmt)).scalar_one_or_none()
    if not luot_kham:
        raise NotFoundException("Không tìm thấy thông tin lượt khám!")

    if (
        luot_kham.bac_si_id != bac_si.id
        and luot_kham.tiep_quan_boi_id != bac_si.id
        and user.vai_tro != VaiTroEnum.ADMIN.value
    ):
        raise ForbiddenException("Bạn không có quyền cập nhật chuyên khoa cho ca khám của bác sĩ khác!")

    if luot_kham.is_locked:
        raise ConflictException(
            "Hồ sơ bệnh án đã hoàn tất và bị khóa theo TT 32/2023/TT-BYT (Read-only), không thể cập nhật khám chuyên khoa!"
        )

    stmt_sp = select(model_cls).where(model_cls.luot_kham_id == encounter_id)
    record = (await db.execute(stmt_sp)).scalar_one_or_none()

    valid_cols = {c.name for c in model_cls.__table__.columns} - {
        "id",
        "luot_kham_id",
        "created_at",
        "updated_at",
        "bac_si_kham_id",
    }
    if not record:
        record = model_cls(luot_kham_id=encounter_id, bac_si_kham_id=bac_si.id)
        db.add(record)
    else:
        record.bac_si_kham_id = bac_si.id

    for k, v in (payload_data or {}).items():
        if k in valid_cols:
            if k == "so_do_rang_fdi" and isinstance(v, (dict, list)):
                v = json.dumps(v, ensure_ascii=False)
            setattr(record, k, v)

    stmt_phieu = select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == encounter_id)
    phieu = (await db.execute(stmt_phieu)).scalar_one_or_none()

    noi_dung_parts = []
    labels_map = {
        "tuan_hoan": "Tuần hoàn",
        "ho_hap": "Hô hấp",
        "tieu_hoa": "Tiêu hóa",
        "than_tiet_nieu": "Thận - Tiết niệu",
        "than_kinh": "Thần kinh",
        "co_xuong_khop": "Cơ xương khớp",
        "ket_qua_kham_thuc_the": "Ngoại thực thể",
        "tinh_trang_vet_thuong": "Vết thương",
        "thi_luc_mat_phai": "Thị lực phải",
        "thi_luc_mat_trai": "Thị lực trái",
        "tai_phai": "Tai phải",
        "tai_trai": "Tai trái",
        "mui_xoang": "Mũi xoang",
        "hong_thanh_quan": "Họng thanh quản",
        "ham_tren": "Hàm trên",
        "ham_duoi": "Hàm dưới",
    }
    for k, v in (payload_data or {}).items():
        if v and k in labels_map:
            noi_dung_parts.append(f"{labels_map[k]}: {v}")
        elif v and k not in ("ket_luan_chuyen_khoa", "ghi_chu", "so_do_rang_fdi"):
            noi_dung_parts.append(f"{k}: {v}")

    noi_dung_kham = "\n".join(noi_dung_parts) or "Chưa có bất thường"

    phan_loai = "LOAI_1"
    if luot_kham.bmi:
        if luot_kham.bmi >= 30 or luot_kham.bmi < Decimal("18.5"):
            phan_loai = "LOAI_3"
        elif luot_kham.bmi >= 25:
            phan_loai = "LOAI_2"

    chuyen_khoa_id = bac_si.chuyen_khoa_id
    if not chuyen_khoa_id:
        first_ck = (await db.execute(select(ChuyenKhoa).limit(1))).scalars().first()
        if first_ck:
            chuyen_khoa_id = first_ck.id

    ket_luan = (payload_data or {}).get("ket_luan_chuyen_khoa") or "Theo dõi lâm sàng"

    if not phieu:
        if chuyen_khoa_id:
            phieu = PhieuKhamChuyenKhoa(
                luot_kham_id=encounter_id,
                bac_si_id=bac_si.id,
                chuyen_khoa_id=chuyen_khoa_id,
                noi_dung_kham=noi_dung_kham,
                ket_luan_chuyen_khoa=ket_luan,
                phan_loai_suc_khoe=phan_loai,
            )
            db.add(phieu)
    else:
        phieu.noi_dung_kham = noi_dung_kham
        phieu.ket_luan_chuyen_khoa = ket_luan
        phieu.phan_loai_suc_khoe = phan_loai

    await db.commit()
    await db.refresh(record)

    result = {c.name: getattr(record, c.name) for c in model_cls.__table__.columns}
    if result.get("created_at"):
        result["created_at"] = result["created_at"].isoformat()
    if result.get("updated_at"):
        result["updated_at"] = result["updated_at"].isoformat()
    return result

async def get_specialty_exam(
    self,
    encounter_id: int,
    dept_code: str,
    user: TaiKhoan,
    db: AsyncSession,
) -> Optional[dict]:
    await self.get_authorized_encounter(encounter_id, user, db)
    key = (dept_code or "").strip().lower()
    model_cls = self._SPECIALTY_MODEL_MAP.get(key)
    if not model_cls:
        raise UnprocessableEntityException(f"Mã chuyên khoa '{dept_code}' không hợp lệ!")

    stmt = select(model_cls).where(model_cls.luot_kham_id == encounter_id)
    record = (await db.execute(stmt)).scalar_one_or_none()
    if not record:
        return None

    result = {c.name: getattr(record, c.name) for c in model_cls.__table__.columns}
    if result.get("created_at"):
        result["created_at"] = result["created_at"].isoformat()
    if result.get("updated_at"):
        result["updated_at"] = result["updated_at"].isoformat()
    return result

async def get_all_specialty_exams(
    self,
    encounter_id: int,
    user: TaiKhoan,
    db: AsyncSession,
) -> dict:
    await self.get_authorized_encounter(encounter_id, user, db)
    out = {}
    for key, model_cls in [
        ("noi", KhamNoiKhoa),
        ("ngoai", KhamNgoaiKhoa),
        ("mat", KhamMat),
        ("tmh", KhamTaiMuiHong),
        ("rhm", KhamRangHamMat),
    ]:
        stmt = select(model_cls).where(model_cls.luot_kham_id == encounter_id)
        rec = (await db.execute(stmt)).scalar_one_or_none()
        if rec:
            d = {c.name: getattr(rec, c.name) for c in model_cls.__table__.columns}
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            if d.get("updated_at"):
                d["updated_at"] = d["updated_at"].isoformat()
            out[key] = d
        else:
            out[key] = None
    return out


def _to_decimal(value: Optional[float]) -> Optional[Decimal]:
    return Decimal(str(value)) if value is not None else None


async def _record_legacy_vitals(
    luot_kham: LuotKham,
    payload: VitalsCreateRequest,
    bmi: Optional[float],
    is_critical: bool,
    warnings: List[str],
    db: AsyncSession,
) -> VitalsResponse:
    """Lượt khám cũ (bảng luot_kham): ghi sinh hiệu vào luot_kham và luot_kham_the_luc thay vì bảng encounters."""
    heart_rate = int(payload.heart_rate)
    respiratory_rate = int(payload.respiratory_rate) if payload.respiratory_rate is not None else None
    vitals = {
        "huyet_ap_tam_thu": int(payload.systolic_bp),
        "huyet_ap_tam_truong": int(payload.diastolic_bp),
        "spo2": _to_decimal(payload.spo2_percentage),
        "bmi": _to_decimal(bmi),
    }
    for field, value in {
        **vitals,
        "mach_lan_phut": heart_rate,
        "nhiet_do_c": _to_decimal(payload.body_temperature),
        "nhip_tho_lan_phut": respiratory_rate,
        "chieu_cao_cm": _to_decimal(payload.height_cm),
        "can_nang_kg": _to_decimal(payload.weight_kg),
    }.items():
        setattr(luot_kham, field, value)

    the_luc = (
        await db.execute(select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == luot_kham.id))
    ).scalar_one_or_none()
    if not the_luc:
        the_luc = LuotKhamTheLuc(luot_kham_id=luot_kham.id)
        db.add(the_luc)
    for field, value in {
        **vitals,
        "mach": heart_rate,
        "nhiet_do": _to_decimal(payload.body_temperature),
        "nhip_tho": respiratory_rate,
        "chieu_cao": _to_decimal(payload.height_cm),
        "can_nang": _to_decimal(payload.weight_kg),
        "thoi_gian_do": datetime.now(timezone.utc),
    }.items():
        setattr(the_luc, field, value)

    await db.commit()
    await db.refresh(the_luc)

    return VitalsResponse(
        id=the_luc.id,
        encounter_id=luot_kham.id,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        heart_rate=payload.heart_rate,
        body_temperature=payload.body_temperature,
        respiratory_rate=payload.respiratory_rate,
        spo2_percentage=payload.spo2_percentage,
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        bmi=float(the_luc.bmi) if the_luc.bmi is not None else None,
        is_critical=is_critical,
        warnings=warnings,
        recorded_at=the_luc.thoi_gian_do,
    )


async def record_encounter_vitals(
    self, encounter_id: int, payload: VitalsCreateRequest, user: TaiKhoan, db: AsyncSession
) -> VitalsResponse:
    encounter = await db.get(EncounterProduction, encounter_id)
    if not encounter:
        legacy_lk = await db.get(LuotKham, encounter_id)
        if not legacy_lk:
            raise NotFoundException(f"Không tìm thấy lượt khám với ID {encounter_id}")
        if legacy_lk.is_locked:
            raise ForbiddenException("Bệnh án đã được ký số và đóng niêm phong bất biến (Invariant EMR-1)")
    elif encounter.is_locked:
        raise ForbiddenException("Bệnh án đã được ký số và đóng niêm phong bất biến (Invariant EMR-1)")

    calculated_bmi = None
    if payload.height_cm and payload.weight_kg and payload.height_cm > 0:
        height_m = float(payload.height_cm) / 100.0
        calculated_bmi = round(float(payload.weight_kg) / (height_m * height_m), 2)

    is_critical = False
    warnings = []

    if payload.systolic_bp >= 180 or payload.diastolic_bp >= 120:
        is_critical = True
        warnings.append("Cơn tăng huyết áp khẩn cấp (Hypertensive Crisis)")
    elif payload.systolic_bp <= 80 or payload.diastolic_bp <= 50:
        is_critical = True
        warnings.append("Tụt huyết áp nguy kịch / Dấu hiệu sốc")

    if payload.spo2_percentage is not None and payload.spo2_percentage <= 90:
        is_critical = True
        warnings.append("Suy hô hấp cấp (SpO2 <= 90%)")

    if payload.body_temperature >= 39.5:
        is_critical = True
        warnings.append("Sốt cao nguy kịch >= 39.5°C")

    if payload.heart_rate >= 140 or payload.heart_rate <= 45:
        is_critical = True
        warnings.append("Rối loạn nhịp tim đe dọa tính mạng")

    if not encounter:
        return await _record_legacy_vitals(legacy_lk, payload, calculated_bmi, is_critical, warnings, db)

    recorded_by_id = user.id
    user_prod_stmt = select(UserProduction.id).where(
        or_(
            UserProduction.id == user.id,
            UserProduction.email == getattr(user, "email", None),
            UserProduction.username == getattr(user, "email", None),
        )
    )
    found_prod_user_id = (await db.execute(user_prod_stmt)).scalar_one_or_none()
    if found_prod_user_id:
        recorded_by_id = found_prod_user_id

    vital = ClinicalVitalProduction(
        encounter_id=encounter_id,
        systolic_bp=Decimal(str(payload.systolic_bp)),
        diastolic_bp=Decimal(str(payload.diastolic_bp)),
        heart_rate=Decimal(str(payload.heart_rate)),
        body_temperature=Decimal(str(payload.body_temperature)),
        respiratory_rate=Decimal(str(payload.respiratory_rate)) if payload.respiratory_rate is not None else None,
        spo2_percentage=Decimal(str(payload.spo2_percentage)) if payload.spo2_percentage is not None else None,
        height_cm=Decimal(str(payload.height_cm)) if payload.height_cm is not None else None,
        weight_kg=Decimal(str(payload.weight_kg)) if payload.weight_kg is not None else None,
        bmi=Decimal(str(calculated_bmi)) if calculated_bmi is not None else None,
        recorded_by=recorded_by_id,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(vital)
    await db.commit()
    await db.refresh(vital)

    return VitalsResponse(
        id=vital.id,
        encounter_id=vital.encounter_id,
        systolic_bp=float(vital.systolic_bp),
        diastolic_bp=float(vital.diastolic_bp),
        heart_rate=float(vital.heart_rate),
        body_temperature=float(vital.body_temperature),
        respiratory_rate=float(vital.respiratory_rate) if vital.respiratory_rate is not None else None,
        spo2_percentage=float(vital.spo2_percentage) if vital.spo2_percentage is not None else None,
        height_cm=float(vital.height_cm) if vital.height_cm is not None else None,
        weight_kg=float(vital.weight_kg) if vital.weight_kg is not None else None,
        bmi=float(vital.bmi) if vital.bmi is not None else None,
        is_critical=is_critical,
        warnings=warnings,
        recorded_at=vital.recorded_at,
    )
