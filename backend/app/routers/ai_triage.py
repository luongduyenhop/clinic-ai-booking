from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_optional_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.ai import SymptomTriageRequest, SymptomTriageResponse
from app.services.ai_service import ai_service

router = APIRouter(prefix="/ai", tags=["3. Trí Tuệ Nhân Tạo & Red Flags (Package C)"])


@router.post(
    "/analyze-symptoms",
    response_model=ResponseEnvelope[SymptomTriageResponse],
    summary="Phân tích triệu chứng ngôn ngữ tự nhiên, quét Red Flags và gợi ý chuyên khoa (UC-C01 -> UC-C03)"
)
async def analyze_symptoms(
    payload: SymptomTriageRequest,
    current_user: Optional[TaiKhoan] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await ai_service.analyze_symptoms(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Phân tích triệu chứng thành công"
    )
