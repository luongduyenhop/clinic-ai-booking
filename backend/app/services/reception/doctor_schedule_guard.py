from datetime import date
from typing import Optional, Tuple

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictException, NotFoundException
from app.models.appointment import (
    LichLamViec,
    NghiPhepBacSi,
    TrangThaiNghiPhepEnum,
)
from app.models.user import BacSi


async def is_doctor_on_approved_leave(
    doctor_id: int,
    target_date: date,
    ca_kham: Optional[str],
    db: AsyncSession,
) -> bool:
    stmt = select(NghiPhepBacSi.id).where(
        NghiPhepBacSi.bac_si_id == doctor_id,
        NghiPhepBacSi.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value,
        NghiPhepBacSi.tu_ngay <= target_date,
        NghiPhepBacSi.den_ngay >= target_date,
    )
    if ca_kham:
        stmt = stmt.where(
            or_(
                NghiPhepBacSi.ca_lam_viec.is_(None),
                NghiPhepBacSi.ca_lam_viec == ca_kham,
            )
        )
    return (await db.execute(stmt.limit(1))).scalar_one_or_none() is not None


async def validate_doctor_shift_available(
    doctor_id: int,
    target_date: date,
    ca_kham: str,
    db: AsyncSession,
    *,
    require_explicit_shift: bool = False,
) -> Optional[LichLamViec]:
    stmt_bs = (
        select(BacSi)
        .options(selectinload(BacSi.nguoi_dung))
        .where(BacSi.id == doctor_id)
    )
    bs = (await db.execute(stmt_bs)).scalar_one_or_none()
    if not bs:
        raise NotFoundException("Không tìm thấy thông tin bác sĩ tiếp nhận!")

    doc_name = bs.nguoi_dung.ho_ten if bs.nguoi_dung else f"ID {doctor_id}"
    if not bs.is_active:
        raise ConflictException(f"Bác sĩ {doc_name} hiện đang ngừng hoạt động, không thể tiếp nhận!")

    if await is_doctor_on_approved_leave(doctor_id, target_date, ca_kham, db):
        raise ConflictException(
            f"Bác sĩ {doc_name} đang nghỉ phép trong ca {ca_kham} ngày {target_date.strftime('%d/%m/%Y')}, "
            f"vui lòng chọn hoặc điều phối sang bác sĩ khác!"
        )

    stmt_shift = (
        select(LichLamViec)
        .where(
            LichLamViec.bac_si_id == doctor_id,
            LichLamViec.ngay_lam_viec == target_date,
            LichLamViec.ca_lam_viec == ca_kham,
            LichLamViec.is_active.is_(True),
        )
        .order_by(LichLamViec.id.desc())
    )
    shift = (await db.execute(stmt_shift)).scalars().first()
    if shift:
        return shift

    if require_explicit_shift:
        raise ConflictException(
            f"Bác sĩ {doc_name} không có lịch làm việc trong ca {ca_kham} ngày {target_date.strftime('%d/%m/%Y')}!"
        )

    has_any_schedule_for_day = (
        await db.execute(
            select(LichLamViec.id)
            .where(LichLamViec.ngay_lam_viec == target_date)
            .limit(1)
        )
    ).scalar_one_or_none() is not None
    if has_any_schedule_for_day:
        raise ConflictException(
            f"Bác sĩ {doc_name} không có lịch làm việc trong ca {ca_kham} ngày {target_date.strftime('%d/%m/%Y')}!"
        )
    return None


async def find_room_shift_doctor(
    room_id: int,
    target_date: date,
    ca_kham: str,
    db: AsyncSession,
) -> Tuple[Optional[int], Optional[int]]:
    stmt_rosters = (
        select(LichLamViec)
        .join(BacSi, LichLamViec.bac_si_id == BacSi.id)
        .where(
            LichLamViec.phong_kham_id == room_id,
            LichLamViec.ngay_lam_viec == target_date,
            LichLamViec.ca_lam_viec == ca_kham,
            LichLamViec.is_active.is_(True),
            BacSi.is_active.is_(True),
        )
        .order_by(LichLamViec.id.asc())
    )
    rosters = (await db.execute(stmt_rosters)).scalars().all()
    for roster in rosters:
        if not await is_doctor_on_approved_leave(roster.bac_si_id, target_date, ca_kham, db):
            return roster.id, roster.bac_si_id
    return None, None
