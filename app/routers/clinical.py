from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.clinical import (
    EncounterCreateRequest,
    EncounterCompleteRequest,
    EncounterResponse,
    DiagnosisCreateRequest,
    DiagnosisResponse,
    OrderCreateRequest,
    OrderResponse,
)
from app.services.clinical_service import clinical_service

router = APIRouter(prefix="/clinical", tags=["5. Khám Lâm Sàng & Bệnh Án Điện Tử (Package D)"])


@router.post(
    "/encounters",
    response_model=ResponseEnvelope[EncounterResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Bác sĩ tiếp nhận và bắt đầu ca khám lâm sàng thực tế (OpenMRS Encounter)"
)
async def start_encounter(
    payload: EncounterCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.start_encounter(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Bắt đầu ca khám thành công",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/encounters/{encounter_id}",
    response_model=ResponseEnvelope[EncounterResponse],
    summary="Xem thông tin chi tiết ca khám và hồ sơ bệnh án điện tử (EMR)"
)
async def get_encounter_detail(
    encounter_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_encounter_detail(encounter_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy thông tin lượt khám thành công"
    )


@router.post(
    "/encounters/{encounter_id}/diagnoses",
    response_model=ResponseEnvelope[DiagnosisResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm chẩn đoán bệnh theo danh mục mã chuẩn quốc tế WHO ICD-10"
)
async def add_diagnosis(
    encounter_id: int,
    payload: DiagnosisCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.add_diagnosis(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Thêm chẩn đoán ICD-10 thành công",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/encounters/{encounter_id}/orders",
    response_model=ResponseEnvelope[OrderResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Kê phiếu chỉ định dịch vụ cận lâm sàng (xét nghiệm, chẩn đoán hình ảnh)"
)
async def add_order(
    encounter_id: int,
    payload: OrderCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.add_order(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Kê chỉ định cận lâm sàng thành công",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/encounters/{encounter_id}/complete",
    response_model=ResponseEnvelope[EncounterResponse],
    summary="Hoàn tất ca khám và khóa vĩnh viễn hồ sơ bệnh án thành Read-only (Thông tư 32/2023/TT-BYT)"
)
async def complete_encounter(
    encounter_id: int,
    payload: EncounterCompleteRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.complete_encounter(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Ca khám đã được hoàn tất và khóa hồ sơ bệnh án thành công"
    )
