from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.admin import (
    DoctorAdminCreateRequest,
    DoctorAdminUpdateRequest,
    DoctorAdminResponse,
    ShiftCreateRequest,
    ShiftToggleLockRequest,
    ShiftResponse,
    EmergencyLeaveDeclareRequest,
    EmergencyLeaveSummaryResponse,
    ReassignQueueRequest,
    ReassignQueueResponse,
    PostponeAndCancelResponse,
    ServiceCreateRequest,
    ServiceItemAdminResponse,
    AdminDashboardStatsResponse,
)
from app.services.admin_service import admin_service

router = APIRouter(prefix="/admin", tags=["7. Quản Trị Phòng Khám & Phân Ca (Admin Portal)"])


def _require_admin(current_user: TaiKhoan = Depends(get_current_user)):
    """Kiểm tra phân quyền: Chỉ tài khoản Admin mới được thao tác cấu hình hệ thống"""
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng quản trị chỉ dành riêng cho Quản trị viên (Admin)!")
    return current_user


# --- 1. Quản lý Bác sĩ ---
@router.get(
    "/doctors",
    response_model=ResponseEnvelope[List[DoctorAdminResponse]],
    summary="Xem danh sách toàn bộ bác sĩ kèm trạng thái nhận lịch hẹn (Bahmni Provider Availability)"
)
async def get_doctors(
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_doctors_admin(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách bác sĩ thành công")


@router.post(
    "/doctors",
    response_model=ResponseEnvelope[DoctorAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới hồ sơ và tài khoản Bác sĩ"
)
async def create_doctor(
    payload: DoctorAdminCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_doctor_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mới bác sĩ {data.ho_ten} thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/doctors/{doctor_id}",
    response_model=ResponseEnvelope[DoctorAdminResponse],
    summary="Cập nhật thông tin hoặc bật/tắt nhận lịch của Bác sĩ"
)
async def update_doctor(
    doctor_id: int,
    payload: DoctorAdminUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.update_doctor_admin(doctor_id, payload, db)
    return ResponseEnvelope.success_response(data=data, message="Cập nhật bác sĩ thành công")


# --- 2. Phân ca trực & Lịch làm việc (OpenEMR 7 Calendar) ---
@router.get(
    "/shifts",
    response_model=ResponseEnvelope[List[ShiftResponse]],
    summary="Lấy danh sách ca làm việc theo tuần/ngày và bác sĩ (OpenEMR Calendar View)"
)
async def get_shifts(
    query_date: Optional[date] = Query(None, description="Ngày lọc ca trực (YYYY-MM-DD)"),
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_shifts(query_date, doctor_id, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách ca làm việc thành công")


@router.post(
    "/shifts",
    response_model=ResponseEnvelope[ShiftResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Phân ca trực mới cho Bác sĩ (OpenEMR In Office Shift)"
)
async def create_shift(
    payload: ShiftCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_shift(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Phân ca làm việc cho bác sĩ thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/shifts/{shift_id}/lock",
    response_model=ResponseEnvelope[ShiftResponse],
    summary="Khóa ca trực hoặc báo nghỉ đột xuất (OpenEMR Out of office rule)"
)
async def toggle_lock_shift(
    shift_id: int,
    payload: ShiftToggleLockRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.toggle_lock_shift(shift_id, payload, db)
    msg = "Đã mở lại ca trực" if data.is_active else f"Đã khóa ca trực: {data.ghi_chu_nghi}"
    return ResponseEnvelope.success_response(data=data, message=msg)


@router.post(
    "/shifts/{shift_id}/emergency-leave",
    response_model=ResponseEnvelope[EmergencyLeaveSummaryResponse],
    summary="Admin khai báo bác sĩ nghỉ đột xuất cho ca trực và thống kê bệnh nhân bị ảnh hưởng"
)
async def declare_emergency_leave(
    shift_id: int,
    payload: EmergencyLeaveDeclareRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.declare_emergency_leave(shift_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Khai báo bác sĩ nghỉ đột xuất thành công! Vui lòng điều phối hàng đợi hoặc tạm hoãn lịch."
    )


@router.post(
    "/shifts/{shift_id}/reassign",
    response_model=ResponseEnvelope[ReassignQueueResponse],
    summary="Admin điều phối chuyển toàn bộ hàng đợi ca nghỉ sang Bác sĩ trực thay thế (cùng chuyên khoa)"
)
async def reassign_queue_to_replacement(
    shift_id: int,
    payload: ReassignQueueRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.reassign_queue_to_replacement(shift_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Đã điều phối hàng đợi thành công sang Bác sĩ {data.ten_bac_si_thay_the}!"
    )


@router.post(
    "/shifts/{shift_id}/postpone-and-cancel",
    response_model=ResponseEnvelope[PostponeAndCancelResponse],
    summary="Admin tạm hoãn hàng đợi và hủy lịch không có người thay thế (Bảo lưu quyền lợi No-fault)"
)
async def postpone_and_cancel_unassigned(
    shift_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.postpone_and_cancel_unassigned(shift_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Đã tạm hoãn hàng đợi và hủy lịch hẹn an toàn!"
    )



# --- 3. Danh mục Dịch vụ & Bảng giá ---
@router.get(
    "/services",
    response_model=ResponseEnvelope[List[ServiceItemAdminResponse]],
    summary="Xem danh mục dịch vụ cận lâm sàng & khám niêm yết"
)
async def get_services(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_services_admin(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục dịch vụ thành công")


@router.post(
    "/services",
    response_model=ResponseEnvelope[ServiceItemAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm mới dịch vụ y tế niêm yết"
)
async def create_service(
    payload: ServiceCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_service_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Thêm dịch vụ {data.ten_dich_vu} thành công!",
        code=status.HTTP_201_CREATED
    )


# --- 4. Dashboard KPIs Dữ liệu thật ---
@router.get(
    "/dashboard-stats",
    response_model=ResponseEnvelope[AdminDashboardStatsResponse],
    summary="Thống kê vận hành phòng khám thời gian thực (Live Database KPIs)"
)
async def get_dashboard_stats(
    query_date: Optional[date] = Query(None, description="Ngày báo cáo (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_dashboard_stats(query_date, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy số liệu thống kê vận hành thành công")
