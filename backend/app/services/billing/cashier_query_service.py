from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException
from app.models.medical import HoaDon
from app.models.user import BenhNhan, NguoiDung
from app.schemas.cashier import (
    InvoiceLineItemResponse,
    PatientBrief,
    PendingBillItem,
    PendingBillsListResponse,
)
from app.services.reception.timezone_utils import to_clinic_aware


def _normalize_shift_filter(ca_kham: Optional[str]) -> Optional[str]:
    if ca_kham is None:
        return None
    normalized = ca_kham.strip().lower()
    if not normalized or normalized in ("all", "tat_ca"):
        return None
    if normalized in ("sang", "chieu"):
        return normalized
    raise BadRequestException("Ca làm việc không hợp lệ, chỉ hỗ trợ 'sang' hoặc 'chieu'")


def _resolve_invoice_clinic_dt(inv: HoaDon) -> Optional[datetime]:
    raw_dt = (
        inv.ngay_thanh_toan
        if (inv.trang_thai == "da_thu" and inv.ngay_thanh_toan is not None)
        else (inv.ngay_thanh_toan or inv.created_at)
    )
    if raw_dt is None:
        return None
    return to_clinic_aware(raw_dt)


def _matches_date_and_shift(
    inv: HoaDon,
    tu_ngay: Optional[date],
    den_ngay: Optional[date],
    shift: Optional[str],
) -> bool:
    local_dt = _resolve_invoice_clinic_dt(inv)
    if local_dt is None:
        return False
    local_date = local_dt.date()
    if tu_ngay and local_date < tu_ngay:
        return False
    if den_ngay and local_date > den_ngay:
        return False
    if shift == "sang" and local_dt.hour >= 12:
        return False
    if shift == "chieu" and local_dt.hour < 12:
        return False
    return True


async def list_invoices(
    trang_thai: Optional[str] = None,
    ma_kcb: Optional[str] = None,
    tu_ngay: Optional[date] = None,
    den_ngay: Optional[date] = None,
    ca_kham: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = None,
) -> PendingBillsListResponse:
    if tu_ngay and den_ngay and tu_ngay > den_ngay:
        raise BadRequestException("Ngày bắt đầu không được lớn hơn ngày kết thúc")
    normalized_shift = _normalize_shift_filter(ca_kham)

    filters = []
    normalized_status = (trang_thai or "").strip().lower()
    if normalized_status and normalized_status != "tat_ca":
        filters.append(HoaDon.trang_thai == normalized_status)
    else:
        filters.append(HoaDon.trang_thai.in_(["chua_thu", "da_thu"]))

    keyword = (ma_kcb or "").strip()
    if keyword:
        kw_clauses = [
            HoaDon.ma_hoa_don.ilike(f"%{keyword}%"),
            BenhNhan.ma_dinh_danh_y_te.ilike(f"%{keyword}%"),
            NguoiDung.ho_ten.ilike(f"%{keyword}%"),
        ]
        upper_kw = keyword.upper()
        if upper_kw.startswith("KCB-") and upper_kw[4:].isdigit():
            kw_clauses.append(HoaDon.luot_kham_id == int(upper_kw[4:]))
        elif keyword.isdigit():
            kw_clauses.append(HoaDon.luot_kham_id == int(keyword))
        filters.append(or_(*kw_clauses))

    base_from = (
        select(HoaDon)
        .outerjoin(HoaDon.benh_nhan)
        .outerjoin(BenhNhan.nguoi_dung)
        .where(*filters)
    )

    if tu_ngay is None and den_ngay is None and normalized_shift is None:
        count_stmt = (
            select(func.count(HoaDon.id))
            .select_from(HoaDon)
            .outerjoin(HoaDon.benh_nhan)
            .outerjoin(BenhNhan.nguoi_dung)
            .where(*filters)
        )
        total = (await db.execute(count_stmt)).scalar_one()

        stmt = (
            base_from
            .options(
                selectinload(HoaDon.chi_tiet_hoa_don),
                selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HoaDon.luot_kham),
            )
            .order_by(HoaDon.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        page_invoices = (await db.execute(stmt)).scalars().all()
    else:
        stmt = (
            base_from
            .options(
                selectinload(HoaDon.chi_tiet_hoa_don),
                selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HoaDon.luot_kham),
            )
            .order_by(HoaDon.id.desc())
        )
        all_candidates = (await db.execute(stmt)).scalars().all()
        matched_invoices = [
            inv
            for inv in all_candidates
            if _matches_date_and_shift(inv, tu_ngay, den_ngay, normalized_shift)
        ]
        total = len(matched_invoices)
        start_idx = (page - 1) * page_size
        page_invoices = matched_invoices[start_idx : start_idx + page_size]

    items: List[PendingBillItem] = []
    for inv in page_invoices:
        ho_ten = "Chưa rõ"
        sdt = None
        mabn = None
        if inv.benh_nhan:
            mabn = inv.benh_nhan.ma_dinh_danh_y_te
            if inv.benh_nhan.nguoi_dung:
                ho_ten = inv.benh_nhan.nguoi_dung.ho_ten
                sdt = inv.benh_nhan.nguoi_dung.so_dien_thoai

        line_dtos = [
            InvoiceLineItemResponse(
                id=line.id,
                hoa_don_id=line.hoa_don_id,
                loai_muc=line.loai_muc,
                muc_tham_chieu_id=line.muc_tham_chieu_id,
                ten_khoan_thu=line.ten_khoan_thu,
                so_luong=line.so_luong,
                don_gia=line.don_gia,
                thanh_tien=line.thanh_tien,
                ghi_chu=line.ghi_chu,
            )
            for line in (inv.chi_tiet_hoa_don or [])
        ]

        items.append(
            PendingBillItem(
                id=inv.id,
                ma_hoa_don=inv.ma_hoa_don,
                luot_kham_id=inv.luot_kham_id or 0,
                benh_nhan=PatientBrief(mabn=mabn, ho_ten=ho_ten, so_dien_thoai=sdt),
                tong_tien=inv.tong_tien,
                mien_giam=inv.mien_giam,
                thuc_thu=inv.thuc_thu,
                trang_thai=inv.trang_thai,
                phuong_thuc_thanh_toan=inv.phuong_thuc_thanh_toan,
                ngay_thanh_toan=inv.ngay_thanh_toan,
                so_hoa_don_in=inv.so_hoa_don_in,
                ghi_chu=inv.ghi_chu,
                created_at=inv.created_at,
                cac_khoan_thu=line_dtos,
            )
        )

    return PendingBillsListResponse(items=items, total=total)


async def get_pending_bills(
    ma_kcb: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = None,
) -> PendingBillsListResponse:
    return await list_invoices(
        trang_thai="chua_thu",
        ma_kcb=ma_kcb,
        page=page,
        page_size=page_size,
        db=db,
    )
