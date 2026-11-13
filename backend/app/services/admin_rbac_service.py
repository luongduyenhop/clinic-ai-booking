from typing import List
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import Quyen, VaiTro, VaiTroQuyen, VaiTroEnum
from app.schemas.admin import RolePermissionAdminResponse

ROLE_LABELS = {
    VaiTroEnum.ADMIN.value: ("Quản trị viên", "Quản trị toàn hệ thống"),
    VaiTroEnum.BAC_SI.value: ("Bác sĩ", "Khám bệnh và hồ sơ lâm sàng"),
    VaiTroEnum.LE_TAN.value: ("Lễ tân", "Tiếp đón và quản lý lịch hẹn"),
    VaiTroEnum.THU_NGAN.value: ("Thu ngân", "Thu viện phí và đối soát"),
    VaiTroEnum.KY_THUAT_VIEN.value: ("Kỹ thuật viên", "Thực hiện cận lâm sàng"),
    VaiTroEnum.BENH_NHAN.value: ("Bệnh nhân", "Cổng thông tin bệnh nhân"),
}
MODULES = ["SYS_ADMIN", "PATIENT_MGT", "APPOINTMENT", "RECEPTION", "CLINICAL_EXAM", "PHYSICAL_ROOM", "PRESCRIPTION", "CASHIER_BILLING", "PARACLINICAL_ORDER", "LAB_TESTING", "DIAGNOSTIC_IMAGING", "FUNCTIONAL_TESTING", "SHIFT_SCHEDULING", "CATALOG_MANAGEMENT", "ROLE_RBAC", "SERVICE_PACKAGES", "TREATMENT_COURSES", "CORPORATE_HEALTH", "PRINT_TEMPLATES", "COMPLIANCE_AUDIT", "AI_TRIAGE_CONFIG", "PORTAL_CONTENT", "ANALYTICS_REPORTS"]
ACTIONS = ["view", "create", "update", "delete", "export"]

DEFAULT_ROLE_MODULES = {
    VaiTroEnum.BAC_SI.value: {
        "CLINICAL_EXAM": {"view", "create", "update"},
        "APPOINTMENT": {"view"},
        "PATIENT_MGT": {"view"},
        "PRESCRIPTION": {"view", "create", "update"},
        "PARACLINICAL_ORDER": {"view"},
        "SHIFT_SCHEDULING": {"view", "create"},
        "COMPLIANCE_AUDIT": {"view"},
    },
    VaiTroEnum.LE_TAN.value: {
        "RECEPTION": {"view", "create", "update"},
        "APPOINTMENT": {"view", "create", "update"},
        "PATIENT_MGT": {"view"},
        "SHIFT_SCHEDULING": {"view"},
    },
    VaiTroEnum.THU_NGAN.value: {
        "CASHIER_BILLING": {"view", "create", "update"},
        "RECEPTION": {"view"},
        "APPOINTMENT": {"view"},
    },
    VaiTroEnum.KY_THUAT_VIEN.value: {
        "PARACLINICAL_ORDER": {"view", "create", "update"},
        "LAB_TESTING": {"view", "create", "update"},
        "DIAGNOSTIC_IMAGING": {"view", "create", "update"},
        "FUNCTIONAL_TESTING": {"view", "create", "update"},
    },
    VaiTroEnum.BENH_NHAN.value: {
        "APPOINTMENT": {"view", "create"},
        "PATIENT_MGT": {"view"},
        "PRESCRIPTION": {"view"},
    },
}


