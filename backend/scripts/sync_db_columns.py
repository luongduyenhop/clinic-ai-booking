import asyncio
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.core.database import Base
import app.models  # load all models

async def sync():
    engine = create_async_engine(settings.async_database_url)
    
    # 1. Create all missing tables first
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # 2. Check for missing columns across all tables and add them
    async with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            # Get existing column names
            res = await conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
                {"t": table_name}
            )
            existing_cols = {row[0] for row in res.fetchall()}
            if not existing_cols:
                continue
                
            for col in table.columns:
                if col.name not in existing_cols:
                    col_type = col.type.compile(engine.dialect)
                    null_clause = "NULL" if col.nullable else "NULL" # safe default
                    default_clause = ""
                    if col.server_default is not None:
                        default_clause = f"DEFAULT {col.server_default.arg}"
                    
                    sql = f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{col.name}" {col_type} {default_clause} {null_clause}'
                    print(f"Adding column: {sql}")
                    await conn.execute(text(sql))
                    
    print("Schema column sync completed successfully.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(sync())
