import copy
import json
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import LichKham
from app.models.bff_store import HeThongTrangThaiBff
from app.models.compliance import GiayPhepCoSo, NhatKyTruyCapDuLieuYTe
from app.models.content import BaiVietTinTuc, MauBieuYTe
from app.models.medical import (
    ChiDinh,
    ChiTietHoaDon,
    DichVu,
    HoaDon,
    KhaiNiem,
    KhoaSoCaTruc,
    LuotKham,
    LuotKhamTheLuc,
    PhieuThuChi,
)
from app.models.specialized import (
    DangKyGoiKham,
    GoiDichVu,
    LieuTrinhDieuTri,
)
from app.models.user import BacSi, BenhNhan, NguoiDung, PhongKham

SEED_FILE_PATH = (
    Path(__file__).resolve().parents[3]
    / "fe-clinic-ai-booking"
    / "src"
    / "services"
    / "admin"
    / "seed"
    / "clinicSeed.json"
)


def _parse_date_safe(val: Any, default: Optional[date] = None) -> date:
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, str) and val.strip():
        s = val.strip()[:10]
        for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                pass
    return default or date.today()


def _parse_decimal_safe(val: Any) -> Decimal:
    try:
        if val is None or val == "":
            return Decimal("0")
        return Decimal(str(val).replace(",", "").strip())
    except Exception:
        return Decimal("0")


def _build_role_permissions(role_seed: dict, total_modules: int = 23) -> list[dict]:
    """Chuẩn hóa ma trận phân quyền 23 module giống hệt hàm buildRolePermissions ở Frontend"""
    perms = role_seed.get("permissions")
    if isinstance(perms, list) and len(perms) == total_modules:
        return perms

    result = []
    full_access = bool(role_seed.get("fullAccess"))
    view_up_to = role_seed.get("viewUpTo")
    view_indices = set(role_seed.get("viewIndices") or [])
    add_indices = set(role_seed.get("addIndices") or [])
    edit_indices = set(role_seed.get("editIndices") or [])
    delete_indices = set(role_seed.get("deleteIndices") or [])
    print_indices = set(role_seed.get("printIndices") or [])

    for idx in range(total_modules):
        stt = idx + 1
        if full_access:
            result.append({"stt": stt, "xem": True, "them": True, "sua": True, "xoa": True, "inXuat": True})
        else:
            xem = (idx < view_up_to) if view_up_to is not None else (stt in view_indices)
            result.append({
                "stt": stt,
                "xem": bool(xem),
                "them": stt in add_indices,
                "sua": stt in edit_indices,
                "xoa": stt in delete_indices,
                "inXuat": stt in print_indices,
            })
    return result


