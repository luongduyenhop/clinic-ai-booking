import copy
import json
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional
from sqlalchemy import delete, select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import HangDoiKham, LichKham
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
            # Employee and doctor screens use relational records through dedicated
            # endpoints. Never seed the old demo staff collection into bootstrap.
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

        stmt = select(HeThongTrangThaiBff)
        rows = (await db.execute(stmt)).scalars().all()
        existing_keys = set()
        for row in rows:
            existing_keys.add(row.collection_key)
            if row.collection_key in ("inventoryBatches", "navigationConfig"):
                continue
            if row.collection_key == "catalogs" and isinstance(row.data_json, dict):
                merged_catalogs = copy.deepcopy(data.get("catalogs", {}))
                merged_catalogs.update(row.data_json)
                data["catalogs"] = merged_catalogs
            else:
                data[row.collection_key] = row.data_json

        data["inventoryBatches"] = []
        if len(existing_keys) < 5:
            await self.sync_all_collections_to_relational(db, data, existing_keys)

        data["patients"] = await self._project_relational_patients(db, data.get("patients", []))
        data["appointments"] = await self._project_relational_appointments(db, data.get("appointments", []))
        data["staffList"] = await self._project_relational_staff(db)
        data["catalogs"] = await self._project_relational_catalogs(db, data.get("catalogs", {}))
        data["vouchers"] = await self._project_relational_vouchers(db, data.get("vouchers", []))
        data["registrations"] = await self._project_relational_registrations(db, data.get("registrations", []))

        return data

    async def _project_relational_appointments(self, db: AsyncSession, base_appointments: list) -> list:
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
            return base_appointments

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

        for a in base_appointments or []:
            c = str(a.get("maLH") or a.get("id") or "").strip()
            if c and c not in seen_codes:
                result.append(a)
                seen_codes.add(c)

        return result

    async def _project_relational_patients(self, db: AsyncSession, base_patients: list) -> list:
        stmt = (
            select(BenhNhan)
            .options(selectinload(BenhNhan.nguoi_dung))
            .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
            .where(NguoiDung.is_deleted.is_(False))
            .order_by(BenhNhan.id.desc())
        )
        db_patients = (await db.execute(stmt)).scalars().all()
        if not db_patients:
            return base_patients

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

    async def _project_relational_catalogs(self, db: AsyncSession, base_catalogs: dict) -> dict:
        catalogs = copy.deepcopy(base_catalogs or {})

        db_rooms = (
            await db.execute(select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).order_by(PhongKham.id.asc()))
        ).scalars().all()
        if db_rooms:
            base_rooms = catalogs.get("khoaPhong") or []
            room_map = {str(r.get("maPhong") or r.get("id") or "").strip(): r for r in base_rooms}
            projected_rooms = []
            seen_room_codes = set()
            for r in db_rooms:
                code = str(r.ma_phong or f"PK{r.id:02d}").strip()
                ex = room_map.get(code)
                item = {
                    "id": ex.get("id") if ex and ex.get("id") else f"KP-{r.id:02d}",
                    "maPhong": code,
                    "tenPhong": r.ten_phong or (ex.get("tenPhong") if ex else code),
                    "chuyenKhoa": r.chuyen_khoa.ten_chuyen_khoa if r.chuyen_khoa else (ex.get("chuyenKhoa") if ex else "Đa khoa"),
                    "tang": r.tang or (ex.get("tang") if ex else "Tầng 1"),
                    "bacSiPhuTrach": ex.get("bacSiPhuTrach") if ex and ex.get("bacSiPhuTrach") else "PGS.TS Phạm Đức Minh",
                    "trangThai": bool(r.is_active) if r.is_active is not None else True,
                }
                if ex:
                    for k, v in ex.items():
                        if k not in item:
                            item[k] = v
                projected_rooms.append(item)
                seen_room_codes.add(code)
            for br in base_rooms:
                c = str(br.get("maPhong") or br.get("id") or "").strip()
                if c and c not in seen_room_codes:
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
                    "nhomDV": ex.get("nhomDV") if ex and ex.get("nhomDV") else (s.ma_nhom_byt or "Cận lâm sàng"),
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

        return catalogs

    async def _project_relational_vouchers(self, db: AsyncSession, base_vouchers: list) -> list:
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
            return base_vouchers

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
            hinh_thuc = "Chuyển khoản (VietQR)" if "chuyen" in pay_method_raw or "qr" in pay_method_raw else "Tiền mặt"
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

        for bv in base_vouchers or []:
            c = str(bv.get("maPhieu") or bv.get("id") or "").strip()
            if c and c not in seen_codes and f"HD-{c}" not in seen_codes:
                result.append(bv)
                seen_codes.add(c)

        return result

    async def _project_relational_registrations(self, db: AsyncSession, base_registrations: list) -> list:
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
            return base_registrations

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

    async def _sync_catalog_relational_tables(self, db: AsyncSession, sub_key: str, items: Any) -> None:
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

    async def update_catalog_subcollection(
        self,
        db: AsyncSession,
        sub_key: str,
        items: Any,
        audit_entry: Optional[dict] = None,
        user_id: Optional[int] = None,
    ) -> dict:
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
        await db.execute(delete(HeThongTrangThaiBff))
        await db.commit()
        self._initial_relational_synced = False
        return await self.get_bootstrap_data(db)


bff_admin_service = BffAdminService()
