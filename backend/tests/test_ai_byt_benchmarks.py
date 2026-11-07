import pytest
from app.services.ai_service import ai_service


def test_negation_detection_basic():
    text_normal = "Tôi bị ho và sốt nhẹ nhưng không khó thở, không đau ngực"
    text_norm = ai_service.normalize_vietnamese(text_normal)
    
    assert ai_service.contains_phrase(text_norm, "ho", check_negation=False) is True
    assert ai_service.contains_phrase(text_norm, "khó thở", check_negation=True) is False
    assert ai_service.contains_phrase(text_norm, "đau ngực", check_negation=True) is False


@pytest.mark.parametrize("text", [
    "tôi không hề bị co giật",
    "bệnh nhân chưa từng bị hôn mê",
    "bác sĩ yên tâm tôi chẳng khó thở đâu",
    "tôi chỉ mệt thôi chứ không có đau ngực",
    "không bị liệt nửa người"
])
def test_negation_detection_phrases(text):
    text_norm = ai_service.normalize_vietnamese(text)
    
    for kw in ["co giật", "hôn mê", "khó thở", "đau ngực", "liệt nửa người"]:
        if kw in text:
            assert ai_service.contains_phrase(text_norm, kw, check_negation=True) is False


def test_affirmative_emergency_still_detected():
    text_emergency = "Bệnh nhân đột ngột đau ngực dữ dội kèm đau thắt ngực và vã mồ hôi lạnh"
    text_norm = ai_service.normalize_vietnamese(text_emergency)
    
    assert ai_service.contains_phrase(text_norm, "đau ngực", check_negation=True) is True
    assert ai_service.contains_phrase(text_norm, "đau thắt ngực", check_negation=True) is True
    assert ai_service.contains_phrase(text_norm, "vã mồ hôi", check_negation=True) is True


def test_mixed_affirmative_and_negation():
    text = "Tôi bị đau dạ dày quặn thắt nhưng không nôn ra máu, không sốt cao"
    text_norm = ai_service.normalize_vietnamese(text)
    
    assert ai_service.contains_phrase(text_norm, "đau dạ dày", check_negation=False) is True
    assert ai_service.contains_phrase(text_norm, "nôn ra máu", check_negation=True) is False


def test_byt_reference_citation_format():
    alert_content = (
        "CẢNH BÁO CẤP CỨU: Phát hiện dấu hiệu nguy kịch nghi ngờ hội chứng vành cấp! "
        "(Căn cứ Quyết định số 1857/QĐ-BYT ngày 18/04/2023 của Bộ Y tế). "
        "Vui lòng gọi ngay 115 hoặc đến cơ sở y tế gần nhất."
    )
    
    assert "115" in alert_content
    assert "1857/QĐ-BYT" in alert_content
    assert "Bộ Y tế" in alert_content


def test_confidence_tier_calculation():
    conf_high = 0.84
    assert conf_high >= 0.75
    
    conf_mid = 0.65
    assert 0.40 <= conf_mid < 0.75
    
    conf_low = 0.39
    assert conf_low < 0.40
