import asyncio
import sqlite3
from app.core.database import engine
from app.models.base import Base
import app.models

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

if __name__ == "__main__":
    asyncio.run(main())
    conn = sqlite3.connect("clinic_local.db")
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()]
    print("Total tables in database:", len(tables))
    new_tables = [t for t in ["ho_so_nguoi_than", "thong_bao", "danh_gia_dich_vu"] if t in tables]
    print("New tables confirmed:", new_tables)
