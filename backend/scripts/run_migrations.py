import asyncio
from pathlib import Path
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import settings
DEPLOYMENT_LOCK = 8241082026018
DEMO_SCHEMA_COMMENT = "clinic-ai-dedicated-demo"
def require_demo_database(connection: Connection) -> None:
    marker = connection.scalar(text("SELECT obj_description(to_regclass('alembic_version'), 'pg_class')"))
    if marker != DEMO_SCHEMA_COMMENT:
        raise RuntimeError("This PostgreSQL database was not initialized as a dedicated demo database")
def upgrade(connection: Connection) -> str:
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    config.attributes["connection"] = connection
    head = ScriptDirectory.from_config(config).get_current_head()
    if head is None:
        raise RuntimeError("No repository migration head was found")
    migration = MigrationContext.configure(connection)
    if migration.get_current_revision() is None:
        inspector = inspect(connection)
        has_existing_data = (
            set(inspector.get_table_names()) - {"alembic_version"}
            or inspector.get_view_names()
            or inspector.get_materialized_view_names()
        )
        if has_existing_data:
            raise RuntimeError("Cannot bootstrap a nonempty database without an Alembic revision")
        if not settings.is_demo:
            raise RuntimeError("Empty-database initialization is available only in demo mode")
        import app.models              
        import app.models.content              
        from app.core.database import Base
        from app.models.bff_store import HeThongTrangThaiBff              
        Base.metadata.create_all(connection)
        command.stamp(config, head)
        connection.execute(text("COMMENT ON TABLE alembic_version IS 'clinic-ai-dedicated-demo'"))
    else:
        if settings.is_demo:
            require_demo_database(connection)
        command.upgrade(config, "head")
    if migration.get_current_revision() != head:
        raise RuntimeError("Database revision does not match the repository head")
    return head
async def run_migrations() -> str:
    database_url = make_url(settings.async_database_url)
    if database_url.drivername != "postgresql+asyncpg":
        raise RuntimeError("Deployment migrations require a PostgreSQL asyncpg connection")
    engine = create_async_engine(database_url, poolclass=NullPool)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("SET LOCAL lock_timeout = '60s'"))
            await connection.execute(text("SELECT pg_advisory_xact_lock(:lock)"), {"lock": DEPLOYMENT_LOCK})
            return await connection.run_sync(upgrade)
    finally:
        await engine.dispose()
if __name__ == "__main__":
    print(f"Database migrated to {asyncio.run(run_migrations())}")
