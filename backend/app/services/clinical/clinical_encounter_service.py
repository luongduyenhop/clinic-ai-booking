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

def _assert_doctor_license_valid(bac_si: BacSi) -> None:
    from app.models.compliance import TrangThaiGiayPhep
    from app.services.auth.credential_service import DoctorLicenseInvalidException

    doc_name = f"ID {getattr(bac_si, 'id', '')}"
    status = getattr(bac_si, "trang_thai_giay_phep", "ACTIVE")

    if status == TrangThaiGiayPhep.EXPIRED.value or status == "EXPIRED":
        raise DoctorLicenseInvalidException(
            f"Giấy phép hành nghề của Bác sĩ {doc_name} đã HẾT HẠN (EXPIRED). Không thể phân công hoặc tiếp nhận ca khám!"
        )
    if status == TrangThaiGiayPhep.SUSPENDED.value or status == "SUSPENDED":
        raise DoctorLicenseInvalidException(
            f"Bác sĩ {doc_name} đang bị TẠM ĐÌNH CHỈ hành nghề (SUSPENDED). Mọi hoạt động chuyên môn bị tạm khóa!"
        )
    if status == TrangThaiGiayPhep.REVOKED.value or status == "REVOKED":
        raise DoctorLicenseInvalidException(
            f"Giấy phép hành nghề của Bác sĩ {doc_name} đã bị THU HỒI (REVOKED). Từ chối thực hiện tác vụ!"
        )

    ngay_het_han = getattr(bac_si, "ngay_het_han", None)
    if ngay_het_han:
        now = datetime.now(timezone.utc)
        if isinstance(ngay_het_han, datetime):
            exp_dt = ngay_het_han if ngay_het_han.tzinfo else ngay_het_han.replace(tzinfo=timezone.utc)
            is_expired = exp_dt < now
            exp_str = exp_dt.strftime("%Y-%m-%d")
        else:
            is_expired = ngay_het_han < now.date()
            exp_str = ngay_het_han.strftime("%Y-%m-%d")

        if is_expired:
            bac_si.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRED.value
            bac_si.is_active = False
            raise DoctorLicenseInvalidException(
                f"Giấy phép hành nghề của Bác sĩ {doc_name} đã hết hạn vào ngày {exp_str}!"
            )

    if getattr(bac_si, "is_active", None) is False:
        raise DoctorLicenseInvalidException(f"Hồ sơ Bác sĩ {doc_name} hiện đang ở trạng thái ngừng hoạt động!")


async def _get_doctor_from_user(self, user: TaiKhoan, db: AsyncSession) -> BacSi:
    if user.vai_tro not in (VaiTroEnum.BAC_SI.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Chức năng khám bệnh lâm sàng chỉ dành riêng cho Bác sĩ!")

    stmt = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
    bac_si = (await db.execute(stmt)).scalar_one_or_none()
    if not bac_si:
        raise ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bác sĩ hợp lệ!")
    if user.vai_tro == VaiTroEnum.BAC_SI.value:
        _assert_doctor_license_valid(bac_si)
    return bac_si

async def enrich_workspace_ai(self, payload: dict, db: AsyncSession) -> dict:
    encounters = payload.get("encounters")
    if not isinstance(encounters, dict):
        return payload
    appointment_ids = set()
    for encounter in encounters.values():
        if not isinstance(encounter, dict):
            continue
        try:
            appointment_ids.add(int(encounter.get("lich_kham_id")))
        except (TypeError, ValueError):
            continue
    if not appointment_ids:
        return payload

    stmt = (
        select(LichKham)
        .options(
            selectinload(LichKham.phan_tich_ai).selectinload(PhanTichAI.chuyen_khoa_goi_y),
            selectinload(LichKham.phan_tich_ai)
            .selectinload(PhanTichAI.danh_sach_goi_y)
            .selectinload(PhanTichAIGoiY.chuyen_khoa)
        )
        .where(LichKham.id.in_(appointment_ids))
    )
    bookings = (await db.execute(stmt)).scalars().all()
    by_id = {booking.id: booking for booking in bookings}
    for encounter in encounters.values():
        if not isinstance(encounter, dict):
            continue
        try:
            booking = by_id.get(int(encounter.get("lich_kham_id")))
        except (TypeError, ValueError):
            booking = None
        analysis = booking.phan_tich_ai if booking else None
        if not analysis:
            continue
        suggestions = sorted(analysis.danh_sach_goi_y or [], key=lambda item: item.thu_tu_uu_tien)
        top = suggestions[0] if suggestions else None
        encounter["ai_triage"] = {
            "phan_tich_ai_id": analysis.id,
            "trieu_chung_nhap": analysis.trieu_chung_nhap,
            "ten_chuyen_khoa": top.chuyen_khoa.ten_chuyen_khoa if top and top.chuyen_khoa else (
                analysis.chuyen_khoa_goi_y.ten_chuyen_khoa if analysis.chuyen_khoa_goi_y else "Nội tổng quát"
            ),
            "ma_chuyen_khoa": top.chuyen_khoa.ma_chuyen_khoa if top and top.chuyen_khoa else None,
            "do_tin_cay": float(top.do_tin_cay if top else analysis.do_tin_cay),
            "ly_do_de_xuat": top.ly_do_goi_y if top else None,
            "co_dau_hieu_cap_cuu": analysis.co_dau_hieu_cap_cuu,
        }
    return payload

def _assert_completion_diagnosis_invariant(luot_kham: LuotKham) -> None:
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
    return await self._get_encounter_matching(LuotKham.id == encounter_id, db, for_update)

async def _get_encounter_matching(self, condition, db: AsyncSession, for_update: bool = False) -> LuotKham | None:
    stmt = (
        select(LuotKham)
        .options(
            selectinload(LuotKham.danh_sach_chan_doan),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.phieu_ket_qua),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.ket_qua),
            selectinload(LuotKham.don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet),
            selectinload(LuotKham.danh_sach_phieu_chuyen_khoa),
        )
        .where(condition)
        .order_by(LuotKham.hang_doi_kham_id.is_(None).asc(), LuotKham.id.asc())
    )
    if for_update:
        stmt = stmt.with_for_update()
    return (await db.execute(stmt)).scalars().first()

