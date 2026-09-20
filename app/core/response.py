from typing import Generic, TypeVar, Optional, Any, List
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationMeta(BaseModel):
    """Thông tin metadata phân trang cho các danh sách dài"""
    page: int = Field(..., description="Số trang hiện tại (bắt đầu từ 1)")
    page_size: int = Field(..., description="Số phần tử trên mỗi trang")
    total_items: int = Field(..., description="Tổng số phần tử trong CSDL")
    total_pages: int = Field(..., description="Tổng số trang")
    has_next: bool = Field(..., description="Có trang tiếp theo hay không")
    has_prev: bool = Field(..., description="Có trang trước đó hay không")


class ResponseEnvelope(BaseModel, Generic[T]):
    """Cấu trúc Envelope chuẩn hóa toàn bộ API trả về của hệ thống"""
    success: bool = Field(True, description="Trạng thái thực thi thành công hay thất bại")
    code: int = Field(200, description="Mã HTTP Status Code tương ứng")
    message: str = Field("Thành công", description="Thông báo phản hồi hiển thị cho người dùng")
    data: Optional[T] = Field(None, description="Dữ liệu chính của payload trả về")
    meta: Optional[PaginationMeta] = Field(None, description="Dữ liệu bổ trợ phân trang (nếu có)")
    errors: Optional[List[dict]] = Field(None, description="Danh sách chi tiết các lỗi (nếu có)")

    @classmethod
    def success_response(
        cls, 
        data: Optional[T] = None, 
        message: str = "Thao tác thành công", 
        code: int = 200,
        meta: Optional[PaginationMeta] = None
    ) -> "ResponseEnvelope[T]":
        return cls(
            success=True,
            code=code,
            message=message,
            data=data,
            meta=meta,
            errors=None
        )

    @classmethod
    def error_response(
        cls, 
        message: str = "Đã xảy ra lỗi", 
        code: int = 400,
        errors: Optional[List[dict]] = None
    ) -> "ResponseEnvelope[Any]":
        return cls(
            success=False,
            code=code,
            message=message,
            data=None,
            meta=None,
            errors=errors or []
        )
