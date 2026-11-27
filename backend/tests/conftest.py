import os
import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, or_
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.appointment import LichKham, TrangThaiLichEnum
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum

_postgres_unavailable = False


def _new_engine():
    return create_async_engine(settings.async_database_url, poolclass=NullPool, connect_args={"timeout": 2})


def _new_sqlite_engine():
    return create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


async def _connect_or_skip(engine):
    global _postgres_unavailable
    if _postgres_unavailable and not os.getenv("CI") and not settings.async_database_url.startswith("sqlite"):
        sqlite_engine = _new_sqlite_engine()
        conn = await sqlite_engine.connect()
        return conn, sqlite_engine
    try:
        conn = await engine.connect()
        return conn, engine
    except Exception:
        if os.getenv("CI"):
            raise
        _postgres_unavailable = True
        sqlite_engine = _new_sqlite_engine()
        conn = await sqlite_engine.connect()
        return conn, sqlite_engine


@pytest_asyncio.fixture(loop_scope="function")
async def db_session():
    engine = _new_engine()
    conn, actual_engine = await _connect_or_skip(engine)

    transaction = await conn.begin()
    await conn.run_sync(Base.metadata.create_all)
    session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await conn.close()
        await actual_engine.dispose()
        if actual_engine != engine:
            await engine.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def api_client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
            yield async_client
    finally:
        app.dependency_overrides.pop(get_db, None)


class Booking:
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


@pytest_asyncio.fixture(loop_scope="function")
async def committed_booking():
    engine = _new_engine()
    conn, actual_engine = await _connect_or_skip(engine)
    if actual_engine.dialect.name == "sqlite":
        await conn.close()
        await actual_engine.dispose()
        if actual_engine != engine:
            await engine.dispose()
        pytest.skip("Test khóa dòng PostgreSQL yêu cầu CSDL PostgreSQL thật, bỏ qua khi PostgreSQL offline.")
    await conn.run_sync(Base.metadata.create_all)
    await conn.commit()
    await conn.close()

    session_factory = async_sessionmaker(actual_engine, expire_on_commit=False)
    async with session_factory() as session:
        data = await _seed_booking(session)
        await session.commit()
    data.session_factory = session_factory

    try:
        yield data
    finally:
        async with actual_engine.begin() as cleanup:
            bac_si_ids = [data.bs_x.id, data.bs_y.id]
            benh_nhan_ids = [data.bn_a.id, data.bn_b.id]
            await cleanup.execute(delete(LichKham).where(
                or_(LichKham.bac_si_id.in_(bac_si_ids), LichKham.benh_nhan_id.in_(benh_nhan_ids))
            ))
            await cleanup.execute(delete(NguoiDung).where(NguoiDung.email.like(f"%.{data.suffix}@test.local")))
        await actual_engine.dispose()
        if actual_engine != engine:
            await engine.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def concurrent_api_client(committed_booking):
    async def override_get_db():
        async with committed_booking.session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
            yield async_client
    finally:
        app.dependency_overrides.pop(get_db, None)
