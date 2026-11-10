from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import re
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.production_models import (
    EncounterProduction,
    InvoiceItemProduction,
    InvoiceProduction,
    ParaclinicalOrderProduction,
    PaymentTransactionProduction,
    PrescriptionItemProduction,
    PrescriptionProduction,
)
from app.schemas.production_billing import (
    BankWebhookPayload,
    BankWebhookResponse,
    FeeSheetItem,
    FeeSheetSummary,
    VietQrGenerateResponse,
)


def _calculate_emvco_crc16(payload: str) -> str:
    crc = 0xFFFF
    for char in payload.encode("utf-8"):
        crc ^= char << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc = crc << 1
            crc &= 0xFFFF
    return f"{crc:04X}"


def _build_napas_emvco_qr(
    bank_bin: str,
    account_number: str,
    amount: Decimal,
    reference_content: str,
) -> str:
    sub00 = "0010A000000727"
    beneficiary_body = f"0006{bank_bin}01{len(account_number):02d}{account_number}"
    sub01 = f"01{len(beneficiary_body):02d}{beneficiary_body}"
    sub02 = "0208QRIBFTTA"
    tag38_body = f"{sub00}{sub01}{sub02}"
    tag38 = f"38{len(tag38_body):02d}{tag38_body}"

    amount_str = str(int(amount))
    tag54 = f"54{len(amount_str):02d}{amount_str}"

    sanitized_ref = re.sub(r"[^A-Za-z0-9\-]", "", reference_content)[:25]
    sub08 = f"08{len(sanitized_ref):02d}{sanitized_ref}"
    tag62 = f"62{len(sub08):02d}{sub08}"

    raw_data = f"000201010212{tag38}5303704{tag54}5802VN{tag62}6304"
    crc_code = _calculate_emvco_crc16(raw_data)
    return f"{raw_data}{crc_code}"


