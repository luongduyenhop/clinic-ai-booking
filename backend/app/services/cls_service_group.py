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

_MA_DICH_VU_PREFIX_TO_GROUP = (
    ("DV_NS_", NOI_SOI),
    ("DV_XN_", XET_NGHIEM),
    ("DV_TEST_", XET_NGHIEM),
    ("DV_SA_", CDHA),
    ("DV_XQ_", CDHA),
    ("DV_CT_", CDHA),
    ("DV_MRI_", CDHA),
    ("DV_ECG", TDCN),
    ("DV_EEG", TDCN),
    ("DV_HO_HAP_", TDCN),
    ("DV_DO_", TDCN),
)


def nhom_dich_vu_of(ma_nhom_byt: Optional[str], ma_dich_vu: Optional[str] = None) -> Optional[str]:
    group = _NHOM_BYT_TO_GROUP.get((ma_nhom_byt or "").strip().upper())
    if group:
        return group
    for prefix, prefix_group in _MA_DICH_VU_PREFIX_TO_GROUP:
        if ma_dich_vu and ma_dich_vu.upper().startswith(prefix):
            return prefix_group
    return None


def nhom_dich_vu_condition(group: str):
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
    day = day or datetime.now(CLINIC_TZ).date()
    start = datetime.combine(day, time.min, tzinfo=CLINIC_TZ)
    return start, start + timedelta(days=1)
