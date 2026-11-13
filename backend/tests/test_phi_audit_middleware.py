import pytest
from starlette.requests import Request
from starlette.responses import Response
from app.core.audit_middleware import PhiAuditMiddleware
from app.core.security import create_access_token
from app.main import app
from app.models.production_models import PhiAuditLog


class DummySession:
    def __init__(self, should_fail=False):
        self.should_fail = should_fail
        self.added = []
        self.committed = False

    def add(self, item):
        self.added.append(item)

    async def commit(self):
        if self.should_fail:
            raise RuntimeError("Database connection lost with sensitive detail BN-12345 Nguyen Van A dau nguc")
        self.committed = True

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class DummySessionFactory:
    def __init__(self, should_fail=False):
        self.should_fail = should_fail
        self.last_session = None

    def __call__(self):
        self.last_session = DummySession(should_fail=self.should_fail)
        return self.last_session


class DummyState:
    def __init__(self, session_factory):
        self.audit_session_factory = session_factory


class DummyApp:
    def __init__(self, session_factory):
        self.state = DummyState(session_factory)


def build_request(method, path, headers=None, query_params=None, app_instance=None):
    raw_headers = []
    if headers:
        for key, value in headers.items():
            raw_headers.append((key.lower().encode("latin-1"), value.encode("latin-1")))
    query_string = b""
    if query_params:
        parts = [f"{k}={v}".encode("latin-1") for k, v in query_params.items()]
        query_string = b"&".join(parts)
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "raw_path": path.encode("latin-1"),
        "query_string": query_string,
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
        "app": app_instance,
    }
    return Request(scope)


async def dummy_call_next(request: Request) -> Response:
    return Response(content="ok", status_code=200)


