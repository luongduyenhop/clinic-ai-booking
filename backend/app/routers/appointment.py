from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.appointment import (
    DoctorScheduleSlotsResponse,
    AppointmentCreateRequest,
    AppointmentCancelRequest,
    AppointmentCancelResponse,
    AppointmentResponse,
    AppointmentConfirmResponse,
    NoShowMarkRequest,
    NoShowMarkResponse,
    WaitlistCreateRequest,
    WaitlistResponse,
    AutoProcessNoShowResponse,
    AppointmentRescheduleRequest,
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
    response_model=ResponseEnvelope[AppointmentCancelResponse],
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
        message="Đã hủy lịch hẹn khám thành công và giải phóng khung giờ cho người bệnh khác."
    )


@router.post(
    "/{appointment_id}/reschedule",
    response_model=ResponseEnvelope[AppointmentResponse],
    summary="Đổi lịch hẹn khám sang khung giờ mới - Ràng buộc an toàn y tế tối thiểu 02 tiếng (UC-B03/B05)"
)
async def reschedule_booking(
    appointment_id: int,
    payload: AppointmentRescheduleRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.reschedule_booking(appointment_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đổi lịch hẹn khám thành công! Khung giờ mới đã được cập nhật."
    )


@router.get(
    "/doctor-shift",
    response_model=ResponseEnvelope[List[dict]],
    summary="Bác sĩ lấy danh sách ca khám và lịch hẹn trong ngày phục vụ Doctor Portal Workstation"
)
async def get_doctor_shift_appointments(
    date_str: Optional[str] = Query(None, description="Ngày tra cứu (YYYY-MM-DD)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    appointments = await appointment_service.get_doctor_shift_appointments(
        date_str=date_str,
        user=current_user,
        db=db
    )
    return ResponseEnvelope.success_response(
        data=appointments,
        message="Lấy danh sách ca khám bác sĩ thành công"
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


@router.post(
    "/{appointment_id}/confirm",
    response_model=ResponseEnvelope[AppointmentConfirmResponse],
    summary="Bệnh nhân xác nhận lịch hẹn trước 24h để giữ slot khám (Reconfirmation Flow)"
)
async def confirm_appointment(
    appointment_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.confirm_appointment(appointment_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=result.message
    )


@router.post(
    "/{appointment_id}/no-show",
    response_model=ResponseEnvelope[NoShowMarkResponse],
    summary="Bác sĩ hoặc Quản trị viên đánh dấu bệnh nhân vắng mặt (No-show)"
)
async def mark_no_show(
    appointment_id: int,
    payload: Optional[NoShowMarkRequest] = None,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    req_payload = payload or NoShowMarkRequest()
    result = await appointment_service.mark_no_show(appointment_id, req_payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã ghi nhận người bệnh vắng mặt (No-show) thành công"
    )


@router.post(
    "/waitlist",
    response_model=ResponseEnvelope[WaitlistResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Bệnh nhân đăng ký vào danh sách chờ khi ca khám hết slot (OpenMRS Smart Waitlist)"
)
async def register_waitlist(
    payload: WaitlistCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.register_waitlist(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đăng ký danh sách chờ thành công! Vị trí ưu tiên của bạn là #{result.thu_tu_uu_tien}.",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/my-waitlist",
    response_model=ResponseEnvelope[List[WaitlistResponse]],
    summary="Bệnh nhân tra cứu danh sách các ca khám đang chờ slot của mình"
)
async def get_my_waitlist(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.get_my_waitlist(current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy danh sách chờ khám thành công"
    )


@router.post(
    "/waitlist/{waitlist_id}/accept",
    response_model=ResponseEnvelope[AppointmentResponse],
    summary="Bệnh nhân xác nhận nhận slot khám được ưu tiên từ Danh sách chờ (Waitlist Acceptance)"
)
async def accept_waitlist_slot(
    waitlist_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.accept_waitlist_slot(waitlist_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Nhận slot khám thành công! Lịch hẹn của bạn đã được khởi tạo chính thức."
    )


@router.post(
    "/process-unconfirmed",
    response_model=ResponseEnvelope[AutoProcessNoShowResponse],
    summary="Kích hoạt tự động hủy các lịch hẹn chưa xác nhận trước 2 tiếng và đôn danh sách chờ"
)
async def process_unconfirmed_appointments(
    hours_threshold: float = Query(2.0, ge=0.5, le=24.0, description="Ngưỡng giờ trước giờ khám để tự động hủy"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chỉ Quản trị viên hệ thống (Admin) mới có quyền kích hoạt tiến trình tự động hủy lịch!")
    result = await appointment_service.auto_process_unconfirmed_and_waitlist(db, hours_threshold=hours_threshold)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Xử lý tự động hoàn tất: {result.so_lich_tu_dong_huy} lịch bị hủy, đôn {result.so_nguoi_don_waitlist} người từ Waitlist."
    )


