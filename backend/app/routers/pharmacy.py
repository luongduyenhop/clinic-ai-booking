from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.production_pharmacy import (
    DrugBatchCreateRequest,
    DrugBatchResponse,
    PrescriptionDispenseResponse,
)
from app.services.production_pharmacy_service import production_pharmacy_service

router = APIRouter(prefix="/pharmacy", tags=["8. Kho Dược & Cấp Phát Thuốc (Pharmacy & FEFO)"])
pharmacy_staff_guard = require_roles([VaiTroEnum.THU_NGAN, VaiTroEnum.ADMIN, VaiTroEnum.BAC_SI])


@router.post(
    "/inventory/import",
    response_model=ResponseEnvelope[DrugBatchResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Nhập kho lô thuốc mới"
)
async def import_drug_batch(
    payload: DrugBatchCreateRequest,
    current_user: TaiKhoan = Depends(pharmacy_staff_guard),
    db: AsyncSession = Depends(get_db),
):
    batch = await production_pharmacy_service.import_drug_batch(payload=payload, db=db)
    days_left = (batch.expiry_date - batch.expiry_date).days
    data = DrugBatchResponse(
        id=batch.id,
        drug_id=batch.drug_id,
        batch_number=batch.batch_number,
        expiry_date=batch.expiry_date,
        physical_stock=batch.physical_stock,
        held_stock=batch.held_stock,
        import_price=batch.import_price,
        days_until_expiry=days_left,
    )
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Nhập kho thành công lô thuốc '{batch.batch_number}'"
    )


@router.get(
    "/inventory/batches",
    response_model=ResponseEnvelope[List[DrugBatchResponse]],
    summary="Danh sách lô thuốc tồn kho sắp xếp theo hạn dùng gần nhất (FEFO)"
)
async def list_drug_batches(
    drug_id: Optional[int] = Query(None, description="Lọc theo ID thuốc"),
    current_user: TaiKhoan = Depends(pharmacy_staff_guard),
    db: AsyncSession = Depends(get_db),
):
    batches = await production_pharmacy_service.list_drug_batches(drug_id=drug_id, db=db)
    return ResponseEnvelope.success_response(
        data=batches,
        message=f"Lấy danh sách {len(batches)} lô thuốc theo chuẩn FEFO thành công"
    )


@router.post(
    "/prescriptions/{prescription_id}/dispense",
    response_model=ResponseEnvelope[PrescriptionDispenseResponse],
    summary="Xuất kho cấp phát thuốc theo nguyên tắc FEFO"
)
async def dispense_prescription(
    prescription_id: int,
    current_user: TaiKhoan = Depends(pharmacy_staff_guard),
    db: AsyncSession = Depends(get_db),
):
    result = await production_pharmacy_service.dispense_prescription(
        prescription_id=prescription_id,
        user_id=current_user.id,
        db=db,
    )
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Cấp phát xuất kho thành công đơn thuốc #{result.prescription_code}"
    )
