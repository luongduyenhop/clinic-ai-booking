from datetime import date, datetime, time, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select, func
from app.models.compliance import NhatKyTruyCapDuLieuYTe
from app.models.medical import DichVu, DonThuoc, ChiTietDonThuoc
from app.models.user import BacSi, ChuyenKhoa, PhongKham, TaiKhoan, VaiTroEnum
from app.models.appointment import LichLamViec
from app.core.database import AsyncSessionLocal, engine
from scripts.seed_admin_demo import seed_admin_demo
from app.services.prescription_fsm_service import prescription_fsm_service

@pytest.mark.asyncio
async def test_wp01_dashboard_stats_empty_and_zero_counts(api_client: AsyncClient, booking):
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/bi/dashboard-stats?query_date=2099-12-31", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["tong_lich_hen_hom_nay"] == 0
    assert data["so_ca_cho_kham"] == 0
    assert data["so_ca_dang_kham"] == 0
    assert data["so_ca_hoan_tat_kham"] == 0
    assert data["doanh_thu_kham_lam_sang"] == 0.0
    assert data["doanh_thu_can_lam_sang"] == 0.0
    assert data["tong_doanh_thu_trong_ngay"] == 0.0
    assert data["cong_suat_buong_kham_pct"] == 0.0
    assert data["so_ca_canh_bao_cap_cuu"] == 0

    res_bs = await api_client.get("/api/v1/admin/bi/dashboard-stats", headers=booking.tokens["bs_x"])
    assert res_bs.status_code == 403
    res_bn = await api_client.get("/api/v1/admin/bi/dashboard-stats", headers=booking.tokens["bn_a"])
    assert res_bn.status_code == 403

@pytest.mark.asyncio
async def test_wp01_export_excel_returns_real_data(api_client: AsyncClient, booking):
    headers = booking.tokens["admin"]
    res = await api_client.get("/api/v1/admin/bi/export-excel", headers=headers)
    assert res.status_code == 200
    body = res.json()["data"]
    assert "tong_so_dich_vu" in body
    assert "danh_muc" in body
    assert body["tong_so_dich_vu"] == len(body["danh_muc"])
    if body["tong_so_dich_vu"] > 0:
        first_item = body["danh_muc"][0]
        assert "ma_dich_vu" in first_item and isinstance(first_item["ma_dich_vu"], str) and len(first_item["ma_dich_vu"]) > 0
        assert "ten_dich_vu" in first_item and isinstance(first_item["ten_dich_vu"], str) and len(first_item["ten_dich_vu"]) > 0
        assert "don_gia" in first_item and float(first_item["don_gia"]) >= 0.0
        assert "chuyen_khoa" in first_item

    res_forbidden = await api_client.get("/api/v1/admin/bi/export-excel", headers=booking.tokens["bs_x"])
    assert res_forbidden.status_code == 403

@pytest.mark.asyncio
async def test_wp02_service_price_update_audit_and_history(api_client: AsyncClient, booking, db_session):
    headers = booking.tokens["admin"]
    stmt = select(DichVu).limit(1)
    service = (await db_session.execute(stmt)).scalar_one_or_none()
    if not service:
        service = DichVu(
            ma_dich_vu=f"DV_CHALLENGE_{booking.suffix}",
            ten_dich_vu="Dịch vụ Challenge Kiểm Toán",
            don_gia=150000.0,
            is_active=True
        )
        db_session.add(service)
        await db_session.flush()

    initial_price = float(service.don_gia)
    target_price_1 = initial_price + 25000.0
    payload_1 = {
        "service_id": service.id,
        "don_gia": target_price_1,
        "ly_do": "Thử nghiệm tăng giá đợt 1"
    }
    res_update_1 = await api_client.post("/api/v1/admin/catalog/prices", json=payload_1, headers=headers)
    assert res_update_1.status_code == 200
    data_1 = res_update_1.json()["data"]
    assert data_1["don_gia_cu"] == initial_price
    assert data_1["don_gia_moi"] == target_price_1

    target_price_2 = target_price_1 + 50000.0
    payload_2 = {
        "service_id": service.id,
        "don_gia": target_price_2,
        "ly_do": "Thử nghiệm tăng giá đợt 2"
    }
    res_update_2 = await api_client.post("/api/v1/admin/catalog/prices", json=payload_2, headers=headers)
    assert res_update_2.status_code == 200
    data_2 = res_update_2.json()["data"]
    assert data_2["don_gia_cu"] == target_price_1
    assert data_2["don_gia_moi"] == target_price_2

    res_history = await api_client.get(f"/api/v1/admin/catalog/prices/history?service_id={service.id}", headers=headers)
    assert res_history.status_code == 200
    history_items = res_history.json()["data"]
    assert len(history_items) >= 2
    assert history_items[0]["noi_dung_moi"]["don_gia"] == target_price_2
    assert history_items[1]["noi_dung_moi"]["don_gia"] == target_price_1

    audit_stmt = select(NhatKyTruyCapDuLieuYTe).where(
        NhatKyTruyCapDuLieuYTe.resource_type == "SERVICE_PRICE",
        NhatKyTruyCapDuLieuYTe.resource_id == service.id
    )
    audit_rows = (await db_session.execute(audit_stmt)).scalars().all()
    assert len(audit_rows) >= 2

    bad_payload = {"service_id": service.id, "don_gia": -1000.0}
    res_bad = await api_client.post("/api/v1/admin/catalog/prices", json=bad_payload, headers=headers)
    assert res_bad.status_code == 422

