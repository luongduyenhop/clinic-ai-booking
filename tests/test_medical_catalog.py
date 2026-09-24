import os
import uuid
import httpx
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.response import PaginationMeta
from app.main import app
from app.models.user import ChuyenKhoa, NguoiDung, BacSi

client = TestClient(app)
MEDICAL_API = f"{settings.API_V1_STR}/medical"


# ------------------------------------------------------------------------------
# 1. Kiểm thử không cần CSDL: validate tham số & công thức phân trang
# ------------------------------------------------------------------------------

def test_pagination_meta_calculation():
    """Kiểm tra công thức tính metadata phân trang"""
    first_page = PaginationMeta.create(page=1, page_size=2, total_items=3)
    assert first_page.total_pages == 2
    assert first_page.has_next is True
    assert first_page.has_prev is False

    last_page = PaginationMeta.create(page=2, page_size=2, total_items=3)
    assert last_page.has_next is False
    assert last_page.has_prev is True

    empty = PaginationMeta.create(page=1, page_size=10, total_items=0)
    assert empty.total_pages == 0
    assert empty.has_next is False
    assert empty.has_prev is False


@pytest.mark.parametrize(
    "path",
    [
        "/doctors?page=0",
        "/doctors?page_size=0",
        "/doctors?page_size=101",
        "/doctors?specialty_id=0",
        "/doctors?specialty_id=abc",
        "/academic-degrees?specialty_id=0",
    ],
)
def test_invalid_query_params_return_422(path):
    """Tham số lọc/phân trang sai phải bị chặn bằng Envelope lỗi 422 trước khi chạm tới CSDL"""
    response = client.get(f"{MEDICAL_API}{path}")
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["code"] == 422
    assert len(body["errors"]) > 0


# ------------------------------------------------------------------------------
# 2. Kiểm thử tích hợp trên PostgreSQL thật - rollback toàn bộ sau mỗi test
# ------------------------------------------------------------------------------

# Ghi nhớ lần kết nối thất bại đầu tiên để các test sau skip ngay, không phải chờ kết nối lại
_skip_integration_reason = None


# Các fixture async ghim loop_scope="function" để chạy chung event loop với test: kết nối asyncpg không dùng
# chéo được giữa 2 loop (pytest.ini đặt asyncio_default_fixture_loop_scope = session cho fixture mặc định)
@pytest_asyncio.fixture(loop_scope="function")
async def db_session():
    """Phiên CSDL bọc trong 1 transaction được rollback khi kết thúc nên không để lại dữ liệu test.
    Máy local chưa bật PostgreSQL thì bỏ qua (skip); trên CI bắt buộc phải kết nối được."""
    global _skip_integration_reason
    if _skip_integration_reason:
        pytest.skip(_skip_integration_reason)

    engine = create_async_engine(settings.async_database_url, poolclass=NullPool, connect_args={"timeout": 5})
    try:
        conn = await engine.connect()
    except Exception as exc:
        await engine.dispose()
        if os.getenv("CI"):
            raise
        _skip_integration_reason = f"Không kết nối được PostgreSQL, bỏ qua test tích hợp: {exc}"
        pytest.skip(_skip_integration_reason)

    transaction = await conn.begin()
    await conn.run_sync(Base.metadata.create_all)
    session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await conn.close()
        await engine.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def api_client(db_session):
    """HTTP client gọi thẳng vào app FastAPI, dùng chung phiên CSDL của test"""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
            yield async_client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture(loop_scope="function")
