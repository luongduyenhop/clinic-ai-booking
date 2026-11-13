from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope, PaginationMeta
from app.models.compliance import NhatKyTruyCapDuLieuYTe
from app.models.user import TaiKhoan, NguoiDung, VaiTroEnum

audit_router = APIRouter()

def require_admin(current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan:
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng quản trị chỉ dành riêng cho Quản trị viên (Admin)!")
    return current_user

def parse_date_param(val: Optional[str], is_end_of_day: bool = False) -> Optional[datetime]:
    if not val:
        return None
    cleaned = val.strip()
    if not cleaned:
        return None
    if cleaned.endswith("Z"):
        cleaned = cleaned[:-1] + "+00:00"
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(cleaned, fmt)
            if fmt == "%Y-%m-%d" and is_end_of_day:
                parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(cleaned)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        if is_end_of_day and parsed.hour == 0 and parsed.minute == 0 and parsed.second == 0:
            parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
        return parsed
    except Exception:
        return None

@audit_router.get("/logs", response_model=ResponseEnvelope[dict])
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_user: TaiKhoan = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            NhatKyTruyCapDuLieuYTe,
            TaiKhoan.email.label("user_email"),
            NguoiDung.ho_ten.label("user_full_name"),
        )
        .outerjoin(TaiKhoan, NhatKyTruyCapDuLieuYTe.user_id == TaiKhoan.id)
        .outerjoin(NguoiDung, TaiKhoan.nguoi_dung_id == NguoiDung.id)
    )

    count_stmt = (
        select(func.count(NhatKyTruyCapDuLieuYTe.id))
        .outerjoin(TaiKhoan, NhatKyTruyCapDuLieuYTe.user_id == TaiKhoan.id)
        .outerjoin(NguoiDung, TaiKhoan.nguoi_dung_id == NguoiDung.id)
    )

    filters = []

    if action and action.strip():
        action_clean = action.strip()
        filters.append(
            or_(
                func.upper(NhatKyTruyCapDuLieuYTe.action) == action_clean.upper(),
                NhatKyTruyCapDuLieuYTe.action.ilike(f"%{action_clean}%"),
            )
        )

    if actor and actor.strip():
        actor_clean = actor.strip()
        actor_criteria = [
            NhatKyTruyCapDuLieuYTe.user_role.ilike(f"%{actor_clean}%"),
            TaiKhoan.email.ilike(f"%{actor_clean}%"),
            NguoiDung.ho_ten.ilike(f"%{actor_clean}%"),
        ]
        if actor_clean.isdigit():
            actor_criteria.append(NhatKyTruyCapDuLieuYTe.user_id == int(actor_clean))
        filters.append(or_(*actor_criteria))

    from_dt = parse_date_param(from_date, is_end_of_day=False)
    if from_dt:
        filters.append(NhatKyTruyCapDuLieuYTe.timestamp >= from_dt)

    to_dt = parse_date_param(to_date, is_end_of_day=True)
    if to_dt:
        filters.append(NhatKyTruyCapDuLieuYTe.timestamp <= to_dt)

    if filters:
        stmt = stmt.where(and_(*filters))
        count_stmt = count_stmt.where(and_(*filters))

    total_items = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * page_size
    stmt = (
        stmt.order_by(
            desc(NhatKyTruyCapDuLieuYTe.timestamp),
            desc(NhatKyTruyCapDuLieuYTe.id),
        )
        .offset(offset)
        .limit(page_size)
    )

    rows = (await db.execute(stmt)).all()

    items = []
    for log, user_email, user_full_name in rows:
        actor_display = user_full_name or user_email or f"User #{log.user_id}"
        formatted_time = log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else ""
        iso_time = log.timestamp.isoformat() if log.timestamp else None
        target_name = f"{log.resource_type} #{log.resource_id}" if log.resource_id else (log.resource_type or "Hồ sơ y tế")

        items.append(
            {
                "id": log.id,
                "timestamp": iso_time,
                "thoiGian": formatted_time,
                "user_id": log.user_id,
                "user_role": log.user_role,
                "vaiTro": log.user_role,
                "role": log.user_role,
                "actor": actor_display,
                "nguoiDung": actor_display,
                "action": log.action,
                "hanhDong": log.action,
                "loai_nhat_ky": log.loai_nhat_ky,
                "patient_id": log.patient_id,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "doiTuong": target_name,
                "purpose": log.purpose,
                "mucDich": log.purpose,
                "client_ip": log.client_ip or "127.0.0.1",
                "ip": log.client_ip or "127.0.0.1",
                "noi_dung_cu_json": log.noi_dung_cu_json,
                "noi_dung_moi_json": log.noi_dung_moi_json,
                "ketQua": "SUCCESS",
            }
        )

    meta = PaginationMeta.create(page=page, page_size=page_size, total_items=total_items)
    data = {
        "items": items,
        "total": total_items,
        "total_items": total_items,
        "page": page,
        "page_size": page_size,
        "total_pages": meta.total_pages,
    }
    return ResponseEnvelope.success_response(
        data=data,
        meta=meta,
        message="Lấy danh sách nhật ký kiểm toán thành công",
    )
