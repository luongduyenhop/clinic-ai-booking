import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    BadRequestException,
)
from app.models.compliance import GiayPhepCoSo, LichSuGiayPhepBacSi, TrangThaiGiayPhep
from app.models.medical import DichVu
from app.models.user import BacSi
from app.schemas.compliance import (
    DoctorLicenseResponse,
    DoctorLicenseStatusUpdateRequest,
    DoctorLicenseUpdateRequest,
    FacilityLicenseCreateRequest,
    FacilityLicenseResponse,
    FacilityLicenseUpdateRequest,
    LicenseAuditHistoryResponse,
    LicenseExpiryAlertItem,
    LicenseExpiryAlertResponse,
)

logger = logging.getLogger(__name__)


class DoctorLicenseInvalidException(ForbiddenException):
    """Lỗi giấy phép bác sĩ hết hạn, tạm đình chỉ hoặc bị thu hồi (403 Forbidden)"""
    def __init__(self, message: str = "Doctor license is EXPIRED or SUSPENDED", code: int = status.HTTP_403_FORBIDDEN):
        super().__init__(message=message)
        self.status_code = code
        self.detail = message


class ScopeMismatchException(ConflictException):
    """Lỗi dịch vụ y tế nằm ngoài phạm vi hoạt động chuyên môn của bác sĩ (409 Conflict)"""
    def __init__(
        self,
        message: str = "Service specialty outside doctor licensed scope of practice",
        code: int = status.HTTP_409_CONFLICT,
    ):
        super().__init__(message=message)
        self.status_code = code
        self.detail = message


