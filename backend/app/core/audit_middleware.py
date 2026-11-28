import logging
import re
from datetime import datetime, timezone
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.database import AsyncSessionLocal, get_db
from app.core.security import decode_access_token
from app.models.compliance import HealthDataAccessAction, HealthDataResourceType, NhatKyTruyCapDuLieuYTe
from app.models.medical import LuotKham

logger = logging.getLogger("clinic_backend")


class PhiAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        if not (200 <= response.status_code < 400):
            return response

        path = request.url.path
        if not (path.startswith("/api/v1/clinical") or path.startswith("/clinical")):
            return response

        if get_db in request.app.dependency_overrides:
            return response

        method = request.method.upper()
        if method == "GET" and re.fullmatch(r"(/api/v1)?/clinical/encounters/\d+", path):
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

        user_role = str(payload.get("role") or "UNKNOWN")
        encounter_match = re.search(r"/encounters/(\d+)", path)
        patient_match = re.search(r"/patients/(\d+)", path)

        encounter_id = int(encounter_match.group(1)) if encounter_match else None
        patient_id = int(patient_match.group(1)) if patient_match else None
        if patient_id is None and encounter_id is None:
            return response

        action = (
            HealthDataAccessAction.VIEW.value
            if method == "GET"
            else HealthDataAccessAction.EDIT.value
        )
        resource_type = (
            HealthDataResourceType.ENCOUNTER.value
            if encounter_id
            else HealthDataResourceType.PATIENT_HISTORY.value
        )
        resource_id = encounter_id or patient_id
        client_ip = request.client.host if request.client else "127.0.0.1"

        try:
            async with AsyncSessionLocal() as session:
                resolved_patient_id = patient_id
                if resolved_patient_id is None and encounter_id is not None:
                    resolved_patient_id = (
                        await session.execute(
                            select(LuotKham.benh_nhan_id).where(LuotKham.id == encounter_id)
                        )
                    ).scalar_one_or_none()
                if resolved_patient_id is None:
                    return response

                audit_entry = NhatKyTruyCapDuLieuYTe(
                    user_id=user_id,
                    user_role=user_role,
                    patient_id=resolved_patient_id,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    purpose="TRUY_CAP_PHAN_HE_LAM_SANG",
                    client_ip=client_ip,
                    timestamp=datetime.now(timezone.utc),
                )
                session.add(audit_entry)
                await session.commit()
        except Exception as exc:
            logger.warning("PhiAuditMiddleware failed to record audit entry: %s", exc)

        return response
