import os
import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.appointment import LichKham, TrangThaiLichEnum
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum

# ------------------------------------------------------------------------------
# Fixture dùng chung cho kiểm thử tích hợp trên PostgreSQL thật - rollback toàn bộ sau mỗi test
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
    # Service gọi commit() chỉ giải phóng SAVEPOINT; transaction ngoài vẫn được rollback khi kết thúc test
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


class Booking:
    """Dữ liệu mẫu cho luồng đặt/hủy lịch: 2 bệnh nhân, 2 bác sĩ, 1 admin và hàm tạo lịch hẹn"""

    def __init__(self, db, suffix):
        self.db = db
        self.suffix = suffix
        self.tokens = {}
        self._count = 0

    async def tao_tai_khoan(self, key, vai_tro):
        nguoi_dung = NguoiDung(ho_ten=f"Test {key} {self.suffix}", email=f"{key}.{self.suffix}@test.local")
        self.db.add(nguoi_dung)
        await self.db.flush()
        tai_khoan = TaiKhoan(
            nguoi_dung_id=nguoi_dung.id,
            email=nguoi_dung.email,
            mat_khau_hash="khong-dung-trong-test",
            vai_tro=vai_tro,
            is_active=True
        )
        self.db.add(tai_khoan)
        await self.db.flush()
        self.tokens[key] = {"Authorization": f"Bearer {create_access_token(subject=tai_khoan.id, role=vai_tro)}"}
        return nguoi_dung

    async def tao_lich(self, benh_nhan, bac_si, thoi_diem, trang_thai=TrangThaiLichEnum.CHO_XAC_NHAN.value):
        self._count += 1
        lich = LichKham(
            ma_lich_kham=f"LK-TEST-{self.suffix}-{self._count}",
            benh_nhan_id=benh_nhan.id,
            bac_si_id=bac_si.id,
            ngay_kham=thoi_diem.date(),
            gio_kham=thoi_diem.time().replace(microsecond=0),
            trang_thai=trang_thai
        )
        self.db.add(lich)
        await self.db.flush()
        return lich


@pytest_asyncio.fixture(loop_scope="function")
async def booking(db_session):
    data = Booking(db_session, uuid.uuid4().hex[:8])
    for key in ("bn_a", "bn_b"):
        nguoi_dung = await data.tao_tai_khoan(key, VaiTroEnum.BENH_NHAN.value)
        benh_nhan = BenhNhan(nguoi_dung_id=nguoi_dung.id, ma_dinh_danh_y_te=f"BN-TEST-{key}-{data.suffix}")
        db_session.add(benh_nhan)
        setattr(data, key, benh_nhan)
    for key in ("bs_x", "bs_y"):
        nguoi_dung = await data.tao_tai_khoan(key, VaiTroEnum.BAC_SI.value)
        bac_si = BacSi(nguoi_dung_id=nguoi_dung.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{key}-{data.suffix}")
        db_session.add(bac_si)
        setattr(data, key, bac_si)
    await data.tao_tai_khoan("admin", VaiTroEnum.ADMIN.value)
    await db_session.flush()
    return data
