from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DrugBatchCreateRequest(BaseModel):
    drug_id: int
    batch_number: str = Field(..., min_length=1, max_length=50)
    expiry_date: date
    physical_stock: int = Field(..., ge=1)
    import_price: Decimal = Field(..., ge=0)


class DrugBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    drug_id: int
    batch_number: str
    expiry_date: date
    physical_stock: int
    held_stock: int
    import_price: Decimal
    days_until_expiry: int


class BatchAllocationDetail(BaseModel):
    batch_id: int
    batch_number: str
    expiry_date: date
    allocated_quantity: int
    remaining_stock: int


class DispensedItemDetail(BaseModel):
    drug_id: int
    brand_name: str
    quantity_prescribed: int
    allocations: List[BatchAllocationDetail]


class PrescriptionDispenseResponse(BaseModel):
    prescription_id: int
    prescription_code: str
    status: str
    dispensed_at: datetime
    items: List[DispensedItemDetail]
