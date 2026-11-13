from typing import List
from fastapi import APIRouter, Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles, security
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope, PaginationMeta
from app.models.user import BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.patient import (
    FamilyMemberCreateRequest,
    FamilyMemberResponse,
    FamilyMemberUpdateRequest,
    PatientMedicalRecordSummaryResponse,
    PatientLabResultResponse,
    PatientPrescriptionResponse,
    PatientProfileResponse,
    PatientProfileUpdateRequest,
    ServiceFeedbackCreateRequest,
    ServiceFeedbackResponse,
)
from app.services.patient_service import patient_service

router = APIRouter(prefix="/patient", tags=["8. Cổng Khách Hàng / Bệnh Nhân (Patient Portal)"])


async def get_patient_profile_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> TaiKhoan:
    """USER-002 profile contract: missing bearer credentials are reported as 403.

    Other endpoints keep the shared authentication contract (401 for missing
    credentials); an invalid or expired token on this endpoint also remains 401.
    """
    if not credentials or not credentials.credentials:
        raise ForbiddenException("Truy cập hồ sơ bệnh nhân cần Authorization Bearer Token")
    return await get_current_user(credentials, db)


# ── Hồ sơ cá nhân bệnh nhân ──────────────────────────────────────────
@router.get(
    "/profile",
    response_model=ResponseEnvelope[PatientProfileResponse],
    summary="Bệnh nhân xem thông tin hồ sơ sức khỏe và định danh của bản thân"
)
async def get_patient_profile(
    current_user: TaiKhoan = Depends(get_patient_profile_user),
    db: AsyncSession = Depends(get_db)
):
    profile = await patient_service.get_patient_profile(current_user, db)
    return ResponseEnvelope.success_response(
        data=profile,
        message="Lấy thông tin hồ sơ bệnh nhân thành công"
    )


