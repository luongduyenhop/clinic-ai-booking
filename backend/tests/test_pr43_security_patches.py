import pytest
from app.models.user import VaiTroEnum


@pytest.mark.asyncio
async def test_post_cashier_refund_rbac_denies_patient_and_doctor(api_client, booking, db_session):
    """
    Test RBAC cho POST /api/v1/cashier/refund:
    - Bệnh nhân (BENH_NHAN) và Bác sĩ (BAC_SI) không có quyền hoàn tiền -> 403 Forbidden
    """
    payload = {
        "invoice_id": 999999,
        "so_tien_hoan": 100000.0,
        "ly_do": "Hủy dịch vụ khám xét nghiệm",
    }

    # 1. Bệnh nhân gọi refund -> 403
    res_bn = await api_client.post(
        "/api/v1/cashier/refund",
        json=payload,
        headers=booking.tokens["bn_a"],
    )
    assert res_bn.status_code == 403
    assert "quyền" in res_bn.json()["message"]

    # 2. Bác sĩ gọi refund -> 403
    res_bs = await api_client.post(
        "/api/v1/cashier/refund",
        json=payload,
        headers=booking.tokens["bs_x"],
    )
    assert res_bs.status_code == 403
    assert "quyền" in res_bs.json()["message"]


@pytest.mark.asyncio
async def test_post_cashier_refund_rbac_allows_authorized_roles(api_client, booking, db_session):
    """
    Test RBAC cho POST /api/v1/cashier/refund:
    - Thu ngân (THU_NGAN), Lễ tân (LE_TAN), Admin (ADMIN) được phép vượt qua role check (không bị 403).
    """
    payload = {
        "invoice_id": 999999,
        "so_tien_hoan": 50000.0,
        "ly_do": "Bệnh nhân chuyển tuyến cấp cứu",
    }

    # Tạo tài khoản Thu ngân và Lễ tân
    await booking.tao_tai_khoan("letan_user", VaiTroEnum.LE_TAN.value)
    await booking.tao_tai_khoan("thungan_user", VaiTroEnum.THU_NGAN.value)

    for role_key in ("admin", "letan_user", "thungan_user"):
        res = await api_client.post(
            "/api/v1/cashier/refund",
            json=payload,
            headers=booking.tokens[role_key],
        )
        # Không được trả về 403 Forbidden (sẽ trả về 404 vì hóa đơn 999999 không tồn tại)
        assert res.status_code != 403


@pytest.mark.asyncio
async def test_get_reception_appointments_rbac_denies_patient(api_client, booking, db_session):
    """
    Test RBAC cho GET /api/v1/reception/appointments:
    - Bệnh nhân không có quyền xem toàn bộ danh sách lịch hẹn tại quầy tiếp đón -> 403 Forbidden
    """
    res = await api_client.get(
        "/api/v1/reception/appointments",
        headers=booking.tokens["bn_a"],
    )
    assert res.status_code == 403
    assert "Chỉ Lễ tân, Bác sĩ, Thu ngân hoặc Quản trị viên" in res.json()["message"]


@pytest.mark.asyncio
async def test_get_reception_appointments_rbac_allows_staff(api_client, booking, db_session):
    """
    Test RBAC cho GET /api/v1/reception/appointments:
    - Admin, Bác sĩ, Lễ tân có quyền truy cập danh sách lịch hẹn -> 200 OK
    """
    await booking.tao_tai_khoan("letan_staff", VaiTroEnum.LE_TAN.value)

    for staff_key in ("admin", "bs_x", "letan_staff"):
        res = await api_client.get(
            "/api/v1/reception/appointments",
            headers=booking.tokens[staff_key],
        )
        assert res.status_code == 200
        assert "data" in res.json()


