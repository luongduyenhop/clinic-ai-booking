import io
import logging

from app.core.logging_filter import PHIRedactionFilter, install_phi_redaction_filter


def test_redacts_structured_phi_and_clinical_payloads():
    output = io.StringIO()
    handler = logging.StreamHandler(output)
    handler.addFilter(PHIRedactionFilter())
    logger = logging.getLogger("phi-redaction-test")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.INFO)

    logger.info("patient=%s", {
        "phone": "0901234567",
        "so_dien_thoai": "0901234567",
        "cccd": "012345678901",
        "email": "patient@example.test",
        "ho_ten": "Synthetic Patient",
        "symptoms": "synthetic symptom payload",
        "patient_id": 42,
    })
    logged = output.getvalue()
    for phi in ("0901234567", "012345678901", "patient@example.test", "Synthetic Patient", "synthetic symptom payload"):
        assert phi not in logged
    assert "42" in logged
    assert "[REDACTED]" in logged


def test_redacts_exception_fields_and_keeps_debug_details():
    output = io.StringIO()
    handler = logging.StreamHandler(output)
    handler.addFilter(PHIRedactionFilter())
    logger = logging.getLogger("phi-exception-test")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.ERROR)

    try:
        raise ValueError("database constraint failed for email=patient@example.test, request_id=trace-17")
    except ValueError:
        logger.exception("request failed for phone=0901234567")

    logged = output.getvalue()
    assert "patient@example.test" not in logged
    assert "0901234567" not in logged
    assert "ValueError" in logged
    assert "database constraint failed" in logged
    assert "trace-17" in logged


def test_uvicorn_access_handler_redacts_synthetic_url_phi():
    output = io.StringIO()
    logger = logging.getLogger("uvicorn.access")
    original_handlers, original_propagate = logger.handlers, logger.propagate
    handler = logging.StreamHandler(output)
    logger.handlers = [handler]
    logger.propagate = False
    try:
        install_phi_redaction_filter()
        install_phi_redaction_filter()
        logger.info('%s - "%s %s HTTP/%s" %d', "127.0.0.1", "GET", "/?email=patient@example.test", "1.1", 200)

        assert "patient@example.test" not in output.getvalue()
        assert "[REDACTED]" in output.getvalue()
        assert sum(isinstance(item, PHIRedactionFilter) for item in handler.filters) == 1
    finally:
        logger.handlers, logger.propagate = original_handlers, original_propagate
