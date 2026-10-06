import pytest
from sqlalchemy import select
from app.models.appointment import PhanTichAI
from app.models.user import ChuyenKhoa
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


def test_remove_diacritics_for_unaccented_matching():
    """Bỏ dấu tiếng Việt kể cả chữ đ/Đ để so khớp với văn bản gõ không dấu"""
    assert ai_service.remove_diacritics("đau ngực dữ dội") == "dau nguc du doi"
    assert ai_service.remove_diacritics("Đột quỵ, LIỆT NỬA NGƯỜI") == "Dot quy, LIET NUA NGUOI"


@pytest.mark.parametrize("text", [
    "toi bi dau nguc du doi",            # gõ không dấu hoàn toàn
    "Tôi bị đau nguc du dội lắm",        # trộn có dấu/không dấu
    "con toi bi co giat lien tuc",
    "bo toi bat ngo liet nua nguoi",
])
def test_red_flag_detected_without_diacritics(text):
    """Dấu hiệu cấp cứu phải được nhận diện dù người bệnh gõ không dấu (an toàn người bệnh)"""
    text_norm = ai_service.normalize_vietnamese(text)
    assert any(ai_service.contains_red_flag(text_norm, kw) for kw in ["đau ngực dữ dội", "co giật", "liệt nửa người"])


@pytest.mark.parametrize("text, keyword", [
    ("hom nay toi thay met hon met hom qua", "hôn mê"),   # 'hon me' chỉ là một phần của 'hon met'
    ("Hôm nay tôi thấy mệt hơn mệt hôm qua", "hôn mê"),   # có dấu: bỏ dấu cũng thành 'hon met'
])
def test_red_flag_matches_whole_words_only(text, keyword):
    """Bỏ dấu không được gây báo nhầm khi cụm từ chỉ là một phần của từ khác"""
    text_norm = ai_service.normalize_vietnamese(text)
    assert ai_service.contains_red_flag(text_norm, keyword) is False


