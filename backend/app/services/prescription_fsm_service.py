import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.medical import ChiTietDonThuoc, DonThuoc, LichSuDongBoDonThuoc
from app.models.user import BacSi, TaiKhoan, VaiTroEnum
from app.schemas.clinical import PrescriptionUpdateRequest
from app.schemas.compliance import (
    PrescriptionSupersedeRequest,
    TrangThaiDonThuoc,
)
from app.services.credential_service import credential_service

logger = logging.getLogger("clinic_backend")

VALID_TRANSITIONS = {
    TrangThaiDonThuoc.DRAFT.value: {TrangThaiDonThuoc.VALIDATED.value},
    TrangThaiDonThuoc.VALIDATED.value: {TrangThaiDonThuoc.SIGNED.value, TrangThaiDonThuoc.DRAFT.value},
    TrangThaiDonThuoc.SIGNED.value: {TrangThaiDonThuoc.ISSUED.value, TrangThaiDonThuoc.SUPERSEDED.value},
    TrangThaiDonThuoc.ISSUED.value: {TrangThaiDonThuoc.SUBMISSION_PENDING.value, TrangThaiDonThuoc.SUPERSEDED.value},
    TrangThaiDonThuoc.SUBMISSION_PENDING.value: {TrangThaiDonThuoc.SUBMITTED.value},
    TrangThaiDonThuoc.SUBMITTED.value: {
        TrangThaiDonThuoc.ACCEPTED.value,
        TrangThaiDonThuoc.REJECTED.value,
        TrangThaiDonThuoc.UNKNOWN_RESULT.value,
        TrangThaiDonThuoc.RETRY_PENDING.value,
    },
    TrangThaiDonThuoc.UNKNOWN_RESULT.value: {
        TrangThaiDonThuoc.RETRY_PENDING.value,
        TrangThaiDonThuoc.SUBMITTED.value,
        TrangThaiDonThuoc.MANUAL_REVIEW.value,
    },
    TrangThaiDonThuoc.RETRY_PENDING.value: {
        TrangThaiDonThuoc.SUBMITTED.value,
        TrangThaiDonThuoc.MANUAL_REVIEW.value,
    },
    TrangThaiDonThuoc.REJECTED.value: {
        TrangThaiDonThuoc.MANUAL_REVIEW.value,
        TrangThaiDonThuoc.SUPERSEDED.value,
    },
    TrangThaiDonThuoc.MANUAL_REVIEW.value: {
        TrangThaiDonThuoc.SUBMISSION_PENDING.value,
        TrangThaiDonThuoc.SUPERSEDED.value,
    },
    TrangThaiDonThuoc.ACCEPTED.value: {TrangThaiDonThuoc.SUPERSEDED.value},
    TrangThaiDonThuoc.SUPERSEDED.value: set(),
}

