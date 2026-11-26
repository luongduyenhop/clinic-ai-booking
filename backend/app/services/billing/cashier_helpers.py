from typing import Optional
from sqlalchemy import or_, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.medical import HoaDon, LuotKham, PhieuThuChi
from app.models.user import BenhNhan
from app.schemas.cashier import PatientBrief

def is_lock_not_available(exc: DBAPIError) -> bool:
    orig = getattr(exc, "orig", None)
    candidates = (orig, getattr(orig, "__cause__", None))
    return any(
        getattr(candidate, "sqlstate", None) == "55P03" or getattr(candidate, "pgcode", None) == "55P03"
        for candidate in candidates
        if candidate is not None
    )

def patient_brief(luot_kham: LuotKham) -> PatientBrief:
    benh_nhan = luot_kham.benh_nhan
    nguoi_dung = benh_nhan.nguoi_dung if benh_nhan else None
    return PatientBrief(
        mabn=benh_nhan.ma_dinh_danh_y_te if benh_nhan else None,
        ho_ten=nguoi_dung.ho_ten if nguoi_dung else "Chưa rõ",
        so_dien_thoai=nguoi_dung.so_dien_thoai if nguoi_dung else None,
    )

def doctor_name(luot_kham: LuotKham) -> Optional[str]:
    if luot_kham.lich_kham and luot_kham.lich_kham.bac_si and luot_kham.lich_kham.bac_si.nguoi_dung:
        return luot_kham.lich_kham.bac_si.nguoi_dung.ho_ten
    if luot_kham.bac_si and luot_kham.bac_si.nguoi_dung:
        return luot_kham.bac_si.nguoi_dung.ho_ten
    return None

async def find_invoice_by_ref(
    invoice_ref: int | str,
    db: AsyncSession,
    lock: bool = False,
) -> Optional[HoaDon]:
    ref_str = str(invoice_ref).strip()
    stmt = select(HoaDon).options(
        selectinload(HoaDon.chi_tiet_hoa_don),
        selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
        selectinload(HoaDon.luot_kham),
    )
    if lock:
        stmt = stmt.with_for_update()
    if ref_str.isdigit():
        inv = (await db.execute(stmt.where(HoaDon.id == int(ref_str)))).scalar_one_or_none()
        if inv:
            return inv
    inv = (
        await db.execute(
            stmt.where(
                or_(
                    HoaDon.ma_hoa_don == ref_str,
                    HoaDon.ma_hoa_don == f"HD-{ref_str[:40]}",
                )
            )
        )
    ).scalars().first()
    if inv:
        return inv
    pt_stmt = select(PhieuThuChi.hoa_don_id).where(PhieuThuChi.ma_phieu == ref_str[:50])
    hd_id = (await db.execute(pt_stmt)).scalars().first()
    if hd_id:
        return (await db.execute(stmt.where(HoaDon.id == hd_id))).scalar_one_or_none()
    return None
