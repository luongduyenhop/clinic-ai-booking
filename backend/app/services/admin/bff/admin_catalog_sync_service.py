from typing import Optional
from sqlalchemy import select, or_, and_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException
from app.models.appointment import HangDoiKham, LichKham, LichLamViec
from app.models.medical import (
    ChanDoan,
    ChiDinh,
    ChiTietDonThuoc,
    DichVu,
    KhaiNiem,
    PhieuKhamChuyenKhoa,
    Thuoc,
)
from app.models.specialized import (
    ChiTietGoiKham,
    ChiTietGoiKhamDaMua,
)
from app.models.user import BacSi, ChuyenKhoa, PhongKham

class AdminCatalogSyncService:

    async def delete_catalog_relational_item(
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