@router.put(
    "/profile",
    response_model=ResponseEnvelope[PatientProfileResponse],
    summary="Bệnh nhân cập nhật thông tin nhân khẩu học và tiền sử sức khỏe"
)
async def update_patient_profile(
    payload: PatientProfileUpdateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    updated = await patient_service.update_patient_profile(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=updated,
        message="Cập nhật hồ sơ bệnh nhân thành công"
    )


# ── Quản lý hồ sơ gia đình (Người thân) ──────────────────────────────
@router.get(
    "/family-members",
    response_model=ResponseEnvelope[List[FamilyMemberResponse]],
    summary="Bệnh nhân xem danh sách hồ sơ người thân (con cái, bố mẹ) để đặt lịch hộ"
)
async def get_family_members(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    members = await patient_service.get_family_members(current_user, db)
    return ResponseEnvelope.success_response(
        data=members,
        message=f"Lấy danh sách {len(members)} thành viên gia đình thành công"
    )


@router.post(
    "/family-members",
    response_model=ResponseEnvelope[FamilyMemberResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm hồ sơ người thân mới vào sổ sức khỏe gia đình"
)
async def create_family_member(
    payload: FamilyMemberCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    member = await patient_service.create_family_member(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=member,
        message=f"Thêm hồ sơ người thân '{member.ho_ten}' thành công",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/family-members/{member_id}",
    response_model=ResponseEnvelope[FamilyMemberResponse],
    summary="Cập nhật thông tin hồ sơ người thân"
)
async def update_family_member(
    member_id: int,
    payload: FamilyMemberUpdateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    updated = await patient_service.update_family_member(member_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=updated,
        message="Cập nhật hồ sơ người thân thành công"
    )


@router.delete(
    "/family-members/{member_id}",
    response_model=ResponseEnvelope[dict],
    summary="Xóa hồ sơ người thân khỏi sổ gia đình"
)
async def delete_family_member(
    member_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await patient_service.delete_family_member(member_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Xóa hồ sơ người thân thành công"
    )


# ── Sổ khám bệnh điện tử EMR ─────────────────────────────────────────
@router.get(
    "/medical-records",
    response_model=ResponseEnvelope[List[PatientMedicalRecordSummaryResponse]],
    summary="Bệnh nhân tra cứu lịch sử các lần khám, chẩn đoán, đơn thuốc và cận lâm sàng"
)
async def get_medical_records(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    records = await patient_service.get_patient_medical_records(current_user, db)
    return ResponseEnvelope.success_response(
        data=records,
        message=f"Tìm thấy {len(records)} lượt khám trong sổ sức khỏe điện tử"
    )


@router.get(
    "/prescriptions",
    response_model=ResponseEnvelope[List[PatientPrescriptionResponse]],
    summary="Bệnh nhân tra cứu đơn thuốc điện tử và liều dùng theo từng buổi"
)
async def get_patient_prescriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    prescriptions, total = await patient_service.get_patient_prescriptions(current_user, db, page, page_size)
    return ResponseEnvelope.success_response(
        meta=PaginationMeta.create(page, page_size, total),
        data=prescriptions,
        message=f"Tìm thấy {len(prescriptions)} đơn thuốc điện tử"
    )


@router.get(
    "/lab-results",
    response_model=ResponseEnvelope[List[PatientLabResultResponse]],
    summary="Bệnh nhân xem và tải kết quả xét nghiệm, chẩn đoán hình ảnh"
)
async def get_patient_lab_results(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    results, total = await patient_service.get_patient_lab_results(current_user, db, page, page_size)
    return ResponseEnvelope.success_response(
        meta=PaginationMeta.create(page, page_size, total),
        data=results,
        message=f"Tìm thấy {len(results)} kết quả cận lâm sàng"
    )


# ── Khảo sát & Đánh giá chất lượng sau khám ──────────────────────────
@router.post(
    "/feedback",
    response_model=ResponseEnvelope[ServiceFeedbackResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Khách hàng gửi đánh giá hài lòng sau khi hoàn tất buổi khám bệnh"
)
async def create_service_feedback(
    payload: ServiceFeedbackCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    feedback = await patient_service.create_service_feedback(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=feedback,
        message="Cảm ơn bạn đã gửi đánh giá chất lượng dịch vụ phòng khám!",
        code=status.HTTP_201_CREATED
    )



class PatientCodeLookup(BaseModel):
    keyword: str = Field(min_length=1, max_length=100)


@router.post(
    "/find-lost-code",
    response_model=ResponseEnvelope[List[dict]],
    summary="Tra cứu mã hồ sơ thuộc tài khoản bệnh nhân đã đăng nhập",
)
async def find_lost_patient_code(
    payload: PatientCodeLookup,
    current_user: TaiKhoan = Depends(require_roles([VaiTroEnum.BENH_NHAN])),
    db: AsyncSession = Depends(get_db)
):
    keyword = payload.keyword.strip()
    stmt = (
        select(BenhNhan, NguoiDung)
        .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
        .where(
            BenhNhan.nguoi_dung_id == current_user.nguoi_dung_id,
            or_(
                NguoiDung.so_dien_thoai == keyword,
                NguoiDung.cccd_so == keyword,
                func.lower(NguoiDung.ho_ten) == keyword.lower(),
            )
        )
    )
    row = (await db.execute(stmt)).one_or_none() if keyword else None
    results = [{"ma_ho_so": row[0].ma_dinh_danh_y_te, "ho_ten": row[1].ho_ten}] if row else []
    return ResponseEnvelope.success_response(
        data=results,
        message=f"Tìm thấy {len(results)} hồ sơ bệnh nhân khớp thông tin"
    )

# Read-only patient billing endpoint. Never allow a patient to mark an invoice paid.
@router.get(
    "/invoices",
    response_model=ResponseEnvelope[List[dict]],
    summary="Bệnh nhân xem hóa đơn của chính mình (không có chức năng xác nhận thanh toán)",
)
async def get_my_invoices(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.medical import HoaDon
    patient = await patient_service._get_current_benh_nhan(current_user, db)
    stmt = select(HoaDon).where(HoaDon.benh_nhan_id == patient.id).order_by(HoaDon.created_at.desc())
    invoices = (await db.execute(stmt)).scalars().all()
    return ResponseEnvelope.success_response(
        data=[
            {
                "id": item.id,
                "ma_hoa_don": item.ma_hoa_don,
                "luot_kham_id": item.luot_kham_id,
                "tong_tien": float(item.tong_tien or 0),
                "mien_giam": float(item.mien_giam or 0),
                "so_tien_phai_thu": float(item.so_tien_phai_thu or 0),
                "thuc_thu": float(item.thuc_thu or 0) if item.trang_thai == "da_thu" else 0.0,
                "trang_thai": item.trang_thai,
                "ngay_thanh_toan": item.ngay_thanh_toan.isoformat() if item.ngay_thanh_toan else None,
            }
            for item in invoices
        ],
        message="Lấy danh sách hóa đơn bệnh nhân thành công",
    )
