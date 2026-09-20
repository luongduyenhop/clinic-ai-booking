from fastapi import APIRouter
from app.routers.auth import router as auth_router
from app.routers.appointment import router as appointment_router
from app.routers.ai_triage import router as ai_triage_router
from app.routers.medical import router as medical_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(appointment_router)
api_router.include_router(ai_triage_router)
api_router.include_router(medical_router)
