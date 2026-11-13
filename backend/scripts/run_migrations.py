import argparse
import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Optional, Sequence
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool

current_script_dir = Path(__file__).resolve().parent
backend_root_dir = current_script_dir.parent
if str(backend_root_dir) not in sys.path:
    sys.path.insert(0, str(backend_root_dir))

logger = logging.getLogger("migration_runner")

DEFAULT_ADVISORY_LOCK_KEY = 8241082026018
DEFAULT_EXPECTED_PREFIX = "018"


def get_default_config_path() -> Path:
    return backend_root_dir / "alembic.ini"


def get_default_database_url() -> str:
    if "DATABASE_URL" in os.environ and os.environ["DATABASE_URL"].strip():
        return os.environ["DATABASE_URL"].strip()
    from app.core.config import settings
    return settings.async_database_url


def validate_database_url(database_url: str) -> None:
    if not database_url or not database_url.strip():
        raise ValueError("Database URL cannot be empty")
    try:
        parsed_url = make_url(database_url.strip())
        backend_name = parsed_url.get_backend_name()
    except Exception:
        raise ValueError("Invalid database URL") from None

    if backend_name not in ("postgresql", "postgres"):
        raise ValueError(
            f"Deployment migrations require a PostgreSQL database URL, but got backend '{backend_name}'"
        )


def create_alembic_config(config_path: Path, database_url: Optional[str] = None) -> Config:
    resolved_path = config_path.resolve()
    if not resolved_path.is_file():
        raise FileNotFoundError(f"Alembic configuration file not found at: {resolved_path}")

    alembic_cfg = Config(str(resolved_path))
    script_location = resolved_path.parent / "alembic"
    alembic_cfg.set_main_option("script_location", str(script_location))

    if database_url:
        alembic_cfg.set_main_option("sqlalchemy.url", database_url)
        os.environ["DATABASE_URL"] = database_url

    return alembic_cfg


def get_repository_head_revision(alembic_cfg: Config, expected_prefix: Optional[str] = DEFAULT_EXPECTED_PREFIX) -> str:
    script_dir = ScriptDirectory.from_config(alembic_cfg)
    heads = script_dir.get_heads()

    if not heads:
        raise RuntimeError("No revision heads discovered in Alembic script directory")

    if len(heads) > 1:
        raise RuntimeError(f"Multiple revision heads discovered in Alembic script directory: {heads}")

    head_revision = heads[0]

    if expected_prefix and not head_revision.startswith(expected_prefix):
        raise RuntimeError(
            f"Repository head revision '{head_revision}' does not match expected prefix '{expected_prefix}'"
        )

    return head_revision


def execute_preflight_checks(
    config_path: Path,
    database_url: str,
    expected_prefix: Optional[str] = DEFAULT_EXPECTED_PREFIX,
) -> tuple[Config, str]:
    validate_database_url(database_url)

    alembic_cfg = create_alembic_config(config_path=config_path, database_url=database_url)

    versions_directory = config_path.resolve().parent / "alembic" / "versions"
    if not versions_directory.is_dir():
        raise FileNotFoundError(f"Alembic versions directory not found at: {versions_directory}")

    head_revision = get_repository_head_revision(alembic_cfg=alembic_cfg, expected_prefix=expected_prefix)
    return alembic_cfg, head_revision


