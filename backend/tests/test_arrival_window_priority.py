import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from app.models.appointment import LichKham, TrangThaiLichEnum


@pytest.mark.asyncio
async def test_arrival_window_early_on_time_and_late(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    fake_now = datetime(2026, 10, 28, 10, 0, 0)
    fake_today = fake_now.date()

    class FakeDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            if tz is not None:
                return fake_now.replace(tzinfo=tz)
            return fake_now

    gio_som = (fake_now + timedelta(minutes=45)).time()
    lich_som = LichKham(
        ma_lich_kham=f"LK-EARLY-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=fake_today,
        gio_kham=gio_som,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    gio_dung = (fake_now + timedelta(minutes=10)).time()
    lich_dung = LichKham(
        ma_lich_kham=f"LK-ONTIME-{booking.suffix}",
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=fake_today,
        gio_kham=gio_dung,
        so_thu_tu=2,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    gio_muon = (fake_now - timedelta(minutes=25)).time()
    lich_muon = LichKham(
        ma_lich_kham=f"LK-LATE-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=fake_today,
        gio_kham=gio_muon,
        so_thu_tu=3,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    db_session.add_all([lich_som, lich_dung, lich_muon])
    await db_session.commit()

    with patch("app.services.queue_service.datetime", FakeDateTime), patch("app.services.queue_service.date") as mock_date:
        mock_date.today.return_value = fake_today

        res_som = await api_client.post(
            "/api/v1/reception/check-in", json={"lich_kham_id": lich_som.id}, headers=token_admin
        )
        assert res_som.status_code == 201
        ticket_som = res_som.json()["data"]
        assert ticket_som["loai_hang_doi"] == "den_som"
        assert ticket_som["muc_do_uu_tien"] == 4

        res_dung = await api_client.post(
            "/api/v1/reception/check-in", json={"lich_kham_id": lich_dung.id}, headers=token_admin
        )
        assert res_dung.status_code == 201
        ticket_dung = res_dung.json()["data"]
        assert ticket_dung["loai_hang_doi"] == "dung_hen"
        assert ticket_dung["muc_do_uu_tien"] == 2

        res_muon = await api_client.post(
            "/api/v1/reception/check-in", json={"lich_kham_id": lich_muon.id}, headers=token_admin
        )
        assert res_muon.status_code == 201
        ticket_muon = res_muon.json()["data"]
        assert ticket_muon["loai_hang_doi"] == "den_muon"
        assert ticket_muon["muc_do_uu_tien"] == 5
