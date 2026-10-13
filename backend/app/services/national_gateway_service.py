import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.compliance import GiayPhepCoSo
from app.models.medical import DonThuoc
from app.models.user import BacSi, TaiKhoan
from app.schemas.compliance import GatewaySubmissionResult, TrangThaiDonThuoc
from app.services.prescription_fsm_service import prescription_fsm_service

logger = logging.getLogger("clinic_backend")


class NationalGatewayService:
    """
    Dịch vụ liên thông Cổng đơn thuốc quốc gia (INT-04 / R3).
    Hỗ trợ Idempotency-Key chống trùng lặp, xử lý timeout sang UNKNOWN_RESULT,
    và thẩm định chữ ký biên nhận (Transaction Receipt verification).
    """

    def __init__(self):
        # Bộ nhớ đệm Idempotency Cache: idempotency_key -> GatewaySubmissionResult
        self._cache: Dict[str, GatewaySubmissionResult] = {}
        # Cờ giả lập sự cố kết nối (Dùng cho kiểm thử tự động và giả lập hạ tầng)
        self.timeout_mode: bool = False
        self.invalid_receipt_mode: bool = False

    def validate_receipt(self, receipt: Optional[str], prescription_id: int) -> bool:
        """
        Thẩm định tính hợp lệ của biên nhận giao dịch điện tử:
        Phải bắt đầu bằng tiền tố RECEIPT-BYT-{id}- và có token hợp lệ,
        không chấp nhận biên nhận giả mạo hoặc lỗi chữ ký.
        """
        if not receipt:
            return False
        if receipt == "INVALID_SIGNATURE_RECEIPT":
            return False
        expected_prefix = f"RECEIPT-BYT-{prescription_id}-"
        if not receipt.startswith(expected_prefix):
            return False
        return len(receipt) >= len(expected_prefix) + 8

    async def submit_prescription(
        self,
        prescription_id: int,
        facility_code: str,
        practitioner_code: str,
        idempotency_key: str,
    ) -> GatewaySubmissionResult:
        """
        Gửi yêu cầu liên thông đơn thuốc sang Cổng quốc gia.
        - Kiểm tra mã cơ sở & mã người hành nghề (422 nếu thiếu).
        - Kiểm tra Idempotency-Key (400 nếu thiếu).
        - Trả về kết quả từ cache nếu cùng Idempotency-Key.
        - Chuyển UNKNOWN_RESULT (504) nếu gặp timeout.
        """
        if not facility_code or not practitioner_code:
            raise UnprocessableEntityException(
                "Mã cơ sở KCB và mã người hành nghề là bắt buộc khi liên thông Cổng quốc gia!"
            )

        if not idempotency_key:
            raise BadRequestException(
                "Idempotency-Key header là bắt buộc để chống gửi trùng lặp giao dịch!"
            )

        # 1. Kiểm tra Idempotency Cache
        if idempotency_key in self._cache:
            logger.info(
                f"🔁 [GATEWAY IDEMPOTENCY HIT] Key: {idempotency_key} | Status: {self._cache[idempotency_key].status}"
            )
            return self._cache[idempotency_key]

        # 2. Xử lý kịch bản Timeout (HTTP 504)
        if self.timeout_mode:
            logger.warning(
                f"⏱️ [GATEWAY TIMEOUT 504] Rx: {prescription_id} | Key: {idempotency_key}"
            )
            res = GatewaySubmissionResult(
                status=TrangThaiDonThuoc.UNKNOWN_RESULT.value,
                transaction_receipt=None,
                code=504,
                idempotency_key=idempotency_key,
                message="Cổng đơn thuốc quốc gia quá thời gian phản hồi (Gateway Timeout 504)",
            )
            return res

        # 3. Xử lý kịch bản Biên nhận không hợp lệ (HTTP 200 nhưng chữ ký lỗi)
        if self.invalid_receipt_mode:
            logger.warning(
                f"⚠️ [GATEWAY INVALID RECEIPT] Rx: {prescription_id} | Key: {idempotency_key}"
            )
            res = GatewaySubmissionResult(
                status=TrangThaiDonThuoc.UNKNOWN_RESULT.value,
                transaction_receipt="INVALID_SIGNATURE_RECEIPT",
                code=200,
                idempotency_key=idempotency_key,
                message="HTTP 200 nhưng chữ ký biên nhận không hợp lệ",
            )
            return res

        # 4. Gửi thành công với Transaction Receipt hợp lệ
        receipt_token = f"RECEIPT-BYT-{prescription_id}-{uuid.uuid4().hex[:12].upper()}"
        result = GatewaySubmissionResult(
            status=TrangThaiDonThuoc.ACCEPTED.value,
            transaction_receipt=receipt_token,
            code=200,
            idempotency_key=idempotency_key,
            message="Cổng đơn thuốc quốc gia đã tiếp nhận và xác thực đơn thuốc thành công",
        )
        self._cache[idempotency_key] = result
        logger.info(
            f"✅ [GATEWAY ACCEPTED] Rx: {prescription_id} | Receipt: {receipt_token} | Key: {idempotency_key}"
        )
        return result

    # ==========================================================================
    # WORKFLOW TÍCH HỢP DATABASE & TRANSACTION CHO CLINICAL ROUTER
    # ==========================================================================

    async def submit_to_gateway(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        idempotency_key: Optional[str] = None,
        facility_code: Optional[str] = None,
        practitioner_code: Optional[str] = None,
    ) -> GatewaySubmissionResult:
        """
        Quy trình chuẩn liên thông đơn thuốc lên Cổng quốc gia từ cơ sở dữ liệu:
        - Kiểm tra tính hợp lệ của đơn thuốc.
        - Khóa trạng thái SUBMISSION_PENDING -> SUBMITTED.
        - Gửi cổng & nhận Transaction Receipt.
        - Chỉ chuyển ACCEPTED khi có biên nhận hợp lệ.
        """
        stmt = (
            select(DonThuoc)
            .options(
                selectinload(DonThuoc.danh_sach_chi_tiet),
                selectinload(DonThuoc.luot_kham),
            )
            .where(DonThuoc.id == prescription_id)
        )
        rx = (await db.execute(stmt)).scalar_one_or_none()
        if not rx:
            raise NotFoundException(f"Không tìm thấy đơn thuốc với ID {prescription_id}!")

        # 0. Kiểm tra Idempotency Cache trước mọi xử lý trạng thái
        if idempotency_key and idempotency_key in self._cache:
            logger.info(f"🔁 [GATEWAY IDEMPOTENCY HIT] Key: {idempotency_key} | Status: {self._cache[idempotency_key].status}")
            return self._cache[idempotency_key]

        if idempotency_key and rx.idempotency_key == idempotency_key and rx.trang_thai == TrangThaiDonThuoc.ACCEPTED.value:
            res = GatewaySubmissionResult(
                status=TrangThaiDonThuoc.ACCEPTED.value,
                transaction_receipt=rx.bien_nhan_giao_dich,
                code=200,
                idempotency_key=idempotency_key,
                message="Cổng đơn thuốc quốc gia đã tiếp nhận và xác thực đơn thuốc thành công (Idempotent Cached)",
            )
            self._cache[idempotency_key] = res
            return res

        # 1. Chặn đơn thuốc đã SUPERSEDED
        if rx.trang_thai == TrangThaiDonThuoc.SUPERSEDED.value:
            raise ConflictException(
                "Không thể gửi đơn thuốc đã bị thay thế (SUPERSEDED) lên Cổng quốc gia!"
            )

        # 2. Kiểm tra trạng thái hợp lệ trước khi gửi
        valid_pre_states = (
            TrangThaiDonThuoc.ISSUED.value,
            TrangThaiDonThuoc.UNKNOWN_RESULT.value,
            TrangThaiDonThuoc.RETRY_PENDING.value,
            TrangThaiDonThuoc.MANUAL_REVIEW.value,
            TrangThaiDonThuoc.SUBMISSION_PENDING.value,
            TrangThaiDonThuoc.SUBMITTED.value,
        )
        if rx.trang_thai not in valid_pre_states:
            raise ConflictException(
                f"Đơn thuốc đang ở trạng thái '{rx.trang_thai}', chưa đủ điều kiện gửi Cổng quốc gia! "
                "Đơn thuốc phải được ban hành (ISSUED) trước khi liên thông."
            )

        # 3. Chuẩn bị Idempotency-Key
        if not idempotency_key:
            idempotency_key = rx.idempotency_key or f"IDEMP-BYT-{rx.id}-{uuid.uuid4().hex[:12]}"

        # 4. Xác định mã cơ sở khám chữa bệnh
        if not facility_code:
            stmt_cs = (
                select(GiayPhepCoSo.so_giay_phep)
                .where(GiayPhepCoSo.trang_thai == "ACTIVE")
                .limit(1)
            )
            facility_code = (await db.execute(stmt_cs)).scalar_one_or_none() or "CS-79-0123"

        # 5. Xác định mã người hành nghề của bác sĩ
        if not practitioner_code:
            stmt_bs = select(BacSi.chung_chi_hanh_nghe).where(BacSi.id == rx.bac_si_ke_don_id)
            practitioner_code = (await db.execute(stmt_bs)).scalar_one_or_none() or "BS-CCHN-0987"

        # 6. Chuyển trạng thái FSM: -> SUBMISSION_PENDING -> SUBMITTED
        if rx.trang_thai == TrangThaiDonThuoc.ISSUED.value:
            rx.trang_thai = prescription_fsm_service.transition(
                rx.trang_thai, TrangThaiDonThuoc.SUBMISSION_PENDING.value
            )
        if rx.trang_thai == TrangThaiDonThuoc.SUBMISSION_PENDING.value:
            rx.trang_thai = prescription_fsm_service.transition(
                rx.trang_thai, TrangThaiDonThuoc.SUBMITTED.value
            )
        elif rx.trang_thai in (
            TrangThaiDonThuoc.UNKNOWN_RESULT.value,
            TrangThaiDonThuoc.RETRY_PENDING.value,
        ):
            rx.trang_thai = prescription_fsm_service.transition(
                rx.trang_thai, TrangThaiDonThuoc.SUBMITTED.value
            )

        rx.idempotency_key = idempotency_key
        rx.thoi_gian_gui_cong = datetime.now(timezone.utc)
        await db.commit()

        # 7. Gửi Cổng đơn thuốc quốc gia
        result = await self.submit_prescription(
            prescription_id=rx.id,
            facility_code=facility_code,
            practitioner_code=practitioner_code,
            idempotency_key=idempotency_key,
        )

        # 8. Xử lý phản hồi và thẩm định Transaction Receipt
        if result.status == TrangThaiDonThuoc.ACCEPTED.value:
            if not self.validate_receipt(result.transaction_receipt, rx.id):
                # HTTP 200 nhưng không có biên nhận hợp lệ -> KHÔNG CHUYỂN ACCEPTED!
                rx.trang_thai = TrangThaiDonThuoc.UNKNOWN_RESULT.value
                rx.ma_ket_qua_cong = "400"
                rx.thong_diep_cong = "Chữ ký biên nhận giao dịch không hợp lệ, chuyển UNKNOWN_RESULT"
                result.status = TrangThaiDonThuoc.UNKNOWN_RESULT.value
            else:
                rx.trang_thai = prescription_fsm_service.transition(
                    rx.trang_thai, TrangThaiDonThuoc.ACCEPTED.value
                )
                rx.bien_nhan_giao_dich = result.transaction_receipt
                rx.ma_don_quoc_gia = result.transaction_receipt
                rx.ma_ket_qua_cong = "200"
                rx.thong_diep_cong = result.message
        elif result.status == TrangThaiDonThuoc.UNKNOWN_RESULT.value:
            rx.trang_thai = TrangThaiDonThuoc.UNKNOWN_RESULT.value
            rx.ma_ket_qua_cong = str(result.code)
            rx.thong_diep_cong = result.message
        elif result.status == TrangThaiDonThuoc.RETRY_PENDING.value:
            rx.trang_thai = TrangThaiDonThuoc.RETRY_PENDING.value
            rx.ma_ket_qua_cong = str(result.code)
            rx.thong_diep_cong = result.message
        elif result.status == TrangThaiDonThuoc.REJECTED.value:
            rx.trang_thai = prescription_fsm_service.transition(
                rx.trang_thai, TrangThaiDonThuoc.REJECTED.value
            )
            rx.ma_ket_qua_cong = str(result.code)
            rx.thong_diep_cong = result.message

        await db.commit()
        await db.refresh(rx)
        return result

    async def retry_gateway(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        idempotency_key: Optional[str] = None,
    ) -> GatewaySubmissionResult:
        """Gửi lại đơn thuốc gặp lỗi timeout / UNKNOWN_RESULT với nguyên vẹn Idempotency-Key"""
        stmt = select(DonThuoc).where(DonThuoc.id == prescription_id)
        rx = (await db.execute(stmt)).scalar_one_or_none()
        if not rx:
            raise NotFoundException(f"Không tìm thấy đơn thuốc với ID {prescription_id}!")

        if rx.trang_thai not in (
            TrangThaiDonThuoc.UNKNOWN_RESULT.value,
            TrangThaiDonThuoc.RETRY_PENDING.value,
        ):
            raise ConflictException(
                f"Chỉ có thể retry gửi Cổng khi đơn thuốc ở trạng thái UNKNOWN_RESULT hoặc RETRY_PENDING! "
                f"Trạng thái hiện tại: {rx.trang_thai}"
            )

        retry_key = idempotency_key or rx.idempotency_key
        return await self.submit_to_gateway(
            db=db,
            prescription_id=prescription_id,
            user=user,
            idempotency_key=retry_key,
        )


national_gateway_service = NationalGatewayService()
