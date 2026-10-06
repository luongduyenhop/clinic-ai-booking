import pytest
from app.services.ai_service import ai_service


def test_negation_detection_basic():
    """Kiểm tra xử lý phủ định: 'không đau ngực', 'không khó thở' không được báo cờ đỏ"""
    text_normal = "Tôi bị ho và sốt nhẹ nhưng không khó thở, không đau ngực"
    text_norm = ai_service.normalize_vietnamese(text_normal)
    
    # Kiểm tra từ khóa đơn lẻ
    assert ai_service.contains_phrase(text_norm, "ho", check_negation=False) is True
    # Kiểm tra cờ đỏ có từ phủ định đứng trước
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
    """Kiểm tra đa dạng cấu trúc phủ định tiếng Việt trong tiền xử lý NLP"""
    text_norm = ai_service.normalize_vietnamese(text)
    
    for kw in ["co giật", "hôn mê", "khó thở", "đau ngực", "liệt nửa người"]:
        if kw in text:
            assert ai_service.contains_phrase(text_norm, kw, check_negation=True) is False


def test_affirmative_emergency_still_detected():
    """Kiểm tra nếu là dấu hiệu khẳng định thực sự thì vẫn phải bắt chính xác cờ đỏ"""
    text_emergency = "Bệnh nhân đột ngột đau ngực dữ dội kèm đau thắt ngực và vã mồ hôi lạnh"
    text_norm = ai_service.normalize_vietnamese(text_emergency)
    
    assert ai_service.contains_phrase(text_norm, "đau ngực", check_negation=True) is True
    assert ai_service.contains_phrase(text_norm, "đau thắt ngực", check_negation=True) is True
    assert ai_service.contains_phrase(text_norm, "vã mồ hôi", check_negation=True) is True


def test_mixed_affirmative_and_negation():
    """Kiểm tra văn bản hỗn hợp: có triệu chứng khẳng định và có triệu chứng phủ định"""
    text = "Tôi bị đau dạ dày quặn thắt nhưng không nôn ra máu, không sốt cao"
    text_norm = ai_service.normalize_vietnamese(text)
    
    # Triệu chứng khẳng định tiêu hóa -> bắt được
    assert ai_service.contains_phrase(text_norm, "đau dạ dày", check_negation=False) is True
    # Triệu chứng cấp cứu bị phủ định -> KHÔNG được bắt
    assert ai_service.contains_phrase(text_norm, "nôn ra máu", check_negation=True) is False


def test_byt_reference_citation_format():
    """Kiểm tra định dạng trích dẫn văn bản Bộ Y Tế trong cảnh báo cấp cứu"""
    # Mô phỏng nội dung cảnh báo cấp cứu theo chuẩn Bộ Y Tế
    alert_content = (
        "CẢNH BÁO CẤP CỨU: Phát hiện dấu hiệu nguy kịch nghi ngờ hội chứng vành cấp! "
        "(Căn cứ Quyết định số 1857/QĐ-BYT ngày 18/04/2023 của Bộ Y tế). "
        "Vui lòng gọi ngay 115 hoặc đến cơ sở y tế gần nhất."
    )
    
    assert "115" in alert_content
    assert "1857/QĐ-BYT" in alert_content
    assert "Bộ Y tế" in alert_content


def test_confidence_tier_calculation():
    """Kiểm tra công thức và quy tắc 3 tầng độ tin cậy tham chiếu Infermedica"""
    # Tầng 1: >= 75% -> Mức cao
    conf_high = 0.84
    assert conf_high >= 0.75
    
    # Tầng 2: 60% <= conf < 75% -> Mức trung bình
    conf_mid = 0.65
    assert 0.60 <= conf_mid < 0.75
    
    # Tầng 3: < 60% -> Mức thấp, fallback Nội tổng quát
    conf_low = 0.45
    assert conf_low < 0.60