async def catalog(db_session):
    """Dữ liệu mẫu: khoa đang mở có 3 bác sĩ hiển thị + 1 nghỉ việc + 1 bị xóa hồ sơ,
    1 khoa đã đóng và 1 bác sĩ chưa gán khoa"""
    suffix = uuid.uuid4().hex[:8]
    khoa_mo = ChuyenKhoa(
        ma_chuyen_khoa=f"TEST_B01_{suffix}",
        ten_chuyen_khoa=f"Khoa Test B01 {suffix}",
        vi_tri_phong="Phòng T01"
    )
    khoa_dong = ChuyenKhoa(
        ma_chuyen_khoa=f"TEST_B01_OFF_{suffix}",
        ten_chuyen_khoa=f"Khoa Test B01 Đóng {suffix}",
        is_active=False
    )
    db_session.add_all([khoa_mo, khoa_dong])
    await db_session.flush()

    # Học vị riêng của lần chạy này, dùng để lọc khi không truyền chuyên khoa mà không lẫn dữ liệu có sẵn
    hoc_vi_rieng = f"TEST-{suffix}"
    bac_si_mau = {
        # key: (hoc_vi, chuyen_khoa, is_active, is_deleted)
        "a": ("ThS.BS", khoa_mo, True, False),
        "b": ("PGS.TS", khoa_mo, True, False),
        "c": ("ThS.BS", khoa_mo, True, False),
        "nghi_viec": ("BSCKI", khoa_mo, False, False),
        "da_xoa": ("BSCKI", khoa_mo, True, True),
        "khoa_dong": (hoc_vi_rieng, khoa_dong, True, False),
        "chua_gan_khoa": (hoc_vi_rieng, None, True, False),
    }
    bac_si_ids = {}
    for key, (hoc_vi, khoa, is_active, is_deleted) in bac_si_mau.items():
        nguoi_dung = NguoiDung(ho_ten=f"Test {key} {suffix}", email=f"{key}.{suffix}@test.local", is_deleted=is_deleted)
        db_session.add(nguoi_dung)
        await db_session.flush()

        bac_si = BacSi(
            nguoi_dung_id=nguoi_dung.id,
            chuyen_khoa_id=khoa.id if khoa else None,
            hoc_vi=hoc_vi,
            chung_chi_hanh_nghe=f"CCHN-{key}-{suffix}",
            is_active=is_active
        )
        db_session.add(bac_si)
        await db_session.flush()
        bac_si_ids[key] = bac_si.id

    return {"khoa_mo": khoa_mo, "khoa_dong": khoa_dong, "hoc_vi_rieng": hoc_vi_rieng, "bac_si": bac_si_ids}


async def _get_success(api_client: httpx.AsyncClient, path: str, params: dict = None) -> dict:
    """Gọi API danh mục và kiểm tra Envelope thành công"""
    response = await api_client.get(f"{MEDICAL_API}{path}", params=params)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    return body


async def test_specialties_only_active_with_doctor_count(api_client, catalog):
    """Chỉ trả về khoa đang hoạt động; số bác sĩ chỉ đếm người đang hành nghề và còn hồ sơ"""
    body = await _get_success(api_client, "/specialties")
    by_id = {item["id"]: item for item in body["data"]}

    assert catalog["khoa_dong"].id not in by_id
    khoa_mo = by_id[catalog["khoa_mo"].id]
    assert khoa_mo["ma_chuyen_khoa"] == catalog["khoa_mo"].ma_chuyen_khoa
    assert khoa_mo["vi_tri_phong"] == "Phòng T01"
    assert khoa_mo["so_luong_bac_si"] == 3


async def test_doctors_filter_by_specialty(api_client, catalog):
    """Lọc theo khoa: loại bác sĩ nghỉ việc/bị xóa hồ sơ và trả đủ thông tin hiển thị"""
    ids = catalog["bac_si"]
    body = await _get_success(api_client, "/doctors", {"specialty_id": catalog["khoa_mo"].id})

    assert [doctor["id"] for doctor in body["data"]] == [ids["a"], ids["b"], ids["c"]]
    assert body["meta"]["total_items"] == 3
    doctor = body["data"][0]
    assert doctor["chuyen_khoa_id"] == catalog["khoa_mo"].id
    assert doctor["chuyen_khoa"] == catalog["khoa_mo"].ten_chuyen_khoa
    assert doctor["vi_tri_phong"] == "Phòng T01"
    assert doctor["hoc_vi"] == "ThS.BS"
    assert doctor["gia_kham_mac_dinh"] == 200000.0


