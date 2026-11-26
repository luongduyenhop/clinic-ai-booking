from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_optional_current_user
from app.core.response import ResponseEnvelope
from app.models.user import BacSi, ChuyenKhoa, NguoiDung, PhongKham, TaiKhoan
from app.schemas.ai import SpecialtySuggestion, SymptomTriageRequest, SymptomTriageResponse
from app.services.ai_triage.ai_service import ai_service
from app.services.patient.medical_service import medical_service

router = APIRouter(prefix="/ai", tags=["3. Trí Tuệ Nhân Tạo & Red Flags (Package C)"])
fe_triage_router = APIRouter(prefix="/ai-triage", tags=["3. Trí Tuệ Nhân Tạo & Red Flags (Package C)"])


class FeTriageRequest(BaseModel):
    symptoms: Optional[str] = None
    trieu_chung: Optional[str] = None


FALLBACK_SPECIALTY = "Nội tổng quát"
DEFAULT_REASON = "Gợi ý khám tầm soát ban đầu tại Chuyên khoa Nội."


async def _find_active_specialty(
    db: AsyncSession,
    specialty_id: Optional[int],
    specialty_name: Optional[str],
) -> Optional[ChuyenKhoa]:
    if specialty_id is not None:
        matched = (
            await db.execute(
                select(ChuyenKhoa).where(
                    ChuyenKhoa.id == specialty_id,
                    ChuyenKhoa.is_active.is_(True),
                )
            )
        ).scalars().first()
        if matched:
            return matched

    name = (specialty_name or "").strip()
    if not name:
        return None

    return (
        await db.execute(
            select(ChuyenKhoa)
            .where(
                ChuyenKhoa.ten_chuyen_khoa.ilike(f"%{name}%"),
                ChuyenKhoa.is_active.is_(True),
            )
            .order_by(
                case((func.lower(ChuyenKhoa.ten_chuyen_khoa) == name.lower(), 0), else_=1),
                func.length(ChuyenKhoa.ten_chuyen_khoa),
                ChuyenKhoa.id,
            )
            .limit(1)
        )
    ).scalars().first()


async def _first_active_room(db: AsyncSession, specialty_id: int) -> Optional[PhongKham]:
    return (
        await db.execute(
            select(PhongKham)
            .where(
                PhongKham.chuyen_khoa_id == specialty_id,
                PhongKham.is_active.is_(True),
            )
            .order_by(
                case((PhongKham.loai_phong == "kham_benh", 0), else_=1),
                PhongKham.id,
            )
            .limit(1)
        )
    ).scalars().first()


async def _active_room_by_id(
    db: AsyncSession,
    room_id: int,
    specialty_id: int,
) -> Optional[PhongKham]:
    return (
        await db.execute(
            select(PhongKham).where(
                PhongKham.id == room_id,
                PhongKham.chuyen_khoa_id == specialty_id,
                PhongKham.is_active.is_(True),
            )
        )
    ).scalars().first()


async def _find_visible_doctor(
    db: AsyncSession,
    specialty_id: int,
    doctor_id: Optional[int] = None,
    room_id: Optional[int] = None,
):
    stmt = medical_service._visible_doctors(BacSi, NguoiDung.ho_ten).where(
        BacSi.chuyen_khoa_id == specialty_id
    )
    if doctor_id is not None:
        stmt = stmt.where(BacSi.id == doctor_id)
    if room_id is not None:
        stmt = stmt.where(BacSi.phong_kham_id == room_id)
    return (await db.execute(stmt.order_by(BacSi.id).limit(1))).first()


async def _resolve_room_and_doctor(
    db: AsyncSession,
    specialty: ChuyenKhoa,
    suggestion: Optional[SpecialtySuggestion],
):
    room = await _first_active_room(db, specialty.id)

    if suggestion and suggestion.danh_sach_bac_si:
        row = await _find_visible_doctor(
            db,
            specialty.id,
            doctor_id=suggestion.danh_sach_bac_si[0].id,
        )
        if row:
            doctor = row[0]
            if doctor.phong_kham_id:
                doctor_room = await _active_room_by_id(db, doctor.phong_kham_id, specialty.id)
                if doctor_room:
                    room = doctor_room
            return room, row[1]

    row = await _find_visible_doctor(
        db,
        specialty.id,
        room_id=room.id if room else None,
    )
    if row is None and room is not None:
        row = await _find_visible_doctor(db, specialty.id)
    return room, row[1] if row else None


async def _resolve_routing(
    db: AsyncSession,
    suggestion: Optional[SpecialtySuggestion],
):
    specialty = await _find_active_specialty(
        db,
        suggestion.chuyen_khoa_id if suggestion else None,
        suggestion.ten_chuyen_khoa if suggestion else None,
    )
    if specialty is None:
        specialty = await _find_active_specialty(db, None, FALLBACK_SPECIALTY)

    if specialty is not None and await _first_active_room(db, specialty.id) is None:
        fallback = await _find_active_specialty(db, None, FALLBACK_SPECIALTY)
        if fallback is not None and fallback.id != specialty.id:
            specialty = fallback

    if specialty is None:
        return None, None, None

    room, doctor_name = await _resolve_room_and_doctor(db, specialty, suggestion)
    return specialty, room, doctor_name


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

    top_suggestion = triage_res.suggested_specialties[0] if triage_res.suggested_specialties else None
    specialty, room, doctor_name = await _resolve_routing(db, top_suggestion)

    chuyen_khoa = (
        specialty.ten_chuyen_khoa
        if specialty
        else (top_suggestion.ten_chuyen_khoa if top_suggestion else FALLBACK_SPECIALTY)
    )
    ly_do = top_suggestion.ly_do_de_xuat if top_suggestion else DEFAULT_REASON
    phong_kham = room.ten_phong if room else None
    bac_si = doctor_name
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

