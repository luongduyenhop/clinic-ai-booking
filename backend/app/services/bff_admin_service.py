import copy
import json
from pathlib import Path
from typing import Any, Optional
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestException
from app.models.bff_store import HeThongTrangThaiBff
from app.services.bff_admin_modules.admin_catalog_sync_service import AdminCatalogSyncService
from app.services.bff_admin_modules.admin_helpers import (
    _build_role_permissions,
    _classify_drug_group,
    _get_icd_chapter,
    _is_infectious_icd,
    _make_dvt_code,
    _normalize_service_group,
    _normalize_voucher_code,
    _parse_date_safe,
    _parse_decimal_safe,
)
from app.services.bff_admin_modules.admin_projection_service import AdminProjectionService
from app.services.bff_admin_modules.admin_sync_service import AdminSyncService

SEED_FILE_PATH = (
    Path(__file__).resolve().parents[3]
    / "fe-clinic-ai-booking"
    / "src"
    / "services"
    / "admin"
    / "seed"
    / "clinicSeed.json"
)

class BffAdminService:

    def __init__(self):
        self._cached_raw_seed: Optional[dict] = None
        self._initial_relational_synced: bool = False
        self.projection_service = AdminProjectionService()
        self.sync_service = AdminSyncService()
        self.catalog_sync_service = AdminCatalogSyncService()

    def _load_clean_seed(self) -> dict:
        if self._cached_raw_seed is None:
            candidate_paths = [
                Path(__file__).resolve().parents[2] / "fe" / "src" / "services" / "admin" / "seed" / "clinicSeed.json",
                Path(__file__).resolve().parents[3] / "fe" / "src" / "services" / "admin" / "seed" / "clinicSeed.json",
                Path(__file__).resolve().parents[3] / "fe-clinic-ai-booking" / "src" / "services" / "admin" / "seed" / "clinicSeed.json",
            ]
            loaded = False
            for p in candidate_paths:
                if p.exists():
                    try:
                        with open(p, "r", encoding="utf-8") as f:
                            self._cached_raw_seed = json.load(f)
                            loaded = True
                            break
                    except Exception:
                        pass
            if not loaded:
                try:
                    from app.core.clinic_bootstrap_seed import _RAW_JSON
                    self._cached_raw_seed = json.loads(_RAW_JSON)
                except Exception:
                    self._cached_raw_seed = {}

        seed = copy.deepcopy(self._cached_raw_seed)
        perm_modules = seed.get("permissionModules") or []
        total_modules = len(perm_modules) or 23

        roles = []
        for r in seed.get("roles") or []:
            roles.append({
                "id": r.get("id"),
                "tenVaiTro": r.get("tenVaiTro"),
                "moTa": r.get("moTa"),
                "permissions": _build_role_permissions(r, total_modules),
            })

        return {
            "schemaVersion": seed.get("schemaVersion", "2.0.0-promax"),
            "authSeed": seed.get("authSeed", {}),
            "navigationConfig": seed.get("navigationConfig", {}),
            "masterOptions": seed.get("masterOptions", {}),
            "formDefaults": seed.get("formDefaults", {}),
            "permissionModules": perm_modules,
            "patients": seed.get("patients", []),
            "appointments": seed.get("appointments", []),
            "registrations": seed.get("registrations", []),
            "paraclinicalTasks": seed.get("paraclinicalTasks", []),
            "vouchers": seed.get("vouchers", []),
            "newsCategories": seed.get("newsCategories", []),
            "newsArticles": seed.get("newsArticles", []),
            "catalogs": seed.get("catalogs", {}),
            "guideCategories": seed.get("guideCategories", []),
            "guides": seed.get("guides", []),
            "qaList": seed.get("qaList", []),
            "staffList": [],
            "roles": roles,
            "templates": seed.get("templates", []),
            "complianceObligations": seed.get("complianceObligations", []),
            "auditLogs": seed.get("auditLogs", []),
            "roleWorkbenches": seed.get("roleWorkbenches", {}),
            "addressShortcuts": seed.get("addressShortcuts", []),
            "referrers": seed.get("referrers", []),
            "servicePackageRegistrations": seed.get("servicePackageRegistrations", []),
            "treatmentCourses": seed.get("treatmentCourses", []),
            "corporateCheckups": seed.get("corporateCheckups", []),
            "healthCheckupClassifications": seed.get("healthCheckupClassifications", []),
            "inventoryBatches": [],
            "cashierClosings": seed.get("cashierClosings", []),
            "nationalDrugSync": seed.get("nationalDrugSync", []),
            "nationalEhrSync": seed.get("nationalEhrSync", []),
            "clinicSettings": seed.get("clinicSettings", {}),
            "systemNotifications": seed.get("systemNotifications", []),
        }

    async def get_bootstrap_data(self, db: AsyncSession) -> dict:
        data = self._load_clean_seed()
        if settings.is_hosted:
            data["authSeed"] = {}
            for key in (
                "patients", "appointments", "registrations", "paraclinicalTasks",
                "vouchers", "servicePackageRegistrations", "treatmentCourses", "corporateCheckups",
                "auditLogs", "cashierClosings", "nationalDrugSync", "nationalEhrSync", "systemNotifications",
            ):
                data[key] = []

        rows = (await db.execute(select(HeThongTrangThaiBff))).scalars()
        for row in rows:
            key, val = row.collection_key, row.data_json
            if key in ("inventoryBatches", "navigationConfig"):
                continue
            if key == "catalogs" and isinstance(val, dict):
                merged_catalogs = copy.deepcopy(data.get("catalogs", {}))
                merged_catalogs.update(val)
                data["catalogs"] = merged_catalogs
            else:
                data[key] = val

        data["inventoryBatches"] = []
        data["patients"] = await self.projection_service.project_relational_patients(db, data.get("patients", []))
        data["appointments"] = await self.projection_service.project_relational_appointments(db, data.get("appointments", []))
        data["staffList"] = await self.projection_service.project_relational_staff(db)
        data["catalogs"] = await self.projection_service.project_relational_catalogs(db, data.get("catalogs", {}))
        data["vouchers"] = await self.projection_service.project_relational_vouchers(db, data.get("vouchers", []))
        data["registrations"] = await self.projection_service.project_relational_registrations(db, data.get("registrations", []))

        return data

    async def _project_relational_appointments(self, db: AsyncSession, base_appointments: list) -> list:
        return await self.projection_service.project_relational_appointments(db, base_appointments)

    async def _project_relational_patients(self, db: AsyncSession, base_patients: list) -> list:
        return await self.projection_service.project_relational_patients(db, base_patients)

    async def _project_relational_staff(self, db: AsyncSession) -> list:
        return await self.projection_service.project_relational_staff(db)

    async def _project_relational_catalogs(self, db: AsyncSession, base_catalogs: dict) -> dict:
        return await self.projection_service.project_relational_catalogs(db, base_catalogs)

    async def _project_relational_vouchers(self, db: AsyncSession, base_vouchers: list) -> list:
        return await self.projection_service.project_relational_vouchers(db, base_vouchers)

    async def _project_relational_registrations(self, db: AsyncSession, base_registrations: list) -> list:
        return await self.projection_service.project_relational_registrations(db, base_registrations)

    async def sync_all_collections_to_relational(
        self,
        db: AsyncSession,
        data: dict,
        existing_bff_keys: Optional[set] = None,
    ) -> None:
        await self.sync_service.sync_all_collections_to_relational(db, data, existing_bff_keys)

    async def _upsert_bff_key(
        self,
        db: AsyncSession,
        key: str,
        value: Any,
        user_id: Optional[int] = None,
    ) -> None:
        await self.sync_service.upsert_bff_key(db, key, value, user_id)

    async def _append_audit_entry(
        self,
        db: AsyncSession,
        current_data: dict,
        audit_entry: Optional[dict],
        default_target: str,
        user_id: Optional[int] = None,
    ) -> None:
        await self.sync_service.append_audit_entry(db, current_data, audit_entry, default_target, user_id)

    async def _ensure_default_entities(self, db: AsyncSession):
        return await self.sync_service.ensure_default_entities(db)

    async def _sync_relational_tables(self, db: AsyncSession, collection_key: str, items: Any) -> None:
        await self.sync_service.sync_relational_tables(db, collection_key, items)

    async def _sync_catalog_relational_tables(
        self,
        db: AsyncSession,
        sub_key: str,
        items: Any,
        prev_items: Optional[list] = None,
        catalogs: Optional[dict] = None,
    ) -> None:
        await self.sync_service.sync_catalog_relational_tables(db, sub_key, items, prev_items, catalogs)

    async def _delete_catalog_relational_item(
        self,
        db: AsyncSession,
        sub_key: str,
        item: dict,
        item_key: Optional[str] = None,
    ) -> None:
        await self.catalog_sync_service.delete_catalog_relational_item(db, sub_key, item, item_key)

    async def update_collection(
        self,
        db: AsyncSession,
        collection_key: str,
        items: Any,
        audit_entry: Optional[dict] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        if collection_key == "inventoryBatches":
            items = []
        if collection_key == "staffList":
            raise BadRequestException("staffList không còn được lưu qua dữ liệu BFF. Hãy dùng API hồ sơ nhân sự và bác sĩ chuyên dụng.")

        await self._upsert_bff_key(db, collection_key, items, user_id=user_id)
        await self._sync_relational_tables(db, collection_key, items)

        current_data = await self.get_bootstrap_data(db)
        if collection_key == "vouchers":
            current_data["vouchers"] = await self._project_relational_vouchers(db, current_data.get("vouchers", []))
        else:
            current_data[collection_key] = items
        await self._append_audit_entry(db, current_data, audit_entry, default_target=collection_key, user_id=user_id)

        await db.commit()
        current_data["inventoryBatches"] = []
        return current_data

    async def update_catalog_subcollection(
        self,
        db: AsyncSession,
        sub_key: str,
        items: Any,
        audit_entry: Optional[dict] = None,
        user_id: Optional[int] = None,
        deleted_item: Optional[dict] = None,
        deleted_item_key: Optional[str] = None,
    ) -> dict:
        current_data = await self.get_bootstrap_data(db)
        catalogs = dict(current_data.get("catalogs") or {})
        prev_items = catalogs.get(sub_key) or []

        if not deleted_item and audit_entry and audit_entry.get("hanhDong") == "DELETE_CATALOG_ITEM" and isinstance(items, list) and isinstance(prev_items, list):
            new_keys = set()
            for it in items:
                if isinstance(it, dict):
                    k = str(it.get("maChuyenKhoa") or it.get("maPhong") or it.get("maDV") or it.get("maThuoc") or it.get("maICD") or it.get("id") or "").strip().upper()
                    if k:
                        new_keys.add(k)
            for prev in prev_items:
                if isinstance(prev, dict):
                    pk = str(prev.get("maChuyenKhoa") or prev.get("maPhong") or prev.get("maDV") or prev.get("maThuoc") or prev.get("maICD") or prev.get("id") or "").strip().upper()
                    if pk and pk not in new_keys:
                        deleted_item = prev
                        deleted_item_key = pk
                        break

        if deleted_item:
            await self._delete_catalog_relational_item(db, sub_key, deleted_item, deleted_item_key)

        catalogs[sub_key] = items
        current_data["catalogs"] = catalogs

        await self._upsert_bff_key(db, "catalogs", catalogs, user_id=user_id)
        await self._sync_catalog_relational_tables(db, sub_key, items, prev_items=prev_items, catalogs=catalogs)
        await self._append_audit_entry(
            db,
            current_data,
            audit_entry,
            default_target=f"Danh mục: {sub_key}",
            user_id=user_id,
        )

        await db.commit()
        refreshed_data = await self.get_bootstrap_data(db)
        refreshed_data["inventoryBatches"] = []
        return refreshed_data

    async def reset_demo_data(self, db: AsyncSession) -> dict:
        data = self._load_clean_seed()
        await db.execute(delete(HeThongTrangThaiBff))
        self._initial_relational_synced = False
        await self.sync_all_collections_to_relational(db, data, set())
        return await self.get_bootstrap_data(db)

bff_admin_service = BffAdminService()