async def assert_encounter_access(self, encounter: LuotKham, user: TaiKhoan, db: AsyncSession) -> None:
    if user.vai_tro == VaiTroEnum.ADMIN.value:
        return
    if user.vai_tro == VaiTroEnum.BAC_SI.value:
        doctor = await self._get_doctor_from_user(user, db)
        if doctor.id in (encounter.bac_si_id, encounter.tiep_quan_boi_id):
            return
    if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
        patient = await db.get(BenhNhan, encounter.benh_nhan_id)
        if patient and patient.nguoi_dung_id == user.nguoi_dung_id:
            return
    raise ForbiddenException("Bạn không có quyền truy cập lượt khám này.")

async def get_authorized_encounter(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> LuotKham:
    encounter = await db.get(LuotKham, encounter_id)
    if not encounter:
        raise NotFoundException("Không tìm thấy thông tin lượt khám.")
    await self.assert_encounter_access(encounter, user, db)
    return encounter

def _to_encounter_response(self, lk: LuotKham) -> EncounterResponse:
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
    orders = []
    for order in (lk.danh_sach_chi_dinh or []):
        kq = order.__dict__.get("ket_qua")
        phieu = order.__dict__.get("phieu_ket_qua")
        attachments = self._extract_order_attachments(order)
        orders.append(
            OrderResponse(
                id=order.id,
                luot_kham_id=order.luot_kham_id,
                dich_vu_id=order.dich_vu_id,
                ten_dich_vu=order.dich_vu.ten_dich_vu if order.dich_vu else None,
                so_luong=order.so_luong,
                don_gia_tai_thoi_diem=float(order.don_gia_tai_thoi_diem),
                trang_thai=order.trang_thai,
                bac_si_chi_dinh_id=order.bac_si_chi_dinh_id,
                ket_qua_chi_tiet=(
                    order.ket_qua_chi_tiet
                    or (kq.ket_qua_chi_tiet if kq else None)
                    or (phieu.ket_luan if phieu else None)
                ),
                tep_dinh_kem_url=attachments[0] if attachments else None,
                tep_dinh_kem_urls=attachments,
                thoi_gian_tra_ket_qua=(
                    order.thoi_gian_tra_ket_qua
                    or (kq.thoi_gian_duyet if kq else None)
                    or (phieu.thoi_gian_duyet if phieu else None)
                ),
                ket_qua_phan_loai=(
                    order.ket_qua_phan_loai
                    or (kq.ket_qua_phan_loai if kq else None)
                    or "BINH_THUONG"
                ),
                created_at=order.created_at
            )
        )
    prescription_dto = self._to_prescription_response(lk.don_thuoc) if lk.don_thuoc else None
    dt_str = lk.thoi_gian_bat_dau.strftime('%y%m%d') if lk.thoi_gian_bat_dau else date.today().strftime('%y%m%d')
    ma_kcb = f"KCB-{dt_str}-{lk.id:04d}"
    return EncounterResponse(
        id=lk.id,
        lich_kham_id=lk.lich_kham_id,
        ma_kcb=ma_kcb,
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
        spo2=float(lk.spo2) if lk.spo2 is not None else None,
        bmi=float(lk.bmi) if lk.bmi is not None else None,
        trieu_chung=lk.trieu_chung,
        chan_doan_so_bo=lk.chan_doan_so_bo,
        tien_su_di_ung=lk.tien_su_di_ung,
        kham_lam_sang_bo_phan=lk.kham_lam_sang_bo_phan,
        ket_luan_dieu_tri=lk.ket_luan_dieu_tri,
        loi_dan_bac_si=lk.loi_dan_bac_si,
        ngay_hen_tai_kham=lk.ngay_hen_tai_kham,
        loi_dan_tai_kham=lk.loi_dan_tai_kham,
        is_locked=lk.is_locked,
        thoi_gian_khoa=lk.thoi_gian_khoa,
        nguoi_khoa_id=lk.nguoi_khoa_id,
        danh_sach_chan_doan=diagnoses,
        danh_sach_chi_dinh=orders,
        don_thuoc=prescription_dto
    )

async def rate_ai_suggestion(
    self,
    payload: AiFeedbackRequest,
    user: TaiKhoan,
    db: AsyncSession,
) -> AiFeedbackResponse:
    if user.vai_tro not in (VaiTroEnum.BAC_SI.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Chức năng đánh giá gợi ý AI chỉ dành cho Bác sĩ.")

    doctor = None
    if user.vai_tro == VaiTroEnum.BAC_SI.value:
        doctor = await self._get_doctor_from_user(user, db)

    stmt_analysis = (
        select(PhanTichAI)
        .options(selectinload(PhanTichAI.lich_kham))
        .where(PhanTichAI.id == payload.phan_tich_ai_id)
    )
    analysis = (await db.execute(stmt_analysis)).scalar_one_or_none()
    if not analysis or not analysis.lich_kham_id or not analysis.lich_kham:
        raise NotFoundException("Không tìm thấy lần phân tích AI đã được gắn với lịch hẹn.")
    if doctor and analysis.lich_kham.bac_si_id != doctor.id:
        raise ForbiddenException("Bác sĩ chỉ được đánh giá gợi ý AI thuộc lịch hẹn mình phụ trách.")

    stmt_feedback = select(DanhGiaAI).where(DanhGiaAI.phan_tich_ai_id == analysis.id)
    feedback = (await db.execute(stmt_feedback)).scalar_one_or_none()
    if feedback is None:
        feedback = DanhGiaAI(
            phan_tich_ai_id=analysis.id,
            nguoi_danh_gia_id=user.nguoi_dung_id,
            vai_tro_nguoi_danh_gia=user.vai_tro,
        )
        db.add(feedback)
    feedback.nguoi_danh_gia_id = user.nguoi_dung_id
    feedback.vai_tro_nguoi_danh_gia = user.vai_tro
    feedback.so_sao = payload.so_sao
    feedback.nhan_xet = payload.nhan_xet
    await db.commit()
    await db.refresh(feedback)
    return AiFeedbackResponse(
        id=feedback.id,
        phan_tich_ai_id=feedback.phan_tich_ai_id,
        so_sao=feedback.so_sao,
        nhan_xet=feedback.nhan_xet,
    )

async def start_encounter(
    self,
    payload: EncounterCreateRequest,
    user: TaiKhoan,
    db: AsyncSession
) -> EncounterResponse:
    bac_si = await self._get_doctor_from_user(user, db)

    from app.services.auth.credential_service import credential_service
    await credential_service.check_doctor_license_valid(db, bac_si.id)

    stmt_lich = select(LichKham).where(LichKham.id == payload.lich_kham_id)
    lich_kham = (await db.execute(stmt_lich)).scalar_one_or_none()
    if not lich_kham:
        raise NotFoundException("Không tìm thấy thông tin lịch hẹn khám!")

    if lich_kham.bac_si_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Bạn chỉ có thể thực hiện ca khám cho lịch hẹn thuộc phụ trách của mình!")

    if lich_kham.trang_thai in CANCELLED_STATUSES:
        raise ConflictException("Không thể bắt đầu ca khám cho lịch hẹn đã bị hủy!")

    stmt_existing = select(LuotKham).where(LuotKham.lich_kham_id == payload.lich_kham_id)
    existing_encounter = (await db.execute(stmt_existing)).scalar_one_or_none()
    if existing_encounter:
        raise ConflictException("Lịch hẹn này đã được tạo lượt khám trước đó!")

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
        spo2=payload.spo2,
        bmi=payload.bmi,
        trieu_chung=payload.trieu_chung,
        chan_doan_so_bo=payload.chan_doan_so_bo,
        tien_su_di_ung=payload.tien_su_di_ung,
        kham_lam_sang_bo_phan=payload.kham_lam_sang_bo_phan,
        is_locked=False
    )
    db.add(luot_kham)

    lich_kham.trang_thai = TrangThaiLichEnum.DANG_KHAM.value

    await db.commit()

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
    luot_kham = await self._get_encounter_with_relations(encounter_id, db)
    if not luot_kham:
        raise NotFoundException("Không tìm thấy thông tin lượt khám!")

    await self.assert_encounter_access(luot_kham, user, db)

    await audit_trail_service.log_access(
        db=db,
        user_id=user.id,
        user_role=user.vai_tro,
        patient_id=luot_kham.benh_nhan_id,
        action="VIEW",
        resource_type="ENCOUNTER",
        resource_id=luot_kham.id,
        purpose="Xem hồ sơ bệnh án điện tử (EMR)",
    )
    await db.commit()

    return self._to_encounter_response(luot_kham)

async def get_patient_encounters_history(
    self,
    patient_id: int,
    user: TaiKhoan,
    db: AsyncSession
) -> List[EncounterResponse]:
    if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
        patient = await db.get(BenhNhan, patient_id)
        if not patient or patient.nguoi_dung_id != user.nguoi_dung_id:
            raise ForbiddenException("Bạn chỉ có quyền xem lịch sử khám của mình.")
    elif user.vai_tro not in (VaiTroEnum.ADMIN.value, VaiTroEnum.BAC_SI.value):
        raise ForbiddenException("Bạn không có quyền xem lịch sử khám.")
    stmt = (
        select(LuotKham)
        .options(
            selectinload(LuotKham.danh_sach_chan_doan),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.phieu_ket_qua),
            selectinload(LuotKham.don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet)
        )
        .where(LuotKham.benh_nhan_id == patient_id)
        .order_by(LuotKham.thoi_gian_bat_dau.desc())
    )
    if user.vai_tro == VaiTroEnum.BAC_SI.value:
        doctor = await self._get_doctor_from_user(user, db)
        stmt = stmt.where(or_(LuotKham.bac_si_id == doctor.id, LuotKham.tiep_quan_boi_id == doctor.id))
    encounters = (await db.execute(stmt)).scalars().all()
    return [self._to_encounter_response(lk) for lk in encounters]