class PrescriptionFSMService:
    @staticmethod
    def compute_prescription_hash(prescription_id: int, items: List[Dict[str, Any]]) -> str:
        payload = f"{prescription_id}:" + json.dumps(
            sorted(items, key=lambda x: x.get("ten_thuoc", "")),
            sort_keys=True
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def transition(current_status: str, next_status: str) -> str:
        allowed = VALID_TRANSITIONS.get(current_status, set())
        if next_status not in allowed:
            raise ConflictException(
                f"Chuyển trạng thái đơn thuốc không hợp lệ: '{current_status}' -> '{next_status}'. "
                f"Các trạng thái được phép: {allowed or 'Không có (trạng thái kết thúc)'}"
            )
        return next_status

    @staticmethod
    def assert_immutable(status: str) -> None:
        if status in (
            TrangThaiDonThuoc.SIGNED.value,
            TrangThaiDonThuoc.ISSUED.value,
            TrangThaiDonThuoc.ACCEPTED.value,
            TrangThaiDonThuoc.SUPERSEDED.value,
        ):
            raise ConflictException(
                f"Đơn thuốc đang ở trạng thái '{status}'. Nội dung thuốc và liều lượng đã ký là BẤT BIẾN, "
                "không được phép chỉnh sửa trực tiếp! Vui lòng sử dụng quy trình tạo đơn thay thế (SUPERSEDED)."
            )

    @classmethod
    def sign_prescription(
        cls,
        prescription: Union[Dict[str, Any], DonThuoc],
        doctor_id: int,
        signature_data: str,
    ) -> Union[Dict[str, Any], DonThuoc]:
        if isinstance(prescription, dict):
            if prescription.get("trang_thai") != TrangThaiDonThuoc.VALIDATED.value:
                raise ConflictException(
                    f"Đơn thuốc phải ở trạng thái '{TrangThaiDonThuoc.VALIDATED.value}' trước khi ký số! "
                    f"Trạng thái hiện tại: '{prescription.get('trang_thai')}'"
                )
            prescription["trang_thai"] = cls.transition(prescription["trang_thai"], TrangThaiDonThuoc.SIGNED.value)
            prescription["chu_ky_so"] = signature_data
            prescription["nguoi_ky_id"] = doctor_id
            prescription["thoi_gian_ky"] = datetime.now(timezone.utc)
            prescription["du_lieu_don_thuoc_hash"] = cls.compute_prescription_hash(
                prescription.get("id", 1), prescription.get("items", [])
            )
            return prescription

        if prescription.trang_thai != TrangThaiDonThuoc.VALIDATED.value:
            raise ConflictException(
                f"Đơn thuốc phải ở trạng thái '{TrangThaiDonThuoc.VALIDATED.value}' trước khi ký số! "
                f"Trạng thái hiện tại: '{prescription.trang_thai}'"
            )
        prescription.trang_thai = cls.transition(prescription.trang_thai, TrangThaiDonThuoc.SIGNED.value)
        prescription.chu_ky_so = signature_data
        prescription.nguoi_ky_id = doctor_id
        prescription.ngay_ky = datetime.now(timezone.utc)
        items_payload = [
            {
                "ten_thuoc": item.ten_thuoc,
                "ham_luong": item.ham_luong,
                "so_luong": item.so_luong,
                "don_vi_tinh": item.don_vi_tinh,
                "cach_dung": item.cach_dung,
            }
            for item in (prescription.danh_sach_chi_tiet or [])
        ]
        prescription.du_lieu_don_thuoc_hash = cls.compute_prescription_hash(prescription.id, items_payload)
        return prescription

    @classmethod
    def supersede(
        cls,
        old_prescription: Union[Dict[str, Any], DonThuoc],
        new_prescription_id: Optional[int],
        reason: str,
    ) -> Tuple[Any, Any]:
        if not reason or len(reason.strip()) < 5:
            raise BadRequestException("Lý do thay thế đơn thuốc phải được nêu rõ ràng (tối thiểu 5 ký tự)!")

        target_id = new_prescription_id if new_prescription_id and new_prescription_id > 0 else None

        if isinstance(old_prescription, dict):
            if old_prescription.get("trang_thai") not in (
                TrangThaiDonThuoc.SIGNED.value,
                TrangThaiDonThuoc.ISSUED.value,
                TrangThaiDonThuoc.ACCEPTED.value,
            ):
                raise ConflictException(
                    f"Chỉ có thể thay thế đơn thuốc đã ký hoặc ban hành! Trạng thái hiện tại: {old_prescription.get('trang_thai')}"
                )
            old_prescription["trang_thai"] = TrangThaiDonThuoc.SUPERSEDED.value
            old_prescription["superseded_by_id"] = target_id
            old_prescription["ly_do_thay_the"] = reason

            new_prescription = {
                "id": target_id,
                "thay_the_cho_don_id": old_prescription.get("id"),
                "trang_thai": TrangThaiDonThuoc.DRAFT.value,
                "luot_kham_id": old_prescription.get("luot_kham_id"),
                "items": [],
            }
            return old_prescription, new_prescription

        if old_prescription.trang_thai not in (
            TrangThaiDonThuoc.SIGNED.value,
            TrangThaiDonThuoc.ISSUED.value,
            TrangThaiDonThuoc.ACCEPTED.value,
        ):
            raise ConflictException(
                f"Chỉ có thể thay thế đơn thuốc đã ký hoặc ban hành! Trạng thái hiện tại: {old_prescription.trang_thai}"
            )
        old_prescription.trang_thai = TrangThaiDonThuoc.SUPERSEDED.value
        old_prescription.superseded_by_id = target_id
        old_prescription.ly_do_thay_the = reason
        return old_prescription, None

    async def get_prescription_or_404(
        self,
        db: AsyncSession,
        prescription_id: int
    ) -> DonThuoc:
        stmt = (
            select(DonThuoc)
            .options(
                selectinload(DonThuoc.danh_sach_chi_tiet),
                selectinload(DonThuoc.luot_kham)
            )
            .where(DonThuoc.id == prescription_id)
        )
        rx = (await db.execute(stmt)).scalar_one_or_none()
        if not rx:
            raise NotFoundException(f"Không tìm thấy đơn thuốc với ID {prescription_id}!")
        return rx

    async def validate_prescription(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan
    ) -> DonThuoc:
        rx = await self.get_prescription_or_404(db, prescription_id)
        rx.trang_thai = self.transition(rx.trang_thai, TrangThaiDonThuoc.VALIDATED.value)
        await db.commit()
        await db.refresh(rx)
        logger.info(f"[FSM VALIDATED] DonThuoc: {rx.id} | User: {user.id}")
        return rx

    async def sign_prescription_db(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        signature_data: str
    ) -> DonThuoc:
        rx = await self.get_prescription_or_404(db, prescription_id)

        stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
        bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bac_si and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Chỉ có Bác sĩ phụ trách mới có quyền ký số đơn thuốc!")

        doctor_id = bac_si.id if bac_si else rx.bac_si_ke_don_id

        await credential_service.check_doctor_license_valid(db, doctor_id)

        self.sign_prescription(rx, doctor_id=doctor_id, signature_data=signature_data)
        await db.commit()
        await db.refresh(rx)
        logger.info(f"[FSM SIGNED] DonThuoc: {rx.id} | Doctor: {doctor_id} | Hash: {rx.du_lieu_don_thuoc_hash}")
        return rx

    async def issue_prescription_db(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan
    ) -> DonThuoc:
        rx = await self.get_prescription_or_404(db, prescription_id)
        rx.trang_thai = self.transition(rx.trang_thai, TrangThaiDonThuoc.ISSUED.value)
        await db.commit()
        await db.refresh(rx)
        logger.info(f"[FSM ISSUED] DonThuoc: {rx.id} | User: {user.id}")
        return rx

    async def supersede_prescription_db(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        payload: PrescriptionSupersedeRequest
    ) -> Tuple[DonThuoc, DonThuoc]:
        rx = await self.get_prescription_or_404(db, prescription_id)

        stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
        bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        doctor_id = bac_si.id if bac_si else rx.bac_si_ke_don_id

        if bac_si:
            await credential_service.check_doctor_license_valid(db, doctor_id)

        self.supersede(rx, new_prescription_id=None, reason=payload.ly_do)

        now = datetime.now(timezone.utc)
        new_rx = DonThuoc(
            luot_kham_id=rx.luot_kham_id,
            bac_si_ke_don_id=doctor_id,
            ngay_ke_don=now,
            trang_thai=TrangThaiDonThuoc.DRAFT.value,
            thay_the_cho_don_id=rx.id,
            loi_dan_uong_thuoc=payload.loi_dan_uong_thuoc if payload.loi_dan_uong_thuoc is not None else rx.loi_dan_uong_thuoc,
            ghi_chu_duoc_lam_sang=payload.ghi_chu_duoc_lam_sang if payload.ghi_chu_duoc_lam_sang is not None else rx.ghi_chu_duoc_lam_sang,
        )
        db.add(new_rx)
        await db.flush()

        if payload.danh_sach_thuoc:
            for item in payload.danh_sach_thuoc:
                chi_tiet = ChiTietDonThuoc(
                    don_thuoc_id=new_rx.id,
                    ten_thuoc=item.get("ten_thuoc", ""),
                    hoat_chat=item.get("hoat_chat"),
                    ham_luong=item.get("ham_luong"),
                    don_vi_tinh=item.get("don_vi_tinh", "Viên"),
                    so_luong=item.get("so_luong", 1),
                    cach_dung=item.get("cach_dung", ""),
                    so_ngay_dung=item.get("so_ngay_dung", 5),
                    ghi_chu=item.get("ghi_chu")
                )
                db.add(chi_tiet)

        rx.superseded_by_id = new_rx.id

        await db.commit()

        stmt_old = (
            select(DonThuoc)
            .options(selectinload(DonThuoc.danh_sach_chi_tiet))
            .where(DonThuoc.id == rx.id)
        )
        stmt_new = (
            select(DonThuoc)
            .options(selectinload(DonThuoc.danh_sach_chi_tiet))
            .where(DonThuoc.id == new_rx.id)
        )
        saved_old = (await db.execute(stmt_old)).scalar_one()
        saved_new = (await db.execute(stmt_new)).scalar_one()

        logger.info(
            f"[FSM SUPERSEDED] Old Rx: {saved_old.id} -> New Rx: {saved_new.id} | Reason: {payload.ly_do}"
        )
        return saved_old, saved_new

    async def update_prescription_db(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        payload: PrescriptionUpdateRequest
    ) -> DonThuoc:
        rx = await self.get_prescription_or_404(db, prescription_id)

        self.assert_immutable(rx.trang_thai)

        if payload.loi_dan_uong_thuoc is not None:
            rx.loi_dan_uong_thuoc = payload.loi_dan_uong_thuoc
        if payload.ghi_chu_duoc_lam_sang is not None:
            rx.ghi_chu_duoc_lam_sang = payload.ghi_chu_duoc_lam_sang

        if payload.danh_sach_thuoc is not None:
            for old_item in list(rx.danh_sach_chi_tiet or []):
                await db.delete(old_item)
            await db.flush()

            for item in payload.danh_sach_thuoc:
                chi_tiet = ChiTietDonThuoc(
                    don_thuoc_id=rx.id,
                    ten_thuoc=item.ten_thuoc,
                    hoat_chat=item.hoat_chat,
                    ham_luong=item.ham_luong,
                    don_vi_tinh=item.don_vi_tinh,
                    so_luong=item.so_luong,
                    cach_dung=item.cach_dung,
                    so_ngay_dung=item.so_ngay_dung,
                    ghi_chu=item.ghi_chu
                )
                db.add(chi_tiet)

            if rx.trang_thai == TrangThaiDonThuoc.VALIDATED.value:
                rx.trang_thai = TrangThaiDonThuoc.DRAFT.value

        await db.commit()
        await db.refresh(rx)
        logger.info(f"[PRESCRIPTION UPDATED] DonThuoc: {rx.id} | Status: {rx.trang_thai}")
        return rx

    async def get_prescription_queue(
        self,
        db: AsyncSession,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        stmt = (
            select(DonThuoc)
            .options(
                selectinload(DonThuoc.danh_sach_chi_tiet),
                selectinload(DonThuoc.bac_si_ke_don),
            )
            .order_by(DonThuoc.id.desc())
        )
        if status:
            stmt = stmt.where(DonThuoc.trang_thai == status)

        stmt_count = select(func.count(DonThuoc.id))
        if status:
            stmt_count = stmt_count.where(DonThuoc.trang_thai == status)

        total = (await db.execute(stmt_count)).scalar() or 0
        paged_stmt = stmt.limit(limit).offset(offset)
        records = (await db.execute(paged_stmt)).scalars().all()

        items = []
        for rx in records:
            items.append({
                "id": rx.id,
                "ma_don_thuoc": rx.ma_don_thuoc or f"DT-{rx.id:06d}",
                "luot_kham_id": rx.luot_kham_id,
                "bac_si_ke_don_id": rx.bac_si_ke_don_id,
                "trang_thai": rx.trang_thai,
                "du_lieu_don_thuoc_hash": rx.du_lieu_don_thuoc_hash,
                "chu_ky_so": rx.chu_ky_so,
                "ngay_ky": rx.ngay_ky.isoformat() if rx.ngay_ky else None,
                "idempotency_key": rx.idempotency_key,
                "bien_nhan_giao_dich": rx.bien_nhan_giao_dich,
                "thoi_gian_gui_cong": rx.thoi_gian_gui_cong.isoformat() if rx.thoi_gian_gui_cong else None,
                "ma_ket_qua_cong": rx.ma_ket_qua_cong,
                "thong_diep_cong": rx.thong_diep_cong,
                "so_luong_thuoc": len(rx.danh_sach_chi_tiet or []),
                "created_at": rx.created_at.isoformat() if rx.created_at else None,
                "updated_at": rx.updated_at.isoformat() if rx.updated_at else None,
            })

        pending_statuses = [
            TrangThaiDonThuoc.SUBMISSION_PENDING.value,
            TrangThaiDonThuoc.SUBMITTED.value,
            TrangThaiDonThuoc.UNKNOWN_RESULT.value,
            TrangThaiDonThuoc.RETRY_PENDING.value,
            TrangThaiDonThuoc.MANUAL_REVIEW.value,
        ]
        stmt_pending = select(func.count(DonThuoc.id)).where(DonThuoc.trang_thai.in_(pending_statuses))
        pending_count = (await db.execute(stmt_pending)).scalar() or 0

        stmt_synced = select(func.count(DonThuoc.id)).where(DonThuoc.trang_thai == TrangThaiDonThuoc.ACCEPTED.value)
        synced_count = (await db.execute(stmt_synced)).scalar() or 0

        stmt_failed = select(func.count(DonThuoc.id)).where(DonThuoc.trang_thai == TrangThaiDonThuoc.REJECTED.value)
        failed_count = (await db.execute(stmt_failed)).scalar() or 0

        return {
            "total": total,
            "items": items,
            "pending_count": pending_count,
            "synced_count": synced_count,
            "failed_count": failed_count,
        }

    async def get_prescription_status_and_history(
        self,
        db: AsyncSession,
        prescription_id: int,
    ) -> Dict[str, Any]:
        stmt = (
            select(DonThuoc)
            .options(
                selectinload(DonThuoc.danh_sach_chi_tiet),
                selectinload(DonThuoc.danh_sach_lich_su_dong_bo),
                selectinload(DonThuoc.bac_si_ke_don),
            )
            .where(DonThuoc.id == prescription_id)
        )
        rx = (await db.execute(stmt)).scalar_one_or_none()
        if not rx:
            raise NotFoundException(f"Không tìm thấy đơn thuốc với ID {prescription_id}!")

        history = []
        for log in rx.danh_sach_lich_su_dong_bo or []:
            history.append({
                "id": log.id,
                "lan_thu": log.lan_thu,
                "loai_thao_tac": log.loai_thao_tac,
                "trang_thai": log.trang_thai,
                "ma_phan_hoi": log.ma_phan_hoi,
                "thong_diep_phan_hoi": log.thong_diep_phan_hoi,
                "ma_bien_nhan": log.ma_bien_nhan,
                "idempotency_key": log.idempotency_key,
                "thoi_gian_bat_dau": log.thoi_gian_bat_dau.isoformat() if log.thoi_gian_bat_dau else None,
                "thoi_gian_ket_thuc": log.thoi_gian_ket_thuc.isoformat() if log.thoi_gian_ket_thuc else None,
            })

        if not history:
            if rx.created_at:
                history.append({
                    "lan_thu": 1,
                    "loai_thao_tac": "KHOI_TAO",
                    "trang_thai": "DRAFT",
                    "thong_diep_phan_hoi": "Khởi tạo đơn thuốc",
                    "thoi_gian_bat_dau": rx.created_at.isoformat(),
                    "thoi_gian_ket_thuc": rx.created_at.isoformat(),
                })
            if rx.ngay_ky:
                history.append({
                    "lan_thu": 2,
                    "loai_thao_tac": "KY_SO",
                    "trang_thai": "SIGNED",
                    "thong_diep_phan_hoi": f"Ký số bởi bác sĩ ID {rx.bac_si_ke_don_id}",
                    "thoi_gian_bat_dau": rx.ngay_ky.isoformat(),
                    "thoi_gian_ket_thuc": rx.ngay_ky.isoformat(),
                })
            if rx.thoi_gian_gui_cong:
                history.append({
                    "lan_thu": 3,
                    "loai_thao_tac": "LIEN_THONG_CONG",
                    "trang_thai": rx.trang_thai,
                    "ma_phan_hoi": rx.ma_ket_qua_cong,
                    "thong_diep_phan_hoi": rx.thong_diep_cong or "Gửi cổng quốc gia",
                    "ma_bien_nhan": rx.bien_nhan_giao_dich,
                    "idempotency_key": rx.idempotency_key,
                    "thoi_gian_bat_dau": rx.thoi_gian_gui_cong.isoformat(),
                    "thoi_gian_ket_thuc": rx.thoi_gian_gui_cong.isoformat(),
                })

        is_immutable = rx.trang_thai in (
            TrangThaiDonThuoc.SIGNED.value,
            TrangThaiDonThuoc.ISSUED.value,
            TrangThaiDonThuoc.ACCEPTED.value,
            TrangThaiDonThuoc.SUPERSEDED.value,
        )

        return {
            "prescription_id": rx.id,
            "ma_don_thuoc": rx.ma_don_thuoc or f"DT-{rx.id:06d}",
            "luot_kham_id": rx.luot_kham_id,
            "bac_si_ke_don_id": rx.bac_si_ke_don_id,
            "trang_thai": rx.trang_thai,
            "is_immutable": is_immutable,
            "du_lieu_don_thuoc_hash": rx.du_lieu_don_thuoc_hash,
            "chu_ky_so": rx.chu_ky_so,
            "ngay_ky": rx.ngay_ky.isoformat() if rx.ngay_ky else None,
            "idempotency_key": rx.idempotency_key,
            "bien_nhan_giao_dich": rx.bien_nhan_giao_dich,
            "thoi_gian_gui_cong": rx.thoi_gian_gui_cong.isoformat() if rx.thoi_gian_gui_cong else None,
            "ma_ket_qua_cong": rx.ma_ket_qua_cong,
            "thong_diep_cong": rx.thong_diep_cong,
            "superseded_by_id": rx.superseded_by_id,
            "thay_the_cho_don_id": rx.thay_the_cho_don_id,
            "ly_do_thay_the": rx.ly_do_thay_the,
            "history": history,
        }

    async def get_queue_metrics(
        self,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        stmt_synced = select(func.count(DonThuoc.id)).where(
            DonThuoc.trang_thai == TrangThaiDonThuoc.ACCEPTED.value
        )
        total_synced = (await db.execute(stmt_synced)).scalar() or 0

        pending_states = [
            TrangThaiDonThuoc.SUBMISSION_PENDING.value,
            TrangThaiDonThuoc.SUBMITTED.value,
            TrangThaiDonThuoc.UNKNOWN_RESULT.value,
            TrangThaiDonThuoc.RETRY_PENDING.value,
            TrangThaiDonThuoc.MANUAL_REVIEW.value,
        ]
        stmt_pending = select(func.count(DonThuoc.id)).where(
            DonThuoc.trang_thai.in_(pending_states)
        )
        pending_retry = (await db.execute(stmt_pending)).scalar() or 0

        stmt_failed = select(func.count(DonThuoc.id)).where(
            DonThuoc.trang_thai == TrangThaiDonThuoc.REJECTED.value
        )
        failed_count = (await db.execute(stmt_failed)).scalar() or 0

        stmt_last = select(func.max(DonThuoc.thoi_gian_gui_cong))
        last_sync = (await db.execute(stmt_last)).scalar()
        last_sync_time = last_sync.isoformat() if last_sync else datetime.now(timezone.utc).isoformat()

        return {
            "total_synced": total_synced,
            "pending_retry": pending_retry,
            "failed_count": failed_count,
            "last_sync_time": last_sync_time,
        }

prescription_fsm_service = PrescriptionFSMService()
