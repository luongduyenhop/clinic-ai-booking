import uuid
from typing import Optional

import pytest

from app.models.user import BacSi, ChuyenKhoa, NguoiDung, PhongKham
from app.routers import ai_triage
from app.schemas.ai import SpecialtySuggestion, SymptomTriageResponse


async def _seed_doctor(
    db,
    specialty_id: int,
    room_id: Optional[int],
    name: str,
    is_active: bool = True,
) -> BacSi:
    suffix = uuid.uuid4().hex[:8]
    person = NguoiDung(
        ho_ten=name,
        email=f"doctor.{suffix}@test.local",
    )
    db.add(person)
    await db.flush()

    doctor = BacSi(
        nguoi_dung_id=person.id,
        hoc_vi="BS",
        chung_chi_hanh_nghe=f"CCHN-{suffix}",
        chuyen_khoa_id=specialty_id,
        phong_kham_id=room_id,
        is_active=is_active,
    )
    db.add(doctor)
    await db.flush()
    return doctor


async def _seed_department(
    db,
    name: str,
    room: Optional[str] = None,
    doctor: Optional[str] = None,
):
    suffix = uuid.uuid4().hex[:8]
    specialty = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-{suffix}",
        ten_chuyen_khoa=name,
    )
    db.add(specialty)
    await db.flush()

    room_obj = None
    if room:
        room_obj = PhongKham(
            ma_phong=f"P-{suffix}",
            ten_phong=room,
            chuyen_khoa_id=specialty.id,
            is_active=True,
        )
        db.add(room_obj)
        await db.flush()

    doctor_obj = None
    if doctor:
        doctor_obj = await _seed_doctor(
            db,
            specialty.id,
            room_obj.id if room_obj else None,
            doctor,
        )
    return specialty, room_obj, doctor_obj


def _triage_response(
    specialty_name: str,
    specialty_id: Optional[int] = None,
    emergency: bool = False,
) -> SymptomTriageResponse:
    if emergency:
        return SymptomTriageResponse(
            has_emergency=True,
            emergency_alert="Dấu hiệu nguy cấp, gọi 115 ngay.",
            suggested_specialties=[],
        )

    return SymptomTriageResponse(
        suggested_specialties=[
            SpecialtySuggestion(
                chuyen_khoa_id=specialty_id,
                ten_chuyen_khoa=specialty_name,
                do_tin_cay=0.9,
                muc_do_tin_cay="cao",
                ly_do_de_xuat="Kiểm thử định tuyến.",
            )
        ],
    )


def _patch_ai(monkeypatch, response: SymptomTriageResponse) -> None:
    async def fake_analyze_symptoms(_payload, _current_user, _db):
        return response

    monkeypatch.setattr(ai_triage.ai_service, "analyze_symptoms", fake_analyze_symptoms)


def _forbid_bff(monkeypatch) -> list:
    calls = []

    async def forbidden(*_args, **_kwargs):
        calls.append(1)
        raise AssertionError("AI Triage không được gọi bff_admin_service")

    monkeypatch.setattr(
        "app.services.admin.bff.bff_admin_service.BffAdminService.get_bootstrap_data",
        forbidden,
    )
    return calls


@pytest.mark.asyncio
async def test_triage_returns_relational_room_and_doctor(api_client, db_session, monkeypatch):
    specialty, room, _ = await _seed_department(
        db_session,
        "Răng Hàm Mặt",
        room="Phòng RHM 1",
        doctor="BS Răng Hàm Mặt",
    )
    bff_calls = _forbid_bff(monkeypatch)
    _patch_ai(monkeypatch, _triage_response("Răng Hàm Mặt", specialty.id))

    response = await api_client.post(
        "/api/v1/ai-triage/analyze",
        json={"symptoms": "đau răng dữ dội, sưng nướu"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["recommended_specialty"] == "Răng Hàm Mặt"
    assert data["chuyenKhoa"] == "Răng Hàm Mặt"
    assert data["phongKham"] == room.ten_phong
    assert data["bacSi"] == "BS Răng Hàm Mặt"
    assert bff_calls == []
    assert not hasattr(ai_triage, "bff_admin_service")


@pytest.mark.asyncio
async def test_triage_red_flag_keeps_emergency_branch(api_client, monkeypatch):
    bff_calls = _forbid_bff(monkeypatch)
    _patch_ai(monkeypatch, _triage_response("", emergency=True))

    response = await api_client.post(
        "/api/v1/ai-triage/analyze",
        json={"symptoms": "dau nguc du doi kho tho"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["has_emergency"] is True
    assert "115" in data["emergency_alert"]
    assert data["mucDoUuTien"] == "Cấp cứu / Ưu tiên cao"
    assert data["phongKham"] is None
    assert data["bacSi"] is None
    assert data["suggested_specialties"] == []
    assert bff_calls == []


@pytest.mark.asyncio
async def test_triage_falls_back_to_general_medicine_without_room(api_client, db_session, monkeypatch):
    specialty_without_room, _, _ = await _seed_department(db_session, "Mắt")
    fallback, room, _ = await _seed_department(
        db_session,
        "Nội tổng quát",
        room="Phòng Nội 1",
        doctor="BS Nội tổng quát",
    )
    _forbid_bff(monkeypatch)
    _patch_ai(monkeypatch, _triage_response("Mắt", specialty_without_room.id))

    response = await api_client.post(
        "/api/v1/ai-triage/analyze",
        json={"symptoms": "nhìn mờ, đau mắt"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["recommended_specialty"] == fallback.ten_chuyen_khoa
    assert data["chuyenKhoa"] == fallback.ten_chuyen_khoa
    assert data["phongKham"] == room.ten_phong
    assert data["bacSi"] == "BS Nội tổng quát"


@pytest.mark.asyncio
async def test_triage_skips_inactive_room_and_doctor(api_client, db_session, monkeypatch):
    specialty, _, _ = await _seed_department(db_session, "Tai Mũi Họng")
    suffix = uuid.uuid4().hex[:8]
    old_room = PhongKham(
        ma_phong=f"OLD-{suffix}",
        ten_phong="Phòng TMH cũ",
        chuyen_khoa_id=specialty.id,
        is_active=False,
    )
    new_room = PhongKham(
        ma_phong=f"NEW-{suffix}",
        ten_phong="Phòng TMH mới",
        chuyen_khoa_id=specialty.id,
        is_active=True,
    )
    db_session.add_all([old_room, new_room])
    await db_session.flush()

    await _seed_doctor(db_session, specialty.id, old_room.id, "BS TMH cũ", is_active=False)
    await _seed_doctor(db_session, specialty.id, new_room.id, "BS TMH mới", is_active=True)

    _forbid_bff(monkeypatch)
    _patch_ai(monkeypatch, _triage_response("Tai Mũi Họng", specialty.id))

    response = await api_client.post(
        "/api/v1/ai-triage/analyze",
        json={"symptoms": "đau họng, nghẹt mũi"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["phongKham"] == "Phòng TMH mới"
    assert data["bacSi"] == "BS TMH mới"
