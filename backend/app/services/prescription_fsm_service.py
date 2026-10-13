import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.medical import ChiTietDonThuoc, DonThuoc
from app.models.user import BacSi, TaiKhoan, VaiTroEnum
from app.schemas.clinical import PrescriptionUpdateRequest
from app.schemas.compliance import (
    PrescriptionSupersedeRequest,
    TrangThaiDonThuoc,
)
from app.services.credential_service import credential_service

logger = logging.getLogger("clinic_backend")


# ==============================================================================
# BẢNG MA TRẬN CHUYỂN TRẠNG THÁI FSM ĐƠN THUỐC (INT-04 / R3)
# ==============================================================================

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
    TrangThaiDonThuoc.SUPERSEDED.value: set(),  # Trạng thái kết thúc (Terminal state)
}


class PrescriptionFSMService:
    """
    Dịch vụ Máy trạng thái hữu hạn (FSM) và kiểm soát tính bất biến của Đơn thuốc điện tử.
    Tuân thủ Quyết định BYT về Đơn thuốc điện tử Quốc gia và NĐ 102/2025/NĐ-CP.
    """

    @staticmethod
    def compute_prescription_hash(prescription_id: int, items: List[Dict[str, Any]]) -> str:
        """Tính toán mã băm sha256 bất biến của dữ liệu thuốc trong đơn"""
        payload = f"{prescription_id}:" + json.dumps(
            sorted(items, key=lambda x: x.get("ten_thuoc", "")),
            sort_keys=True
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def transition(current_status: str, next_status: str) -> str:
        """Xác thực và thực hiện chuyển trạng thái theo ma trận chuẩn FSM"""
        allowed = VALID_TRANSITIONS.get(current_status, set())
        if next_status not in allowed:
            raise ConflictException(
                f"Chuyển trạng thái đơn thuốc không hợp lệ: '{current_status}' -> '{next_status}'. "
                f"Các trạng thái được phép: {allowed or 'Không có (trạng thái kết thúc)'}"
            )
        return next_status

    @staticmethod
    def assert_immutable(status: str) -> None:
        """
        Khóa bất biến (Immutability Guard):
        Chặn tuyệt đối sửa/xóa trực tiếp các trường thuốc một khi đơn đã ở trạng thái SIGNED, ISSUED, ACCEPTED, SUPERSEDED.
        """
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
        """Ký số đơn thuốc (hỗ trợ cả cấu trúc dict thuần và ORM model)"""
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

        # ORM Instance
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
        new_prescription_id: int,
        reason: str,
    ) -> Tuple[Any, Any]:
        """Tạo đơn thay thế và khóa đơn cũ sang SUPERSEDED"""
        if not reason or len(reason.strip()) < 5:
            raise BadRequestException("Lý do thay thế đơn thuốc phải được nêu rõ ràng (tối thiểu 5 ký tự)!")

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
            old_prescription["superseded_by_id"] = new_prescription_id
            old_prescription["ly_do_thay_the"] = reason

            new_prescription = {
                "id": new_prescription_id,
                "thay_the_cho_don_id": old_prescription.get("id"),
                "trang_thai": TrangThaiDonThuoc.DRAFT.value,
                "luot_kham_id": old_prescription.get("luot_kham_id"),
                "items": [],
            }
            return old_prescription, new_prescription

        # ORM Instance
        if old_prescription.trang_thai not in (
            TrangThaiDonThuoc.SIGNED.value,
            TrangThaiDonThuoc.ISSUED.value,
            TrangThaiDonThuoc.ACCEPTED.value,
        ):
            raise ConflictException(
                f"Chỉ có thể thay thế đơn thuốc đã ký hoặc ban hành! Trạng thái hiện tại: {old_prescription.trang_thai}"
            )
        old_prescription.trang_thai = TrangThaiDonThuoc.SUPERSEDED.value
        old_prescription.superseded_by_id = new_prescription_id
        old_prescription.ly_do_thay_the = reason
        return old_prescription, None

    # ==========================================================================
    # ASYNC SERVICE WORKFLOWS CHO API ROUTERS
    # ==========================================================================

    async def get_prescription_or_404(
        self,
        db: AsyncSession,
        prescription_id: int
    ) -> DonThuoc:
        """Truy vấn đơn thuốc cùng danh sách chi tiết thuốc theo ID"""
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
        """Thẩm định chuyên môn đơn thuốc: DRAFT -> VALIDATED"""
        rx = await self.get_prescription_or_404(db, prescription_id)

        # Chuyển trạng thái
        rx.trang_thai = self.transition(rx.trang_thai, TrangThaiDonThuoc.VALIDATED.value)
        await db.commit()
        await db.refresh(rx)
        logger.info(f"📋 [FSM VALIDATED] DonThuoc: {rx.id} | User: {user.id}")
        return rx

    async def sign_prescription_db(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        signature_data: str
    ) -> DonThuoc:
        """Ký số đơn thuốc điện tử: VALIDATED -> SIGNED"""
        rx = await self.get_prescription_or_404(db, prescription_id)

        # 1. Bác sĩ thực hiện ký
        stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
        bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bac_si and user.vai_tro != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Chỉ có Bác sĩ phụ trách mới có quyền ký số đơn thuốc!")

        doctor_id = bac_si.id if bac_si else rx.bac_si_ke_don_id

        # 2. Kiểm tra điều kiện giấy phép hành nghề (INT-05 Credentialing Enforcement)
        await credential_service.check_doctor_license_valid(db, doctor_id)

        # 3. Ký số & Khóa hash bất biến
        self.sign_prescription(rx, doctor_id=doctor_id, signature_data=signature_data)
        await db.commit()
        await db.refresh(rx)
        logger.info(f"✍️ [FSM SIGNED] DonThuoc: {rx.id} | Doctor: {doctor_id} | Hash: {rx.du_lieu_don_thuoc_hash}")
        return rx

    async def issue_prescription_db(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan
    ) -> DonThuoc:
        """Ban hành đơn thuốc ra bên ngoài: SIGNED -> ISSUED"""
        rx = await self.get_prescription_or_404(db, prescription_id)
        rx.trang_thai = self.transition(rx.trang_thai, TrangThaiDonThuoc.ISSUED.value)
        await db.commit()
        await db.refresh(rx)
        logger.info(f"📤 [FSM ISSUED] DonThuoc: {rx.id} | User: {user.id}")
        return rx

    async def supersede_prescription_db(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        payload: PrescriptionSupersedeRequest
    ) -> Tuple[DonThuoc, DonThuoc]:
        """Thu hồi đơn cũ và tạo đơn thuốc thay thế mới liên kết (SUPERSEDED Workflow)"""
        rx = await self.get_prescription_or_404(db, prescription_id)

        stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
        bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        doctor_id = bac_si.id if bac_si else rx.bac_si_ke_don_id

        if bac_si:
            await credential_service.check_doctor_license_valid(db, doctor_id)

        # 1. Đánh dấu đơn cũ SUPERSEDED
        self.supersede(rx, new_prescription_id=0, reason=payload.ly_do)

        # 2. Khởi tạo đơn mới ở trạng thái DRAFT
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

        # 3. Gán danh sách thuốc cho đơn mới
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

        # 4. Gắn liên kết superseded_by_id từ đơn cũ sang đơn mới
        rx.superseded_by_id = new_rx.id

        await db.commit()

        # Nạp lại đầy đủ quan hệ
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
            f"🔄 [FSM SUPERSEDED] Old Rx: {saved_old.id} -> New Rx: {saved_new.id} | Reason: {payload.ly_do}"
        )
        return saved_old, saved_new

    async def update_prescription_db(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        payload: PrescriptionUpdateRequest
    ) -> DonThuoc:
        """Cập nhật nội dung đơn thuốc (chỉ cho phép khi ở DRAFT hoặc VALIDATED; cấm khi SIGNED/ISSUED)"""
        rx = await self.get_prescription_or_404(db, prescription_id)

        # Kiểm tra tính bất biến: SIGNED, ISSUED, ACCEPTED, SUPERSEDED -> 409 Conflict
        self.assert_immutable(rx.trang_thai)

        if payload.loi_dan_uong_thuoc is not None:
            rx.loi_dan_uong_thuoc = payload.loi_dan_uong_thuoc
        if payload.ghi_chu_duoc_lam_sang is not None:
            rx.ghi_chu_duoc_lam_sang = payload.ghi_chu_duoc_lam_sang

        if payload.danh_sach_thuoc is not None:
            # Xóa các chi tiết thuốc cũ
            for old_item in list(rx.danh_sach_chi_tiet or []):
                await db.delete(old_item)
            await db.flush()

            # Thêm mới
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

            # Nếu đơn thuốc đã từng VALIDATED, quay về DRAFT để thẩm định lại
            if rx.trang_thai == TrangThaiDonThuoc.VALIDATED.value:
                rx.trang_thai = TrangThaiDonThuoc.DRAFT.value

        await db.commit()
        await db.refresh(rx)
        logger.info(f"✏️ [PRESCRIPTION UPDATED] DonThuoc: {rx.id} | Status: {rx.trang_thai}")
        return rx


prescription_fsm_service = PrescriptionFSMService()
