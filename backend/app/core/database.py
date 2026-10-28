import socket
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


from sqlalchemy.engine import make_url


def _resolve_active_database_url() -> tuple[str, bool]:
    """Kiểm tra kết nối PostgreSQL; nếu dịch vụ PostgreSQL/Docker chưa bật thì tự động dùng SQLite bền vững"""
    url = settings.async_database_url
    if url.startswith("sqlite"):
        return url, True
    try:
        parsed = make_url(url)
        host = parsed.host or settings.POSTGRES_SERVER or "localhost"
        port = parsed.port or int(settings.POSTGRES_PORT or 5432)
        with socket.create_connection((host, port), timeout=2.0):
            return url, False
    except OSError:
        sqlite_path = (Path(__file__).resolve().parents[2] / "clinic_local.db").as_posix()
        return f"sqlite+aiosqlite:///{sqlite_path}", True


_active_url, _is_sqlite = _resolve_active_database_url()

if _is_sqlite:
    engine = create_async_engine(
        _active_url,
        echo=False,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_async_engine(
        _active_url,
        echo=settings.DEBUG,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
