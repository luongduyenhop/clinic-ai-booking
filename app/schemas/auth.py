from datetime import date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Dữ liệu yêu cầu đăng ký tài khoản mới (UC-A01)"""
    ho_ten: str = Field(..., min_length=2, max_length=150, description="Họ và tên đầy đủ")
    email: EmailStr = Field(..., description="Địa chỉ Email hợp lệ dùng để nhận mã OTP")
    so_dien_thoai: str = Field(..., pattern=r"^[0-9]{10,11}$", description="Số điện thoại di động 10-11 chữ số")
    mat_khau: str = Field(..., min_length=8, description="Mật khẩu tối thiểu 8 ký tự")
    ngay_sinh: Optional[date] = Field(None, description="Ngày tháng năm sinh")
    gioi_tinh: Optional[str] = Field("Khác", description="Nam, Nữ, hoặc Khác")


class VerifyOtpRequest(BaseModel):
    """Dữ liệu xác thực mã OTP kích hoạt tài khoản"""
    email: EmailStr = Field(..., description="Email đã đăng ký")
    otp_code: str = Field(..., min_length=6, max_length=6, description="Mã OTP 6 số")


class LoginRequest(BaseModel):
    """Dữ liệu yêu cầu đăng nhập hệ thống (UC-A03)"""
    email: EmailStr = Field(..., description="Email đăng nhập")
    mat_khau: str = Field(..., description="Mật khẩu tài khoản")


class TokenResponse(BaseModel):
    """Dữ liệu trả về sau khi xác thực thành công"""
    access_token: str = Field(..., description="JWT Bearer token")
    token_type: str = Field("bearer", description="Loại token")
    vai_tro: str = Field(..., description="Vai trò: benh_nhan, bac_si, admin")
    expires_in_minutes: int = Field(..., description="Thời gian token tồn tại")
    user_id: int = Field(..., description="Mã định danh tài khoản")


class UserProfileResponse(BaseModel):
    """Thông tin hồ sơ người dùng trả về"""
    id: int
    ho_ten: str
    email: str
    so_dien_thoai: Optional[str] = None
    vai_tro: str
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    dia_chi: Optional[str] = None
    ma_dinh_danh_y_te: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None
