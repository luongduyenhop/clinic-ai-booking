from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SubclinicalServiceBrief(BaseModel):
    id: int
    ma_dich_vu: str
    ten_dich_vu: str
    don_gia: Decimal


class PatientBrief(BaseModel):
    mabn: Optional[str] = None
    ho_ten: str
    so_dien_thoai: Optional[str] = None
    nam_sinh: Optional[int] = None
    gioi_tinh: Optional[str] = None


class SubclinicalQueueItem(BaseModel):
    id: int  # chi_dinh_id
    luot_kham_id: int
    dich_vu: SubclinicalServiceBrief
    benh_nhan: PatientBrief
    bac_si_chi_dinh: Optional[str] = None
    trang_thai: str
    phong_thuc_hien_id: Optional[int] = None
    thoi_gian_chi_dinh: datetime


class SubclinicalQueueResponse(BaseModel):
    items: List[SubclinicalQueueItem]
    total: int


class SubclinicalStatusUpdateRequest(BaseModel):
    trang_thai: str = Field(..., description="dang_thuc_hien, da_co_ket_qua, da_huy")
    ghi_chu: Optional[str] = None


class SubclinicalResultSubmitRequest(BaseModel):
    ket_qua_chi_tiet: str = Field(..., min_length=1, description="Mô tả kết quả hoặc chỉ số xét nghiệm")
    ket_qua_phan_loai: Optional[str] = Field("BINH_THUONG", description="BINH_THUONG, BAT_THUONG, NGUY_HIEM")
    tri_so_chi_tiet: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Bộ trị số cận lâm sàng có tham chiếu")
    file_dinh_kem_urls: Optional[List[str]] = Field(default_factory=list, description="Danh sách URL hình ảnh/file đính kèm")


class SubclinicalDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    luot_kham_id: int
    dich_vu_id: int
    trang_thai: str
    don_gia_tai_thoi_diem: Decimal
    ket_qua_chi_tiet: Optional[str] = None
    ket_qua_phan_loai: Optional[str] = None
    tri_so_chi_tiet: Optional[Dict[str, Any]] = None
    file_dinh_kem_urls: Optional[List[str]] = None
    thoi_gian_tra_ket_qua: Optional[datetime] = None
    ky_thuat_vien_id: Optional[int] = None
    phong_thuc_hien_id: Optional[int] = None


class PhysicalExamRequest(BaseModel):
    """Khám thể lực và các chuyên khoa theo Thông tư 32/2023/TT-BYT"""
    chieu_cao: Optional[Decimal] = Field(None, ge=30, le=250, description="Chiều cao (cm)")
    can_nang: Optional[Decimal] = Field(None, ge=1, le=300, description="Cân nặng (kg)")
    mach: Optional[int] = Field(None, ge=30, le=250)
    huyet_ap_tam_thu: Optional[int] = Field(None, ge=50, le=300)
    huyet_ap_tam_truong: Optional[int] = Field(None, ge=30, le=200)
    nhiet_do: Optional[Decimal] = Field(None, ge=30, le=45)
    nhip_tho: Optional[int] = Field(None, ge=5, le=80)
    thi_luc_mat_phai: Optional[str] = None
    thi_luc_mat_trai: Optional[str] = None
    tai_mui_hong: Optional[str] = None
    rang_ham_mat: Optional[str] = None
    tuan_hoan: Optional[str] = None
    ho_hap: Optional[str] = None
    tieu_hoa: Optional[str] = None
    than_kinh: Optional[str] = None
    da_lieu: Optional[str] = None
    phan_loai_the_luc: Optional[str] = Field(None, description="LOAI_I, LOAI_II, LOAI_III, LOAI_IV, LOAI_V")


class PhysicalExamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    luot_kham_id: int
    chieu_cao: Optional[Decimal] = None
    can_nang: Optional[Decimal] = None
    bmi: Optional[Decimal] = None
    mach: Optional[int] = None
    huyet_ap_tam_thu: Optional[int] = None
    huyet_ap_tam_truong: Optional[int] = None
    nhiet_do: Optional[Decimal] = None
    nhip_tho: Optional[int] = None
    thi_luc_mat_phai: Optional[str] = None
    thi_luc_mat_trai: Optional[str] = None
    tai_mui_hong: Optional[str] = None
    rang_ham_mat: Optional[str] = None
    tuan_hoan: Optional[str] = None
    ho_hap: Optional[str] = None
    tieu_hoa: Optional[str] = None
    than_kinh: Optional[str] = None
    da_lieu: Optional[str] = None
    phan_loai_the_luc: Optional[str] = None
    bac_si_ket_luan_id: Optional[int] = None
