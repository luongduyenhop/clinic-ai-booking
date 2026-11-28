import uuid
from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.core.exceptions import ConflictException, ForbiddenException
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, BenhNhan, NguoiDung, PhongKham, TaiKhoan, VaiTroEnum
from app.schemas.queue import TransferTicketRequest
from app.services.reception.queue_checkin_service import _derive_specialty_prefix
from app.services.reception.queue_service import queue_service
from app.services.reception.timezone_utils import (
    clinic_day_start_utc,
    clinic_shift_start_utc,
    to_clinic_naive,
)


async def _seed_queue_actors(db_session):
    suffix = uuid.uuid4().hex[:6]
    nd_bs1 = NguoiDung(ho_ten="BS 1", email=f"bs1.{suffix}@clinic.com", so_dien_thoai=f"0911{suffix}")
    nd_bs2 = NguoiDung(ho_ten="BS 2", email=f"bs2.{suffix}@clinic.com", so_dien_thoai=f"0912{suffix}")
    nd_bn = NguoiDung(ho_ten="BN 1", email=f"bn.{suffix}@clinic.com", so_dien_thoai=f"0913{suffix}")
    nd_lt = NguoiDung(ho_ten="LT 1", email=f"lt.{suffix}@clinic.com", so_dien_thoai=f"0914{suffix}")
    nd_admin = NguoiDung(ho_ten="Admin 1", email=f"ad.{suffix}@clinic.com", so_dien_thoai=f"0915{suffix}")
    db_session.add_all([nd_bs1, nd_bs2, nd_bn, nd_lt, nd_admin])
    await db_session.flush()

    bs1 = BacSi(nguoi_dung_id=nd_bs1.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN1-{suffix}")
    bs2 = BacSi(nguoi_dung_id=nd_bs2.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN2-{suffix}")
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-{suffix}")
    db_session.add_all([bs1, bs2, bn])
    await db_session.flush()

    tk_bs1 = TaiKhoan(
        nguoi_dung_id=nd_bs1.id, email=f"tkbs1.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.BAC_SI.value
    )
    tk_bs2 = TaiKhoan(
        nguoi_dung_id=nd_bs2.id, email=f"tkbs2.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.BAC_SI.value
    )
    tk_lt = TaiKhoan(
        nguoi_dung_id=nd_lt.id, email=f"tklt.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value
    )
    tk_bn = TaiKhoan(
        nguoi_dung_id=nd_bn.id, email=f"tkbn.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.BENH_NHAN.value
    )
    tk_admin = TaiKhoan(
        nguoi_dung_id=nd_admin.id, email=f"tkad.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.ADMIN.value
    )
    db_session.add_all([tk_bs1, tk_bs2, tk_lt, tk_bn, tk_admin])
    await db_session.flush()

    return bs1, bs2, bn, tk_bs1, tk_bs2, tk_lt, tk_bn, tk_admin, suffix


@pytest.mark.asyncio
async def test_postpone_ticket_authorization_and_state_machine(db_session):
    bs1, bs2, bn, tk_bs1, tk_bs2, tk_lt, tk_bn, _, suffix = await _seed_queue_actors(db_session)
    today = date.today()
    now_utc = datetime.now(timezone.utc)

    lich = LichKham(
        ma_lich_kham=f"LK-FSM-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        ngay_kham=today,
        gio_kham=time(9, 0),
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DANG_KHAM.value,
    )
    db_session.add(lich)
    await db_session.flush()

    ticket = HangDoiKham(
        lich_kham_id=lich.id,
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.DANG_KHAM.value,
        thoi_gian_check_in=now_utc,
    )
    db_session.add(ticket)
    await db_session.commit()

    with pytest.raises(ForbiddenException):
        await queue_service.postpone_ticket(ticket.id, tk_bn, db_session)

    with pytest.raises(ForbiddenException):
        await queue_service.postpone_ticket(ticket.id, tk_bs2, db_session)

    res = await queue_service.postpone_ticket(ticket.id, tk_bs1, db_session, reason="Gọi 3 lần vắng")
    assert res.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value
    await db_session.refresh(lich)
    assert lich.trang_thai == TrangThaiLichEnum.DA_TIEP_NHAN.value

    with pytest.raises(ConflictException):
        await queue_service.postpone_ticket(ticket.id, tk_lt, db_session)


@pytest.mark.asyncio
async def test_restore_ticket_rejects_non_postponed_status(db_session):
    bs1, _, bn, _, _, tk_lt, _, _, _ = await _seed_queue_actors(db_session)
    ticket = HangDoiKham(
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        ngay_kham=date.today(),
        ca_kham="sang",
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.DA_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    await db_session.commit()

    with pytest.raises(ConflictException):
        await queue_service.restore_ticket(ticket.id, tk_lt, db_session)


@pytest.mark.asyncio
async def test_call_next_patient_rejects_admin_without_doctor_profile(db_session):
    _, _, _, _, _, _, _, tk_admin, _ = await _seed_queue_actors(db_session)
    await db_session.commit()

    with pytest.raises(ForbiddenException):
        await queue_service.call_next_patient(tk_admin, db_session)


@pytest.mark.asyncio
async def test_transfer_ticket_matches_shift_and_normalizes_utc_timestamp(db_session):
    bs1, bs2, bn, _, _, tk_lt, _, _, suffix = await _seed_queue_actors(db_session)
    today = date.today()

    room = PhongKham(ma_phong=f"P-{suffix}", ten_phong=f"Phòng {suffix}", is_active=True)
    db_session.add(room)
    await db_session.flush()

    shift_sang = LichLamViec(
        bac_si_id=bs1.id,
        phong_kham_id=room.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        is_active=True,
    )
    shift_chieu = LichLamViec(
        bac_si_id=bs2.id,
        phong_kham_id=room.id,
        ngay_lam_viec=today,
        ca_lam_viec="chieu",
        gio_bat_dau=time(13, 30),
        gio_ket_thuc=time(17, 0),
        is_active=True,
    )
    db_session.add_all([shift_sang, shift_chieu])

    ticket = HangDoiKham(
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        ngay_kham=today,
        ca_kham="chieu",
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.DANG_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc) - timedelta(minutes=10),
    )
    db_session.add(ticket)
    await db_session.commit()

    before_utc = datetime.now(timezone.utc)
    res = await queue_service.transfer_ticket(
        ticket.id,
        TransferTicketRequest(phong_kham_id=room.id, ly_do="Chuyển ca chiều"),
        tk_lt,
        db_session,
    )
    after_utc = datetime.now(timezone.utc)

    assert res.bac_si_id == bs2.id
    assert res.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value
    requeue_dt = res.thoi_gian_xep_hang_lai
    if requeue_dt.tzinfo is None:
        requeue_dt = requeue_dt.replace(tzinfo=timezone.utc)
    assert before_utc - timedelta(seconds=5) <= requeue_dt <= after_utc + timedelta(seconds=5)


def test_timezone_utils_conversions():
    d = date(2026, 11, 27)
    shift_start = clinic_shift_start_utc(d)
    assert shift_start == datetime(2026, 11, 27, 0, 30, tzinfo=timezone.utc)

    day_start = clinic_day_start_utc(d)
    assert day_start == datetime(2026, 11, 26, 17, 0, tzinfo=timezone.utc)

    local_naive = to_clinic_naive(datetime(2026, 11, 27, 0, 30))
    assert local_naive == datetime(2026, 11, 27, 7, 30)


def test_derive_specialty_prefix_dynamic():
    assert _derive_specialty_prefix("KHOA_NOI", "Khoa Nội") == "NOI"
    assert _derive_specialty_prefix("KHOA_NGOAI", "Khoa Ngoại") == "NGOAI"
    assert _derive_specialty_prefix("KHOA_TMH", "Tai - Mũi - Họng") == "TMH"
    assert _derive_specialty_prefix("KHOA_RHM", "Răng - Hàm - Mặt") == "RHM"
    assert _derive_specialty_prefix("KHOA_MAT", "Khoa Mắt") == "MAT"
    assert _derive_specialty_prefix(None, "Khoa Nội") == "NOI"
    assert _derive_specialty_prefix(None, "Tai - Mũi - Họng") == "TMH"
    assert _derive_specialty_prefix(None, None) == "PK"
