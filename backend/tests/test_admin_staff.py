import pytest
from datetime import date, timedelta
from sqlalchemy import select

from app.models.user import BacSi, ChuyenKhoa, PhongKham


@pytest.mark.asyncio
async def test_admin_staff_rbac_forbidden_for_non_admin(api_client, booking):
    await booking.tao_tai_khoan("bn_user", "benh_nhan")
    headers_patient = booking.tokens["bn_user"]

    resp_anon = await api_client.get("/api/v1/admin/staff/doctors")
    assert resp_anon.status_code == 401

    resp_forbidden = await api_client.get("/api/v1/admin/staff/doctors", headers=headers_patient)
    assert resp_forbidden.status_code == 403

    resp_post_forbidden = await api_client.post("/api/v1/admin/staff/shifts", json={}, headers=headers_patient)
    assert resp_post_forbidden.status_code == 403


@pytest.mark.asyncio
async def test_admin_staff_get_and_create_doctor(api_client, booking, db_session):
    headers = booking.tokens["admin"]

    stmt_ck = select(ChuyenKhoa).limit(1)
    ck = (await db_session.execute(stmt_ck)).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(ma_chuyen_khoa=f"CK_STF_{booking.suffix}", ten_chuyen_khoa="Khoa Test Staff")
        db_session.add(ck)
        await db_session.flush()

    room = PhongKham(
        ma_phong=f"P_STF_{booking.suffix}",
        ten_phong="Buồng Khám Staff Test",
        chuyen_khoa_id=ck.id,
        tang="Tầng 1",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room)
    await db_session.flush()

    unique_email = f"bs.staff.{booking.suffix}@clinic.com"
    unique_cchn = f"CCHN-STF-{booking.suffix}"
    unique_phone = f"09{abs(hash(booking.suffix + 'stf')) % 100000000:08d}"

    payload = {
        "ho_ten": "BS. Lê Nhân Sự",
        "email": unique_email,
        "so_dien_thoai": unique_phone,
        "mat_khau": "Doctor@123456",
        "chuyen_khoa_id": ck.id,
        "phong_kham_id": room.id,
        "hoc_vi": "BS.CKI",
        "chung_chi_hanh_nghe": unique_cchn,
        "nam_kinh_nghiem": 5,
        "gia_kham_mac_dinh": 300000.0,
        "mo_ta_chuyen_sau": "Chuyên môn sâu",
    }

    create_resp = await api_client.post("/api/v1/admin/staff/doctors", json=payload, headers=headers)
    assert create_resp.status_code == 201
    created_data = create_resp.json()["data"]
    doc_id = created_data["id"]
    assert created_data["ho_ten"] == "BS. Lê Nhân Sự"
    assert created_data["phong_kham_id"] == room.id

    list_resp = await api_client.get("/api/v1/admin/staff/doctors", headers=headers)
    assert list_resp.status_code == 200
    docs = list_resp.json()["data"]
    assert any(d["id"] == doc_id for d in docs)

    update_payload = {
        "ho_ten": "BS. Lê Nhân Sự Đã Đổi",
        "nam_kinh_nghiem": 7,
    }
    update_resp = await api_client.put(f"/api/v1/admin/staff/doctors/{doc_id}", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["data"]["ho_ten"] == "BS. Lê Nhân Sự Đã Đổi"
    assert update_resp.json()["data"]["nam_kinh_nghiem"] == 7


@pytest.mark.asyncio
async def test_admin_staff_block_shift_for_expired_or_suspended_cchn(api_client, booking, db_session):
    headers = booking.tokens["admin"]
    original_status = booking.bs_x.trang_thai_giay_phep

    booking.bs_x.trang_thai_giay_phep = "EXPIRED"
    await db_session.flush()

    shift_date = date.today() + timedelta(days=25)
    payload = {
        "bac_si_id": booking.bs_x.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 10,
    }

    resp_exp = await api_client.post("/api/v1/admin/staff/shifts", json=payload, headers=headers)
    assert resp_exp.status_code == 400

    booking.bs_x.trang_thai_giay_phep = "SUSPENDED"
    await db_session.flush()

    resp_susp = await api_client.post("/api/v1/admin/staff/shifts", json=payload, headers=headers)
    assert resp_susp.status_code == 400

    booking.bs_x.trang_thai_giay_phep = original_status
    await db_session.flush()


@pytest.mark.asyncio
async def test_admin_staff_detect_shift_collision_returns_409(api_client, booking, db_session):
    headers = booking.tokens["admin"]

    stmt_ck = select(ChuyenKhoa).limit(1)
    ck = (await db_session.execute(stmt_ck)).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(ma_chuyen_khoa=f"CK_COL_{booking.suffix}", ten_chuyen_khoa="Khoa Test Col")
        db_session.add(ck)
        await db_session.flush()

    room = PhongKham(
        ma_phong=f"P_COL_{booking.suffix}",
        ten_phong="Buồng Khám Xung Đột",
        chuyen_khoa_id=ck.id,
        tang="Tầng 1",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room)
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_y.chuyen_khoa_id = ck.id
    await db_session.flush()

    shift_date = date.today() + timedelta(days=26)
    payload1 = {
        "bac_si_id": booking.bs_x.id,
        "phong_kham_id": room.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 10,
    }
    resp1 = await api_client.post("/api/v1/admin/staff/shifts", json=payload1, headers=headers)
    assert resp1.status_code == 201

    payload_room_collision = {
        "bac_si_id": booking.bs_y.id,
        "phong_kham_id": room.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 10,
    }
    resp_room = await api_client.post("/api/v1/admin/staff/shifts", json=payload_room_collision, headers=headers)
    assert resp_room.status_code == 409

    payload_doc_collision = {
        "bac_si_id": booking.bs_x.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 10,
    }
    resp_doc = await api_client.post("/api/v1/admin/staff/shifts", json=payload_doc_collision, headers=headers)
    assert resp_doc.status_code == 409


@pytest.mark.asyncio
async def test_admin_staff_doctor_leaves_crud(api_client, booking):
    headers = booking.tokens["admin"]
    start_date = date.today() + timedelta(days=30)
    end_date = start_date + timedelta(days=2)

    payload = {
        "bac_si_id": booking.bs_x.id,
        "loai_nghi": "NGHI_PHEP",
        "tu_ngay": start_date.isoformat(),
        "den_ngay": end_date.isoformat(),
        "ly_do": "Nghỉ phép thường niên theo quy định",
    }
    resp_create = await api_client.post("/api/v1/admin/staff/doctor-leaves", json=payload, headers=headers)
    assert resp_create.status_code == 201
    leave_data = resp_create.json()["data"]
    leave_id = leave_data["id"]

    resp_list = await api_client.get(f"/api/v1/admin/staff/doctor-leaves?doctor_id={booking.bs_x.id}", headers=headers)
    assert resp_list.status_code == 200
    leaves = resp_list.json()["data"]
    assert any(item["id"] == leave_id for item in leaves)

    approve_payload = {
        "hanh_dong": "DA_DUYET",
        "ghi_chu": "Duyệt nghỉ phép hợp lệ",
    }
    resp_approve = await api_client.post(
        f"/api/v1/admin/staff/doctor-leaves/{leave_id}/approve",
        json=approve_payload,
        headers=headers,
    )
    assert resp_approve.status_code == 200
    assert resp_approve.json()["data"]["trang_thai"] == "DA_DUYET"


@pytest.mark.asyncio
async def test_admin_staff_roles_matrix_and_staff_list(api_client, booking):
    headers = booking.tokens["admin"]

    resp_roles = await api_client.get("/api/v1/admin/staff/roles", headers=headers)
    assert resp_roles.status_code == 200
    roles = resp_roles.json()["data"]
    assert isinstance(roles, list)

    resp_staff = await api_client.get("/api/v1/admin/staff/staff", headers=headers)
    assert resp_staff.status_code == 200
    staff = resp_staff.json()["data"]
    assert isinstance(staff, list)

    update_roles_payload = {
        "items": roles,
    }
    resp_put_roles = await api_client.put("/api/v1/admin/staff/roles", json=update_roles_payload, headers=headers)
    assert resp_put_roles.status_code == 200

    # Hồ sơ nhân sự được quản lý qua API quan hệ (bác sĩ/nhân viên/tài khoản),
    # không còn ghi staffList qua dữ liệu BFF (xem test_admin_command_center).
    update_staff_payload = {
        "items": staff,
    }
    resp_put_staff = await api_client.put("/api/v1/admin/staff/staff", json=update_staff_payload, headers=headers)
    assert resp_put_staff.status_code == 400

    resp_staff_after = await api_client.get("/api/v1/admin/staff/staff", headers=headers)
    assert resp_staff_after.status_code == 200
    assert resp_staff_after.json()["data"] == staff
