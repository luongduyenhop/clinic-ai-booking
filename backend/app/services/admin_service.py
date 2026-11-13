\
\
\
\
\
\
\
\
\
\
\
\
from app.services.admin_doctor_service import AdminDoctorService, admin_doctor_service
from app.services.admin_department_service import AdminDepartmentService, admin_department_service
from app.services.admin_shift_service import AdminShiftService, admin_shift_service
from app.services.admin_catalog_service import AdminCatalogService, admin_catalog_service
from app.services.admin_analytics_service import AdminAnalyticsService, admin_analytics_service
from app.services.admin_staff_service import AdminStaffService, admin_staff_service
from app.services.admin_rbac_service import AdminRBACService, admin_rbac_service
class AdminService(
    AdminDoctorService,
    AdminDepartmentService,
    AdminShiftService,
    AdminCatalogService,
    AdminAnalyticsService,
    AdminStaffService,
    AdminRBACService,
):
\
\
\
    doctor_service = admin_doctor_service
    department_service = admin_department_service
    shift_service = admin_shift_service
    catalog_service = admin_catalog_service
    analytics_service = admin_analytics_service
    staff_service = admin_staff_service
    rbac_service = admin_rbac_service
admin_service = AdminService()
