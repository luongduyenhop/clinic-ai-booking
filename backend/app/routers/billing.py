from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.production_billing import (
    BankWebhookPayload,
    BankWebhookResponse,
    FeeSheetSummary,
    ProdInvoiceCreateRequest,
    ProdInvoiceResponse,
    VietQrGenerateResponse,
)
from app.services.production_cashier_service import production_cashier_service

billing_router = APIRouter(prefix="/billing", tags=["7.1 Cổng Viện Phí & VietQR (Billing Gateway)"])
payments_router = APIRouter(prefix="/payments", tags=["7.2 Cổng Thanh Toán & Webhook (Payment Gateway)"])
cashier_role_guard = require_roles([VaiTroEnum.THU_NGAN, VaiTroEnum.ADMIN, VaiTroEnum.LE_TAN])


@billing_router.get(
    "/encounters/{encounter_id}/fee-sheet",
    response_model=ResponseEnvelope[FeeSheetSummary],
    summary="Bảng kê viện phí tự động từ ca khám"
)
async def get_billing_fee_sheet(
    encounter_id: int,
    discount_amount: Decimal = Query(Decimal("0.00"), ge=0),
    current_user: TaiKhoan = Depends(cashier_role_guard),
    db: AsyncSession = Depends(get_db),
):
    result = await production_cashier_service.calculate_fee_sheet(
        encounter_id=encounter_id,
        discount_amount=discount_amount,
        db=db,
    )
    return ResponseEnvelope.success_response(
        data=result,
        message="Tổng hợp bảng kê viện phí thành công"
    )


@billing_router.post(
    "/encounters/{encounter_id}/create-invoice",
    response_model=ResponseEnvelope[ProdInvoiceResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Lập hóa đơn viện phí từ bảng kê ca khám"
)
async def create_billing_invoice(
    encounter_id: int,
    payload: ProdInvoiceCreateRequest,
    current_user: TaiKhoan = Depends(cashier_role_guard),
    db: AsyncSession = Depends(get_db),
):
    invoice = await production_cashier_service.create_invoice(
        encounter_id=encounter_id,
        discount_amount=payload.discount_amount,
        cashier_id=current_user.id,
        db=db,
    )
    return ResponseEnvelope.success_response(
        data=invoice,
        message=f"Lập hóa đơn {invoice.invoice_code} thành công"
    )


@billing_router.post(
    "/invoices/{invoice_id}/generate-vietqr",
    response_model=ResponseEnvelope[VietQrGenerateResponse],
    summary="Sinh mã VietQR động chuẩn Napas 247 cho hóa đơn"
)
async def generate_billing_vietqr(
    invoice_id: int,
    current_user: TaiKhoan = Depends(cashier_role_guard),
    db: AsyncSession = Depends(get_db),
):
    result = await production_cashier_service.generate_vietqr(invoice_id=invoice_id, db=db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Sinh mã VietQR cho hóa đơn #{invoice_id} thành công"
    )


@payments_router.post(
    "/webhook",
    response_model=ResponseEnvelope[BankWebhookResponse],
    summary="Tiếp nhận Webhook ngân hàng đối soát thanh toán"
)
async def process_payment_webhook(
    request: Request,
    payload: BankWebhookPayload,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    db: AsyncSession = Depends(get_db),
):
    raw_body = await request.body()
    result = await production_cashier_service.process_bank_webhook(
        payload=payload,
        raw_body=raw_body,
        header_signature=x_signature,
        db=db,
    )
    return ResponseEnvelope.success_response(
        data=result,
        message="Đối soát thanh toán Webhook thành công"
    )
