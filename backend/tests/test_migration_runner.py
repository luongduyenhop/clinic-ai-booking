import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from scripts.run_migrations import (
    acquire_advisory_lock,
    build_argument_parser,
    execute_preflight_checks,
    get_default_config_path,
    get_default_database_url,
    get_repository_head_revision,
    main,
    migration_advisory_lock,
    release_advisory_lock,
    run_deployment_migrations,
    validate_database_url,
    verify_alembic_version_table,
)


def test_get_default_config_path_exists():
    config_path = get_default_config_path()
    assert config_path.is_file()
    assert config_path.name == "alembic.ini"


def test_validate_database_url_valid_schemes():
    valid_urls = [
        "postgresql+asyncpg://clinic_user:clinic_password@localhost:5432/clinic_db",
        "postgresql://clinic_user:clinic_password@localhost:5432/clinic_db",
        "postgres://clinic_user:clinic_password@localhost:5432/clinic_db",
    ]
    for url in valid_urls:
        validate_database_url(url)


def test_validate_database_url_invalid_schemes():
    invalid_urls = [
        "sqlite+aiosqlite:///:memory:",
        "sqlite:///:memory:",
        "mysql+pymysql://root@localhost/clinic_db",
        "mariadb+mariadbconnector://root@localhost/clinic_db",
        "not_a_valid_url_string",
    ]
    for url in invalid_urls:
        with pytest.raises(ValueError):
            validate_database_url(url)


def test_validate_database_url_does_not_leak_credentials():
    sentinel_password = "sentinel_secret_password_123"
    url_with_sentinel = f"postgresql://admin:{sentinel_password}@invalid:port/db"
    with pytest.raises(ValueError) as exc_info:
        validate_database_url(url_with_sentinel)
    error_message = str(exc_info.value)
    assert sentinel_password not in error_message
    assert sentinel_password not in repr(exc_info.value)
    assert error_message == "Invalid database URL"


def test_execute_preflight_checks_success():
    config_path = get_default_config_path()
    database_url = "postgresql+asyncpg://clinic_user:clinic_password@localhost:5432/clinic_db"
    alembic_cfg, head_revision = execute_preflight_checks(
        config_path=config_path,
        database_url=database_url,
        expected_prefix="018",
    )
    assert head_revision == "018_production_3nf_schema_and_clean_bff"
    assert alembic_cfg.get_main_option("script_location") is not None


def test_execute_preflight_checks_missing_config():
    missing_path = Path("non_existent_directory") / "alembic.ini"
    database_url = "postgresql+asyncpg://clinic_user:clinic_password@localhost:5432/clinic_db"
    with pytest.raises(FileNotFoundError):
        execute_preflight_checks(
            config_path=missing_path,
            database_url=database_url,
            expected_prefix="018",
        )


def test_execute_preflight_checks_empty_database_url():
    config_path = get_default_config_path()
    with pytest.raises(ValueError):
        execute_preflight_checks(
            config_path=config_path,
            database_url="",
            expected_prefix="018",
        )


def test_execute_preflight_checks_rejects_non_postgresql():
    config_path = get_default_config_path()
    with pytest.raises(ValueError, match="PostgreSQL"):
        execute_preflight_checks(
            config_path=config_path,
            database_url="sqlite+aiosqlite:///:memory:",
            expected_prefix="018",
        )


def test_execute_preflight_checks_mismatched_head_prefix():
    config_path = get_default_config_path()
    database_url = "postgresql+asyncpg://clinic_user:clinic_password@localhost:5432/clinic_db"
    with pytest.raises(RuntimeError):
        execute_preflight_checks(
            config_path=config_path,
            database_url=database_url,
            expected_prefix="999",
        )


def test_get_repository_head_revision_no_heads():
    mock_cfg = MagicMock()
    with patch("scripts.run_migrations.ScriptDirectory.from_config") as mock_from_config:
        mock_script_dir = MagicMock()
        mock_script_dir.get_heads.return_value = []
        mock_from_config.return_value = mock_script_dir
        with pytest.raises(RuntimeError):
            get_repository_head_revision(mock_cfg)


