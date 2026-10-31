import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LoaiHangDoiEnum,
    LyDoUuTienEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung
from app.schemas.queue import CheckInRequest, WalkInCheckInRequest
from app.services.queue_service import queue_service


def _get_clinic_now():
    clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
    return datetime.now(clinic_tz).replace(tzinfo=None)


@pytest.mark.asyncio
async def test_arrival_window_early_on_time_and_late(api_client, booking, db_session):
    """
    Gói 4: Kiểm thử phân loại khung giờ đến (Arrival Window Logic):
    - Đến sớm > 30p -> den_som, ưu tiên 4
    - Đến đúng hẹn (trước 30p đến trễ 30p) -> dung_hen, ưu tiên 2
    - Đến muộn > 30p -> den_muon, ưu tiên 5
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

    # 3. Ca đến muộn: hẹn trước bây giờ 45 phút (> 30 phút theo chuẩn mới)
    gio_muon = (now_clinic - timedelta(minutes=45)).time()
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


@pytest.mark.asyncio
async def test_checkin_appointment_status_transition_da_dat_to_da_den(api_client, booking, db_session):
    """
    Tiêu chí nghiệm thu 1:
    - Chuyển trạng thái lịch hẹn từ DA_DAT (DA_XAC_NHAN) sang DA_DEN (DA_TIEP_NHAN).
    - Sinh bản ghi trong hàng đợi với trạng thái CHO_KHAM.
    """
    token_admin = booking.tokens["admin"]
    today = date.today()
    now_clinic = _get_clinic_now()

    lich = LichKham(
        ma_lich_kham=f"LK-STATUS-{uuid.uuid4().hex[:6]}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=(now_clinic + timedelta(minutes=15)).time(),
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,  # Tương đương DA_DAT
    )
    db_session.add(lich)
    await db_session.commit()

    # Bệnh nhân có mặt tại quầy, lễ tân bấm Check-in
    res = await api_client.post(
        "/api/v1/reception/check-in",
        json={"lich_kham_id": lich.id, "ghi_chu": "Bệnh nhân có mặt"},
        headers=token_admin,
    )
    assert res.status_code == 201
    ticket = res.json()["data"]
    assert ticket["trang_thai"] == "cho_kham"

    # Kiểm tra trực tiếp trong DB: Trạng thái lịch hẹn phải là DA_TIEP_NHAN (DA_DEN)
    stmt = select(LichKham).where(LichKham.id == lich.id)
    lich_db = (await db_session.execute(stmt)).scalar_one()
    assert lich_db.trang_thai == TrangThaiLichEnum.DA_TIEP_NHAN.value


@pytest.mark.asyncio
async def test_checkin_online_preempts_waiting_walkin(api_client, booking, db_session):
    """
    Tiêu chí nghiệm thu 2:
    Ưu tiên người đặt trước đúng giờ so với người đang chờ (Preemption):
    - Khách vãng lai W check-in trước -> vào hàng đợi với mức ưu tiên 5 (VANG_LAI).
    - Bệnh nhân đặt trước O check-in sau -> vào hàng đợi với mức ưu tiên 2 (DUNG_HEN).
    - Khi Bác sĩ bấm gọi số (call_next_patient) -> Hệ thống tự động đẩy Bệnh nhân O
      lên trước để khám trước, dù khách vãng lai W đã ngồi chờ từ trước.
    """
    token_admin = booking.tokens["admin"]
    bs = booking.bs_x
    today = date.today()
    now_clinic = _get_clinic_now()

    # 1. Bệnh nhân vãng lai W đến trước và check-in trước
    req_wlk = WalkInCheckInRequest(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=bs.id,
        ca_kham="sang",
        ly_do_kham="Đau họng đến trực tiếp",
    )
    res_w = await api_client.post("/api/v1/reception/walk-in", json=req_wlk.model_dump(), headers=token_admin)
    assert res_w.status_code == 201
    ticket_w = res_w.json()["data"]
    assert ticket_w["muc_do_uu_tien"] == 5

    # 2. Bệnh nhân đặt trước O đến sau, check-in đúng khung giờ hẹn
    lich_o = LichKham(
        ma_lich_kham=f"LK-ONLINE-{uuid.uuid4().hex[:6]}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        gio_kham=(now_clinic + timedelta(minutes=10)).time(),
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add(lich_o)
    await db_session.commit()

    res_o = await api_client.post("/api/v1/reception/check-in", json={"lich_kham_id": lich_o.id}, headers=token_admin)
    assert res_o.status_code == 201
    ticket_o = res_o.json()["data"]
    assert ticket_o["muc_do_uu_tien"] == 2

    # 3. Bác sĩ trong phòng khám bấm gọi số tiếp theo
    res_call = await api_client.post("/api/v1/clinical/queue/call-next", headers=booking.tokens["bs_x"])
    assert res_call.status_code == 200
    called_ticket = res_call.json()["data"]["ticket"]
    assert called_ticket is not None

    # Khẳng định: Bệnh nhân đặt trước (ticket_o) được gọi vào phòng trước khách vãng lai!
    assert called_ticket["id"] == ticket_o["id"]
    assert called_ticket["benh_nhan_id"] == booking.bn_a.id


@pytest.mark.asyncio
async def test_checkin_special_priority_elevation(api_client, booking, db_session):
    """
    Kiểm tra lý do ưu tiên đặc biệt:
    Nếu truyền ly_do_uu_tien (người già >= 80, thai phụ, cấp cứu nhẹ),
    mức độ ưu tiên được nâng lên mức 1 (tối cao).
    """
    token_admin = booking.tokens["admin"]
    today = date.today()
    now_clinic = _get_clinic_now()

    lich = LichKham(
        ma_lich_kham=f"LK-PRIO-{uuid.uuid4().hex[:6]}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=(now_clinic + timedelta(minutes=15)).time(),
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add(lich)
    await db_session.commit()

    req = CheckInRequest(
        lich_kham_id=lich.id,
        ly_do_uu_tien=LyDoUuTienEnum.NGUOI_GIA,
        ghi_chu="Cụ già 82 tuổi đi cùng người nhà",
    )
    res = await api_client.post("/api/v1/reception/check-in", json=req.model_dump(), headers=token_admin)
    assert res.status_code == 201
    ticket = res.json()["data"]
    assert ticket["muc_do_uu_tien"] == 1
    assert "Ưu tiên" in ticket["ghi_chu_dieu_phoi"]
