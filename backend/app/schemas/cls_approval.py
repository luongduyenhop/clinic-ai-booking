from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ClsApprover(BaseModel):
    """Người bấm "Duyệt & Trả kết quả" (kỹ thuật viên hoặc quản trị)"""
    nguoi_dung_id: int
    ho_ten: str
    vai_tro: str


class ReturnedClsResult(BaseModel):
    """Kết quả đã duyệt, bàn khám bác sĩ dùng để cập nhật bản sao chỉ định mà không cần tải lại trang"""
    chi_dinh_id: int
    luot_kham_id: int
    ten_dich_vu: str
    nhom_dich_vu: Optional[str] = None
    trang_thai: str
    ket_qua_phan_loai: Optional[str] = None
    ket_qua_chi_tiet: Dict[str, Any] = Field(default_factory=dict, description="Cùng cấu trúc ResultView ở FE")
    tep_dinh_kem_urls: List[str] = []
    thoi_gian_tra_ket_qua: Optional[datetime] = None
    thoi_gian_duyet: datetime
    nguoi_duyet: Optional[str] = None


class ClsApprovalResponse(BaseModel):
    chi_dinh_id: int
    luot_kham_id: int
    trang_thai: str = Field(..., description="da_co_ket_qua sau khi duyệt")
    trang_thai_ket_qua: str = Field(..., description="DA_DUYET")
    thoi_gian_duyet: datetime
    nguoi_duyet: ClsApprover
    ket_qua: ReturnedClsResult


class ReturnedClsResultsResponse(BaseModel):
    items: List[ReturnedClsResult]
    server_time: datetime = Field(..., description="Dùng làm `since` cho lần hỏi kế tiếp (tránh lệch đồng hồ máy khách)")


class ClsReportClinic(BaseModel):
    co_quan_chu_quan: str
    ten: str
    dia_chi: str
    dien_thoai: str


class ClsReportPatient(BaseModel):
    ma_benh_nhan: Optional[str] = None
    ho_ten: str
    gioi_tinh: Optional[str] = None
    ngay_sinh: Optional[date] = None
    tuoi: Optional[int] = None
    dia_chi: Optional[str] = None
    so_dien_thoai: Optional[str] = None


class ClsReportLabRow(BaseModel):
    ma: str
    ten: str
    gia_tri: str
    don_vi: Optional[str] = None
    khoang_tham_chieu: Optional[str] = None
    danh_gia: str
    huong: Optional[str] = None
    bat_thuong: bool


class ClsReportResponse(BaseModel):
    """Dữ liệu đầy đủ cho phiếu kết quả CLS in A4/A5 (chỉ kết quả đã duyệt)"""
    ma_phieu: str
    chi_dinh_id: int
    luot_kham_id: int
    loai_phieu: str = Field(..., description="XET_NGHIEM hoặc HINH_ANH (CĐHA, TDCN, nội soi)")
    nhom_dich_vu: Optional[str] = None
    ma_dich_vu: str
    ten_dich_vu: str
    phong_kham: ClsReportClinic
    benh_nhan: ClsReportPatient
    bac_si_chi_dinh: Optional[str] = None
    chan_doan_so_bo: Optional[str] = None
    ly_do_vao_kham: Optional[str] = None
    thoi_gian_chi_dinh: datetime
    thoi_gian_lay_mau: Optional[datetime] = None
    thoi_gian_thuc_hien: Optional[datetime] = None
    ky_thuat_vien_thuc_hien: Optional[str] = None
    thiet_bi_thuc_hien: Optional[str] = None
    nguoi_duyet: ClsApprover
    thoi_gian_duyet: datetime
    ket_qua_phan_loai: Optional[str] = None
    chi_tiet: List[ClsReportLabRow] = []
    so_bat_thuong: int = 0
    mo_ta_hinh_anh: Optional[str] = None
    ket_luan: Optional[str] = None
    de_nghi: Optional[str] = None
    ghi_chu: Optional[str] = None
    tep_dinh_kem_urls: List[str] = []
