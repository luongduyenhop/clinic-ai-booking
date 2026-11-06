from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import TaiKhoan, VaiTroEnum
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.schemas.admin import (
    DoctorLeaveCreateRequest,
    DoctorLeaveResponse,
    DoctorLeaveApproveRequest,
    AffectedBookingItem,
)
from app.services.schedule_service import schedule_service

router = APIRouter(prefix="/schedules", tags=["Schedules & Leaves"])


def _require_admin_or_reception(current_user: TaiKhoan = Depends(get_current_user)):
    if current_user.vai_tro not in (VaiTroEnum.ADMIN.value, VaiTroEnum.LE_TAN.value):
        raise ForbiddenException("Chỉ Quản trị viên hoặc Lễ tân mới có quyền thực hiện chức năng này!")
    return current_user


def _require_admin(current_user: TaiKhoan = Depends(get_current_user)):
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chỉ Quản trị viên mới có quyền phê duyệt đơn nghỉ phép!")
    return current_user


@router.get(
    "/leaves",
    response_model=ResponseEnvelope[List[DoctorLeaveResponse]],
    summary="Danh sách đơn nghỉ phép của bác sĩ"
)
async def get_leaves(
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await schedule_service.get_leaves(db, doctor_id, trang_thai)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách nghỉ phép thành công")


@router.post(
    "/leaves",
    response_model=ResponseEnvelope[DoctorLeaveResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký lịch nghỉ phép bác sĩ"
)
async def create_leave(
    payload: DoctorLeaveCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await schedule_service.create_leave(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Đăng ký nghỉ phép thành công!",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/leaves/{leave_id}/approve",
    response_model=ResponseEnvelope[DoctorLeaveResponse],
    summary="Duyệt đơn nghỉ phép bác sĩ và tự động khóa ca trực"
)
async def approve_leave(
    leave_id: int,
    payload: DoctorLeaveApproveRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await schedule_service.approve_leave(leave_id, payload, current_user, db)
    msg = "Đã duyệt đơn nghỉ phép và khóa ca trực liên quan!" if payload.hanh_dong == "DA_DUYET" else "Đã từ chối đơn nghỉ phép."
    return ResponseEnvelope.success_response(data=data, message=msg)


@router.get(
    "/leaves/{leave_id}/affected-bookings",
    response_model=ResponseEnvelope[List[AffectedBookingItem]],
    summary="Kiểm tra danh sách lịch hẹn bị ảnh hưởng khi bác sĩ nghỉ phép"
)
async def get_leave_affected_bookings(
    leave_id: int,
    current_user: TaiKhoan = Depends(_require_admin_or_reception),
    db: AsyncSession = Depends(get_db)
):
    data = await schedule_service.get_leave_affected_bookings(leave_id, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách lịch hẹn bị ảnh hưởng thành công")
