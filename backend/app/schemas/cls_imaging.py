from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ClsFileResponse(BaseModel):
    """Ảnh kết quả CLS đã lưu trên máy chủ; `url` là endpoint xem ảnh có xác thực"""
    file_id: str
    url: str
    content_type: str
    kich_thuoc: Optional[int] = None
    ten_goc: Optional[str] = None


class ClsFileListResponse(BaseModel):
    chi_dinh_id: int
    items: List[ClsFileResponse]
    toi_da: int


class ImagingResultRequest(BaseModel):
    """Kết quả Chẩn đoán hình ảnh (siêu âm, X-quang...). Ảnh lấy từ danh sách đã tải lên, không nhận URL từ client"""
    mo_ta_hinh_anh: Optional[str] = Field(None, max_length=10000, description="Mô tả hình ảnh")
    ket_luan: Optional[str] = Field(None, max_length=5000)
    de_nghi: Optional[str] = Field(None, max_length=2000)
    ket_qua_phan_loai: str = Field("BINH_THUONG", pattern="^(BINH_THUONG|BAT_THUONG|NGUY_KICH|NGUY_HIEM)$")
    thiet_bi_thuc_hien: Optional[str] = Field(None, max_length=255)
    hoan_tat: bool = Field(True, description="true: trả kết quả; false: lưu nháp (chỉ định giữ trạng thái đang thực hiện)")


class ImagingResultResponse(BaseModel):
    chi_dinh_id: int
    trang_thai: str
    nhom_dich_vu: Optional[str] = None
    phieu_id: Optional[int] = None
    trang_thai_phieu: Optional[str] = None
    loai_ket_qua: Optional[str] = None
    mo_ta_hinh_anh: Optional[str] = None
    ket_luan: Optional[str] = None
    de_nghi: Optional[str] = None
    ket_qua_phan_loai: Optional[str] = None
    thiet_bi_thuc_hien: Optional[str] = None
    tep_dinh_kem_urls: List[str] = []
    da_duyet: bool = False
    thoi_gian_tra_ket_qua: Optional[datetime] = None