@pytest.mark.asyncio
async def test_idor_protection_patient_packages(api_client, booking, db_session):
    """
    Test chống lỗ hổng IDOR trên GET /api/v1/reception/patients/{benh_nhan_id}/packages:
    - Bệnh nhân A tra cứu gói của Bệnh nhân B -> 403 Forbidden
    - Bệnh nhân A tra cứu gói của chính mình -> 200 OK
    - Lễ tân tra cứu gói của Bệnh nhân B -> 200 OK
    """
    bn_a = booking.bn_a
    bn_b = booking.bn_b

    # 1. Bệnh nhân A cố tình truy cập gói khám của Bệnh nhân B (IDOR)
    res_idor = await api_client.get(
        f"/api/v1/reception/patients/{bn_b.id}/packages",
        headers=booking.tokens["bn_a"],
    )
    assert res_idor.status_code == 403
    assert "Bạn không có quyền truy cập hồ sơ của bệnh nhân khác" in res_idor.json()["message"]

    # 2. Bệnh nhân A truy cập gói của chính mình
    res_own = await api_client.get(
        f"/api/v1/reception/patients/{bn_a.id}/packages",
        headers=booking.tokens["bn_a"],
    )
    assert res_own.status_code == 200

    # 3. Nhân viên Lễ tân tra cứu hồ sơ bệnh nhân B
    await booking.tao_tai_khoan("letan_idor_test", VaiTroEnum.LE_TAN.value)
    res_staff = await api_client.get(
        f"/api/v1/reception/patients/{bn_b.id}/packages",
        headers=booking.tokens["letan_idor_test"],
    )
    assert res_staff.status_code == 200


@pytest.mark.asyncio
async def test_idor_protection_patient_history_summary(api_client, booking, db_session):
    """
    Test chống lỗ hổng IDOR trên GET /api/v1/reception/patients/{benh_nhan_id}/history-summary:
    - Bệnh nhân A tra cứu lịch sử tóm tắt của Bệnh nhân B -> 403 Forbidden
    - Bệnh nhân A tra cứu của chính mình -> 200 OK
    - Bác sĩ / Admin tra cứu hồ sơ bệnh nhân B -> 200 OK
    """
    bn_a = booking.bn_a
    bn_b = booking.bn_b

    # 1. Bệnh nhân A cố tình truy cập lịch sử của Bệnh nhân B (IDOR)
    res_idor = await api_client.get(
        f"/api/v1/reception/patients/{bn_b.id}/history-summary",
        headers=booking.tokens["bn_a"],
    )
    assert res_idor.status_code == 403
    assert "Bạn không có quyền truy cập hồ sơ của bệnh nhân khác" in res_idor.json()["message"]

    # 2. Bệnh nhân A truy cập hồ sơ của chính mình
    res_own = await api_client.get(
        f"/api/v1/reception/patients/{bn_a.id}/history-summary",
        headers=booking.tokens["bn_a"],
    )
    assert res_own.status_code == 200

    # 3. Bác sĩ tra cứu hồ sơ bệnh nhân B
    res_doctor = await api_client.get(
        f"/api/v1/reception/patients/{bn_b.id}/history-summary",
        headers=booking.tokens["bs_x"],
    )
    assert res_doctor.status_code == 200


@pytest.mark.asyncio
async def test_patient_denied_reception_dashboards_and_resources(api_client, booking, db_session):
    """
    Test RBAC cho các endpoint Dashboard, Flow Board, và Resource tại quầy:
    - Bệnh nhân không được phép xem các endpoint nội bộ vận hành -> 403 Forbidden
    """
    endpoints = [
        "/api/v1/reception/search-appointments?q=test",
        "/api/v1/reception/dashboard/shift-summary",
        "/api/v1/reception/dashboard/room-status",
        "/api/v1/reception/flow-board",
        "/api/v1/reception/resources/roster",
        "/api/v1/reception/resources/rooms",
        "/api/v1/reception/resources/roster-template",
        f"/api/v1/reception/queue/{booking.bs_x.id}",
    ]
    for ep in endpoints:
        res = await api_client.get(ep, headers=booking.tokens["bn_a"])
        assert res.status_code == 403, f"Endpoint {ep} must return 403 for patients, got {res.status_code}"


@pytest.mark.asyncio
async def test_staff_allowed_reception_dashboards_and_resources(api_client, booking, db_session):
    """
    Test RBAC cho các endpoint Dashboard, Flow Board, và Resource tại quầy:
    - Lễ tân và Admin được phép truy cập đầy đủ -> 200 OK
    """
    await booking.tao_tai_khoan("letan_dash", VaiTroEnum.LE_TAN.value)

    endpoints = [
        "/api/v1/reception/dashboard/shift-summary",
        "/api/v1/reception/dashboard/room-status",
        "/api/v1/reception/flow-board",
        "/api/v1/reception/resources/roster",
        "/api/v1/reception/resources/rooms",
        "/api/v1/reception/resources/roster-template",
        f"/api/v1/reception/queue/{booking.bs_x.id}",
    ]
    for ep in endpoints:
        res = await api_client.get(ep, headers=booking.tokens["letan_dash"])
        assert res.status_code == 200, f"Endpoint {ep} should return 200 for receptionist, got {res.status_code}"


