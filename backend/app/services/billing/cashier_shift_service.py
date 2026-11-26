import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.models.user import BenhNhan, NguoiDung
from app.models.medical import HoaDon, KhoaSoCaTruc, PhieuThuChi
from app.schemas.cashier import (
    CloseShiftResponse,
    RefundInvoiceRequest,
    RefundInvoiceResponse,
    ShiftSummaryResponse,
)
from app.services.appointment.appointment_service import clinic_now

async def get_shift_summary(
    thu_ngan_user_id: int,
    db: AsyncSession,
) -> ShiftSummaryResponse:
    stmt_user = select(NguoiDung).where(NguoiDung.id == thu_ngan_user_id)
    user = (await db.execute(stmt_user)).scalar_one_or_none()
    ten_thu_ngan = user.ho_ten if user else f"User {thu_ngan_user_id}"

    stmt_slips = select(PhieuThuChi).where(
        PhieuThuChi.nhan_vien_id == thu_ngan_user_id,
        PhieuThuChi.trang_thai_khoa_so.is_(False),
    )
    slips = (await db.execute(stmt_slips)).scalars().all()

    tong_tien_mat = Decimal("0.00")
    tong_chuyen_khoan = Decimal("0.00")
    tong_the_pos = Decimal("0.00")
    so_phieu_thu = 0

    for s in slips:
        amount = s.so_tien or Decimal("0.00")
        if s.loai_phieu == "THU":
            so_phieu_thu += 1
            if s.phuong_thuc == "tien_mat":
                tong_tien_mat += amount
            elif s.phuong_thuc == "chuyen_khoan":
                tong_chuyen_khoan += amount
            elif s.phuong_thuc == "the_pos":
                tong_the_pos += amount

    tong_doanh_thu = tong_tien_mat + tong_chuyen_khoan + tong_the_pos

    return ShiftSummaryResponse(
        thu_ngan_id=thu_ngan_user_id,
        ten_thu_ngan=ten_thu_ngan,
        tong_hoa_don=so_phieu_thu,
        tong_tien_mat=tong_tien_mat,
        tong_chuyen_khoan=tong_chuyen_khoan,
        tong_the_pos=tong_the_pos,
        tong_doanh_thu=tong_doanh_thu,
        so_phieu_thu=so_phieu_thu,
        so_phieu_chi=0,
    )

async def close_shift(
    thu_ngan_user_id: int,
    ghi_chu: Optional[str] = None,
    tien_mat_thuc_te: Optional[Decimal] = None,
    db: AsyncSession = None,
) -> CloseShiftResponse:
    summary = await get_shift_summary(thu_ngan_user_id, db)

    stmt_update = (
        select(PhieuThuChi)
        .where(
            PhieuThuChi.nhan_vien_id == thu_ngan_user_id,
            PhieuThuChi.trang_thai_khoa_so.is_(False),
        )
        .with_for_update()
    )
    slips = (await db.execute(stmt_update)).scalars().all()
    now = datetime.now(timezone.utc)
    for s in slips:
        s.trang_thai_khoa_so = True

    actual_cash = tien_mat_thuc_te if tien_mat_thuc_te is not None else summary.tong_tien_mat
    diff_cash = actual_cash - summary.tong_tien_mat

    now_clinic = clinic_now()
    hour_vn = now_clinic.hour
    ca = "SANG" if hour_vn < 13 else "CHIEU"
    ma_ks = f"KS-{now_clinic.strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    khoa_so = KhoaSoCaTruc(
        ma_khoa_so=ma_ks,
        ca_lam_viec=ca,
        ngay_khoa_so=now_clinic.date(),
        thu_ngan_giao_id=thu_ngan_user_id,
        tong_tien_mat_he_thong=summary.tong_tien_mat,
        tong_chuyen_khoan_he_thong=summary.tong_chuyen_khoan,
        tong_the_pos_he_thong=summary.tong_the_pos,
        tien_mat_thuc_te=actual_cash,
        chenh_lech_tien_mat=diff_cash,
        tong_so_phieu_thu=summary.so_phieu_thu,
        tong_so_phieu_chi=summary.so_phieu_chi,
        trang_thai="DA_KHOA_SO",
        ghi_chu=ghi_chu,
    )
    db.add(khoa_so)
    await db.commit()
    await db.refresh(khoa_so)

    return CloseShiftResponse(
        ok=True,
        ma_khoa_so=khoa_so.ma_khoa_so,
        thoi_gian_dong_so=now,
        tien_mat_thuc_te=actual_cash,
        chenh_lech_tien_mat=diff_cash,
        khoa_so_id=khoa_so.id,
        tong_ket=summary,
    )