def test_get_repository_head_revision_multiple_heads():
    mock_cfg = MagicMock()
    with patch("scripts.run_migrations.ScriptDirectory.from_config") as mock_from_config:
        mock_script_dir = MagicMock()
        mock_script_dir.get_heads.return_value = ["018_head_a", "018_head_b"]
        mock_from_config.return_value = mock_script_dir
        with pytest.raises(RuntimeError):
            get_repository_head_revision(mock_cfg)


@pytest.mark.asyncio
async def test_acquire_advisory_lock_postgresql_success():
    mock_conn = AsyncMock()
    mock_conn.dialect.name = "postgresql"
    mock_result = MagicMock()
    mock_result.scalar.return_value = True
    mock_conn.execute.return_value = mock_result

    acquired = await acquire_advisory_lock(
        conn=mock_conn,
        lock_key=12345,
        timeout_seconds=5.0,
        retry_interval_seconds=0.1,
    )
    assert acquired is True
    assert mock_conn.execute.await_count == 1


@pytest.mark.asyncio
async def test_acquire_advisory_lock_postgresql_timeout():
    mock_conn = AsyncMock()
    mock_conn.dialect.name = "postgresql"
    mock_result = MagicMock()
    mock_result.scalar.return_value = False
    mock_conn.execute.return_value = mock_result

    with pytest.raises(TimeoutError):
        await acquire_advisory_lock(
            conn=mock_conn,
            lock_key=12345,
            timeout_seconds=0.1,
            retry_interval_seconds=0.05,
        )


@pytest.mark.asyncio
async def test_release_advisory_lock_postgresql():
    mock_conn = AsyncMock()
    mock_conn.dialect.name = "postgresql"
    mock_result = MagicMock()
    mock_result.scalar.return_value = True
    mock_conn.execute.return_value = mock_result

    released = await release_advisory_lock(conn=mock_conn, lock_key=12345)
    assert released is True
    assert mock_conn.execute.await_count == 1


@pytest.mark.asyncio
async def test_advisory_lock_non_postgresql_skipped():
    mock_conn = AsyncMock()
    mock_conn.dialect.name = "sqlite"

    acquired = await acquire_advisory_lock(conn=mock_conn, lock_key=12345)
    released = await release_advisory_lock(conn=mock_conn, lock_key=12345)
    assert acquired is True
    assert released is True
    assert mock_conn.execute.await_count == 0


@pytest.mark.asyncio
async def test_migration_advisory_lock_context_manager():
    mock_conn = AsyncMock()
    mock_conn.dialect.name = "postgresql"
    mock_result = MagicMock()
    mock_result.scalar.return_value = True
    mock_conn.execute.return_value = mock_result

    async with migration_advisory_lock(conn=mock_conn, lock_key=98765):
        pass

    assert mock_conn.execute.await_count == 2


@pytest.mark.asyncio
async def test_migration_advisory_lock_releases_on_error():
    mock_conn = AsyncMock()
    mock_conn.dialect.name = "postgresql"
    mock_result = MagicMock()
    mock_result.scalar.return_value = True
    mock_conn.execute.return_value = mock_result

    with pytest.raises(ValueError):
        async with migration_advisory_lock(conn=mock_conn, lock_key=98765):
            raise ValueError("simulated migration failure")

    assert mock_conn.execute.await_count == 2


@pytest.mark.asyncio
async def test_verify_alembic_version_table_success():
    mock_conn = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [("018_production_3nf_schema_and_clean_bff",)]
    mock_conn.execute.return_value = mock_result

    verified = await verify_alembic_version_table(
        conn=mock_conn,
        expected_head="018_production_3nf_schema_and_clean_bff",
    )
    assert verified == "018_production_3nf_schema_and_clean_bff"


