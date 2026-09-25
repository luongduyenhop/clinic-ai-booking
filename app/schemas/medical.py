from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.appointment import DoctorBriefResponse


class SpecialtyResponse(BaseModel):
    """Thông tin 1 chuyên khoa trong danh mục phục vụ đặt lịch (UC-B01)"""
    id: int
    ma_chuyen_khoa: str = Field(..., description="Mã chuyên khoa (VD: KHOA_TIM_MACH)")
    ten_chuyen_khoa: str
    mo_ta: Optional[str] = None
    vi_tri_phong: Optional[str] = None
    so_luong_bac_si: int = Field(0, description="Số bác sĩ đang hoạt động thuộc chuyên khoa")


class DoctorResponse(DoctorBriefResponse):
    """Thông tin bác sĩ trong danh mục tra cứu (UC-B01) - mở rộng từ DoctorBriefResponse để giữ tương thích"""
    chuyen_khoa_id: Optional[int] = Field(None, description="Mã chuyên khoa, null nếu bác sĩ chưa được gán khoa")
    vi_tri_phong: Optional[str] = Field(None, description="Vị trí phòng khám của chuyên khoa")
    nam_kinh_nghiem: int = Field(0, description="Số năm kinh nghiệm hành nghề")
    mo_ta_chuyen_sau: Optional[str] = None
    gia_kham_mac_dinh: float = Field(..., description="Giá khám mặc định (VNĐ)")


class AcademicDegreeResponse(BaseModel):
    """Một lựa chọn học vị cho bộ lọc bác sĩ (UC-B01)"""
    hoc_vi: str = Field(..., description="Học vị bác sĩ (VD: BS, BSCKI, ThS.BS, PGS.TS)")
    so_luong_bac_si: int = Field(..., description="Số bác sĩ đang hoạt động có học vị này")
