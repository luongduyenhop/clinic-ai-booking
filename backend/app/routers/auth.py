from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.rate_limit import limiter
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    UpdateUserProfileRequest,
    UserProfileResponse,
    VerifyOtpRequest,
)
from app.schemas.patient import PatientRegisterRequest
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["1. Xác thực & Tài khoản (Package A)"])

def _allow_public_registration():
    if settings.is_demo:
        raise ForbiddenException("Bản demo sử dụng tài khoản được cấp sẵn.")


@router.post(
    "/register",
    response_model=ResponseEnvelope[dict],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_allow_public_registration)],
    summary="Đăng ký tài khoản người bệnh mới và gửi mã OTP (UC-A01)",
)
@limiter.limit("20/minute")
async def register(request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await auth_service.register_user(payload, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đăng ký tài khoản thành công. Mã OTP đã được gửi đến hòm thư!",
        code=status.HTTP_201_CREATED,
    )


@router.post(
    "/register-patient",
    response_model=ResponseEnvelope[TokenResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_allow_public_registration)],
    summary="Đăng ký tài khoản Bệnh nhân nhanh cho Cổng Bệnh nhân (UC-PAT-01)",
)
@limiter.limit("20/minute")
async def register_patient(request: Request, payload: PatientRegisterRequest, db: AsyncSession = Depends(get_db)):
    token = await auth_service.register_patient(payload, db)
    return ResponseEnvelope.success_response(
        data=token,
        message="Đăng ký tài khoản bệnh nhân thành công! Đã tự động kích hoạt phiên đăng nhập.",
        code=status.HTTP_201_CREATED,
    )


@router.post(
    "/verify-otp",
    response_model=ResponseEnvelope[TokenResponse],
    summary="Xác thực OTP kích hoạt tài khoản và nhận JWT Token (UC-A01)",
    dependencies=[Depends(_allow_public_registration)],
)
@limiter.limit("20/minute")
async def verify_otp(request: Request, payload: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    token = await auth_service.verify_otp(payload, db)
    return ResponseEnvelope.success_response(
        data=token,
        message="Kích hoạt tài khoản thành công! Bạn đã đăng nhập vào hệ thống.",
    )


@router.post(
    "/login",
    response_model=ResponseEnvelope[TokenResponse],
    summary="Đăng nhập hệ thống bằng Email và Mật khẩu (UC-A03)",
)
@limiter.limit("60/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    token = await auth_service.login_user(payload, db)
    return ResponseEnvelope.success_response(
        data=token,
        message="Đăng nhập thành công!",
    )


@router.post("/logout", response_model=ResponseEnvelope[dict], summary="Đăng xuất và thu hồi refresh token")
async def logout(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.logout_user(current_user, db)
    return ResponseEnvelope.success_response(message="Đăng xuất thành công!")


@router.post(
    "/refresh",
    response_model=ResponseEnvelope[TokenResponse],
    summary="Cấp lại Access Token bằng Refresh Token",
)
@router.post(
    "/refresh-token",
    response_model=ResponseEnvelope[TokenResponse],
    include_in_schema=False,
)
@limiter.limit("60/minute")
async def refresh_token(request: Request, payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    token = await auth_service.refresh_access_token(payload, db)
    return ResponseEnvelope.success_response(
        data=token,
        message="Làm mới phiên đăng nhập thành công!",
    )


@router.get(
    "/me",
    response_model=ResponseEnvelope[UserProfileResponse],
    summary="Xem thông tin hồ sơ người dùng đang đăng nhập (UC-A04)",
)
async def get_me(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await auth_service.get_user_profile(current_user, db)
    return ResponseEnvelope.success_response(
        data=profile,
        message="Lấy thông tin hồ sơ thành công",
    )


@router.put(
    "/me",
    response_model=ResponseEnvelope[UserProfileResponse],
    summary="Cập nhật thông tin hồ sơ người dùng đang đăng nhập (UC-A04)",
)
async def update_me(
    payload: UpdateUserProfileRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await auth_service.update_user_profile(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=profile,
        message="Cập nhật thông tin hồ sơ thành công!",
    )
