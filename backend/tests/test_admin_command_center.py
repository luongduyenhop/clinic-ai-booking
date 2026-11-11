import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_dashboard_stats_multi_tier_structure(api_client: AsyncClient, booking):
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/dashboard-stats", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert "tong_lich_hen_hom_nay" in data
    assert "so_ca_cho_kham" in data
    assert "so_ca_dang_kham" in data
    assert "so_ca_hoan_tat_kham" in data
    assert "so_ca_tam_hoan" in data
    assert "so_ca_bo_kham" in data
    assert "thoi_gian_cho_trung_binh_phut" in data
    assert "cong_suat_buong_kham_pct" in data
    assert isinstance(data["cong_suat_buong_kham_pct"], float)

    assert "so_ca_canh_bao_cap_cuu" in data
    assert "so_bien_ban_dinh_chinh" in data
    assert "so_dinh_chinh_muc_cao" in data
    assert "so_benh_an_da_khoa" in data
    assert data["so_bien_ban_dinh_chinh"] >= 0

    assert "doanh_thu_kham_lam_sang" in data
    assert "doanh_thu_can_lam_sang" in data
    assert "tong_doanh_thu_trong_ngay" in data
    assert "ty_le_that_thoat_noshow_pct" in data
    assert data["tong_doanh_thu_trong_ngay"] >= data["doanh_thu_kham_lam_sang"]


@pytest.mark.asyncio
async def test_admin_bff_staff_list_is_projected_from_relational_records(api_client: AsyncClient, booking):
    headers = booking.tokens["admin"]
    res_boot = await api_client.get("/api/v1/admin/bootstrap", headers=headers)
    assert res_boot.status_code == 200
    boot_data = res_boot.json()["data"]
    assert isinstance(boot_data.get("staffList"), list)
    assert isinstance(boot_data.get("vouchers"), list)
    assert isinstance(boot_data.get("registrations"), list)
    assert isinstance(boot_data.get("catalogs", {}).get("khoaPhong"), list)
    assert isinstance(boot_data.get("catalogs", {}).get("dichVu"), list)

    # Staff data is managed through the relational staff/doctor APIs. The
    # legacy BFF collection endpoint must not create doctors from mock rows.
    res_put = await api_client.put(
        "/api/v1/admin/collections/staffList",
        json={"collectionKey": "staffList", "items": boot_data["staffList"]},
        headers=headers,
    )
    assert res_put.status_code == 400

    after_boot = await api_client.get("/api/v1/admin/bootstrap", headers=headers)
    assert after_boot.status_code == 200
    assert after_boot.json()["data"]["staffList"] == boot_data["staffList"]


@pytest.mark.asyncio
async def test_dashboard_stats_requires_admin_role(api_client: AsyncClient, booking):
    res_doctor = await api_client.get("/api/v1/admin/dashboard-stats", headers=booking.tokens["bs_x"])
    assert res_doctor.status_code == 403

    res_patient = await api_client.get("/api/v1/admin/dashboard-stats", headers=booking.tokens["bn_a"])
    assert res_patient.status_code == 403
