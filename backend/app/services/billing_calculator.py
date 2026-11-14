from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable, List, Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnprocessableEntityException
from app.models.medical import ChiDinh, DichVu, LuotKham

MA_DICH_VU_KHAM_CO_BAN = "KHAM_LAM_SANG_CO_BAN"
ZERO = Decimal("0.00")

THONG_BAO_THIEU_CAU_HINH_GIA_KHAM = (
    f"Chưa cấu hình dịch vụ khám lâm sàng cơ bản (mã {MA_DICH_VU_KHAM_CO_BAN}) hoặc đơn giá chưa hợp lệ. "
    "Vui lòng liên hệ quản trị viên để cấu hình danh mục dịch vụ."
)


@dataclass(frozen=True)
class BillingLine:
    loai_muc: str
    muc_tham_chieu_id: Optional[int]
    ten_khoan_thu: str
    so_luong: int
    don_gia: Decimal
    thanh_tien: Decimal
    ghi_chu: Optional[str] = None


@dataclass(frozen=True)
class BillingEstimate:
    lines: List[BillingLine]
    tong_tien: Decimal


class ExamServiceResolver:
    def __init__(self) -> None:
        self._service: Optional[DichVu] = None
        self._loaded = False

    async def get(self, db: AsyncSession) -> DichVu:
        if not self._loaded:
            stmt = select(DichVu).where(
                DichVu.ma_dich_vu == MA_DICH_VU_KHAM_CO_BAN,
                DichVu.is_active.is_(True),
            )
            self._service = (await db.execute(stmt)).scalar_one_or_none()
            self._loaded = True
        service = self._service
        if service is None or service.don_gia is None or Decimal(str(service.don_gia)) <= ZERO:
            raise UnprocessableEntityException(THONG_BAO_THIEU_CAU_HINH_GIA_KHAM)
        return service


def build_cls_lines(
    chi_dinh_list: Optional[Iterable[ChiDinh]],
    excluded_ids: Optional[Set[int]] = None,
    included_ids: Optional[Set[int]] = None,
) -> List[BillingLine]:
    lines: List[BillingLine] = []
    excluded = excluded_ids or set()
    for cd in chi_dinh_list or []:
        if cd.trang_thai == "da_huy" or cd.id in excluded:
            continue
        if included_ids is not None and cd.id not in included_ids:
            continue
        so_luong = cd.so_luong or 1
        unit_price = cd.don_gia_tai_thoi_diem
        if unit_price is None or Decimal(str(unit_price)) <= ZERO:
            if cd.dich_vu and cd.dich_vu.don_gia is not None:
                unit_price = cd.dich_vu.don_gia
            else:
                unit_price = ZERO
        don_gia = Decimal(str(unit_price))
        lines.append(
            BillingLine(
                loai_muc="can_lam_sang",
                muc_tham_chieu_id=cd.id,
                ten_khoan_thu=cd.dich_vu.ten_dich_vu if cd.dich_vu else "Dịch vụ cận lâm sàng",
                so_luong=so_luong,
                don_gia=don_gia,
                thanh_tien=Decimal(so_luong) * don_gia,
            )
        )
    return lines


async def resolve_exam_line(
    luot_kham: LuotKham,
    db: AsyncSession,
    resolver: Optional[ExamServiceResolver] = None,
) -> BillingLine:
    bac_si = (luot_kham.lich_kham.bac_si if luot_kham.lich_kham else None) or luot_kham.bac_si
    gia_bac_si = Decimal(str(bac_si.gia_kham_mac_dinh)) if bac_si and bac_si.gia_kham_mac_dinh else ZERO
    if gia_bac_si > ZERO:
        ref_id = luot_kham.lich_kham_id or (luot_kham.bac_si.id if luot_kham.bac_si else None)
        return BillingLine(
            loai_muc="cong_kham",
            muc_tham_chieu_id=ref_id,
            ten_khoan_thu="Công khám chuyên khoa ngoại trú",
            so_luong=1,
            don_gia=gia_bac_si,
            thanh_tien=gia_bac_si,
        )
    service = await (resolver or ExamServiceResolver()).get(db)
    don_gia = Decimal(str(service.don_gia))
    return BillingLine(
        loai_muc="cong_kham",
        muc_tham_chieu_id=service.id,
        ten_khoan_thu=service.ten_dich_vu,
        so_luong=1,
        don_gia=don_gia,
        thanh_tien=don_gia,
    )


async def estimate_encounter(
    luot_kham: LuotKham,
    db: AsyncSession,
    resolver: Optional[ExamServiceResolver] = None,
    excluded_chidinh_ids: Optional[Set[int]] = None,
    included_chidinh_ids: Optional[Set[int]] = None,
    include_cong_kham: bool = True,
) -> BillingEstimate:
    lines: List[BillingLine] = []
    if include_cong_kham:
        lines.append(await resolve_exam_line(luot_kham, db, resolver))
    lines.extend(build_cls_lines(luot_kham.danh_sach_chi_dinh, excluded_chidinh_ids, included_chidinh_ids))
    tong_tien = sum((line.thanh_tien for line in lines), ZERO)
    return BillingEstimate(lines=lines, tong_tien=tong_tien)


def sum_cls_fee(
    chi_dinh_list: Optional[Iterable[ChiDinh]],
    excluded_ids: Optional[Set[int]] = None,
) -> Decimal:
    return sum((line.thanh_tien for line in build_cls_lines(chi_dinh_list, excluded_ids)), ZERO)
