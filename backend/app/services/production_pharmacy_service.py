from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.models.production_models import (
    DrugBatchProduction,
    DrugProduction,
    PrescriptionItemProduction,
    PrescriptionProduction,
)
from app.schemas.production_pharmacy import (
    BatchAllocationDetail,
    DispensedItemDetail,
    DrugBatchCreateRequest,
    DrugBatchResponse,
    PrescriptionDispenseResponse,
)


class ProductionPharmacyService:

    async def import_drug_batch(
        self,
        payload: DrugBatchCreateRequest,
        db: AsyncSession,
    ) -> DrugBatchProduction:
        drug = await db.get(DrugProduction, payload.drug_id)
        if not drug:
            raise NotFoundException(f"Không tìm thấy danh mục thuốc #{payload.drug_id}")

        today = date.today()
        if payload.expiry_date <= today:
            raise BadRequestException("Hạn dùng của lô thuốc phải lớn hơn ngày hiện tại")

        dup_stmt = select(DrugBatchProduction).where(
            DrugBatchProduction.drug_id == payload.drug_id,
            DrugBatchProduction.batch_number == payload.batch_number,
        )
        existing_batch = (await db.execute(dup_stmt)).scalar_one_or_none()
        if existing_batch:
            raise ConflictException(
                f"Lô thuốc '{payload.batch_number}' đã tồn tại cho thuốc '{drug.brand_name}'"
            )

        batch = DrugBatchProduction(
            drug_id=payload.drug_id,
            batch_number=payload.batch_number,
            expiry_date=payload.expiry_date,
            physical_stock=payload.physical_stock,
            held_stock=0,
            import_price=payload.import_price,
        )
        db.add(batch)
        await db.commit()
        await db.refresh(batch)
        return batch

    async def list_drug_batches(
        self,
        drug_id: Optional[int],
        db: AsyncSession,
    ) -> List[DrugBatchResponse]:
        stmt = select(DrugBatchProduction).order_by(DrugBatchProduction.expiry_date.asc())
        if drug_id:
            stmt = stmt.where(DrugBatchProduction.drug_id == drug_id)

        batches = (await db.execute(stmt)).scalars().all()
        today = date.today()
        results = []
        for b in batches:
            days_left = (b.expiry_date - today).days
            results.append(
                DrugBatchResponse(
                    id=b.id,
                    drug_id=b.drug_id,
                    batch_number=b.batch_number,
                    expiry_date=b.expiry_date,
                    physical_stock=b.physical_stock,
                    held_stock=b.held_stock,
                    import_price=b.import_price,
                    days_until_expiry=days_left,
                )
            )
        return results

    async def dispense_prescription(
        self,
        prescription_id: int,
        user_id: int,
        db: AsyncSession,
    ) -> PrescriptionDispenseResponse:
        presc_stmt = (
            select(PrescriptionProduction)
            .where(PrescriptionProduction.id == prescription_id)
            .with_for_update()
        )
        presc = (await db.execute(presc_stmt)).scalar_one_or_none()
        if not presc:
            raise NotFoundException(f"Không tìm thấy đơn thuốc #{prescription_id}")

        if presc.status == "DISPENSED":
            raise ConflictException("Đơn thuốc này đã được xuất kho cấp phát trước đó")

        if presc.status == "CANCELLED":
            raise ConflictException("Đơn thuốc này đã bị hủy bỏ, không thể xuất kho")

        if presc.status == "SYNCED_PORTAL":
            raise ConflictException("Đơn thuốc này đã được liên thông Cổng Quốc gia để mua ngoài, không xuất kho tại phòng khám")

        items_stmt = (
            select(PrescriptionItemProduction)
            .options(selectinload(PrescriptionItemProduction.drug))
            .where(PrescriptionItemProduction.prescription_id == prescription_id)
        )
        presc_items = (await db.execute(items_stmt)).scalars().all()
        if not presc_items:
            raise BadRequestException("Đơn thuốc không có danh mục thuốc cần cấp phát")

        dispensed_items_report = []

        for p_item in presc_items:
            drug = p_item.drug or await db.get(DrugProduction, p_item.drug_id)
            brand_name = drug.brand_name if drug else f"Thuốc #{p_item.drug_id}"

            batches_stmt = (
                select(DrugBatchProduction)
                .where(
                    DrugBatchProduction.drug_id == p_item.drug_id,
                    DrugBatchProduction.physical_stock > 0,
                )
                .order_by(DrugBatchProduction.expiry_date.asc())
                .with_for_update()
            )
            available_batches = (await db.execute(batches_stmt)).scalars().all()

            total_available = sum(b.physical_stock for b in available_batches)
            if total_available < p_item.quantity_prescribed:
                raise ConflictException(
                    f"Không đủ tồn kho khả dụng cho thuốc '{brand_name}'. Cần {p_item.quantity_prescribed}, hiện có {total_available}."
                )

            needed = p_item.quantity_prescribed
            allocations = []

            for batch in available_batches:
                if needed <= 0:
                    break
                deduct = min(batch.physical_stock, needed)
                batch.physical_stock -= deduct
                needed -= deduct
                p_item.batch_id = batch.id
                allocations.append(
                    BatchAllocationDetail(
                        batch_id=batch.id,
                        batch_number=batch.batch_number,
                        expiry_date=batch.expiry_date,
                        allocated_quantity=deduct,
                        remaining_stock=batch.physical_stock,
                    )
                )

            dispensed_items_report.append(
                DispensedItemDetail(
                    drug_id=p_item.drug_id,
                    brand_name=brand_name,
                    quantity_prescribed=p_item.quantity_prescribed,
                    allocations=allocations,
                )
            )

        now = datetime.now(timezone.utc)
        presc.status = "DISPENSED"
        presc.updated_at = now
        await db.commit()

        return PrescriptionDispenseResponse(
            prescription_id=presc.id,
            prescription_code=presc.prescription_code,
            status=presc.status,
            dispensed_at=now,
            items=dispensed_items_report,
        )


production_pharmacy_service = ProductionPharmacyService()