async def get_my_encounters_history(
    self,
    user: TaiKhoan,
    db: AsyncSession
) -> List[EncounterResponse]:
    stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
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
    bac_si = await self._get_doctor_from_user(user, db)

    luot_kham = await self._get_encounter_with_relations(encounter_id, db, for_update=True)
    if not luot_kham:
        raise NotFoundException("Không tìm thấy thông tin lượt khám!")

    if luot_kham.bac_si_id != bac_si.id and luot_kham.tiep_quan_boi_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Bạn chỉ có quyền hoàn tất ca khám do mình phụ trách hoặc tiếp quản!")

    if luot_kham.is_locked:
        raise ConflictException("Hồ sơ bệnh án này đã được hoàn tất và khóa trước đó!")

    self._assert_completion_diagnosis_invariant(luot_kham)

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
        raise UnprocessableEntityException(
            f"Không thể hoàn tất lượt khám: còn {len(pending_orders)} chỉ định cận lâm sàng đang thực hiện dở dang chưa có kết quả."
        )

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
            raise ConflictException(
                "Dữ liệu hàng đợi không nhất quán: lịch khám có nhiều vé đang khám. "
                "Vui lòng liên hệ quản trị viên."
            )
        active_ticket = active_tickets[0] if active_tickets else None

    now = datetime.now(timezone.utc)
    luot_kham.ket_luan_dieu_tri = payload.ket_luan_dieu_tri
    luot_kham.loi_dan_bac_si = payload.loi_dan_bac_si
    luot_kham.ngay_hen_tai_kham = payload.ngay_hen_tai_kham
    luot_kham.loi_dan_tai_kham = payload.loi_dan_tai_kham
    luot_kham.thoi_gian_ket_thuc = now
    luot_kham.is_locked = True
    luot_kham.thoi_gian_khoa = now
    luot_kham.nguoi_khoa_id = user.nguoi_dung_id

    stmt_lich = select(LichKham).where(LichKham.id == luot_kham.lich_kham_id)
    lich_kham = (await db.execute(stmt_lich)).scalar_one_or_none()
    if lich_kham:
        lich_kham.trang_thai = TrangThaiLichEnum.DA_KHAM.value

    if active_ticket is not None:
        active_ticket.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
        active_ticket.thoi_gian_ket_thuc = now
    elif luot_kham.hang_doi_kham_id is not None:
        direct_ticket = (
            await db.execute(
                select(HangDoiKham).where(HangDoiKham.id == luot_kham.hang_doi_kham_id).with_for_update()
            )
        ).scalar_one_or_none()
        if direct_ticket is not None:
            direct_ticket.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
            direct_ticket.thoi_gian_ket_thuc = now
    else:
        logger.warning(
            f"[QUEUE_SYNC_SKIPPED] encounter_id={encounter_id} "
            f"lich_kham_id={luot_kham.lich_kham_id} "
            f"ticket_states={[t.trang_thai for t in tickets]}"
        )

    await db.flush()
    from app.services.billing.cashier_service import cashier_service
    await cashier_service.ensure_invoice_for_completed_encounter(
        luot_kham_id=luot_kham.id,
        nguoi_lap_id=user.nguoi_dung_id,
        db=db,
    )

    await db.commit()

    encounter = await self._get_encounter_with_relations(luot_kham.id, db)
    if not encounter:
        raise NotFoundException("Lỗi không tìm thấy lượt khám sau khi hoàn tất!")

    logger.info(f"🔒 [ENCOUNTER LOCKED] ID: {encounter.id} | Bác sĩ: {bac_si.id} (NguoiDung: {user.nguoi_dung_id}) đã khóa hồ sơ bệnh án thành công.")
    return self._to_encounter_response(encounter)

