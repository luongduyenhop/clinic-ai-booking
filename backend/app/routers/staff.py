from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import TaiKhoan, VaiTroEnum
from app.core.response import ResponseEnvelope
from app.services.staff_portal_service import staff_portal_service


router = APIRouter(prefix="/staff", tags=["Staff portal"])
staff_user = require_roles([role for role in VaiTroEnum if role != VaiTroEnum.BENH_NHAN])


class StaffCollectionUpdate(BaseModel):
    items: list[dict]
    auditEntry: dict | None = None


@router.get("/bootstrap", response_model=ResponseEnvelope[dict])
async def get_staff_bootstrap(
    user: TaiKhoan = Depends(staff_user), db: AsyncSession = Depends(get_db),
):
    data = await staff_portal_service.get_bootstrap(user, db)
    return ResponseEnvelope.success_response(data=data)


@router.put("/collections/{collection_key}", response_model=ResponseEnvelope[dict])
async def update_staff_collection(
    collection_key: str, payload: StaffCollectionUpdate,
    user: TaiKhoan = Depends(staff_user), db: AsyncSession = Depends(get_db),
):
    data = await staff_portal_service.update_collection(
        user, db, collection_key, payload.items, payload.auditEntry,
    )
    return ResponseEnvelope.success_response(data=data)