@pytest.mark.asyncio
async def test_walk_in_validation_missing_doctor_and_department(api_client, booking, db_session):
    """
    Test validation trong check_in_walk_in:
    - Nếu cả bac_si_id và chuyen_khoa_id đều không có -> 400 Bad Request
    """
    await booking.tao_tai_khoan("letan_wlk_val", VaiTroEnum.LE_TAN.value)

    payload = {
        "benh_nhan_id": booking.bn_a.id,
        "ca_kham": "sang",
        "bac_si_id": None,
        "chuyen_khoa_id": None,
    }
    res = await api_client.post(
        "/api/v1/reception/walk-in",
        json=payload,
        headers=booking.tokens["letan_wlk_val"],
    )
    assert res.status_code == 400
    assert "chuyên khoa để phân bổ tự động" in res.json()["message"]


@pytest.mark.asyncio
async def test_walk_in_validation_nonexistent_department(api_client, booking, db_session):
    """
    Test validation trong check_in_walk_in:
    - Nếu chuyen_khoa_id không tồn tại -> 404 Not Found rõ ràng, không để lọt vào ConflictException
    """
    await booking.tao_tai_khoan("letan_wlk_ck", VaiTroEnum.LE_TAN.value)

    payload = {
        "benh_nhan_id": booking.bn_a.id,
        "ca_kham": "sang",
        "bac_si_id": None,
        "chuyen_khoa_id": 999999,
    }
    res = await api_client.post(
        "/api/v1/reception/walk-in",
        json=payload,
        headers=booking.tokens["letan_wlk_ck"],
    )
    assert res.status_code == 404
    assert "không tồn tại" in res.json()["message"]


@pytest.mark.asyncio
async def test_incident_rebalance_multi_tenancy_check(db_session, booking):
    """
    Test Multi-tenancy check trong rebalance_queue:
    - Lễ tân có phong_kham_id khác với phòng khám của bác sĩ vắng mặt -> 403 Forbidden
    """
    from datetime import date
    import uuid
    from app.services.incident_service import incident_service
    from app.schemas.incident import RebalanceQueueRequest
    from app.models.appointment import NghiPhepBacSi, TrangThaiNghiPhepEnum, LoaiNghiPhepEnum
    from app.models.user import PhongKham, TaiKhoan
    from app.core.exceptions import ForbiddenException
    from sqlalchemy import select

    today = date.today()
    uid = uuid.uuid4().hex[:6]
    room1 = PhongKham(
        ma_phong=f"P1-{uid}",
        ten_phong=f"Phòng {uid}-1",
        tang="Tầng 1",
        loai_phong="kham_benh",
        is_active=True,
    )
    room2 = PhongKham(
        ma_phong=f"P2-{uid}",
        ten_phong=f"Phòng {uid}-2",
        tang="Tầng 2",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add_all([room1, room2])
    await db_session.flush()

    # Tạo đơn nghỉ phép cho bs_x gắn với room1
    np = NghiPhepBacSi(
        bac_si_id=booking.bs_x.id,
        phong_kham_id=room1.id,
        loai_nghi=LoaiNghiPhepEnum.NGHI_DOT_XUAT.value,
        tu_ngay=today,
        den_ngay=today,
        ca_lam_viec="sang",
        ly_do=f"Sự cố đột xuất phòng khám {room1.id}",
        trang_thai=TrangThaiNghiPhepEnum.DA_DUYET.value,
    )
    db_session.add(np)
    await db_session.flush()

    # Tạo Lễ tân thuộc room2 (khác với room1)
    letan_nd = await booking.tao_tai_khoan("letan_tenant", VaiTroEnum.LE_TAN.value)
    stmt_tk = select(TaiKhoan).where(TaiKhoan.nguoi_dung_id == letan_nd.id)
    letan = (await db_session.execute(stmt_tk)).scalar_one()
    letan.phong_kham_id = room2.id

    req = RebalanceQueueRequest(
        nghi_phep_bac_si_id=np.id,
    )

    with pytest.raises(ForbiddenException) as exc_info:
        await incident_service.rebalance_queue(req, letan, db_session)
    assert "phòng khám này" in str(exc_info.value.message)
