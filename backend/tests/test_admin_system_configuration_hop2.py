import pytest
from httpx import AsyncClient
from sqlalchemy import select, func
from app.core.config import settings
from app.models.user import ChuyenKhoa, PhongKham, BacSi, TaiKhoan, VaiTroEnum
from app.models.appointment import LichLamViec
from app.models.medical import DichVu, Thuoc
from seed_data import seed_database


@pytest.mark.asyncio
async def test_seed_data_5_departments_5_rooms_and_sample_doctors(db_session):
    await seed_database(db_session)

    stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.is_active.is_(True))
    departments = (await db_session.execute(stmt_ck)).scalars().all()
    dept_codes = {d.ma_chuyen_khoa for d in departments}
    required_depts = {"KHOA_NOI", "KHOA_NGOAI", "KHOA_TMH", "KHOA_RANG", "KHOA_MAT"}
    assert required_depts.issubset(dept_codes)

    stmt_pk = select(PhongKham).where(PhongKham.is_active.is_(True))
    rooms = (await db_session.execute(stmt_pk)).scalars().all()
    room_codes = {r.ma_phong for r in rooms}
    required_rooms = {"P101", "P102", "P201", "P202", "P301", "P302"}
    assert required_rooms.issubset(room_codes)

    lab_room = next((r for r in rooms if r.ma_phong == "LAB01"), None)
    assert lab_room is not None
    assert lab_room.loai_phong == "xet_nghiem"

    cdha_room = next((r for r in rooms if r.ma_phong == "CDHA01"), None)
    assert cdha_room is not None
    assert cdha_room.loai_phong == "chan_doan_hinh_anh"

    stmt_bs = select(BacSi).where(BacSi.is_active.is_(True))
    doctors = (await db_session.execute(stmt_bs)).scalars().all()
    assert len(doctors) >= 5

    doctors_with_rooms = [d for d in doctors if d.phong_kham_id is not None]
    assert len(doctors_with_rooms) >= 5

    stmt_shifts_count = select(func.count(LichLamViec.id))
    shift_count = (await db_session.execute(stmt_shifts_count)).scalar()
    assert shift_count >= 10

    stmt_dv_count = select(func.count(DichVu.id))
    service_count = (await db_session.execute(stmt_dv_count)).scalar()
    assert service_count >= 10

    stmt_thuoc_count = select(func.count(Thuoc.id))
    drug_count = (await db_session.execute(stmt_thuoc_count)).scalar()
    assert drug_count >= 10


@pytest.mark.asyncio
async def test_admin_departments_and_rooms_api(api_client: AsyncClient, booking, db_session):
    await seed_database(db_session)
    admin_hdr = booking.tokens["admin"]

    res_depts = await api_client.get("/api/v1/admin/departments", headers=admin_hdr)
    assert res_depts.status_code == 200
    depts_data = res_depts.json()["data"]
    assert len(depts_data) >= 5
    dept_codes = {d["ma_chuyen_khoa"] for d in depts_data}
    assert {"KHOA_NOI", "KHOA_NGOAI", "KHOA_TMH", "KHOA_RANG", "KHOA_MAT"}.issubset(dept_codes)

    res_rooms = await api_client.get("/api/v1/admin/rooms", headers=admin_hdr)
    assert res_rooms.status_code == 200
    rooms_data = res_rooms.json()["data"]
    assert len(rooms_data) >= 5
    room_codes = {r["ma_phong"] for r in rooms_data}
    assert {"P101", "P102", "P201", "P202", "P301", "P302"}.issubset(room_codes)


@pytest.mark.asyncio
async def test_admin_doctors_api_returns_room_allocation(api_client: AsyncClient, booking, db_session):
    await seed_database(db_session)
    admin_hdr = booking.tokens["admin"]

    res = await api_client.get("/api/v1/admin/doctors", headers=admin_hdr)
    assert res.status_code == 200
    doctors_data = res.json()["data"]
    assert len(doctors_data) >= 5
    doctors_with_rooms = [d for d in doctors_data if d.get("phong_kham_id") is not None]
    assert len(doctors_with_rooms) >= 5


@pytest.mark.asyncio
async def test_admin_services_export_catalog(api_client: AsyncClient, booking, db_session):
    await seed_database(db_session)
    admin_hdr = booking.tokens["admin"]

    res = await api_client.get("/api/v1/admin/services/export", headers=admin_hdr)
    assert res.status_code == 200
    catalog = res.json()["data"]
    assert "danh_muc" in catalog
    assert catalog["tong_so_dich_vu"] >= 10
    services = catalog["danh_muc"]
    assert any(s["ma_nhom_byt"] == "XN" for s in services)
    assert any(s["ma_nhom_byt"] in ["CDHA", "TDCN"] for s in services)


@pytest.mark.asyncio
async def test_admin_rbac_permission_protection(api_client: AsyncClient, booking):
    patient_hdr = booking.tokens["bn_a"]

    room_payload = {
        "ma_phong": "P999_TEST",
        "ten_phong": "Phòng Khám Xâm Nhập Test",
        "tang": "Tầng 9",
        "loai_phong": "kham_benh",
    }
    res_room = await api_client.post("/api/v1/admin/rooms", json=room_payload, headers=patient_hdr)
    assert res_room.status_code == 403

    dept_payload = {
        "ma_chuyen_khoa": "CK_UNAUTH",
        "ten_chuyen_khoa": "Khoa Không Hợp Lệ",
    }
    res_dept = await api_client.post("/api/v1/admin/departments", json=dept_payload, headers=patient_hdr)
    assert res_dept.status_code == 403


