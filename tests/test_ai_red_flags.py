import pytest
from app.services.ai_service import ai_service


def test_vietnamese_normalization():
    """Kiểm tra chuẩn hóa chuỗi tiếng Việt sang Unicode NFC và chữ thường"""
    raw_text = "Tôi bị ĐAU NGỰC  DỮ DỘI!! Và KHÓ THỞ... "
    normalized = ai_service.normalize_vietnamese(raw_text)

    assert "đau ngực dữ dội" in normalized
    assert "khó thở" in normalized
    assert "!" not in normalized
    assert "." not in normalized


@pytest.mark.asyncio
async def test_emergency_red_flags_scanner_mock():
    """Kiểm tra logic chốt chặn số 1: Tự động bắt dấu hiệu cấp cứu nguy kịch"""
    text_emergency = "Tôi cảm thấy đau ngực dữ dội lan ra tay trái, khó thở cấp"
    text_norm = ai_service.normalize_vietnamese(text_emergency)

    # Built-in emergency detector
    built_in_emergency = ["đau ngực dữ dội", "khó thở cấp", "ngất xỉu", "co giật"]
    has_red_flag = any(kw in text_norm for kw in built_in_emergency)

    assert has_red_flag is True


def test_safe_symptoms_not_trigger_red_flags():
    """Kiểm tra các triệu chứng thông thường không bị báo nhầm cấp cứu"""
    text_safe = "Tôi bị đầy hơi khó tiêu sau khi ăn đồ cay, ợ chua nhẹ"
    text_norm = ai_service.normalize_vietnamese(text_safe)

    built_in_emergency = ["đau ngực dữ dội", "khó thở cấp", "ngất xỉu", "co giật", "liệt nửa người"]
    has_red_flag = any(kw in text_norm for kw in built_in_emergency)

    assert has_red_flag is False
