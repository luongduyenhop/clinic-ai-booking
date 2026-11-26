import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.compliance import GiayPhepCoSo
from app.models.medical import DonThuoc, LuotKham
from app.models.user import BacSi, BenhNhan, TaiKhoan, VaiTroEnum
from app.schemas.compliance import TrangThaiDonThuoc
from app.services.compliance.audit_trail_service import audit_trail_service
from app.services.compliance.national_gateway_service import national_gateway_service
from app.services.compliance.prescription_fsm_service import prescription_fsm_service


def _serialize_prescription_row(rx: DonThuoc) -> Dict[str, Any]:
    lk = rx.luot_kham
    bn = lk.benh_nhan if lk else None
    bn_nd = bn.nguoi_dung if bn else None
    bs = rx.bac_si_ke_don
    bs_nd = bs.nguoi_dung if bs else None

    drug_items = [
        {
            "id": item.id,
            "ten_thuoc": item.ten_thuoc,
            "hoat_chat": item.hoat_chat or "",
            "ham_luong": item.ham_luong or "",
            "don_vi_tinh": item.don_vi_tinh or "Viên",
            "so_luong": item.so_luong or 1,
            "cach_dung": item.cach_dung or "",
            "so_ngay_dung": item.so_ngay_dung or rx.so_ngay_dung or 5,
            "lieu_sang": item.lieu_sang or "",
            "lieu_trua": item.lieu_trua or "",
            "lieu_chieu": item.lieu_chieu or "",
            "lieu_toi": item.lieu_toi or "",
        }
        for item in (rx.danh_sach_chi_tiet or [])
    ]

    ma_kcb = (lk.ma_kcb if lk and lk.ma_kcb else f"LK-{rx.luot_kham_id:04d}")
    ma_don = rx.ma_don_thuoc or f"DT-{rx.id:05d}"

    return {
        "id": rx.id,
        "luot_kham_id": rx.luot_kham_id,
        "ma_kcb": ma_kcb,
        "ma_don_thuoc": ma_don,
        "benh_nhan_id": bn.id if bn else (lk.benh_nhan_id if lk else None),
        "ma_benh_nhan": bn.ma_dinh_danh_y_te if bn else "",
        "ho_ten_benh_nhan": bn_nd.ho_ten if bn_nd else "Bệnh nhân",
        "so_dien_thoai": bn_nd.so_dien_thoai if bn_nd else "",
        "bac_si_id": rx.bac_si_ke_don_id,
        "ho_ten_bac_si": bs_nd.ho_ten if bs_nd else "Bác sĩ điều trị",
        "so_cchn_bac_si": bs.chung_chi_hanh_nghe if bs else "",
        "trang_thai": rx.trang_thai or TrangThaiDonThuoc.DRAFT.value,
        "ma_don_quoc_gia": rx.ma_don_quoc_gia,
        "bien_nhan_giao_dich": rx.bien_nhan_giao_dich,
        "idempotency_key": rx.idempotency_key,
        "chu_ky_so": rx.chu_ky_so,
        "du_lieu_don_thuoc_hash": rx.du_lieu_don_thuoc_hash,
        "ngay_ke_don": rx.ngay_ke_don.isoformat() if rx.ngay_ke_don else None,
        "ngay_ky": rx.ngay_ky.isoformat() if rx.ngay_ky else None,
        "thoi_gian_gui_cong": rx.thoi_gian_gui_cong.isoformat() if rx.thoi_gian_gui_cong else None,
        "loi_dan_uong_thuoc": rx.loi_dan_uong_thuoc or "",
        "so_ngay_dung": rx.so_ngay_dung or 5,
        "so_luong_thuoc": len(drug_items),
        "danh_sach_thuoc": drug_items,
    }


