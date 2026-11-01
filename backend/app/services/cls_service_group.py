"""Nhóm dịch vụ cận lâm sàng (Xét nghiệm / CĐHA / TDCN / Nội soi).

DichVu chưa có cột nhóm riêng nên nhóm được suy ra từ `ma_nhom_byt` (không cần migration).
Seed cũ xếp nội soi chung nhóm thủ thuật "TT", nên các mã `DV_NS_*` được nhận diện theo tiền tố.
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy import and_, func, or_

from app.core.config import settings
from app.models.medical import DichVu

XET_NGHIEM = "XET_NGHIEM"
CDHA = "CDHA"
TDCN = "TDCN"
NOI_SOI = "NOI_SOI"
CLS_GROUPS = (XET_NGHIEM, CDHA, TDCN, NOI_SOI)

# Giờ phòng khám để xác định "hôm nay" cho hàng đợi CLS
CLINIC_TZ = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))

_NHOM_BYT_TO_GROUP = {
    "XN": XET_NGHIEM,
    "XET_NGHIEM": XET_NGHIEM,
    "CDHA": CDHA,
    "SA": CDHA,
    "XQ": CDHA,
    "CT": CDHA,
    "MRI": CDHA,
    "TDCN": TDCN,
    "NS": NOI_SOI,
    "NOI_SOI": NOI_SOI,
}

_MA_DICH_VU_PREFIX_TO_GROUP = (("DV_NS_", NOI_SOI),)


def nhom_dich_vu_of(ma_nhom_byt: Optional[str], ma_dich_vu: Optional[str] = None) -> Optional[str]:
    """Trả về nhóm CLS của dịch vụ, None nếu không phải dịch vụ cận lâm sàng (khám, thủ thuật...)"""
    group = _NHOM_BYT_TO_GROUP.get((ma_nhom_byt or "").strip().upper())
    if group:
        return group
    for prefix, prefix_group in _MA_DICH_VU_PREFIX_TO_GROUP:
        if ma_dich_vu and ma_dich_vu.upper().startswith(prefix):
            return prefix_group
    return None


def nhom_dich_vu_condition(group: str):
    """Điều kiện SQL trên DichVu tương đương với nhom_dich_vu_of(...) == group"""
    nhom_byt = func.upper(func.coalesce(DichVu.ma_nhom_byt, ""))
    codes = [code for code, code_group in _NHOM_BYT_TO_GROUP.items() if code_group == group]
    prefixes = [prefix for prefix, prefix_group in _MA_DICH_VU_PREFIX_TO_GROUP if prefix_group == group]
    by_prefix = [
        and_(
            nhom_byt.notin_(list(_NHOM_BYT_TO_GROUP)),
            func.upper(DichVu.ma_dich_vu).startswith(prefix, autoescape=True),
        )
        for prefix in prefixes
    ]
    return or_(nhom_byt.in_(codes), *by_prefix)


def clinic_day_range(day: Optional[date] = None) -> Tuple[datetime, datetime]:
    """Khoảng [00:00, 24:00) của một ngày theo giờ phòng khám, mặc định là hôm nay"""
    day = day or datetime.now(CLINIC_TZ).date()
    start = datetime.combine(day, time.min, tzinfo=CLINIC_TZ)
    return start, start + timedelta(days=1)
