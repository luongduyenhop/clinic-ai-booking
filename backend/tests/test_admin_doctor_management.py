import pytest
from sqlalchemy import select
from app.models.user import PhongKham, ChuyenKhoa


@pytest.mark.asyncio
async def test_create_doctor_with_assigned_physical_room(api_client, booking, db_session):
    """Kiểm tra tạo mới bác sĩ kèm gán buồng khám vật lý làm việc cố định"""
    headers = booking.tokens["admin"]

    # Lấy chuyên khoa hợp lệ
    stmt_ck = select(ChuyenKhoa).limit(1)
    ck = (await db_session.execute(stmt_ck)).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(ma_chuyen_khoa=f"CK_TEST_{booking.suffix}", ten_chuyen_khoa="Khoa Nội Test")
        db_session.add(ck)
        await db_session.flush()

    # Tạo buồng khám vật lý
    room = PhongKham(
        ma_phong=f"P_DOC_{booking.suffix}",
        ten_phong="Buồng Khám Chuyên Khoa Nội Test",
        chuyen_khoa_id=ck.id,
        tang="Tầng 1",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room)
    await db_session.flush()

    unique_email = f"bs.test.{booking.suffix}@clinic.com"
    unique_cchn = f"CCHN-TEST-{booking.suffix}"
    unique_phone = f"09{abs(hash(booking.suffix)) % 100000000:08d}"

    payload = {
        "ho_ten": "BS. Nguyễn Văn Nghiệm",
        "email": unique_email,
        "so_dien_thoai": unique_phone,
        "mat_khau": "Doctor@123456",
        "chuyen_khoa_id": ck.id,
        "phong_kham_id": room.id,
        "hoc_vi": "BS.CKI",
        "chung_chi_hanh_nghe": unique_cchn,
        "nam_kinh_nghiem": 8,
        "gia_kham_mac_dinh": 350000.0,
        "mo_ta_chuyen_sau": "Chuyên gia nội tiêu hóa và tim mạch",
    }

    resp = await api_client.post("/api/v1/admin/doctors", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["ho_ten"] == "BS. Nguyễn Văn Nghiệm"
    assert data["phong_kham_id"] == room.id
    assert data["ma_phong_kham"] == room.ma_phong
    assert f"[{room.ma_phong}]" in data["phong_kham"]


@pytest.mark.asyncio
async def test_update_doctor_profile_and_room(api_client, booking, db_session):
    """Kiểm tra cập nhật thông tin bác sĩ (họ tên, SĐT, buồng khám, giá khám)"""
    headers = booking.tokens["admin"]
    doc_id = booking.bs_x.id

    # Lấy chuyên khoa hợp lệ
    stmt_ck = select(ChuyenKhoa).limit(1)
    ck = (await db_session.execute(stmt_ck)).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(ma_chuyen_khoa=f"CK_TEST2_{booking.suffix}", ten_chuyen_khoa="Khoa Nội Test 2")
        db_session.add(ck)
        await db_session.flush()

    # Tạo buồng khám mới
    new_room = PhongKham(
        ma_phong=f"P_UPD_{booking.suffix}",
        ten_phong="Buồng Khám Mới Cập Nhật",
        chuyen_khoa_id=ck.id,
        tang="Tầng 2",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(new_room)
    await db_session.flush()

    unique_phone = f"098{booking.suffix[:7]}"

    update_payload = {
        "ho_ten": "BS. CKI Đã Đổi Tên",
        "so_dien_thoai": unique_phone,
        "hoc_vi": "ThS.BS",
        "chuyen_khoa_id": ck.id,
        "phong_kham_id": new_room.id,
        "gia_kham_mac_dinh": 450000.0,
        "nam_kinh_nghiem": 12,
    }

    resp = await api_client.put(f"/api/v1/admin/doctors/{doc_id}", json=update_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["ho_ten"] == "BS. CKI Đã Đổi Tên"
    assert data["so_dien_thoai"] == unique_phone
    assert data["hoc_vi"] == "ThS.BS"
    assert data["phong_kham_id"] == new_room.id
    assert data["gia_kham_mac_dinh"] == 450000.0
    assert data["nam_kinh_nghiem"] == 12


@pytest.mark.asyncio
async def test_get_doctors_includes_physical_room(api_client, booking):
    """Kiểm tra danh sách bác sĩ trả về đầy đủ buồng khám vật lý làm việc"""
    headers = booking.tokens["admin"]

    resp = await api_client.get("/api/v1/admin/doctors", headers=headers)
    assert resp.status_code == 200
    doctors = resp.json()["data"]
    assert len(doctors) >= 1
    for doc in doctors:
        assert "phong_kham" in doc
        assert "phong_kham_id" in doc
