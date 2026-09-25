from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.auth import (
    RegisterRequest, 
    VerifyOtpRequest, 
    LoginRequest, 
    TokenResponse, 
    UserProfileResponse
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["1. Xác thực & Tài khoản (Package A)"])


@router.post(
    "/register", 
    response_model=ResponseEnvelope[dict], 
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản người bệnh mới và gửi mã OTP (UC-A01)"
)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await auth_service.register_user(payload, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đăng ký tài khoản thành công. Mã OTP đã được gửi đến hòm thư!",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/verify-otp", 
    response_model=ResponseEnvelope[TokenResponse],
    summary="Xác thực OTP kích hoạt tài khoản và nhận JWT Token (UC-A01)"
)
async def verify_otp(payload: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    token = await auth_service.verify_otp(payload, db)
    return ResponseEnvelope.success_response(
        data=token,
        message="Kích hoạt tài khoản thành công! Bạn đã đăng nhập vào hệ thống."
    )


@router.post(
    "/login", 
    response_model=ResponseEnvelope[TokenResponse],
    summary="Đăng nhập hệ thống bằng Email và Mật khẩu (UC-A03)"
)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    token = await auth_service.login_user(payload, db)
    return ResponseEnvelope.success_response(
        data=token,
        message="Đăng nhập thành công!"
    )


@router.get(
    "/me", 
    response_model=ResponseEnvelope[UserProfileResponse],
    summary="Xem thông tin hồ sơ người dùng đang đăng nhập (UC-A04)"
)
async def get_me(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    profile = await auth_service.get_user_profile(current_user, db)
    return ResponseEnvelope.success_response(
        data=profile,
        message="Lấy thông tin hồ sơ thành công"
    )
