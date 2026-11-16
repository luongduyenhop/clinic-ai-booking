import re
import uuid
from decimal import Decimal
from typing import Any, Callable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import UnauthorizedException
from app.models.user import NguoiDung
from app.models.medical import GiaoDichThanhToan, HoaDon
from app.schemas.cashier import (
    InvoicePayRequest,
    SepayWebhookPayload,
    SepayWebhookResponse,
)

ZERO = Decimal("0.00")

async def process_sepay_webhook(
    payload: SepayWebhookPayload,
    authorization_header: Optional[str],
    db: AsyncSession,
    find_invoice_by_ref_fn: Callable[..., Any],
    pay_invoice_fn: Callable[..., Any],
) -> SepayWebhookResponse:
    if settings.SEPAY_API_KEY:
        expected_key = settings.SEPAY_API_KEY.strip()
        auth_val = (authorization_header or "").strip()
        clean_token = auth_val.replace("Apikey ", "").replace("Bearer ", "").strip()
        if clean_token != expected_key and auth_val != expected_key:
            raise UnauthorizedException("Mã xác thực SePay API Key không hợp lệ")

    if payload.transferType and str(payload.transferType).strip().lower() != "in":
        return SepayWebhookResponse(
            success=True,
            message="Bỏ qua giao dịch không phải tiền vào",
        )

    amount = Decimal(str(payload.transferAmount or 0))
    if amount <= ZERO:
        return SepayWebhookResponse(
            success=False,
            message="Số tiền giao dịch không hợp lệ",
        )

    raw_content = f"{payload.content or ''} {payload.description or ''} {payload.code or ''}".strip()
    candidates = []
    m_clinic = re.search(r"CLINIC\s+HD\s+([A-Za-z0-9\-_]+)", raw_content, re.IGNORECASE)
    if m_clinic:
        candidates.append(m_clinic.group(1))

    m_hd = re.findall(r"HD[\-_ ]?([A-Za-z0-9\-_]+)", raw_content, re.IGNORECASE)
    for token in m_hd:
        if token not in candidates:
            candidates.append(token)
        if not token.startswith("HD-") and f"HD-{token}" not in candidates:
            candidates.append(f"HD-{token}")

    invoice = None
    for cand in candidates:
        invoice = await find_invoice_by_ref_fn(cand, db, lock=True)
        if invoice:
            break

    if not invoice:
        pending_invoices_stmt = select(HoaDon).where(HoaDon.trang_thai == "chua_thu")
        pending_invoices = (await db.execute(pending_invoices_stmt)).scalars().all()
        compact_content = re.sub(r"[^A-Za-z0-9]", "", raw_content).upper()
        for cand_inv in pending_invoices:
            cand_code = re.sub(r"[^A-Za-z0-9]", "", cand_inv.ma_hoa_don).upper()
            if cand_code in compact_content or str(cand_inv.id) in raw_content.split():
                invoice = await find_invoice_by_ref_fn(cand_inv.id, db, lock=True)
                if invoice:
                    break

    if not invoice:
        return SepayWebhookResponse(
            success=False,
            message=f"Không tìm thấy hóa đơn phù hợp từ nội dung: {raw_content}",
        )

    if invoice.trang_thai == "da_thu":
        return SepayWebhookResponse(
            success=True,
            message=f"Hóa đơn {invoice.ma_hoa_don} đã được thanh toán trước đó",
            invoice_id=invoice.id,
            ma_hoa_don=invoice.ma_hoa_don,
            amount_paid=invoice.thuc_thu,
        )

    if invoice.trang_thai == "da_huy":
        return SepayWebhookResponse(
            success=False,
            message=f"Hóa đơn {invoice.ma_hoa_don} đã bị hủy",
            invoice_id=invoice.id,
            ma_hoa_don=invoice.ma_hoa_don,
        )

    due_amount = invoice.thuc_thu if (invoice.thuc_thu and invoice.thuc_thu > ZERO) else (invoice.so_tien_phai_thu or ZERO)
    if amount < due_amount:
        return SepayWebhookResponse(
            success=False,
            message=f"Số tiền thanh toán ({amount:,.0f}đ) chưa đủ số tiền hóa đơn ({due_amount:,.0f}đ)",
            invoice_id=invoice.id,
            ma_hoa_don=invoice.ma_hoa_don,
            amount_paid=amount,
        )

    thu_ngan_user_id = invoice.thu_ngan_id or invoice.nguoi_lap_id
    if not thu_ngan_user_id:
        user_stmt = select(NguoiDung.id).order_by(NguoiDung.id.asc()).limit(1)
        thu_ngan_user_id = (await db.execute(user_stmt)).scalar() or 1

    tx_ref = str(payload.referenceCode or payload.id or uuid.uuid4().hex[:8])
    pay_request = InvoicePayRequest(
        phuong_thuc_thanh_toan="VIETQR",
        so_tien_khach_tra=amount,
        ghi_chu=f"SePay Webhook #{payload.id or ''} - Ref: {tx_ref} - Ngân hàng: {payload.gateway or ''}",
    )

    updated_invoice = await pay_invoice_fn(
        invoice_id=invoice.id,
        payload=pay_request,
        thu_ngan_user_id=thu_ngan_user_id,
        db=db,
    )

    last_gd_stmt = (
        select(GiaoDichThanhToan)
        .where(GiaoDichThanhToan.hoa_don_id == updated_invoice.id)
        .order_by(GiaoDichThanhToan.id.desc())
        .limit(1)
    )
    last_gd = (await db.execute(last_gd_stmt)).scalars().first()
    if last_gd:
        last_gd.nguon_tao_giao_dich = "CONG_SEPAY"
        last_gd.ma_tham_chieu_cong_thanh_toan = tx_ref
        await db.commit()

    return SepayWebhookResponse(
        success=True,
        message=f"Tự động thanh toán thành công hóa đơn {updated_invoice.ma_hoa_don} qua SePay",
        invoice_id=updated_invoice.id,
        ma_hoa_don=updated_invoice.ma_hoa_don,
        amount_paid=updated_invoice.thuc_thu,
    )
