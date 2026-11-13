from fastapi import APIRouter
from app.routers.admin.legacy_admin import router as legacy_admin_router
from app.routers.admin.admin_bi import bi_router
from app.routers.admin.admin_catalog import catalog_router
from app.routers.admin.admin_staff import staff_router
from app.routers.admin.admin_audit import audit_router
from app.routers.admin.admin_integration import integration_router

router = APIRouter()
router.include_router(legacy_admin_router)
router.include_router(bi_router, prefix="/admin/bi", tags=["Admin BI"])
router.include_router(catalog_router, prefix="/admin/catalog", tags=["Admin Catalog"])
router.include_router(staff_router, prefix="/admin/staff", tags=["Admin Staff"])
router.include_router(audit_router, prefix="/admin/audit", tags=["Admin Audit"])
router.include_router(integration_router, prefix="/admin/integration", tags=["Admin Integration"])

__all__ = [
    "router",
    "bi_router",
    "catalog_router",
    "staff_router",
    "audit_router",
    "integration_router",
]
