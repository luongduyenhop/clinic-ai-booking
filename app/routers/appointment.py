from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.appointment import (
    DoctorScheduleSlotsResponse,
    AppointmentCreateRequest,
    AppointmentCancelRequest,
    AppointmentResponse,
)
from app.services.appointment_service import appointment_service

router = APIRouter(prefix="/appointments", tags=["2. Đặt Lịch & Điều Phối Slot (Package B)"])


@router.get(
    "/doctors/{doctor_id}/slots",
    response_model=ResponseEnvelope[DoctorScheduleSlotsResponse],
    summary="Xem lịch làm việc và tính toán các slot 30 phút còn trống (UC-B02)"
)
async def get_doctor_slots(
    doctor_id: int,
    query_date: date = Query(..., description="Ngày cần tra cứu lịch khám (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.get_doctor_available_slots(doctor_id, query_date, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy danh sách khung giờ khám thành công"
    )


@router.post(
    "",
    response_model=ResponseEnvelope[AppointmentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Đặt lịch khám trực tuyến - Có cơ chế khóa Pessimistic Locking chống Race Condition (UC-B03)"
)
async def create_booking(
    payload: AppointmentCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.create_booking(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đặt lịch khám thành công! Mã hẹn đã được khởi tạo.",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/{appointment_id}/cancel",
    response_model=ResponseEnvelope[dict],
    summary="Hủy lịch hẹn khám - Ràng buộc an toàn y tế tối thiểu 02 tiếng (UC-B05)"
)
async def cancel_booking(
    appointment_id: int,
    payload: AppointmentCancelRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.cancel_booking(appointment_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=result["message"]
    )


@router.get(
    "/my-appointments",
    response_model=ResponseEnvelope[List[AppointmentResponse]],
    summary="Bệnh nhân tra cứu lịch sử và danh sách lịch hẹn của bản thân kèm số thứ tự (UC-B04)"
)
async def get_my_appointments(
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái lịch (cho_xac_nhan, da_kham, da_huy...)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    appointments = await appointment_service.get_patient_appointments(
        user=current_user,
        db=db,
        trang_thai=trang_thai
    )
    return ResponseEnvelope.success_response(
        data=appointments,
        message="Lấy danh sách lịch hẹn thành công"
    )
