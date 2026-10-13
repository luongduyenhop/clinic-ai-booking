from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.services.notification_service import notification_service

router = APIRouter(prefix="/notifications", tags=["9. Thông Báo Hệ Thống & Nhắc Lịch (Notification Center)"])


@router.get(
    "",
    response_model=ResponseEnvelope[List[NotificationResponse]],
    include_in_schema=False
)
@router.get(
    "/my-notifications",
    response_model=ResponseEnvelope[List[NotificationResponse]],
    summary="Xem danh sách thông báo của người dùng hiện tại (Nhắc lịch, Gọi số, Kết quả CLS)"
)
async def get_my_notifications(
    limit: int = Query(20, ge=1, le=100, description="Số lượng thông báo tối đa"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    items = await notification_service.get_my_notifications(current_user, db, limit=limit)
    return ResponseEnvelope.success_response(
        data=items,
        message="Lấy danh sách thông báo thành công"
    )


@router.get(
    "/unread-count",
    response_model=ResponseEnvelope[UnreadCountResponse],
    summary="Đếm số lượng thông báo chưa đọc phục vụ hiển thị Badge trên thanh Header"
)
async def get_unread_count(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await notification_service.get_unread_count(current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy số lượng thông báo chưa đọc thành công"
    )


@router.put(
    "/{notification_id}/read",
    response_model=ResponseEnvelope[NotificationResponse],
    summary="Đánh dấu một thông báo là đã đọc"
)
async def mark_notification_read(
    notification_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = await notification_service.mark_as_read(notification_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=item,
        message="Đã đánh dấu thông báo là đã đọc"
    )


@router.put(
    "/read-all",
    response_model=ResponseEnvelope[dict],
    summary="Đánh dấu tất cả thông báo là đã đọc"
)
async def mark_all_read(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await notification_service.mark_all_as_read(current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã đánh dấu toàn bộ thông báo là đã đọc"
    )