class ProductionCashierService:

    async def calculate_fee_sheet(
        self,
        encounter_id: int,
        discount_amount: Decimal,
        db: AsyncSession,
    ) -> FeeSheetSummary:
        encounter = await db.get(EncounterProduction, encounter_id)
        if not encounter:
            raise NotFoundException(f"Không tìm thấy ca khám #{encounter_id}")

        items = []
        total_service_amount = Decimal("0.00")
        total_medication_amount = Decimal("0.00")

        consultation_price = Decimal("150000.00")
        items.append(
            FeeSheetItem(
                item_type="SERVICE",
                item_reference_id=encounter.id,
                item_name="Khám lâm sàng đa khoa chuyên sâu",
                quantity=1,
                unit_price=consultation_price,
                total_price=consultation_price,
            )
        )
        total_service_amount += consultation_price

        order_stmt = (
            select(ParaclinicalOrderProduction)
            .options(selectinload(ParaclinicalOrderProduction.service))
            .where(ParaclinicalOrderProduction.encounter_id == encounter_id)
        )
        orders = (await db.execute(order_stmt)).scalars().all()
        for order in orders:
            if order.service:
                price = Decimal(str(order.service.unit_price))
                items.append(
                    FeeSheetItem(
                        item_type="SERVICE",
                        item_reference_id=order.id,
                        item_name=order.service.service_name,
                        quantity=1,
                        unit_price=price,
                        total_price=price,
                    )
                )
                total_service_amount += price

        presc_stmt = (
            select(PrescriptionProduction)
            .where(
                PrescriptionProduction.encounter_id == encounter_id,
                PrescriptionProduction.status != "CANCELLED",
            )
        )
        prescriptions = (await db.execute(presc_stmt)).scalars().all()
        for presc in prescriptions:
            presc_items_stmt = (
                select(PrescriptionItemProduction)
                .options(selectinload(PrescriptionItemProduction.drug))
                .where(PrescriptionItemProduction.prescription_id == presc.id)
            )
            presc_items = (await db.execute(presc_items_stmt)).scalars().all()
            for p_item in presc_items:
                if p_item.drug:
                    unit_p = Decimal(str(p_item.drug.unit_selling_price))
                    total_p = unit_p * Decimal(p_item.quantity_prescribed)
                    items.append(
                        FeeSheetItem(
                            item_type="MEDICATION",
                            item_reference_id=p_item.id,
                            item_name=p_item.drug.brand_name,
                            quantity=p_item.quantity_prescribed,
                            unit_price=unit_p,
                            total_price=total_p,
                        )
                    )
                    total_medication_amount += total_p

        if discount_amount < 0:
            raise BadRequestException("Số tiền miễn giảm không thể nhỏ hơn 0")

        gross_amount = total_service_amount + total_medication_amount
        final_amount = max(Decimal("0.00"), gross_amount - discount_amount)

        return FeeSheetSummary(
            encounter_id=encounter_id,
            patient_id=encounter.patient_id,
            total_service_amount=total_service_amount,
            total_medication_amount=total_medication_amount,
            discount_amount=discount_amount,
            final_amount=final_amount,
            items=items,
        )

    async def create_invoice(
        self,
        encounter_id: int,
        discount_amount: Decimal,
        cashier_id: Optional[int],
        db: AsyncSession,
    ) -> InvoiceProduction:
        existing_stmt = select(InvoiceProduction).where(
            InvoiceProduction.encounter_id == encounter_id,
            InvoiceProduction.status.in_(["PENDING", "PAID"]),
        )
        existing = (await db.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            raise ConflictException(f"Ca khám #{encounter_id} đã có hóa đơn hiệu lực {existing.invoice_code}")

        fee_sheet = await self.calculate_fee_sheet(encounter_id, discount_amount, db)

        now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        invoice_code = f"HD-{now_str}-{encounter_id:06d}"

        invoice = InvoiceProduction(
            invoice_code=invoice_code,
            encounter_id=encounter_id,
            patient_id=fee_sheet.patient_id,
            cashier_id=cashier_id,
            total_service_amount=fee_sheet.total_service_amount,
            total_medication_amount=fee_sheet.total_medication_amount,
            discount_amount=fee_sheet.discount_amount,
            final_amount=fee_sheet.final_amount,
            status="PENDING",
            is_locked=False,
        )
        db.add(invoice)
        await db.flush()

        for item in fee_sheet.items:
            db_item = InvoiceItemProduction(
                invoice_id=invoice.id,
                item_type=item.item_type,
                item_reference_id=item.item_reference_id,
                item_name=item.item_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=item.total_price,
            )
            db.add(db_item)

        await db.commit()
        await db.refresh(invoice)
        return invoice

    async def generate_vietqr(
        self,
        invoice_id: int,
        db: AsyncSession,
    ) -> VietQrGenerateResponse:
        stmt = (
            select(InvoiceProduction)
            .where(InvoiceProduction.id == invoice_id)
        )
        invoice = (await db.execute(stmt)).scalar_one_or_none()
        if not invoice:
            raise NotFoundException(f"Không tìm thấy hóa đơn #{invoice_id}")

        bank_bin = "970422"
        bank_name = "MBBank (Ngân hàng TMCP Quân Đội)"
        account_number = "0901234567"
        account_name = "PHONG KHAM CLINIC AI"
        payment_reference = f"TT-HD-{invoice.id}"

        qr_payload_emvco = _build_napas_emvco_qr(
            bank_bin=bank_bin,
            account_number=account_number,
            amount=invoice.final_amount,
            reference_content=payment_reference,
        )

        amount_int = int(invoice.final_amount)
        encoded_acc_name = account_name.replace(" ", "%20")
        qr_quicklink_url = (
            f"https://img.vietqr.io/image/{bank_bin}-{account_number}-compact2.png"
            f"?amount={amount_int}&addInfo={payment_reference}&accountName={encoded_acc_name}"
        )

        return VietQrGenerateResponse(
            invoice_id=invoice.id,
            invoice_code=invoice.invoice_code,
            final_amount=invoice.final_amount,
            bank_bin=bank_bin,
            bank_name=bank_name,
            account_number=account_number,
            account_name=account_name,
            payment_reference=payment_reference,
            qr_payload_emvco=qr_payload_emvco,
            qr_quicklink_url=qr_quicklink_url,
        )

    def verify_webhook_signature(
        self,
        payload: BankWebhookPayload,
        raw_body: bytes,
        provided_signature: Optional[str],
    ) -> bool:
        if not provided_signature and not payload.signature:
            return False

        sig = (provided_signature or payload.signature).strip().lower()
        secret_bytes = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")

        candidates = []
        if raw_body:
            candidates.append(hmac.new(secret_bytes, raw_body, hashlib.sha256).hexdigest().lower())

        str_candidate_1 = f"{payload.transaction_code}|{payload.amount}".encode("utf-8")
        candidates.append(hmac.new(secret_bytes, str_candidate_1, hashlib.sha256).hexdigest().lower())

        str_candidate_2 = f"{payload.transaction_code}|{payload.invoice_id}|{payload.amount}".encode("utf-8")
        candidates.append(hmac.new(secret_bytes, str_candidate_2, hashlib.sha256).hexdigest().lower())

        for cand in candidates:
            if hmac.compare_digest(cand, sig):
                return True
        return False

    async def process_bank_webhook(
        self,
        payload: BankWebhookPayload,
        raw_body: bytes,
        header_signature: Optional[str],
        db: AsyncSession,
    ) -> BankWebhookResponse:
        sig_valid = self.verify_webhook_signature(payload, raw_body, header_signature)
        if not sig_valid:
            raise ForbiddenException("Chữ ký số xác thực Webhook thanh toán không hợp lệ")

        existing_txn_stmt = select(PaymentTransactionProduction).where(
            PaymentTransactionProduction.transaction_code == payload.transaction_code
        )
        existing_txn = (await db.execute(existing_txn_stmt)).scalar_one_or_none()
        if existing_txn and existing_txn.payment_status == "SUCCESS":
            return BankWebhookResponse(
                ok=True,
                transaction_code=existing_txn.transaction_code,
                invoice_id=existing_txn.invoice_id,
                status=existing_txn.payment_status,
                reconciled_at=existing_txn.reconciled_at or datetime.now(timezone.utc),
                is_idempotent=True,
            )

        invoice: Optional[InvoiceProduction] = None
        if payload.invoice_id:
            inv_stmt = (
                select(InvoiceProduction)
                .where(InvoiceProduction.id == payload.invoice_id)
                .with_for_update()
            )
            invoice = (await db.execute(inv_stmt)).scalar_one_or_none()
        elif payload.payment_reference:
            match = re.search(r"(\d+)", payload.payment_reference)
            if match:
                ref_id = int(match.group(1))
                inv_stmt = (
                    select(InvoiceProduction)
                    .where(InvoiceProduction.id == ref_id)
                    .with_for_update()
                )
                invoice = (await db.execute(inv_stmt)).scalar_one_or_none()

        if not invoice:
            raise NotFoundException("Không tìm thấy thông tin hóa đơn tương ứng với giao dịch")

        if invoice.status == "CANCELLED":
            raise ConflictException("Hóa đơn này đã bị hủy, không thể đối soát thanh toán")

        if payload.amount < invoice.final_amount:
            raise BadRequestException(
                f"Số tiền thanh toán ({payload.amount}) không đủ với tổng viện phí ({invoice.final_amount})"
            )

        now = datetime.now(timezone.utc)
        invoice.status = "PAID"
        invoice.payment_method = "VIETQR"
        invoice.paid_at = now
        invoice.is_locked = True

        transaction = PaymentTransactionProduction(
            invoice_id=invoice.id,
            transaction_code=payload.transaction_code,
            gateway_provider="NAPAS247",
            bank_transaction_id=payload.bank_transaction_id,
            amount=payload.amount,
            payment_status="SUCCESS",
            webhook_payload=payload.model_dump(mode="json"),
            webhook_signature=header_signature or payload.signature,
            reconciled_at=now,
        )
        db.add(transaction)
        await db.commit()

        return BankWebhookResponse(
            ok=True,
            transaction_code=payload.transaction_code,
            invoice_id=invoice.id,
            status="SUCCESS",
            reconciled_at=now,
            is_idempotent=False,
        )


production_cashier_service = ProductionCashierService()
