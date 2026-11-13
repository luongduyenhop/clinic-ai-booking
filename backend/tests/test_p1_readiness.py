from pathlib import Path
from unittest.mock import AsyncMock, patch
import pytest
import yaml
from fastapi import FastAPI, Response, status
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.core.config import Settings, settings
from app.core.database import engine
from app.core.exceptions import setup_exception_handlers
from app.core.response import ResponseEnvelope
from app.main import app

client = TestClient(app)


def test_cors_allowlist_allowed_origin():
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET"
    }
    response = client.options("/health", headers=headers)
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_rejects_untrusted_origin_preflight():
    headers = {
        "Origin": "http://untrusted-domain.com",
        "Access-Control-Request-Method": "GET"
    }
    response = client.options("/health", headers=headers)
    assert "access-control-allow-origin" not in response.headers


def test_cors_rejects_untrusted_origin_get():
    headers = {
        "Origin": "http://untrusted-domain.com"
    }
    response = client.get("/health", headers=headers)
    assert "access-control-allow-origin" not in response.headers


def test_cors_config_wildcard_rejected():
    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="test_secret_key_minimum_32_characters_long",
            PAYMENT_WEBHOOK_SECRET="test_webhook_secret_minimum_32_characters_long",
            BACKEND_CORS_ORIGINS=["*"]
        )

    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="test_secret_key_minimum_32_characters_long",
            PAYMENT_WEBHOOK_SECRET="test_webhook_secret_minimum_32_characters_long",
            BACKEND_CORS_ORIGINS="*"
        )

    with pytest.raises(ValidationError):
        Settings(
            SECRET_KEY="test_secret_key_minimum_32_characters_long",
            PAYMENT_WEBHOOK_SECRET="test_webhook_secret_minimum_32_characters_long",
            BACKEND_CORS_ORIGINS="http://localhost:3000,*"
        )


def test_cors_config_parsing_formats():
    settings_from_csv = Settings(
        SECRET_KEY="test_secret_key_minimum_32_characters_long",
        PAYMENT_WEBHOOK_SECRET="test_webhook_secret_minimum_32_characters_long",
        BACKEND_CORS_ORIGINS="http://localhost:3000, http://127.0.0.1:3000/"
    )
    assert settings_from_csv.BACKEND_CORS_ORIGINS == [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    settings_from_json = Settings(
        SECRET_KEY="test_secret_key_minimum_32_characters_long",
        PAYMENT_WEBHOOK_SECRET="test_webhook_secret_minimum_32_characters_long",
        BACKEND_CORS_ORIGINS='["http://localhost:3000", "http://127.0.0.1:3000"]'
    )
    assert settings_from_json.BACKEND_CORS_ORIGINS == [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]


def test_cors_config_env_compose_exact_value(monkeypatch):
    monkeypatch.setenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    custom_settings = Settings(
        _env_file=None,
        SECRET_KEY="test_secret_key_minimum_32_characters_long",
        PAYMENT_WEBHOOK_SECRET="test_webhook_secret_minimum_32_characters_long"
    )
    assert custom_settings.BACKEND_CORS_ORIGINS == [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    assert isinstance(custom_settings.BACKEND_CORS_ORIGINS, list)


def test_cors_config_env_wildcard_rejected(monkeypatch):
    monkeypatch.setenv("BACKEND_CORS_ORIGINS", "*")
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            SECRET_KEY="test_secret_key_minimum_32_characters_long",
            PAYMENT_WEBHOOK_SECRET="test_webhook_secret_minimum_32_characters_long"
        )

    monkeypatch.setenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,*")
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            SECRET_KEY="test_secret_key_minimum_32_characters_long",
            PAYMENT_WEBHOOK_SECRET="test_webhook_secret_minimum_32_characters_long"
        )


def test_debug_mode_default_is_false():
    assert settings.DEBUG is False


