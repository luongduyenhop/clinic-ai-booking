from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import DonThuoc, LuotKham
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_p3_delta_workspace_sync_updates_only_target_encounter_across_concurrent_doctors(
    api_client, booking, db_session
):
    now = datetime.now(timezone.utc)
    lich_a = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    lich_b = await booking.tao_lich(booking.bn_b, booking.bs_y, now + timedelta(minutes=30))

    res_a = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich_a.id, "ly_do_vao_kham": "Đau tức ngực trái"},
        headers=booking.tokens["bs_x"],
    )
    assert res_a.status_code == 201
    enc_a_id = res_a.json()["data"]["id"]

    res_b = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich_b.id, "ly_do_vao_kham": "Viêm mũi dị ứng kéo dài"},
        headers=booking.tokens["bs_y"],
    )
    assert res_b.status_code == 201
    enc_b_id = res_b.json()["data"]["id"]

    lk_b_init = await db_session.get(LuotKham, enc_b_id)
    lk_b_init.benh_su = "Bệnh sử riêng của Bác sĩ Y đang khám"
    lk_b_init.mach_lan_phut = 72
    await db_session.flush()

    delta_payload = {
        "queue": [],
        "encounters": {
            str(enc_a_id): {
                "benh_su": "Bệnh nhân đau âm ỉ vùng trước tim 3 ngày",
                "mach_lan_phut": 86,
                "huyet_ap_tam_thu": 135,
                "huyet_ap_tam_truong": 85,
            }
        },
    }
    res_put = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=delta_payload,
        headers=booking.tokens["bs_x"],
    )
    assert res_put.status_code == 200
    assert res_put.json()["data"]["saved"] is True

    await db_session.refresh(lk_b_init)
    lk_a_after = await db_session.get(LuotKham, enc_a_id)

    assert lk_a_after.benh_su == "Bệnh nhân đau âm ỉ vùng trước tim 3 ngày"
    assert lk_a_after.mach_lan_phut == 86
    assert lk_a_after.huyet_ap_tam_thu == 135
    assert lk_a_after.huyet_ap_tam_truong == 85

    assert lk_b_init.benh_su == "Bệnh sử riêng của Bác sĩ Y đang khám"
    assert lk_b_init.mach_lan_phut == 72


@pytest.mark.asyncio
async def test_p3_delta_workspace_sync_preserves_signed_prescription_immutability(
    api_client, booking, db_session
):
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám tăng huyết áp định kỳ"},
        headers=token_bs,
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "I10", "Bệnh tăng huyết áp vô căn")
    res_dx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "I10", "ten_benh_chan_doan": "Bệnh tăng huyết áp vô căn", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )
    assert res_dx.status_code in (200, 201)

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "so_ngay_dung": 14,
            "loi_dan_uong_thuoc": "Uống buổi sáng sau ăn",
            "danh_sach_thuoc": [
                {
                    "ten_thuoc": "Perindopril 5mg",
                    "hoat_chat": "Perindopril",
                    "ham_luong": "5mg",
                    "don_vi_tinh": "Viên",
                    "so_luong": 14,
                    "cach_dung": "Sáng 1 viên",
                    "so_ngay_dung": 14,
                }
            ],
        },
        headers=token_bs,
    )
    assert res_rx.status_code == 201
    rx_id = res_rx.json()["data"]["id"]

    res_val = await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    assert res_val.status_code == 200

    res_sign = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/sign",
        json={"chu_ky_so": f"SHA256:SIG:{enc_id}:P3"},
        headers=token_bs,
    )
    assert res_sign.status_code == 200

    res_delta_note = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json={
            "queue": [],
            "encounters": {
                str(enc_id): {
                    "loi_dan_bac_si": "Hạn chế ăn mặn, đo huyết áp mỗi sáng",
                    "ket_luan_dieu_tri": "Ổn định huyết áp ngoại trú",
                    "danh_sach_thuoc": [{"ten_thuoc": "ThuocGiaMao 500mg", "so_luong": 99}],
                }
            },
        },
        headers=token_bs,
    )
    assert res_delta_note.status_code == 200

    lk_after = await db_session.get(LuotKham, enc_id)
    await db_session.refresh(lk_after)
    assert lk_after.loi_dan_bac_si == "Hạn chế ăn mặn, đo huyết áp mỗi sáng"
    assert lk_after.ket_luan_dieu_tri == "Ổn định huyết áp ngoại trú"

    rx_after = (
        await db_session.execute(
            select(DonThuoc).options(selectinload(DonThuoc.danh_sach_chi_tiet)).where(DonThuoc.id == rx_id)
        )
    ).scalar_one()
    assert rx_after.trang_thai == "SIGNED"
    assert len(rx_after.danh_sach_chi_tiet) == 1
    assert rx_after.danh_sach_chi_tiet[0].ten_thuoc == "Perindopril 5mg"
