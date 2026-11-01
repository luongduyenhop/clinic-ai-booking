from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_optional_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.ai import SymptomTriageRequest, SymptomTriageResponse
from app.services.ai_service import ai_service
from app.services.bff_admin_service import bff_admin_service

router = APIRouter(prefix="/ai", tags=["3. Trí Tuệ Nhân Tạo & Red Flags (Package C)"])
fe_triage_router = APIRouter(prefix="/ai-triage", tags=["3. Trí Tuệ Nhân Tạo & Red Flags (Package C)"])


class FeTriageRequest(BaseModel):
    symptoms: Optional[str] = None
    trieu_chung: Optional[str] = None


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


@fe_triage_router.post(
    "/analyze",
    response_model=ResponseEnvelope[dict],
    summary="Endpoint AI Gợi ý Chuyên khoa phục vụ trực tiếp màn hình Tiếp đón Frontend"
)
async def analyze_symptoms_fe(
    payload: FeTriageRequest,
    current_user: Optional[TaiKhoan] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_text = (payload.symptoms or payload.trieu_chung or "").strip()
    if len(raw_text) < 5:
        raw_text = f"{raw_text} khám tổng quát".strip()

    triage_res = await ai_service.analyze_symptoms(
        SymptomTriageRequest(trieu_chung=raw_text),
        current_user,
        db,
    )

    if triage_res.has_emergency:
        return ResponseEnvelope.success_response(
            data={
                "recommended_specialty": None,
                "chuyenKhoa": None,
                "phongKham": None,
                "bacSi": None,
                "mucDoUuTien": "Cấp cứu / Ưu tiên cao",
                "lyDoGoiY": triage_res.emergency_alert,
                **triage_res.model_dump(),
            },
            message="Phát hiện dấu hiệu nguy cấp; gọi 115 hoặc đến cơ sở cấp cứu.",
        )

    store = await bff_admin_service.get_bootstrap_data(db)
    rooms = (store.get("catalogs") or {}).get("khoaPhong") or []
    defaults = store.get("formDefaults") or {}

    top_suggestion = triage_res.suggested_specialties[0] if triage_res.suggested_specialties else None
    chuyen_khoa = top_suggestion.ten_chuyen_khoa if top_suggestion else defaults.get("defaultSpecialty", "Nội tổng quát")
    ly_do = top_suggestion.ly_do_de_xuat if top_suggestion else "Gợi ý khám tầm soát ban đầu tại Chuyên khoa Nội."

    # Tìm buồng khám và bác sĩ phụ trách tương ứng trong danh mục khoaPhong
    matched_room = None
    ck_lower = chuyen_khoa.lower()
    for r in rooms:
        if ck_lower in str(r.get("chuyenKhoa", "")).lower() or ck_lower in str(r.get("tenPhong", "")).lower():
            matched_room = r
            break
    if not matched_room and rooms:
        matched_room = rooms[0]

    phong_kham = (matched_room or {}).get("tenPhong") or defaults.get("defaultClinicRoom", "P.101 - Khám Nội 1")
    bac_si = (matched_room or {}).get("bacSiPhuTrach") or (
        top_suggestion.danh_sach_bac_si[0].ho_ten if (top_suggestion and top_suggestion.danh_sach_bac_si) else defaults.get("defaultDoctor", "BS.CKII Nguyễn Minh Hoàng")
    )
    muc_do_uu_tien = "Cấp cứu / Ưu tiên cao" if triage_res.has_emergency else "Bình thường"
    if triage_res.has_emergency and triage_res.emergency_alert:
        ly_do = f"{triage_res.emergency_alert} — {ly_do}"

    return ResponseEnvelope.success_response(
        data={
            "recommended_specialty": chuyen_khoa,
            "chuyenKhoa": chuyen_khoa,
            "phongKham": phong_kham,
            "bacSi": bac_si,
            "mucDoUuTien": muc_do_uu_tien,
            "lyDoGoiY": ly_do,
            "has_emergency": triage_res.has_emergency,
            "emergency_alert": triage_res.emergency_alert,
            "disclaimer": triage_res.disclaimer,
            "suggested_specialties": [item.model_dump() for item in triage_res.suggested_specialties],
            "default_assigned": triage_res.default_assigned,
            "needs_more_information": triage_res.needs_more_information,
            "recognized_symptoms": triage_res.recognized_symptoms,
            "model_version": triage_res.model_version,
        },
        message="AI gợi ý phân luồng chuyên khoa thành công!",
    )

