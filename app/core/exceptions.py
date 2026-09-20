import logging
from typing import List, Optional
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.response import ResponseEnvelope

logger = logging.getLogger("clinic_backend")


class AppException(Exception):
    """Exception nền tảng cho mọi lỗi nghiệp vụ trong hệ thống"""
    def __init__(
        self, 
        message: str = "Đã xảy ra lỗi nghiệp vụ", 
        code: int = status.HTTP_400_BAD_REQUEST,
        errors: Optional[List[dict]] = None
    ):
        self.message = message
        self.code = code
        self.errors = errors or []
        super().__init__(self.message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Không tìm thấy tài nguyên yêu cầu"):
        super().__init__(message=message, code=status.HTTP_404_NOT_FOUND)


class ConflictException(AppException):
    def __init__(self, message: str = "Dữ liệu bị xung đột hoặc đã tồn tại"):
        super().__init__(message=message, code=status.HTTP_409_CONFLICT)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Chưa đăng nhập hoặc phiên làm việc đã hết hạn"):
        super().__init__(message=message, code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenException(AppException):
    def __init__(self, message: str = "Bạn không có quyền thực hiện thao tác này"):
        super().__init__(message=message, code=status.HTTP_403_FORBIDDEN)


class EmergencyAlertException(AppException):
    """Lỗi đặc thù y tế khi phát hiện dấu hiệu cấp cứu cần ngắt luồng đặt lịch"""
    def __init__(self, message: str = "Phát hiện dấu hiệu cấp cứu! Đề nghị gọi 115 ngay lập tức."):
        super().__init__(message=message, code=status.HTTP_400_BAD_REQUEST)


def setup_exception_handlers(app: FastAPI) -> None:
    """Đăng ký các bộ xử lý lỗi toàn cục, đảm bảo Response luôn ở dạng Envelope chuẩn"""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.warning(f"Business Exception at {request.url.path}: {exc.message}")
        envelope = ResponseEnvelope.error_response(
            message=exc.message,
            code=exc.code,
            errors=exc.errors
        )
        return JSONResponse(status_code=exc.code, content=envelope.model_dump())

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation Error at {request.url.path}: {exc.errors()}")
        formatted_errors = []
        for err in exc.errors():
            loc = " -> ".join(str(loc_item) for loc_item in err.get("loc", []))
            formatted_errors.append({
                "field": loc,
                "detail": err.get("msg")
            })
        envelope = ResponseEnvelope.error_response(
            message="Dữ liệu đầu vào không hợp lệ",
            code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            errors=formatted_errors
        )
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=envelope.model_dump())

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled Server Error at {request.url.path}: {str(exc)}", exc_info=True)
        envelope = ResponseEnvelope.error_response(
            message="Đã có lỗi không mong muốn xảy ra trên máy chủ. Đội ngũ kỹ thuật đang xử lý.",
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            errors=[{"detail": str(exc)}] if app.debug else []
        )
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=envelope.model_dump())
