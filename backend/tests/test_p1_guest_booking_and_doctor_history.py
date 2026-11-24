from datetime import date, datetime, time, timedelta, timezone
import pytest
from sqlalchemy import select

from app.models.appointment import CaLamViecEnum, LichLamViec
from app.models.medical import ChanDoan, ChiTietDonThuoc, DonThuoc, LuotKham
from app.models.user import BenhNhan, NguoiDung


async def _add_doctor_morning_shift(db_session, doctor_id: int, work_date: date) -> LichLamViec:
    shift = LichLamViec(
        bac_si_id=doctor_id,
        ngay_lam_viec=work_date,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        is_active=True,
    )
    db_session.add(shift)
    await db_session.flush()
    return shift


@pytest.mark.asyncio
async def test_p1_guest_booking_creates_patient_and_appointment_without_jwt(
    api_client, booking, db_session
):
    tomorrow = date.today() + timedelta(days=1)
    await _add_doctor_morning_shift(db_session, booking.bs_x.id, tomorrow)
    await db_session.commit()

    unauth_regular = await api_client.post(
        "/api/v1/appointments",
        json={
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": tomorrow.isoformat(),
            "gio_kham": "08:00:00",
            "ly_do_kham": "Khám tổng quát",
        },
    )
    assert unauth_regular.status_code == 401

    guest_phone = f"09{int(booking.suffix[:8], 16) % 100000000:08d}"
    res_guest = await api_client.post(
        "/api/v1/appointments/guest",
        json={
            "ho_ten": "Phạm Minh Khách",
            "so_dien_thoai": guest_phone,
            "ngay_sinh": "1992-05-15",
            "gioi_tinh": "Nam",
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": tomorrow.isoformat(),
            "gio_kham": "08:00:00",
            "ly_do_kham": "Đau đầu chóng mặt",
        },
    )
    assert res_guest.status_code == 201
    data = res_guest.json()["data"]
    assert data["ma_lich_kham"].startswith("LK-")
    assert data["trang_thai"] == "da_xac_nhan"
    assert data["benh_nhan"]["ho_ten"] == "Phạm Minh Khách"
    assert data["benh_nhan"]["so_dien_thoai"] == guest_phone

    bn_db = await db_session.get(BenhNhan, data["benh_nhan"]["id"])
    assert bn_db is not None
    assert bn_db.ma_dinh_danh_y_te.startswith("BN-GUEST-")


@pytest.mark.asyncio
async def test_p1_guest_booking_reuses_phone_without_overwriting_name_and_blocks_conflicts(
    api_client, booking, db_session
):
    tomorrow = date.today() + timedelta(days=1)
    await _add_doctor_morning_shift(db_session, booking.bs_x.id, tomorrow)
    await _add_doctor_morning_shift(db_session, booking.bs_y.id, tomorrow)
    await db_session.commit()

    guest_phone = f"09{(int(booking.suffix[:8], 16) + 17) % 100000000:08d}"
    other_phone = f"09{(int(booking.suffix[:8], 16) + 29) % 100000000:08d}"

    res_first = await api_client.post(
        "/api/v1/appointments/guest",
        json={
            "ho_ten": "Trần Thị Gốc",
            "so_dien_thoai": guest_phone,
            "gioi_tinh": "Nữ",
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": tomorrow.isoformat(),
            "gio_kham": "08:30:00",
            "ly_do_kham": "Khám lần 1",
        },
    )
    assert res_first.status_code == 201
    first_bn_id = res_first.json()["data"]["benh_nhan"]["id"]

    res_second = await api_client.post(
        "/api/v1/appointments/guest",
        json={
            "ho_ten": "Tên Khác Nhập Nhầm",
            "so_dien_thoai": guest_phone,
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": tomorrow.isoformat(),
            "gio_kham": "09:30:00",
            "ly_do_kham": "Khám lần 2",
        },
    )
    assert res_second.status_code == 201
    second_data = res_second.json()["data"]
    assert second_data["benh_nhan"]["id"] == first_bn_id
    assert second_data["benh_nhan"]["ho_ten"] == "Trần Thị Gốc"

    res_patient_overlap = await api_client.post(
        "/api/v1/appointments/guest",
        json={
            "ho_ten": "Trần Thị Gốc",
            "so_dien_thoai": guest_phone,
            "bac_si_id": booking.bs_y.id,
            "ngay_kham": tomorrow.isoformat(),
            "gio_kham": "09:30:00",
            "ly_do_kham": "Trùng giờ bệnh nhân",
        },
    )
    assert res_patient_overlap.status_code == 409

    res_doctor_conflict = await api_client.post(
        "/api/v1/appointments/guest",
        json={
            "ho_ten": "Lê Văn Khác",
            "so_dien_thoai": other_phone,
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": tomorrow.isoformat(),
            "gio_kham": "08:30:00",
            "ly_do_kham": "Trùng slot bác sĩ",
        },
    )
    assert res_doctor_conflict.status_code == 409


@pytest.mark.asyncio
async def test_p1_guest_booking_blocks_no_show_locked_phone(
    api_client, booking, db_session
):
    tomorrow = date.today() + timedelta(days=1)
    await _add_doctor_morning_shift(db_session, booking.bs_x.id, tomorrow)

    blocked_phone = f"09{(int(booking.suffix[:8], 16) + 53) % 100000000:08d}"
    nd_a = await db_session.get(NguoiDung, booking.bn_a.nguoi_dung_id)
    nd_a.so_dien_thoai = blocked_phone
    booking.bn_a.is_blocked_booking = True
    await db_session.commit()

    res_blocked = await api_client.post(
        "/api/v1/appointments/guest",
        json={
            "ho_ten": "Người Bị Khóa NoShow",
            "so_dien_thoai": blocked_phone,
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": tomorrow.isoformat(),
            "gio_kham": "10:00:00",
            "ly_do_kham": "Thử lách khóa bằng vãng lai",
        },
    )
    assert res_blocked.status_code == 403


