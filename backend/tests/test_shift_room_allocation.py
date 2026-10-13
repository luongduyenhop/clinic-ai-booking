import pytest
from datetime import date, timedelta
from app.models.user import PhongKham


@pytest.mark.asyncio
async def test_get_clinic_rooms_list(api_client, booking, db_session):
    """Kiểm tra API lấy danh sách buồng khám vật lý (Physical Clinic Rooms)"""
    headers = booking.tokens["admin"]

    # Đảm bảo có ít nhất 1 phòng khám test
    room = PhongKham(
        ma_phong=f"TEST_P_{booking.suffix}",
        ten_phong="Phòng Khám Nội Tổng Quát Test",
        chuyen_khoa_id=booking.bs_x.chuyen_khoa_id,
        tang="Tầng 1",
        loai_phong="kham_benh",
        thiet_bi_chinh="Máy đo huyết áp, Ống nghe điện tử",
        is_active=True,
    )
    db_session.add(room)
    await db_session.flush()

    resp = await api_client.get("/api/v1/admin/rooms", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 1
    found = [r for r in data if r["ma_phong"] == room.ma_phong]
    assert len(found) == 1
    assert found[0]["ten_phong"] == "Phòng Khám Nội Tổng Quát Test"
    assert found[0]["is_active"] is True


@pytest.mark.asyncio
async def test_create_shift_with_physical_room_and_quotas(api_client, booking, db_session):
    """
    Kịch bản: Phân ca trực cho Bác sĩ kèm gán buồng khám vật lý và cấu hình hạn mức Quota kép:
    - Hạn mức đặt trực tuyến (Online): 6
    - Hạn mức bệnh nhân vãng lai (Walk-in): 2
    """
    headers = booking.tokens["admin"]
    shift_date = date.today() + timedelta(days=20)

    # Tạo buồng khám vật lý
    room = PhongKham(
        ma_phong=f"P_ALLOC_{booking.suffix}",
        ten_phong="Buồng Khám Chuyên Khoa Tim Mạch",
        chuyen_khoa_id=booking.bs_x.chuyen_khoa_id,
        tang="Tầng 2",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room)
    await db_session.flush()

    payload = {
        "bac_si_id": booking.bs_x.id,
        "phong_kham_id": room.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 8,
        "han_muc_dat_truoc": 6,
        "han_muc_vang_lai": 2,
    }

    resp = await api_client.post("/api/v1/admin/shifts", json=payload, headers=headers)
    assert resp.status_code == 201
    shift_data = resp.json()["data"]
    assert shift_data["bac_si_id"] == booking.bs_x.id
    assert shift_data["phong_kham_id"] == room.id
    assert shift_data["ma_phong"] == room.ma_phong
    assert shift_data["ten_phong"] == room.ten_phong
    assert shift_data["gioi_han_ca_kham"] == 8
    assert shift_data["han_muc_dat_truoc"] == 6
    assert shift_data["han_muc_vang_lai"] == 2


@pytest.mark.asyncio
async def test_reject_duplicate_room_assignment_same_shift(api_client, booking, db_session):
    """
    Bảo vệ bất biến: 100% Không cho phép 2 bác sĩ cùng trực tại 1 buồng khám trong cùng ca (Room Conflict).
    Bác sĩ X đã được phân phòng P201 sáng ngày D.
    Bác sĩ Y phân phòng P201 sáng ngày D -> Phải bị từ chối 409 Conflict.
    """
    headers = booking.tokens["admin"]
    shift_date = date.today() + timedelta(days=21)

    room = PhongKham(
        ma_phong=f"P_CONF_{booking.suffix}",
        ten_phong="Buồng Khám Số 1",
        chuyen_khoa_id=booking.bs_x.chuyen_khoa_id,
        tang="Tầng 1",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room)
    await db_session.flush()

    # 1. Phân ca cho BS X tại phòng room
    payload1 = {
        "bac_si_id": booking.bs_x.id,
        "phong_kham_id": room.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 10,
    }
    resp1 = await api_client.post("/api/v1/admin/shifts", json=payload1, headers=headers)
    assert resp1.status_code == 201

    # 2. Phân ca cho BS Y (hoặc bác sĩ khác) tại CÙNG phòng, CÙNG ca sáng ngày D
    payload2 = {
        "bac_si_id": booking.bs_y.id,
        "phong_kham_id": room.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 8,
    }
    resp2 = await api_client.post("/api/v1/admin/shifts", json=payload2, headers=headers)
    assert resp2.status_code == 409
    error_msg = resp2.json().get("message") or resp2.json().get("detail", "")
    assert "Xung đột buồng khám" in error_msg or "đã được phân" in error_msg


@pytest.mark.asyncio
async def test_reject_inactive_room_assignment(api_client, booking, db_session):
    """Bảo vệ: Không cho phép phân ca vào buồng khám đang tạm dừng/bảo trì (is_active=False)."""
    headers = booking.tokens["admin"]
    shift_date = date.today() + timedelta(days=22)

    room_inactive = PhongKham(
        ma_phong=f"P_MAINT_{booking.suffix}",
        ten_phong="Buồng Khám Đang Bảo Trì",
        tang="Tầng 3",
        loai_phong="kham_benh",
        is_active=False,
    )
    db_session.add(room_inactive)
    await db_session.flush()

    payload = {
        "bac_si_id": booking.bs_x.id,
        "phong_kham_id": room_inactive.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
    }
    resp = await api_client.post("/api/v1/admin/shifts", json=payload, headers=headers)
    assert resp.status_code == 400
    error_msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "bảo trì" in error_msg.lower() or "tạm dừng" in error_msg.lower()
