"""
Unified Admin Service Facade (Anti-God-Object Architecture)
===========================================================
Tập hợp 5 dịch vụ chuyên trách theo nguyên tắc Single Responsibility Principle (SRP):
1. AdminDoctorService      (app.services.admin_doctor_service)     : Bác sĩ & Danh bạ Bệnh nhân
2. AdminDepartmentService  (app.services.admin_department_service) : Khoa phòng & Buồng khám vật lý
3. AdminShiftService       (app.services.admin_shift_service)      : Phân ca trực, Roster tuần & Nghỉ phép
4. AdminCatalogService     (app.services.admin_catalog_service)    : Danh mục Kỹ thuật, Khái niệm AI
5. AdminAnalyticsService   (app.services.admin_analytics_service)  : Dashboard KPIs, Báo cáo & Đính chính

Áp dụng Facade Pattern giúp giải quyết triệt để lỗi God Object (1400+ dòng) 
nhưng bảo toàn tính tương thích ngược 100% cho toàn bộ Routers và Test Suites.
"""

from app.services.admin_doctor_service import AdminDoctorService, admin_doctor_service
from app.services.admin_department_service import AdminDepartmentService, admin_department_service
from app.services.admin_shift_service import AdminShiftService, admin_shift_service
from app.services.admin_catalog_service import AdminCatalogService, admin_catalog_service
from app.services.admin_analytics_service import AdminAnalyticsService, admin_analytics_service


class AdminService(
    AdminDoctorService,
    AdminDepartmentService,
    AdminShiftService,
    AdminCatalogService,
    AdminAnalyticsService,
):
    """
    Facade Coordinator kế thừa toàn bộ 5 dịch vụ chuyên biệt.
    Mọi lời gọi hàm trực tiếp trên `admin_service` đều được ủy quyền chính xác.
    """
    doctor_service = admin_doctor_service
    department_service = admin_department_service
    shift_service = admin_shift_service
    catalog_service = admin_catalog_service
    analytics_service = admin_analytics_service


admin_service = AdminService()
