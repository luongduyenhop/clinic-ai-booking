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
    def __init__(self):
        self._cache: Dict[str, GatewaySubmissionResult] = {}
        self.timeout_mode: bool = False
        self.invalid_receipt_mode: bool = False

    def generate_national_prescription_code(
        self, province_code: str, facility_code: str, seq: int
    ) -> str:
        clean_prov = f"{int(province_code):02d}" if str(province_code).isdigit() else str(province_code)[:2]
        clean_fac = str(facility_code).strip()
        if len(clean_fac) > 5:
            clean_fac = clean_fac[:5]
        else:
            clean_fac = clean_fac.zfill(5)
        clean_seq = f"{int(seq):07d}"
        code = f"{clean_prov}{clean_fac}{clean_seq}"
        if len(code) != 14:
            raise UnprocessableEntityException("Mã đơn thuốc quốc gia phải có độ dài chính xác 14 ký tự (TT 27/2021/TT-BYT)")
        return code

    def generate_national_qr_lookup_url(self, national_code: str) -> str:
        return f"https://donthuocquocgia.vn/tra-cuu?ma_don={national_code}"

    def validate_receipt(self, receipt: Optional[str], prescription_id: int) -> bool:
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
        if not facility_code or not practitioner_code:
            raise UnprocessableEntityException(
                "Mã cơ sở KCB và mã người hành nghề là bắt buộc khi liên thông Cổng quốc gia!"
            )

        if not idempotency_key:
            raise BadRequestException(
                "Idempotency-Key header là bắt buộc để chống gửi trùng lặp giao dịch!"
            )

        if idempotency_key in self._cache:
            return self._cache[idempotency_key]

        if self.timeout_mode:
            return GatewaySubmissionResult(
                status=TrangThaiDonThuoc.UNKNOWN_RESULT.value,
                transaction_receipt=None,
                code=504,
                idempotency_key=idempotency_key,
                message="Cổng đơn thuốc quốc gia quá thời gian phản hồi (Gateway Timeout 504)",
            )

        if self.invalid_receipt_mode:
            return GatewaySubmissionResult(
                status=TrangThaiDonThuoc.UNKNOWN_RESULT.value,
                transaction_receipt="INVALID_SIGNATURE_RECEIPT",
                code=200,
                idempotency_key=idempotency_key,
                message="HTTP 200 nhưng chữ ký biên nhận không hợp lệ",
            )

        receipt_token = f"RECEIPT-BYT-{prescription_id}-{uuid.uuid4().hex[:12].upper()}"
        result = GatewaySubmissionResult(
            status=TrangThaiDonThuoc.ACCEPTED.value,
            transaction_receipt=receipt_token,
            code=200,
            idempotency_key=idempotency_key,
            message="Cổng đơn thuốc quốc gia đã tiếp nhận và xác thực đơn thuốc thành công",
        )
        self._cache[idempotency_key] = result
        return result

    async def submit_to_gateway(
        self,
        db: AsyncSession,
        prescription_id: int,
        user: TaiKhoan,
        idempotency_key: Optional[str] = None,
        facility_code: Optional[str] = None,
        practitioner_code: Optional[str] = None,
    ) -> GatewaySubmissionResult:
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

        if idempotency_key and idempotency_key in self._cache:
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

        if rx.trang_thai == TrangThaiDonThuoc.SUPERSEDED.value:
            raise ConflictException(
                "Không thể gửi đơn thuốc đã bị thay thế (SUPERSEDED) lên Cổng quốc gia!"
            )

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
                f"Đơn thuốc đang ở trạng thái '{rx.trang_thai}', chưa đủ điều kiện gửi Cổng quốc gia!"
            )

        if not idempotency_key:
            idempotency_key = rx.idempotency_key or f"IDEMP-BYT-{rx.id}-{uuid.uuid4().hex[:12]}"

        if not facility_code:
            stmt_cs = (
                select(GiayPhepCoSo.so_giay_phep)
                .where(GiayPhepCoSo.trang_thai == "ACTIVE")
                .limit(1)
            )
            facility_code = (await db.execute(stmt_cs)).scalar_one_or_none() or "CS-79-0123"

        if not practitioner_code:
            stmt_bs = select(BacSi.chung_chi_hanh_nghe).where(BacSi.id == rx.bac_si_ke_don_id)
            practitioner_code = (await db.execute(stmt_bs)).scalar_one_or_none() or "BS-CCHN-0987"

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

        result = await self.submit_prescription(
            prescription_id=rx.id,
            facility_code=facility_code,
            practitioner_code=practitioner_code,
            idempotency_key=idempotency_key,
        )

        if result.status == TrangThaiDonThuoc.ACCEPTED.value:
            if not self.validate_receipt(result.transaction_receipt, rx.id):
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
        stmt = select(DonThuoc).where(DonThuoc.id == prescription_id)
        rx = (await db.execute(stmt)).scalar_one_or_none()
        if not rx:
            raise NotFoundException(f"Không tìm thấy đơn thuốc với ID {prescription_id}!")

        if rx.trang_thai not in (
            TrangThaiDonThuoc.UNKNOWN_RESULT.value,
            TrangThaiDonThuoc.RETRY_PENDING.value,
        ):
            raise ConflictException(
                f"Chỉ có thể retry gửi Cổng khi đơn thuốc ở trạng thái UNKNOWN_RESULT hoặc RETRY_PENDING!"
            )

        retry_key = idempotency_key or rx.idempotency_key
        return await self.submit_to_gateway(
            db=db,
            prescription_id=prescription_id,
            user=user,
            idempotency_key=retry_key,
        )


national_gateway_service = NationalGatewayService()