async def refund_invoice(
    payload: RefundInvoiceRequest,
    thu_ngan_user_id: int,
    db: AsyncSession,
) -> RefundInvoiceResponse:
    stmt = (
        select(HoaDon)
        .options(
            selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
        )
        .where(HoaDon.id == payload.invoice_id)
        .with_for_update()
    )
    invoice = (await db.execute(stmt)).scalar_one_or_none()
    if not invoice:
        raise NotFoundException(f"Không tìm thấy hóa đơn ID {payload.invoice_id}!")

    if invoice.trang_thai not in ("da_thu", "hoan_tien_mot_phan"):
        raise BadRequestException(f"Chỉ có thể hoàn tiền hóa đơn đã thu (Trạng thái hiện tại: {invoice.trang_thai})!")

    stmt_thu = select(PhieuThuChi).where(
        PhieuThuChi.hoa_don_id == invoice.id,
        PhieuThuChi.loai_phieu == "THU",
    )
    phieu_thu = (await db.execute(stmt_thu)).scalars().first()
    if phieu_thu and phieu_thu.trang_thai_khoa_so:
        raise ConflictException(f"Không thể hoàn tiền: Phiếu thu {phieu_thu.ma_phieu} thuộc ca trực đã khóa sổ!")

    stmt_chi = select(func.coalesce(func.sum(PhieuThuChi.so_tien), Decimal("0.00"))).where(
        PhieuThuChi.hoa_don_id == invoice.id,
        PhieuThuChi.loai_phieu == "CHI",
    )
    da_hoan = (await db.execute(stmt_chi)).scalar_one()
    con_lai = invoice.thuc_thu - da_hoan
    if con_lai <= Decimal("0.00"):
        raise BadRequestException("Hóa đơn này đã được hoàn trả toàn bộ số tiền!")

    so_tien_hoan = payload.so_tien_hoan if payload.so_tien_hoan is not None else con_lai
    if so_tien_hoan <= 0:
        raise BadRequestException("Số tiền hoàn phải lớn hơn 0!")
    if so_tien_hoan > con_lai:
        raise BadRequestException(f"Số tiền hoàn ({so_tien_hoan:,.0f}đ) không được vượt quá số thực thu còn lại của hóa đơn ({con_lai:,.0f}đ)!")

    now = datetime.now(timezone.utc)
    ma_phieu = f"PC-{now.strftime('%y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    ten_nguoi_nhan = (
        invoice.benh_nhan.nguoi_dung.ho_ten
        if invoice.benh_nhan and invoice.benh_nhan.nguoi_dung
        else "Bệnh nhân"
    )

    phieu_chi = PhieuThuChi(
        ma_phieu=ma_phieu,
        loai_phieu="CHI",
        hoa_don_id=invoice.id,
        nguoi_giao_dich=ten_nguoi_nhan,
        so_tien=so_tien_hoan,
        phuong_thuc=payload.phuong_thuc,
        ly_do=payload.ly_do,
        nhan_vien_id=thu_ngan_user_id,
        thoi_gian=now,
        trang_thai_khoa_so=False,
    )
    db.add(phieu_chi)

    tong_da_hoan = da_hoan + so_tien_hoan
    if tong_da_hoan >= invoice.thuc_thu:
        invoice.trang_thai = "da_hoan_tien"
    else:
        invoice.trang_thai = "hoan_tien_mot_phan"

    ghi_chu_hoan = f" | [Hoàn tiền: {so_tien_hoan:,.0f}đ, Phiếu: {ma_phieu}, Lý do: {payload.ly_do}]"
    invoice.ghi_chu = (invoice.ghi_chu or "") + ghi_chu_hoan

    await db.commit()
    await db.refresh(phieu_chi)

    return RefundInvoiceResponse(
        ma_phieu_chi=phieu_chi.ma_phieu,
        phieu_chi_id=phieu_chi.id,
        hoa_don_id=invoice.id,
        ma_hoa_don=invoice.ma_hoa_don,
        so_tien_hoan=so_tien_hoan,
        trang_thai_hoa_don_moi=invoice.trang_thai,
        thoi_gian=now,
        nguoi_thuc_hien_id=thu_ngan_user_id,
        ly_do=payload.ly_do,
    )
