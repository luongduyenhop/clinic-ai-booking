import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, generate_otp
from app.core.exceptions import ConflictException, NotFoundException, UnauthorizedException, ForbiddenException
from app.core.config import settings
from app.models.user import NguoiDung, TaiKhoan, BenhNhan, BacSi, VaiTroEnum
from app.schemas.auth import (
    RegisterRequest, 
    VerifyOtpRequest, 
    LoginRequest, 
    TokenResponse, 
    UserProfileResponse, 
    RefreshTokenRequest,
    UpdateUserProfileRequest
)
from app.services.email_service import email_service

logger = logging.getLogger("clinic_backend")


class AuthService:
    """Tầng Control điều phối toàn bộ nghiệp vụ xác thực và tài khoản (Package A)"""

    async def register_user(self, payload: RegisterRequest, db: AsyncSession) -> dict:
        """Đăng ký tài khoản người bệnh mới và gửi mã xác thực OTP (UC-A01)"""
        # 1. Kiểm tra Email đã tồn tại hay chưa
        stmt_check = select(TaiKhoan).where(TaiKhoan.email == payload.email)
        existing_account = (await db.execute(stmt_check)).scalar_one_or_none()
        if existing_account:
            raise ConflictException(f"Địa chỉ email '{payload.email}' đã được đăng ký trong hệ thống!")

        # 2. Sinh mã OTP 6 số với TTL 5 phút
        otp_code = generate_otp(6)
        otp_expired_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        # 3. Tạo bản ghi NguoiDung (Person Pattern)
        nguoi_dung = NguoiDung(
            ho_ten=payload.ho_ten,
            email=payload.email,
            so_dien_thoai=payload.so_dien_thoai,
            ngay_sinh=payload.ngay_sinh,
            gioi_tinh=payload.gioi_tinh
        )
        db.add(nguoi_dung)
        await db.flush()  # Sinh nguoi_dung.id

        # 4. Tạo bản ghi TaiKhoan lưu mật khẩu tạm chưa kích hoạt
        tai_khoan = TaiKhoan(
            nguoi_dung_id=nguoi_dung.id,
            email=payload.email,
            mat_khau_hash=hash_password(payload.mat_khau),  # Băm BCrypt cost 12
            vai_tro=VaiTroEnum.BENH_NHAN.value,
            is_active=False,
            otp_code=otp_code,
            otp_expired_at=otp_expired_at
        )
        db.add(tai_khoan)
        await db.commit()

        # 5. Gửi OTP qua Email (log console và gọi SMTP nếu có cấu hình)
        logger.info(f"🔑 [OTP GENERATED] Email: {payload.email} | Code: {otp_code} | Hết hạn lúc: {otp_expired_at}")
        try:
            await email_service.send_otp_email(recipient_email=payload.email, otp_code=otp_code)
        except Exception as exc:
            logger.warning(f"⚠️ [EMAIL FAILED] Không thể gửi OTP qua email: {exc}")

        return {
            "email": payload.email,
            "message": "Mã xác thực OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư!",
            "expires_in_seconds": 300,
            # Chế độ debug cho phép hiển thị OTP để test nhanh
            "debug_otp": otp_code if settings.DEBUG else None
        }

    async def verify_otp(self, payload: VerifyOtpRequest, db: AsyncSession) -> TokenResponse:
        """Xác thực mã OTP để kích hoạt tài khoản và cấp phát JWT Token"""
        stmt = select(TaiKhoan).where(TaiKhoan.email == payload.email)
        tai_khoan = (await db.execute(stmt)).scalar_one_or_none()

        if not tai_khoan:
            raise NotFoundException("Không tìm thấy thông tin tài khoản tương ứng với email này!")

        if tai_khoan.is_active:
            raise ConflictException("Tài khoản này đã được kích hoạt trước đó!")

        # Kiểm tra thời hạn OTP
        now_utc = datetime.now(timezone.utc)
        if not tai_khoan.otp_expired_at or now_utc > tai_khoan.otp_expired_at:
            raise UnauthorizedException("Mã OTP đã hết hạn hiệu lực (5 phút). Vui lòng yêu cầu mã mới!")

        # Kiểm tra mã OTP
        if tai_khoan.otp_code != payload.otp_code:
            raise UnauthorizedException("Mã OTP nhập vào không chính xác!")

        # Kích hoạt tài khoản và gán token
        tai_khoan.is_active = True
        tai_khoan.otp_code = None
        tai_khoan.otp_expired_at = None

        refresh_token = create_refresh_token()
        tai_khoan.refresh_token = refresh_token
        tai_khoan.refresh_token_expired_at = datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

        # Tự động khởi tạo hồ sơ BenhNhan nếu chưa có
        stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == tai_khoan.nguoi_dung_id)
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not benh_nhan:
            ma_y_te = f"BN-{datetime.now().strftime('%Y%m')}-{tai_khoan.nguoi_dung_id:04d}"
            benh_nhan = BenhNhan(
                nguoi_dung_id=tai_khoan.nguoi_dung_id,
                ma_dinh_danh_y_te=ma_y_te
            )
            db.add(benh_nhan)

        await db.commit()

        # Sinh JWT Bearer Token
        access_token = create_access_token(subject=tai_khoan.id, role=tai_khoan.vai_tro)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            vai_tro=tai_khoan.vai_tro,
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user_id=tai_khoan.id
        )

    async def login_user(self, payload: LoginRequest, db: AsyncSession) -> TokenResponse:
        """Đăng nhập hệ thống bằng Email và Mật khẩu (UC-A03)"""
        stmt = select(TaiKhoan).where(TaiKhoan.email == payload.email)
        tai_khoan = (await db.execute(stmt)).scalar_one_or_none()

        if not tai_khoan:
            raise UnauthorizedException("Email hoặc mật khẩu không chính xác!")

        # Đối chiếu mật khẩu BCrypt
        if not verify_password(payload.mat_khau, tai_khoan.mat_khau_hash):
            raise UnauthorizedException("Email hoặc mật khẩu không chính xác!")

        # Kiểm tra trạng thái tài khoản
        if not tai_khoan.is_active:
            raise ForbiddenException("Tài khoản chưa được kích hoạt OTP. Vui lòng xác thực tài khoản!")

        # Phát hành Token và lưu DB
        access_token = create_access_token(subject=tai_khoan.id, role=tai_khoan.vai_tro)
        refresh_token = create_refresh_token()
        
        tai_khoan.refresh_token = refresh_token
        tai_khoan.refresh_token_expired_at = datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        await db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            vai_tro=tai_khoan.vai_tro,
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user_id=tai_khoan.id
        )

    async def get_user_profile(self, user: TaiKhoan, db: AsyncSession) -> UserProfileResponse:
        """Lấy thông tin hồ sơ người dùng đầy đủ (UC-A04)"""
        stmt_ng = select(NguoiDung).where(NguoiDung.id == user.nguoi_dung_id)
        nguoi_dung = (await db.execute(stmt_ng)).scalar_one()

        stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()

        chuyen_khoa_id = None
        if user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs = (await db.execute(stmt_bs)).scalar_one_or_none()
            if bs:
                chuyen_khoa_id = bs.chuyen_khoa_id

        return UserProfileResponse(
            id=user.id,
            ho_ten=nguoi_dung.ho_ten,
            email=user.email,
            so_dien_thoai=nguoi_dung.so_dien_thoai,
            vai_tro=user.vai_tro,
            ngay_sinh=nguoi_dung.ngay_sinh,
            gioi_tinh=nguoi_dung.gioi_tinh,
            dia_chi=nguoi_dung.dia_chi,
            ma_dinh_danh_y_te=benh_nhan.ma_dinh_danh_y_te if benh_nhan else None,
            nhom_mau=benh_nhan.nhom_mau if benh_nhan else None,
            tien_su_benh=benh_nhan.tien_su_benh if benh_nhan else None,
            di_ung_thuoc=benh_nhan.di_ung_thuoc if benh_nhan else None,
            chuyen_khoa_id=chuyen_khoa_id
        )

    async def update_user_profile(
        self,
        payload: UpdateUserProfileRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> UserProfileResponse:
        """Cập nhật thông tin hồ sơ cá nhân theo chuẩn OpenMRS Person & Patient (UC-A04)"""
        # 1. Lấy thông tin Person (NguoiDung) với Pessimistic Locking
        stmt_ng = select(NguoiDung).where(NguoiDung.id == user.nguoi_dung_id).with_for_update()
        nguoi_dung = (await db.execute(stmt_ng)).scalar_one()

        # 2. Kiểm tra tính duy nhất của số điện thoại nếu người dùng thay đổi SĐT
        if payload.so_dien_thoai and payload.so_dien_thoai != nguoi_dung.so_dien_thoai:
            stmt_phone = select(NguoiDung).where(
                and_(
                    NguoiDung.so_dien_thoai == payload.so_dien_thoai,
                    NguoiDung.id != user.nguoi_dung_id
                )
            )
            phone_exists = (await db.execute(stmt_phone)).scalar_one_or_none()
            if phone_exists:
                raise ConflictException(f"Số điện thoại '{payload.so_dien_thoai}' đã được sử dụng bởi người dùng khác!")
            nguoi_dung.so_dien_thoai = payload.so_dien_thoai

        # 3. Cập nhật thông tin nhân khẩu học (OpenMRS Person Pattern)
        if payload.ho_ten is not None:
            nguoi_dung.ho_ten = payload.ho_ten
        if payload.ngay_sinh is not None:
            nguoi_dung.ngay_sinh = payload.ngay_sinh
        if payload.gioi_tinh is not None:
            nguoi_dung.gioi_tinh = payload.gioi_tinh
        if payload.dia_chi is not None:
            nguoi_dung.dia_chi = payload.dia_chi

        # 4. Cập nhật thông tin y tế lâm sàng nếu là bệnh nhân (OpenMRS Patient Pattern)
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id).with_for_update()
            benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
            if benh_nhan:
                if payload.nhom_mau is not None:
                    benh_nhan.nhom_mau = payload.nhom_mau
                if payload.tien_su_benh is not None:
                    benh_nhan.tien_su_benh = payload.tien_su_benh
                if payload.di_ung_thuoc is not None:
                    benh_nhan.di_ung_thuoc = payload.di_ung_thuoc

        await db.commit()
        await db.refresh(nguoi_dung)

        logger.info(f"👤 [PROFILE UPDATED] User ID: {user.id} | Họ tên: {nguoi_dung.ho_ten}")
        return await self.get_user_profile(user, db)

    async def refresh_access_token(self, payload: RefreshTokenRequest, db: AsyncSession) -> TokenResponse:
        """Cấp lại Access Token mới dựa trên Refresh Token lưu trong Database"""
        stmt = select(TaiKhoan).where(TaiKhoan.refresh_token == payload.refresh_token)
        tai_khoan = (await db.execute(stmt)).scalar_one_or_none()
        
        if not tai_khoan or not tai_khoan.is_active:
            raise UnauthorizedException("Refresh token không hợp lệ hoặc tài khoản đã bị khóa")
            
        now_utc = datetime.now(timezone.utc)
        if not tai_khoan.refresh_token_expired_at or now_utc > tai_khoan.refresh_token_expired_at:
            raise UnauthorizedException("Refresh token đã hết hạn, vui lòng đăng nhập lại")
            
        access_token = create_access_token(subject=tai_khoan.id, role=tai_khoan.vai_tro)
        new_refresh_token = create_refresh_token()
        
        tai_khoan.refresh_token = new_refresh_token
        tai_khoan.refresh_token_expired_at = now_utc + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        await db.commit()
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            vai_tro=tai_khoan.vai_tro,
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user_id=tai_khoan.id
        )


auth_service = AuthService()