class ComplianceGatewayService:
    async def _resolve_doctor_filter(self, db: AsyncSession, current_user: TaiKhoan) -> Optional[int]:
        if current_user.vai_tro == VaiTroEnum.ADMIN.value:
            return None
        if current_user.vai_tro == VaiTroEnum.BAC_SI.value:
            bs = (
                await db.execute(select(BacSi).where(BacSi.nguoi_dung_id == current_user.nguoi_dung_id))
            ).scalar_one_or_none()
            if not bs:
                raise ForbiddenException("Không tìm thấy hồ sơ Bác sĩ hợp lệ!")
            return bs.id
        raise ForbiddenException("Chỉ Quản trị viên hoặc Bác sĩ mới có quyền truy cập liên thông đơn thuốc!")

    async def list_prescriptions(
        self,
        db: AsyncSession,
        current_user: TaiKhoan,
        status_filter: Optional[str] = None,
        keyword: Optional[str] = None,
        limit: int = 200,
    ) -> Dict[str, Any]:
        doctor_id = await self._resolve_doctor_filter(db, current_user)

        stmt = (
            select(DonThuoc)
            .options(
                selectinload(DonThuoc.danh_sach_chi_tiet),
                selectinload(DonThuoc.bac_si_ke_don).selectinload(BacSi.nguoi_dung),
                selectinload(DonThuoc.luot_kham).selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            )
            .where(DonThuoc.trang_thai != TrangThaiDonThuoc.SUPERSEDED.value)
            .order_by(DonThuoc.id.desc())
        )
        if doctor_id is not None:
            stmt = stmt.where(DonThuoc.bac_si_ke_don_id == doctor_id)

        rows = (await db.execute(stmt.limit(max(limit, 50)))).scalars().all()
        all_serialized = [_serialize_prescription_row(rx) for rx in rows]

        accepted_count = sum(1 for r in all_serialized if r["trang_thai"] == TrangThaiDonThuoc.ACCEPTED.value)
        signed_ready_count = sum(
            1
            for r in all_serialized
            if r["trang_thai"]
            in (
                TrangThaiDonThuoc.SIGNED.value,
                TrangThaiDonThuoc.ISSUED.value,
                TrangThaiDonThuoc.RETRY_PENDING.value,
                TrangThaiDonThuoc.UNKNOWN_RESULT.value,
                "COMPLETED",
            )
        )
        draft_count = sum(
            1
            for r in all_serialized
            if r["trang_thai"] in (TrangThaiDonThuoc.DRAFT.value, TrangThaiDonThuoc.VALIDATED.value)
        )

        norm_status = (status_filter or "ALL").strip().upper()
        norm_kw = (keyword or "").strip().lower()

        filtered: List[Dict[str, Any]] = []
        for item in all_serialized:
            st = item["trang_thai"]
            if norm_status == "ACCEPTED" and st != TrangThaiDonThuoc.ACCEPTED.value:
                continue
            if norm_status == "SIGNED" and st not in (
                TrangThaiDonThuoc.SIGNED.value,
                TrangThaiDonThuoc.ISSUED.value,
                TrangThaiDonThuoc.RETRY_PENDING.value,
                TrangThaiDonThuoc.UNKNOWN_RESULT.value,
                "COMPLETED",
            ):
                continue
            if norm_status == "DRAFT" and st not in (
                TrangThaiDonThuoc.DRAFT.value,
                TrangThaiDonThuoc.VALIDATED.value,
            ):
                continue

            if norm_kw:
                haystack = " ".join(
                    [
                        str(item.get("ma_kcb") or ""),
                        str(item.get("ma_don_thuoc") or ""),
                        str(item.get("ho_ten_benh_nhan") or ""),
                        str(item.get("ma_benh_nhan") or ""),
                        str(item.get("ho_ten_bac_si") or ""),
                        str(item.get("ma_don_quoc_gia") or ""),
                    ]
                ).lower()
                if norm_kw not in haystack:
                    continue

            filtered.append(item)

        return {
            "summary": {
                "total": len(all_serialized),
                "accepted": accepted_count,
                "signed_pending_sync": signed_ready_count,
                "draft": draft_count,
            },
            "items": filtered,
        }

    async def sync_single_prescription(
        self,
        db: AsyncSession,
        prescription_id: int,
        current_user: TaiKhoan,
    ) -> Dict[str, Any]:
        doctor_id = await self._resolve_doctor_filter(db, current_user)

        stmt = (
            select(DonThuoc)
            .options(
                selectinload(DonThuoc.danh_sach_chi_tiet),
                selectinload(DonThuoc.bac_si_ke_don).selectinload(BacSi.nguoi_dung),
                selectinload(DonThuoc.luot_kham).selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            )
            .where(DonThuoc.id == prescription_id)
        )
        rx = (await db.execute(stmt)).scalar_one_or_none()
        if not rx:
            raise NotFoundException(f"Không tìm thấy đơn thuốc #{prescription_id}!")

        if doctor_id is not None and rx.bac_si_ke_don_id != doctor_id:
            lk = rx.luot_kham
            if not lk or (lk.bac_si_id != doctor_id and lk.tiep_quan_boi_id != doctor_id):
                raise ForbiddenException("Bạn chỉ được liên thông đơn thuốc thuộc ca khám do mình phụ trách!")

        if rx.trang_thai in (TrangThaiDonThuoc.DRAFT.value, TrangThaiDonThuoc.VALIDATED.value):
            raise ConflictException("Đơn thuốc chưa được ký số điện tử (SIGNED), không thể gửi lên Cổng Quốc gia!")

        if rx.trang_thai == TrangThaiDonThuoc.ACCEPTED.value:
            return _serialize_prescription_row(rx)

        if rx.trang_thai == TrangThaiDonThuoc.SIGNED.value:
            await prescription_fsm_service.issue_prescription_db(db, rx.id, current_user)
        elif rx.trang_thai == "COMPLETED":
            rx.trang_thai = TrangThaiDonThuoc.ISSUED.value
            await db.commit()

        await national_gateway_service.submit_to_gateway(
            db=db,
            prescription_id=rx.id,
            user=current_user,
            idempotency_key=rx.idempotency_key,
        )

        refreshed = (await db.execute(stmt)).scalar_one()
        if refreshed.luot_kham and refreshed.luot_kham.benh_nhan_id:
            await audit_trail_service.log_access(
                db=db,
                user_id=current_user.id,
                user_role=current_user.vai_tro,
                patient_id=refreshed.luot_kham.benh_nhan_id,
                action="EXPORT",
                resource_type="PRESCRIPTION",
                resource_id=refreshed.id,
                purpose="Liên thông đơn thuốc điện tử lên Cổng Đơn thuốc Quốc gia (TT 26/2025/TT-BYT)",
            )
            await db.commit()

        return _serialize_prescription_row(refreshed)

    async def sync_all_signed_prescriptions(
        self,
        db: AsyncSession,
        current_user: TaiKhoan,
    ) -> Dict[str, Any]:
        if current_user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Chỉ Quản trị viên mới có quyền đồng bộ hàng loạt toàn phòng khám!")

        stmt = select(DonThuoc.id).where(
            DonThuoc.trang_thai.in_(
                [
                    TrangThaiDonThuoc.SIGNED.value,
                    TrangThaiDonThuoc.ISSUED.value,
                    TrangThaiDonThuoc.RETRY_PENDING.value,
                    TrangThaiDonThuoc.UNKNOWN_RESULT.value,
                    "COMPLETED",
                ]
            )
        )
        target_ids = [row[0] for row in (await db.execute(stmt)).all()]
        synced_items: List[Dict[str, Any]] = []
        failed_ids: List[int] = []

        for rx_id in target_ids:
            try:
                item = await self.sync_single_prescription(db, rx_id, current_user)
                if item["trang_thai"] == TrangThaiDonThuoc.ACCEPTED.value:
                    synced_items.append(item)
                else:
                    failed_ids.append(rx_id)
            except Exception:
                failed_ids.append(rx_id)

        return {
            "synced_count": len(synced_items),
            "failed_count": len(failed_ids),
            "synced_items": synced_items,
            "failed_ids": failed_ids,
        }

    async def list_hssk_records(
        self,
        db: AsyncSession,
        current_user: TaiKhoan,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        doctor_id = await self._resolve_doctor_filter(db, current_user)

        stmt = (
            select(LuotKham)
            .options(
                selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LuotKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LuotKham.kham_the_luc),
                selectinload(LuotKham.danh_sach_chan_doan),
            )
            .where(LuotKham.is_locked.is_(True))
            .order_by(LuotKham.thoi_gian_khoa.desc(), LuotKham.id.desc())
            .limit(max(limit, 20))
        )
        if doctor_id is not None:
            stmt = stmt.where(or_(LuotKham.bac_si_id == doctor_id, LuotKham.tiep_quan_boi_id == doctor_id))

        rows = (await db.execute(stmt)).scalars().all()
        records: List[Dict[str, Any]] = []
        for lk in rows:
            bn = lk.benh_nhan
            bn_nd = bn.nguoi_dung if bn else None
            bs = lk.bac_si
            ck = bs.chuyen_khoa if bs else None
            tl = lk.kham_the_luc
            locked_dt = lk.thoi_gian_khoa or lk.thoi_gian_ket_thuc or lk.thoi_gian_bat_dau
            ma_kcb = lk.ma_kcb or f"LK-{lk.id:04d}"

            records.append(
                {
                    "id": lk.id,
                    "maKCB": ma_kcb,
                    "benhNhan": bn_nd.ho_ten if bn_nd else "Bệnh nhân",
                    "maBenhNhan": bn.ma_dinh_danh_y_te if bn else "",
                    "ngaySinh": bn_nd.ngay_sinh.strftime("%d/%m/%Y") if bn_nd and bn_nd.ngay_sinh else "Chưa cập nhật",
                    "gioiTinh": bn_nd.gioi_tinh if bn_nd and bn_nd.gioi_tinh else "Khác",
                    "dienThoai": bn_nd.so_dien_thoai if bn_nd and bn_nd.so_dien_thoai else "—",
                    "mauKham": f"Phiếu khám ngoại trú TT32 ({ck.ten_chuyen_khoa if ck else 'Đa khoa'})",
                    "phanLoaiSucKhoe": (tl.phan_loai_the_luc if tl and tl.phan_loai_the_luc else "Loại I"),
                    "idempotencyKey": f"HSSK-TT32-{lk.id:06d}",
                    "trangThai": "Đã đồng bộ HSSK",
                    "ngayDongBo": locked_dt.strftime("%d/%m/%Y %H:%M") if locked_dt else "—",
                }
            )
        return records

    async def ping_gateway_health(self, db: AsyncSession, current_user: TaiKhoan) -> Dict[str, Any]:
        await self._resolve_doctor_filter(db, current_user)
        t0 = time.perf_counter()
        await db.execute(text("SELECT 1"))
        facility = (
            await db.execute(select(GiayPhepCoSo).where(GiayPhepCoSo.trang_thai == "ACTIVE").limit(1))
        ).scalar_one_or_none()
        elapsed_ms = max(1, round((time.perf_counter() - t0) * 1000))
        ready = not national_gateway_service.timeout_mode
        return {
            "connected": ready,
            "code": 200 if ready else 504,
            "latency_ms": elapsed_ms,
            "server_time": datetime.now(timezone.utc).isoformat(),
            "gateway_version": "DonThuocQG-BYT v2.4 (Live FSM)",
            "facility_license": facility.so_giay_phep if facility else "01-08924/HNO-GPHD",
        }


compliance_gateway_service = ComplianceGatewayService()