def test_debug_mode_redacts_server_errors():
    test_app = FastAPI()
    setup_exception_handlers(test_app)

    @test_app.get("/trigger-error")
    def trigger_error():
        raise RuntimeError("Internal database password secret leak test")

    test_app.debug = False
    prod_client = TestClient(test_app, raise_server_exceptions=False)
    prod_response = prod_client.get("/trigger-error")
    assert prod_response.status_code == 500
    prod_body = prod_response.json()
    assert prod_body["success"] is False
    assert prod_body["code"] == 500
    assert prod_body["errors"] == []
    assert "Internal database password" not in str(prod_body)

    test_app.debug = True
    dev_client = TestClient(test_app, raise_server_exceptions=False)
    dev_response = dev_client.get("/trigger-error")
    assert dev_response.status_code == 500
    dev_body = dev_response.json()
    assert len(dev_body["errors"]) > 0
    assert "Internal database password" in dev_body["errors"][0]["detail"]


def test_compose_no_published_postgres_port_in_production():
    root_compose_path = Path(__file__).resolve().parents[2] / "docker-compose.yml"
    with open(root_compose_path, "r", encoding="utf-8") as f:
        root_compose = yaml.safe_load(f)

    db_service = root_compose["services"]["db"]
    assert "ports" not in db_service


def test_compose_dev_workflow_preserves_postgres_port():
    backend_compose_path = Path(__file__).resolve().parents[1] / "docker-compose.yml"
    with open(backend_compose_path, "r", encoding="utf-8") as f:
        backend_compose = yaml.safe_load(f)

    assert "ports" in backend_compose["services"]["db"]
    assert "5432:5432" in backend_compose["services"]["db"]["ports"]

    root_dev_compose_path = Path(__file__).resolve().parents[2] / "docker-compose.dev.yml"
    assert root_dev_compose_path.is_file()
    with open(root_dev_compose_path, "r", encoding="utf-8") as f:
        dev_compose = yaml.safe_load(f)

    assert "ports" in dev_compose["services"]["db"]
    assert any("5432" in str(p) for p in dev_compose["services"]["db"]["ports"])


def test_compose_and_dockerfile_vite_api_url_alignment():
    root_compose_path = Path(__file__).resolve().parents[2] / "docker-compose.yml"
    with open(root_compose_path, "r", encoding="utf-8") as f:
        compose_content = f.read()

    assert "NEXT_PUBLIC_" not in compose_content
    assert "VITE_API_URL" in compose_content

    fe_dockerfile_path = Path(__file__).resolve().parents[2] / "fe" / "Dockerfile"
    with open(fe_dockerfile_path, "r", encoding="utf-8") as f:
        dockerfile_content = f.read()

    assert "ARG VITE_API_URL" in dockerfile_content
    assert "ENV VITE_API_URL" in dockerfile_content

    fe_env_example_path = Path(__file__).resolve().parents[2] / "fe" / ".env.example"
    with open(fe_env_example_path, "r", encoding="utf-8") as f:
        env_content = f.read()

    assert "7198" not in env_content
    assert "VITE_API_URL=http://localhost:8000" in env_content


def test_backend_compose_healthcheck_targets_health():
    root_compose_path = Path(__file__).resolve().parents[2] / "docker-compose.yml"
    with open(root_compose_path, "r", encoding="utf-8") as f:
        root_compose = yaml.safe_load(f)

    healthcheck = root_compose["services"]["backend"]["healthcheck"]
    test_command = " ".join(healthcheck["test"])
    assert "http://localhost:8000/health" in test_command
    assert "http://localhost:8000/" not in test_command.replace("http://localhost:8000/health", "")


@pytest.mark.asyncio
async def test_health_endpoint_healthy_when_database_available(api_client):
    response = await api_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["code"] == 200
    assert body["data"]["status"] == "healthy"


@pytest.mark.asyncio
async def test_health_endpoint_unhealthy_when_database_fails(api_client, monkeypatch):
    import app.main

    class FailingConnectionContext:
        async def __aenter__(self):
            raise ConnectionRefusedError("PostgreSQL connection refused")

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    class FailingEngine:
        def connect(self):
            return FailingConnectionContext()

    monkeypatch.setattr(app.main, "engine", FailingEngine())
    response = await api_client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["success"] is False
    assert body["code"] == 503
    assert "Lỗi kết nối CSDL" in body["message"]
