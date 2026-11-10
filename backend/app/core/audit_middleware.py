import re
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.database import AsyncSessionLocal
from app.core.security import decode_access_token
from app.models.production_models import PhiAuditLog


class PhiAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        path = request.url.path
        if not (path.startswith("/api/v1/clinical") or path.startswith("/clinical")):
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
        action_map = {
            "GET": "VIEW",
            "POST": "CREATE",
            "PUT": "UPDATE",
            "PATCH": "UPDATE",
            "DELETE": "DELETE",
        }
        action_type = action_map.get(method, "VIEW")

        encounter_match = re.search(r"/encounters/(\d+)", path)
        patient_match = re.search(r"/patients/(\d+)", path)

        encounter_id = int(encounter_match.group(1)) if encounter_match else None
        patient_id = int(patient_match.group(1)) if patient_match else None

        entity_name = "encounter" if encounter_id else ("patient" if patient_id else "clinical_resource")
        entity_id = encounter_id or patient_id or 0

        client_ip = request.client.host if request.client else "127.0.0.1"
        user_agent = request.headers.get("user-agent", "")[:500]

        try:
            async with AsyncSessionLocal() as session:
                audit_entry = PhiAuditLog(
                    user_id=user_id,
                    patient_id=patient_id or 1,
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
        except Exception:
            pass

        return response
