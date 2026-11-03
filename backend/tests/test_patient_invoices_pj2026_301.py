import uuid
from datetime import datetime, timezone
import pytest
from app.models.appointment import LichKham, TrangThaiLichEnum
from app.models.medical import HoaDon, LuotKham

@pytest.mark.asyncio
async def test_patient_invoices_only_own_records(api_client, db_session, booking):
    suffix = uuid.uuid4().hex[:8]
    now_utc = datetime.now(timezone.utc)
    apt_own = LichKham(
        ma_lich_kham=f"APT-A-{suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=now_utc.date(),
        ca_kham="sang",
        trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value,
    )
    apt_other = LichKham(
        ma_lich_kham=f"APT-B-{suffix}",
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_y.id,
        ngay_kham=now_utc.date(),
        ca_kham="sang",
        trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value,
    )
    db_session.add_all([apt_own, apt_other])
    await db_session.flush()

    enc_own = LuotKham(
        lich_kham_id=apt_own.id,
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        thoi_gian_bat_dau=now_utc,
    )
    enc_other = LuotKham(
        lich_kham_id=apt_other.id,
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_y.id,
        thoi_gian_bat_dau=now_utc,
    )
    db_session.add_all([enc_own, enc_other])
    await db_session.flush()

    own = HoaDon(
        ma_hoa_don=f"QA-OWN-{suffix}",
        luot_kham_id=enc_own.id,
        benh_nhan_id=booking.bn_a.id,
        tong_tien=150000,
        so_tien_phai_thu=150000,
        trang_thai="chua_thu",
    )
    other = HoaDon(
        ma_hoa_don=f"QA-OTHER-{suffix}",
        luot_kham_id=enc_other.id,
        benh_nhan_id=booking.bn_b.id,
        tong_tien=220000,
        so_tien_phai_thu=220000,
        trang_thai="chua_thu",
    )
    db_session.add_all([own, other])
    await db_session.flush()
    response = await api_client.get("/api/v1/patient/invoices", headers=booking.tokens["bn_a"])
    assert response.status_code == 200, response.text
    invoices = response.json()["data"]
    assert any(row["ma_hoa_don"] == own.ma_hoa_don for row in invoices)
    assert all(row["ma_hoa_don"] != other.ma_hoa_don for row in invoices)

@pytest.mark.asyncio
async def test_patient_invoices_reject_unauthorized(api_client, booking):
    missing = await api_client.get("/api/v1/patient/invoices")
    assert missing.status_code == 401
    doctor = await api_client.get("/api/v1/patient/invoices", headers=booking.tokens["bs_x"])
    assert doctor.status_code == 403
