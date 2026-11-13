from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.services.national_gateway_service import national_gateway_service
from app.services.prescription_fsm_service import prescription_fsm_service

integration_router = APIRouter()

def require_admin(current_user: TaiKhoan = Depends(get_current_user)):
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng quản trị chỉ dành riêng cho Quản trị viên (Admin)!")
    return current_user

@integration_router.get("/e-prescriptions/status")
@integration_router.get("/status")
async def get_eprescriptions_status(
    current_user: TaiKhoan = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await prescription_fsm_service.get_queue_metrics(db=db)
    return ResponseEnvelope.success_response(
        data=data, message="Lấy trạng thái đồng bộ đơn thuốc quốc gia thành công"
    )

@integration_router.get("/prescriptions/queue")
@integration_router.get("/queue")
async def get_prescriptions_queue(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: TaiKhoan = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await prescription_fsm_service.get_prescription_queue(
        db=db, status=status, limit=limit, offset=offset
    )
    return ResponseEnvelope.success_response(
        data=data, message="Lấy danh sách hàng đợi đơn thuốc thành công"
    )

@integration_router.get("/prescriptions/{prescription_id}/status")
async def get_prescription_status(
    prescription_id: int,
    current_user: TaiKhoan = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await prescription_fsm_service.get_prescription_status_and_history(
        db=db, prescription_id=prescription_id
    )
    return ResponseEnvelope.success_response(
        data=data, message="Lấy trạng thái và lịch sử chuyển trạng thái đơn thuốc thành công"
    )

@integration_router.post("/prescriptions/{prescription_id}/sync")
async def sync_prescription(
    prescription_id: int,
    current_user: TaiKhoan = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await national_gateway_service.submit_to_gateway(
        db=db, prescription_id=prescription_id, user=current_user
    )
    payload_data = result.model_dump() if hasattr(result, "model_dump") else result.dict()
    return ResponseEnvelope.success_response(
        data=payload_data,
        message="Thực hiện đồng bộ đơn thuốc thành công",
    )
