import uuid
from datetime import date, datetime, time, timezone

import pytest

from app.core.exceptions import ConflictException
from app.models.appointment import (
    DanhSachCho,
    HangDoiKham,
    LichKham,
    LichLamViec,
    LoaiHangDoiEnum,
    NghiPhepBacSi,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
    TrangThaiNghiPhepEnum,
    TrangThaiWaitlistEnum,
)
from app.models.user import BacSi, BenhNhan, NguoiDung, PhongKham, TaiKhoan, VaiTroEnum
from app.schemas.queue import (
    CheckInRequest,
    TransferTicketRequest,
    WalkInCheckInRequest,
)
from app.services.appointment.appointment_service import clinic_now
from app.services.reception.queue_service import queue_service


async def _seed_schedule_actors(db_session):
    suffix = uuid.uuid4().hex[:6]
    today = clinic_now().date()

    room1 = PhongKham(ma_phong=f"PG1-{suffix}", ten_phong=f"Phòng 1 {suffix}", is_active=True)
    room2 = PhongKham(ma_phong=f"PG2-{suffix}", ten_phong=f"Phòng 2 {suffix}", is_active=True)
    db_session.add_all([room1, room2])
    await db_session.flush()

    nd_bs1 = NguoiDung(ho_ten="BS Sáng", email=f"bss.{suffix}@clinic.com", so_dien_thoai=f"0951{suffix}")
    nd_bs2 = NguoiDung(ho_ten="BS Chiều", email=f"bsc.{suffix}@clinic.com", so_dien_thoai=f"0952{suffix}")
    nd_bn = NguoiDung(ho_ten="BN Guard", email=f"bng.{suffix}@clinic.com", so_dien_thoai=f"0953{suffix}")
    nd_lt = NguoiDung(ho_ten="LT Guard", email=f"ltg.{suffix}@clinic.com", so_dien_thoai=f"0954{suffix}")
    db_session.add_all([nd_bs1, nd_bs2, nd_bn, nd_lt])
    await db_session.flush()

    bs1 = BacSi(
        nguoi_dung_id=nd_bs1.id,
        hoc_vi="BS",
        chung_chi_hanh_nghe=f"CCHNG1-{suffix}",
        phong_kham_id=room1.id,
        is_active=True,
    )
    bs2 = BacSi(
        nguoi_dung_id=nd_bs2.id,
        hoc_vi="BS",
        chung_chi_hanh_nghe=f"CCHNG2-{suffix}",
        phong_kham_id=room1.id,
        is_active=True,
    )
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BNG-{suffix}")
    db_session.add_all([bs1, bs2, bn])
    await db_session.flush()

    tk_lt = TaiKhoan(
        nguoi_dung_id=nd_lt.id,
        email=f"tkltg.{suffix}@clinic.com",
        mat_khau_hash="x",
        vai_tro=VaiTroEnum.LE_TAN.value,
    )
    tk_admin = TaiKhoan(
        nguoi_dung_id=nd_bs1.id,
        email=f"tkadg.{suffix}@clinic.com",
        mat_khau_hash="x",
        vai_tro=VaiTroEnum.ADMIN.value,
    )
    db_session.add_all([tk_lt, tk_admin])
    await db_session.flush()

    return today, room1, room2, bs1, bs2, bn, tk_lt, tk_admin, suffix


@pytest.mark.asyncio
async def test_walk_in_quick_endpoint_removed(api_client, booking):
    res = await api_client.post(
        "/api/v1/reception/walk-in-quick",
        json={"ho_ten": "Nguyen Van A", "so_dien_thoai": "0901234567", "bac_si_id": booking.bs_x.id},
        headers=booking.tokens["admin"],
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_checkin_walkin_waitlist_block_doctor_on_leave_or_off_shift(db_session):
    today, room1, _, bs1, bs2, bn, tk_lt, _, suffix = await _seed_schedule_actors(db_session)

    # bs1 chỉ trực ca sáng; bs2 chỉ trực ca chiều nhưng có đơn nghỉ phép đã duyệt
    shift_bs1 = LichLamViec(
        bac_si_id=bs1.id,
        phong_kham_id=room1.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        is_active=True,
    )
    shift_bs2 = LichLamViec(
        bac_si_id=bs2.id,
        phong_kham_id=room1.id,
        ngay_lam_viec=today,
        ca_lam_viec="chieu",
        gio_bat_dau=time(13, 30),
        gio_ket_thuc=time(17, 0),
        is_active=True,
    )
    leave_bs2 = NghiPhepBacSi(
        bac_si_id=bs2.id,
        tu_ngay=today,
        den_ngay=today,
        ca_lam_viec="chieu",
        ly_do="Nghỉ đột xuất",
        trang_thai=TrangThaiNghiPhepEnum.DA_DUYET.value,
    )
    lich_bs1_chieu = LichKham(
        ma_lich_kham=f"LK-OFF-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        ngay_kham=today,
        gio_kham=time(14, 0),
        ca_kham="chieu",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    wl_bs2 = DanhSachCho(
        benh_nhan_id=bn.id,
        bac_si_id=bs2.id,
        phong_kham_id=room1.id,
        ngay_mong_muon=today,
        ca_mong_muon="chieu",
        thu_tu_uu_tien=1,
        trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value,
    )
    db_session.add_all([shift_bs1, shift_bs2, leave_bs2, lich_bs1_chieu, wl_bs2])
    await db_session.commit()

    # 1. check_in_patient: bs1 không trực ca chiều -> chặn
    with pytest.raises(ConflictException):
        await queue_service.check_in_patient(CheckInRequest(lich_kham_id=lich_bs1_chieu.id), tk_lt, db_session)

    # 2. check_in_walk_in: bs2 đang nghỉ phép ca chiều -> chặn
    with pytest.raises(ConflictException):
        await queue_service.check_in_walk_in(
            WalkInCheckInRequest(benh_nhan_id=bn.id, bac_si_id=bs2.id, ca_kham="chieu"),
            tk_lt,
            db_session,
        )

    # 3. check_in_from_waitlist: bs2 đang nghỉ phép ca chiều -> chặn
    with pytest.raises(ConflictException):
        await queue_service.check_in_from_waitlist(wl_bs2.id, tk_lt, db_session)


@pytest.mark.asyncio
async def test_transfer_ticket_validates_doctor_shift_and_leave(db_session):
    today, room1, room2, bs1, bs2, bn, tk_lt, _, _ = await _seed_schedule_actors(db_session)

    shift_bs1 = LichLamViec(
        bac_si_id=bs1.id,
        phong_kham_id=room1.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        is_active=True,
    )
    ticket = HangDoiKham(
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        phong_kham_id=room1.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc),
    )
    db_session.add_all([shift_bs1, ticket])
    await db_session.commit()

    # room2 không có bác sĩ trực ca sáng -> chặn
    with pytest.raises(ConflictException):
        await queue_service.transfer_ticket(
            ticket.id,
            TransferTicketRequest(phong_kham_id=room2.id, ly_do="Đổi phòng"),
            tk_lt,
            db_session,
        )

    # Chỉ định bs2 không có ca trực sáng -> chặn
    with pytest.raises(ConflictException):
        await queue_service.transfer_ticket(
            ticket.id,
            TransferTicketRequest(phong_kham_id=room2.id, bac_si_id=bs2.id, ly_do="Đổi bác sĩ"),
            tk_lt,
            db_session,
        )
