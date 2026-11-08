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
async def test_admin_bff_two_way_relational_sync(api_client: AsyncClient, booking):
    headers = booking.tokens["admin"]
    res_boot = await api_client.get("/api/v1/admin/bootstrap", headers=headers)
    assert res_boot.status_code == 200
    boot_data = res_boot.json()["data"]
    assert isinstance(boot_data.get("staffList"), list)
    assert isinstance(boot_data.get("vouchers"), list)
    assert isinstance(boot_data.get("registrations"), list)
    assert isinstance(boot_data.get("catalogs", {}).get("khoaPhong"), list)
    assert isinstance(boot_data.get("catalogs", {}).get("dichVu"), list)

    new_cchn = f"CCHN-SYNC-{booking.suffix}"
    updated_staff = list(boot_data["staffList"]) + [
        {
            "id": f"NV-{booking.suffix}",
            "maNV": f"NV{booking.suffix[:4]}",
            "hoTen": f"BS.CKI Sync Test {booking.suffix}",
            "soCCHN": new_cchn,
            "ngayCapCCHN": "2022-01-15",
            "ngayHetHanCCHN": "2029-01-15",
            "trangThaiCCHN": "ACTIVE",
            "trangThai": True,
        }
    ]
    res_put = await api_client.put(
        "/api/v1/admin/collections/staffList",
        json={"collectionKey": "staffList", "items": updated_staff},
        headers=headers,
    )
    assert res_put.status_code == 200
    after_staff = res_put.json()["data"]["staffList"]
    assert any(s.get("soCCHN") == new_cchn for s in after_staff)


@pytest.mark.asyncio
async def test_dashboard_stats_requires_admin_role(api_client: AsyncClient, booking):
    res_doctor = await api_client.get("/api/v1/admin/dashboard-stats", headers=booking.tokens["bs_x"])
    assert res_doctor.status_code == 403

    res_patient = await api_client.get("/api/v1/admin/dashboard-stats", headers=booking.tokens["bn_a"])
    assert res_patient.status_code == 403
