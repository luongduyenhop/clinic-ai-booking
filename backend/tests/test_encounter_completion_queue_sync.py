import pytest
from datetime import date, datetime, timezone
from sqlalchemy import select
from app.models.appointment import HangDoiKham, CaLamViecEnum, TrangThaiHangDoiEnum
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


async def _tao_ca_kham_san_sang_hoan_tat(api_client, booking, db_session, trang_thai_ve):
    """Tạo encounter đã có 1 chẩn đoán chính hợp lệ + các vé hàng đợi theo danh sách trạng thái."""
    token_bs = booking.tokens["bs_x"]
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.now(timezone.utc))
    lich_id = lich.id

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters", json={"lich_kham_id": lich_id}, headers=token_bs
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "J00", "Viêm mũi họng cấp")
    res_dx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "J00", "ten_benh_chan_doan": "Viêm mũi họng", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )
    assert res_dx.status_code in (200, 201)

    ve_ids = []
    for i, tt in enumerate(trang_thai_ve, start=1):
        ve = HangDoiKham(
            lich_kham_id=lich_id,
            benh_nhan_id=booking.bn_a.id,
            bac_si_id=booking.bs_x.id,
            ngay_kham=date.today(),
            ca_kham=CaLamViecEnum.SANG.value,
            so_thu_tu_kham=i,
            trang_thai=tt,
            thoi_gian_check_in=datetime.now(timezone.utc),
        )
        db_session.add(ve)
        await db_session.flush()
        ve_ids.append(ve.id)
    await db_session.commit()
    return enc_id, lich_id, ve_ids, token_bs


async def _lay_ve(db_session, ve_id):
    db_session.expire_all()
    return (await db_session.execute(select(HangDoiKham).where(HangDoiKham.id == ve_id))).scalar_one()


@pytest.mark.asyncio
async def test_complete_moves_dang_kham_ticket_to_da_kham_with_end_time(api_client, booking, db_session):
    enc_id, lich_id, ve_ids, token = await _tao_ca_kham_san_sang_hoan_tat(
        api_client, booking, db_session, [TrangThaiHangDoiEnum.DANG_KHAM.value]
    )
    res = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete", json={"ket_luan_dieu_tri": "Nghỉ ngơi"}, headers=token
    )
    assert res.status_code == 200

    ve = await _lay_ve(db_session, ve_ids[0])
    assert ve.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value
    assert ve.thoi_gian_ket_thuc is not None

    con_dang_kham = (await db_session.execute(
        select(HangDoiKham).where(
            HangDoiKham.lich_kham_id == lich_id,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value,
        )
    )).scalars().all()
    assert con_dang_kham == []


@pytest.mark.asyncio
async def test_complete_without_ticket_still_succeeds(api_client, booking, db_session):
    enc_id, _, _, token = await _tao_ca_kham_san_sang_hoan_tat(api_client, booking, db_session, [])
    res = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete", json={"ket_luan_dieu_tri": "Xong"}, headers=token
    )
    assert res.status_code == 200
    assert res.json()["data"]["is_locked"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize("trang_thai", [
    TrangThaiHangDoiEnum.CHO_KHAM.value,
    TrangThaiHangDoiEnum.BO_KHAM.value,
    TrangThaiHangDoiEnum.TAM_HOAN.value,
])
async def test_complete_does_not_touch_non_serving_ticket(api_client, booking, db_session, trang_thai):
    enc_id, _, ve_ids, token = await _tao_ca_kham_san_sang_hoan_tat(
        api_client, booking, db_session, [trang_thai]
    )
    res = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete", json={"ket_luan_dieu_tri": "Xong"}, headers=token
    )
    assert res.status_code == 200

    ve = await _lay_ve(db_session, ve_ids[0])
    assert ve.trang_thai == trang_thai
    assert ve.thoi_gian_ket_thuc is None


@pytest.mark.asyncio
async def test_complete_rejects_duplicate_dang_kham_tickets_and_rolls_back(api_client, booking, db_session):
    enc_id, _, ve_ids, token = await _tao_ca_kham_san_sang_hoan_tat(
        api_client, booking, db_session,
        [TrangThaiHangDoiEnum.DANG_KHAM.value, TrangThaiHangDoiEnum.DANG_KHAM.value],
    )
    res = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete", json={"ket_luan_dieu_tri": "Xong"}, headers=token
    )
    assert res.status_code == 409

    # Rollback toàn bộ: encounter chưa khóa, cả hai vé vẫn DANG_KHAM
    from app.models.medical import LuotKham
    db_session.expire_all()
    enc = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    assert enc.is_locked is False
    for ve_id in ve_ids:
        assert (await _lay_ve(db_session, ve_id)).trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value
