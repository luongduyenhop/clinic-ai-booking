"""Role-scoped BFF adapter for staff screens; administration stays admin-only."""
from copy import deepcopy

from app.core.exceptions import ForbiddenException
from app.services.bff_admin_service import bff_admin_service


READ_COLLECTIONS = {
    "le_tan": {"patients", "appointments", "registrations", "vouchers", "servicePackageRegistrations"},
    "thu_ngan": {"patients", "appointments", "registrations", "vouchers", "cashierClosings"},
    "bac_si": {"patients", "appointments", "registrations", "paraclinicalTasks", "treatmentCourses"},
    "ky_thuat_vien": {"patients", "registrations", "paraclinicalTasks"},
}
WRITE_COLLECTIONS = {
    "le_tan": {"patients", "appointments", "registrations", "vouchers", "servicePackageRegistrations"},
    "thu_ngan": {"vouchers", "cashierClosings"},
    "bac_si": {"registrations", "paraclinicalTasks", "treatmentCourses"},
    "ky_thuat_vien": {"paraclinicalTasks"},
}
COMMON_KEYS = {"schemaVersion", "formDefaults", "addressShortcuts", "referrers"}
CATALOG_KEYS = {"goTat", "donViTinh", "khoanThu", "phuongPhapTruDau", "diaChi", "khoaPhong", "danhMucBenh", "thuocVatTu", "dichVu"}
OPTION_KEYS = {"genders", "maritalStatuses", "countries", "bloodTypes", "specialties", "registrationStatuses", "appointmentStatuses", "appointmentConfirmationActions", "paraclinicalStatuses", "paraclinicalModalities", "paymentMethods", "voucherTypes", "serviceOrderCategoryTabs", "prescriptionFsmSteps"}
CLINIC_KEYS = {"tenPhongKham", "maCoSoKCB", "giayPhepHoatDong", "dienThoai", "email", "diaChi"}


class StaffPortalService:
    def _collections(self, role, policy):
        if role == "admin":
            return set().union(*policy.values())
        if role not in policy:
            raise ForbiddenException("Chỉ nhân viên được truy cập dữ liệu nghiệp vụ")
        return policy[role]

    def project(self, data, role):
        allowed = self._collections(role, READ_COLLECTIONS) | COMMON_KEYS
        result = {key: deepcopy(data[key]) for key in allowed if key in data}
        result["catalogs"] = {key: deepcopy(value) for key, value in data.get("catalogs", {}).items() if key in CATALOG_KEYS}
        result["masterOptions"] = {key: deepcopy(value) for key, value in data.get("masterOptions", {}).items() if key in OPTION_KEYS}
        result["clinicSettings"] = {key: deepcopy(value) for key, value in data.get("clinicSettings", {}).items() if key in CLINIC_KEYS}
        return result

    async def get_bootstrap(self, user, db):
        self._collections(user.vai_tro, READ_COLLECTIONS)
        data = await bff_admin_service.get_bootstrap_data(db)
        return self.project(data, user.vai_tro)

    async def update_collection(self, user, db, collection_key, items, audit_entry=None):
        if collection_key not in self._collections(user.vai_tro, WRITE_COLLECTIONS):
            raise ForbiddenException("Vai trò hiện tại không được sửa phân hệ này")
        # Actor and outcome come from the authenticated session, never client claims.
        audit = {key: (audit_entry or {}).get(key) for key in ("hanhDong", "mucDich")}
        audit.update(nguoiDung=user.email, vaiTro=user.vai_tro, ketQua="THÀNH CÔNG", doiTuong=collection_key)
        data = await bff_admin_service.update_collection(
            db, collection_key, items, audit_entry=audit, user_id=user.id,
        )
        return self.project(data, user.vai_tro)


staff_portal_service = StaffPortalService()
