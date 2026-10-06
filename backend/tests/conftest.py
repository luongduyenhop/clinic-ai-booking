import os
import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, or_
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
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


def _new_engine():
    return create_async_engine(settings.async_database_url, poolclass=NullPool, connect_args={"timeout": 5})


async def _connect_or_skip(engine):
    """Máy local chưa bật PostgreSQL thì bỏ qua (skip); trên CI bắt buộc phải kết nối được."""
    global _skip_integration_reason
    if _skip_integration_reason:
        pytest.skip(_skip_integration_reason)
    try:
        return await engine.connect()
    except Exception as exc:
        await engine.dispose()
        if os.getenv("CI"):
            raise
        _skip_integration_reason = f"Không kết nối được PostgreSQL, bỏ qua test tích hợp: {exc}"
        pytest.skip(_skip_integration_reason)


# Các fixture async ghim loop_scope="function" để chạy chung event loop với test: kết nối asyncpg không dùng
# chéo được giữa 2 loop (pytest.ini đặt asyncio_default_fixture_loop_scope = session cho fixture mặc định)
@pytest_asyncio.fixture(loop_scope="function")
async def db_session():
    """Phiên CSDL bọc trong 1 transaction được rollback khi kết thúc nên không để lại dữ liệu test."""
    engine = _new_engine()
    conn = await _connect_or_skip(engine)

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

    async def tao_lich(self, benh_nhan, bac_si, thoi_diem, trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value):
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


async def _seed_booking(db) -> Booking:
    data = Booking(db, uuid.uuid4().hex[:8])
    for key in ("bn_a", "bn_b"):
        nguoi_dung = await data.tao_tai_khoan(key, VaiTroEnum.BENH_NHAN.value)
        benh_nhan = BenhNhan(nguoi_dung_id=nguoi_dung.id, ma_dinh_danh_y_te=f"BN-TEST-{key}-{data.suffix}")
        db.add(benh_nhan)
        setattr(data, key, benh_nhan)
    for key in ("bs_x", "bs_y"):
        nguoi_dung = await data.tao_tai_khoan(key, VaiTroEnum.BAC_SI.value)
        bac_si = BacSi(nguoi_dung_id=nguoi_dung.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{key}-{data.suffix}")
        db.add(bac_si)
        setattr(data, key, bac_si)
    await data.tao_tai_khoan("admin", VaiTroEnum.ADMIN.value)
    await db.flush()
    return data


@pytest_asyncio.fixture(loop_scope="function")
async def booking(db_session):
    return await _seed_booking(db_session)


# ------------------------------------------------------------------------------
# Fixture cho kiểm thử khóa dòng SELECT FOR UPDATE (UC-B03): các request chạy song song trên nhiều kết nối
# riêng nên dữ liệu mẫu phải được COMMIT thật (transaction rollback ở trên không nhìn thấy được từ kết nối khác)
# ------------------------------------------------------------------------------

@pytest_asyncio.fixture(loop_scope="function")
async def committed_booking():
    """Dữ liệu mẫu giống fixture booking nhưng đã commit; data.session_factory mở phiên mới trên kết nối riêng.
    Tự xóa toàn bộ dữ liệu của test khi kết thúc (lọc theo hậu tố email riêng của lần chạy)."""
    engine = _new_engine()
    conn = await _connect_or_skip(engine)
    await conn.run_sync(Base.metadata.create_all)
    await conn.commit()
    await conn.close()

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        data = await _seed_booking(session)
        await session.commit()
    data.session_factory = session_factory

    try:
        yield data
    finally:
        async with engine.begin() as cleanup:
            bac_si_ids = [data.bs_x.id, data.bs_y.id]
            benh_nhan_ids = [data.bn_a.id, data.bn_b.id]
            # lich_kham tham chiếu RESTRICT nên xóa trước; ca làm việc/hồ sơ/tài khoản xóa theo CASCADE của nguoi_dung
            await cleanup.execute(delete(LichKham).where(
                or_(LichKham.bac_si_id.in_(bac_si_ids), LichKham.benh_nhan_id.in_(benh_nhan_ids))
            ))
            await cleanup.execute(delete(NguoiDung).where(NguoiDung.email.like(f"%.{data.suffix}@test.local")))
        await engine.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def concurrent_api_client(committed_booking):
    """HTTP client mà mỗi request có phiên CSDL riêng (như môi trường chạy thật) để các request song song
    tranh chấp khóa dòng thật sự trên PostgreSQL"""
    async def override_get_db():
        async with committed_booking.session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
            yield async_client
    finally:
        app.dependency_overrides.pop(get_db, None)
