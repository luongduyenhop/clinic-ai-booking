from datetime import datetime, timezone
from decimal import Decimal
import re
from typing import Optional
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.exceptions import ForbiddenException
from app.models.medical import HoaDon
from app.models.production_models import InvoiceProduction, PaymentTransactionProduction
from app.schemas.cashier import InvoicePayRequest
from app.schemas.sepay import SepayWebhookPayload, SepayWebhookResponse
from app.services.cashier_service import cashier_service

class SepayService:
    def verify_token(self, authorization_header: Optional[str]) -> bool:
        configured_token = settings.SEPAY_WEBHOOK_TOKEN
        if not configured_token:
            return True
        if not authorization_header:
            return False
        header_val = authorization_header.strip()
        if header_val.startswith("Apikey "):
            header_val = header_val[7:].strip()
        elif header_val.startswith("Bearer "):
            header_val = header_val[7:].strip()
        return header_val == configured_token

    def parse_invoice_reference(self, content: Optional[str], description: Optional[str]) -> Optional[str]:
        candidates = [content or "", description or ""]
        combined = " ".join(candidates)
        m_hd = re.search(r"HD[-_ ]?([0-9a-zA-Z-]+)", combined, re.IGNORECASE)
        if m_hd:
            raw = m_hd.group(1).strip()
            if raw.isdigit():
                return raw
            if len(raw) >= 6:
                return f"HD-{raw}"
        m_num = re.search(r"(?:CLINIC|TT|HD)[^0-9]*([0-9]+)", combined, re.IGNORECASE)
        if m_num:
            return m_num.group(1).strip()
        m_single = re.search(r"\b([0-9]{1,8})\b", combined)
        if m_single:
            return m_single.group(1).strip()
        return None

    async def process_webhook(
        self,
        payload: SepayWebhookPayload,
        authorization_header: Optional[str],
        db: AsyncSession,
    ) -> SepayWebhookResponse:
        if not self.verify_token(authorization_header):
            raise ForbiddenException("Mã xác thực SePay Webhook không hợp lệ")

        if payload.transferType and str(payload.transferType).strip().lower() == "out":
            return SepayWebhookResponse(success=True, message="Bỏ qua giao dịch chuyển tiền đi")

        inv_ref = self.parse_invoice_reference(payload.content, payload.description)
        if not inv_ref and payload.code:
            inv_ref = str(payload.code).strip()

        if not inv_ref:
            return SepayWebhookResponse(success=True, message="Không tìm thấy mã hóa đơn trong nội dung chuyển khoản")

        is_num = inv_ref.isdigit()
        conds = [HoaDon.ma_hoa_don == inv_ref]
        if is_num:
            conds.append(HoaDon.id == int(inv_ref))
        stmt_hd = select(HoaDon).where(or_(*conds)).with_for_update()
        hoa_don = (await db.execute(stmt_hd)).scalar_one_or_none()

        if hoa_don:
            if hoa_don.trang_thai == "da_thu":
                return SepayWebhookResponse(
                    success=True,
                    invoice_id=hoa_don.id,
                    amount=hoa_don.thuc_thu or hoa_don.so_tien_phai_thu,
                    message="Hóa đơn đã được thanh toán trước đó",
                )
            amount_to_pay = hoa_don.thuc_thu or hoa_don.so_tien_phai_thu or Decimal("0")
            if payload.transferAmount and payload.transferAmount > 0:
                amount_to_pay = payload.transferAmount
            pay_req = InvoicePayRequest(
                so_tien_khach_tra=amount_to_pay,
                phuong_thuc_thanh_toan="SEPAY",
                ghi_chu=f"SePay chuyển khoản: {payload.content or payload.referenceCode or ''}".strip(),
            )
            thu_ngan_id = hoa_don.thu_ngan_id or 1
            await cashier_service.pay_invoice(hoa_don.id, pay_req, thu_ngan_id, db)
            return SepayWebhookResponse(
                success=True,
                invoice_id=hoa_don.id,
                amount=amount_to_pay,
                message="Xác nhận thanh toán hóa đơn thành công qua SePay",
            )

        conds_prod = [InvoiceProduction.invoice_code == inv_ref]
        if is_num:
            conds_prod.append(InvoiceProduction.id == int(inv_ref))
        stmt_prod = select(InvoiceProduction).where(or_(*conds_prod)).with_for_update()
        inv_prod = (await db.execute(stmt_prod)).scalar_one_or_none()

        if inv_prod:
            if inv_prod.status == "PAID":
                return SepayWebhookResponse(
                    success=True,
                    invoice_id=inv_prod.id,
                    amount=inv_prod.final_amount,
                    message="Hóa đơn đã được thanh toán trước đó",
                )
            now = datetime.now(timezone.utc)
            inv_prod.status = "PAID"
            inv_prod.payment_method = "SEPAY"
            inv_prod.paid_at = now
            inv_prod.is_locked = True
            txn = PaymentTransactionProduction(
                invoice_id=inv_prod.id,
                transaction_code=f"SEPAY-{payload.referenceCode or payload.id or inv_prod.id}",
                gateway_provider="SEPAY",
                bank_transaction_id=str(payload.referenceCode or payload.id or ""),
                amount=payload.transferAmount or inv_prod.final_amount,
                payment_status="SUCCESS",
                webhook_payload=payload.model_dump(mode="json"),
                reconciled_at=now,
            )
            db.add(txn)
            await db.commit()
            return SepayWebhookResponse(
                success=True,
                invoice_id=inv_prod.id,
                amount=inv_prod.final_amount,
                message="Xác nhận thanh toán hóa đơn thành công qua SePay",
            )

        return SepayWebhookResponse(success=False, message=f"Không tìm thấy hóa đơn khớp với mã {inv_ref}")

sepay_service = SepayService()