@pytest.mark.asyncio
async def test_reception_path_patient_audit_logging():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=101, role="LE_TAN")
    headers = {"Authorization": f"Bearer {token}", "User-Agent": "ReceptionClient/1.0"}
    request = build_request("GET", "/api/v1/reception/patients/55", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    session = session_factory.last_session
    assert session is not None
    assert session.committed is True
    assert len(session.added) == 1
    log = session.added[0]
    assert isinstance(log, PhiAuditLog)
    assert log.user_id == 101
    assert log.patient_id == 55
    assert log.encounter_id is None
    assert log.entity_name == "patient"
    assert log.entity_id == 55
    assert log.action_type == "VIEW"


@pytest.mark.asyncio
async def test_cashier_path_encounter_audit_logging():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=202, role="THU_NGAN")
    headers = {"Authorization": f"Bearer {token}"}
    request = build_request("POST", "/api/v1/cashier/encounters/77/create-invoice", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    session = session_factory.last_session
    assert session is not None
    assert session.committed is True
    assert len(session.added) == 1
    log = session.added[0]
    assert log.user_id == 202
    assert log.encounter_id == 77
    assert log.entity_name == "encounter"
    assert log.entity_id == 77
    assert log.action_type == "CREATE"


@pytest.mark.asyncio
async def test_cashier_invoice_audit_logging():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=202, role="THU_NGAN")
    headers = {"Authorization": f"Bearer {token}"}
    request = build_request("POST", "/api/v1/cashier/invoices/88/pay", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    session = session_factory.last_session
    assert session is not None
    assert session.committed is True
    assert len(session.added) == 1
    log = session.added[0]
    assert log.user_id == 202
    assert log.entity_name == "invoice"
    assert log.entity_id == 88
    assert log.action_type == "CREATE"


@pytest.mark.asyncio
async def test_appointment_path_audit_logging():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=303, role="BENH_NHAN")
    headers = {"Authorization": f"Bearer {token}"}
    request = build_request("POST", "/api/v1/appointments/99/cancel", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    session = session_factory.last_session
    assert session is not None
    assert session.committed is True
    assert len(session.added) == 1
    log = session.added[0]
    assert log.user_id == 303
    assert log.entity_name == "appointment"
    assert log.entity_id == 99
    assert log.action_type == "CREATE"


@pytest.mark.asyncio
async def test_queue_ticket_audit_logging():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=404, role="LE_TAN")
    headers = {"Authorization": f"Bearer {token}"}
    request = build_request("PATCH", "/reception/queue/12/close", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    session = session_factory.last_session
    assert session is not None
    assert session.committed is True
    assert len(session.added) == 1
    log = session.added[0]
    assert log.entity_name == "queue_ticket"
    assert log.entity_id == 12
    assert log.action_type == "UPDATE"


@pytest.mark.asyncio
async def test_absent_patient_id_remains_none():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=505, role="THU_NGAN")
    headers = {"Authorization": f"Bearer {token}"}
    request = build_request("GET", "/api/v1/cashier/unbilled-encounters", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    session = session_factory.last_session
    assert session is not None
    assert session.committed is True
    assert len(session.added) == 1
    log = session.added[0]
    assert log.patient_id is None
    assert log.encounter_id is None
    assert log.entity_name == "cashier_resource"
    assert log.entity_id == 0


@pytest.mark.asyncio
async def test_patient_id_from_query_params():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=505, role="LE_TAN")
    headers = {"Authorization": f"Bearer {token}"}
    request = build_request("GET", "/api/v1/reception/reports/summary", headers=headers, query_params={"patient_id": "67"}, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    session = session_factory.last_session
    assert session is not None
    assert len(session.added) == 1
    log = session.added[0]
    assert log.patient_id == 67
    assert log.entity_name == "patient"
    assert log.entity_id == 67


@pytest.mark.asyncio
async def test_unaudited_path_skipped():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=606, role="ADMIN")
    headers = {"Authorization": f"Bearer {token}"}
    request = build_request("GET", "/api/v1/admin/settings", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    assert session_factory.last_session is None


@pytest.mark.asyncio
async def test_missing_auth_header_skipped():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    request = build_request("GET", "/api/v1/reception/patients/1", headers={}, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    assert session_factory.last_session is None


@pytest.mark.asyncio
async def test_invalid_token_skipped():
    session_factory = DummySessionFactory()
    mock_app = DummyApp(session_factory)
    headers = {"Authorization": "Bearer invalid_malformed_token"}
    request = build_request("GET", "/api/v1/reception/patients/1", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    assert session_factory.last_session is None


@pytest.mark.asyncio
async def test_safe_error_logging_redacts_phi_and_secrets(caplog):
    session_factory = DummySessionFactory(should_fail=True)
    mock_app = DummyApp(session_factory)
    token = create_access_token(subject=707, role="BAC_SI")
    headers = {"Authorization": f"Bearer {token}"}
    request = build_request("GET", "/api/v1/clinical/encounters/123", headers=headers, app_instance=mock_app)
    middleware = PhiAuditMiddleware(app=None)

    with caplog.at_level("WARNING"):
        response = await middleware.dispatch(request, dummy_call_next)

    assert response.status_code == 200
    warning_records = [record for record in caplog.records if record.levelname == "WARNING"]
    assert len(warning_records) >= 1
    logged_text = " ".join([record.getMessage() for record in warning_records])
    assert "PhiAuditMiddleware failed to record audit log" in logged_text
    assert "RuntimeError" in logged_text
    assert "BN-12345" not in logged_text
    assert "Nguyen Van A" not in logged_text
    assert "dau nguc" not in logged_text
    assert token not in logged_text
    assert "123" not in logged_text
    assert "707" not in logged_text


@pytest.mark.asyncio
async def test_fastapi_app_integration_with_cashier(api_client, db_session):
    session_factory = DummySessionFactory()
    app.state.audit_session_factory = session_factory
    token = create_access_token(subject=999, role="thu_ngan")
    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = await api_client.get("/api/v1/cashier/pending-bills", headers=headers)
        assert response.status_code in (200, 401, 403, 404, 422)
        session = session_factory.last_session
        assert session is not None
        assert session.committed is True
        assert len(session.added) == 1
        log = session.added[0]
        assert log.user_id == 999
        assert log.patient_id is None
        assert log.entity_name == "cashier_resource"
    finally:
        app.state.audit_session_factory = None
