from fastapi import APIRouter
from app.core.response import ResponseEnvelope
from app.schemas.cashier import SepayWebhookResponse
from app.routers.auth import router as auth_router
from app.routers.appointment import router as appointment_router
from app.routers.ai_triage import router as ai_triage_router, fe_triage_router
from app.routers.medical import router as medical_router
from app.routers.clinical import router as clinical_router
from app.routers.reception import router as reception_router
from app.routers.admin import router as admin_router
from app.routers.compliance import router as compliance_router
from app.routers.cashier import router as cashier_router, sepay_webhook
from app.routers.subclinical import router as subclinical_router
from app.routers.patient import router as patient_router
from app.routers.notification import router as notification_router
from app.routers.staff import router as staff_router
from app.routers.schedule import router as schedule_router
from app.routers.billing import billing_router, payments_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(appointment_router)
api_router.include_router(ai_triage_router)
api_router.include_router(fe_triage_router)
api_router.include_router(medical_router)
api_router.include_router(clinical_router)
api_router.include_router(reception_router)
api_router.include_router(admin_router)
api_router.include_router(compliance_router)
api_router.include_router(cashier_router)
api_router.include_router(subclinical_router)
api_router.include_router(patient_router)
api_router.include_router(notification_router)
api_router.include_router(staff_router)
api_router.include_router(billing_router)
api_router.include_router(payments_router)
api_router.include_router(schedule_router)

api_router.add_api_route(
    "/webhook/sepay",
    sepay_webhook,
    methods=["POST"],
    response_model=ResponseEnvelope[SepayWebhookResponse],
    summary="Webhook SePay Alias"
)
