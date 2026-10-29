import pytest
from sqlalchemy import select

from app.ml.triage_model import MODEL_VERSION, get_ai_triage_model
from app.models.user import ChuyenKhoa
from app.ml.triage_nlp import detect_red_flags


@pytest.mark.parametrize("text", [
    "Tôi không chảy máu nhiều",
    "Tôi không co giật, không hôn mê",
    "Mắt có giật nhẹ",
])
def test_extra_red_flags_respect_negation_and_accent_collisions(text):
    assert detect_red_flags(text) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("confidence,expected_fallback", [(0.59, True), (0.60, False)])
async def test_api_sixty_percent_boundary(api_client, monkeypatch, confidence, expected_fallback):
    from types import SimpleNamespace
    from importlib import import_module
    service_module = import_module("app.services.ai_service")

    result = {
        "specialties": [{"specialty": "Răng Hàm Mặt", "probability": confidence}],
        "diseases": [],
        "recognized_symptoms": ["đau răng", "sưng nướu"],
        "clinical_match_count": 2,
    }
    monkeypatch.setattr(
        service_module, "get_ai_triage_model",
        lambda: SimpleNamespace(analyze=lambda *args, **kwargs: result),
    )
    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": "Đau răng, sưng nướu"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["default_assigned"] is expected_fallback


@pytest.mark.asyncio
async def test_frontend_emergency_does_not_offer_routine_doctor(api_client):
    response = await api_client.post(
        "/api/v1/ai-triage/analyze", json={"symptoms": "toi bi dau nguc du doi"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["has_emergency"] is True
    assert "115" in data["emergency_alert"]
    assert data["bacSi"] is None
    assert data["phongKham"] is None


async def _ensure_specialty(db_session, code: str, name: str) -> None:
    existing = (
        await db_session.execute(
            select(ChuyenKhoa).where(ChuyenKhoa.ten_chuyen_khoa == name)
        )
    ).scalar_one_or_none()
    if existing is None:
        db_session.add(ChuyenKhoa(ma_chuyen_khoa=code, ten_chuyen_khoa=name))
        await db_session.flush()


def test_packaged_model_routes_dental_symptoms():
    result = get_ai_triage_model().analyze(
        "Đau răng dữ dội, sưng nướu và hôi miệng",
        age=30,
    )

    assert result["specialties"][0]["specialty"] == "Răng Hàm Mặt"
    assert result["specialties"][0]["probability"] >= 0.60
    assert result["clinical_match_count"] >= 2
    assert "đau răng dữ dội" in result["recognized_symptoms"]


def test_packaged_model_supports_unaccented_vietnamese():
    result = get_ai_triage_model().analyze(
        "dau hong, nghet mui va u tai",
        age=35,
    )

    assert result["specialties"][0]["specialty"] == "Tai Mũi Họng"
    assert result["specialties"][0]["probability"] >= 0.60


def test_packaged_model_does_not_infer_pediatrics_without_age_evidence():
    result = get_ai_triage_model().analyze("sốt cao và ho", age=30)

    assert result["pediatric_evidence"] is False
    assert result["specialties"][0]["specialty"] != "Nhi"


@pytest.mark.asyncio
async def test_api_uses_model_and_returns_explainability(api_client, db_session):
    await _ensure_specialty(db_session, "KHOA_RHM_AI_TEST", "Răng Hàm Mặt")

    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms",
        json={
            "trieu_chung": "Đau răng dữ dội, sưng nướu và hôi miệng",
            "tuoi": 30,
        },
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["model_version"] == MODEL_VERSION
    assert data["has_emergency"] is False
    assert data["default_assigned"] is False
    assert data["suggested_specialties"][0]["ten_chuyen_khoa"] == "Răng Hàm Mặt"
    assert data["suggested_specialties"][0]["do_tin_cay"] >= 0.60
    assert len(data["recognized_symptoms"]) >= 2
    assert data["disease_predictions"]


@pytest.mark.asyncio
async def test_api_low_information_requests_more_detail_and_falls_back(
    api_client,
    db_session,
):
    await _ensure_specialty(db_session, "KHOA_NOI_AI_TEST", "Nội tổng quát")

    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms",
        json={"trieu_chung": "Tôi thấy mệt"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["default_assigned"] is True
    assert data["needs_more_information"] is True
    assert data["suggested_specialties"][0]["ten_chuyen_khoa"] == "Nội tổng quát"
    assert "Vui lòng bổ sung" in data["suggested_specialties"][0]["ly_do_de_xuat"]


@pytest.mark.asyncio
async def test_api_model_red_flag_stops_specialty_prediction(api_client):
    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms",
        json={"trieu_chung": "Tôi bị méo miệng và nói ngọng đột ngột"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["has_emergency"] is True
    assert "115" in data["emergency_alert"]
    assert data["suggested_specialties"] == []
