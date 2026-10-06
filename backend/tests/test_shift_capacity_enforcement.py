import pytest
from datetime import date, time, timedelta
from app.models.appointment import LichLamViec, CaLamViecEnum
from app.schemas.queue import WalkInQuickRequest


@pytest.mark.asyncio
async def test_booking_rejected_when_shift_reaches_capacity(api_client, booking, db_session):
    """Gói 3: Chặn đặt lịch trực tuyến khi tổng số lịch hẹn trong ca đã chạm trần gioi_han_ca_kham"""
    tomorrow = date.today() + timedelta(days=1)
    token_a = booking.tokens["bn_a"]
    token_b = booking.tokens["bn_b"]

    # 1. Tạo ca làm việc cho bs_x với gioi_han_ca_kham = 2
    shift = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=tomorrow,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(11, 0),
        gioi_han_ca_kham=2,  # Tối đa 2 người dù có 6 slot 30 phút!
        is_active=True,
    )
    db_session.add(shift)
    await db_session.commit()

    # 2. Bệnh nhân A đặt slot 08:00 -> Thành công (1/2)
    res1 = await api_client.post(
        "/api/v1/appointments",
        json={"bac_si_id": booking.bs_x.id, "ngay_kham": tomorrow.isoformat(), "gio_kham": "08:00:00", "ly_do_kham": "Khám 1"},
        headers=token_a,
    )
    assert res1.status_code == 201

    # 3. Bệnh nhân B đặt slot 08:30 -> Thành công (2/2)
    res2 = await api_client.post(
        "/api/v1/appointments",
        json={"bac_si_id": booking.bs_x.id, "ngay_kham": tomorrow.isoformat(), "gio_kham": "08:30:00", "ly_do_kham": "Khám 2"},
        headers=token_b,
    )
    assert res2.status_code == 201

    # 4. Tạo thêm tài khoản bệnh nhân C
    nd_c = await booking.tao_tai_khoan("bn_c", "benh_nhan")
    from app.models.user import BenhNhan
    bn_c = BenhNhan(nguoi_dung_id=nd_c.id, ma_dinh_danh_y_te=f"BN-TEST-bn_c-{booking.suffix}")
    db_session.add(bn_c)
    await db_session.commit()
    token_c = booking.tokens["bn_c"]

    # Bệnh nhân C đặt slot 09:00 (vẫn trống trong ca) -> Phải bị chặn 409 Conflict vì đã đủ 2/2!
    res3 = await api_client.post(
        "/api/v1/appointments",
        json={"bac_si_id": booking.bs_x.id, "ngay_kham": tomorrow.isoformat(), "gio_kham": "09:00:00", "ly_do_kham": "Khám 3"},
        headers=token_c,
    )
    assert res3.status_code == 409
    assert "đã đạt giới hạn tiếp nhận tối đa" in res3.json()["message"]


@pytest.mark.asyncio
async def test_walk_in_rejected_when_shift_reaches_capacity(api_client, booking, db_session):
    """Gói 3: Chặn tiếp nhận vãng lai tại quầy khi ca khám của bác sĩ đã kín chỗ"""
    today = date.today()
    token_admin = booking.tokens["admin"]

    # Tạo ca làm việc cho bs_x hôm nay với gioi_han_ca_kham = 1
    shift = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=1,  # Tối đa 1 bệnh nhân
        is_active=True,
    )
    db_session.add(shift)
    await db_session.commit()

    # 1. Tiếp nhận người thứ nhất -> Thành công (1/1)
    phone1 = f"091{int(booking.suffix, 16) % 10000000:07d}"
    phone2 = f"092{int(booking.suffix, 16) % 10000000:07d}"
    req1 = WalkInQuickRequest(
        ho_ten="Khách Vãng Lai 1",
        so_dien_thoai=phone1,
        gioi_tinh="Nam",
        bac_si_id=booking.bs_x.id,
        ca_lam_viec="sang",
        ly_do_kham="Đau bụng",
    )
    res1 = await api_client.post("/api/v1/reception/walk-in-quick", json=req1.model_dump(), headers=token_admin)
    assert res1.status_code == 201

    # 2. Tiếp nhận người thứ hai -> Bị chặn 409 Conflict
    req2 = WalkInQuickRequest(
        ho_ten="Khách Vãng Lai 2",
        so_dien_thoai=phone2,
        gioi_tinh="Nữ",
        bac_si_id=booking.bs_x.id,
        ca_lam_viec="sang",
        ly_do_kham="Sốt",
    )
    res2 = await api_client.post("/api/v1/reception/walk-in-quick", json=req2.model_dump(), headers=token_admin)
    assert res2.status_code == 409
    assert "đã đạt giới hạn tiếp nhận tối đa" in res2.json()["message"]
