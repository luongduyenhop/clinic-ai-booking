from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, UnprocessableEntityException
from app.models.compliance import (
    NhatKyTruyCapDuLieuYTe,
)


class AuditTrailService:
    """
    Nghiệp vụ ghi nhận kiểm toán truy cập dữ liệu sức khỏe bất biến (INT-03 / R4)
    Tuân thủ Nghị định 102/2025/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15.
    Nguyên tắc cốt lõi: APPEND-ONLY, không thể sửa/xóa, bắt buộc có Patient ID và Mục đích truy cập.
    """

    async def log_access(
        self,
        db: AsyncSession,
        user_id: int,
        user_role: str,
        patient_id: int,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        purpose: str = "",
        client_ip: Optional[str] = "127.0.0.1",
    ) -> NhatKyTruyCapDuLieuYTe:
        """Ghi nhận hành vi truy cập (VIEW, EDIT, EXPORT, AMEND) dữ liệu sức khỏe"""
        if not user_id or not user_role:
            raise ForbiddenException("Không thể ghi log kiểm toán: thiếu thông tin định danh người dùng!")
        if not patient_id:
            raise UnprocessableEntityException("Mỗi truy cập dữ liệu sức khỏe bắt buộc phải gắn với Patient ID cụ thể!")
        if not purpose or len(purpose.strip()) < 3:
            raise UnprocessableEntityException("Mục đích truy cập dữ liệu sức khỏe (Purpose) là bắt buộc theo NĐ 102/2025/NĐ-CP!")

        log_entry = NhatKyTruyCapDuLieuYTe(
            user_id=user_id,
            user_role=user_role,
            patient_id=patient_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            purpose=purpose.strip(),
            client_ip=client_ip or "127.0.0.1",
            timestamp=datetime.now(timezone.utc),
        )
        db.add(log_entry)
        await db.flush()
        return log_entry

    async def get_patient_access_logs(
        self,
        db: AsyncSession,
        patient_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> List[NhatKyTruyCapDuLieuYTe]:
        """Truy xuất danh sách nhật ký truy cập dữ liệu của một bệnh nhân theo thời gian mới nhất"""
        stmt = (
            select(NhatKyTruyCapDuLieuYTe)
            .where(NhatKyTruyCapDuLieuYTe.patient_id == patient_id)
            .order_by(desc(NhatKyTruyCapDuLieuYTe.timestamp))
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    def assert_immutable(self, log_id: int):
        """Khẳng định tính bất biến: Không một bản ghi nào được phép sửa hay xóa"""
        raise ForbiddenException("Bảng nhật ký truy cập dữ liệu sức khỏe là APPEND-ONLY. Mọi hành vi sửa/xóa bị nghiêm cấm!")


audit_trail_service = AuditTrailService()
