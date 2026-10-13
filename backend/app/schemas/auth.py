import unicodedata
from datetime import date
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, BeforeValidator, EmailStr, Field, StringConstraints, model_validator

SO_DIEN_THOAI_PATTERN = r"^[0-9]{10,11}$"


def _normalize_nfc(value):
    """Đưa chuỗi tiếng Việt về dạng dựng sẵn NFC để 'Nữ' gõ tổ hợp (NFD) vẫn khớp danh mục"""
    return unicodedata.normalize("NFC", value.strip()) if isinstance(value, str) else value


def _blank_to_none(value):
    """Ô nhập để trống trên form ('' hoặc toàn dấu cách) nghĩa là không cập nhật trường đó"""
    return None if isinstance(value, str) and not value.strip() else value


# Cột nguoi_dung.gioi_tinh là VARCHAR(10): chỉ nhận đúng danh mục để không lưu giá trị rác hoặc lỗi 500 khi quá dài
GioiTinh = Annotated[Literal["Nam", "Nữ", "Khác"], BeforeValidator(_normalize_nfc)]
# Cắt khoảng trắng trước khi kiểm tra độ dài để chặn họ tên rỗng/toàn dấu cách
HoTen = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]


class RegisterRequest(BaseModel):
    """Dữ liệu yêu cầu đăng ký tài khoản mới (UC-A01)"""
    ho_ten: HoTen = Field(..., description="Họ và tên đầy đủ")
    email: EmailStr = Field(..., max_length=100, description="Địa chỉ Email hợp lệ dùng để nhận mã OTP")
    so_dien_thoai: str = Field(..., pattern=SO_DIEN_THOAI_PATTERN, description="Số điện thoại di động 10-11 chữ số")
    mat_khau: str = Field(..., min_length=8, description="Mật khẩu tối thiểu 8 ký tự")
    ngay_sinh: Optional[date] = Field(None, description="Ngày tháng năm sinh")
    gioi_tinh: Optional[GioiTinh] = Field("Khác", description="Nam, Nữ, hoặc Khác")


class VerifyOtpRequest(BaseModel):
    """Dữ liệu xác thực mã OTP kích hoạt tài khoản"""
    email: EmailStr = Field(..., description="Email đã đăng ký")
    otp_code: str = Field(..., min_length=6, max_length=6, description="Mã OTP 6 số")


class LoginRequest(BaseModel):
    """Dữ liệu yêu cầu đăng nhập hệ thống (UC-A03) - Tương thích cả email/mat_khau và usernameOrEmail/password"""
    email: str = Field(..., min_length=3, max_length=100, description="Email hoặc tên đăng nhập")
    mat_khau: str = Field(..., min_length=1, description="Mật khẩu tài khoản")

    @model_validator(mode="before")
    @classmethod
    def _normalize_fe_login(cls, data):
        if isinstance(data, dict):
            out = dict(data)
            if "email" not in out and "usernameOrEmail" in out:
                out["email"] = out.pop("usernameOrEmail")
            if "mat_khau" not in out and "password" in out:
                out["mat_khau"] = out.pop("password")
            return out
        return data


class TokenResponse(BaseModel):
    """Dữ liệu trả về sau khi xác thực thành công (Hỗ trợ song song snake_case & camelCase cho FE)"""
    access_token: str = Field(..., description="JWT Bearer token")
    refresh_token: str = Field(..., description="JWT Refresh token")
    token_type: str = Field("bearer", description="Loại token")
    vai_tro: str = Field(..., description="Vai trò: benh_nhan, bac_si, admin, le_tan")
    role: Optional[str] = Field(None, description="Chuẩn hóa vai trò: PATIENT, DOCTOR, RECEPTIONIST, ADMIN")
    expires_in_minutes: int = Field(..., description="Thời gian token tồn tại")
    user_id: int = Field(..., description="Mã định danh tài khoản")
    # Các trường tương thích trực tiếp với Frontend React (AuthService / BaseService / authAction)
    accessToken: Optional[str] = Field(None, description="JWT Bearer token (camelCase cho FE)")
    refreshToken: Optional[str] = Field(None, description="Refresh token (camelCase cho FE)")
    user: Optional[dict] = Field(None, description="Thông tin hồ sơ người dùng rút gọn cho FE")


class RefreshTokenRequest(BaseModel):
    """Dữ liệu yêu cầu làm mới Access Token"""
    refresh_token: str = Field(..., description="Chuỗi Refresh Token")

    @model_validator(mode="before")
    @classmethod
    def _normalize_fe_refresh(cls, data):
        if isinstance(data, dict):
            out = dict(data)
            if "refresh_token" not in out and "refreshToken" in out:
                out["refresh_token"] = out.pop("refreshToken")
            out.pop("accessToken", None)
            return out
        return data


class UpdateUserProfileRequest(BaseModel):
    """Dữ liệu cập nhật hồ sơ người dùng (UC-A04) theo chuẩn OpenMRS Person & Patient"""
    # Các trường bắt buộc định dạng: để trống = giữ nguyên giá trị cũ, không làm hỏng cả request
    ho_ten: Annotated[Optional[HoTen], BeforeValidator(_blank_to_none)] = Field(None, description="Họ và tên")
    so_dien_thoai: Annotated[
        Optional[Annotated[str, StringConstraints(pattern=SO_DIEN_THOAI_PATTERN)]], BeforeValidator(_blank_to_none)
    ] = Field(None, description="Số điện thoại liên lạc 10-11 chữ số")
    ngay_sinh: Optional[date] = Field(None, description="Ngày tháng năm sinh")
    gioi_tinh: Annotated[Optional[GioiTinh], BeforeValidator(_blank_to_none)] = Field(None, description="Giới tính: Nam, Nữ, Khác")
    dia_chi: Optional[str] = Field(None, max_length=255, description="Địa chỉ nơi ở")
    # Thông tin lâm sàng (dành riêng cho bệnh nhân)
    nhom_mau: Optional[str] = Field(None, max_length=10, description="Nhóm máu: A+, B+, O+, AB+...")
    tien_su_benh: Optional[str] = Field(None, description="Tiền sử bệnh lý")
    di_ung_thuoc: Optional[str] = Field(None, description="Dị ứng thuốc/thức ăn")


class UserProfileResponse(BaseModel):
    """Thông tin hồ sơ người dùng trả về"""
    id: int
    ho_ten: str
    email: str
    so_dien_thoai: Optional[str] = None
    vai_tro: str
    role: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    dia_chi: Optional[str] = None
    ma_dinh_danh_y_te: Optional[str] = None
    nhom_mau: Optional[str] = None
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None

