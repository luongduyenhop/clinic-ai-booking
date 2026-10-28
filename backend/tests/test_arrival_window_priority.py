import pytest
from datetime import date, datetime, timedelta, timezone
from app.core.config import settings
from app.models.appointment import LichKham, TrangThaiLichEnum


def _get_clinic_now():
    clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
    return datetime.now(clinic_tz).replace(tzinfo=None)


@pytest.mark.asyncio
async def test_arrival_window_early_on_time_and_late(api_client, booking, db_session):
    """
    Gói 4: Kiểm thử phân loại khung giờ đến (Arrival Window Logic):
    - Đến sớm > 30p -> den_som, ưu tiên 4
    - Đến đúng hẹn (-15p đến +30p) -> dung_hen, ưu tiên 2
    - Đến muộn > 15p -> den_muon, ưu tiên 5
    """
    token_admin = booking.tokens["admin"]
    today = date.today()
    now_clinic = _get_clinic_now()

    # 1. Ca đến sớm: hẹn sau bây giờ 45 phút
    gio_som = (now_clinic + timedelta(minutes=45)).time()
    lich_som = LichKham(
        ma_lich_kham=f"LK-EARLY-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=gio_som,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    # 2. Ca đúng giờ: hẹn sau bây giờ 10 phút
    gio_dung = (now_clinic + timedelta(minutes=10)).time()
    lich_dung = LichKham(
        ma_lich_kham=f"LK-ONTIME-{booking.suffix}",
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=gio_dung,
        so_thu_tu=2,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    # 3. Ca đến muộn: hẹn trước bây giờ 25 phút
    gio_muon = (now_clinic - timedelta(minutes=25)).time()
    lich_muon = LichKham(
        ma_lich_kham=f"LK-LATE-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=gio_muon,
        so_thu_tu=3,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    db_session.add_all([lich_som, lich_dung, lich_muon])
    await db_session.commit()

    # Check-in ca đến sớm
    res_som = await api_client.post(
        "/api/v1/reception/check-in", json={"lich_kham_id": lich_som.id}, headers=token_admin
    )
    assert res_som.status_code == 201
    ticket_som = res_som.json()["data"]
    assert ticket_som["loai_hang_doi"] == "den_som"
    assert ticket_som["muc_do_uu_tien"] == 4

    # Check-in ca đúng giờ
    res_dung = await api_client.post(
        "/api/v1/reception/check-in", json={"lich_kham_id": lich_dung.id}, headers=token_admin
    )
    assert res_dung.status_code == 201
    ticket_dung = res_dung.json()["data"]
    assert ticket_dung["loai_hang_doi"] == "dung_hen"
    assert ticket_dung["muc_do_uu_tien"] == 2

    # Check-in ca đến muộn
    res_muon = await api_client.post(
        "/api/v1/reception/check-in", json={"lich_kham_id": lich_muon.id}, headers=token_admin
    )
    assert res_muon.status_code == 201
    ticket_muon = res_muon.json()["data"]
    assert ticket_muon["loai_hang_doi"] == "den_muon"
    assert ticket_muon["muc_do_uu_tien"] == 5
