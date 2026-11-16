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

def _extract_order_attachments(order: ChiDinh) -> List[str]:
    urls = []
    if order.file_dinh_kem_urls:
        urls.extend(order.file_dinh_kem_urls)
    if order.tep_dinh_kem_url:
        urls.append(order.tep_dinh_kem_url)
    phieu = order.__dict__.get("phieu_ket_qua")
    if phieu is not None and phieu.tep_dinh_kem_urls:
        urls.extend(phieu.tep_dinh_kem_urls)
    kq = order.__dict__.get("ket_qua")
    if kq is not None and kq.file_dinh_kem_urls:
        urls.extend(kq.file_dinh_kem_urls)
    return list(dict.fromkeys(str(u) for u in urls if u))

async def add_diagnosis(
    self,
    encounter_id: int,
    payload: DiagnosisCreateRequest,
    user: TaiKhoan,
    db: AsyncSession
) -> DiagnosisResponse:
    bac_si = await self._get_doctor_from_user(user, db)

    stmt = select(LuotKham).where(LuotKham.id == encounter_id).with_for_update()
    luot_kham = (await db.execute(stmt)).scalar_one_or_none()
    if not luot_kham:
        raise NotFoundException("Không tìm thấy thông tin lượt khám!")

    if luot_kham.bac_si_id != bac_si.id and luot_kham.tiep_quan_boi_id != bac_si.id and user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Bạn không có quyền thêm chẩn đoán cho ca khám của bác sĩ khác!")

    if luot_kham.is_locked:
        logger.warning(
            f"🔒 [AUDIT - ATTEMPTED_WRITE_ON_LOCKED] action=ADD_DIAGNOSIS encounter_id={encounter_id} user_id={user.id}"
        )
        raise ConflictException(
            "Hồ sơ bệnh án đã hoàn tất và bị khóa (Read-only theo TT 32/2023/TT-BYT), không thể bổ sung chẩn đoán!"
        )

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

    stmt_dv = select(DichVu).where(DichVu.id == payload.dich_vu_id)
    dich_vu = (await db.execute(stmt_dv)).scalar_one_or_none()
    if not dich_vu or not dich_vu.is_active:
        raise NotFoundException("Dịch vụ cận lâm sàng không tồn tại hoặc đã tạm dừng cung cấp!")

    from app.services.credential_service import credential_service
    await credential_service.check_doctor_scope_of_practice(db, bac_si.id, dich_vu.id)

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
        tep_dinh_kem_urls=[],
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
        if chi_dinh.trang_thai == "da_co_ket_qua":
            logger.warning(
                f"🔒 [AUDIT - ATTEMPTED_OVERWRITE_RESULT_ON_LOCKED_ENCOUNTER] order_id={order_id} encounter_id={luot_kham.id} user_id={user.id}"
            )
            raise ConflictException(
                "Kết quả cận lâm sàng của hồ sơ đã khóa không thể sửa đổi trực tiếp. Vui lòng lập biên bản đính chính (Four-Eyes Amendment)!"
            )
        logger.info(
            f"📥 [AUDIT - LATE_RESULT_FULFILLMENT_ON_LOCKED_ENCOUNTER] order_id={order_id} encounter_id={luot_kham.id} tech_user_id={user.id}"
        )

    if chi_dinh.trang_thai == "da_huy":
        raise ConflictException("Y lệnh cận lâm sàng này đã bị hủy, không thể nhập kết quả!")

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
        tep_dinh_kem_urls=self._extract_order_attachments(chi_dinh),
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
    await self.get_authorized_encounter(encounter_id, user, db)
    stmt = (
        select(ChiDinh)
        .options(selectinload(ChiDinh.dich_vu), selectinload(ChiDinh.phieu_ket_qua))
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
            tep_dinh_kem_urls=self._extract_order_attachments(o),
            thoi_gian_tra_ket_qua=o.thoi_gian_tra_ket_qua,
            ket_qua_phan_loai=o.ket_qua_phan_loai or "BINH_THUONG",
            created_at=o.created_at
        )
        for o in orders
    ]
