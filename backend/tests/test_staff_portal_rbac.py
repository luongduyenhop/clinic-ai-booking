import pytest
from sqlalchemy import select

from app.models.user import VaiTroEnum
from app.services.bff_admin_service import bff_admin_service
from app.services.staff_portal_service import READ_COLLECTIONS, staff_portal_service


ADMIN_REQUESTS = [
    ("GET", "/api/v1/admin/bootstrap", None),
    ("PUT", "/api/v1/admin/collections/qaUnauthorized", {"items": []}),
    ("PUT", "/api/v1/admin/catalogs/qaUnauthorized", {"items": []}),
    ("POST", "/api/v1/admin/reset-demo", {}),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [None, "benh_nhan", "le_tan", "thu_ngan", "bac_si", "ky_thuat_vien"])
async def test_admin_bff_rejects_anonymous_and_all_non_admin_roles(api_client, booking, db_session, role):
    headers = {}
    if role:
        await booking.tao_tai_khoan("actor", role)
        headers = booking.tokens["actor"]
    for method, path, body in ADMIN_REQUESTS:
        response = await api_client.request(method, path, headers=headers, json=body)
        assert response.status_code == (403 if role else 401), response.text
    assert getattr(bff_admin_service, "_bff_collections", {}).get("qaUnauthorized") is None


@pytest.mark.asyncio
async def test_admin_can_still_read_and_write_bff(api_client, booking):
    response = await api_client.get("/api/v1/admin/bootstrap", headers=booking.tokens["admin"])
    assert response.status_code == 200
    assert "roles" in response.json()["data"]
    response = await api_client.put("/api/v1/admin/collections/qaAdminOnly", json={"items": [{"id": "QA"}]}, headers=booking.tokens["admin"])
    assert response.status_code == 200
    assert response.json()["data"]["qaAdminOnly"] == [{"id": "QA"}]


@pytest.mark.asyncio
async def test_fixed_demo_credentials_cannot_bypass_authentication(api_client):
    for path in ("/api/v1/auth/me", "/api/v1/admin/bootstrap"):
        response = await api_client.get(path, headers={"Authorization": "Bearer demo-clinic-ai-admin-token"})
        assert response.status_code == 401
    response = await api_client.post("/api/v1/auth/refresh", json={"refreshToken": "demo-clinic-ai-refresh-token"})
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("role", list(READ_COLLECTIONS))
async def test_staff_bootstrap_filters_admin_and_other_department_data(api_client, booking, role):
    await booking.tao_tai_khoan("staff", role)
    response = await api_client.get("/api/v1/staff/bootstrap", headers=booking.tokens["staff"])
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["schemaVersion"]
    for key in ("authSeed", "roles", "staffList", "auditLogs", "nationalEhrSync", "navigationConfig"):
        assert key not in data
    for key in set().union(*READ_COLLECTIONS.values()) - READ_COLLECTIONS[role]:
        assert key not in data
    assert "heThong" not in data["clinicSettings"]
    assert "congLienThong" not in data["clinicSettings"]


@pytest.mark.asyncio
async def test_patient_cannot_use_staff_bff(api_client, booking):
    for headers, status in [({}, 401), (booking.tokens["bn_a"], 403)]:
        response = await api_client.get("/api/v1/staff/bootstrap", headers=headers)
        assert response.status_code == status
        response = await api_client.put("/api/v1/staff/collections/vouchers", json={"items": []}, headers=headers)
        assert response.status_code == status


@pytest.mark.asyncio
@pytest.mark.parametrize("role,denied_key", [("thu_ngan", "patients"), ("le_tan", "roles"), ("bac_si", "vouchers"), ("ky_thuat_vien", "registrations")])
async def test_staff_cannot_write_outside_department(api_client, booking, role, denied_key):
    await booking.tao_tai_khoan("staff", role)
    response = await api_client.put(f"/api/v1/staff/collections/{denied_key}", json={"items": []}, headers=booking.tokens["staff"])
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_cashier_write_persists_with_real_actor_and_sanitized_response(api_client, booking, db_session):
    await booking.tao_tai_khoan("cashier", VaiTroEnum.THU_NGAN.value)
    response = await api_client.put("/api/v1/staff/collections/cashierClosings", headers=booking.tokens["cashier"], json={
        "items": [{"id": "QA-CLOSING", "maCa": "QA", "thuNgan": "QA", "tongThu": 0}],
        "auditEntry": {"nguoiDung": "Admin giả", "vaiTro": "ADMIN", "hanhDong": "QA_CLOSE_SHIFT"},
    })
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["cashierClosings"][0]["id"] == "QA-CLOSING"
    assert "roles" not in data and "authSeed" not in data
    persisted = await bff_admin_service.get_bootstrap_data(db_session)
    audit = persisted["auditLogs"][0]
    assert audit["vaiTro"] == "thu_ngan"
    assert audit["nguoiDung"].startswith("cashier.")


def test_new_seed_keys_are_denied_by_default():
    result = staff_portal_service.project({"schemaVersion": "test", "futureSecret": "secret", "clinicSettings": {"secret": "password"}, "catalogs": {"credentials": []}}, "thu_ngan")
    assert "futureSecret" not in result
    assert result["clinicSettings"] == {} and result["catalogs"] == {}
