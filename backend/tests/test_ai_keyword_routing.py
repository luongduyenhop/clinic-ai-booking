"""Định tuyến theo từ khóa cơ quan phải thắng ngưỡng model nhưng không thắng red flag.

Các ca ở đây khóa lại hợp đồng an toàn:
- từ khóa cơ quan rõ ràng -> đúng khoa, kể cả khi model chưa đủ tự tin;
- phủ định / đa cơ quan -> không chốt cứng;
- chấn thương chung -> Ngoại nhưng không gợi ý bệnh Ngoại không liên quan;
- red flag luôn chạy trước và chặn mọi gợi ý chuyên khoa.
"""

from importlib import import_module
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.ml.triage_model import get_ai_triage_model
from app.models.user import ChuyenKhoa


async def _ensure_specialty(db_session, code: str, name: str) -> None:
    existing = (
        await db_session.execute(
            select(ChuyenKhoa).where(ChuyenKhoa.ten_chuyen_khoa == name)
        )
    ).scalar_one_or_none()
    if existing is None:
        db_session.add(ChuyenKhoa(ma_chuyen_khoa=code, ten_chuyen_khoa=name))
        await db_session.flush()


@pytest.mark.parametrize(
    "text,department,expected",
    [
        ("Tôi bị đau răng", "Răng Hàm Mặt", "Răng"),
        ("Đau họng, sốt, nuốt đau", "Tai Mũi Họng", "Tai Mũi Họng"),
        ("Tôi bị đau mắt đỏ", "Mắt", "Mắt"),
        ("Bị ngã xe gãy tay", "Ngoại", "Ngoại"),
        ("Đau dữ dội vùng bụng, cứng bụng", "Ngoại", "Ngoại"),
    ],
)
@pytest.mark.asyncio
async def test_explicit_organ_keywords_route_to_the_right_department(
    api_client, db_session, text, department, expected
):
    await _ensure_specialty(db_session, f"KHOA_KEYWORD_{expected}", department)

    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": text, "tuoi": 30}
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["has_emergency"] is False
    assert data["default_assigned"] is False
    assert data["needs_more_information"] is False
    # CSDL seed đặt tên khoa là "Khoa Răng" trong khi model dùng "Răng Hàm Mặt".
    assert expected in data["suggested_specialties"][0]["ten_chuyen_khoa"]
    assert "từ khóa" in data["suggested_specialties"][0]["ly_do_de_xuat"].lower()


@pytest.mark.parametrize(
    "text",
    [
        "Tôi không bị đau răng",
        "Đau răng và đau mắt",
        "Đau mắt cá chân sau khi chạy",
    ],
)
@pytest.mark.asyncio
async def test_ambiguous_or_negated_text_is_not_force_routed(api_client, db_session, text):
    await _ensure_specialty(db_session, "KHOA_RANG_KEYWORD", "Răng Hàm Mặt")

    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": text, "tuoi": 30}
    )

    assert response.status_code == 200
    reasons = [
        item["ly_do_de_xuat"].lower()
        for item in response.json()["data"]["suggested_specialties"]
    ]
    assert all("định tuyến theo từ khóa" not in reason for reason in reasons)


@pytest.mark.asyncio
async def test_keyword_route_bypasses_low_model_confidence(
    api_client, db_session, monkeypatch
):
    await _ensure_specialty(db_session, "KHOA_RANG_LOW_CONF", "Răng Hàm Mặt")
    service_module = import_module("app.services.ai_service")
    low_confidence_result = {
        "specialties": [{"specialty": "Nội tổng quát", "probability": 0.05}],
        "diseases": [],
        "disease_by_specialty": {},
        "recognized_symptoms": ["đau răng"],
        "clinical_match_count": 1,
    }
    monkeypatch.setattr(
        service_module,
        "get_ai_triage_model",
        lambda: SimpleNamespace(analyze=lambda *args, **kwargs: low_confidence_result),
    )

    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": "Tôi bị đau răng"}
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["default_assigned"] is False
    assert data["needs_more_information"] is False
    assert "Răng" in data["suggested_specialties"][0]["ten_chuyen_khoa"]


@pytest.mark.asyncio
async def test_keyword_route_still_works_when_model_is_unavailable(
    api_client, db_session, monkeypatch
):
    await _ensure_specialty(db_session, "KHOA_RANG_MODEL_DOWN", "Răng Hàm Mặt")
    service_module = import_module("app.services.ai_service")

    def _broken_model():
        raise service_module.AITriageModelError("model unavailable in test")

    monkeypatch.setattr(service_module, "get_ai_triage_model", _broken_model)

    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": "Tôi bị đau răng"}
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["default_assigned"] is False
    assert "Răng" in data["suggested_specialties"][0]["ten_chuyen_khoa"]
    assert data["disease_predictions"] == []


@pytest.mark.asyncio
async def test_red_flag_precedes_keyword_routing(api_client):
    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms",
        json={"trieu_chung": "Đau răng nhưng khó thở dữ dội"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["has_emergency"] is True
    assert "115" in data["emergency_alert"]
    assert data["suggested_specialties"] == []


@pytest.mark.asyncio
async def test_trauma_route_does_not_guess_unrelated_surgical_diseases(
    api_client, db_session
):
    await _ensure_specialty(db_session, "KHOA_NGOAI_TRAUMA", "Ngoại")

    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": "Bị ngã xe gãy tay"}
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["suggested_specialties"][0]["ten_chuyen_khoa"] == "Ngoại"
    assert data["disease_predictions"] == []


@pytest.mark.asyncio
async def test_acute_abdomen_keeps_diseases_scoped_to_surgery(api_client, db_session):
    await _ensure_specialty(db_session, "KHOA_NGOAI_ABDOMEN", "Ngoại")

    response = await api_client.post(
        "/api/v1/ai/analyze-symptoms",
        json={"trieu_chung": "Đau dữ dội vùng bụng, cứng bụng"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["suggested_specialties"][0]["ten_chuyen_khoa"] == "Ngoại"
    assert data["disease_predictions"]
    assert all(
        item["chuyen_khoa"] == "Ngoại" for item in data["disease_predictions"]
    )


def test_packaged_model_exposes_keyword_route_and_scoped_diseases():
    result = get_ai_triage_model().analyze("Tôi bị đau răng", age=30)

    assert result["keyword_route"] == {
        "specialty": "Răng Hàm Mặt",
        "keywords": ["răng"],
        "rule": "organ_keyword",
    }
    scoped = result["disease_by_specialty"]["Răng Hàm Mặt"]
    assert scoped
    assert all(item["chuyen_khoa"] == "Răng Hàm Mặt" for item in scoped)
    assert all(item["ma_benh"] and item["ten_benh"] for item in scoped)