@pytest.mark.asyncio
async def test_api_detects_red_flag_typed_without_diacritics(api_client):
    """API trả cảnh báo cấp cứu cho triệu chứng gõ không dấu (trước đây bỏ sót -> vẫn gợi ý đặt lịch thường)"""
    res = await api_client.post("/api/v1/ai/analyze-symptoms", json={"trieu_chung": "toi bi dau nguc du doi"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["has_emergency"] is True
    assert data["suggested_specialties"] == []


async def _log_moi_nhat(db_session, trieu_chung):
    stmt = select(PhanTichAI).where(PhanTichAI.trieu_chung_nhap == trieu_chung).order_by(PhanTichAI.id.desc())
    return (await db_session.execute(stmt)).scalars().first()


@pytest.mark.parametrize("trieu_chung", [
    "Ho có đờm, khò khè về đêm",          # nhánh gợi ý chuyên khoa
    "Tôi bị đau ngực dữ dội và vã mồ hôi",  # nhánh cảnh báo cấp cứu
])
@pytest.mark.asyncio
async def test_ai_log_links_logged_in_patient(api_client, booking, db_session, trieu_chung):
    """Nhật ký suy luận gắn đúng hồ sơ bệnh nhân khi gọi kèm access token của bệnh nhân"""
    text = f"{trieu_chung} ({booking.suffix})"
    res = await api_client.post("/api/v1/ai/analyze-symptoms", json={"trieu_chung": text}, headers=booking.tokens["bn_a"])
    assert res.status_code == 200
    log = await _log_moi_nhat(db_session, text)
    assert log is not None
    assert log.benh_nhan_id == booking.bn_a.id


@pytest.mark.asyncio
async def test_ai_log_for_guest_has_no_patient(api_client, booking, db_session):
    """Khách vãng lai (không gửi token) vẫn dùng được công cụ AI, nhật ký không gắn bệnh nhân"""
    text = f"Đau đầu, mất ngủ nhiều đêm ({booking.suffix})"
    res = await api_client.post("/api/v1/ai/analyze-symptoms", json={"trieu_chung": text})
    assert res.status_code == 200
    log = await _log_moi_nhat(db_session, text)
    assert log.benh_nhan_id is None


@pytest.mark.asyncio
async def test_ai_rejects_invalid_or_expired_token(api_client, booking, db_session):
    """Đã gửi token nhưng sai/hết hạn -> 401 để client làm mới token, không âm thầm coi là khách"""
    text = f"Đau đầu, mất ngủ nhiều đêm ({booking.suffix})"
    res = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": text}, headers={"Authorization": "Bearer abc.def.ghi"}
    )
    assert res.status_code == 401
    assert await _log_moi_nhat(db_session, text) is None


@pytest.mark.asyncio
async def test_ai_log_ignores_doctor_account(api_client, booking, db_session):
    """Bác sĩ thử công cụ AI không bị ghi nhận như bệnh nhân"""
    text = f"Chóng mặt quay cuồng, ù tai ({booking.suffix})"
    res = await api_client.post("/api/v1/ai/analyze-symptoms", json={"trieu_chung": text}, headers=booking.tokens["bs_x"])
    assert res.status_code == 200
    assert (await _log_moi_nhat(db_session, text)).benh_nhan_id is None


@pytest.mark.asyncio
async def test_suggestion_for_missing_specialty_has_null_id(db_session):
    """Khoa gợi ý chưa có trong CSDL -> chuyen_khoa_id là None (không phải ID ma 0) và không có bác sĩ"""
    suggestion = await ai_service._build_specialty_suggestion("Chuyên khoa không tồn tại XYZ", 0.8, "test", db_session)
    assert suggestion.chuyen_khoa_id is None
    assert suggestion.ten_chuyen_khoa == "Chuyên khoa không tồn tại XYZ"
    assert suggestion.danh_sach_bac_si == []


@pytest.mark.parametrize("text", [
    "mắt có giật nhẹ mấy hôm nay",       # 'có giật' (máy mắt) không phải 'co giật'
    "cơ giật ở bắp chân khi chạy bộ",     # 'cơ giật' (giật cơ) không phải 'co giật'
    "hôn mẹ trước khi đi làm",            # 'hôn mẹ' không phải 'hôn mê'
])
def test_accented_words_do_not_collide_after_removing_diacritics(text):
    """Tiếng gõ có dấu phải khớp đúng dấu: bỏ dấu không được biến từ vô hại thành dấu hiệu cấp cứu"""
    tokens = ai_service.tokenize(ai_service.normalize_vietnamese(text))
    assert not any(ai_service.contains_phrase(tokens, kw) for kw in ["co giật", "hôn mê"])


@pytest.mark.asyncio
async def test_harmless_twitch_gets_specialty_not_emergency(api_client, booking):
    res = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": f"Mắt có giật nhẹ, mất ngủ ({booking.suffix})"}
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["has_emergency"] is False
    assert data["suggested_specialties"] != []


@pytest.mark.asyncio
async def test_emergency_log_records_matched_keyword(api_client, booking, db_session):
    """Nhật ký cấp cứu ghi lại từ khóa đã kích hoạt cảnh báo để hậu kiểm"""
    text = f"Con tôi bị co giật liên tục ({booking.suffix})"
    res = await api_client.post("/api/v1/ai/analyze-symptoms", json={"trieu_chung": text})
    assert res.json()["data"]["has_emergency"] is True
    log = await _log_moi_nhat(db_session, text)
    assert log.co_dau_hieu_cap_cuu is True
    assert log.tu_khoa_cap_cuu_phat_hien is not None
    assert ai_service.contains_red_flag(ai_service.normalize_vietnamese(text), log.tu_khoa_cap_cuu_phat_hien)


@pytest.mark.asyncio
async def test_specialty_classification_without_diacritics(api_client, booking, db_session):
    """Chốt chặn 2 cũng nhận diện văn bản gõ không dấu, không rơi về Nội tổng quát"""
    await _dam_bao_chuyen_khoa(db_session, "KHOA_TIEU_HOA", "Tiêu hóa")
    res = await api_client.post(
        "/api/v1/ai/analyze-symptoms", json={"trieu_chung": f"dau bung tieu chay, day hoi ({booking.suffix})"}
    )
    data = res.json()["data"]
    assert data["has_emergency"] is False
    assert data["default_assigned"] is False
    assert data["suggested_specialties"][0]["ten_chuyen_khoa"] == "Tiêu hóa"


@pytest.mark.asyncio
async def test_specialty_lookup_prefers_exact_name_when_names_overlap(db_session):
    """Có 'Tim mạch' và 'Tim mạch nhi' cùng lúc: không lỗi MultipleResultsFound, chọn đúng khoa trùng tên"""
    tim_mach = await _dam_bao_chuyen_khoa(db_session, "KHOA_TIM_MACH", "Tim mạch")
    await _dam_bao_chuyen_khoa(db_session, "KHOA_TIM_MACH_NHI_TEST", "Tim mạch nhi")
    suggestion = await ai_service._build_specialty_suggestion("Tim mạch", 0.8, "test", db_session)
    assert suggestion.chuyen_khoa_id == tim_mach.id
    assert suggestion.ten_chuyen_khoa == "Tim mạch"


async def _dam_bao_chuyen_khoa(db_session, ma, ten):
    """Lấy chuyên khoa theo tên, thêm mới nếu DB test chưa seed"""
    ck = (await db_session.execute(select(ChuyenKhoa).where(ChuyenKhoa.ten_chuyen_khoa == ten))).scalar_one_or_none()
    if ck is None:
        ck = ChuyenKhoa(ma_chuyen_khoa=ma, ten_chuyen_khoa=ten)
        db_session.add(ck)
        await db_session.flush()
    return ck
