import logging
import re
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.database import AsyncSessionLocal
from app.core.security import decode_access_token
from app.models.production_models import PhiAuditLog

logger = logging.getLogger(__name__)

AUDITED_PATH_PREFIXES = (
    "/api/v1/clinical",
    "/clinical",
    "/api/v1/reception",
    "/reception",
    "/api/v1/cashier",
    "/cashier",
    "/api/v1/appointment",
    "/appointment",
    "/api/v1/appointments",
    "/appointments",
)

ACTION_METHOD_MAP = {
    "GET": "VIEW",
    "POST": "CREATE",
    "PUT": "UPDATE",
    "PATCH": "UPDATE",
    "DELETE": "DELETE",
}


class PhiAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        path = request.url.path
        if not path.startswith(AUDITED_PATH_PREFIXES):
            return response

        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if not auth_header:
            return response

        token = auth_header.replace("Bearer ", "").replace("bearer ", "").strip().strip('"').strip("'")
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            return response

        try:
            user_id = int(payload["sub"])
        except (ValueError, TypeError):
            return response

        method = request.method.upper()
        action_type = ACTION_METHOD_MAP.get(method, "VIEW")

        encounter_match = re.search(r"/encounters/(\d+)", path)
        patient_match = re.search(r"/patients/(\d+)", path)
        appointment_match = re.search(r"/appointments?/(\d+)", path)
        invoice_match = re.search(r"/invoices/(\d+)", path)
        ticket_match = re.search(r"/queue/(\d+)", path)

        encounter_id = int(encounter_match.group(1)) if encounter_match else None
        patient_id = int(patient_match.group(1)) if patient_match else None
        appointment_id = int(appointment_match.group(1)) if appointment_match else None
        invoice_id = int(invoice_match.group(1)) if invoice_match else None
        ticket_id = int(ticket_match.group(1)) if ticket_match else None

        if patient_id is None:
            query_patient = request.query_params.get("patient_id") or request.query_params.get("benh_nhan_id")
            if query_patient and query_patient.isdigit():
                patient_id = int(query_patient)

        if encounter_id is not None:
            entity_name = "encounter"
            entity_id = encounter_id
        elif patient_id is not None:
            entity_name = "patient"
            entity_id = patient_id
        elif appointment_id is not None:
            entity_name = "appointment"
            entity_id = appointment_id
        elif invoice_id is not None:
            entity_name = "invoice"
            entity_id = invoice_id
        elif ticket_id is not None:
            entity_name = "queue_ticket"
            entity_id = ticket_id
        else:
            if path.startswith(("/api/v1/clinical", "/clinical")):
                entity_name = "clinical_resource"
            elif path.startswith(("/api/v1/reception", "/reception")):
                entity_name = "reception_resource"
            elif path.startswith(("/api/v1/cashier", "/cashier")):
                entity_name = "cashier_resource"
            elif path.startswith(("/api/v1/appointment", "/appointment", "/api/v1/appointments", "/appointments")):
                entity_name = "appointment_resource"
            else:
                entity_name = "phi_resource"
            entity_id = 0

        client_ip = request.client.host if request.client else "127.0.0.1"
        user_agent = request.headers.get("user-agent", "")[:500]

        try:
            app_state = getattr(getattr(request, "app", None), "state", None)
            session_factory = getattr(app_state, "audit_session_factory", None) or AsyncSessionLocal
            async with session_factory() as session:
                audit_entry = PhiAuditLog(
                    user_id=user_id,
                    patient_id=patient_id,
                    encounter_id=encounter_id,
                    action_type=action_type,
                    entity_name=entity_name,
                    entity_id=entity_id,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(audit_entry)
                await session.commit()
        except Exception as exc:
            logger.warning(
                "PhiAuditMiddleware failed to record audit log: %s",
                exc.__class__.__name__,
            )

        return response