class BffAdminService:
    """
    Tầng dịch vụ BFF (Backend-For-Frontend) kết nối trực tiếp các trang Quản trị React
    với Cơ sở dữ liệu quan hệ (42 bảng).
    Tuân thủ nghiêm ngặt quy tắc: KHÔNG có quản lý kho thuốc (inventoryBatches = []).
    """

    def __init__(self):
        self._cached_raw_seed: Optional[dict] = None
        self._initial_relational_synced: bool = False

    def _load_clean_seed(self) -> dict:
        if self._cached_raw_seed is None:
            if SEED_FILE_PATH.exists():
                with open(SEED_FILE_PATH, "r", encoding="utf-8") as f:
                    self._cached_raw_seed = json.load(f)
            else:
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
            "staffList": seed.get("staffList", []),
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
            # Ràng buộc bắt buộc: Phòng khám không quản lý kho thuốc / lô thuốc
            "inventoryBatches": [],
            "cashierClosings": seed.get("cashierClosings", []),
            "nationalDrugSync": seed.get("nationalDrugSync", []),
            "nationalEhrSync": seed.get("nationalEhrSync", []),
            "clinicSettings": seed.get("clinicSettings", {}),
            "systemNotifications": seed.get("systemNotifications", []),
        }

    async def get_bootstrap_data(self, db: AsyncSession) -> dict:
        """Lấy toàn bộ dữ liệu quản trị phòng khám từ Database cho Frontend và tự động đồng bộ các bảng quan hệ"""
        data = self._load_clean_seed()

        stmt = select(HeThongTrangThaiBff)
        rows = (await db.execute(stmt)).scalars().all()
        existing_keys = set()
        for row in rows:
            existing_keys.add(row.collection_key)
            if row.collection_key == "inventoryBatches":
                continue
            if row.collection_key == "catalogs" and isinstance(row.data_json, dict):
                merged_catalogs = copy.deepcopy(data.get("catalogs", {}))
                merged_catalogs.update(row.data_json)
                data["catalogs"] = merged_catalogs
            else:
                data[row.collection_key] = row.data_json

        # Luôn đảm bảo không tồn tại quản lý lô/kho thuốc
        data["inventoryBatches"] = []

        # Đồng bộ hóa dữ liệu khởi tạo vào các bảng quan hệ nếu Database mới khởi tạo
        if len(existing_keys) < 5:
            await self.sync_all_collections_to_relational(db, data, existing_keys)

        return data

    async def sync_all_collections_to_relational(
        self,
        db: AsyncSession,
        data: dict,
        existing_bff_keys: Optional[set] = None,
    ) -> None:
        """Đồng bộ toàn bộ các tập dữ liệu vào hệ thống các bảng quan hệ trong Database"""
        existing_bff_keys = existing_bff_keys or set()
        collections_to_persist = [
            "patients",
            "appointments",
            "registrations",
            "paraclinicalTasks",
            "vouchers",
            "newsCategories",
            "newsArticles",
            "catalogs",
            "qaList",
            "staffList",
            "roles",
            "templates",
            "auditLogs",
            "servicePackageRegistrations",
            "treatmentCourses",
            "corporateCheckups",
            "cashierClosings",
            "clinicSettings",
        ]
        for key in collections_to_persist:
            if key not in existing_bff_keys and key in data:
                await self._upsert_bff_key(db, key, data[key])

        for key in [
            "patients",
            "registrations",
            "paraclinicalTasks",
            "templates",
            "newsArticles",
            "qaList",
            "vouchers",
            "cashierClosings",
            "servicePackageRegistrations",
            "treatmentCourses",
            "corporateCheckups",
            "clinicSettings",
        ]:
            if key in data:
                await self._sync_relational_tables(db, key, data[key])

        catalogs = data.get("catalogs") or {}
        if isinstance(catalogs, dict):
            for sub_key, sub_items in catalogs.items():
                await self._sync_catalog_relational_tables(db, sub_key, sub_items)

        await db.commit()

    async def _upsert_bff_key(
        self,
        db: AsyncSession,
        key: str,
        value: Any,
        user_id: Optional[int] = None,
    ) -> None:
        stmt = select(HeThongTrangThaiBff).where(HeThongTrangThaiBff.collection_key == key)
        record = (await db.execute(stmt)).scalar_one_or_none()
        if record:
            record.data_json = value
            record.updated_by_id = user_id
        else:
            record = HeThongTrangThaiBff(
                collection_key=key,
                data_json=value,
                updated_by_id=user_id,
            )
            db.add(record)

    async def _append_audit_entry(
        self,
        db: AsyncSession,
        current_data: dict,
        audit_entry: Optional[dict],
        default_target: str,
        user_id: Optional[int] = None,
    ) -> None:
        if not audit_entry:
            return
        defaults = current_data.get("formDefaults") or {}
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        new_audit = {
            "id": f"AUD-{int(datetime.now().timestamp() * 1000) % 100000:05d}",
            "thoiGian": now_str,
            "nguoiDung": audit_entry.get("nguoiDung") or defaults.get("defaultDoctor", "BS.CKII Nguyễn Minh Hoàng"),
            "vaiTro": audit_entry.get("vaiTro") or "ADMIN",
            "hanhDong": audit_entry.get("hanhDong") or "UPDATE_DATA",
            "doiTuong": audit_entry.get("doiTuong") or default_target,
            "mucDich": audit_entry.get("mucDich") or "Thao tác nghiệp vụ quản lý phòng khám",
            "ip": "127.0.0.1",
            "ketQua": audit_entry.get("ketQua") or "THÀNH CÔNG",
        }
        audit_logs = [new_audit] + list(current_data.get("auditLogs") or [])
        current_data["auditLogs"] = audit_logs
        await self._upsert_bff_key(db, "auditLogs", audit_logs, user_id=user_id)

        # Ghi trực tiếp vào bảng quan hệ nhat_ky_truy_cap_y_te
        db.add(NhatKyTruyCapDuLieuYTe(
            user_id=user_id or 1,
            user_role=str(new_audit["vaiTro"])[:50],
            patient_id=1,
            action="EDIT",
            resource_type="ENCOUNTER",
            resource_id=1,
            purpose=f"{new_audit['hanhDong']}: {new_audit['mucDich']}"[:250],
            client_ip="127.0.0.1",
        ))

    async def _ensure_default_entities(self, db: AsyncSession):
        """Đảm bảo có sẵn NguoiDung, BenhNhan, BacSi và LuotKham mặc định cho các khóa ngoại bảng quan hệ"""
        first_user = (await db.execute(select(NguoiDung))).scalars().first()
        if not first_user:
            first_user = NguoiDung(ho_ten="Quản trị viên Hệ thống")
            db.add(first_user)
            await db.flush()

        first_bn = (await db.execute(select(BenhNhan))).scalars().first()
        if not first_bn:
            nd_bn = NguoiDung(ho_ten="Bệnh nhân Mặc định")
            db.add(nd_bn)
            await db.flush()
            first_bn = BenhNhan(
                nguoi_dung_id=nd_bn.id,
                ma_dinh_danh_y_te=f"BN-DEFAULT-{nd_bn.id}",
                nhom_mau="O+",
            )
            db.add(first_bn)
            await db.flush()

        first_bs = (await db.execute(select(BacSi))).scalars().first()
        if not first_bs:
            nd_bs = NguoiDung(ho_ten="BS.CKII Nguyễn Minh Hoàng")
            db.add(nd_bs)
            await db.flush()
            first_bs = BacSi(
                nguoi_dung_id=nd_bs.id,
                hoc_vi="BS.CKII",
                chung_chi_hanh_nghe=f"CCHN-DEFAULT-{nd_bs.id}",
                nam_kinh_nghiem=15,
            )
            db.add(first_bs)
            await db.flush()

        first_lk = (await db.execute(select(LuotKham))).scalars().first()
        if not first_lk:
            lich = LichKham(
                ma_lich_kham=f"LH-DEFAULT-{first_bn.id}-{first_bs.id}",
                benh_nhan_id=first_bn.id,
                bac_si_id=first_bs.id,
                ngay_kham=date.today(),
                gio_kham=time(8, 30),
                thoi_luong_phut=30,
                so_thu_tu=1,
                trang_thai="da_xac_nhan",
            )
            db.add(lich)
            await db.flush()
            first_lk = LuotKham(
                lich_kham_id=lich.id,
                bac_si_id=first_bs.id,
                benh_nhan_id=first_bn.id,
                thoi_gian_bat_dau=datetime.now(timezone.utc),
                ly_do_vao_kham="Khám tổng quát",
            )
            db.add(first_lk)
            await db.flush()

        return first_user, first_bn, first_bs, first_lk

    async def _sync_relational_tables(self, db: AsyncSession, collection_key: str, items: Any) -> None:
        """Đồng bộ sang các bảng quan hệ chuyên biệt khi cập nhật từ Frontend"""
        if collection_key == "clinicSettings" and isinstance(items, dict):
            lic_no = str(items.get("giayPhepHoatDong") or "GPHĐ-001/SYT").strip()
            stmt = select(GiayPhepCoSo).where(GiayPhepCoSo.so_giay_phep == lic_no)
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if existing:
                existing.ten_co_so = str(items.get("tenPhongKham") or existing.ten_co_so)
                existing.ghi_chu = str(items.get("diaChi") or existing.ghi_chu or "")
            else:
                db.add(GiayPhepCoSo(
                    so_giay_phep=lic_no,
                    ten_co_so=str(items.get("tenPhongKham") or "Phòng khám Đa khoa Clinic-AI"),
                    ngay_cap=datetime.now(timezone.utc) - timedelta(days=365),
                    ngay_het_han=datetime.now(timezone.utc) + timedelta(days=365 * 4),
                    pham_vi_hoat_dong="Khám chữa bệnh đa khoa ngoại trú",
                    trang_thai="ACTIVE",
                    ghi_chu=str(items.get("diaChi") or ""),
                ))
            return

        if not isinstance(items, list):
            return

        if collection_key == "patients":
            for p in items:
                code = str(p.get("maBN") or p.get("id") or "").strip()
                if not code:
                    continue
                stmt = select(BenhNhan).where(BenhNhan.ma_dinh_danh_y_te == code)
                existing_bn = (await db.execute(stmt)).scalar_one_or_none()
                if existing_bn:
                    existing_bn.nhom_mau = str(p.get("nhomMau") or existing_bn.nhom_mau or "O+")[:10]
                    existing_bn.di_ung_thuoc = str(p.get("diUng") or existing_bn.di_ung_thuoc or "Không")
                else:
                    phone = str(p.get("dienThoai") or "").strip() or None
                    if phone:
                        dup_phone = (await db.execute(select(NguoiDung).where(NguoiDung.so_dien_thoai == phone))).scalar_one_or_none()
                        if dup_phone:
                            phone = None
                    nd = NguoiDung(
                        ho_ten=str(p.get("hoTen") or "Bệnh nhân")[:150],
                        so_dien_thoai=phone,
                        ngay_sinh=_parse_date_safe(p.get("ngaySinh"), date(1990, 1, 1)),
                        gioi_tinh=str(p.get("gioiTinh") or "Nam")[:10],
                        dia_chi=str(p.get("diaChi") or "")[:255],
                    )
                    db.add(nd)
                    await db.flush()
                    db.add(BenhNhan(
                        nguoi_dung_id=nd.id,
                        ma_dinh_danh_y_te=code[:50],
                        nhom_mau=str(p.get("nhomMau") or "O+")[:10],
                        di_ung_thuoc=str(p.get("diUng") or "Không"),
                    ))

        elif collection_key == "templates":
            for t in items:
                code = str(t.get("id") or t.get("maMau") or "").strip()
                if not code:
                    continue
                stmt = select(MauBieuYTe).where(MauBieuYTe.ma_mau == code)
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.ten_mau = str(t.get("tenMau") or existing.ten_mau)[:255]
                    existing.noi_dung_text = str(t.get("noiDung") or existing.noi_dung_text or "")
                    existing.loai_mau = str(t.get("loaiMau") or existing.loai_mau)[:30]
                else:
                    db.add(MauBieuYTe(
                        ma_mau=code[:50],
                        ten_mau=str(t.get("tenMau") or code)[:255],
                        loai_mau=str(t.get("loaiMau") or "CHI_DINH_CLS")[:30],
                        noi_dung_text=str(t.get("noiDung") or "Mẫu biểu y tế"),
                        is_public=bool(t.get("trangThai", True)),
                    ))

        elif collection_key == "newsArticles":
            for art in items:
                slug = f"bai-viet-{str(art.get('id') or '').lower().strip()}"
                if not slug or slug == "bai-viet-":
                    continue
                stmt = select(BaiVietTinTuc).where(BaiVietTinTuc.slug == slug)
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.tieu_de = str(art.get("tieuDe") or existing.tieu_de)[:255]
                    existing.noi_dung_html = str(art.get("noiDung") or art.get("moTa") or existing.noi_dung_html)
                    existing.luot_xem = int(art.get("luotXem") or existing.luot_xem or 0)
                else:
                    db.add(BaiVietTinTuc(
                        tieu_de=str(art.get("tieuDe") or "Bài viết y khoa")[:255],
                        slug=slug[:255],
                        chuyen_muc=str(art.get("danhMuc") or "Y_HOC_THUONG_THUC")[:50],
                        tom_tat=str(art.get("moTa") or art.get("tomTat") or ""),
                        noi_dung_html=str(art.get("noiDung") or art.get("moTa") or "Nội dung bài viết"),
                        tac_gia=str(art.get("nguoiTao") or art.get("tacGia") or "Ban Biên Tập Clinic-AI")[:150],
                        luot_xem=int(art.get("luotXem") or 0),
                        is_published=art.get("trangThai") != "Bản nháp",
                    ))

        elif collection_key == "qaList":
            pass  # Đã gỡ bỏ phân hệ hỏi đáp y khoa theo kiến trúc mới

        elif collection_key == "registrations":
            first_user, first_bn, first_bs, first_lk = await self._ensure_default_entities(db)
            if first_lk and items:
                reg0 = items[0]
                vitals = reg0.get("vitals") or {}
                existing_tl = (
                    await db.execute(select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == first_lk.id))
                ).scalar_one_or_none()
                if not existing_tl:
                    db.add(LuotKhamTheLuc(
                        luot_kham_id=first_lk.id,
                        chieu_cao=_parse_decimal_safe(vitals.get("chieuCao") or 168),
                        can_nang=_parse_decimal_safe(vitals.get("canNang") or 62),
                        bmi=_parse_decimal_safe(vitals.get("bmi") or 22.0),
                        mach=int(vitals.get("mach") or 76),
                        nhiet_do=_parse_decimal_safe(vitals.get("nhietDo") or 36.8),
                        nhip_tho=int(vitals.get("nhipTho") or 18),
                        phan_loai_the_luc="LOAI_I",
                        bac_si_ket_luan_id=first_bs.id if first_bs else None,
                    ))

        elif collection_key == "paraclinicalTasks":
            first_user, first_bn, first_bs, first_lk = await self._ensure_default_entities(db)
            first_dv = (await db.execute(select(DichVu))).scalars().first()
            if not first_dv:
                first_dv = DichVu(
                    ma_dich_vu="DV-CLS-DEFAULT",
                    ten_dich_vu="Xét nghiệm tổng phân tích tế bào máu",
                    don_gia=Decimal("150000"),
                    don_vi_tinh="Lần",
                    ma_nhom_byt="XN",
                    is_active=True,
                )
                db.add(first_dv)
                await db.flush()
            if first_lk and first_dv:
                existing_cd = (
                    await db.execute(select(ChiDinh).where(ChiDinh.luot_kham_id == first_lk.id))
                ).scalars().all()
                if not existing_cd:
                    for pt in items[:5]:
                        db.add(ChiDinh(
                            luot_kham_id=first_lk.id,
                            dich_vu_id=first_dv.id,
                            so_luong=1,
                            don_gia_tai_thoi_diem=first_dv.don_gia or Decimal("150000"),
                            trang_thai="da_co_ket_qua" if "kết quả" in str(pt.get("trangThai") or "").lower() else "da_chi_dinh",
                            bac_si_chi_dinh_id=first_bs.id if first_bs else None,
                            ket_qua_chi_tiet=str(pt.get("ketLuan") or pt.get("moTa") or "Kết quả bình thường"),
                        ))

        elif collection_key == "vouchers":
            first_user, first_bn, first_bs, first_lk = await self._ensure_default_entities(db)
            staff_id = first_user.id
            for v in items:
                code = str(v.get("maPhieu") or v.get("id") or "").strip()
                if not code:
                    continue
                stmt = select(PhieuThuChi).where(PhieuThuChi.ma_phieu == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                loai = "CHI" if "chi" in str(v.get("loaiPhieu") or "").lower() else "THU"
                amount = _parse_decimal_safe(v.get("tongTien") or v.get("daThu") or 0)
                if existing:
                    existing.so_tien = amount
                    existing.ly_do = str(v.get("tenPhieu") or v.get("ghiChu") or existing.ly_do)
                else:
                    hd_id = None
                    if loai == "THU" and first_lk and first_bn:
                        hd_code = f"HD-{code[:40]}"
                        existing_hd = (
                            await db.execute(select(HoaDon).where(HoaDon.ma_hoa_don == hd_code))
                        ).scalar_one_or_none()
                        if not existing_hd:
                            existing_hd = HoaDon(
                                ma_hoa_don=hd_code,
                                luot_kham_id=first_lk.id,
                                benh_nhan_id=first_bn.id,
                                thu_ngan_id=staff_id,
                                tong_tien=amount,
                                mien_giam=Decimal("0"),
                                thuc_thu=amount,
                                phuong_thuc_thanh_toan=str(v.get("hinhThuc") or "tien_mat")[:30],
                                trang_thai="da_thu",
                                ghi_chu=str(v.get("tenPhieu") or ""),
                                ngay_thanh_toan=datetime.now(timezone.utc),
                            )
                            db.add(existing_hd)
                            await db.flush()
                            for item in (v.get("items") or [])[:3]:
                                item_price = _parse_decimal_safe(item.get("donGia") or item.get("thanhTien") or amount)
                                db.add(ChiTietHoaDon(
                                    hoa_don_id=existing_hd.id,
                                    loai_muc="can_lam_sang",
                                    ten_khoan_thu=str(item.get("tenDV") or v.get("tenPhieu") or "Dịch vụ y tế")[:255],
                                    so_luong=int(item.get("soLuong") or 1),
                                    don_gia=item_price,
                                    thanh_tien=item_price,
                                ))
                        hd_id = existing_hd.id

                    db.add(PhieuThuChi(
                        ma_phieu=code[:50],
                        loai_phieu=loai,
                        hoa_don_id=hd_id,
                        nguoi_giao_dich=str(v.get("hoTenBN") or v.get("nguoiThu") or "Khách hàng")[:255],
                        so_tien=amount,
                        phuong_thuc=str(v.get("hinhThuc") or "tien_mat")[:30],
                        ly_do=str(v.get("tenPhieu") or v.get("ghiChu") or "Giao dịch thu chi")[:500],
                        nhan_vien_id=staff_id,
                        thoi_gian=datetime.now(timezone.utc),
                        trang_thai_khoa_so=False,
                    ))

        elif collection_key == "cashierClosings":
            first_user, _, _, _ = await self._ensure_default_entities(db)
            staff_id = first_user.id
            for c in items:
                code = str(c.get("maKyKhoaSo") or c.get("id") or "").strip()
                if not code:
                    continue
                stmt = select(KhoaSoCaTruc).where(KhoaSoCaTruc.ma_khoa_so == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if not existing:
                    cash_in = _parse_decimal_safe(c.get("tongThuDichVu") or 0)
                    cash_net = _parse_decimal_safe(c.get("tonQuyCuoiNgay") or cash_in)
                    db.add(KhoaSoCaTruc(
                        ma_khoa_so=code[:50],
                        ca_lam_viec="CA_NGAY",
                        ngay_khoa_so=_parse_date_safe(c.get("ngayKhoaSo")),
                        thu_ngan_giao_id=staff_id,
                        tong_tien_mat_he_thong=cash_in,
                        tien_mat_thuc_te=cash_net,
                        chenh_lech_tien_mat=Decimal("0"),
                        trang_thai="DA_KHOA_SO",
                        ghi_chu=str(c.get("cheDo") or ""),
                    ))

        elif collection_key == "servicePackageRegistrations":
            _, first_bn, _, _ = await self._ensure_default_entities(db)
            bn_id = first_bn.id
            for sp in items:
                pkg_name = str(sp.get("tenGoi") or "Gói khám tổng quát").strip()
                pkg_code = f"GOI-{abs(hash(pkg_name)) % 10000:04d}"
                stmt_pkg = select(GoiDichVu).where(GoiDichVu.ma_goi == pkg_code)
                pkg_obj = (await db.execute(stmt_pkg)).scalar_one_or_none()
                if not pkg_obj:
                    pkg_obj = GoiDichVu(
                        ma_goi=pkg_code,
                        ten_goi=pkg_name[:255],
                        don_gia_niem_yet=_parse_decimal_safe(sp.get("tongTien") or 1500000),
                        don_gia_khuyen_mai=_parse_decimal_safe(sp.get("thanhTien") or 1200000),
                        is_active=True,
                    )
                    db.add(pkg_obj)
                    await db.flush()

                reg_code = str(sp.get("maLH") or sp.get("id") or "").strip()
                if not reg_code:
                    continue
                stmt_reg = select(DangKyGoiKham).where(DangKyGoiKham.ma_dang_ky == reg_code[:50])
                existing_reg = (await db.execute(stmt_reg)).scalar_one_or_none()
                if not existing_reg:
                    start_d = _parse_date_safe(sp.get("ngayDangKy") or sp.get("ngayTao"))
                    db.add(DangKyGoiKham(
                        ma_dang_ky=reg_code[:50],
                        benh_nhan_id=bn_id,
                        goi_dich_vu_id=pkg_obj.id,
                        ngay_dang_ky=start_d,
                        han_su_dung=start_d + timedelta(days=90),
                        tong_so_dich_vu=5,
                        so_dich_vu_da_dung=1,
                        trang_thai="DANG_SU_DUNG",
                    ))

        elif collection_key == "treatmentCourses":
            _, first_bn, first_bs, _ = await self._ensure_default_entities(db)
            bn_id = first_bn.id
            bs_id = first_bs.id
            for tc in items:
                code = str(tc.get("maDangKy") or tc.get("id") or "").strip()
                if not code:
                    continue
                stmt = select(LieuTrinhDieuTri).where(LieuTrinhDieuTri.ma_lieu_trinh == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                done_sessions = int(tc.get("soBuoiDaTap") or 0)
                total_sessions = int(tc.get("tongSoBuoi") or 10)
                if existing:
                    existing.so_buoi_da_thuc_hien = done_sessions
                    existing.tong_so_buoi = total_sessions
                    existing.trang_thai = "HOAN_THANH" if done_sessions >= total_sessions else "DANG_DIEU_TRI"
                else:
                    db.add(LieuTrinhDieuTri(
                        ma_lieu_trinh=code[:50],
                        ten_lieu_trinh=str(tc.get("tenLieuTrinh") or "Liệu trình điều trị")[:255],
                        benh_nhan_id=bn_id,
                        bac_si_phu_trach_id=bs_id,
                        tong_so_buoi=total_sessions,
                        so_buoi_da_thuc_hien=done_sessions,
                        ngay_bat_dau=_parse_date_safe(tc.get("ngayDangKy")),
                        muc_tieu_dieu_tri=str(tc.get("lichLapLai") or ""),
                        trang_thai="HOAN_THANH" if done_sessions >= total_sessions else "DANG_DIEU_TRI",
                    ))

        elif collection_key == "corporateCheckups":
            pass  # Đã gỡ bỏ phân hệ khám đoàn B2B theo kiến trúc mới

    async def _sync_catalog_relational_tables(self, db: AsyncSession, sub_key: str, items: Any) -> None:
        """Đồng bộ các bảng danh mục (khoaPhong -> phong_kham, dichVu -> dich_vu, danhMucBenh/thuocVatTu -> khai_niem)"""
        if not isinstance(items, list):
            return

        if sub_key == "khoaPhong":
            for r in items:
                code = str(r.get("maPhong") or r.get("id") or "").strip()
                if not code:
                    continue
                stmt = select(PhongKham).where(PhongKham.ma_phong == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.ten_phong = str(r.get("tenPhong") or existing.ten_phong)[:100]
                else:
                    db.add(PhongKham(
                        ma_phong=code[:50],
                        ten_phong=str(r.get("tenPhong") or code)[:100],
                        tang=str(r.get("tang") or "Tầng 1")[:20],
                        loai_phong="kham_benh",
                        is_active=True,
                    ))

        elif sub_key == "dichVu":
            for s in items:
                code = str(s.get("maDV") or s.get("id") or "").strip()
                if not code:
                    continue
                stmt = select(DichVu).where(DichVu.ma_dich_vu == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                price = _parse_decimal_safe(s.get("giaDV") or s.get("donGia") or 150000)
                if existing:
                    existing.ten_dich_vu = str(s.get("tenDV") or existing.ten_dich_vu)[:150]
                    existing.don_gia = price
                else:
                    db.add(DichVu(
                        ma_dich_vu=code[:50],
                        ten_dich_vu=str(s.get("tenDV") or code)[:150],
                        don_gia=price,
                        don_vi_tinh=str(s.get("donViTinh") or "Lần")[:30],
                        ma_nhom_byt=str(s.get("loaiDV") or "CLS")[:50],
                        is_active=True,
                    ))

        elif sub_key in ("danhMucBenh", "thuocVatTu"):
            loai_kn = "benh_icd10" if sub_key == "danhMucBenh" else "thuoc_tham_chieu"
            for item in items:
                code = str(item.get("maICD") or item.get("maThuoc") or item.get("id") or "").strip()
                name = str(item.get("tenBenh") or item.get("tenThuoc") or code).strip()
                if not code:
                    continue
                stmt = select(KhaiNiem).where(KhaiNiem.ma_khai_niem == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.ten_khai_niem = name[:255]
                else:
                    db.add(KhaiNiem(
                        ma_khai_niem=code[:50],
                        ten_khai_niem=name[:255],
                        loai_khai_niem=loai_kn,
                        mo_ta=str(item.get("nhomBenh") or item.get("hoatChat") or ""),
                        is_active=True,
                    ))

    async def update_collection(
        self,
        db: AsyncSession,
        collection_key: str,
        items: Any,
        audit_entry: Optional[dict] = None,
        user_id: Optional[int] = None,
    ) -> dict:
        """Cập nhật một phân hệ dữ liệu từ Frontend xuống Database và trả về clinicData mới nhất"""
        if collection_key == "inventoryBatches":
            items = []

        await self._upsert_bff_key(db, collection_key, items, user_id=user_id)
        await self._sync_relational_tables(db, collection_key, items)

        current_data = await self.get_bootstrap_data(db)
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
    ) -> dict:
        """Cập nhật danh mục con (khoaPhong, dichVu, danhMucBenh, thuocVatTu, diaChi, chung) vào Database"""
        current_data = await self.get_bootstrap_data(db)
        catalogs = dict(current_data.get("catalogs") or {})
        catalogs[sub_key] = items
        current_data["catalogs"] = catalogs

        await self._upsert_bff_key(db, "catalogs", catalogs, user_id=user_id)
        await self._sync_catalog_relational_tables(db, sub_key, items)
        await self._append_audit_entry(
            db,
            current_data,
            audit_entry,
            default_target=f"Danh mục: {sub_key}",
            user_id=user_id,
        )

        await db.commit()
        current_data["inventoryBatches"] = []
        return current_data

    async def reset_demo_data(self, db: AsyncSession) -> dict:
        """Khôi phục dữ liệu mẫu ban đầu trên Database và đồng bộ lại các bảng quan hệ"""
        await db.execute(delete(HeThongTrangThaiBff))
        await db.commit()
        self._initial_relational_synced = False
        return await self.get_bootstrap_data(db)


bff_admin_service = BffAdminService()
