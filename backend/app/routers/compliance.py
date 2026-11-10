from typing import List
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.compliance import (
    ComplianceDashboardResponse,
    DoctorLicenseResponse,
    DoctorLicenseStatusUpdateRequest,
    DoctorLicenseUpdateRequest,
    FacilityLicenseCreateRequest,
    FacilityLicenseResponse,
    FacilityLicenseUpdateRequest,
    HealthDataAccessLogCreate,
    HealthDataAccessLogResponse,
    LicenseAuditHistoryResponse,
    LicenseExpiryAlertResponse,
)
from app.services.audit_trail_service import audit_trail_service
from app.services.compliance_dashboard_service import compliance_dashboard_service
from app.services.credential_service import credential_service

router = APIRouter(prefix="/compliance", tags=["Compliance & Credentialing (INT-05)"])


def _require_admin(current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan:
    """Yêu cầu quyền Quản trị viên cho các tác vụ kiểm toán & cấp phép"""
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng quản lý tuân thủ pháp lý chỉ dành riêng cho Quản trị viên!")
    return current_user


# ==============================================================================
# 1. QUẢN LÝ GIẤY PHÉP BÁC SĨ (DOCTOR CREDENTIALING)
# ==============================================================================

@router.get(
    "/doctors/{doctor_id}/license",
    response_model=ResponseEnvelope[DoctorLicenseResponse],
    summary="Xem thông tin chi tiết giấy phép hành nghề của bác sĩ (INT-05)"
)
async def get_doctor_license(
    doctor_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.get_doctor_license(db, doctor_id)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy thông tin giấy phép bác sĩ thành công"
    )


@router.put(
    "/doctors/{doctor_id}/license",
    response_model=ResponseEnvelope[DoctorLicenseResponse],
    summary="Cập nhật thông tin giấy phép hành nghề bác sĩ (INT-05)"
)
async def update_doctor_license(
    doctor_id: int,
    payload: DoctorLicenseUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.update_doctor_license(db, doctor_id, payload, user_id=current_user.id)
    return ResponseEnvelope.success_response(
        data=result,
        message="Cập nhật thông tin giấy phép thành công"
    )


@router.post(
    "/doctors/{doctor_id}/license/status",
    response_model=ResponseEnvelope[DoctorLicenseResponse],
    summary="Cập nhật trạng thái giấy phép bác sĩ có lưu vết kiểm toán (INT-05 Audit)"
)
async def update_doctor_license_status(
    doctor_id: int,
    payload: DoctorLicenseStatusUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.update_doctor_license_status(db, doctor_id, payload, user_id=current_user.id)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Cập nhật trạng thái giấy phép thành {payload.trang_thai_moi} thành công"
    )


@router.get(
    "/doctors/{doctor_id}/license/history",
    response_model=ResponseEnvelope[List[LicenseAuditHistoryResponse]],
    summary="Xem lịch sử biến động trạng thái giấy phép bác sĩ (Audit History)"
)
async def get_doctor_license_history(
    doctor_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.get_doctor_license_history(db, doctor_id)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy lịch sử biến động giấy phép thành công"
    )


# ==============================================================================
# 2. CẢNH BÁO HẾT HẠN GIẤY PHÉP 90/60/30 NGÀY (EXPIRY ALERTS)
# ==============================================================================

@router.get(
    "/alerts/expiring-licenses",
    response_model=ResponseEnvelope[LicenseExpiryAlertResponse],
    summary="Báo cáo cảnh báo giấy phép sắp hết hạn 90, 60, 30 ngày (INT-05)"
)
async def get_license_expiry_alerts(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.get_license_expiry_alerts(db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tổng hợp thành công {result.total_alerts} cảnh báo giấy phép"
    )


# ==============================================================================
# 3. QUẢN LÝ GIẤY PHÉP CƠ SỞ (FACILITY CREDENTIALING)
# ==============================================================================

@router.post(
    "/facility-licenses",
    response_model=ResponseEnvelope[FacilityLicenseResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới Giấy phép hoạt động cơ sở y tế (GiayPhepCoSo)"
)
async def create_facility_license(
    payload: FacilityLicenseCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.create_facility_license(db, payload)
    return ResponseEnvelope.success_response(
        data=result,
        message="Tạo mới giấy phép cơ sở thành công",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/facility-licenses",
    response_model=ResponseEnvelope[List[FacilityLicenseResponse]],
    summary="Danh sách giấy phép hoạt động cơ sở y tế"
)
async def list_facility_licenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.list_facility_licenses(db, skip=skip, limit=limit)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy danh sách giấy phép cơ sở thành công"
    )


@router.get(
    "/facility-licenses/{license_id}",
    response_model=ResponseEnvelope[FacilityLicenseResponse],
    summary="Chi tiết Giấy phép hoạt động cơ sở"
)
async def get_facility_license(
    license_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.get_facility_license(db, license_id)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy thông tin giấy phép cơ sở thành công"
    )


@router.put(
    "/facility-licenses/{license_id}",
    response_model=ResponseEnvelope[FacilityLicenseResponse],
    summary="Cập nhật Giấy phép hoạt động cơ sở"
)
async def update_facility_license(
    license_id: int,
    payload: FacilityLicenseUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await credential_service.update_facility_license(db, license_id, payload)
    return ResponseEnvelope.success_response(
        data=result,
        message="Cập nhật giấy phép cơ sở thành công"
    )


@router.delete(
    "/facility-licenses/{license_id}",
    response_model=ResponseEnvelope[dict],
    summary="Xóa Giấy phép hoạt động cơ sở"
)
async def delete_facility_license(
    license_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    await credential_service.delete_facility_license(db, license_id)
    return ResponseEnvelope.success_response(
        data={"deleted_id": license_id},
        message="Xóa giấy phép cơ sở thành công"
    )


# ==============================================================================
# 4. NHẬT KÝ KIỂM TOÁN TRUY CẬP DỮ LIỆU SỨC KHỎE (INT-03 / AUDIT TRAIL)
# ==============================================================================

@router.post(
    "/audit/log",
    response_model=ResponseEnvelope[HealthDataAccessLogResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Ghi nhận nhật ký truy cập dữ liệu sức khỏe bất biến (INT-03 / NĐ 102/2025/NĐ-CP)"
)
async def log_health_data_access(
    payload: HealthDataAccessLogCreate,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    entry = await audit_trail_service.log_access(
        db=db,
        user_id=current_user.id,
        user_role=current_user.vai_tro,
        patient_id=payload.patient_id,
        action=payload.action,
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        purpose=payload.purpose,
    )
    return ResponseEnvelope.success_response(
        data=entry,
        message="Ghi nhật ký kiểm toán truy cập dữ liệu y tế thành công",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/audit/patients/{patient_id}",
    response_model=ResponseEnvelope[List[HealthDataAccessLogResponse]],
    summary="Xem lịch sử truy cập hồ sơ bệnh nhân (Audit Trail - Chỉ Admin & Bác sĩ)"
)
async def get_patient_audit_trail(
    patient_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in (VaiTroEnum.ADMIN.value, VaiTroEnum.BAC_SI.value):
        raise ForbiddenException("Chỉ Quản trị viên và Bác sĩ mới có quyền tra cứu nhật ký kiểm toán y tế!")
    logs = await audit_trail_service.get_patient_access_logs(db, patient_id, skip=skip, limit=limit)
    return ResponseEnvelope.success_response(
        data=logs,
        message="Truy xuất nhật ký kiểm toán truy cập thành công"
    )


# ==============================================================================
# 5. BẢNG ĐIỀU KHIỂN & BÁO CÁO GIÁM SÁT TUÂN THỦ (INT-05 / INT-04 / INT-03 / R5)
# ==============================================================================

@router.get(
    "/dashboard",
    response_model=ResponseEnvelope[ComplianceDashboardResponse],
    summary="Bảng điều khiển giám sát tuân thủ pháp lý y tế (Compliance Dashboard - Admin only)"
)
async def get_compliance_dashboard(
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    dashboard = await compliance_dashboard_service.get_compliance_dashboard(db)
    return ResponseEnvelope.success_response(
        data=dashboard,
        message="Lấy dữ liệu bảng điều khiển tuân thủ thành công"
    )


@router.get(
    "/reports/export",
    summary="Xuất báo cáo tuân thủ phục vụ thanh kiểm tra y tế (JSON / CSV)"
)
async def export_compliance_report(
    format: str = Query("JSON", description="Định dạng báo cáo: JSON hoặc CSV"),
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    import json
    content = await compliance_dashboard_service.export_compliance_report(db, format=format)
    fmt_upper = (format or "").strip().upper()
    if fmt_upper == "CSV":
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=bao_cao_tuan_thu_y_te.csv"}
        )
    return ResponseEnvelope.success_response(
        data=json.loads(content),
        message="Xuất báo cáo tuân thủ định dạng JSON thành công"
    )

