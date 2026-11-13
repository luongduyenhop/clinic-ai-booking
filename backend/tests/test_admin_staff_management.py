import pytest
from sqlalchemy import select

from app.models.user import BacSi, NhanVien, Quyen, TaiKhoan, VaiTro, VaiTroQuyen


@pytest.mark.asyncio
async def test_admin_can_create_and_update_non_doctor_staff(api_client, booking, db_session):
    headers = booking.tokens["admin"]
    phone_suffix = f"{int(booking.suffix, 16) % 10000000:07d}"
    payload = {
        "ma_nhan_vien": f"NV-REC-{booking.suffix[:6]}",
        "ho_ten": "Nguyễn Lễ Tân",
        "email": f"reception.{booking.suffix}@example.com",
        "so_dien_thoai": f"091{phone_suffix}",
        "chuc_danh": "Lễ tân tiếp đón",
        "loai_nhan_vien": "LE_TAN",
    }

    created = await api_client.post("/api/v1/admin/staff", json=payload, headers=headers)
    assert created.status_code == 201
    staff = created.json()["data"]
    assert staff["ma_nhan_vien"] == payload["ma_nhan_vien"]
    assert staff["loai_nhan_vien"] == "LE_TAN"
    assert staff["is_active"] is True

    stored_staff = await db_session.get(NhanVien, staff["id"])
    assert stored_staff is not None
    assert await db_session.scalar(select(BacSi.id).where(BacSi.nguoi_dung_id == stored_staff.nguoi_dung_id)) is None

    updated = await api_client.patch(
        f"/api/v1/admin/staff/{staff['id']}",
        json={"chuc_danh": "Lễ tân trưởng", "is_active": False},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["chuc_danh"] == "Lễ tân trưởng"
    assert updated.json()["data"]["is_active"] is False

    listed = await api_client.get("/api/v1/admin/staff", headers=headers)
    assert listed.status_code == 200
    assert any(row["id"] == staff["id"] for row in listed.json()["data"])


@pytest.mark.asyncio
async def test_non_admin_cannot_access_staff_management(api_client, booking):
    response = await api_client.get("/api/v1/admin/staff", headers=booking.tokens["bs_x"])
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_rbac_permission_is_persisted_and_controls_staff_api(api_client, booking, db_session):
    headers = booking.tokens["bs_x"]
    denied = await api_client.get("/api/v1/admin/staff", headers=headers)
    assert denied.status_code == 403

    # Initialize the relational role and permission catalog using the admin API.
    catalog = await api_client.get("/api/v1/admin/rbac/roles", headers=booking.tokens["admin"])
    assert catalog.status_code == 200
    role = (await db_session.execute(select(VaiTro).where(VaiTro.ma_vai_tro == "bac_si"))).scalar_one()
    permission = (await db_session.execute(select(Quyen).where(Quyen.ma_quyen == "ROLE_RBAC.view"))).scalar_one()
    db_session.add(VaiTroQuyen(vai_tro_id=role.id, quyen_id=permission.id))
    await db_session.commit()

    allowed = await api_client.get("/api/v1/admin/staff", headers=headers)
    assert allowed.status_code == 200


@pytest.mark.asyncio
async def test_staff_account_provisioning_and_deactivation_revoke_session(api_client, booking, db_session):
    headers = booking.tokens["admin"]
    phone_suffix = f"{int(booking.suffix, 16) % 10000000:07d}"
    created = await api_client.post("/api/v1/admin/staff", headers=headers, json={
        "ma_nhan_vien": f"NV-ACC-{booking.suffix[:6]}",
        "ho_ten": "Nhân viên kiểm thử tài khoản",
        "email": f"staff.account.{booking.suffix}@example.com",
        "so_dien_thoai": f"098{phone_suffix}",
        "chuc_danh": "Lễ tân",
        "loai_nhan_vien": "LE_TAN",
    })
    assert created.status_code == 201
    employee_id = created.json()["data"]["id"]
    account_response = await api_client.post(
        f"/api/v1/admin/staff/{employee_id}/account",
        headers=headers,
        json={"password": "InitialPassword123!"},
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["data"]["account_id"]
    account = await db_session.get(TaiKhoan, account_id)
    account.refresh_token_hash = "test-refresh-token-hash"
    await db_session.commit()

    disabled = await api_client.patch(
        f"/api/v1/admin/accounts/{account_id}/status",
        headers=headers,
        json={"is_active": False},
    )
    assert disabled.status_code == 200
    await db_session.refresh(account)
    assert account.is_active is False
    assert account.refresh_token_hash is None