@pytest.mark.asyncio
async def test_seed_preserves_admin_modifications_across_restarts(db_session):
    await seed_database(db_session)

    stmt_room1 = select(PhongKham).where(PhongKham.ma_phong == "P101")
    room1 = (await db_session.execute(stmt_room1)).scalar_one()
    room1.ten_phong = "Phòng Khám Nội VIP Đã Đổi Tên"

    stmt_room2 = select(PhongKham).where(PhongKham.ma_phong == "P102")
    room2 = (await db_session.execute(stmt_room2)).scalar_one()
    room2.is_active = False

    stmt_svc = select(DichVu).where(DichVu.ma_dich_vu == "DV_KHAM_NOI")
    svc = (await db_session.execute(stmt_svc)).scalar_one()
    svc.don_gia = 350000.0

    stmt_doc = select(BacSi).where(BacSi.hoc_vi == "PGS.TS")
    doctor = (await db_session.execute(stmt_doc)).scalar_one()
    doctor.mo_ta_chuyen_sau = "Chuyên gia tim mạch hàng đầu bệnh viện"

    await db_session.flush()

    await seed_database(db_session)

    stmt_check_r1 = select(PhongKham).where(PhongKham.ma_phong == "P101")
    r1_after = (await db_session.execute(stmt_check_r1)).scalar_one()
    assert r1_after.ten_phong == "Phòng Khám Nội VIP Đã Đổi Tên"

    stmt_check_r2 = select(PhongKham).where(PhongKham.ma_phong == "P102")
    r2_after = (await db_session.execute(stmt_check_r2)).scalar_one()
    assert r2_after.is_active is False

    stmt_check_svc = select(DichVu).where(DichVu.ma_dich_vu == "DV_KHAM_NOI")
    svc_after = (await db_session.execute(stmt_check_svc)).scalar_one()
    assert float(svc_after.don_gia) == 350000.0

    stmt_check_doc = select(BacSi).where(BacSi.hoc_vi == "PGS.TS")
    doc_after = (await db_session.execute(stmt_check_doc)).scalar_one()
    assert doc_after.mo_ta_chuyen_sau == "Chuyên gia tim mạch hàng đầu bệnh viện"


@pytest.mark.asyncio
async def test_legacy_departments_are_deactivated(db_session):
    legacy_ck = ChuyenKhoa(
        ma_chuyen_khoa="KHOA_TIM_MACH",
        ten_chuyen_khoa="Tim mạch",
        mo_ta="Khoa tim mạch cũ",
        vi_tri_phong="Phòng 201 cũ",
        is_active=True,
    )
    db_session.add(legacy_ck)
    await db_session.flush()

    await seed_database(db_session)

    stmt_legacy = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == "KHOA_TIM_MACH")
    legacy_after = (await db_session.execute(stmt_legacy)).scalar_one()
    assert legacy_after.is_active is False

    stmt_active = select(ChuyenKhoa).where(ChuyenKhoa.is_active.is_(True))
    active_depts = (await db_session.execute(stmt_active)).scalars().all()
    active_codes = {d.ma_chuyen_khoa for d in active_depts}
    assert active_codes == {"KHOA_NOI", "KHOA_NGOAI", "KHOA_TMH", "KHOA_RANG", "KHOA_MAT"}


@pytest.mark.asyncio
async def test_legacy_shifts_backfill_missing_room(db_session):
    await seed_database(db_session)

    stmt_shift = select(LichLamViec).limit(1)
    shift = (await db_session.execute(stmt_shift)).scalar_one()
    doctor_id = shift.bac_si_id

    stmt_doc = select(BacSi).where(BacSi.id == doctor_id)
    doc = (await db_session.execute(stmt_doc)).scalar_one()
    assert doc.phong_kham_id is not None

    shift.phong_kham_id = None
    await db_session.flush()

    await seed_database(db_session)

    stmt_shift_after = select(LichLamViec).where(LichLamViec.id == shift.id)
    shift_after = (await db_session.execute(stmt_shift_after)).scalar_one()
    assert shift_after.phong_kham_id == doc.phong_kham_id


@pytest.mark.asyncio
async def test_production_environment_prevents_default_insecure_admin(db_session):
    orig_env = settings.ENVIRONMENT
    orig_debug = settings.DEBUG
    orig_pwd = settings.INITIAL_ADMIN_PASSWORD
    try:
        settings.ENVIRONMENT = "production"
        settings.DEBUG = False
        settings.INITIAL_ADMIN_PASSWORD = None

        await seed_database(db_session)

        stmt_admin = select(TaiKhoan).where(
            TaiKhoan.email == "admin@clinic.com",
            TaiKhoan.vai_tro == VaiTroEnum.ADMIN.value,
        )
        admin_account = (await db_session.execute(stmt_admin)).scalar_one_or_none()
        assert admin_account is None
    finally:
        settings.ENVIRONMENT = orig_env
        settings.DEBUG = orig_debug
        settings.INITIAL_ADMIN_PASSWORD = orig_pwd