@pytest.mark.parametrize(
    "hoc_vi, expected_keys",
    [
        (["ThS.BS"], ["a", "c"]),
        (["ThS.BS", "PGS.TS"], ["a", "b", "c"]),
        (["BSCKI"], []),          # Học vị chỉ có ở bác sĩ nghỉ việc / bị xóa hồ sơ
        ([""], ["a", "b", "c"]),  # Client gửi ?hoc_vi= (chọn "Tất cả") -> bỏ qua bộ lọc
    ],
)
async def test_doctors_filter_by_hoc_vi(api_client, catalog, hoc_vi, expected_keys):
    """Lọc theo 1 hoặc nhiều học vị kết hợp với chuyên khoa"""
    body = await _get_success(api_client, "/doctors", {"specialty_id": catalog["khoa_mo"].id, "hoc_vi": hoc_vi})

    assert [doctor["id"] for doctor in body["data"]] == [catalog["bac_si"][key] for key in expected_keys]
    assert body["meta"]["total_items"] == len(expected_keys)


async def test_doctors_of_inactive_specialty_are_hidden(api_client, catalog):
    """Khoa đã đóng thì không trả về bác sĩ nào của khoa đó"""
    body = await _get_success(api_client, "/doctors", {"specialty_id": catalog["khoa_dong"].id})

    assert body["data"] == []
    assert body["meta"]["total_items"] == 0


async def test_doctor_without_specialty_uses_default_name(api_client, catalog):
    """Không lọc theo khoa: bác sĩ chưa gán khoa vẫn hiển thị, bác sĩ thuộc khoa đã đóng bị ẩn"""
    body = await _get_success(api_client, "/doctors", {"hoc_vi": catalog["hoc_vi_rieng"]})

    assert [doctor["id"] for doctor in body["data"]] == [catalog["bac_si"]["chua_gan_khoa"]]
    doctor = body["data"][0]
    assert doctor["chuyen_khoa_id"] is None
    assert doctor["chuyen_khoa"] == "Đa khoa"
    assert doctor["vi_tri_phong"] is None


async def test_doctors_pagination(api_client, catalog):
    """Phân trang ổn định, không trùng lặp giữa các trang và meta chính xác"""
    ids = catalog["bac_si"]
    params = {"specialty_id": catalog["khoa_mo"].id, "page_size": 2}

    page_1 = await _get_success(api_client, "/doctors", {**params, "page": 1})
    assert [doctor["id"] for doctor in page_1["data"]] == [ids["a"], ids["b"]]
    assert page_1["meta"] == {
        "page": 1,
        "page_size": 2,
        "total_items": 3,
        "total_pages": 2,
        "has_next": True,
        "has_prev": False,
    }

    page_2 = await _get_success(api_client, "/doctors", {**params, "page": 2})
    assert [doctor["id"] for doctor in page_2["data"]] == [ids["c"]]
    assert page_2["meta"]["has_next"] is False
    assert page_2["meta"]["has_prev"] is True


async def test_academic_degrees(api_client, catalog):
    """Danh mục học vị chỉ tính bác sĩ khả dụng và lọc được theo chuyên khoa"""
    body = await _get_success(api_client, "/academic-degrees", {"specialty_id": catalog["khoa_mo"].id})
    assert body["data"] == [
        {"hoc_vi": "PGS.TS", "so_luong_bac_si": 1},
        {"hoc_vi": "ThS.BS", "so_luong_bac_si": 2},
    ]

    body = await _get_success(api_client, "/academic-degrees")
    degrees = {item["hoc_vi"]: item["so_luong_bac_si"] for item in body["data"]}
    assert degrees[catalog["hoc_vi_rieng"]] == 1  # Bác sĩ thuộc khoa đã đóng không được tính
