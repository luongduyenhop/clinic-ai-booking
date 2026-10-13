import pytest
from datetime import date, timedelta
from app.models.user import PhongKham, ChuyenKhoa


@pytest.mark.asyncio
async def test_cannot_assign_doctor_to_non_clinical_room(api_client, booking, db_session):
    """Tiêu chí 1: Không thể phân ca khám cho buồng cận lâm sàng/xét nghiệm (loai_phong != 'kham_benh')"""
    headers = booking.tokens["admin"]
    doc_id = booking.bs_x.id

    # Tạo buồng xét nghiệm
    lab_room = PhongKham(
        ma_phong=f"LAB_{booking.suffix}",
        ten_phong="Phòng Xét Nghiệm Hóa Sinh",
        tang="Tầng 1",
        loai_phong="xet_nghiem",
        is_active=True,
    )
    db_session.add(lab_room)
    await db_session.flush()

    shift_date = str(date.today() + timedelta(days=20))
    payload = {
        "bac_si_id": doc_id,
        "phong_kham_id": lab_room.id,
        "ngay_lam_viec": shift_date,
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 12,
    }

    resp = await api_client.post("/api/v1/admin/shifts", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "không phải buồng khám bệnh lâm sàng" in resp.json()["message"]


@pytest.mark.asyncio
async def test_cannot_assign_doctor_to_mismatched_specialty_room(api_client, booking, db_session):
    """Tiêu chí 2: Không thể phân ca cho buồng có chuyên khoa không tương thích với bác sĩ"""
    headers = booking.tokens["admin"]
    doc_id = booking.bs_x.id

    # Tạo 2 chuyên khoa khác nhau
    ck1 = ChuyenKhoa(ma_chuyen_khoa=f"CK1_{booking.suffix}", ten_chuyen_khoa="Chuyên Khoa A")
    ck2 = ChuyenKhoa(ma_chuyen_khoa=f"CK2_{booking.suffix}", ten_chuyen_khoa="Chuyên Khoa B")
    db_session.add_all([ck1, ck2])
    await db_session.flush()

    # Cập nhật bác sĩ sang chuyên khoa 1
    booking.bs_x.chuyen_khoa_id = ck1.id
    await db_session.flush()

    # Tạo buồng khám thuộc chuyên khoa 2
    room_ck2 = PhongKham(
        ma_phong=f"P_CK2_{booking.suffix}",
        ten_phong="Buồng Khám B",
        chuyen_khoa_id=ck2.id,
        tang="Tầng 2",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room_ck2)
    await db_session.flush()

    shift_date = str(date.today() + timedelta(days=21))
    payload = {
        "bac_si_id": doc_id,
        "phong_kham_id": room_ck2.id,
        "ngay_lam_viec": shift_date,
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 12,
    }

    resp = await api_client.post("/api/v1/admin/shifts", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "không tương thích với chuyên khoa của BS" in resp.json()["message"]


@pytest.mark.asyncio
async def test_can_assign_doctor_to_matching_room_with_dynamic_capacity(api_client, booking, db_session):
    """Phân ca thành công với buồng khớp chuyên khoa và công suất tự nhiên theo slot (16 slot)"""
    headers = booking.tokens["admin"]
    doc_id = booking.bs_x.id

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK_OK_{booking.suffix}", ten_chuyen_khoa="Chuyên Khoa Khớp")
    db_session.add(ck)
    await db_session.flush()

    booking.bs_x.chuyen_khoa_id = ck.id
    await db_session.flush()

    room = PhongKham(
        ma_phong=f"P_OK_{booking.suffix}",
        ten_phong="Buồng Khám Chuẩn Khớp",
        chuyen_khoa_id=ck.id,
        tang="Tầng 1",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room)
    await db_session.flush()

    shift_date = str(date.today() + timedelta(days=22))
    payload = {
        "bac_si_id": doc_id,
        "phong_kham_id": room.id,
        "ngay_lam_viec": shift_date,
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 16, # 15-minute slot capacity
        "han_muc_dat_truoc": 12,
        "han_muc_vang_lai": 4,
    }

    resp = await api_client.post("/api/v1/admin/shifts", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["phong_kham_id"] == room.id
    assert data["gioi_han_ca_kham"] == 16
    assert data["han_muc_dat_truoc"] == 12
    assert data["han_muc_vang_lai"] == 4
