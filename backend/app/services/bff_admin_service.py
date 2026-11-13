import copy
import json
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional
from sqlalchemy import delete, select, update, or_, and_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictException
from app.models.appointment import HangDoiKham, LichKham, LichLamViec
from app.models.bff_store import HeThongTrangThaiBff
from app.models.compliance import GiayPhepCoSo, NhatKyTruyCapDuLieuYTe
from app.models.content import BaiVietTinTuc, MauBieuYTe
from app.models.medical import (
    ChanDoan,
    ChiDinh,
    ChiTietDonThuoc,
    ChiTietHoaDon,
    DichVu,
    HoaDon,
    KhaiNiem,
    KhoaSoCaTruc,
    LuotKham,
    LuotKhamTheLuc,
    PhieuKhamChuyenKhoa,
    PhieuThuChi,
    Thuoc,
)
from app.models.specialized import (
    ChiTietGoiKham,
    ChiTietGoiKhamDaMua,
    DangKyGoiKham,
    GoiDichVu,
    LieuTrinhDieuTri,
)
from app.core.exceptions import BadRequestException
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, NhanVien, PhongKham

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


def _classify_drug_group(name: str, active: str, code: str) -> str:
    s = f"{name or ''} {active or ''} {code or ''}".lower()
    if any(k in s for k in ["augmentin", "amoxicillin", "zinnat", "cefuroxime", "ciprofloxacin", "levofloxacin", "azithromycin", "klacid", "clarithromycin", "metronidazol", "kháng sinh"]):
        return "Kháng sinh kê đơn"
    if any(k in s for k in ["paracetamol", "panadol", "hapacol", "efferalgan", "hạ sốt"]):
        return "Giảm đau - Hạ sốt"
    if any(k in s for k in ["ibuprofen", "meloxicam", "celecoxib", "voltaren", "diclofenac"]):
        return "Kháng viêm không steroid (NSAID)"
    if any(k in s for k in ["chymotrypsin", "alphachymotrypsin", "medrol", "methylprednisolone"]):
        return "Kháng viêm - Giảm phù nề"
    if any(k in s for k in ["nexium", "omeprazol", "pantoprazol", "gaviscon", "yumangel", "dạ dày", "esomeprazole"]):
        return "Thuốc Dạ dày - Tiêu hóa"
    if any(k in s for k in ["motilium", "domperidone", "duspatalin", "debridat", "smecta", "hidrasec", "oresol", "enterogermina", "bioflora"]):
        return "Thuốc Tiêu hóa - Đường ruột"
    if any(k in s for k in ["amlodipin", "bisoprolol", "concor", "micardis", "telmisartan", "losartan", "coveram", "perindopril"]):
        return "Thuốc Tim mạch - Huyết áp"
    if any(k in s for k in ["lipitor", "atorvastatin", "crestor", "rosuvastatin", "mỡ máu", "lipid"]):
        return "Thuốc Tim mạch - Hạ lipid máu"
    if any(k in s for k in ["glucophage", "metformin", "diamicron", "gliclazide", "jardiance", "empagliflozin", "tiểu đường"]):
        return "Thuốc Điều trị Đái tháo đường"
    if any(k in s for k in ["telfast", "fexofenadine", "loratadin", "cetirizin", "aerius", "desloratadine", "singulair", "montelukast"]):
        return "Thuốc Chống dị ứng - Kháng Histamin"
    if any(k in s for k in ["ventolin", "salbutamol", "acemuc", "acetylcysteine", "prospan", "long đờm"]):
        return "Thuốc Hô hấp - Giảm ho & Giãn phế quản"
    if any(k in s for k in ["betaserc", "betahistine", "sibelium", "flunarizine", "tanakan", "ginkgo", "tiền đình"]):
        return "Thuốc Thần kinh - Tuần hoàn não & Tiền đình"
    if any(k in s for k in ["calci", "canxi", "vitamin", "3b", "kẽm", "gluconate", "khoáng chất"]):
        return "Vitamin & Khoáng chất"
    return "Thuốc kê đơn"


def _normalize_service_group(raw_group: Optional[str]) -> str:
    g = (raw_group or "").strip()
    mapping = {
        "KHAM": "Khám bệnh",
        "XN": "Xét nghiệm",
        "CDHA": "Chẩn đoán hình ảnh",
        "TDCN": "Thăm dò chức năng",
        "NS": "Nội soi",
        "TT": "Thủ thuật - VLTL",
        "CLS": "Cận lâm sàng",
    }
    return mapping.get(g, g or "Khám bệnh")


def _get_icd_chapter(code: str) -> str:
    c = (code or "").strip().upper()
    if not c:
        return "Chương khác"
    ch = c[0]
    if ch in ("A", "B"):
        return "Chương I: Bệnh nhiễm trùng và ký sinh trùng"
    if ch == "C" or (ch == "D" and len(c) > 1 and c[1] in "01234"):
        return "Chương II: Tân sinh (Khối u)"
    if ch == "D":
        return "Chương III: Bệnh của máu và cơ quan tạo máu"
    if ch == "E":
        return "Chương IV: Bệnh nội tiết, dinh dưỡng và chuyển hóa"
    if ch == "F":
        return "Chương V: Rối loạn tâm thần và hành vi"
    if ch == "G":
        return "Chương VI: Bệnh hệ thần kinh"
    if ch == "H" and len(c) > 1 and c[1] in "012345":
        return "Chương VII: Bệnh của mắt và phần phụ"
    if ch == "H":
        return "Chương VIII: Bệnh của tai và xương chũm"
    if ch == "I":
        return "Chương IX: Bệnh hệ tuần hoàn"
    if ch == "J":
        return "Chương X: Bệnh hệ hô hấp"
    if ch == "K":
        return "Chương XI: Bệnh hệ tiêu hóa"
    if ch == "L":
        return "Chương XII: Bệnh của da và mô dưới da"
    if ch == "M":
        return "Chương XIII: Bệnh hệ cơ-xương-khớp"
    if ch == "N":
        return "Chương XIV: Bệnh hệ sinh dục - tiết niệu"
    if ch == "O":
        return "Chương XV: Thai nghén, sinh đẻ và hậu sản"
    if ch == "P":
        return "Chương XVI: Một số tình trạng trong chu sinh"
    if ch == "Q":
        return "Chương XVII: Dị tật bẩm sinh, biến dạng"
    if ch == "R":
        return "Chương XVIII: Triệu chứng & dấu hiệu bất thường"
    if ch in ("S", "T"):
        return "Chương XIX: Tổn thương, ngộ độc"
    if ch in ("V", "W", "X", "Y"):
        return "Chương XX: Nguyên nhân ngoại lai của bệnh tật"
    if ch == "Z":
        return "Chương XXI: Yếu tố tiếp xúc dịch vụ y tế"
    if ch == "U":
        return "Chương XXII: Mã dùng cho mục đích đặc biệt"
    return "Chương khác"


def _is_infectious_icd(code: str, name: str) -> bool:
    c = (code or "").strip().upper()
    n = (name or "").lower()
    return c.startswith(("A", "B")) or any(k in n for k in ["truyền nhiễm", "dengue", "thủy đậu", "sốt rét", "lao", "dịch tả"])


