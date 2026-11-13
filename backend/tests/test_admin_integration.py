import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
from app.models.medical import DonThuoc

@pytest.mark.asyncio
async def test_admin_integration_queue_and_metrics(api_client: AsyncClient, booking):
    headers_admin = booking.tokens["admin"]
    res_queue = await api_client.get("/api/v1/admin/integration/prescriptions/queue", headers=headers_admin)
    assert res_queue.status_code == 200
    queue_data = res_queue.json()["data"]
    assert "total" in queue_data
    assert "items" in queue_data
    assert "pending_count" in queue_data
    assert "synced_count" in queue_data

    res_alias = await api_client.get("/api/v1/admin/integration/queue", headers=headers_admin)
    assert res_alias.status_code == 200

    res_metrics = await api_client.get("/api/v1/admin/integration/e-prescriptions/status", headers=headers_admin)
    assert res_metrics.status_code == 200
    metrics_data = res_metrics.json()["data"]
    assert "total_synced" in metrics_data
    assert "pending_retry" in metrics_data
    assert "failed_count" in metrics_data
    assert "last_sync_time" in metrics_data

@pytest.mark.asyncio
async def test_admin_integration_prescription_status_and_history(api_client: AsyncClient, booking, db_session):
    headers_admin = booking.tokens["admin"]
    headers_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kiem tra don thuoc integration"},
        headers=headers_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Panadol", "ham_luong": "500mg", "don_vi_tinh": "Vien", "so_luong": 10, "cach_dung": "Uong"}
            ]
        },
        headers=headers_bs,
    )
    rx_id = res_rx.json()["data"]["id"]

    res_status_draft = await api_client.get(
        f"/api/v1/admin/integration/prescriptions/{rx_id}/status",
        headers=headers_admin,
    )
    assert res_status_draft.status_code == 200
    status_data = res_status_draft.json()["data"]
    assert status_data["prescription_id"] == rx_id
    assert status_data["trang_thai"] == "DRAFT"
    assert status_data["is_immutable"] is False

    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=headers_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/sign", json={"chu_ky_so": "TOKEN_DOC_INT_01"}, headers=headers_bs)

    res_status_signed = await api_client.get(
        f"/api/v1/admin/integration/prescriptions/{rx_id}/status",
        headers=headers_admin,
    )
    assert res_status_signed.status_code == 200
    signed_data = res_status_signed.json()["data"]
    assert signed_data["trang_thai"] == "SIGNED"
    assert signed_data["is_immutable"] is True
    assert signed_data["du_lieu_don_thuoc_hash"] is not None
    assert len(signed_data["history"]) >= 1

    res_sync = await api_client.post(
        f"/api/v1/admin/integration/prescriptions/{rx_id}/sync",
        headers=headers_admin,
    )
    assert res_sync.status_code in (200, 409)

@pytest.mark.asyncio
async def test_admin_integration_rbac_forbidden(api_client: AsyncClient, booking):
    res_bs = await api_client.get("/api/v1/admin/integration/prescriptions/queue", headers=booking.tokens["bs_x"])
    assert res_bs.status_code == 403

    res_bn = await api_client.get("/api/v1/admin/integration/prescriptions/queue", headers=booking.tokens["bn_a"])
    assert res_bn.status_code == 403
