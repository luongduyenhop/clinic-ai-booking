from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.medical import HoaDon
from app.models.user import BenhNhan
from app.schemas.cashier import (
    InvoiceLineItemResponse,
    PatientBrief,
    PendingBillItem,
    PendingBillsListResponse,
)

async def get_pending_bills(
    ma_kcb: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = None,
) -> PendingBillsListResponse:
    stmt = (
        select(HoaDon)
        .options(
            selectinload(HoaDon.chi_tiet_hoa_don),
            selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            selectinload(HoaDon.luot_kham),
        )
        .where(HoaDon.trang_thai == "chua_thu")
        .order_by(HoaDon.id.desc())
    )
    total = (
        await db.execute(select(func.count(HoaDon.id)).where(HoaDon.trang_thai == "chua_thu"))
    ).scalar_one()
    page_invoices = (
        await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
    ).scalars().all()

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
                created_at=inv.created_at,
                cac_khoan_thu=line_dtos,
            )
        )

    return PendingBillsListResponse(items=items, total=total)
