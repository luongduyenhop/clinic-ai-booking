from datetime import datetime, timezone
import pytest

from tests.test_clinical_skeleton import _dam_bao_ma_icd10


async def _create_encounter_and_draft_rx(api_client, booking, db_session, drug_name: str):
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám nội tổng quát"},
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
            "so_ngay_dung": 7,
            "loi_dan_uong_thuoc": "Uống sau ăn sáng",
            "danh_sach_thuoc": [
                {
                    "ten_thuoc": drug_name,
                    "hoat_chat": "Amlodipine",
                    "ham_luong": "5mg",
                    "don_vi_tinh": "Viên",
                    "so_luong": 7,
                    "cach_dung": "Sáng 1 viên sau ăn",
                    "so_ngay_dung": 7,
                }
            ],
        },
        headers=token_bs,
    )
    assert res_rx.status_code == 201
    return enc_id, res_rx.json()["data"]["id"]


@pytest.mark.asyncio
async def test_p2_unsigned_prescription_cannot_sync_to_national_gateway(
    api_client, booking, db_session
):
    _, rx_id = await _create_encounter_and_draft_rx(api_client, booking, db_session, "Amlodipin 5mg")

    res_sync_draft = await api_client.post(
        f"/api/v1/compliance/prescriptions/{rx_id}/sync",
        headers=booking.tokens["bs_x"],
    )
    assert res_sync_draft.status_code == 409


@pytest.mark.asyncio
async def test_p2_doctor_sign_and_sync_generates_14_digit_code_and_idempotent_receipt(
    api_client, booking, db_session
):
    token_bs = booking.tokens["bs_x"]
    token_admin = booking.tokens["admin"]
    enc_id, rx_id = await _create_encounter_and_draft_rx(api_client, booking, db_session, "Losartan 50mg")

    res_val = await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    assert res_val.status_code == 200

    res_sign = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/sign",
        json={"chu_ky_so": f"SHA256:SIG:{enc_id}:P2"},
        headers=token_bs,
    )
    assert res_sign.status_code == 200
    assert res_sign.json()["data"]["trang_thai"] == "SIGNED"

    res_sync = await api_client.post(
        f"/api/v1/compliance/prescriptions/{rx_id}/sync",
        headers=token_bs,
    )
    assert res_sync.status_code == 200
    synced = res_sync.json()["data"]
    assert synced["trang_thai"] == "ACCEPTED"
    assert len(synced["ma_don_quoc_gia"]) == 14
    assert synced["ma_don_quoc_gia"].isdigit()
    assert synced["bien_nhan_giao_dich"].startswith(f"RECEIPT-BYT-{rx_id}-")

    res_sync_again = await api_client.post(
        f"/api/v1/compliance/prescriptions/{rx_id}/sync",
        headers=token_bs,
    )
    assert res_sync_again.status_code == 200
    assert res_sync_again.json()["data"]["ma_don_quoc_gia"] == synced["ma_don_quoc_gia"]
    assert res_sync_again.json()["data"]["bien_nhan_giao_dich"] == synced["bien_nhan_giao_dich"]

    res_comp = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Ổn định huyết áp"},
        headers=token_bs,
    )
    assert res_comp.status_code == 200

    res_list = await api_client.get(
        "/api/v1/compliance/prescriptions?status=ACCEPTED",
        headers=token_admin,
    )
    assert res_list.status_code == 200
    payload = res_list.json()["data"]
    assert payload["summary"]["accepted"] >= 1
    found = next(it for it in payload["items"] if it["id"] == rx_id)
    assert found["ma_don_quoc_gia"] == synced["ma_don_quoc_gia"]

    res_hssk = await api_client.get("/api/v1/compliance/hssk-records", headers=token_admin)
    assert res_hssk.status_code == 200
    hssk_ids = {row["id"] for row in res_hssk.json()["data"]}
    assert enc_id in hssk_ids

    res_ping = await api_client.get("/api/v1/compliance/gateway-ping", headers=token_admin)
    assert res_ping.status_code == 200
    ping_data = res_ping.json()["data"]
    assert ping_data["connected"] is True
    assert ping_data["code"] == 200
    assert ping_data["latency_ms"] >= 1


@pytest.mark.asyncio
async def test_p2_admin_batch_sync_all_signed_and_patient_rbac_blocked(
    api_client, booking, db_session
):
    token_bs = booking.tokens["bs_x"]
    token_admin = booking.tokens["admin"]
    token_bn = booking.tokens["bn_a"]

    _, rx_id = await _create_encounter_and_draft_rx(api_client, booking, db_session, "Atorvastatin 10mg")
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/sign",
        json={"chu_ky_so": "SHA256:SIG:BATCH"},
        headers=token_bs,
    )

    res_patient_list = await api_client.get("/api/v1/compliance/prescriptions", headers=token_bn)
    assert res_patient_list.status_code == 403

    res_doctor_batch = await api_client.post("/api/v1/compliance/prescriptions/sync-all", headers=token_bs)
    assert res_doctor_batch.status_code == 403

    res_admin_batch = await api_client.post("/api/v1/compliance/prescriptions/sync-all", headers=token_admin)
    assert res_admin_batch.status_code == 200
    batch_data = res_admin_batch.json()["data"]
    assert batch_data["synced_count"] >= 1
    synced_ids = {item["id"] for item in batch_data["synced_items"]}
    assert rx_id in synced_ids