class CredentialService:
    """Nghiệp vụ Quản lý Giấy phép & Điều kiện Hành nghề Y tế (Credentialing & License Lifecycle - INT-05)"""

    # --- 1. Automated Guards & Verification ---

    async def check_doctor_license_valid(self, db: AsyncSession, doctor_id: int) -> BacSi:
        """
        Kiểm tra tính hợp lệ của giấy phép hành nghề bác sĩ (INT-05 Guard).
        Chặn phân công lịch khám hoặc thực hiện ca khám mới nếu giấy phép EXPIRED, SUSPENDED hoặc REVOKED.
        Raises DoctorLicenseInvalidException (HTTP 403) nếu không hợp lệ.
        """
        stmt = (
            select(BacSi)
            .options(
                selectinload(BacSi.nguoi_dung),
                selectinload(BacSi.chuyen_khoa),
            )
            .where(BacSi.id == doctor_id)
        )
        bac_si = (await db.execute(stmt)).scalar_one_or_none()
        if not bac_si:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")

        doc_name = bac_si.nguoi_dung.ho_ten if bac_si.nguoi_dung else f"ID {doctor_id}"

        # Kiểm tra trạng thái tường minh
        if bac_si.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRED.value:
            raise DoctorLicenseInvalidException(
                f"Giấy phép hành nghề của Bác sĩ {doc_name} đã HẾT HẠN (EXPIRED). Không thể phân công hoặc tiếp nhận ca khám!"
            )
        if bac_si.trang_thai_giay_phep == TrangThaiGiayPhep.SUSPENDED.value:
            raise DoctorLicenseInvalidException(
                f"Bác sĩ {doc_name} đang bị TẠM ĐÌNH CHỈ hành nghề (SUSPENDED). Mọi hoạt động chuyên môn bị tạm khóa!"
            )
        if bac_si.trang_thai_giay_phep == TrangThaiGiayPhep.REVOKED.value:
            raise DoctorLicenseInvalidException(
                f"Giấy phép hành nghề của Bác sĩ {doc_name} đã bị THU HỒI (REVOKED). Từ chối thực hiện tác vụ!"
            )

        # Kiểm tra ngày hết hạn thực tế
        if bac_si.ngay_het_han:
            now = datetime.now(timezone.utc)
            exp_date = bac_si.ngay_het_han
            if exp_date.tzinfo is None:
                exp_date = exp_date.replace(tzinfo=timezone.utc)

            if exp_date < now:
                # Tự động cập nhật trạng thái EXPIRED
                bac_si.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRED.value
                db.add(bac_si)
                await db.commit()
                await db.refresh(bac_si)
                raise DoctorLicenseInvalidException(
                    f"Giấy phép hành nghề của Bác sĩ {doc_name} đã hết hạn vào ngày {exp_date.strftime('%Y-%m-%d')}!"
                )

        if not bac_si.is_active:
            raise DoctorLicenseInvalidException(f"Hồ sơ Bác sĩ {doc_name} hiện đang ở trạng thái ngừng hoạt động!")

        return bac_si

    async def validate_doctor_active(self, db: AsyncSession, doctor_id: int) -> BacSi:
        """Alias tương thích theo đặc tả Interface Contract trong PROJECT.md"""
        return await self.check_doctor_license_valid(db, doctor_id)

    async def check_doctor_scope_of_practice(self, db: AsyncSession, doctor_id: int, service_id: int) -> bool:
        """
        Kiểm tra phạm vi hoạt động chuyên môn của bác sĩ đối với dịch vụ y tế chỉ định (INT-05 Scope Guard).
        Nếu dịch vụ có chuyên khoa nằm ngoài danh mục pham_vi_chuyen_mon của bác sĩ, ném ScopeMismatchException (HTTP 409).
        """
        stmt_bs = (
            select(BacSi)
            .options(selectinload(BacSi.chuyen_khoa), selectinload(BacSi.nguoi_dung))
            .where(BacSi.id == doctor_id)
        )
        bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bac_si:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")

        stmt_dv = (
            select(DichVu)
            .options(selectinload(DichVu.chuyen_khoa))
            .where(DichVu.id == service_id)
        )
        dich_vu = (await db.execute(stmt_dv)).scalar_one_or_none()
        if not dich_vu:
            raise NotFoundException(f"Không tìm thấy Dịch vụ y tế với mã ID {service_id}")

        # Nếu bác sĩ có thiết lập phạm vi chuyên môn cụ thể (danh sách không rỗng)
        scope = bac_si.pham_vi_chuyen_mon or []
        if isinstance(scope, list) and len(scope) > 0:
            allowed_tokens = {str(item).strip().upper() for item in scope if item}

            # Các định danh liên quan đến dịch vụ
            service_tokens = set()
            if dich_vu.ma_dich_vu:
                service_tokens.add(dich_vu.ma_dich_vu.strip().upper())
            if dich_vu.ten_dich_vu:
                service_tokens.add(dich_vu.ten_dich_vu.strip().upper())
            if dich_vu.chuyen_khoa_id:
                service_tokens.add(str(dich_vu.chuyen_khoa_id))
            if dich_vu.chuyen_khoa:
                if dich_vu.chuyen_khoa.ma_chuyen_khoa:
                    service_tokens.add(dich_vu.chuyen_khoa.ma_chuyen_khoa.strip().upper())
                if dich_vu.chuyen_khoa.ten_chuyen_khoa:
                    service_tokens.add(dich_vu.chuyen_khoa.ten_chuyen_khoa.strip().upper())

            # Đối chiếu token
            if not allowed_tokens.intersection(service_tokens):
                doc_name = bac_si.nguoi_dung.ho_ten if bac_si.nguoi_dung else f"ID {doctor_id}"
                raise ScopeMismatchException(
                    f"Dịch vụ y tế '{dich_vu.ten_dich_vu}' có chuyên khoa nằm ngoài phạm vi chuyên môn "
                    f"được cấp phép của Bác sĩ {doc_name}!"
                )

        return True

    async def validate_doctor_scope(self, db: AsyncSession, doctor_id: int, service_id: int) -> bool:
        """Alias tương thích theo đặc tả Interface Contract trong PROJECT.md"""
        return await self.check_doctor_scope_of_practice(db, doctor_id, service_id)

    # --- 2. Doctor License Management & Audit History ---

    async def get_doctor_license(self, db: AsyncSession, doctor_id: int) -> DoctorLicenseResponse:
        """Tra cứu chi tiết thông tin giấy phép hành nghề của bác sĩ"""
        stmt = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.id == doctor_id)
        )
        bac_si = (await db.execute(stmt)).scalar_one_or_none()
        if not bac_si:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")

        return self._to_doctor_license_response(bac_si)

    async def update_doctor_license(
        self,
        db: AsyncSession,
        doctor_id: int,
        payload: DoctorLicenseUpdateRequest,
        user_id: Optional[int] = None,
    ) -> DoctorLicenseResponse:
        """Cập nhật thông tin giấy phép hành nghề của bác sĩ"""
        stmt = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.id == doctor_id)
        )
        bac_si = (await db.execute(stmt)).scalar_one_or_none()
        if not bac_si:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")

        old_status = bac_si.trang_thai_giay_phep

        if payload.ngay_cap is not None:
            bac_si.ngay_cap = payload.ngay_cap
        if payload.ngay_het_han is not None:
            bac_si.ngay_het_han = payload.ngay_het_han
        if payload.pham_vi_chuyen_mon is not None:
            bac_si.pham_vi_chuyen_mon = payload.pham_vi_chuyen_mon
        if payload.tep_dinh_kem_url is not None:
            bac_si.tep_dinh_kem_url = payload.tep_dinh_kem_url

        if payload.trang_thai_giay_phep and payload.trang_thai_giay_phep != old_status:
            bac_si.trang_thai_giay_phep = payload.trang_thai_giay_phep
            # Ghi vết lịch sử thay đổi trạng thái
            audit = LichSuGiayPhepBacSi(
                bac_si_id=doctor_id,
                trang_thai_cu=old_status,
                trang_thai_moi=payload.trang_thai_giay_phep,
                nguoi_thuc_hien_id=user_id,
                ly_do="Cập nhật thông tin hồ sơ giấy phép hành nghề",
                ngay_hieu_luc=datetime.now(timezone.utc),
            )
            db.add(audit)

        await db.commit()
        await db.refresh(bac_si)
        return self._to_doctor_license_response(bac_si)

    async def update_doctor_license_status(
        self,
        db: AsyncSession,
        doctor_id: int,
        payload: DoctorLicenseStatusUpdateRequest,
        user_id: Optional[int] = None,
    ) -> DoctorLicenseResponse:
        """
        Cập nhật trạng thái giấy phép bác sĩ kèm lý do bắt buộc và lưu vết kiểm toán (INT-05 Audit Log).
        """
        valid_statuses = {s.value for s in TrangThaiGiayPhep}
        if payload.trang_thai_moi not in valid_statuses:
            raise BadRequestException(
                f"Trạng thái '{payload.trang_thai_moi}' không hợp lệ. Các trạng thái hợp lệ: {valid_statuses}"
            )

        stmt = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.id == doctor_id)
        )
        bac_si = (await db.execute(stmt)).scalar_one_or_none()
        if not bac_si:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")

        old_status = bac_si.trang_thai_giay_phep
        new_status = payload.trang_thai_moi

        bac_si.trang_thai_giay_phep = new_status
        # Đồng bộ cờ is_active tương ứng
        if new_status in (TrangThaiGiayPhep.EXPIRED.value, TrangThaiGiayPhep.SUSPENDED.value, TrangThaiGiayPhep.REVOKED.value):
            bac_si.is_active = False
        elif new_status == TrangThaiGiayPhep.ACTIVE.value:
            bac_si.is_active = True

        # Ghi vết nhật ký biến động giấy phép
        audit_entry = LichSuGiayPhepBacSi(
            bac_si_id=doctor_id,
            trang_thai_cu=old_status,
            trang_thai_moi=new_status,
            nguoi_thuc_hien_id=user_id,
            ly_do=payload.ly_do,
            ngay_hieu_luc=payload.ngay_hieu_luc or datetime.now(timezone.utc),
            ghi_chu=payload.ghi_chu,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(bac_si)

        logger.info(
            f"📜 [LICENSE STATUS CHANGED] Doctor: {doctor_id} | Old: {old_status} -> New: {new_status} | Reason: {payload.ly_do}"
        )
        return self._to_doctor_license_response(bac_si)

    async def get_doctor_license_history(
        self, db: AsyncSession, doctor_id: int
    ) -> List[LicenseAuditHistoryResponse]:
        """Lấy toàn bộ lịch sử biến động trạng thái giấy phép của bác sĩ (Audit Trail)"""
        stmt_bs = select(BacSi).options(selectinload(BacSi.nguoi_dung)).where(BacSi.id == doctor_id)
        bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bac_si:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")

        stmt = (
            select(LichSuGiayPhepBacSi)
            .options(
                selectinload(LichSuGiayPhepBacSi.nguoi_thuc_hien),
                selectinload(LichSuGiayPhepBacSi.bac_si).selectinload(BacSi.nguoi_dung),
            )
            .where(LichSuGiayPhepBacSi.bac_si_id == doctor_id)
            .order_by(LichSuGiayPhepBacSi.created_at.desc())
        )
        records = (await db.execute(stmt)).scalars().all()

        return [
            LicenseAuditHistoryResponse(
                id=rec.id,
                bac_si_id=rec.bac_si_id,
                bac_si_ho_ten=rec.bac_si.nguoi_dung.ho_ten if rec.bac_si and rec.bac_si.nguoi_dung else None,
                trang_thai_cu=rec.trang_thai_cu,
                trang_thai_moi=rec.trang_thai_moi,
                nguoi_thuc_hien_id=rec.nguoi_thuc_hien_id,
                nguoi_thuc_hien_email=rec.nguoi_thuc_hien.email if rec.nguoi_thuc_hien else None,
                ly_do=rec.ly_do,
                ngay_hieu_luc=rec.ngay_hieu_luc,
                ghi_chu=rec.ghi_chu,
                created_at=rec.created_at,
            )
            for rec in records
        ]

    # --- 3. License Expiry Lifecycle & 90/60/30-Day Alerts ---

    async def get_license_expiry_alerts(self, db: AsyncSession) -> LicenseExpiryAlertResponse:
        """
        Quét và phân loại danh sách giấy phép bác sĩ sắp hết hạn hoặc đã hết hạn
        theo các mốc 90, 60, 30 ngày (INT-05 Warning System).
        Đồng thời tự động cập nhật trạng thái EXPIRING_SOON / EXPIRED cho hồ sơ.
        """
        stmt = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.ngay_het_han.isnot(None))
            .order_by(BacSi.ngay_het_han.asc())
        )
        doctors = (await db.execute(stmt)).scalars().all()

        now = datetime.now(timezone.utc)
        exp_90: List[LicenseExpiryAlertItem] = []
        exp_60: List[LicenseExpiryAlertItem] = []
        exp_30: List[LicenseExpiryAlertItem] = []
        expired_list: List[LicenseExpiryAlertItem] = []

        modified = False
        for doc in doctors:
            exp_date = doc.ngay_het_han
            if exp_date.tzinfo is None:
                exp_date = exp_date.replace(tzinfo=timezone.utc)

            days_left = (exp_date.date() - now.date()).days
            ho_ten = doc.nguoi_dung.ho_ten if doc.nguoi_dung else f"BS #{doc.id}"
            ck_ten = doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "Chưa gán"

            item = LicenseExpiryAlertItem(
                bac_si_id=doc.id,
                ho_ten=ho_ten,
                so_cchn=doc.chung_chi_hanh_nghe,
                chuyen_khoa=ck_ten,
                ngay_het_han=doc.ngay_het_han,
                days_until_expiry=days_left,
                trang_thai_giay_phep=doc.trang_thai_giay_phep,
            )

            if days_left < 0:
                expired_list.append(item)
                if doc.trang_thai_giay_phep != TrangThaiGiayPhep.EXPIRED.value and doc.trang_thai_giay_phep != TrangThaiGiayPhep.REVOKED.value:
                    doc.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRED.value
                    item.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRED.value
                    modified = True
            elif days_left <= 30:
                exp_30.append(item)
                if doc.trang_thai_giay_phep == TrangThaiGiayPhep.ACTIVE.value:
                    doc.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRING_SOON.value
                    item.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRING_SOON.value
                    modified = True
            elif days_left <= 60:
                exp_60.append(item)
                if doc.trang_thai_giay_phep == TrangThaiGiayPhep.ACTIVE.value:
                    doc.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRING_SOON.value
                    item.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRING_SOON.value
                    modified = True
            elif days_left <= 90:
                exp_90.append(item)
                if doc.trang_thai_giay_phep == TrangThaiGiayPhep.ACTIVE.value:
                    doc.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRING_SOON.value
                    item.trang_thai_giay_phep = TrangThaiGiayPhep.EXPIRING_SOON.value
                    modified = True

        if modified:
            await db.commit()

        total = len(expired_list) + len(exp_30) + len(exp_60) + len(exp_90)
        return LicenseExpiryAlertResponse(
            expiring_90_days=exp_90,
            expiring_60_days=exp_60,
            expiring_30_days=exp_30,
            expired=expired_list,
            total_alerts=total,
        )

    # --- 4. Facility License (GiayPhepCoSo) Management ---

    async def create_facility_license(
        self, db: AsyncSession, payload: FacilityLicenseCreateRequest
    ) -> FacilityLicenseResponse:
        """Tạo mới giấy phép hoạt động cơ sở khám chữa bệnh"""
        stmt_check = select(GiayPhepCoSo).where(GiayPhepCoSo.so_giay_phep == payload.so_giay_phep)
        if (await db.execute(stmt_check)).scalar_one_or_none():
            raise ConflictException(f"Giấy phép cơ sở số '{payload.so_giay_phep}' đã tồn tại trong hệ thống!")

        facility = GiayPhepCoSo(
            so_giay_phep=payload.so_giay_phep,
            ten_co_so=payload.ten_co_so,
            ngay_cap=payload.ngay_cap,
            ngay_het_han=payload.ngay_het_han,
            pham_vi_hoat_dong=payload.pham_vi_hoat_dong,
            trang_thai=payload.trang_thai or TrangThaiGiayPhep.ACTIVE.value,
            tep_dinh_kem_url=payload.tep_dinh_kem_url,
            ghi_chu=payload.ghi_chu,
        )
        db.add(facility)
        await db.commit()
        await db.refresh(facility)
        if facility.id is None:
            facility.id = 1

        return FacilityLicenseResponse.model_validate(facility)

    async def get_facility_license(self, db: AsyncSession, license_id: int) -> FacilityLicenseResponse:
        """Tra cứu chi tiết giấy phép hoạt động cơ sở"""
        stmt = select(GiayPhepCoSo).where(GiayPhepCoSo.id == license_id)
        facility = (await db.execute(stmt)).scalar_one_or_none()
        if not facility:
            raise NotFoundException(f"Không tìm thấy Giấy phép cơ sở với mã ID {license_id}")

        return FacilityLicenseResponse.model_validate(facility)

    async def list_facility_licenses(
        self, db: AsyncSession, skip: int = 0, limit: int = 100
    ) -> List[FacilityLicenseResponse]:
        """Danh sách tất cả giấy phép hoạt động cơ sở"""
        stmt = select(GiayPhepCoSo).offset(skip).limit(limit).order_by(GiayPhepCoSo.id.desc())
        facilities = (await db.execute(stmt)).scalars().all()
        return [FacilityLicenseResponse.model_validate(f) for f in facilities]

    async def update_facility_license(
        self, db: AsyncSession, license_id: int, payload: FacilityLicenseUpdateRequest
    ) -> FacilityLicenseResponse:
        """Cập nhật thông tin giấy phép hoạt động cơ sở"""
        stmt = select(GiayPhepCoSo).where(GiayPhepCoSo.id == license_id)
        facility = (await db.execute(stmt)).scalar_one_or_none()
        if not facility:
            raise NotFoundException(f"Không tìm thấy Giấy phép cơ sở với mã ID {license_id}")

        if payload.ten_co_so is not None:
            facility.ten_co_so = payload.ten_co_so
        if payload.ngay_cap is not None:
            facility.ngay_cap = payload.ngay_cap
        if payload.ngay_het_han is not None:
            facility.ngay_het_han = payload.ngay_het_han
        if payload.pham_vi_hoat_dong is not None:
            facility.pham_vi_hoat_dong = payload.pham_vi_hoat_dong
        if payload.trang_thai is not None:
            facility.trang_thai = payload.trang_thai
        if payload.tep_dinh_kem_url is not None:
            facility.tep_dinh_kem_url = payload.tep_dinh_kem_url
        if payload.ghi_chu is not None:
            facility.ghi_chu = payload.ghi_chu

        await db.commit()
        await db.refresh(facility)
        return FacilityLicenseResponse.model_validate(facility)

    async def delete_facility_license(self, db: AsyncSession, license_id: int) -> bool:
        """Xóa giấy phép cơ sở"""
        stmt = select(GiayPhepCoSo).where(GiayPhepCoSo.id == license_id)
        facility = (await db.execute(stmt)).scalar_one_or_none()
        if not facility:
            raise NotFoundException(f"Không tìm thấy Giấy phép cơ sở với mã ID {license_id}")

        await db.delete(facility)
        await db.commit()
        return True

    # --- Helper Methods ---

    def _to_doctor_license_response(self, bac_si: BacSi) -> DoctorLicenseResponse:
        """Chuyển đổi thực thể BacSi thành DoctorLicenseResponse"""
        ho_ten = bac_si.nguoi_dung.ho_ten if bac_si.nguoi_dung else None
        ck_ten = bac_si.chuyen_khoa.ten_chuyen_khoa if bac_si.chuyen_khoa else None

        days_left = None
        if bac_si.ngay_het_han:
            now = datetime.now(timezone.utc)
            exp = bac_si.ngay_het_han
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            days_left = (exp.date() - now.date()).days

        scope = bac_si.pham_vi_chuyen_mon
        if not isinstance(scope, list):
            scope = []

        return DoctorLicenseResponse(
            bac_si_id=bac_si.id,
            ho_ten=ho_ten,
            so_cchn=bac_si.chung_chi_hanh_nghe,
            chuyen_khoa=ck_ten,
            ngay_cap=bac_si.ngay_cap,
            ngay_het_han=bac_si.ngay_het_han,
            pham_vi_chuyen_mon=scope,
            trang_thai_giay_phep=bac_si.trang_thai_giay_phep or TrangThaiGiayPhep.ACTIVE.value,
            tep_dinh_kem_url=bac_si.tep_dinh_kem_url,
            is_active=bac_si.is_active,
            days_until_expiry=days_left,
        )


credential_service = CredentialService()