@pytest.mark.asyncio
async def test_verify_alembic_version_table_empty():
    mock_conn = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = []
    mock_conn.execute.return_value = mock_result

    with pytest.raises(RuntimeError, match="contains no records"):
        await verify_alembic_version_table(
            conn=mock_conn,
            expected_head="018_production_3nf_schema_and_clean_bff",
        )


@pytest.mark.asyncio
async def test_verify_alembic_version_table_multiple_versions():
    mock_conn = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [("018_rev",), ("017_rev",)]
    mock_conn.execute.return_value = mock_result

    with pytest.raises(RuntimeError, match="multiple versions"):
        await verify_alembic_version_table(
            conn=mock_conn,
            expected_head="018_rev",
        )


@pytest.mark.asyncio
async def test_verify_alembic_version_table_mismatch():
    mock_conn = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [("017_old_rev",)]
    mock_conn.execute.return_value = mock_result

    with pytest.raises(RuntimeError, match="does not match expected"):
        await verify_alembic_version_table(
            conn=mock_conn,
            expected_head="018_production_3nf_schema_and_clean_bff",
        )


@pytest.mark.asyncio
async def test_run_deployment_migrations_preflight_only():
    revision = await run_deployment_migrations(preflight_only=True)
    assert revision == "018_production_3nf_schema_and_clean_bff"


@pytest.mark.asyncio
async def test_run_deployment_migrations_rejects_non_postgresql_url():
    with pytest.raises(ValueError, match="PostgreSQL"):
        await run_deployment_migrations(
            database_url="sqlite+aiosqlite:///:memory:",
            preflight_only=False,
        )


@pytest.mark.asyncio
async def test_run_deployment_migrations_full_mocked_flow():
    with patch("scripts.run_migrations.create_async_engine") as mock_create_engine, \
         patch("scripts.run_migrations.check_database_connectivity", new_callable=AsyncMock) as mock_conn_check, \
         patch("scripts.run_migrations.run_alembic_upgrade_sync") as mock_upgrade_sync, \
         patch("scripts.run_migrations.verify_alembic_version_table", new_callable=AsyncMock) as mock_verify:

        mock_engine = MagicMock()
        mock_engine.dispose = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.dialect.name = "postgresql"
        mock_lock_res = MagicMock()
        mock_lock_res.scalar.return_value = True
        mock_conn.execute.return_value = mock_lock_res

        mock_engine.connect.return_value.__aenter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine
        mock_verify.return_value = "018_production_3nf_schema_and_clean_bff"

        result = await run_deployment_migrations(
            database_url="postgresql+asyncpg://test:test@localhost/testdb",
            preflight_only=False,
        )

        assert result == "018_production_3nf_schema_and_clean_bff"
        assert mock_conn_check.await_count == 1
        assert mock_upgrade_sync.call_args[0][1] == "018_production_3nf_schema_and_clean_bff"
        assert mock_verify.await_count == 1
        assert mock_engine.dispose.await_count == 1


@pytest.mark.asyncio
async def test_run_deployment_migrations_passes_resolved_target_revision():
    with patch("scripts.run_migrations.create_async_engine") as mock_create_engine, \
         patch("scripts.run_migrations.check_database_connectivity", new_callable=AsyncMock), \
         patch("scripts.run_migrations.run_alembic_upgrade_sync") as mock_upgrade_sync, \
         patch("scripts.run_migrations.verify_alembic_version_table", new_callable=AsyncMock) as mock_verify:

        mock_engine = MagicMock()
        mock_engine.dispose = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.dialect.name = "postgresql"
        mock_lock_res = MagicMock()
        mock_lock_res.scalar.return_value = True
        mock_conn.execute.return_value = mock_lock_res

        mock_engine.connect.return_value.__aenter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine
        mock_verify.return_value = "018_custom_head_revision"

        result = await run_deployment_migrations(
            database_url="postgresql+asyncpg://test:test@localhost/testdb",
            preflight_only=False,
            target_revision="018_custom_head_revision",
        )

        assert result == "018_custom_head_revision"
        assert mock_upgrade_sync.call_args[0][1] == "018_custom_head_revision"
        mock_verify.assert_awaited_once_with(
            conn=mock_conn,
            expected_head="018_custom_head_revision",
        )