@pytest.mark.asyncio
async def test_wp02_catalog_import_genuine_persistence(api_client: AsyncClient, booking, db_session):
    headers = booking.tokens["admin"]
    dept_code = f"CK_IMP_{booking.suffix}".upper()
    dept_payload = {
        "catalog_type": "departments",
        "items": [
            {
                "ma_chuyen_khoa": dept_code,
                "ten_chuyen_khoa": "Khoa Nhập Khẩu Thử Nghiệm",
                "mo_ta": "Mô tả khoa thử nghiệm",
                "vi_tri_phong": "Tầng 3"
            }
        ]
    }
    res_dept = await api_client.post("/api/v1/admin/catalog/import", json=dept_payload, headers=headers)
    assert res_dept.status_code == 200
    assert res_dept.json()["data"]["imported_count"] == 1

    dept_db = (await db_session.execute(select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == dept_code))).scalar_one_or_none()
    assert dept_db is not None
    assert dept_db.ten_chuyen_khoa == "Khoa Nhập Khẩu Thử Nghiệm"

    room_code = f"P_IMP_{booking.suffix}"
    room_payload = {
        "catalog_type": "rooms",
        "items": [
            {
                "ma_phong": room_code,
                "ten_phong": "Phòng Nhập Khẩu Thử Nghiệm",
                "tang": "Tầng 2",
                "loai_phong": "kham_benh"
            }
        ]
    }
    res_room = await api_client.post("/api/v1/admin/catalog/import", json=room_payload, headers=headers)
    assert res_room.status_code == 200
    assert res_room.json()["data"]["imported_count"] == 1

    room_db = (await db_session.execute(select(PhongKham).where(PhongKham.ma_phong == room_code))).scalar_one_or_none()
    assert room_db is not None
    assert room_db.ten_phong == "Phòng Nhập Khẩu Thử Nghiệm"

    srv_code = f"DV_IMP_{booking.suffix}"
    srv_payload = {
        "catalog_type": "services",
        "items": [
            {
                "ma_dich_vu": srv_code,
                "ten_dich_vu": "Dịch vụ Nhập Khẩu Thử Nghiệm",
                "don_gia": 320000.0
            }
        ]
    }
    res_srv = await api_client.post("/api/v1/admin/catalog/import", json=srv_payload, headers=headers)
    assert res_srv.status_code == 200
    assert res_srv.json()["data"]["imported_count"] == 1

    srv_db = (await db_session.execute(select(DichVu).where(DichVu.ma_dich_vu == srv_code))).scalar_one_or_none()
    assert srv_db is not None
    assert float(srv_db.don_gia) == 320000.0

    empty_payload = {"catalog_type": "services", "items": []}
    res_empty = await api_client.post("/api/v1/admin/catalog/import", json=empty_payload, headers=headers)
    assert res_empty.status_code == 400

