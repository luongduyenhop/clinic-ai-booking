from datetime import datetime, timezone
import pytest
from httpx import AsyncClient
from app.models.compliance import NhatKyTruyCapDuLieuYTe

@pytest.mark.asyncio
async def test_get_audit_logs_rbac_forbidden_for_non_admin(api_client: AsyncClient, booking):
    res_bs = await api_client.get("/api/v1/admin/audit/logs", headers=booking.tokens["bs_x"])
    assert res_bs.status_code == 403

    res_bn = await api_client.get("/api/v1/admin/audit/logs", headers=booking.tokens["bn_a"])
    assert res_bn.status_code == 403

@pytest.mark.asyncio
async def test_get_audit_logs_success_admin_paginated(api_client: AsyncClient, booking, db_session):
    log_entry = NhatKyTruyCapDuLieuYTe(
        user_id=1,
        user_role="admin",
        loai_nhat_ky="Y_TE",
        patient_id=999,
        action="VIEW",
        resource_type="ENCOUNTER",
        resource_id=101,
        purpose="KIEM_TRA_BAO_CAO_ADMIN",
        client_ip="127.0.0.1",
        timestamp=datetime.now(timezone.utc),
    )
    db_session.add(log_entry)
    await db_session.commit()

    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/audit/logs?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "data" in body
    data = body["data"]
    assert "items" in data
    assert isinstance(data["items"], list)
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert data["total"] >= 1
    assert "meta" in body
    assert body["meta"]["page"] == 1

@pytest.mark.asyncio
async def test_get_audit_logs_filters_action_and_actor(api_client: AsyncClient, booking, db_session):
    headers = booking.tokens["admin"]

    log_custom = NhatKyTruyCapDuLieuYTe(
        user_id=1,
        user_role="admin",
        loai_nhat_ky="Y_TE",
        patient_id=888,
        action="EXPORT_DOSSIER_AUDIT_TEST",
        resource_type="PATIENT_HISTORY",
        resource_id=202,
        purpose="THANH_TRA_BENH_AN_TEST",
        client_ip="10.0.0.1",
        timestamp=datetime.now(timezone.utc),
    )
    db_session.add(log_custom)
    await db_session.commit()

    res_action = await api_client.get(
        "/api/v1/admin/audit/logs?action=EXPORT_DOSSIER_AUDIT_TEST",
        headers=headers,
    )
    assert res_action.status_code == 200
    items = res_action.json()["data"]["items"]
    assert len(items) >= 1
    assert any(item["action"] == "EXPORT_DOSSIER_AUDIT_TEST" for item in items)

    res_actor = await api_client.get(
        "/api/v1/admin/audit/logs?actor=admin",
        headers=headers,
    )
    assert res_actor.status_code == 200
    items_actor = res_actor.json()["data"]["items"]
    assert len(items_actor) >= 1

@pytest.mark.asyncio
async def test_get_audit_logs_date_filters(api_client: AsyncClient, booking):
    headers = booking.tokens["admin"]
    res = await api_client.get(
        "/api/v1/admin/audit/logs?from_date=2020-01-01&to_date=2030-12-31",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert "items" in data
