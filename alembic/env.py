"""
alembic/env.py
Đây là "bộ não" của Alembic - giống như .git/config trong Git.
Nhiệm vụ: kết nối Alembic với PostgreSQL và import toàn bộ Models để
Alembic có thể so sánh schema thật với schema trong code (autogenerate).
"""
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ──────────────────────────────────────────────────────────────────────────────
# 1. Đọc cấu hình từ alembic.ini
# ──────────────────────────────────────────────────────────────────────────────
config = context.config

# Cấu hình logging từ alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ──────────────────────────────────────────────────────────────────────────────
# 2. Import Base và TẤT CẢ Models để Alembic "nhìn thấy" các bảng
#    (nếu không import model, Alembic sẽ không phát hiện bảng mới khi autogenerate)
# ──────────────────────────────────────────────────────────────────────────────
from app.core.database import Base          # noqa: E402
import app.models.user                      # noqa: E402, F401 - NguoiDung, TaiKhoan, BenhNhan, BacSi
import app.models.appointment               # noqa: E402, F401 - LichLamViec, LichKham
import app.models.medical                   # noqa: E402, F401 - TuKhoaCapCuu, DichVu, LuotKham...

target_metadata = Base.metadata

# ──────────────────────────────────────────────────────────────────────────────
# 3. Lấy DATABASE_URL từ settings của ứng dụng (không hardcode password vào đây)
# ──────────────────────────────────────────────────────────────────────────────
from app.core.config import settings        # noqa: E402

# Alembic cần URL dạng SYNC (psycopg2/psycopg), không phải asyncpg
# Vì Alembic tự quản lý kết nối riêng khi chạy migration
config.set_main_option("sqlalchemy.url", settings.sync_database_url)


# ──────────────────────────────────────────────────────────────────────────────
# 4. Chế độ OFFLINE - tạo SQL script mà không cần kết nối DB
#    Hữu ích khi: xem trước migration, gửi cho DBA review
# ──────────────────────────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """Tạo migration script dưới dạng SQL thuần, không kết nối DB."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ──────────────────────────────────────────────────────────────────────────────
# 5. Chế độ ONLINE - kết nối DB thật và chạy migration
#    Đây là chế độ dùng trong CI/CD và deploy thực tế
# ──────────────────────────────────────────────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # compare_type=True: phát hiện cả thay đổi kiểu dữ liệu (VD: VARCHAR(50) -> VARCHAR(100))
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Chạy migration trên async engine (asyncpg) để tương thích với codebase."""
    # Tạm thời dùng NullPool để tránh giữ kết nối sau khi migration xong
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point cho migration online - được gọi bởi lệnh `alembic upgrade head`."""
    asyncio.run(run_async_migrations())


# ──────────────────────────────────────────────────────────────────────────────
# 6. Quyết định chạy offline hay online tùy theo context
# ──────────────────────────────────────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
