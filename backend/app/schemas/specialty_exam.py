from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class KhamNoiKhoaPayload(BaseModel):
    tuan_hoan: Optional[str] = None
    ho_hap: Optional[str] = None
    tieu_hoa: Optional[str] = None
    than_tiet_nieu: Optional[str] = None
    noi_tiet: Optional[str] = None
    than_kinh: Optional[str] = None
    co_xuong_khop: Optional[str] = None
    ket_luan_chuyen_khoa: Optional[str] = None


class KhamNoiKhoaResponse(KhamNoiKhoaPayload):
    id: int
    luot_kham_id: int
    bac_si_kham_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class KhamNgoaiKhoaPayload(BaseModel):
    vi_tri_ton_thuong: Optional[str] = Field(None, max_length=255)
    mo_ta_ton_thuong: Optional[str] = None
    tinh_trang_vet_mo: Optional[str] = None
    he_van_dong_ngoai: Optional[str] = None
    chi_dinh_tieu_phau: bool = False
    noi_dung_thu_thuat: Optional[str] = None
    ket_luan_chuyen_khoa: Optional[str] = None


class KhamNgoaiKhoaResponse(KhamNgoaiKhoaPayload):
    id: int
    luot_kham_id: int
    bac_si_kham_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class KhamMatPayload(BaseModel):
    thi_luc_khong_kinh_phai: Optional[str] = Field(None, max_length=20)
    thi_luc_khong_kinh_trai: Optional[str] = Field(None, max_length=20)
    thi_luc_co_kinh_phai: Optional[str] = Field(None, max_length=20)
    thi_luc_co_kinh_trai: Optional[str] = Field(None, max_length=20)
    nhan_ap_phai: Optional[Decimal] = None
    nhan_ap_trai: Optional[Decimal] = None
    ban_phan_truoc_phai: Optional[str] = None
    ban_phan_truoc_trai: Optional[str] = None
    day_mat_phai: Optional[str] = None
    day_mat_trai: Optional[str] = None
    ket_luan_chuyen_khoa: Optional[str] = None


class KhamMatResponse(KhamMatPayload):
    id: int
    luot_kham_id: int
    bac_si_kham_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class KhamTaiMuiHongPayload(BaseModel):
    thinh_luc_tai_phai: Optional[str] = Field(None, max_length=50)
    thinh_luc_tai_trai: Optional[str] = Field(None, max_length=50)
    tai_phai: Optional[str] = None
    tai_trai: Optional[str] = None
    mui_xoang: Optional[str] = None
    hong_amidan: Optional[str] = None
    thanh_quan: Optional[str] = None
    ket_luan_chuyen_khoa: Optional[str] = None


class KhamTaiMuiHongResponse(KhamTaiMuiHongPayload):
    id: int
    luot_kham_id: int
    bac_si_kham_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class KhamRangHamMatPayload(BaseModel):
    so_do_rang_fdi: Optional[str] = None
    ham_tren: Optional[str] = None
    ham_duoi: Optional[str] = None
    nha_chu_nuou: Optional[str] = None
    khop_can: Optional[str] = Field(None, max_length=100)
    niem_mac_mieng: Optional[str] = None
    ket_luan_chuyen_khoa: Optional[str] = None


class KhamRangHamMatResponse(KhamRangHamMatPayload):
    id: int
    luot_kham_id: int
    bac_si_kham_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class GenericSpecialtyExamRequest(BaseModel):
    """Schema linh hoạt nhận dữ liệu khám chuyên khoa từ Frontend cho bất kỳ khoa nào trong 5 khoa"""
    data: Dict[str, Any] = Field(default_factory=dict)
