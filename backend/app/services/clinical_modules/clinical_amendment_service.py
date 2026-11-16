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

def _to_amendment_response(self, bb: BienBanDinhChinh) -> AmendmentResponse:
    return AmendmentResponse(
        id=bb.id,
        luot_kham_id=bb.luot_kham_id,
        thuc_the_loai=bb.thuc_the_loai,
        thuc_the_id=bb.thuc_the_id,
        ly_do_ma=bb.ly_do_ma,
        ly_do_text=bb.ly_do_text,
        noi_dung_cu_json=bb.noi_dung_cu_json,
        noi_dung_moi_json=bb.noi_dung_moi_json,
        muc_do_nghiem_trong=bb.muc_do_nghiem_trong or "TRUNG_BINH",
        ma_kiem_thao=bb.ma_kiem_thao,
        thoi_gian_kiem_thao=bb.thoi_gian_kiem_thao,
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
    stmt = select(LuotKham).where(LuotKham.id == encounter_id).with_for_update()
    luot_kham = (await db.execute(stmt)).scalar_one_or_none()
    if not luot_kham:
        raise NotFoundException("Không tìm thấy thông tin lượt khám!")

    if not luot_kham.is_locked:
        raise ConflictException("Chỉ được tạo yêu cầu đính chính khi hồ sơ bệnh án đã hoàn tất và khóa!")

    if user.vai_tro == VaiTroEnum.BAC_SI.value:
        stmt_bs = select(BacSi.id).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
        bs_id = (await db.execute(stmt_bs)).scalar_one_or_none()
        if luot_kham.bac_si_id != bs_id and luot_kham.tiep_quan_boi_id != bs_id and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bạn không có quyền yêu cầu đính chính trên ca khám của bác sĩ khác!")
    elif user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chỉ Bác sĩ điều trị hoặc Admin mới có quyền tạo yêu cầu đính chính!")

    noi_dung_cu = None
    muc_do = payload.muc_do_nghiem_trong

    if payload.thuc_the_loai == "CHAN_DOAN":
        stmt_cd = select(ChanDoan).where(ChanDoan.id == payload.thuc_the_id)
        cd = (await db.execute(stmt_cd)).scalar_one_or_none()
        if cd:
            noi_dung_cu = {
                "ma_icd10": cd.ma_icd10,
                "ten_benh_chan_doan": cd.ten_benh_chan_doan,
                "loai_chan_doan": cd.loai_chan_doan,
                "ghi_chu_chuyen_mon": cd.ghi_chu_chuyen_mon,
            }
        if not muc_do:
            muc_do = "CAO"
    elif payload.thuc_the_loai in ["DON_THUOC", "CHI_TIET_DON_THUOC"]:
        if payload.thuc_the_loai == "CHI_TIET_DON_THUOC":
            stmt_ct = select(ChiTietDonThuoc).where(ChiTietDonThuoc.id == payload.thuc_the_id)
            ct = (await db.execute(stmt_ct)).scalar_one_or_none()
            if ct:
                noi_dung_cu = {
                    "ten_thuoc": ct.ten_thuoc,
                    "hoat_chat": ct.hoat_chat,
                    "ham_luong": ct.ham_luong,
                    "don_vi_tinh": ct.don_vi_tinh,
                    "so_luong": ct.so_luong,
                    "cach_dung": ct.cach_dung,
                    "so_ngay_dung": ct.so_ngay_dung,
                }
        else:
            stmt_dt = select(DonThuoc).options(selectinload(DonThuoc.danh_sach_thuoc)).where(DonThuoc.id == payload.thuc_the_id)
            dt = (await db.execute(stmt_dt)).scalar_one_or_none()
            if dt:
                noi_dung_cu = {
                    "loi_dan_uong_thuoc": dt.loi_dan_uong_thuoc,
                    "ghi_chu_duoc_lam_sang": dt.ghi_chu_duoc_lam_sang,
                    "danh_sach_thuoc": [
                        {"ten_thuoc": t.ten_thuoc, "ham_luong": t.ham_luong, "so_luong": t.so_luong, "cach_dung": t.cach_dung}
                        for t in dt.danh_sach_thuoc
                    ]
                }
        if not muc_do:
            muc_do = "CAO"
    elif payload.thuc_the_loai == "CHI_DINH":
        stmt_ord = select(ChiDinh).options(selectinload(ChiDinh.dich_vu)).where(ChiDinh.id == payload.thuc_the_id)
        ord_item = (await db.execute(stmt_ord)).scalar_one_or_none()
        if ord_item:
            noi_dung_cu = {
                "dich_vu_id": ord_item.dich_vu_id,
                "ten_dich_vu": ord_item.dich_vu.ten_dich_vu if ord_item.dich_vu else "",
                "so_luong": ord_item.so_luong,
                "ket_qua_chi_tiet": ord_item.ket_qua_chi_tiet,
            }
        if not muc_do:
            muc_do = "TRUNG_BINH"
    elif payload.thuc_the_loai == "KET_LUAN":
        noi_dung_cu = {
            "ket_luan_dieu_tri": luot_kham.ket_luan_dieu_tri,
            "loi_dan_bac_si": luot_kham.loi_dan_bac_si,
        }
        if not muc_do:
            muc_do = "TRUNG_BINH"

    if not muc_do:
        muc_do = "THAP"

    amendment = BienBanDinhChinh(
        luot_kham_id=encounter_id,
        thuc_the_loai=payload.thuc_the_loai,
        thuc_the_id=payload.thuc_the_id,
        ly_do_ma=payload.ly_do_ma,
        ly_do_text=payload.ly_do_text,
        noi_dung_cu_json=noi_dung_cu,
        noi_dung_moi_json=payload.noi_dung_moi_json,
        muc_do_nghiem_trong=muc_do,
        requested_by_id=user.nguoi_dung_id,
        trang_thai=AmendmentStatus.CHO_PHE_DUYET.value,
        ghi_chu=payload.ghi_chu
    )
    db.add(amendment)
    await db.commit()
    await db.refresh(amendment)

    logger.info(
        f"📝 [AMENDMENT REQUESTED] ID: {amendment.id} | LuotKham: {encounter_id} | Người yêu cầu: {user.nguoi_dung_id} | Loại: {payload.thuc_the_loai} | Mức độ: {muc_do}"
    )
    return self._to_amendment_response(amendment)

async def approve_amendment(
    self,
    amendment_id: int,
    payload: AmendmentApproveRequest,
    user: TaiKhoan,
    db: AsyncSession
) -> AmendmentResponse:
    stmt = select(BienBanDinhChinh).where(BienBanDinhChinh.id == amendment_id).with_for_update()
    amendment = (await db.execute(stmt)).scalar_one_or_none()
    if not amendment:
        raise NotFoundException("Không tìm thấy biên bản đính chính!")

    if amendment.trang_thai != AmendmentStatus.CHO_PHE_DUYET.value:
        raise ConflictException(f"Biên bản đính chính không ở trạng thái chờ phê duyệt (hiện tại: {amendment.trang_thai})!")

    if user.vai_tro not in [VaiTroEnum.ADMIN.value, VaiTroEnum.BAC_SI.value]:
        raise ForbiddenException("Bạn không có quyền phê duyệt biên bản đính chính chuyên môn!")

    if user.nguoi_dung_id == amendment.requested_by_id:
        logger.warning(
            f"🚨 [AUDIT - FOUR_EYES_VIOLATION] user_id={user.id} requested_by_id={amendment.requested_by_id} amendment_id={amendment_id}"
        )
        raise ConflictException("Người phê duyệt không được trùng với người yêu cầu (Vi phạm Four-Eyes Principle)!")

    if amendment.muc_do_nghiem_trong == "CAO" and not payload.ma_kiem_thao:
        raise UnprocessableEntityException(
            "Yêu cầu đính chính mức độ CAO (can thiệp chẩn đoán ICD-10 hoặc đơn thuốc điều trị) bắt buộc phải có Số biên bản kiểm thảo của Hội đồng chuyên môn theo Điều 69 Luật Khám bệnh, chữa bệnh 2023!"
        )

    now = datetime.now(timezone.utc)
    amendment.trang_thai = AmendmentStatus.DA_PHE_DUYET.value
    amendment.approved_by_id = user.nguoi_dung_id
    amendment.approved_at = now
    amendment.ma_kiem_thao = payload.ma_kiem_thao
    amendment.thoi_gian_kiem_thao = payload.thoi_gian_kiem_thao or now
    if payload.ghi_chu:
        amendment.ghi_chu = f"{amendment.ghi_chu or ''} | Ghi chú duyệt: {payload.ghi_chu}".strip(" |")

    await db.commit()
    await db.refresh(amendment)

    logger.info(
        f"✅ [AMENDMENT APPROVED] ID: {amendment.id} | Duyệt bởi: {user.nguoi_dung_id} | BB Kiểm thảo: {payload.ma_kiem_thao} | Thời gian: {now}"
    )
    return self._to_amendment_response(amendment)

async def reject_amendment(
    self,
    amendment_id: int,
    payload: AmendmentApproveRequest,
    user: TaiKhoan,
    db: AsyncSession
) -> AmendmentResponse:
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
    stmt_enc = select(LuotKham).where(LuotKham.id == encounter_id)
    enc = (await db.execute(stmt_enc)).scalar_one_or_none()
    if not enc:
        raise NotFoundException("Không tìm thấy thông tin lượt khám!")

    stmt = select(BienBanDinhChinh).where(BienBanDinhChinh.luot_kham_id == encounter_id).order_by(BienBanDinhChinh.created_at.asc())
    amendments = (await db.execute(stmt)).scalars().all()
    return [self._to_amendment_response(a) for a in amendments]
