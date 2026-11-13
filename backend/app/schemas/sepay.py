from decimal import Decimal
from typing import Optional
from pydantic import BaseModel

class SepayWebhookPayload(BaseModel):
    id: Optional[int] = None
    gateway: Optional[str] = None
    transactionDate: Optional[str] = None
    accountNumber: Optional[str] = None
    subAccount: Optional[str] = None
    code: Optional[str] = None
    content: Optional[str] = None
    transferType: Optional[str] = None
    description: Optional[str] = None
    transferAmount: Optional[Decimal] = None
    referenceCode: Optional[str] = None
    accumulated: Optional[Decimal] = None

class SepayWebhookResponse(BaseModel):
    success: bool = True
    message: str = "OK"
    invoice_id: Optional[int] = None
    amount: Optional[Decimal] = None
