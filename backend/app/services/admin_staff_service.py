from typing import List

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import hash_password
from app.models.user import NguoiDung, NhanVien, TaiKhoan
from app.schemas.admin import StaffAdminCreateRequest, StaffAdminResponse, StaffAdminUpdateRequest


class AdminStaffService:
    """Quản lý hồ sơ nhân sự thường; không tạo hồ sơ bác sĩ hay tài khoản đăng nhập."""

    @staticmethod
    def _response(employee: NhanVien) -> StaffAdminResponse:
        person = employee.nguoi_dung
        return StaffAdminResponse(
            id=employee.id,
            ma_nhan_vien=employee.ma_nhan_vien,
            ho_ten=person.ho_ten,
            email=person.email,
            so_dien_thoai=person.so_dien_thoai,
            chuc_danh=employee.chuc_danh,
            loai_nhan_vien=employee.loai_nhan_vien,
            is_active=employee.is_active,
            account_id=person.tai_khoan.id if person.tai_khoan else None,
            account_active=person.tai_khoan.is_active if person.tai_khoan else None,
            account_role=person.tai_khoan.vai_tro if person.tai_khoan else None,
        )

    async def _ensure_unique_contact(
        self, db: AsyncSession, *, email: str | None, phone: str | None, exclude_person_id: int | None = None
    ) -> None:
        if email:
            stmt = select(NguoiDung.id).where(NguoiDung.email == email)
            if exclude_person_id is not None:
                stmt = stmt.where(NguoiDung.id != exclude_person_id)
            if (await db.execute(stmt)).scalar_one_or_none():
                raise ConflictException("Email đã được sử dụng bởi hồ sơ khác.")
        if phone:
            stmt = select(NguoiDung.id).where(NguoiDung.so_dien_thoai == phone)
            if exclude_person_id is not None:
                stmt = stmt.where(NguoiDung.id != exclude_person_id)
            if (await db.execute(stmt)).scalar_one_or_none():
                raise ConflictException("Số điện thoại đã được sử dụng bởi hồ sơ khác.")

    async def list_staff(self, db: AsyncSession) -> List[StaffAdminResponse]:
        stmt = (
            select(NhanVien)
            .join(NhanVien.nguoi_dung)
            .options(selectinload(NhanVien.nguoi_dung).selectinload(NguoiDung.tai_khoan))
            .where(NhanVien.loai_nhan_vien.in_(("LE_TAN", "THU_NGAN", "KY_THUAT_VIEN")))
            .where(NguoiDung.is_deleted.is_(False))
            .order_by(NhanVien.id.asc())
        )
        return [self._response(row) for row in (await db.execute(stmt)).scalars().all()]

    async def create_staff(self, payload: StaffAdminCreateRequest, db: AsyncSession) -> StaffAdminResponse:
        if (await db.execute(select(NhanVien.id).where(NhanVien.ma_nhan_vien == payload.ma_nhan_vien))).scalar_one_or_none():
            raise ConflictException("Mã nhân viên đã tồn tại.")
        await self._ensure_unique_contact(db, email=payload.email, phone=payload.so_dien_thoai)

        person = NguoiDung(
            ho_ten=payload.ho_ten.strip(),
            email=str(payload.email) if payload.email else None,
            so_dien_thoai=payload.so_dien_thoai,
        )
        db.add(person)
        await db.flush()
        employee = NhanVien(
            nguoi_dung_id=person.id,
            ma_nhan_vien=payload.ma_nhan_vien.strip(),
            chuc_danh=payload.chuc_danh.strip(),
            loai_nhan_vien=payload.loai_nhan_vien,
            is_active=True,
        )
        db.add(employee)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise ConflictException("Mã nhân viên, email hoặc số điện thoại đã tồn tại.") from exc
        employee.nguoi_dung = person
        person.tai_khoan = None
        return self._response(employee)

    async def update_staff(
        self, employee_id: int, payload: StaffAdminUpdateRequest, db: AsyncSession
    ) -> StaffAdminResponse:
        employee = (
            await db.execute(
                select(NhanVien)
                .options(selectinload(NhanVien.nguoi_dung).selectinload(NguoiDung.tai_khoan))
                .where(
                    NhanVien.id == employee_id,
                    NhanVien.loai_nhan_vien.in_(("LE_TAN", "THU_NGAN", "KY_THUAT_VIEN")),
                )
            )
        ).scalar_one_or_none()
        if not employee:
            raise NotFoundException("Không tìm thấy hồ sơ nhân viên.")

        changes = payload.model_dump(exclude_unset=True)
        if "loai_nhan_vien" in changes and employee.nguoi_dung.tai_khoan:
            raise BadRequestException("Không thể đổi loại nhân sự sau khi đã tạo tài khoản; hãy tạo hồ sơ mới với đúng vai trò.")
        person_fields = {"ho_ten", "email", "so_dien_thoai"}
        await self._ensure_unique_contact(
            db,
            email=changes.get("email"),
            phone=changes.get("so_dien_thoai"),
            exclude_person_id=employee.nguoi_dung_id,
        )
        for field, value in changes.items():
            if field in person_fields:
                normalized = value.strip() if isinstance(value, str) else value
                if field == "email" and employee.nguoi_dung.tai_khoan and not normalized:
                    raise BadRequestException("Không thể xóa email khi nhân viên đang có tài khoản đăng nhập.")
                if field == "email" and employee.nguoi_dung.tai_khoan and normalized:
                    duplicate_account = (await db.execute(select(TaiKhoan.id).where(
                        TaiKhoan.email == normalized,
                        TaiKhoan.nguoi_dung_id != employee.nguoi_dung_id,
                    ))).scalar_one_or_none()
                    if duplicate_account:
                        raise ConflictException("Email đã được sử dụng cho tài khoản đăng nhập khác.")
                    employee.nguoi_dung.tai_khoan.email = normalized
                setattr(employee.nguoi_dung, field, normalized)
            else:
                setattr(employee, field, value.strip() if field == "chuc_danh" and isinstance(value, str) else value)
        if changes.get("is_active") is False and employee.nguoi_dung.tai_khoan:
            # Ngừng hồ sơ nhân sự phải đồng thời chặn đăng nhập và thu hồi refresh token.
            employee.nguoi_dung.tai_khoan.is_active = False
            employee.nguoi_dung.tai_khoan.refresh_token_hash = None
            employee.nguoi_dung.tai_khoan.refresh_token_expired_at = None
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise ConflictException("Email hoặc số điện thoại đã tồn tại.") from exc
        return self._response(employee)

    async def create_staff_account(self, employee_id: int, password: str, db: AsyncSession) -> StaffAdminResponse:
        employee = (await db.execute(
            select(NhanVien).options(selectinload(NhanVien.nguoi_dung).selectinload(NguoiDung.tai_khoan))
            .where(NhanVien.id == employee_id)
        )).scalar_one_or_none()
        if not employee:
            raise NotFoundException("Không tìm thấy hồ sơ nhân viên.")
        if not employee.is_active:
            raise BadRequestException("Không thể tạo tài khoản cho hồ sơ nhân viên đang ngừng hoạt động.")
        person = employee.nguoi_dung
        if not person.email:
            raise BadRequestException("Cần khai báo email trước khi tạo tài khoản đăng nhập.")
        if person.tai_khoan:
            raise ConflictException("Nhân viên đã có tài khoản đăng nhập.")
        role_by_type = {"LE_TAN": "le_tan", "THU_NGAN": "thu_ngan", "KY_THUAT_VIEN": "ky_thuat_vien"}
        account = TaiKhoan(
            nguoi_dung_id=person.id,
            email=person.email,
            mat_khau_hash=hash_password(password),
            vai_tro=role_by_type[employee.loai_nhan_vien],
            is_active=True,
        )
        db.add(account)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise ConflictException("Email đã được dùng cho tài khoản khác.") from exc
        await db.refresh(account)
        person.tai_khoan = account
        return self._response(employee)

    async def update_account_status(self, account_id: int, is_active: bool, db: AsyncSession) -> None:
        account = (await db.execute(
            select(TaiKhoan)
            .options(selectinload(TaiKhoan.nguoi_dung).selectinload(NguoiDung.nhan_vien))
            .where(TaiKhoan.id == account_id)
        )).scalar_one_or_none()
        if not account:
            raise NotFoundException("Không tìm thấy tài khoản.")
        if not is_active and account.vai_tro == "admin":
            active_admin_count = (await db.execute(
                select(func.count(TaiKhoan.id)).where(
                    TaiKhoan.vai_tro == "admin",
                    TaiKhoan.is_active.is_(True),
                )
            )).scalar_one()
            if active_admin_count <= 1:
                raise BadRequestException("Không thể khóa tài khoản Admin duy nhất đang hoạt động.")
        if is_active and account.nguoi_dung.nhan_vien and not account.nguoi_dung.nhan_vien.is_active:
            raise BadRequestException("Cần kích hoạt hồ sơ nhân sự trước khi mở khóa tài khoản.")
        account.is_active = is_active
        if not is_active:
            account.refresh_token_hash = None
            account.refresh_token_expired_at = None
        await db.commit()

    async def reset_account_password(self, account_id: int, new_password: str, db: AsyncSession) -> None:
        account = (await db.execute(select(TaiKhoan).where(TaiKhoan.id == account_id))).scalar_one_or_none()
        if not account:
            raise NotFoundException("Không tìm thấy tài khoản.")
        account.mat_khau_hash = hash_password(new_password)
        account.refresh_token_hash = None
        account.refresh_token_expired_at = None
        await db.commit()


admin_staff_service = AdminStaffService()
