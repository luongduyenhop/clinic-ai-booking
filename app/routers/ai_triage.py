from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.ai import SymptomTriageRequest, SymptomTriageResponse
from app.services.ai_service import ai_service
from sqlalchemy import select

router = APIRouter(prefix="/ai", tags=["3. Trí Tuệ Nhân Tạo & Red Flags (Package C)"])


@router.post(
    "/analyze-symptoms",
    response_model=ResponseEnvelope[SymptomTriageResponse],
    summary="Phân tích triệu chứng ngôn ngữ tự nhiên, quét Red Flags và gợi ý chuyên khoa (UC-C01 -> UC-C03)"
)
async def analyze_symptoms(
    payload: SymptomTriageRequest,
    authorization: str = Header(None, description="Optional: Bearer <token>"),
    db: AsyncSession = Depends(get_db)
):
    current_user = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        decoded = decode_access_token(token)
        if decoded and "sub" in decoded:
            stmt = select(TaiKhoan).where(TaiKhoan.id == int(decoded["sub"]))
            current_user = (await db.execute(stmt)).scalar_one_or_none()

    result = await ai_service.analyze_symptoms(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Phân tích triệu chứng thành công"
    )
