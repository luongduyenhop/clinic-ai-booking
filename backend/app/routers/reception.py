from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.queue import (
    CheckInRequest,
    WalkInCheckInRequest,
    WalkInQuickRequest,
    QueueTicketResponse,
    DoctorQueueBoardResponse,
    PatientFlowBoardResponse,
    AppointmentReceptionSearchResult,
)
from app.services.queue_service import queue_service

router = APIRouter(prefix="/reception", tags=["6. Tiếp Đón & Điều Phối Hàng Đợi (Bahmni Queue Module)"])


@router.get(
    "/search-appointments",
    response_model=ResponseEnvelope[List[AppointmentReceptionSearchResult]],
    summary="Tìm kiếm lịch hẹn tại quầy tiếp đón theo mã hẹn, số điện thoại hoặc họ tên"
)
async def search_appointments(
    q: str = Query(..., min_length=1, description="Từ khóa: mã hẹn APT, SĐT, hoặc họ tên"),
    query_date: Optional[date] = Query(None, description="Ngày khám cần tra cứu (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    results = await queue_service.search_appointments(q, query_date, db)
    return ResponseEnvelope.success_response(
        data=results,
        message=f"Tìm thấy {len(results)} lịch hẹn phù hợp"
    )


@router.post(
    "/walk-in-quick",
    response_model=ResponseEnvelope[QueueTicketResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tiếp nhận nhanh bệnh nhân vãng lai không đặt trước (nhập họ tên, SĐT, chọn bác sĩ)"
)
async def check_in_walk_in_quick(
    payload: WalkInQuickRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.check_in_walk_in_quick(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tiếp nhận bệnh nhân vãng lai thành công! Số thứ tự #{result.so_thu_tu_kham}.",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/check-in",
    response_model=ResponseEnvelope[QueueTicketResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Lễ tân thực hiện Check-in tại quầy cho bệnh nhân có hẹn trước"
)
async def check_in_patient(
    payload: CheckInRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.check_in_patient(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Check-in thành công! Bệnh nhân được cấp số thứ tự khám #{result.so_thu_tu_kham}.",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/walk-in",
    response_model=ResponseEnvelope[QueueTicketResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tiếp nhận và cấp số thứ tự cho bệnh nhân vãng lai không đặt hẹn trước"
)
async def check_in_walk_in(
    payload: WalkInCheckInRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.check_in_walk_in(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tiếp nhận bệnh nhân vãng lai thành công! Số thứ tự #{result.so_thu_tu_kham}.",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/queue/{doctor_id}",
    response_model=ResponseEnvelope[DoctorQueueBoardResponse],
    summary="Xem màn hình bảng hàng đợi phòng khám theo thời gian thực"
)
async def get_doctor_queue(
    doctor_id: int,
    query_date: Optional[date] = Query(None, description="Ngày cần tra cứu hàng đợi (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_doctor_queue_board(doctor_id, query_date, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy dữ liệu bảng hàng đợi phòng khám thành công"
    )


@router.post(
    "/queue/{ticket_id}/restore",
    response_model=ResponseEnvelope[QueueTicketResponse],
    summary="Lễ tân phục hồi vé tạm hoãn khi bệnh nhân quay lại phòng khám"
)
async def restore_ticket(
    ticket_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.restore_ticket(ticket_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã phục hồi vé khám vào hàng đợi thành công"
    )


@router.get(
    "/flow-board",
    response_model=ResponseEnvelope[PatientFlowBoardResponse],
    summary="Bảng điều phối luân chuyển bệnh nhân toàn diện tại phòng khám (OpenEMR Patient Flow Board)"
)
async def get_patient_flow_board(
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ (tùy chọn)"),
    query_date: Optional[date] = Query(None, description="Ngày cần theo dõi (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_patient_flow_board(doctor_id, query_date, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy dữ liệu Patient Flow Board thành công"
    )
