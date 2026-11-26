import copy
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import HangDoiKham, LichKham
from app.models.medical import (
    DichVu,
    HoaDon,
    KhaiNiem,
    LuotKham,
    Thuoc,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, NhanVien, PhongKham
from app.services.admin.bff.admin_helpers import (
    _classify_drug_group,
    _get_icd_chapter,
    _is_infectious_icd,
    _make_dvt_code,
    _normalize_service_group,
    _normalize_voucher_code,
)

class AdminProjectionService:

    async def project_relational_appointments(self, db: AsyncSession, base_appointments: list) -> list:
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

    async def project_relational_patients(self, db: AsyncSession, base_patients: list) -> list:
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

    async def project_relational_staff(self, db: AsyncSession) -> list:
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

    async def project_relational_catalogs(self, db: AsyncSession, base_catalogs: dict) -> dict:
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

    async def project_relational_vouchers(self, db: AsyncSession, base_vouchers: list) -> list:
        stmt = (
            select(HoaDon)
            .options(
                selectinload(HoaDon.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HoaDon.chi_tiet_hoa_don),
            )
            .order_by(HoaDon.id.desc())
            .limit(500)
        )
        db_invoices = (await db.execute(stmt)).scalars().all()

        base_map = {}
        for idx, v in enumerate(base_vouchers or []):
            if not isinstance(v, dict):
                continue
            raw_code = str(v.get("maPhieu") or v.get("id") or "").strip()
            raw_id = str(v.get("id") or "").strip()
            if raw_code == "DỰ KIẾN LẬP HÓA ĐƠN" or raw_code.startswith("GOP-"):
                continue
            for key in {
                raw_code,
                f"HD-{raw_code}" if raw_code else "",
                _normalize_voucher_code(raw_code),
                raw_id,
                _normalize_voucher_code(raw_id),
            }:
                if key and key not in base_map:
                    base_map[key] = (idx, v)

        if not db_invoices:
            deduped = []
            seen_norms = set()
            for v in base_vouchers or []:
                if not isinstance(v, dict):
                    continue
                code = str(v.get("maPhieu") or v.get("id") or "").strip()
                if not code or code == "DỰ KIẾN LẬP HÓA ĐƠN":
                    continue
                norm = _normalize_voucher_code(code)
                if norm and norm in seen_norms:
                    continue
                if norm:
                    seen_norms.add(norm)
                deduped.append(v)
            return deduped

        result = []
        consumed_base_indices = set()
        seen_codes = set()
        seen_norm_codes = set()
        seen_invoice_ids = set()
        for hd in db_invoices:
            raw_code = str(hd.ma_hoa_don or f"HD-{hd.id}").strip()
            while raw_code.startswith("HD-HD-"):
                raw_code = raw_code[3:]
            norm_code = _normalize_voucher_code(raw_code)
            if norm_code and norm_code in seen_norm_codes:
                continue
            short_code = raw_code[3:] if raw_code.startswith("HD-PT") else raw_code

            ex = None
            for cand_key in (raw_code, short_code, norm_code):
                if cand_key and cand_key in base_map:
                    cand_idx, cand_val = base_map[cand_key]
                    if cand_idx not in consumed_base_indices:
                        ex = cand_val
                        consumed_base_indices.add(cand_idx)
                        break

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
                "daThu": hd.trang_thai in ("da_thu", "da_thanh_toan"),
                "ghiChu": hd.ghi_chu or (ex.get("ghiChu") if ex else ""),
                "items": lines,
                "tongTien": amount_int,
            }
            if ex:
                for k, v in ex.items():
                    if k not in item:
                        item[k] = v
            result.append(item)
            seen_invoice_ids.add(hd.id)
            for code_token in (voucher_id, voucher_code, raw_code, short_code):
                s_tok = str(code_token or "").strip()
                if s_tok:
                    seen_codes.add(s_tok)
                    n_tok = _normalize_voucher_code(s_tok)
                    if n_tok:
                        seen_norm_codes.add(n_tok)

        for idx, bv in enumerate(base_vouchers or []):
            if idx in consumed_base_indices or not isinstance(bv, dict):
                continue
            c = str(bv.get("maPhieu") or bv.get("id") or "").strip()
            raw_id = str(bv.get("id") or "").strip()
            if not c or c == "DỰ KIẾN LẬP HÓA ĐƠN" or c.startswith("GOP-") or bv.get("isCombined"):
                continue
            inv_id_val = bv.get("invoiceId")
            try:
                if inv_id_val is not None and int(inv_id_val) in seen_invoice_ids:
                    continue
            except (TypeError, ValueError):
                pass
            nc = _normalize_voucher_code(c)
            nid = _normalize_voucher_code(raw_id)
            if (
                c in seen_codes
                or f"HD-{c}" in seen_codes
                or (raw_id and raw_id in seen_codes)
                or (nc and nc in seen_norm_codes)
                or (nid and nid in seen_norm_codes)
            ):
                continue
            result.append(bv)
            seen_codes.add(c)
            if raw_id:
                seen_codes.add(raw_id)
            if nc:
                seen_norm_codes.add(nc)
            if nid:
                seen_norm_codes.add(nid)

        return result

    async def project_relational_registrations(self, db: AsyncSession, base_registrations: list) -> list:
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
