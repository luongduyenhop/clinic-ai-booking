from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Tham số phân trang truyền vào Query Params"""
    page: int = Field(1, ge=1, description="Số thứ tự trang")
    page_size: int = Field(10, ge=1, le=100, description="Số lượng bản ghi mỗi trang")


class PaginationMeta(BaseModel):
    """Metadata thông tin phân trang"""
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool


class ResponseEnvelope(BaseModel, Generic[T]):
    """Chuẩn hóa cấu trúc gói tin JSON trả về toàn hệ thống"""
    success: bool = True
    code: int = 200
    message: str = "Thành công"
    data: Optional[T] = None
    meta: Optional[PaginationMeta] = None
    errors: Optional[List[dict]] = None
