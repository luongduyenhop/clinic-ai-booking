import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_dashboard_stats_empty_state_and_zeros(api_client: AsyncClient, booking):
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/bi/dashboard-stats?query_date=2099-01-01", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["tong_lich_hen_hom_nay"] == 0
    assert data["so_ca_cho_kham"] == 0
    assert data["so_ca_dang_kham"] == 0
    assert data["so_ca_hoan_tat_kham"] == 0
    assert data["doanh_thu_kham_lam_sang"] == 0.0
    assert data["doanh_thu_can_lam_sang"] == 0.0
    assert data["tong_doanh_thu_trong_ngay"] == 0.0
    assert data["cong_suat_buong_kham_pct"] == 0.0

@pytest.mark.asyncio
async def test_get_dashboard_stats_rbac_forbidden(api_client: AsyncClient, booking):
    res_doctor = await api_client.get("/api/v1/admin/bi/dashboard-stats", headers=booking.tokens["bs_x"])
    assert res_doctor.status_code == 403
    res_patient = await api_client.get("/api/v1/admin/bi/dashboard-stats", headers=booking.tokens["bn_a"])
    assert res_patient.status_code == 403

@pytest.mark.asyncio
async def test_export_excel_summary_admin(api_client: AsyncClient, booking):
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/bi/export-excel", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert "danh_sach_dich_vu" in data or "tong_so_dich_vu" in data