@pytest.mark.asyncio
async def test_wp03_shift_collision_returns_409(api_client: AsyncClient, booking, db_session):
    headers = booking.tokens["admin"]
    ck = (await db_session.execute(select(ChuyenKhoa).limit(1))).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(ma_chuyen_khoa=f"CK_SH_{booking.suffix}", ten_chuyen_khoa="Khoa Phân Ca")
        db_session.add(ck)
        await db_session.flush()

    room = PhongKham(
        ma_phong=f"P_SH_{booking.suffix}",
        ten_phong="Phòng Phân Ca Test",
        chuyen_khoa_id=ck.id,
        tang="Tầng 1",
        loai_phong="kham_benh",
        is_active=True
    )
    db_session.add(room)
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_y.chuyen_khoa_id = ck.id
    await db_session.flush()

    shift_date = date.today() + timedelta(days=30)
    payload_base = {
        "bac_si_id": booking.bs_x.id,
        "phong_kham_id": room.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 12
    }
    res_create = await api_client.post("/api/v1/admin/staff/shifts", json=payload_base, headers=headers)
    assert res_create.status_code == 201

    payload_doc_collision = {
        "bac_si_id": booking.bs_x.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 12
    }
    res_doc_col = await api_client.post("/api/v1/admin/staff/shifts", json=payload_doc_collision, headers=headers)
    assert res_doc_col.status_code == 409

    payload_room_collision = {
        "bac_si_id": booking.bs_y.id,
        "phong_kham_id": room.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "sang",
        "gioi_han_ca_kham": 12
    }
    res_room_col = await api_client.post("/api/v1/admin/staff/shifts", json=payload_room_collision, headers=headers)
    assert res_room_col.status_code == 409

@pytest.mark.asyncio
async def test_wp03_shift_blocks_invalid_doctor_license(api_client: AsyncClient, booking, db_session):
    headers = booking.tokens["admin"]
    original_status = booking.bs_x.trang_thai_giay_phep

    shift_date = date.today() + timedelta(days=32)
    payload = {
        "bac_si_id": booking.bs_x.id,
        "ngay_lam_viec": shift_date.isoformat(),
        "ca_lam_viec": "chieu",
        "gioi_han_ca_kham": 10
    }

    booking.bs_x.trang_thai_giay_phep = "EXPIRED"
    await db_session.flush()
    res_expired = await api_client.post("/api/v1/admin/staff/shifts", json=payload, headers=headers)
    assert res_expired.status_code == 400

    booking.bs_x.trang_thai_giay_phep = "SUSPENDED"
    await db_session.flush()
    res_suspended = await api_client.post("/api/v1/admin/staff/shifts", json=payload, headers=headers)
    assert res_suspended.status_code == 400

    booking.bs_x.trang_thai_giay_phep = original_status
    await db_session.flush()

@pytest.mark.asyncio
async def test_wp04_seed_admin_demo_reset_preserves_admin():
    await engine.dispose()
    await seed_admin_demo(mode="append", env="development")
    async with AsyncSessionLocal() as session:
        stmt = select(TaiKhoan).where(TaiKhoan.email == "admin@clinic.com")
        admin_before = (await session.execute(stmt)).scalar_one_or_none()
        assert admin_before is not None
        admin_id = admin_before.id
        admin_hash = admin_before.mat_khau_hash
        admin_user_id = admin_before.nguoi_dung_id

    res_reset = await seed_admin_demo(mode="reset", env="development")
    assert res_reset["mode"] == "reset"

    async with AsyncSessionLocal() as session:
        admin_after = (await session.execute(stmt)).scalar_one_or_none()
        assert admin_after is not None
        assert admin_after.id == admin_id
        assert admin_after.mat_khau_hash == admin_hash
        assert admin_after.nguoi_dung_id == admin_user_id
        assert admin_after.vai_tro == VaiTroEnum.ADMIN.value
    await engine.dispose()

@pytest.mark.asyncio
async def test_wp04_paginated_audit_logs_filters(api_client: AsyncClient, booking, db_session):
    headers = booking.tokens["admin"]
    res_all = await api_client.get("/api/v1/admin/audit/logs?page=1&page_size=5", headers=headers)
    assert res_all.status_code == 200
    data = res_all.json()["data"]
    assert "items" in data
    assert "total" in data
    assert "page" in data and data["page"] == 1
    assert "page_size" in data and data["page_size"] == 5
    assert len(data["items"]) <= 5

    res_action = await api_client.get("/api/v1/admin/audit/logs?action=UPDATE_PRICE", headers=headers)
    assert res_action.status_code == 200
    action_items = res_action.json()["data"]["items"]
    for item in action_items:
        assert "UPDATE_PRICE" in item["action"].upper()

    res_actor = await api_client.get("/api/v1/admin/audit/logs?actor=ADMIN", headers=headers)
    assert res_actor.status_code == 200
    assert "items" in res_actor.json()["data"]

    res_date = await api_client.get("/api/v1/admin/audit/logs?from_date=2020-01-01&to_date=2030-12-31", headers=headers)
    assert res_date.status_code == 200

    res_forbidden = await api_client.get("/api/v1/admin/audit/logs", headers=booking.tokens["bn_a"])
    assert res_forbidden.status_code == 403