class BffAdminService:

    def __init__(self):
        self._cached_raw_seed: Optional[dict] = None
        self._initial_relational_synced: bool = False

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
        is_demo_mode = (
            settings.ENVIRONMENT.lower() not in ("production", "prod")
            and bool(settings.ENABLE_DEMO_SEED)
        )
        data = self._load_clean_seed()

        if not is_demo_mode:
            data["patients"] = []
            data["appointments"] = []
            data["vouchers"] = []
            data["registrations"] = []
            data["paraclinicalTasks"] = []
            data["corporateCheckups"] = []
            data["treatmentCourses"] = []
            data["servicePackageRegistrations"] = []
            data["cashierClosings"] = []
            data["nationalDrugSync"] = []
            data["nationalEhrSync"] = []
            data["systemNotifications"] = []
            data["auditLogs"] = []
            data["authSeed"] = {}

        if not hasattr(self, "_bff_collections"):
            self._bff_collections = {}
        existing_keys = set(self._bff_collections.keys())
        for key, val in self._bff_collections.items():
            if key in ("inventoryBatches", "navigationConfig"):
                continue
            if key == "catalogs" and isinstance(val, dict):
                merged_catalogs = copy.deepcopy(data.get("catalogs", {}))
                merged_catalogs.update(val)
                data["catalogs"] = merged_catalogs
            else:
                data[key] = val

        data["inventoryBatches"] = []

        data["patients"] = await self._project_relational_patients(db, data.get("patients", []), is_demo_mode=is_demo_mode)
        data["appointments"] = await self._project_relational_appointments(db, data.get("appointments", []), is_demo_mode=is_demo_mode)
        data["staffList"] = await self._project_relational_staff(db)
        data["catalogs"] = await self._project_relational_catalogs(db, data.get("catalogs", {}), is_demo_mode=is_demo_mode)
        data["vouchers"] = await self._project_relational_vouchers(db, data.get("vouchers", []), is_demo_mode=is_demo_mode)
        data["registrations"] = await self._project_relational_registrations(db, data.get("registrations", []), is_demo_mode=is_demo_mode)

        return data

    async def _project_relational_appointments(self, db: AsyncSession, base_appointments: list, is_demo_mode: bool = True) -> list:
        stmt = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LichKham.bac_si).selectinload(BacSi.phong_kham),
                selectinload(LichKham.chuyen_khoa),
            )
            .order_by(LichKham.id.desc())
            .limit(100)
        )
        db_appointments = (await db.execute(stmt)).scalars().all()
        if not db_appointments:
            return base_appointments if is_demo_mode else []

        base_map = {}
        for a in base_appointments or []:
            code = str(a.get("maLH") or a.get("id") or "").strip()
            if code:
                base_map[code] = a

        status_map = {
            "cho_xac_nhan": "Chờ xác nhận",
            "da_xac_nhan": "Xác nhận",
            "da_tiep_nhan": "Đã tiếp nhận",
            "dang_kham": "Đang khám",
            "da_kham": "Kết thúc khám",
            "da_huy": "Đã hủy",
            "tu_dong_huy": "Đã hủy",
            "no_show": "Từ chối",
        }

        result = []
        seen_codes = set()
        for lk in db_appointments:
            code = str(lk.ma_lich_kham or f"LH{lk.id:07d}").strip()
            ex = base_map.get(code)
            bn = lk.benh_nhan
            u_bn = bn.nguoi_dung if bn else None
            bn_name = (u_bn.ho_ten if u_bn and u_bn.ho_ten else (ex.get("hoTen") if ex else f"Bệnh nhân #{lk.benh_nhan_id}")).strip()
            bs = lk.bac_si
            u_bs = bs.nguoi_dung if bs else None
            bs_name = (
                f"{bs.hoc_vi + ' ' if bs and bs.hoc_vi else ''}{u_bs.ho_ten if u_bs else 'BS. Phòng khám'}".strip()
                if bs
                else (ex.get("bacSi") if ex else "BS. Phòng khám")
            )
            spec_name = (
                lk.chuyen_khoa.ten_chuyen_khoa
                if lk.chuyen_khoa
                else (bs.chuyen_khoa.ten_chuyen_khoa if bs and bs.chuyen_khoa else (ex.get("chuyenKhoa") if ex else "Nội tổng quát"))
            )
            room_name = (
                bs.phong_kham.ten_phong
                if bs and bs.phong_kham
                else (ex.get("phongKham") if ex else "Phòng số 1 (Phòng khám Nội)")
            )
            time_part = lk.gio_kham.strftime("%H:%M") if lk.gio_kham else "08:00"
            date_time_str = f"{lk.ngay_kham.isoformat()}T{time_part}" if lk.ngay_kham else (ex.get("ngayDatLich") if ex else "")
            display_status = status_map.get(str(lk.trang_thai or "").lower(), ex.get("trangThai") if ex else "Xác nhận")
            confirm_time_str = lk.thoi_gian_xac_nhan.strftime("%Y-%m-%d %H:%M") if lk.thoi_gian_xac_nhan else (ex.get("ngayXacNhan") if ex else "")

            item = {
                "id": code,
                "appointmentId": lk.id,
                "maLH": code,
                "maBN": str(bn.ma_dinh_danh_y_te if bn and bn.ma_dinh_danh_y_te else (ex.get("maBN") if ex else f"BN{lk.benh_nhan_id:07d}")),
                "hoTen": bn_name,
                "ngaySinh": u_bn.ngay_sinh.isoformat() if u_bn and u_bn.ngay_sinh else (ex.get("ngaySinh") if ex else "1990-01-01"),
                "tuoi": f"{date.today().year - u_bn.ngay_sinh.year} tuổi" if u_bn and u_bn.ngay_sinh else (ex.get("tuoi") if ex else "35 tuổi"),
                "gioiTinh": u_bn.gioi_tinh if u_bn and u_bn.gioi_tinh else (ex.get("gioiTinh") if ex else "Nam"),
                "dienThoai": (u_bn.so_dien_thoai if u_bn and u_bn.so_dien_thoai else None) or (ex.get("dienThoai") if ex else ""),
                "taiKhoan": (u_bn.so_dien_thoai if u_bn and u_bn.so_dien_thoai else None) or (ex.get("taiKhoan") if ex else ""),
                "diaChi": (u_bn.dia_chi if u_bn and u_bn.dia_chi else None) or (ex.get("diaChi") if ex else ""),
                "ngayDatLich": date_time_str,
                "bacSi": bs_name,
                "chuyenKhoa": spec_name,
                "phongKham": room_name,
                "trieuChung": lk.ly_do_kham or lk.trieu_chung_ban_dau or (ex.get("trieuChung") if ex else "Khám theo lịch hẹn"),
                "ghiChu": ex.get("ghiChu") if ex else "Đặt lịch qua hệ thống tiếp đón",
                "trangThai": display_status,
                "nhanVienXacNhan": ex.get("nhanVienXacNhan") if ex else "Lễ tân Tiếp đón",
                "ngayXacNhan": confirm_time_str,
                "noiDungXacNhan": ex.get("noiDungXacNhan") if ex else "Đã tiếp nhận lịch hẹn khám.",
            }
            if ex:
                for k, v in ex.items():
                    if k not in item:
                        item[k] = v
            result.append(item)
            seen_codes.add(code)

        if is_demo_mode:
            for a in base_appointments or []:
                c = str(a.get("maLH") or a.get("id") or "").strip()
                if c and c not in seen_codes:
                    result.append(a)
                    seen_codes.add(c)

        return result

    async def _project_relational_patients(self, db: AsyncSession, base_patients: list, is_demo_mode: bool = True) -> list:
        stmt = (
            select(BenhNhan)
            .options(selectinload(BenhNhan.nguoi_dung))
            .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
            .where(NguoiDung.is_deleted.is_(False))
            .order_by(BenhNhan.id.desc())
        )
        db_patients = (await db.execute(stmt)).scalars().all()
        if not db_patients:
            return base_patients if is_demo_mode else []

        merged_map = {}
        for p in base_patients or []:
            code = str(p.get("maBN") or p.get("id") or "").strip()
            phone = str(p.get("dienThoai") or "").strip()
            if code:
                merged_map[code] = p
            if phone:
                merged_map[phone] = p

        result = []
        seen_codes = set()
        for bn in db_patients:
            u = bn.nguoi_dung
            code = str(bn.ma_dinh_danh_y_te or f"BN{bn.id:07d}").strip()
            phone = str(u.so_dien_thoai or "").strip() if u else ""
            existing = merged_map.get(code) or (merged_map.get(phone) if phone else None)
            birth_date_str = u.ngay_sinh.isoformat() if u and u.ngay_sinh else (existing.get("ngaySinh") if existing else "1995-01-01")
            age_str = f"{date.today().year - u.ngay_sinh.year} tuổi" if u and u.ngay_sinh else (existing.get("tuoi") if existing else "30 tuổi")
            item = {
                "id": code,
                "maBN": code,
                "hoTen": u.ho_ten if u and u.ho_ten else (existing.get("hoTen") if existing else "Bệnh nhân"),
                "ngaySinh": birth_date_str,
                "tuoi": age_str,
                "gioiTinh": u.gioi_tinh if u and u.gioi_tinh else (existing.get("gioiTinh") if existing else "Nam"),
                "dienThoai": phone or (existing.get("dienThoai") if existing else ""),
                "cccd": u.cccd_so if u and u.cccd_so else (existing.get("cccd") if existing else ""),
                "email": u.email if u and u.email else (existing.get("email") if existing else ""),
                "tinhThanh": existing.get("tinhThanh") if existing else "",
                "quanHuyen": existing.get("quanHuyen") if existing else "",
                "phuongXa": existing.get("phuongXa") if existing else "",
                "diaChi": u.dia_chi if u and u.dia_chi else (existing.get("diaChi") if existing else ""),
                "taiKhoan": phone or (u.email if u and u.email else code),
                "nhomMau": bn.nhom_mau if bn.nhom_mau else (existing.get("nhomMau") if existing else "O+"),
                "diUng": bn.di_ung_thuoc if bn.di_ung_thuoc else (existing.get("diUng") if existing else "Không ghi nhận dị ứng thuốc"),
                "ngayTao": existing.get("ngayTao") if existing else date.today().strftime("%d/%m/%Y"),
                "trangThai": existing.get("trangThai") if existing else "Đang hoạt động",
            }
            if existing:
                for k, v in existing.items():
                    if k not in item:
                        item[k] = v
            seen_codes.add(code)
            if phone:
                seen_codes.add(phone)
            result.append(item)

        if is_demo_mode:
            for p in base_patients or []:
                code = str(p.get("maBN") or p.get("id") or "").strip()
                phone = str(p.get("dienThoai") or "").strip()
                if code not in seen_codes and (not phone or phone not in seen_codes):
                    result.append(p)
                    if code:
                        seen_codes.add(code)
                    if phone:
                        seen_codes.add(phone)

        return result


    async def _project_relational_staff(self, db: AsyncSession) -> list:
        employees = (
            await db.execute(
                select(NhanVien)
                .join(NhanVien.nguoi_dung)
                .options(
                    selectinload(NhanVien.nguoi_dung).selectinload(NguoiDung.tai_khoan),
                    selectinload(NhanVien.bac_si).selectinload(BacSi.chuyen_khoa),
                    selectinload(NhanVien.bac_si).selectinload(BacSi.phong_kham),
                )
                .where(NguoiDung.is_deleted.is_(False))
                .order_by(NhanVien.id.asc())
            )
        ).scalars().all()
        result = []
        for employee in employees:
            person = employee.nguoi_dung
            doctor = employee.bac_si
            role_labels = {
                "BAC_SI": "Bác sĩ khám bệnh",
                "LE_TAN": "Lễ tân",
                "THU_NGAN": "Thu ngân",
                "KY_THUAT_VIEN": "Kỹ thuật viên",
            }
            result.append({
                "id": f"NV-{employee.id}",
                "maNV": employee.ma_nhan_vien,
                "hoTen": person.ho_ten,
                "taiKhoan": person.tai_khoan.email if person.tai_khoan else person.email,
                "dienThoai": person.so_dien_thoai,
                "vaiTro": role_labels.get(employee.loai_nhan_vien, employee.loai_nhan_vien),
                "khoaPhong": doctor.phong_kham.ten_phong if doctor and doctor.phong_kham else None,
                "chuyenKhoa": doctor.chuyen_khoa.ten_chuyen_khoa if doctor and doctor.chuyen_khoa else None,
                "soCCHN": doctor.chung_chi_hanh_nghe if doctor else None,
                "ngayCapCCHN": doctor.ngay_cap.isoformat() if doctor and doctor.ngay_cap else None,
                "ngayHetHanCCHN": doctor.ngay_het_han.isoformat() if doctor and doctor.ngay_het_han else None,
                "trangThaiCCHN": doctor.trang_thai_giay_phep if doctor else None,
                "trangThai": bool(employee.is_active and (doctor.is_active if doctor else True)),
                "accountId": person.tai_khoan.id if person.tai_khoan else None,
                "accountActive": person.tai_khoan.is_active if person.tai_khoan else None,
                "accountRole": person.tai_khoan.vai_tro if person.tai_khoan else None,
            })
        return result

    async def _project_relational_catalogs(self, db: AsyncSession, base_catalogs: dict, is_demo_mode: bool = True) -> dict:
        catalogs = copy.deepcopy(base_catalogs or {})

        db_departments = (
            await db.execute(select(ChuyenKhoa).order_by(ChuyenKhoa.id.asc()))
        ).scalars().all()
        if db_departments:
            base_depts = catalogs.get("chuyenKhoa") or []
            dept_map = {str(d.get("maChuyenKhoa") or d.get("id") or "").strip().upper(): d for d in base_depts}
            projected_depts = []
            seen_dept_codes = set()
            for ck in db_departments:
                code = str(ck.ma_chuyen_khoa or f"CK{ck.id:02d}").strip().upper()
                ex = dept_map.get(code)
                name = ck.ten_chuyen_khoa or (ex.get("tenChuyenKhoa") if ex else code)
                loc = ck.vi_tri_phong or (ex.get("viTriPhong") if ex else "Tầng 1 - Khu khám bệnh")
                desc = ck.mo_ta or (ex.get("moTa") if ex else "")
                is_act = bool(ck.is_active) if ck.is_active is not None else True
                item = {
                    "id": ex.get("id") if (ex and ex.get("id")) else f"CK-{ck.id}",
                    "maChuyenKhoa": code,
                    "tenChuyenKhoa": name,
                    "viTriPhong": loc,
                    "moTa": desc,
                    "trangThai": is_act,
                    "is_active": is_act,
                }
                if ex:
                    for k, v in ex.items():
                        if k not in item:
                            item[k] = v
                projected_depts.append(item)
                seen_dept_codes.add(code)
            if is_demo_mode:
                for bd in base_depts:
                    c = str(bd.get("maChuyenKhoa") or bd.get("id") or "").strip().upper()
                    if c and c not in seen_dept_codes:
                        projected_depts.append(bd)
                        seen_dept_codes.add(c)
            catalogs["chuyenKhoa"] = projected_depts

        db_rooms = (
            await db.execute(select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).order_by(PhongKham.id.asc()))
        ).scalars().all()
        if db_rooms:
            base_rooms = catalogs.get("khoaPhong") or []
            room_map = {str(r.get("maPhong") or r.get("id") or "").strip(): r for r in base_rooms}
            projected_rooms = []
            seen_room_codes = set()
            seen_room_ids = set()
            for r in db_rooms:
                code = str(r.ma_phong or f"PK{r.id:02d}").strip()
                ex = room_map.get(code)
                dept_name = r.chuyen_khoa.ten_chuyen_khoa if r.chuyen_khoa else (ex.get("chuyenKhoa") if ex else "Khoa Nội tổng quát")
                default_doc = "BS.CKII Nguyễn Minh Hoàng"
                if dept_name:
                    nd = dept_name.lower()
                    if "ngoai" in nd:
                        default_doc = "ThS. BS Đặng Hải Phương"
                    elif "tai mui hong" in nd:
                        default_doc = "ThS.BS Trần Quốc Tuấn"
                    elif "rang" in nd:
                        default_doc = "BS. CKII Trần Quốc Huy"
                    elif "mat" in nd:
                        default_doc = "ThS. BS Lê Ngọc Lan"
                    elif "co xuong khop" in nd or "khop" in nd:
                        default_doc = "BS.CKI Lê Thu Trang"
                    elif "hinh anh" in nd or "x-quang" in nd or "sieu am" in nd:
                        default_doc = "BS.CKI Phạm Quang Huy"
                candidate_id = ex.get("id") if (ex and ex.get("id")) else f"ROOM-DB-{r.id:03d}"
                if candidate_id in seen_room_ids:
                    candidate_id = f"ROOM-{code}"
                seen_room_ids.add(candidate_id)

                item = {
                    "id": candidate_id,
                    "maPhong": code,
                    "tenPhong": r.ten_phong or (ex.get("tenPhong") if ex else code),
                    "chuyenKhoa": dept_name,
                    "tang": r.tang or (ex.get("tang") if ex else "Tầng 1"),
                    "bacSiPhuTrach": ex.get("bacSiPhuTrach") if ex and ex.get("bacSiPhuTrach") else default_doc,
                    "trangThai": bool(r.is_active) if r.is_active is not None else True,
                }
                if ex:
                    for k, v in ex.items():
                        if k not in item:
                            item[k] = v
                projected_rooms.append(item)
                seen_room_codes.add(code)
            if is_demo_mode:
                for br in base_rooms:
                    c = str(br.get("maPhong") or br.get("id") or "").strip()
                    if c and c not in seen_room_codes:
                        bid = str(br.get("id") or f"ROOM-{c}").strip()
                        if bid in seen_room_ids:
                            bid = f"ROOM-SEED-{c}"
                        seen_room_ids.add(bid)
                        br["id"] = bid
                        projected_rooms.append(br)
                        seen_room_codes.add(c)
            saved_room_order = {
                str(r.get("maPhong") or r.get("id") or "").strip(): index for index, r in enumerate(base_rooms)
            }
            projected_rooms.sort(key=lambda item: saved_room_order.get(item["maPhong"], len(saved_room_order)))
            catalogs["khoaPhong"] = projected_rooms

        db_services = (
            await db.execute(
                select(DichVu)
                .options(selectinload(DichVu.phong_thuc_hien), selectinload(DichVu.chuyen_khoa))
                .order_by(DichVu.id.asc())
            )
        ).scalars().all()
        if db_services:
            base_services = catalogs.get("dichVu") or []
            srv_map = {str(s.get("maDV") or s.get("id") or "").strip(): s for s in base_services}
            projected_services = []
            seen_srv_codes = set()
            for s in db_services:
                code = str(s.ma_dich_vu or f"DV{s.id:03d}").strip()
                ex = srv_map.get(code)
                item = {
                    "id": ex.get("id") if ex and ex.get("id") else code,
                    "maDV": code,
                    "tenDV": s.ten_dich_vu or (ex.get("tenDV") if ex else code),
                    "nhomDV": _normalize_service_group(ex.get("nhomDV") if ex and ex.get("nhomDV") else s.ma_nhom_byt),
                    "dvt": s.don_vi_tinh or (ex.get("dvt") if ex else "Lần"),
                    "donGia": int(Decimal(str(s.don_gia or 0))),
                    "phongTH": s.phong_thuc_hien.ten_phong if s.phong_thuc_hien else (ex.get("phongTH") if ex else "Phòng kỹ thuật"),
                    "trangThai": bool(s.is_active) if s.is_active is not None else True,
                }
                if ex:
                    for k, v in ex.items():
                        if k not in item:
                            item[k] = v
                projected_services.append(item)
                seen_srv_codes.add(code)
            if is_demo_mode:
                for bsrv in base_services:
                    c = str(bsrv.get("maDV") or bsrv.get("id") or "").strip()
                    if c and c not in seen_srv_codes:
                        projected_services.append(bsrv)
                        seen_srv_codes.add(c)
            saved_service_order = {
                str(s.get("maDV") or s.get("id") or "").strip(): index for index, s in enumerate(base_services)
            }
            projected_services.sort(key=lambda item: saved_service_order.get(item["maDV"], len(saved_service_order)))
            catalogs["dichVu"] = projected_services

        db_drugs = (
            await db.execute(select(Thuoc).order_by(Thuoc.id.asc()))
        ).scalars().all()
        if db_drugs:
            base_drugs = catalogs.get("thuocVatTu") or []
            drug_map = {str(d.get("maThuoc") or d.get("id") or "").strip().upper(): d for d in base_drugs}
            projected_drugs = []
            seen_drug_codes = set()
            for d in db_drugs:
                code = str(d.ma_thuoc_noi_bo or f"TH{d.id:03d}").strip().upper()
                ex = drug_map.get(code)
                name = d.ten_thuoc or (ex.get("tenThuoc") if ex else code)
                active = d.hoat_chat or (ex.get("hoatChat") if ex else "")
                group = _classify_drug_group(name, active, code)
                if ex and ex.get("nhomThuoc") and ex.get("tenThuoc") == d.ten_thuoc:
                    group = ex.get("nhomThuoc")
                unit = d.don_vi_tinh or (ex.get("dvt") if ex else "Viên")
                usage = d.duong_dung or (ex.get("duongDung") if ex else "Uống sau ăn")
                strength = d.ham_luong or (ex.get("hamLuong") if ex else "")
                is_act = bool(d.is_active) if d.is_active is not None else True
                item = {
                    "id": ex.get("id") if (ex and ex.get("id")) else code,
                    "maThuoc": code,
                    "tenThuoc": name,
                    "hoatChat": active,
                    "hamLuong": strength,
                    "dvt": unit,
                    "donViTinh": unit,
                    "duongDung": usage,
                    "huongDan": usage,
                    "nhomThuoc": group,
                    "trangThai": is_act,
                    "is_active": is_act,
                }
                if ex:
                    for k, v in ex.items():
                        if k not in item:
                            item[k] = v
                projected_drugs.append(item)
                seen_drug_codes.add(code)
            for bd in base_drugs:
                c = str(bd.get("maThuoc") or bd.get("id") or "").strip().upper()
                if c and c not in seen_drug_codes:
                    projected_drugs.append(bd)
                    seen_drug_codes.add(c)
            catalogs["thuocVatTu"] = projected_drugs

        db_icds = (
            await db.execute(
                select(KhaiNiem)
                .where(KhaiNiem.loai_khai_niem == "benh_icd10")
                .order_by(KhaiNiem.ma_khai_niem.asc())
            )
        ).scalars().all()
        if db_icds:
            base_icds = catalogs.get("danhMucBenh") or []
            icd_map = {str(i.get("maICD") or i.get("id") or "").strip().upper(): i for i in base_icds}
            projected_icds = []
            seen_icd_codes = set()
            for i in db_icds:
                code = str(i.ma_khai_niem).strip().upper()
                ex = icd_map.get(code)
                name = i.ten_khai_niem or (ex.get("tenBenh") if ex else code)
                chapter = (ex.get("chuongBenh") if ex and ex.get("chuongBenh") else None) or i.mo_ta or _get_icd_chapter(code)
                is_infectious = (
                    bool(ex.get("truyenNhiem"))
                    if (ex and "truyenNhiem" in ex)
                    else _is_infectious_icd(code, name)
                )
                is_act = bool(i.is_active) if i.is_active is not None else True
                item = {
                    "id": ex.get("id") if (ex and ex.get("id")) else f"ICD-{code}",
                    "maICD": code,
                    "tenBenh": name,
                    "chuongBenh": chapter,
                    "truyenNhiem": is_infectious,
                    "trangThai": is_act,
                    "is_active": is_act,
                }
                if ex:
                    for k, v in ex.items():
                        if k not in item:
                            item[k] = v
                projected_icds.append(item)
                seen_icd_codes.add(code)
            for bi in base_icds:
                c = str(bi.get("maICD") or bi.get("id") or "").strip().upper()
                if c and c not in seen_icd_codes:
                    projected_icds.append(bi)
                    seen_icd_codes.add(c)
            catalogs["danhMucBenh"] = projected_icds

        # Project donViTinh from PostgreSQL Thuoc & DichVu tables
        db_thuoc_units = (
            await db.execute(
                select(Thuoc.don_vi_tinh, func.count(Thuoc.id))
                .where(Thuoc.don_vi_tinh.isnot(None), Thuoc.don_vi_tinh != "")
                .group_by(Thuoc.don_vi_tinh)
            )
        ).all()
        db_dv_units = (
            await db.execute(
                select(DichVu.don_vi_tinh, func.count(DichVu.id))
                .where(DichVu.don_vi_tinh.isnot(None), DichVu.don_vi_tinh != "")
                .group_by(DichVu.don_vi_tinh)
            )
        ).all()

        usage_counts: dict[str, int] = {}
        thuoc_counts: dict[str, int] = {}
        dv_counts: dict[str, int] = {}
        for u, cnt in db_thuoc_units:
            u_clean = str(u).strip()
            if u_clean:
                thuoc_counts[u_clean] = thuoc_counts.get(u_clean, 0) + int(cnt)
                usage_counts[u_clean] = usage_counts.get(u_clean, 0) + int(cnt)
        for u, cnt in db_dv_units:
            u_clean = str(u).strip()
            if u_clean:
                dv_counts[u_clean] = dv_counts.get(u_clean, 0) + int(cnt)
                usage_counts[u_clean] = usage_counts.get(u_clean, 0) + int(cnt)

        base_dvts = catalogs.get("donViTinh") or []

        def _make_dvt_code(name: str) -> str:
            import unicodedata, re
            nfd = unicodedata.normalize("NFD", name)
            ascii_str = "".join(c for c in nfd if unicodedata.category(c) != "Mn").replace("đ", "d").replace("Đ", "D")
            code = re.sub(r"[^A-Za-z0-9]+", "_", ascii_str).strip("_").upper()
            return code[:30] or "DVT"

        projected_dvts = []
        seen_dvt_names = set()

        for idx, d in enumerate(base_dvts):
            d_name = str(d.get("ten") or d.get("noiDung") or d.get("ma") or "").strip()
            if not d_name:
                continue
            d_key = d_name.lower()
            if d_key in seen_dvt_names:
                continue
            cnt = usage_counts.get(d_name, 0)
            if not cnt:
                for u_name, c_num in usage_counts.items():
                    if u_name.lower() in d_key or d_key in u_name.lower():
                        cnt += c_num
            scope = d.get("loai") or d.get("phamVi")
            if not scope:
                in_th = d_name in thuoc_counts
                in_dv = d_name in dv_counts
                if in_th and not in_dv:
                    scope = "THUOC"
                elif in_dv and not in_th:
                    scope = "DICH_VU"
                else:
                    scope = "CHUNG"
            desc = d.get("moTa") or (f"Áp dụng cho {cnt} bản ghi Thuốc & Dịch vụ" if cnt > 0 else "Đơn vị tính chuẩn phòng khám")
            item = {
                "id": d.get("id") or f"DVT-{_make_dvt_code(d_name)}",
                "ma": d.get("ma") or _make_dvt_code(d_name),
                "ten": d_name,
                "noiDung": d_name,
                "loai": scope,
                "phamVi": scope,
                "moTa": desc,
                "usageCount": cnt,
                "thuTu": d.get("thuTu") or (idx + 1),
                "trangThai": d.get("trangThai", True) if d.get("trangThai") is not None else True,
                "is_active": d.get("is_active", True) if d.get("is_active") is not None else True,
            }
            projected_dvts.append(item)
            seen_dvt_names.add(d_key)

        for u_name, cnt in sorted(usage_counts.items(), key=lambda x: -x[1]):
            u_key = u_name.lower()
            if u_key not in seen_dvt_names:
                code = _make_dvt_code(u_name)
                in_th = u_name in thuoc_counts
                in_dv = u_name in dv_counts
                scope = "THUOC" if (in_th and not in_dv) else ("DICH_VU" if (in_dv and not in_th) else "CHUNG")
                item = {
                    "id": f"DVT-{code}",
                    "ma": code,
                    "ten": u_name,
                    "noiDung": u_name,
                    "loai": scope,
                    "phamVi": scope,
                    "moTa": f"Dữ liệu thực tế từ PostgreSQL ({cnt} bản ghi đang áp dụng)",
                    "usageCount": cnt,
                    "thuTu": len(projected_dvts) + 1,
                    "trangThai": True,
                    "is_active": True,
                }
                projected_dvts.append(item)
                seen_dvt_names.add(u_key)

        catalogs["donViTinh"] = projected_dvts

        return catalogs

    async def _project_relational_vouchers(self, db: AsyncSession, base_vouchers: list, is_demo_mode: bool = True) -> list:
        stmt = (
            select(HoaDon)
            .options(
                selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HoaDon.chi_tiet_hoa_don),
            )
            .order_by(HoaDon.id.desc())
            .limit(100)
        )
        db_invoices = (await db.execute(stmt)).scalars().all()
        if not db_invoices:
            return base_vouchers if is_demo_mode else []

        base_map = {}
        for v in base_vouchers or []:
            code = str(v.get("maPhieu") or v.get("id") or "").strip()
            if code:
                base_map[code] = v
                base_map[f"HD-{code}"] = v

        result = []
        seen_codes = set()
        for hd in db_invoices:
            raw_code = str(hd.ma_hoa_don or f"HD-{hd.id}").strip()
            short_code = raw_code[3:] if raw_code.startswith("HD-PT") else raw_code
            ex = base_map.get(raw_code) or base_map.get(short_code)
            bn = hd.benh_nhan
            u = bn.nguoi_dung if bn else None
            bn_code = str(bn.ma_dinh_danh_y_te if bn and bn.ma_dinh_danh_y_te else (ex.get("maBN") if ex else f"BN{hd.benh_nhan_id:07d}")).strip()
            bn_name = (u.ho_ten if u and u.ho_ten else None) or (ex.get("hoTenBN") if ex else f"Bệnh nhân #{hd.benh_nhan_id}")
            lines = []
            for idx, ct in enumerate(hd.chi_tiet_hoa_don or [], start=1):
                lines.append({
                    "id": f"VI-{hd.id}-{idx}",
                    "tenKhoan": ct.ten_khoan_thu,
                    "soTien": int(Decimal(str(ct.thanh_tien or ct.don_gia or 0))),
                    "ghiChu": ct.ghi_chu or "Viện phí",
                })
            if not lines and ex and ex.get("items"):
                lines = ex["items"]
            amount_int = int(Decimal(str(hd.thuc_thu or hd.tong_tien or 0)))
            if not lines:
                lines = [{"id": f"VI-{hd.id}-1", "tenKhoan": hd.ghi_chu or "Thu tiền viện phí", "soTien": amount_int, "ghiChu": "Tại quầy"}]
            pay_method_raw = str(hd.phuong_thuc_thanh_toan or "").lower()
            if any(k in pay_method_raw for k in ["chuyen", "chuyển", "qr", "bank", "vietqr", "transfer"]):
                hinh_thuc = "Chuyển khoản (VietQR)"
            elif any(k in pay_method_raw for k in ["pos", "the", "thẻ", "card"]):
                hinh_thuc = "Thẻ POS"
            else:
                hinh_thuc = "Tiền mặt"
            voucher_id = ex.get("id") if ex and ex.get("id") else short_code
            voucher_code = ex.get("maPhieu") if ex and ex.get("maPhieu") else short_code
            item = {
                "id": voucher_id,
                "invoiceId": hd.id,
                "luotKhamId": hd.luot_kham_id,
                "maPhieu": voucher_code,
                "loaiPhieu": ex.get("loaiPhieu") if ex and ex.get("loaiPhieu") else "Phiếu thu",
                "tenPhieu": (ex.get("tenPhieu") if ex and ex.get("tenPhieu") else None) or hd.ghi_chu or f"Thu viện phí BN {bn_name}",
                "maBN": bn_code,
                "hoTenBN": bn_name,
                "ngayThu": (hd.ngay_thanh_toan or hd.created_at or datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M"),
                "nguoiThu": ex.get("nguoiThu") if ex and ex.get("nguoiThu") else "Thu ngân Viện phí",
                "hinhThuc": hinh_thuc,
                "daThu": hd.trang_thai == "da_thu",
                "ghiChu": hd.ghi_chu or (ex.get("ghiChu") if ex else ""),
                "items": lines,
                "tongTien": amount_int,
            }
            if ex:
                for k, v in ex.items():
                    if k not in item:
                        item[k] = v
            result.append(item)
            seen_codes.update({str(voucher_id), str(voucher_code), raw_code, short_code})

        if is_demo_mode:
            for bv in base_vouchers or []:
                c = str(bv.get("maPhieu") or bv.get("id") or "").strip()
                if c and c not in seen_codes and f"HD-{c}" not in seen_codes:
                    result.append(bv)
                    seen_codes.add(c)

        return result

    async def _project_relational_registrations(self, db: AsyncSession, base_registrations: list, is_demo_mode: bool = True) -> list:
        stmt_lk = (
            select(LuotKham)
            .options(
                selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LuotKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LuotKham.bac_si).selectinload(BacSi.phong_kham),
                selectinload(LuotKham.lich_kham),
            )
            .order_by(LuotKham.id.desc())
            .limit(100)
        )
        db_encounters = (await db.execute(stmt_lk)).scalars().all()

        stmt_queue = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(HangDoiKham.bac_si).selectinload(BacSi.phong_kham),
                selectinload(HangDoiKham.phong_kham),
                selectinload(HangDoiKham.lich_kham),
            )
            .order_by(HangDoiKham.id.desc())
            .limit(100)
        )
        db_tickets = (await db.execute(stmt_queue)).scalars().all()

        if not db_encounters and not db_tickets:
            return base_registrations if is_demo_mode else []

        base_map = {}
        for r in base_registrations or []:
            kcb = str(r.get("maKCB") or r.get("id") or "").strip()
            if kcb:
                base_map[kcb] = r

        result = []
        seen_kcb = set()
        seen_ids = set()
        handled_appointment_ids = set()
        handled_ticket_ids = set()

        for idx, lk in enumerate(db_encounters, start=1):
            bn = lk.benh_nhan
            u_bn = bn.nguoi_dung if bn else None
            bn_name = (u_bn.ho_ten if u_bn and u_bn.ho_ten else f"Bệnh nhân #{lk.benh_nhan_id}").strip()
            bs = lk.bac_si
            u_bs = bs.nguoi_dung if bs else None
            bs_name = f"{bs.hoc_vi + ' ' if bs and bs.hoc_vi else ''}{u_bs.ho_ten if u_bs else 'BS. Phòng khám'}".strip()
            spec_name = bs.chuyen_khoa.ten_chuyen_khoa if bs and bs.chuyen_khoa else "Nội tổng quát"
            room_name = bs.phong_kham.ten_phong if bs and bs.phong_kham else "Phòng số 1 (Phòng khám Nội)"
            is_done = bool(lk.is_locked or lk.thoi_gian_ket_thuc or lk.ket_luan_dieu_tri)
            apt_code = lk.lich_kham.ma_lich_kham if lk.lich_kham else ""
            kcb_code = str(lk.ma_kcb or (f"KCB-{apt_code}" if apt_code else f"KCB-{lk.id:06d}")).strip()

            if lk.lich_kham_id:
                handled_appointment_ids.add(lk.lich_kham_id)
            if lk.hang_doi_kham_id:
                handled_ticket_ids.add(lk.hang_doi_kham_id)

            if kcb_code in seen_kcb:
                continue

            item = {
                "id": kcb_code,
                "luotKhamId": lk.id,
                "stt": idx,
                "maKCB": kcb_code,
                "maLichHen": apt_code,
                "maBN": str(bn.ma_dinh_danh_y_te if bn and bn.ma_dinh_danh_y_te else f"BN{lk.benh_nhan_id:07d}"),
                "hoTen": bn_name,
                "ngaySinh": u_bn.ngay_sinh.isoformat() if u_bn and u_bn.ngay_sinh else "1990-01-01",
                "tuoi": f"{date.today().year - u_bn.ngay_sinh.year} tuổi" if u_bn and u_bn.ngay_sinh else "35 tuổi",
                "gioiTinh": u_bn.gioi_tinh if u_bn and u_bn.gioi_tinh else "Nam",
                "dienThoai": u_bn.so_dien_thoai if u_bn and u_bn.so_dien_thoai else "",
                "diaChi": u_bn.dia_chi if u_bn and u_bn.dia_chi else "",
                "phongKham": room_name,
                "chuyenKhoa": spec_name,
                "bacSi": bs_name,
                "ngayDangKy": (lk.thoi_gian_bat_dau or datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M"),
                "uuTien": False,
                "trieuChung": lk.ly_do_vao_kham or lk.trieu_chung or "Khám chuyên khoa",
                "ghiChu": lk.chan_doan_so_bo or "",
                "trangThai": "Đã khám" if is_done else "Đang khám",
                "emrLocked": bool(lk.is_locked),
                "vitals": {
                    "mach": str(lk.mach_lan_phut or 76),
                    "nhietDo": str(lk.nhiet_do_c or 36.6),
                    "huyetAp": f"{lk.huyet_ap_tam_thu or 120}/{lk.huyet_ap_tam_truong or 80}",
                    "nhipTho": str(lk.nhip_tho_lan_phut or 18),
                    "chieuCao": str(lk.chieu_cao_cm or 168),
                    "canNang": str(lk.can_nang_kg or 62),
                    "bmi": str(lk.bmi or 22.0),
                },
                "clinicalNotes": {
                    "trieuChungBanDau": lk.ly_do_vao_kham or "",
                    "ketQuaKham": lk.kham_lam_sang_bo_phan or "",
                    "huongXuTri": lk.ket_luan_dieu_tri or "",
                    "chanDoanSoBo": lk.chan_doan_so_bo or "",
                    "chanDoanXacDinh": lk.ket_luan_dieu_tri or "",
                },
                "icdList": [],
                "services": [],
            }
            result.append(item)
            seen_kcb.add(kcb_code)
            seen_ids.add(item["id"])

        for t in db_tickets:
            if t.id in handled_ticket_ids or (t.lich_kham_id and t.lich_kham_id in handled_appointment_ids):
                continue

            apt_code = t.lich_kham.ma_lich_kham if t.lich_kham else ""
            kcb_code = apt_code if apt_code else f"KCB-Q{t.id:05d}"
            if kcb_code in seen_kcb:
                continue

            bn = t.benh_nhan
            u_bn = bn.nguoi_dung if bn else None
            bn_name = (u_bn.ho_ten if u_bn and u_bn.ho_ten else f"Bệnh nhân #{t.benh_nhan_id}").strip()
            bs = t.bac_si
            u_bs = bs.nguoi_dung if bs else None
            bs_name = f"{bs.hoc_vi + ' ' if bs and bs.hoc_vi else ''}{u_bs.ho_ten if u_bs else 'BS. Phòng khám'}".strip()
            spec_name = bs.chuyen_khoa.ten_chuyen_khoa if bs and bs.chuyen_khoa else "Nội tổng quát"
            pk = t.phong_kham or (bs.phong_kham if bs else None)
            room_name = pk.ten_phong if pk else "Phòng số 1 (Phòng khám Nội)"

            ticket_status = str(t.trang_thai or "").lower()
            if ticket_status in ("cho_kham", "cho_goi", "dang_goi", "tam_hoan"):
                display_status = "Chờ khám"
            elif ticket_status == "dang_kham":
                display_status = "Đang khám"
            elif ticket_status == "da_kham":
                display_status = "Đã khám"
            else:
                display_status = "Chờ khám"

            item = {
                "id": kcb_code,
                "ticketId": t.id,
                "stt": len(result) + 1,
                "maKCB": kcb_code,
                "maLichHen": apt_code,
                "maBN": str(bn.ma_dinh_danh_y_te if bn and bn.ma_dinh_danh_y_te else f"BN{t.benh_nhan_id:07d}"),
                "hoTen": bn_name,
                "ngaySinh": u_bn.ngay_sinh.isoformat() if u_bn and u_bn.ngay_sinh else "1990-01-01",
                "tuoi": f"{date.today().year - u_bn.ngay_sinh.year} tuổi" if u_bn and u_bn.ngay_sinh else "35 tuổi",
                "gioiTinh": u_bn.gioi_tinh if u_bn and u_bn.gioi_tinh else "Nam",
                "dienThoai": u_bn.so_dien_thoai if u_bn and u_bn.so_dien_thoai else "",
                "diaChi": u_bn.dia_chi if u_bn and u_bn.dia_chi else "",
                "phongKham": room_name,
                "chuyenKhoa": spec_name,
                "bacSi": bs_name,
                "ngayDangKy": (t.thoi_gian_check_in or datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M"),
                "uuTien": bool(t.muc_do_uu_tien == 1),
                "trieuChung": t.ghi_chu_dieu_phoi or "Tiếp đón tại quầy",
                "ghiChu": f"Số thứ tự #{t.so_thu_tu_kham}",
                "trangThai": display_status,
                "emrLocked": False,
                "vitals": {
                    "mach": "76",
                    "nhietDo": "36.8",
                    "huyetAp": "120/80",
                    "nhipTho": "18",
                    "chieuCao": "165",
                    "canNang": "60",
                    "bmi": "22.0",
                },
                "clinicalNotes": {
                    "trieuChungBanDau": t.ghi_chu_dieu_phoi or "",
                    "ketQuaKham": "",
                    "huongXuTri": "",
                    "chanDoanSoBo": "",
                    "chanDoanXacDinh": "",
                },
                "icdList": [],
                "services": [],
            }
            result.append(item)
            seen_kcb.add(kcb_code)
            seen_ids.add(item["id"])

        if is_demo_mode:
            for br in base_registrations or []:
                c = str(br.get("maKCB") or br.get("id") or "").strip()
                if c and c not in seen_kcb and c not in seen_ids:
                    br_copy = copy.deepcopy(br)
                    br_copy["stt"] = len(result) + 1
                    result.append(br_copy)
                    seen_kcb.add(c)
                    seen_ids.add(c)

        return result

    async def sync_all_collections_to_relational(
        self,
        db: AsyncSession,
        data: dict,
        existing_bff_keys: Optional[set] = None,
    ) -> None:
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
            "appointments",
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
        if not hasattr(self, "_bff_collections"):
            self._bff_collections = {}
        self._bff_collections[key] = value

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

        if collection_key == "staffList":
            raise BadRequestException("staffList không còn được lưu qua dữ liệu BFF. Hãy dùng API hồ sơ nhân sự và bác sĩ chuyên dụng.")

        elif collection_key == "patients":
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

        elif collection_key == "appointments":
            status_reverse_map = {
                "chờ xác nhận": "cho_xac_nhan",
                "xác nhận": "da_xac_nhan",
                "đã tiếp nhận": "da_tiep_nhan",
                "đang khám": "dang_kham",
                "kết thúc khám": "da_kham",
                "từ chối": "da_huy",
                "đã hủy": "da_huy",
            }
            first_user, first_bn, first_bs, _ = await self._ensure_default_entities(db)
            for apt in items:
                code = str(apt.get("maLH") or apt.get("id") or "").strip()
                if not code:
                    continue
                apt_id = apt.get("appointmentId")
                stmt = select(LichKham).where(
                    or_(LichKham.ma_lich_kham == code, LichKham.id == apt_id)
                    if apt_id
                    else LichKham.ma_lich_kham == code
                )
                existing = (await db.execute(stmt)).scalars().first()
                raw_st = str(apt.get("trangThai") or "").strip().lower()
                target_status = status_reverse_map.get(raw_st, "da_xac_nhan")
                dt_str = apt.get("ngayDatLich")
                d_val = _parse_date_safe(dt_str, date.today())
                t_val = time(8, 0)
                if isinstance(dt_str, str) and "T" in dt_str:
                    try:
                        t_parts = dt_str.split("T")[1][:5].split(":")
                        t_val = time(int(t_parts[0]), int(t_parts[1]))
                    except Exception:
                        pass
                if existing:
                    existing.trang_thai = target_status
                    existing.ngay_kham = d_val
                    existing.gio_kham = t_val
                    existing.ly_do_kham = str(apt.get("trieuChung") or existing.ly_do_kham or "")[:255]
                    if target_status == "da_xac_nhan" and not existing.thoi_gian_xac_nhan:
                        existing.thoi_gian_xac_nhan = datetime.now(timezone.utc)
                    elif target_status in ("da_huy", "no_show"):
                        if not existing.thoi_gian_huy:
                            existing.thoi_gian_huy = datetime.now(timezone.utc)
                        existing.ly_do_huy = str(apt.get("noiDungXacNhan") or existing.ly_do_huy or "Hủy bởi quản trị viên")
                else:
                    db.add(LichKham(
                        ma_lich_kham=code[:50],
                        benh_nhan_id=first_bn.id,
                        bac_si_id=first_bs.id if first_bs else None,
                        ngay_kham=d_val,
                        gio_kham=t_val,
                        thoi_luong_phut=30,
                        so_thu_tu=1,
                        ly_do_kham=str(apt.get("trieuChung") or "Khám theo hẹn")[:255],
                        trang_thai=target_status,
                        thoi_gian_xac_nhan=datetime.now(timezone.utc) if target_status == "da_xac_nhan" else None,
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
            pass

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
                            active_lk_hd = (
                                await db.execute(
                                    select(HoaDon.id).where(
                                        HoaDon.luot_kham_id == first_lk.id,
                                        HoaDon.trang_thai.in_(["chua_thu", "da_thu"]),
                                    )
                                )
                            ).scalars().first()
                            assigned_lk_id = None if active_lk_hd else first_lk.id
                            existing_hd = HoaDon(
                                ma_hoa_don=hd_code,
                                luot_kham_id=assigned_lk_id,
                                benh_nhan_id=first_bn.id,
                                thu_ngan_id=staff_id,
                                tong_tien=amount,
                                mien_giam=Decimal("0"),
                                thuc_thu=amount,
                                phuong_thuc_thanh_toan=str(v.get("hinhThuc") or "tien_mat")[:30],
                                trang_thai="da_thu" if v.get("daThu") else "chua_thu",
                                ghi_chu=str(v.get("tenPhieu") or ""),
                                ngay_thanh_toan=datetime.now(timezone.utc) if v.get("daThu") else None,
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
            pass

    async def _sync_catalog_relational_tables(
        self,
        db: AsyncSession,
        sub_key: str,
        items: Any,
        prev_items: Optional[list] = None,
        catalogs: Optional[dict] = None,
    ) -> None:
        if not isinstance(items, list):
            return

        if sub_key == "khoaPhong":
            for r in items:
                code = str(r.get("maPhong") or r.get("id") or "").strip()
                if not code:
                    continue
                ck_name = str(r.get("chuyenKhoa") or "").strip()
                ck_id = None
                if ck_name:
                    stmt_ck = select(ChuyenKhoa.id).where(
                        or_(
                            ChuyenKhoa.ten_chuyen_khoa == ck_name,
                            ChuyenKhoa.ten_chuyen_khoa.ilike(f"%{ck_name}%"),
                            ChuyenKhoa.ma_chuyen_khoa.ilike(f"%{ck_name}%"),
                        )
                    ).limit(1)
                    ck_id = (await db.execute(stmt_ck)).scalar_one_or_none()

                is_act = bool(r.get("trangThai", True) if r.get("trangThai") is not None else r.get("is_active", True))
                stmt = select(PhongKham).where(PhongKham.ma_phong == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.ten_phong = str(r.get("tenPhong") or existing.ten_phong)[:100]
                    if r.get("tang"):
                        existing.tang = str(r.get("tang"))[:20]
                    if ck_id:
                        existing.chuyen_khoa_id = ck_id
                    existing.is_active = is_act
                else:
                    db.add(PhongKham(
                        ma_phong=code[:50],
                        ten_phong=str(r.get("tenPhong") or code)[:100],
                        tang=str(r.get("tang") or "Tầng 1")[:20],
                        chuyen_khoa_id=ck_id,
                        loai_phong="kham_benh",
                        is_active=is_act,
                    ))

        elif sub_key == "dichVu":
            for s in items:
                code = str(s.get("maDV") or s.get("id") or "").strip()
                if not code:
                    continue
                stmt = select(DichVu).where(DichVu.ma_dich_vu == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                price = _parse_decimal_safe(s.get("giaDV") or s.get("donGia") or 150000)
                dvt_val = str(s.get("donViTinh") or s.get("dvt") or "Lần")[:30]
                nhom_val = str(s.get("loaiDV") or s.get("nhomDV") or "CLS")[:50]
                is_act = bool(s.get("trangThai", True) if s.get("trangThai") is not None else s.get("is_active", True))
                if existing:
                    existing.ten_dich_vu = str(s.get("tenDV") or existing.ten_dich_vu)[:150]
                    existing.don_gia = price
                    existing.don_vi_tinh = dvt_val
                    existing.ma_nhom_byt = nhom_val
                    existing.is_active = is_act
                else:
                    db.add(DichVu(
                        ma_dich_vu=code[:50],
                        ten_dich_vu=str(s.get("tenDV") or code)[:150],
                        don_gia=price,
                        don_vi_tinh=dvt_val,
                        ma_nhom_byt=nhom_val,
                        is_active=is_act,
                    ))

        elif sub_key == "thuocVatTu":
            for item in items:
                code = str(item.get("maThuoc") or item.get("ma") or item.get("id") or "").strip().upper()
                if not code:
                    continue
                name = str(item.get("tenThuoc") or item.get("ten") or code).strip()
                active_ing = str(item.get("hoatChat") or "").strip() or None
                strength = str(item.get("hamLuong") or "").strip() or None
                unit = str(item.get("dvt") or item.get("donViTinh") or "Viên").strip()[:50]
                usage = str(item.get("duongDung") or item.get("huongDan") or "Uống sau ăn").strip()[:100]
                is_act = bool(item.get("trangThai", True) if item.get("trangThai") is not None else item.get("is_active", True))

                stmt = select(Thuoc).where(Thuoc.ma_thuoc_noi_bo == code[:50])
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.ten_thuoc = name[:255]
                    if active_ing:
                        existing.hoat_chat = active_ing[:255]
                    if strength:
                        existing.ham_luong = strength[:100]
                    existing.don_vi_tinh = unit
                    existing.duong_dung = usage
                    existing.is_active = is_act
                else:
                    db.add(Thuoc(
                        ma_thuoc_noi_bo=code[:50],
                        ten_thuoc=name[:255],
                        hoat_chat=active_ing[:255] if active_ing else None,
                        ham_luong=strength[:100] if strength else None,
                        don_vi_tinh=unit,
                        duong_dung=usage,
                        is_active=is_act,
                    ))

        elif sub_key == "danhMucBenh":
            for item in items:
                code = str(item.get("maICD") or item.get("ma") or item.get("id") or "").strip().upper()
                if not code:
                    continue
                name = str(item.get("tenBenh") or item.get("ten") or code).strip()
                chapter = str(item.get("chuongBenh") or item.get("moTa") or "").strip()[:255]
                is_act = bool(item.get("trangThai", True) if item.get("trangThai") is not None else item.get("is_active", True))

                stmt = select(KhaiNiem).where(
                    KhaiNiem.ma_khai_niem == code[:50],
                    KhaiNiem.loai_khai_niem == "benh_icd10",
                )
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.ten_khai_niem = name[:255]
                    if chapter:
                        existing.mo_ta = chapter
                    existing.is_active = is_act
                else:
                    db.add(KhaiNiem(
                        ma_khai_niem=code[:50],
                        ten_khai_niem=name[:255],
                        loai_khai_niem="benh_icd10",
                        mo_ta=chapter or None,
                        is_active=is_act,
                    ))

        elif sub_key == "chuyenKhoa":
            for item in items:
                code = str(item.get("maChuyenKhoa") or item.get("maCK") or item.get("ma") or item.get("id") or "").strip().upper()
                if not code:
                    continue
                name = str(item.get("tenChuyenKhoa") or item.get("ten") or code).strip()
                loc = str(item.get("viTriPhong") or "").strip()[:100]
                desc = str(item.get("moTa") or "").strip()
                is_act = bool(item.get("trangThai", True) if item.get("trangThai") is not None else item.get("is_active", True))

                stmt = select(ChuyenKhoa).where(
                    or_(
                        ChuyenKhoa.ma_chuyen_khoa == code[:50],
                        ChuyenKhoa.ten_chuyen_khoa == name[:100],
                    )
                )
                existing = (await db.execute(stmt)).scalar_one_or_none()
                if existing:
                    existing.ten_chuyen_khoa = name[:100]
                    existing.ma_chuyen_khoa = code[:50]
                    if loc:
                        existing.vi_tri_phong = loc
                    if desc:
                        existing.mo_ta = desc
                    existing.is_active = is_act
                else:
                    db.add(ChuyenKhoa(
                        ma_chuyen_khoa=code[:50],
                        ten_chuyen_khoa=name[:100],
                        vi_tri_phong=loc or None,
                        mo_ta=desc or None,
                        is_active=is_act,
                    ))

        elif sub_key == "donViTinh":
            if prev_items and isinstance(items, list):
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    item_id = str(item.get("id") or "").strip()
                    item_code = str(item.get("ma") or "").strip().upper()
                    new_name = str(item.get("ten") or item.get("noiDung") or item_code).strip()
                    if not new_name:
                        continue

                    matched_prev = None
                    for prev in prev_items:
                        if not isinstance(prev, dict):
                            continue
                        p_id = str(prev.get("id") or "").strip()
                        p_code = str(prev.get("ma") or "").strip().upper()
                        if (item_id and p_id and item_id == p_id) or (item_code and p_code and item_code == p_code):
                            matched_prev = prev
                            break

                    if matched_prev:
                        old_name = str(matched_prev.get("ten") or matched_prev.get("noiDung") or matched_prev.get("ma") or "").strip()
                        if old_name and old_name != new_name:
                            # 1. Cascade update Thuoc table in PostgreSQL
                            await db.execute(
                                update(Thuoc)
                                .where(Thuoc.don_vi_tinh == old_name)
                                .values(don_vi_tinh=new_name)
                            )
                            # 2. Cascade update DichVu table in PostgreSQL
                            await db.execute(
                                update(DichVu)
                                .where(DichVu.don_vi_tinh == old_name)
                                .values(don_vi_tinh=new_name)
                            )
                            # 3. Cascade update in-memory / JSON catalogs
                            if catalogs is not None:
                                for th in catalogs.get("thuocVatTu") or []:
                                    if str(th.get("dvt") or th.get("donViTinh") or "").strip() == old_name:
                                        th["dvt"] = new_name
                                        th["donViTinh"] = new_name
                                for dv in catalogs.get("dichVu") or []:
                                    if str(dv.get("dvt") or dv.get("donViTinh") or "").strip() == old_name:
                                        dv["dvt"] = new_name
                                        dv["donViTinh"] = new_name

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
        current_data[collection_key] = items
        await self._append_audit_entry(db, current_data, audit_entry, default_target=collection_key, user_id=user_id)

        await db.commit()
        current_data["inventoryBatches"] = []
        return current_data

    async def _delete_catalog_relational_item(
        self,
        db: AsyncSession,
        sub_key: str,
        item: dict,
        item_key: Optional[str] = None,
    ) -> None:
        if not item or not isinstance(item, dict):
            return

        if sub_key == "chuyenKhoa":
            code = str(item.get("maChuyenKhoa") or item.get("maCK") or item.get("ma") or item.get("id") or item_key or "").strip().upper()
            name = str(item.get("tenChuyenKhoa") or item.get("ten") or "").strip()

            conditions = []
            if code:
                conditions.append(ChuyenKhoa.ma_chuyen_khoa == code[:50])
                if code.startswith("CK-"):
                    try:
                        conditions.append(ChuyenKhoa.id == int(code.replace("CK-", "")))
                    except ValueError:
                        pass
            if name:
                conditions.append(ChuyenKhoa.ten_chuyen_khoa == name[:100])
                conditions.append(ChuyenKhoa.ten_chuyen_khoa.ilike(name[:100]))
            raw_id = str(item.get("id") or "").strip()
            if raw_id.isdigit():
                conditions.append(ChuyenKhoa.id == int(raw_id))
            elif raw_id.startswith("CK-"):
                try:
                    conditions.append(ChuyenKhoa.id == int(raw_id.replace("CK-", "")))
                except ValueError:
                    pass

            if not conditions:
                return

            stmt = select(ChuyenKhoa).where(or_(*conditions)).limit(1)
            target = (await db.execute(stmt)).scalar_one_or_none()
            if not target:
                return

            cnt_bs = (await db.execute(select(func.count(BacSi.id)).where(BacSi.chuyen_khoa_id == target.id))).scalar() or 0
            cnt_pk = (await db.execute(select(func.count(PhongKham.id)).where(PhongKham.chuyen_khoa_id == target.id))).scalar() or 0
            cnt_lk = (await db.execute(select(func.count(LichKham.id)).where(LichKham.chuyen_khoa_id == target.id))).scalar() or 0
            cnt_dv = (await db.execute(select(func.count(DichVu.id)).where(DichVu.chuyen_khoa_id == target.id))).scalar() or 0
            cnt_pkck = (await db.execute(select(func.count(PhieuKhamChuyenKhoa.id)).where(PhieuKhamChuyenKhoa.chuyen_khoa_id == target.id))).scalar() or 0

            reasons = []
            if cnt_bs > 0:
                reasons.append(f"{cnt_bs} bác sĩ thuộc chuyên khoa")
            if cnt_pk > 0:
                reasons.append(f"{cnt_pk} phòng khám trực thuộc")
            if cnt_lk > 0:
                reasons.append(f"{cnt_lk} lịch khám hẹn của bệnh nhân")
            if cnt_dv > 0:
                reasons.append(f"{cnt_dv} dịch vụ kỹ thuật")
            if cnt_pkck > 0:
                reasons.append(f"{cnt_pkck} phiếu khám chuyên khoa")

            if reasons:
                details = ", ".join(reasons)
                raise ConflictException(
                    f"Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: {details}. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!"
                )

            try:
                await db.delete(target)
                await db.flush()
            except IntegrityError:
                await db.rollback()
                raise ConflictException(
                    "Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: Ràng buộc toàn vẹn cơ sở dữ liệu y tế."
                )

        elif sub_key == "khoaPhong":
            code = str(item.get("maPhong") or item.get("id") or item_key or "").strip()
            name = str(item.get("tenPhong") or "").strip()

            conditions = []
            if code:
                conditions.append(PhongKham.ma_phong == code[:50])
                clean_code = code.replace(".", "")
                conditions.append(PhongKham.ma_phong == clean_code[:50])
                conditions.append(PhongKham.ma_phong == f"ROOM-{code}"[:50])
            if name:
                conditions.append(PhongKham.ten_phong == name[:100])
                conditions.append(PhongKham.ten_phong.ilike(name[:100]))
            raw_id = str(item.get("id") or "").strip()
            if raw_id.isdigit():
                conditions.append(PhongKham.id == int(raw_id))
            elif "ROOM-DB-" in raw_id:
                try:
                    num = int(raw_id.replace("ROOM-DB-", ""))
                    conditions.append(PhongKham.id == num)
                except ValueError:
                    pass

            if not conditions:
                return

            stmt = select(PhongKham).where(or_(*conditions)).limit(1)
            target = (await db.execute(stmt)).scalar_one_or_none()
            if not target:
                return

            cnt_bs = (await db.execute(select(func.count(BacSi.id)).where(BacSi.phong_kham_id == target.id))).scalar() or 0
            cnt_cd = (await db.execute(select(func.count(ChiDinh.id)).where(ChiDinh.phong_thuc_hien_id == target.id))).scalar() or 0
            cnt_dv = (await db.execute(select(func.count(DichVu.id)).where(DichVu.phong_thuc_hien_id == target.id))).scalar() or 0
            cnt_pkck = (await db.execute(select(func.count(PhieuKhamChuyenKhoa.id)).where(PhieuKhamChuyenKhoa.phong_kham_id == target.id))).scalar() or 0
            cnt_hd = (await db.execute(select(func.count(HangDoiKham.id)).where(HangDoiKham.phong_kham_id == target.id))).scalar() or 0
            cnt_llv = (await db.execute(select(func.count(LichLamViec.id)).where(LichLamViec.phong_kham_id == target.id))).scalar() or 0

            reasons = []
            if cnt_bs > 0:
                reasons.append(f"{cnt_bs} bác sĩ đang phụ trách/phân công")
            if cnt_cd > 0:
                reasons.append(f"{cnt_cd} chỉ định dịch vụ y tế tại phòng")
            if cnt_dv > 0:
                reasons.append(f"{cnt_dv} dịch vụ kỹ thuật liên kết phòng")
            if cnt_llv > 0:
                reasons.append(f"{cnt_llv} ca trực/lịch làm việc")
            if cnt_pkck > 0:
                reasons.append(f"{cnt_pkck} phiếu khám bệnh")
            if cnt_hd > 0:
                reasons.append(f"{cnt_hd} lượt hàng đợi khám")

            if reasons:
                details = ", ".join(reasons)
                raise ConflictException(
                    f"Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: {details}. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!"
                )

            try:
                await db.delete(target)
                await db.flush()
            except IntegrityError:
                await db.rollback()
                raise ConflictException(
                    "Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: Ràng buộc toàn vẹn cơ sở dữ liệu y tế."
                )

        elif sub_key == "dichVu":
            code = str(item.get("maDV") or item.get("id") or item_key or "").strip()
            name = str(item.get("tenDV") or "").strip()

            conditions = []
            if code:
                conditions.append(DichVu.ma_dich_vu == code[:50])
            if name:
                conditions.append(DichVu.ten_dich_vu == name[:150])
                conditions.append(DichVu.ten_dich_vu.ilike(name[:150]))
            raw_id = str(item.get("id") or "").strip()
            if raw_id.isdigit():
                conditions.append(DichVu.id == int(raw_id))

            if not conditions:
                return

            stmt = select(DichVu).where(or_(*conditions)).limit(1)
            target = (await db.execute(stmt)).scalar_one_or_none()
            if not target:
                return

            cnt_cd = (await db.execute(select(func.count(ChiDinh.id)).where(ChiDinh.dich_vu_id == target.id))).scalar() or 0
            cnt_gk = (await db.execute(select(func.count(ChiTietGoiKham.id)).where(ChiTietGoiKham.dich_vu_id == target.id))).scalar() or 0
            cnt_gdm = (await db.execute(select(func.count(ChiTietGoiKhamDaMua.id)).where(ChiTietGoiKhamDaMua.dich_vu_id == target.id))).scalar() or 0

            reasons = []
            if cnt_cd > 0:
                reasons.append(f"{cnt_cd} chỉ định cận lâm sàng trong hồ sơ bệnh án")
            if cnt_gk > 0:
                reasons.append(f"{cnt_gk} cấu hình gói khám dịch vụ")
            if cnt_gdm > 0:
                reasons.append(f"{cnt_gdm} lượt gói dịch vụ đã mua của bệnh nhân")

            if reasons:
                details = ", ".join(reasons)
                raise ConflictException(
                    f"Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: {details}. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!"
                )

            try:
                await db.delete(target)
                await db.flush()
            except IntegrityError:
                await db.rollback()
                raise ConflictException(
                    "Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: Ràng buộc toàn vẹn cơ sở dữ liệu y tế."
                )

        elif sub_key == "thuocVatTu":
            code = str(item.get("maThuoc") or item.get("ma") or item.get("id") or item_key or "").strip().upper()
            name = str(item.get("tenThuoc") or item.get("ten") or "").strip()

            conditions = []
            if code:
                conditions.append(Thuoc.ma_thuoc_noi_bo == code[:50])
            if name:
                conditions.append(Thuoc.ten_thuoc == name[:255])
                conditions.append(Thuoc.ten_thuoc.ilike(name[:255]))
            raw_id = str(item.get("id") or "").strip()
            if raw_id.isdigit():
                conditions.append(Thuoc.id == int(raw_id))

            if not conditions:
                return

            stmt = select(Thuoc).where(or_(*conditions)).limit(1)
            target = (await db.execute(stmt)).scalar_one_or_none()
            if not target:
                return

            cnt_dt = (await db.execute(select(func.count(ChiTietDonThuoc.id)).where(
                or_(
                    ChiTietDonThuoc.thuoc_id == target.id,
                    ChiTietDonThuoc.ten_thuoc == target.ten_thuoc,
                )
            ))).scalar() or 0

            reasons = []
            if cnt_dt > 0:
                reasons.append(f"{cnt_dt} đơn thuốc đã kê cho bệnh nhân")

            if reasons:
                details = ", ".join(reasons)
                raise ConflictException(
                    f"Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: {details}. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!"
                )

            try:
                await db.delete(target)
                await db.flush()
            except IntegrityError:
                await db.rollback()
                raise ConflictException(
                    "Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: Ràng buộc toàn vẹn cơ sở dữ liệu y tế."
                )

        elif sub_key == "danhMucBenh":
            code = str(item.get("maICD") or item.get("ma") or item.get("id") or item_key or "").strip().upper()
            name = str(item.get("tenBenh") or item.get("ten") or "").strip()

            conditions = []
            if code:
                conditions.append(KhaiNiem.ma_khai_niem == code[:50])
            if name:
                conditions.append(KhaiNiem.ten_khai_niem == name[:255])
                conditions.append(KhaiNiem.ten_khai_niem.ilike(name[:255]))
            raw_id = str(item.get("id") or "").strip()
            if raw_id.isdigit():
                conditions.append(KhaiNiem.id == int(raw_id))

            if not conditions:
                return

            stmt = select(KhaiNiem).where(
                and_(
                    or_(*conditions),
                    KhaiNiem.loai_khai_niem == "benh_icd10"
                )
            ).limit(1)
            target = (await db.execute(stmt)).scalar_one_or_none()
            if not target:
                return

            cnt_cd = (await db.execute(select(func.count(ChanDoan.id)).where(
                or_(
                    ChanDoan.khai_niem_id == target.id,
                    ChanDoan.ma_icd10 == target.ma_khai_niem,
                )
            ))).scalar() or 0

            reasons = []
            if cnt_cd > 0:
                reasons.append(f"{cnt_cd} hồ sơ chẩn đoán bệnh án của bệnh nhân")

            if reasons:
                details = ", ".join(reasons)
                raise ConflictException(
                    f"Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: {details}. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!"
                )

            try:
                await db.delete(target)
                await db.flush()
            except IntegrityError:
                await db.rollback()
                raise ConflictException(
                    "Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: Ràng buộc toàn vẹn cơ sở dữ liệu y tế."
                )

        elif sub_key == "donViTinh":
            unit_name = str(item.get("ten") or item.get("noiDung") or item.get("ma") or item_key or "").strip()
            if not unit_name:
                return

            cnt_thuoc = (await db.execute(
                select(func.count(Thuoc.id)).where(Thuoc.don_vi_tinh == unit_name)
            )).scalar() or 0
            cnt_dv = (await db.execute(
                select(func.count(DichVu.id)).where(DichVu.don_vi_tinh == unit_name)
            )).scalar() or 0

            reasons = []
            if cnt_thuoc > 0:
                reasons.append(f"{cnt_thuoc} thuốc kê đơn trong danh mục")
            if cnt_dv > 0:
                reasons.append(f"{cnt_dv} dịch vụ kỹ thuật")

            if reasons:
                details = ", ".join(reasons)
                raise ConflictException(
                    f"Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: {details}. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!"
                )

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
        if settings.ENVIRONMENT.lower() in ("production", "prod"):
            raise PermissionError("THAO TÁC BỊ CHẶN: Không thể khôi phục dữ liệu demo trên môi trường PRODUCTION!")
        if hasattr(self, "_bff_collections"):
            self._bff_collections.clear()
        self._initial_relational_synced = False
        return await self.get_bootstrap_data(db)


bff_admin_service = BffAdminService()