@pytest.mark.asyncio
async def test_run_deployment_migrations_resolves_head_keyword():
    with patch("scripts.run_migrations.create_async_engine") as mock_create_engine, \
         patch("scripts.run_migrations.check_database_connectivity", new_callable=AsyncMock), \
         patch("scripts.run_migrations.run_alembic_upgrade_sync") as mock_upgrade_sync, \
         patch("scripts.run_migrations.verify_alembic_version_table", new_callable=AsyncMock) as mock_verify:

        mock_engine = MagicMock()
        mock_engine.dispose = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.dialect.name = "postgresql"
        mock_lock_res = MagicMock()
        mock_lock_res.scalar.return_value = True
        mock_conn.execute.return_value = mock_lock_res

        mock_engine.connect.return_value.__aenter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine
        mock_verify.return_value = "018_production_3nf_schema_and_clean_bff"

        result = await run_deployment_migrations(
            database_url="postgresql+asyncpg://test:test@localhost/testdb",
            preflight_only=False,
            target_revision="head",
        )

        assert result == "018_production_3nf_schema_and_clean_bff"
        assert mock_upgrade_sync.call_args[0][1] == "018_production_3nf_schema_and_clean_bff"
        mock_verify.assert_awaited_once_with(
            conn=mock_conn,
            expected_head="018_production_3nf_schema_and_clean_bff",
        )


@pytest.mark.asyncio
async def test_run_deployment_migrations_rejects_non_postgresql_connection():
    with patch("scripts.run_migrations.create_async_engine") as mock_create_engine, \
         patch("scripts.run_migrations.check_database_connectivity", new_callable=AsyncMock), \
         patch("scripts.run_migrations.run_alembic_upgrade_sync") as mock_upgrade_sync:

        mock_engine = MagicMock()
        mock_engine.dispose = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.dialect.name = "sqlite"

        mock_engine.connect.return_value.__aenter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine

        with pytest.raises(RuntimeError, match="PostgreSQL"):
            await run_deployment_migrations(
                database_url="postgresql+asyncpg://test:test@localhost/testdb",
                preflight_only=False,
            )

        assert not mock_upgrade_sync.called
        assert mock_engine.dispose.await_count == 1


def test_get_default_database_url_from_env():
    with patch.dict(os.environ, {"DATABASE_URL": "postgresql+asyncpg://custom_host:5432/custom_db"}):
        assert get_default_database_url() == "postgresql+asyncpg://custom_host:5432/custom_db"


def test_no_dummy_secrets_injected_by_runner():
    assert os.environ.get("SECRET_KEY") != "migration_runner_temporary_secret_key_32chars"
    assert os.environ.get("PAYMENT_WEBHOOK_SECRET") != "migration_runner_temporary_webhook_secret_32chars"


def test_build_argument_parser():
    parser = build_argument_parser()
    args = parser.parse_args(["--preflight-only", "--lock-timeout", "45.0"])
    assert args.preflight_only is True
    assert args.lock_timeout_seconds == 45.0
    assert args.lock_key == 8241082026018


def test_main_cli_success():
    exit_code = main(["--preflight-only"])
    assert exit_code == 0


def test_main_cli_failure_on_invalid_config():
    exit_code = main(["--config", "invalid_non_existent.ini", "--preflight-only"])
    assert exit_code == 1


def test_main_cli_does_not_log_database_url_credentials(caplog):
    sentinel_password = "cli_sentinel_secret_password_456"
    url_with_sentinel = f"postgresql://admin:{sentinel_password}@invalid:port/db"
    exit_code = main(["--database-url", url_with_sentinel, "--preflight-only"])
    assert exit_code == 1
    assert sentinel_password not in caplog.text