class AdminRBACService:
    async def _ensure_catalog(self, db: AsyncSession) -> None:
        changed = False
        roles = (await db.execute(select(VaiTro))).scalars().all()
        roles_by_code = {role.ma_vai_tro: role for role in roles}
        for code, (name, description) in ROLE_LABELS.items():
            if code not in roles_by_code:
                role = VaiTro(ma_vai_tro=code, ten_vai_tro=name, mo_ta=description, is_active=True)
                db.add(role)
                roles_by_code[code] = role
                changed = True
        permissions = (await db.execute(select(Quyen))).scalars().all()
        perms_by_code = {perm.ma_quyen: perm for perm in permissions}
        for module in MODULES:
            for action in ACTIONS:
                code = f"{module}.{action}"
                if code not in perms_by_code:
                    perm = Quyen(ma_quyen=code, ten_quyen=f"{module} - {action}", mo_ta=f"{action} permission for {module}")
                    db.add(perm)
                    perms_by_code[code] = perm
                    changed = True
        await db.flush()
        admin_role = roles_by_code[VaiTroEnum.ADMIN.value]
        existing = set((await db.execute(select(VaiTroQuyen.quyen_id).where(VaiTroQuyen.vai_tro_id == admin_role.id))).scalars().all())
        for perm in perms_by_code.values():
            if perm.id not in existing:
                db.add(VaiTroQuyen(vai_tro_id=admin_role.id, quyen_id=perm.id))
                changed = True
        for role_code, module_defaults in DEFAULT_ROLE_MODULES.items():
            role = roles_by_code.get(role_code)
            if not role:
                continue
            role_permissions = set((await db.execute(
                select(VaiTroQuyen.quyen_id).where(VaiTroQuyen.vai_tro_id == role.id)
            )).scalars().all())
            if role_permissions:
                continue
            for module, actions in module_defaults.items():
                for action in actions:
                    perm_key = f"{module}.{action}"
                    if perm_key in perms_by_code:
                        permission = perms_by_code[perm_key]
                        db.add(VaiTroQuyen(vai_tro_id=role.id, quyen_id=permission.id))
                        changed = True
        if changed:
            await db.commit()
        else:
            await db.flush()

    async def list_roles(self, db: AsyncSession) -> List[RolePermissionAdminResponse]:
        await self._ensure_catalog(db)
        stmt = select(VaiTro).options(selectinload(VaiTro.danh_sach_vai_tro_quyen).selectinload(VaiTroQuyen.quyen)).order_by(VaiTro.id)
        roles = (await db.execute(stmt)).scalars().all()
        return [RolePermissionAdminResponse(
            ma_vai_tro=role.ma_vai_tro,
            ten_vai_tro=role.ten_vai_tro,
            mo_ta=role.mo_ta,
            permission_codes=sorted(link.quyen.ma_quyen for link in role.danh_sach_vai_tro_quyen if link.quyen),
        ) for role in roles]

    async def update_role_permissions(self, role_code: str, permission_codes: List[str], db: AsyncSession) -> RolePermissionAdminResponse:
        await self._ensure_catalog(db)
        if len(permission_codes) != len(set(permission_codes)):
            from app.core.exceptions import BadRequestException
            raise BadRequestException("Danh sách mã quyền không được chứa giá trị trùng lặp.")
        role = (await db.execute(select(VaiTro).where(VaiTro.ma_vai_tro == role_code))).scalar_one_or_none()
        if not role:
            from app.core.exceptions import NotFoundException
            raise NotFoundException("Không tìm thấy vai trò.")
        valid_codes = set((await db.execute(select(Quyen.ma_quyen).where(Quyen.ma_quyen.in_(permission_codes)))).scalars().all()) if permission_codes else set()
        if valid_codes != set(permission_codes):
            from app.core.exceptions import BadRequestException
            raise BadRequestException("Danh sách mã quyền có quyền không tồn tại.")
        if role_code == VaiTroEnum.ADMIN.value:
            from app.core.exceptions import BadRequestException
            raise BadRequestException("Không thể gỡ quyền quản trị của vai trò Admin.")
        await db.execute(delete(VaiTroQuyen).where(VaiTroQuyen.vai_tro_id == role.id))
        permission_rows = (await db.execute(select(Quyen).where(Quyen.ma_quyen.in_(permission_codes)))).scalars().all() if permission_codes else []
        db.add_all([VaiTroQuyen(vai_tro_id=role.id, quyen_id=permission.id) for permission in permission_rows])
        await db.commit()
        return RolePermissionAdminResponse(ma_vai_tro=role.ma_vai_tro, ten_vai_tro=role.ten_vai_tro, mo_ta=role.mo_ta, permission_codes=sorted(valid_codes))


admin_rbac_service = AdminRBACService()