@pytest.mark.asyncio
async def test_wp05_prescription_fsm_draft_to_signed_locks_immutability(api_client: AsyncClient, booking, db_session):
    headers_doctor = booking.tokens["bs_x"]
    headers_admin = booking.tokens["admin"]

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kham challenge FSM"},
        headers=headers_doctor
    )
    assert res_enc.status_code in (200, 201)
    encounter_id = res_enc.json()["data"]["id"]

    rx_payload = {
        "danh_sach_thuoc": [
            {
                "ten_thuoc": "Paracetamol Challenge 500mg",
                "hoat_chat": "Paracetamol",
                "ham_luong": "500mg",
                "don_vi_tinh": "Viên",
                "so_luong": 10,
                "cach_dung": "Uống 1 viên khi sốt",
                "so_ngay_dung": 3
            }
        ],
        "loi_dan_uong_thuoc": "Nghỉ ngơi uống nhiều nước"
    }
    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{encounter_id}/prescriptions",
        json=rx_payload,
        headers=headers_doctor
    )
    assert res_rx.status_code in (200, 201)
    prescription_id = res_rx.json()["data"]["id"]
    assert res_rx.json()["data"]["trang_thai"] == "DRAFT"

    res_illegal_sign = await api_client.post(
        f"/api/v1/clinical/prescriptions/{prescription_id}/sign",
        json={"chu_ky_so": "RAW_SIG_DIRECT"},
        headers=headers_doctor
    )
    assert res_illegal_sign.status_code == 409

    res_validate = await api_client.post(
        f"/api/v1/clinical/prescriptions/{prescription_id}/validate",
        headers=headers_doctor
    )
    assert res_validate.status_code == 200
    assert res_validate.json()["data"]["trang_thai"] == "VALIDATED"

    res_sign = await api_client.post(
        f"/api/v1/clinical/prescriptions/{prescription_id}/sign",
        json={"chu_ky_so": "VALID_DIGITAL_SIGNATURE_DATA"},
        headers=headers_doctor
    )
    assert res_sign.status_code == 200
    sign_data = res_sign.json()["data"]
    assert sign_data["trang_thai"] == "SIGNED"
    assert "chu_ky_so" in sign_data and sign_data["chu_ky_so"] is not None
    assert "du_lieu_don_thuoc_hash" in sign_data and sign_data["du_lieu_don_thuoc_hash"] is not None

    update_payload = {
        "loi_dan_uong_thuoc": "LỜI DẶN SỬA ĐỔI TRÁI PHÉP",
        "danh_sach_thuoc": [
            {
                "ten_thuoc": "Morphine 10mg",
                "don_vi_tinh": "Viên",
                "so_luong": 100,
                "cach_dung": "Uống 1 viên khi đau dữ dội"
            }
        ]
    }
    res_tamper = await api_client.put(
        f"/api/v1/clinical/prescriptions/{prescription_id}",
        json=update_payload,
        headers=headers_doctor
    )
    assert res_tamper.status_code == 409

    rx_db = (await db_session.execute(select(DonThuoc).where(DonThuoc.id == prescription_id))).scalar_one_or_none()
    assert rx_db is not None
    assert rx_db.trang_thai == "SIGNED"
    assert rx_db.loi_dan_uong_thuoc == "Nghỉ ngơi uống nhiều nước"

    res_status = await api_client.get(
        f"/api/v1/admin/integration/prescriptions/{prescription_id}/status",
        headers=headers_admin
    )
    assert res_status.status_code == 200
    status_data = res_status.json()["data"]
    assert status_data["trang_thai"] == "SIGNED"
    assert status_data["is_immutable"] is True
    assert status_data["du_lieu_don_thuoc_hash"] is not None
