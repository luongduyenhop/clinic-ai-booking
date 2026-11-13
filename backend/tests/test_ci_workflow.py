from pathlib import Path
import pytest
import yaml
from scripts.run_migrations import (
    DEFAULT_EXPECTED_PREFIX,
    execute_preflight_checks,
    get_default_config_path,
)


def load_ci_workflow_payload() -> dict:
    workflow_path = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "ci.yml"
    assert workflow_path.is_file()
    with open(workflow_path, "r", encoding="utf-8") as file_stream:
        return yaml.safe_load(file_stream)


def test_ci_workflow_structure():
    payload = load_ci_workflow_payload()
    assert "jobs" in payload
    assert "backend-quality-and-test" in payload["jobs"]
    assert "frontend-quality-and-build" in payload["jobs"]


def test_ci_postgres_service_configuration():
    payload = load_ci_workflow_payload()
    backend_job = payload["jobs"]["backend-quality-and-test"]
    assert "services" in backend_job
    assert "postgres" in backend_job["services"]

    postgres_service = backend_job["services"]["postgres"]
    assert postgres_service["image"] == "postgres:15-alpine"
    assert "5432:5432" in postgres_service["ports"]

    env = postgres_service["env"]
    assert env["POSTGRES_DB"] == "clinic_ci_test_db"
    assert env["POSTGRES_DB"] != "clinic_db"
    assert env["POSTGRES_USER"] == "clinic_ci_user"
    assert env["POSTGRES_USER"] != "clinic_user"
    assert len(env["POSTGRES_PASSWORD"]) >= 16

    options = postgres_service["options"]
    assert "pg_isready" in options
    assert "-U clinic_ci_user" in options
    assert "-d clinic_ci_test_db" in options
    assert "--health-interval 10s" in options
    assert "--health-timeout 5s" in options
    assert "--health-retries 5" in options


def test_ci_backend_steps_order_and_commands():
    payload = load_ci_workflow_payload()
    backend_job = payload["jobs"]["backend-quality-and-test"]
    steps = backend_job["steps"]

    step_names = [step.get("name", "") for step in steps]
    migration_indices = [i for i, name in enumerate(step_names) if "Alembic" in name or "Di Chuyển" in name]
    pytest_indices = [i for i, name in enumerate(step_names) if "Pytest" in name or "Kiểm Thử Tự Động" in name]

    assert len(migration_indices) == 1
    assert len(pytest_indices) == 1
    assert migration_indices[0] < pytest_indices[0]

    migration_step = steps[migration_indices[0]]
    migration_run = migration_step["run"]
    assert "python scripts/run_migrations.py --target-revision head" in migration_run
    assert "alembic upgrade head" in migration_run
    assert "alembic current" in migration_run

    migration_env = migration_step["env"]
    expected_db_url = "postgresql+asyncpg://clinic_ci_user:clinic_ci_test_password_2026@localhost:5432/clinic_ci_test_db"
    assert migration_env["DATABASE_URL"] == expected_db_url
    assert len(migration_env["SECRET_KEY"]) >= 32
    assert len(migration_env["PAYMENT_WEBHOOK_SECRET"]) >= 32
    assert migration_env["ENVIRONMENT"] == "test"
    assert migration_env["DEBUG"] == "False"

    pytest_step = steps[pytest_indices[0]]
    pytest_env = pytest_step["env"]
    assert pytest_env["DATABASE_URL"] == expected_db_url
    assert len(pytest_env["SECRET_KEY"]) >= 32
    assert len(pytest_env["PAYMENT_WEBHOOK_SECRET"]) >= 32
    assert pytest_env["DEBUG"] == "False"


def test_ci_frontend_steps_preserved():
    payload = load_ci_workflow_payload()
    frontend_job = payload["jobs"]["frontend-quality-and-build"]
    steps = frontend_job["steps"]

    step_commands = [step.get("run", "") for step in steps]
    assert any("npm ci" in cmd for cmd in step_commands)
    assert any("npm run lint" in cmd for cmd in step_commands)
    assert any("npm test" in cmd for cmd in step_commands)
    assert any("npm run build" in cmd for cmd in step_commands)


def test_safe_local_preflight_validation_with_ci_db_url():
    ci_db_url = "postgresql+asyncpg://clinic_ci_user:clinic_ci_test_password_2026@localhost:5432/clinic_ci_test_db"
    config_path = get_default_config_path()
    alembic_cfg, head_revision = execute_preflight_checks(
        config_path=config_path,
        database_url=ci_db_url,
        expected_prefix=DEFAULT_EXPECTED_PREFIX,
    )
    assert head_revision == "018_production_3nf_schema_and_clean_bff"
    assert alembic_cfg.get_main_option("sqlalchemy.url") == ci_db_url
