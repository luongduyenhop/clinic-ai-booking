from datetime import datetime
from decimal import Decimal
from typing import Annotated, Dict, List, Optional
from pydantic import BaseModel, Field


# Giá trị chỉ số: số hữu hạn, không âm (từ chối NaN/vô cực/chuỗi không phải số)
LabValue = Annotated[Decimal, Field(ge=0, le=1_000_000, max_digits=18, decimal_places=6)]


class LabIndicatorTemplate(BaseModel):
    ma: str
    ten: str
    don_vi: str
    thap: Optional[float] = None
    cao: Optional[float] = None
    nguy_kich_thap: Optional[float] = None
    nguy_kich_cao: Optional[float] = None
    khoang_tham_chieu: str
    thu_tu: int


class LabIndicatorResult(BaseModel):
    ma: str
    ten: str
    gia_tri: float
    don_vi: str
    khoang_tham_chieu: str
    thap: Optional[float] = None
    cao: Optional[float] = None
    nguy_kich_thap: Optional[float] = None
    nguy_kich_cao: Optional[float] = None
    danh_gia: str = Field(..., description="THAP, BINH_THUONG, CAO, NGUY_HIEM")
    huong: Optional[str] = Field(None, description="THAP hoặc CAO khi giá trị nằm ngoài khoảng tham chiếu")
    thu_tu: int


class LabResultSaved(BaseModel):
    """Kết quả xét nghiệm đã lưu trong ket_qua_cls (bản nháp, chờ duyệt hoặc đã duyệt & trả)"""
    da_tra_ket_qua: bool = Field(..., description="Đã duyệt & trả cho bác sĩ")
    trang_thai_ket_qua: str = Field("NHAP", description="NHAP, DA_CO_KET_QUA (chờ duyệt), DA_DUYET")
    thoi_gian_duyet: Optional[datetime] = None
    ket_qua_phan_loai: str = Field(..., description="BINH_THUONG, BAT_THUONG, NGUY_KICH")
    chi_so: Dict[str, str]
    chi_tiet: List[LabIndicatorResult]
    so_bat_thuong: int
    so_nguy_hiem: int
    ket_luan: Optional[str] = None
    ghi_chu: Optional[str] = None
    thoi_gian_tra_ket_qua: Optional[datetime] = None


class LabTemplateResponse(BaseModel):
    chi_dinh_id: int
    trang_thai: str
    ma_dich_vu: str
    ten_dich_vu: str
    ma_mau: str
    ten_mau: str
    gioi_tinh_ap_dung: Optional[str] = Field(None, description="NAM, NU hoặc null khi chưa rõ giới tính")
    chi_so: List[LabIndicatorTemplate]
    ket_qua: Optional[LabResultSaved] = None


class LabResultSubmitRequest(BaseModel):
    chi_so: Dict[str, LabValue] = Field(
        ..., min_length=1, description="Giá trị từng chỉ số theo mã, ví dụ {\"WBC\": 11.5, \"HGB\": 128}"
    )
    ket_luan: Optional[str] = Field(None, max_length=2000)
    ghi_chu: Optional[str] = Field(None, max_length=2000)
    luu_nhap: bool = Field(False, description="true: chỉ lưu nháp; false: hoàn tất kết quả, chờ KTV duyệt & trả")


class LabResultResponse(BaseModel):
    chi_dinh_id: int
    trang_thai: str
    ket_qua: LabResultSaved
