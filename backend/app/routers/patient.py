from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.patient import (
    FamilyMemberCreateRequest,
    FamilyMemberResponse,
    FamilyMemberUpdateRequest,
    PatientMedicalRecordSummaryResponse,
    PatientProfileResponse,
    PatientProfileUpdateRequest,
    ServiceFeedbackCreateRequest,
    ServiceFeedbackResponse,
)
from app.services.patient_service import patient_service

router = APIRouter(prefix="/patient", tags=["8. Cổng Khách Hàng / Bệnh Nhân (Patient Portal)"])


# ── Hồ sơ cá nhân bệnh nhân ──────────────────────────────────────────
@router.get(
    "/profile",
    response_model=ResponseEnvelope[PatientProfileResponse],
    summary="Bệnh nhân xem thông tin hồ sơ sức khỏe và định danh của bản thân"
)
async def get_patient_profile(
    current_user: TaiKhoan = Depends(get_current_user),
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



@router.post(
    "/find-lost-code",
    response_model=ResponseEnvelope[List[dict]],
    summary="Tra cứu lại Mã hồ sơ bệnh nhân bị quên qua Số điện thoại hoặc CCCD (Kế thừa từ TheDuckHospital)"
)
async def find_lost_patient_code(
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select, or_
    from app.models.user import BenhNhan, NguoiDung

    keyword = str(payload.get("keyword") or payload.get("so_dien_thoai") or payload.get("cccd") or "").strip()
    if len(keyword) < 3:
        return ResponseEnvelope.success_response(data=[], message="Vui lòng nhập ít nhất 3 ký tự Số điện thoại hoặc CCCD")

    stmt = (
        select(BenhNhan, NguoiDung)
        .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
        .where(
            or_(
                NguoiDung.so_dien_thoai.ilike(f"%{keyword}%"),
                BenhNhan.cccd_so.ilike(f"%{keyword}%"),
                NguoiDung.ho_ten.ilike(f"%{keyword}%"),
            )
        )
        .limit(10)
    )
    rows = (await db.execute(stmt)).all()
    results = [
        {
            "benh_nhan_id": bn.id,
            "ma_ho_so": f"BN-{bn.id:05d}",
            "ho_ten": nd.ho_ten,
            "so_dien_thoai": nd.so_dien_thoai,
            "ngay_sinh": nd.ngay_sinh.isoformat() if nd.ngay_sinh else None,
            "gioi_tinh": nd.gioi_tinh,
            "cccd_so": bn.cccd_so,
            "nhom_mau": bn.nhom_mau,
        }
        for bn, nd in rows
    ]
    return ResponseEnvelope.success_response(
        data=results,
        message=f"Tìm thấy {len(results)} hồ sơ bệnh nhân khớp thông tin"
    )