@pytest.mark.asyncio
async def test_p1_doctor_completed_encounters_multi_day_and_rbac(
    api_client, booking, db_session
):
    now_utc = datetime.now(timezone.utc)
    five_days_ago = now_utc - timedelta(days=5)
    three_days_ago = now_utc - timedelta(days=3)

    lk_old_bsx = LuotKham(
        ma_kcb=f"KCB-P1-OLD-{booking.suffix}",
        bac_si_id=booking.bs_x.id,
        benh_nhan_id=booking.bn_a.id,
        thoi_gian_bat_dau=five_days_ago - timedelta(minutes=25),
        thoi_gian_ket_thuc=five_days_ago,
        thoi_gian_khoa=five_days_ago,
        is_locked=True,
        mach_lan_phut=76,
        huyet_ap_tam_thu=130,
        huyet_ap_tam_truong=85,
        ket_luan_dieu_tri="Tăng huyết áp độ 1 ổn định",
        loi_dan_bac_si="Giảm mặn, tái khám sau 1 tháng",
    )
    lk_today_bsx = LuotKham(
        ma_kcb=f"KCB-P1-NOW-{booking.suffix}",
        bac_si_id=booking.bs_x.id,
        benh_nhan_id=booking.bn_b.id,
        thoi_gian_bat_dau=now_utc - timedelta(minutes=20),
        thoi_gian_ket_thuc=now_utc,
        thoi_gian_khoa=now_utc,
        is_locked=True,
        mach_lan_phut=82,
        huyet_ap_tam_thu=120,
        huyet_ap_tam_truong=78,
        ket_luan_dieu_tri="Viêm mũi họng cấp",
    )
    lk_open_bsx = LuotKham(
        ma_kcb=f"KCB-P1-OPEN-{booking.suffix}",
        bac_si_id=booking.bs_x.id,
        benh_nhan_id=booking.bn_a.id,
        thoi_gian_bat_dau=now_utc,
        is_locked=False,
    )
    lk_other_bsy = LuotKham(
        ma_kcb=f"KCB-P1-BSY-{booking.suffix}",
        bac_si_id=booking.bs_y.id,
        benh_nhan_id=booking.bn_b.id,
        thoi_gian_bat_dau=three_days_ago - timedelta(minutes=15),
        thoi_gian_ket_thuc=three_days_ago,
        thoi_gian_khoa=three_days_ago,
        is_locked=True,
        ket_luan_dieu_tri="Theo dõi ngoại khoa",
    )
    db_session.add_all([lk_old_bsx, lk_today_bsx, lk_open_bsx, lk_other_bsy])
    await db_session.flush()

    db_session.add(
        ChanDoan(
            luot_kham_id=lk_old_bsx.id,
            ma_icd10="I10",
            ten_benh_chan_doan="Bệnh tăng huyết áp vô căn",
            loai_chan_doan="CHINH",
        )
    )
    rx = DonThuoc(
        ma_don_thuoc=f"DT-P1-{booking.suffix}",
        luot_kham_id=lk_old_bsx.id,
        bac_si_ke_don_id=booking.bs_x.id,
        ngay_ke_don=five_days_ago,
        loi_dan_uong_thuoc="Uống sau ăn sáng",
        trang_thai="ISSUED",
    )
    db_session.add(rx)
    await db_session.flush()
    db_session.add(
        ChiTietDonThuoc(
            don_thuoc_id=rx.id,
            ten_thuoc="Amlodipin 5mg",
            don_vi_tinh="Viên",
            so_luong=30,
            cach_dung="Ngày uống 1 viên buổi sáng",
        )
    )
    await db_session.commit()

    res_patient_forbidden = await api_client.get(
        "/api/v1/clinical/doctor/completed-encounters?days=30",
        headers=booking.tokens["bn_a"],
    )
    assert res_patient_forbidden.status_code == 403

    res_bsx = await api_client.get(
        "/api/v1/clinical/doctor/completed-encounters?days=30",
        headers=booking.tokens["bs_x"],
    )
    assert res_bsx.status_code == 200
    bsx_items = res_bsx.json()["data"]
    bsx_ids = [it["id"] for it in bsx_items]
    assert bsx_ids == [lk_today_bsx.id, lk_old_bsx.id]

    old_item = next(it for it in bsx_items if it["id"] == lk_old_bsx.id)
    assert old_item["huyet_ap_tam_thu"] == 130
    assert old_item["huyet_ap_tam_truong"] == 85
    assert old_item["mach_lan_phut"] == 76
    assert old_item["danh_sach_chan_doan"][0]["ma_icd10"] == "I10"
    assert old_item["danh_sach_thuoc"][0]["ten_thuoc"] == "Amlodipin 5mg"

    res_admin = await api_client.get(
        "/api/v1/clinical/doctor/completed-encounters?days=30",
        headers=booking.tokens["admin"],
    )
    assert res_admin.status_code == 200
    admin_ids = {it["id"] for it in res_admin.json()["data"]}
    assert {lk_today_bsx.id, lk_old_bsx.id, lk_other_bsy.id}.issubset(admin_ids)
    assert lk_open_bsx.id not in admin_ids
