from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class ReceptionPatientCreateRequest(BaseModel):
    ho_ten: str = Field(..., min_length=2, max_length=150)
    so_dien_thoai: str = Field(..., pattern=r"^[0-9]{10}$")
    ngay_sinh: Optional[date] = None
    nam_sinh: Optional[int] = Field(None, ge=1900, le=2026)
    gioi_tinh: Optional[str] = "Khác"
    dia_chi: Optional[str] = Field(None, max_length=255)
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    cccd_so: Optional[str] = Field(None, max_length=20)
    nhom_mau: Optional[str] = Field("O+", max_length=10)


class ReceptionPatientUpdateRequest(BaseModel):
    ho_ten: Optional[str] = Field(None, min_length=2, max_length=150)
    so_dien_thoai: Optional[str] = Field(None, pattern=r"^[0-9]{10}$")
    ngay_sinh: Optional[date] = None
    nam_sinh: Optional[int] = Field(None, ge=1900, le=2026)
    gioi_tinh: Optional[str] = None
    dia_chi: Optional[str] = Field(None, max_length=255)
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    cccd_so: Optional[str] = Field(None, max_length=20)
    nhom_mau: Optional[str] = Field(None, max_length=10)


class ReceptionPatientSearchItem(BaseModel):
    id: int
    nguoi_dung_id: int
    ma_dinh_danh_y_te: str
    ho_ten: str
    so_dien_thoai: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    dia_chi: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    tien_su_benh: Optional[str] = None
    cccd_so: Optional[str] = None


class ReceptionPatientResponse(BaseModel):
    id: int
    nguoi_dung_id: int
    ma_dinh_danh_y_te: str
    ho_ten: str
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    cccd_so: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    dia_chi: Optional[str] = None
    nhom_mau: Optional[str] = None
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    diem_tin_nhiem: int = 100
    so_lan_no_show: int = 0
    is_blocked_booking: bool = False
