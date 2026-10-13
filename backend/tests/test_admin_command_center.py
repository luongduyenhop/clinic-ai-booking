import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_dashboard_stats_multi_tier_structure(api_client: AsyncClient, booking):
    """
    Kiểm tra Dashboard KPIs đa tầng (Clinical Command Center):
    - Tầng 1: Vận hành (Hàng đợi, thời gian chờ, công suất buồng khám)
    - Tầng 2: An toàn lâm sàng (Bệnh án khóa, đính chính, cảnh báo cấp cứu)
    - Tầng 3: Đối soát tài chính (Doanh thu khám, tạm thu cận lâm sàng, tỷ lệ No-show)
    """
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/dashboard-stats", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    # 1. Tầng Vận hành
    assert "tong_lich_hen_hom_nay" in data
    assert "so_ca_cho_kham" in data
    assert "so_ca_dang_kham" in data
    assert "so_ca_hoan_tat_kham" in data
    assert "so_ca_tam_hoan" in data
    assert "so_ca_bo_kham" in data
    assert "thoi_gian_cho_trung_binh_phut" in data
    assert "cong_suat_buong_kham_pct" in data
    assert isinstance(data["cong_suat_buong_kham_pct"], float)

    # 2. Tầng An toàn lâm sàng
    assert "so_ca_canh_bao_cap_cuu" in data
    assert "so_bien_ban_dinh_chinh" in data
    assert "so_dinh_chinh_muc_cao" in data
    assert "so_benh_an_da_khoa" in data
    assert data["so_bien_ban_dinh_chinh"] >= 0

    # 3. Tầng Đối soát tài chính
    assert "doanh_thu_kham_lam_sang" in data
    assert "doanh_thu_can_lam_sang" in data
    assert "tong_doanh_thu_trong_ngay" in data
    assert "ty_le_that_thoat_noshow_pct" in data
    assert data["tong_doanh_thu_trong_ngay"] >= data["doanh_thu_kham_lam_sang"]