async def seal_and_sign_encounter(
    self, encounter_id: int, user: TaiKhoan, db: AsyncSession
) -> SealAndSignResponse:
    encounter = await db.get(EncounterProduction, encounter_id)
    legacy_lk = await db.get(LuotKham, encounter_id)

    if not encounter and not legacy_lk:
        raise NotFoundException(f"Không tìm thấy lượt khám với ID {encounter_id}")

    if (encounter and encounter.is_locked) or (legacy_lk and legacy_lk.is_locked):
        raise ConflictException("Bệnh án đã được ký số và niêm phong trước đó, không thể chỉnh sửa hoặc ký lại!")

    stmt_diag_prod = select(EncounterDiagnosisProduction).where(EncounterDiagnosisProduction.encounter_id == encounter_id)
    has_prod_diag = (await db.execute(stmt_diag_prod)).scalars().first() is not None

    stmt_diag_legacy = select(ChanDoan).where(ChanDoan.luot_kham_id == encounter_id)
    has_legacy_diag = (await db.execute(stmt_diag_legacy)).scalars().first() is not None

    if not has_prod_diag and not has_legacy_diag:
        raise UnprocessableEntityException("Không thể ký đóng bệnh án khi chưa có chẩn đoán bệnh theo mã ICD-10 (Invariant EMR-1)")

    signing_time = datetime.now(timezone.utc)
    payload_to_hash = f"EMR-ENC:{encounter_id}|USER:{user.id}|TIME:{signing_time.isoformat()}"
    doc_hash = hashlib.sha256(payload_to_hash.encode("utf-8")).hexdigest()
    sig_container = f"RSA-SHA256-SIG-{user.id}-{doc_hash[:20].upper()}"

    signed_record = EmrSignedRecordProduction(
        encounter_id=encounter_id,
        document_type="OUTPATIENT_RECORD",
        document_hash=doc_hash,
        signature_container=sig_container,
        signer_name=getattr(user, "email", getattr(user, "username", "Bac Si")),
        signer_license_id=f"CCHN-{user.id:06d}",
        certificate_serial=f"SERIAL-{user.id:04d}-{signing_time.strftime('%Y%m%d')}",
        signed_timestamp=signing_time,
        pdf_storage_path=f"/var/emr/signed/ENC_{encounter_id}_{doc_hash[:8]}.pdf",
        is_tampered=False,
    )
    db.add(signed_record)

    if encounter:
        encounter.is_locked = True
        encounter.status = "COMPLETED_LOCKED"
        encounter.signed_at = signing_time

    if legacy_lk:
        legacy_lk.is_locked = True
        legacy_lk.thoi_gian_ket_thuc = signing_time

    await db.commit()

    return SealAndSignResponse(
        encounter_id=encounter_id,
        status="COMPLETED_LOCKED",
        is_locked=True,
        signed_at=signing_time,
        record_hash=doc_hash,
        signature=sig_container,
    )
