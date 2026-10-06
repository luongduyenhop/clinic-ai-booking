import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from app.models.medical import ChanDoan, LuotKham
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_completion_fails_without_primary_diagnosis(api_client, booking, db_session):
    """Case 1: Không có chẩn đoán chính -> 422 Unprocessable Entity"""
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám họng"},
        headers=token_bs
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    # Thử complete ngay mà không add diagnosis nào
    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Kê đơn theo dõi"},
        headers=token_bs
    )
    assert res_complete.status_code == 422
    assert "đúng một chẩn đoán chính" in res_complete.json()["message"]

    # Kiểm tra encounter vẫn chưa bị khóa
    enc = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    assert enc.is_locked is False


@pytest.mark.asyncio
async def test_completion_fails_with_multiple_primary_diagnoses(api_client, booking, db_session):
    """Case 2: Có 2 chẩn đoán chính (|P(E)| = 2 != 1) -> 422 Unprocessable Entity"""
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id},
        headers=token_bs
    )
    enc_id = res_enc.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "I10", "Tăng huyết áp vô căn")
    await _dam_bao_ma_icd10(db_session, "E11", "Đái tháo đường type 2")

    # Add diagnosis chính 1
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "I10", "ten_benh_chan_doan": "Tăng huyết áp", "loai_chan_doan": "chinh"},
        headers=token_bs
    )
    # Add diagnosis chính 2
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "E11", "ten_benh_chan_doan": "Đái tháo đường", "loai_chan_doan": "chinh"},
        headers=token_bs
    )

    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Theo dõi nội trú"},
        headers=token_bs
    )
    assert res_complete.status_code == 422
    assert "đúng một chẩn đoán chính" in res_complete.json()["message"]


@pytest.mark.asyncio
async def test_completion_fails_when_primary_diagnosis_has_blank_icd(api_client, booking, db_session):
    """Case 3: Chẩn đoán chính có mã ICD-10 rỗng hoặc whitespace -> 422"""
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id},
        headers=token_bs
    )
    enc_id = res_enc.json()["data"]["id"]

    # Chèn trực tiếp bản ghi có ma_icd10 khoảng trắng vào DB
    cd_blank = ChanDoan(
        luot_kham_id=enc_id,
        ma_icd10="   ",
        ten_benh_chan_doan="Bệnh chưa rõ mã",
        loai_chan_doan="chinh"
    )
    db_session.add(cd_blank)
    await db_session.commit()

    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Chờ hội chẩn"},
        headers=token_bs
    )
    assert res_complete.status_code == 422
    assert "phải có mã ICD-10" in res_complete.json()["message"]


@pytest.mark.asyncio
async def test_completion_succeeds_with_valid_single_primary_diagnosis(api_client, booking, db_session):
    """Case 4: Đúng 1 chẩn đoán chính có mã ICD-10 hợp lệ (+ kèm chẩn đoán phụ hợp lệ) -> 200 OK"""
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id},
        headers=token_bs
    )
    enc_id = res_enc.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày không đặc hiệu")
    await _dam_bao_ma_icd10(db_session, "R10.4", "Đau bụng không đặc hiệu")

    # 1 chẩn đoán chính
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày", "loai_chan_doan": "chinh"},
        headers=token_bs
    )
    # 1 chẩn đoán phụ (phụ không làm vi phạm len(primary) == 1)
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "R10.4", "ten_benh_chan_doan": "Đau bụng", "loai_chan_doan": "phu"},
        headers=token_bs
    )

    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Uống thuốc theo đơn và tái khám"},
        headers=token_bs
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["data"]["is_locked"] is True


@pytest.mark.asyncio
async def test_locked_encounter_returns_409_even_if_diagnosis_missing(api_client, booking, db_session):
    """Case 5: Bệnh án đã khóa ưu tiên trả 409 Conflict trước khi check 422 diagnosis"""
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id},
        headers=token_bs
    )
    enc_id = res_enc.json()["data"]["id"]

    # Đánh dấu is_locked = True trực tiếp mà KHÔNG tạo chẩn đoán nào
    enc = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    enc.is_locked = True
    await db_session.commit()

    # Thử complete
    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Xong"},
        headers=token_bs
    )
    # Phải trả về 409 vì is_locked guard đứng trước _assert_completion_diagnosis_invariant
    assert res_complete.status_code == 409
    assert "đã được hoàn tất và khóa" in res_complete.json()["message"]