async def check_database_connectivity(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


async def acquire_advisory_lock(
    conn: AsyncConnection,
    lock_key: int = DEFAULT_ADVISORY_LOCK_KEY,
    timeout_seconds: float = 60.0,
    retry_interval_seconds: float = 1.0,
) -> bool:
    if conn.dialect.name != "postgresql":
        logger.info("Non-PostgreSQL dialect '%s' detected; skipping advisory lock.", conn.dialect.name)
        return True

    start_time = time.monotonic()
    while True:
        result = await conn.execute(
            text("SELECT pg_try_advisory_lock(:lock_key)"),
            {"lock_key": lock_key},
        )
        lock_acquired = bool(result.scalar())
        if lock_acquired:
            logger.info("Acquired PostgreSQL advisory lock key %s successfully.", lock_key)
            return True

        elapsed = time.monotonic() - start_time
        if elapsed >= timeout_seconds:
            raise TimeoutError(
                f"Timed out after {timeout_seconds}s waiting for PostgreSQL advisory lock key {lock_key}."
            )

        logger.warning(
            "Advisory lock key %s is held by another process; retrying in %ss...",
            lock_key,
            retry_interval_seconds,
        )
        await asyncio.sleep(retry_interval_seconds)


async def release_advisory_lock(conn: AsyncConnection, lock_key: int = DEFAULT_ADVISORY_LOCK_KEY) -> bool:
    if conn.dialect.name != "postgresql":
        return True

    result = await conn.execute(
        text("SELECT pg_advisory_unlock(:lock_key)"),
        {"lock_key": lock_key},
    )
    unlocked = bool(result.scalar())
    logger.info("Released PostgreSQL advisory lock key %s: status=%s", lock_key, unlocked)
    return unlocked


@asynccontextmanager
async def migration_advisory_lock(
    conn: AsyncConnection,
    lock_key: int = DEFAULT_ADVISORY_LOCK_KEY,
    timeout_seconds: float = 60.0,
    retry_interval_seconds: float = 1.0,
) -> AsyncGenerator[bool, None]:
    await acquire_advisory_lock(
        conn=conn,
        lock_key=lock_key,
        timeout_seconds=timeout_seconds,
        retry_interval_seconds=retry_interval_seconds,
    )
    try:
        yield True
    finally:
        await release_advisory_lock(conn=conn, lock_key=lock_key)


def run_alembic_upgrade_sync(alembic_cfg: Config, target_revision: str = "head") -> None:
    logger.info("Executing alembic upgrade to target '%s'...", target_revision)
    command.upgrade(alembic_cfg, target_revision)
    logger.info("Alembic upgrade to target '%s' completed successfully.", target_revision)


async def verify_alembic_version_table(conn: AsyncConnection, expected_head: str) -> str:
    result = await conn.execute(text("SELECT version_num FROM alembic_version"))
    records = [row[0] for row in result.fetchall()]

    if not records:
        raise RuntimeError("Migration verification failed: alembic_version table contains no records")

    if len(records) > 1:
        raise RuntimeError(f"Migration verification failed: multiple versions found in alembic_version: {records}")

    current_version = records[0]
    if current_version != expected_head:
        raise RuntimeError(
            f"Migration verification failed: database version '{current_version}' does not match expected '{expected_head}'"
        )

    logger.info("Verified alembic_version matched current head revision: %s", current_version)
    return current_version


async def run_deployment_migrations(
    config_path: Optional[Path] = None,
    database_url: Optional[str] = None,
    lock_key: int = DEFAULT_ADVISORY_LOCK_KEY,
    lock_timeout_seconds: float = 60.0,
    retry_interval_seconds: float = 1.0,
    preflight_only: bool = False,
    target_revision: Optional[str] = None,
) -> str:
    target_config_path = (config_path or get_default_config_path()).resolve()
    target_database_url = database_url or get_default_database_url()

    validate_database_url(target_database_url)

    alembic_cfg, repo_head = execute_preflight_checks(
        config_path=target_config_path,
        database_url=target_database_url,
        expected_prefix=DEFAULT_EXPECTED_PREFIX,
    )

    resolved_target = repo_head if (target_revision is None or target_revision == "head") else target_revision

    if preflight_only:
        logger.info("Preflight checks passed successfully. Target revision: %s", resolved_target)
        return resolved_target

    engine = create_async_engine(target_database_url, poolclass=NullPool)
    try:
        await check_database_connectivity(engine)
        async with engine.connect() as lock_connection:
            if lock_connection.dialect.name != "postgresql":
                raise RuntimeError(
                    f"Deployment migrations require a PostgreSQL database connection, but got '{lock_connection.dialect.name}'"
                )
            async with migration_advisory_lock(
                conn=lock_connection,
                lock_key=lock_key,
                timeout_seconds=lock_timeout_seconds,
                retry_interval_seconds=retry_interval_seconds,
            ):
                await asyncio.to_thread(run_alembic_upgrade_sync, alembic_cfg, resolved_target)
                verified_version = await verify_alembic_version_table(
                    conn=lock_connection,
                    expected_head=resolved_target,
                )
                return verified_version
    finally:
        await engine.dispose()


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Independent deployment migration runner with preflight checks and advisory locking"
    )
    parser.add_argument(
        "--config",
        dest="config_path",
        type=Path,
        default=get_default_config_path(),
        help="Path to alembic.ini configuration file",
    )
    parser.add_argument(
        "--database-url",
        dest="database_url",
        type=str,
        default=None,
        help="Target database URL connection string",
    )
    parser.add_argument(
        "--lock-key",
        dest="lock_key",
        type=int,
        default=DEFAULT_ADVISORY_LOCK_KEY,
        help="PostgreSQL advisory lock key",
    )
    parser.add_argument(
        "--lock-timeout",
        dest="lock_timeout_seconds",
        type=float,
        default=60.0,
        help="Maximum seconds to wait for advisory lock",
    )
    parser.add_argument(
        "--retry-interval",
        dest="retry_interval_seconds",
        type=float,
        default=1.0,
        help="Retry interval in seconds when waiting for advisory lock",
    )
    parser.add_argument(
        "--target-revision",
        dest="target_revision",
        type=str,
        default=None,
        help="Expected migration head revision to verify",
    )
    parser.add_argument(
        "--preflight-only",
        dest="preflight_only",
        action="store_true",
        help="Run preflight validation checks without executing migrations",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    parser = build_argument_parser()
    args = parser.parse_args(argv)

    try:
        final_revision = asyncio.run(
            run_deployment_migrations(
                config_path=args.config_path,
                database_url=args.database_url,
                lock_key=args.lock_key,
                lock_timeout_seconds=args.lock_timeout_seconds,
                retry_interval_seconds=args.retry_interval_seconds,
                preflight_only=args.preflight_only,
                target_revision=args.target_revision,
            )
        )
        logger.info("Migration operation completed successfully at revision: %s", final_revision)
        return 0
    except Exception as exc:
        logger.error("Migration operation failed: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
