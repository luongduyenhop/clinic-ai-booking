from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import TaiKhoan
from app.schemas.admin import (
    DoctorLeaveCreateRequest,
    DoctorLeaveApproveRequest,
    DoctorLeaveResponse,
    AffectedBookingItem,
)
from app.services.admin_shift_service import admin_shift_service


class ScheduleService:

    async def get_leaves(
        self,
        db: AsyncSession,
        doctor_id: Optional[int] = None,
        trang_thai: Optional[str] = None
    ) -> List[DoctorLeaveResponse]:
        return await admin_shift_service.get_leaves_admin(db, doctor_id, trang_thai)

    async def create_leave(
        self,
        payload: DoctorLeaveCreateRequest,
        db: AsyncSession
    ) -> DoctorLeaveResponse:
        return await admin_shift_service.create_leave_admin(payload, db)

    async def approve_leave(
        self,
        leave_id: int,
        payload: DoctorLeaveApproveRequest,
        admin_user: TaiKhoan,
        db: AsyncSession
    ) -> DoctorLeaveResponse:
        return await admin_shift_service.approve_leave_admin(leave_id, payload, admin_user, db)

    async def get_leave_affected_bookings(
        self,
        leave_id: int,
        db: AsyncSession
    ) -> List[AffectedBookingItem]:
        return await admin_shift_service.get_leave_affected_bookings(leave_id, db)


schedule_service = ScheduleService()
