from datetime import datetime, timezone
from typing import List
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.content import ThongBao
from app.models.user import TaiKhoan
from app.schemas.notification import NotificationCreateRequest, NotificationResponse, UnreadCountResponse


class NotificationService:
    """Tầng dịch vụ quản lý thông báo hệ thống và thông báo đẩy trong ứng dụng"""

    async def get_my_notifications(
        self,
        user: TaiKhoan,
        db: AsyncSession,
        limit: int = 20,
    ) -> List[NotificationResponse]:
        stmt = (
            select(ThongBao)
            .where(ThongBao.tai_khoan_id == user.id)
            .order_by(desc(ThongBao.created_at))
            .limit(limit)
        )
        notifications = (await db.execute(stmt)).scalars().all()
        return [NotificationResponse.model_validate(n) for n in notifications]

    async def get_unread_count(
        self,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> UnreadCountResponse:
        stmt = (
            select(func.count(ThongBao.id))
            .where(
                ThongBao.tai_khoan_id == user.id,
                ThongBao.da_doc == False,  # noqa: E712
            )
        )
        count = (await db.execute(stmt)).scalar() or 0
        return UnreadCountResponse(unread_count=count)

    async def mark_as_read(
        self,
        notification_id: int,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> NotificationResponse:
        stmt = select(ThongBao).where(
            ThongBao.id == notification_id,
            ThongBao.tai_khoan_id == user.id,
        )
        noti = (await db.execute(stmt)).scalar_one_or_none()
        if not noti:
            raise NotFoundException("Không tìm thấy thông báo hoặc bạn không có quyền truy cập!")

        noti.da_doc = True
        noti.thoi_gian_doc = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(noti)
        return NotificationResponse.model_validate(noti)

    async def mark_all_as_read(
        self,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> dict:
        stmt = select(ThongBao).where(
            ThongBao.tai_khoan_id == user.id,
            ThongBao.da_doc == False,  # noqa: E712
        )
        unread = (await db.execute(stmt)).scalars().all()
        now = datetime.now(timezone.utc)
        for n in unread:
            n.da_doc = True
            n.thoi_gian_doc = now
        await db.commit()
        return {"updated_count": len(unread)}

    async def create_notification(
        self,
        payload: NotificationCreateRequest,
        db: AsyncSession,
    ) -> NotificationResponse:
        noti = ThongBao(
            tai_khoan_id=payload.tai_khoan_id,
            tieu_de=payload.tieu_de,
            noi_dung=payload.noi_dung,
            loai_thong_bao=payload.loai_thong_bao,
            lien_ket_url=payload.lien_ket_url,
            du_lieu_phu_json=payload.du_lieu_phu_json or {},
            da_doc=False,
        )
        db.add(noti)
        await db.commit()
        await db.refresh(noti)
        return NotificationResponse.model_validate(noti)


notification_service = NotificationService()
