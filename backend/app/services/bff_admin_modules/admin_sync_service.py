from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from sqlalchemy import select, update, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.core.exceptions import BadRequestException
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
    Thuoc,
)
from app.models.specialized import (
    DangKyGoiKham,
    GoiDichVu,
    LieuTrinhDieuTri,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, PhongKham
from app.services.bff_admin_modules.admin_helpers import (
    _normalize_voucher_code,
    _parse_date_safe,
    _parse_decimal_safe,
)

class AdminSyncService:

    async def upsert_bff_key(
        self,
        db: AsyncSession,
        key: str,
        value: Any,
        user_id: Optional[int] = None,
    ) -> None:
        insert = sqlite_insert if db.bind.dialect.name == "sqlite" else pg_insert
        stmt = insert(HeThongTrangThaiBff).values(
            collection_key=key, data_json=value, updated_by_id=user_id,
        )
        await db.execute(stmt.on_conflict_do_update(
            index_elements=[HeThongTrangThaiBff.collection_key],
            set_={
                "data_json": stmt.excluded.data_json,
                "updated_by_id": stmt.excluded.updated_by_id,
                "updated_at": func.now(),
            },
        ))

    async def append_audit_entry(
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
        await self.upsert_bff_key(db, "auditLogs", audit_logs, user_id=user_id)

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

    async def ensure_default_entities(self, db: AsyncSession):
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
                await self.upsert_bff_key(db, key, data[key])

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
                await self.sync_relational_tables(db, key, data[key])

        catalogs = data.get("catalogs") or {}
        if isinstance(catalogs, dict):
            for sub_key, sub_items in catalogs.items():
                await self.sync_catalog_relational_tables(db, sub_key, sub_items)

        await db.commit()

    async def sync_relational_tables(self, db: AsyncSession, collection_key: str, items: Any) -> None:
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
            first_user, first_bn, first_bs, _ = await self.ensure_default_entities(db)
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
            first_user, first_bn, first_bs, first_lk = await self.ensure_default_entities(db)
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
            first_user, first_bn, first_bs, first_lk = await self.ensure_default_entities(db)
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
            first_user, first_bn, first_bs, first_lk = await self.ensure_default_entities(db)
            staff_id = first_user.id
            seen_voucher_norms = set()
            for v in items:
                if not isinstance(v, dict):
                    continue
                code = str(v.get("maPhieu") or v.get("id") or "").strip()
                if (
                    not code
                    or code == "DỰ KIẾN LẬP HÓA ĐƠN"
                    or code.startswith("GOP-")
                    or v.get("isCombined")
                ):
                    continue
                norm_code = _normalize_voucher_code(code)
                if norm_code and norm_code in seen_voucher_norms:
                    continue
                if norm_code:
                    seen_voucher_norms.add(norm_code)

                loai = "CHI" if "chi" in str(v.get("loaiPhieu") or "").lower() else "THU"
                amount = _parse_decimal_safe(v.get("tongTien") or 0)
                clean_code = code.strip()
                while clean_code.startswith("HD-HD-"):
                    clean_code = clean_code[3:]
                hd_code = clean_code if clean_code.startswith("HD-") else f"HD-{clean_code[:40]}"

                hd_id = None
                existing_hd = None
                created_new_hd = False
                if loai == "THU" and first_lk and first_bn:
                    raw_inv_id = v.get("invoiceId")
                    if raw_inv_id is not None:
                        try:
                            inv_id_int = int(raw_inv_id)
                            existing_hd = (
                                await db.execute(select(HoaDon).where(HoaDon.id == inv_id_int))
                            ).scalar_one_or_none()
                        except (TypeError, ValueError):
                            existing_hd = None

                    if not existing_hd:
                        candidate_codes = {
                            c for c in (hd_code, clean_code, code, norm_code, f"HD-{norm_code}" if norm_code else "") if c
                        }
                        if candidate_codes:
                            existing_hd = (
                                await db.execute(
                                    select(HoaDon).where(HoaDon.ma_hoa_don.in_(list(candidate_codes)))
                                )
                            ).scalars().first()

                    lk_id_from_v = None
                    if v.get("luotKhamId") is not None:
                        try:
                            lk_id_from_v = int(v.get("luotKhamId"))
                        except (TypeError, ValueError):
                            lk_id_from_v = None

                    if not existing_hd and lk_id_from_v and not v.get("daThu"):
                        existing_hd = (
                            await db.execute(
                                select(HoaDon).where(
                                    HoaDon.luot_kham_id == lk_id_from_v,
                                    HoaDon.trang_thai == "chua_thu",
                                )
                            )
                        ).scalars().first()

                    if existing_hd:
                        if v.get("daThu") and existing_hd.trang_thai == "chua_thu":
                            existing_hd.trang_thai = "da_thu"
                            existing_hd.thuc_thu = amount if amount > 0 else existing_hd.tong_tien
                            existing_hd.ngay_thanh_toan = existing_hd.ngay_thanh_toan or datetime.now(timezone.utc)
                    else:
                        bn_id_resolved = first_bn.id
                        ma_bn = str(v.get("maBN") or "").strip()
                        ho_ten_bn = str(v.get("hoTenBN") or "").strip()
                        found_bn = None
                        if ma_bn:
                            found_bn = (
                                await db.execute(select(BenhNhan).where(BenhNhan.ma_dinh_danh_y_te == ma_bn))
                            ).scalars().first()
                        if not found_bn and ho_ten_bn:
                            found_bn = (
                                await db.execute(
                                    select(BenhNhan)
                                    .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
                                    .where(NguoiDung.ho_ten == ho_ten_bn)
                                )
                            ).scalars().first()
                        if found_bn:
                            bn_id_resolved = found_bn.id

                        target_lk_id = lk_id_from_v or first_lk.id
                        active_lk_hd = (
                            await db.execute(
                                select(HoaDon.id).where(
                                    HoaDon.luot_kham_id == target_lk_id,
                                    HoaDon.trang_thai.in_(["chua_thu", "da_thu"]),
                                )
                            )
                        ).scalars().first()
                        assigned_lk_id = None if active_lk_hd else target_lk_id
                        existing_hd = HoaDon(
                            ma_hoa_don=hd_code,
                            luot_kham_id=assigned_lk_id,
                            benh_nhan_id=bn_id_resolved,
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
                        created_new_hd = True
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

                ptc_filters = [PhieuThuChi.ma_phieu == code[:50]]
                if hd_id is not None:
                    ptc_filters.append(
                        and_(PhieuThuChi.hoa_don_id == hd_id, PhieuThuChi.loai_phieu == loai)
                    )
                existing_ptc = (
                    await db.execute(select(PhieuThuChi).where(or_(*ptc_filters)))
                ).scalars().first()

                if existing_ptc:
                    existing_ptc.so_tien = amount
                    existing_ptc.ly_do = str(v.get("tenPhieu") or v.get("ghiChu") or existing_ptc.ly_do)[:500]
                elif created_new_hd or v.get("daThu") or loai == "CHI":
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
            first_user, _, _, _ = await self.ensure_default_entities(db)
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
            _, first_bn, _, _ = await self.ensure_default_entities(db)
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
            _, first_bn, first_bs, _ = await self.ensure_default_entities(db)
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

    async def sync_catalog_relational_tables(
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
                            await db.execute(
                                update(Thuoc)
                                .where(Thuoc.don_vi_tinh == old_name)
                                .values(don_vi_tinh=new_name)
                            )
                            await db.execute(
                                update(DichVu)
                                .where(DichVu.don_vi_tinh == old_name)
                                .values(don_vi_tinh=new_name)
                            )
                            if catalogs is not None:
                                for th in catalogs.get("thuocVatTu") or []:
                                    if str(th.get("dvt") or th.get("donViTinh") or "").strip() == old_name:
                                        th["dvt"] = new_name
                                        th["donViTinh"] = new_name
                                for dv in catalogs.get("dichVu") or []:
                                    if str(dv.get("dvt") or dv.get("donViTinh") or "").strip() == old_name:
                                        dv["dvt"] = new_name
                                        dv["donViTinh"] = new_name
