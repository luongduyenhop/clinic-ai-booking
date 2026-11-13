from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class VietQrGenerateResponse(BaseModel):
    invoice_id: int
    invoice_code: str
    final_amount: Decimal
    bank_bin: str
    bank_name: str
    account_number: str
    account_name: str
    payment_reference: str
    qr_payload_emvco: str
    qr_quicklink_url: str


class BankWebhookPayload(BaseModel):
    transaction_code: str
    bank_transaction_id: Optional[str] = None
    amount: Decimal
    payment_reference: Optional[str] = None
    invoice_id: Optional[int] = None
    signature: Optional[str] = None


class BankWebhookResponse(BaseModel):
    ok: bool
    transaction_code: str
    invoice_id: int
    status: str
    reconciled_at: datetime
    is_idempotent: bool


class FeeSheetItem(BaseModel):
    item_type: str
    item_reference_id: int
    item_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal


class FeeSheetSummary(BaseModel):
    encounter_id: int
    patient_id: int
    total_service_amount: Decimal
    total_medication_amount: Decimal
    discount_amount: Decimal
    final_amount: Decimal
    items: List[FeeSheetItem]


class ProdInvoiceCreateRequest(BaseModel):
    encounter_id: int
    discount_amount: Decimal = Field(Decimal("0.00"), ge=0)


class ProdInvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    item_type: str
    item_reference_id: int
    item_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal


class ProdInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_code: str
    encounter_id: int
    patient_id: int
    cashier_id: Optional[int] = None
    total_service_amount: Decimal
    total_medication_amount: Decimal
    discount_amount: Decimal
    final_amount: Decimal
    status: str
    payment_method: Optional[str] = None
    paid_at: Optional[datetime] = None
    is_locked: bool
    created_at: datetime
    items: List[ProdInvoiceItemResponse] = []
