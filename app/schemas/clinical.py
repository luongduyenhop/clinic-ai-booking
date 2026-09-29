from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class VitalSignsSchema(BaseModel):
    """Chỉ số sinh hiệu cơ bản (Vital Signs) của người bệnh"""
    mach_lan_phut: Optional[int] = Field(None, ge=30, le=250, description="Mạch (nhịp/phút)")
    nhiet_do_c: Optional[float] = Field(None, ge=30.0, le=45.0, description="Thân nhiệt (°C)")
    huyet_ap_tam_thu: Optional[int] = Field(None, ge=50, le=300, description="Huyết áp tâm thu (mmHg)")
    huyet_ap_tam_truong: Optional[int] = Field(None, ge=30, le=200, description="Huyết áp tâm trương (mmHg)")
    nhip_tho_lan_phut: Optional[int] = Field(None, ge=5, le=80, description="Nhịp thở (lần/phút)")
    can_nang_kg: Optional[float] = Field(None, ge=0.5, le=500.0, description="Cân nặng (kg)")
    chieu_cao_cm: Optional[float] = Field(None, ge=20.0, le=250.0, description="Chiều cao (cm)")


class EncounterCreateRequest(BaseModel):
    """Yêu cầu bắt đầu lượt khám lâm sàng thực tế (OpenMRS Encounter)"""
    lich_kham_id: int = Field(..., description="ID lịch hẹn khám cần tiếp nhận")
    ly_do_vao_kham: Optional[str] = Field(None, description="Lý do vào khám của người bệnh")
    benh_su: Optional[str] = Field(None, description="Bệnh sử / tiền sử bệnh")

    # Chỉ số sinh hiệu (Vital Signs)
    mach_lan_phut: Optional[int] = Field(None, ge=30, le=250, description="Mạch (nhịp/phút)")
    nhiet_do_c: Optional[float] = Field(None, ge=30.0, le=45.0, description="Thân nhiệt (°C)")
    huyet_ap_tam_thu: Optional[int] = Field(None, ge=50, le=300, description="Huyết áp tâm thu (mmHg)")
    huyet_ap_tam_truong: Optional[int] = Field(None, ge=30, le=200, description="Huyết áp tâm trương (mmHg)")
    nhip_tho_lan_phut: Optional[int] = Field(None, ge=5, le=80, description="Nhịp thở (lần/phút)")
    can_nang_kg: Optional[float] = Field(None, ge=0.5, le=500.0, description="Cân nặng (kg)")
    chieu_cao_cm: Optional[float] = Field(None, ge=20.0, le=250.0, description="Chiều cao (cm)")

    kham_lam_sang_bo_phan: Optional[str] = Field(None, description="Khám lâm sàng các cơ quan/bộ phận")


class DiagnosisCreateRequest(BaseModel):
    """Yêu cầu thêm kết luận chẩn đoán bệnh theo mã ICD-10"""
    ma_icd10: str = Field(..., max_length=50, description="Mã bệnh chuẩn WHO ICD-10 (VD: I10, K29, J00)")
    ten_benh_chan_doan: str = Field(..., max_length=255, description="Tên bệnh chẩn đoán")
    loai_chan_doan: str = Field("chinh", description="Phân loại: 'chinh' (chẩn đoán chính) hoặc 'phu' (chẩn đoán kèm theo)")
    ghi_chu_chuyen_mon: Optional[str] = Field(None, description="Ghi chú chi tiết chuyên môn của bác sĩ")


class DiagnosisResponse(BaseModel):
    """Thông tin chẩn đoán bệnh"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    luot_kham_id: int
    ma_icd10: str
    ten_benh_chan_doan: str
    loai_chan_doan: str
    ghi_chu_chuyen_mon: Optional[str] = None
    created_at: Optional[datetime] = None


class OrderCreateRequest(BaseModel):
    """Yêu cầu kê phiếu chỉ định cận lâm sàng (Test Order)"""
    dich_vu_id: int = Field(..., description="ID dịch vụ cận lâm sàng (xét nghiệm, X-quang, v.v.)")
    so_luong: int = Field(1, ge=1, le=100, description="Số lượng thực hiện")


class OrderResponse(BaseModel):
    """Thông tin phiếu chỉ định cận lâm sàng"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    luot_kham_id: int
    dich_vu_id: int
    ten_dich_vu: Optional[str] = None
    so_luong: int
    don_gia_tai_thoi_diem: float
    trang_thai: str
    bac_si_chi_dinh_id: Optional[int] = None
    ket_qua_chi_tiet: Optional[str] = None
    tep_dinh_kem_url: Optional[str] = None
    thoi_gian_tra_ket_qua: Optional[datetime] = None
    created_at: Optional[datetime] = None


class EncounterCompleteRequest(BaseModel):
    """Yêu cầu hoàn tất ca khám và khóa hồ sơ bệnh án theo Thông tư 32/2023/TT-BYT"""
    ket_luan_dieu_tri: Optional[str] = Field(None, description="Kết luận điều trị y khoa")
    loi_dan_bac_si: Optional[str] = Field(None, description="Lời dặn của bác sĩ")
    ngay_hen_tai_kham: Optional[date] = Field(None, description="Ngày hẹn tái khám (nếu có)")


class EncounterResponse(BaseModel):
    """Chi tiết lượt khám lâm sàng / Bệnh án điện tử EMR"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    lich_kham_id: int
    bac_si_id: int
    benh_nhan_id: int
    thoi_gian_bat_dau: datetime
    thoi_gian_ket_thuc: Optional[datetime] = None
    ly_do_vao_kham: Optional[str] = None
    benh_su: Optional[str] = None

    # Sinh hiệu
    mach_lan_phut: Optional[int] = None
    nhiet_do_c: Optional[float] = None
    huyet_ap_tam_thu: Optional[int] = None
    huyet_ap_tam_truong: Optional[int] = None
    nhip_tho_lan_phut: Optional[int] = None
    can_nang_kg: Optional[float] = None
    chieu_cao_cm: Optional[float] = None

    kham_lam_sang_bo_phan: Optional[str] = None
    ket_luan_dieu_tri: Optional[str] = None
    loi_dan_bac_si: Optional[str] = None
    ngay_hen_tai_kham: Optional[date] = None

    # Khóa bệnh án
    is_locked: bool
    thoi_gian_khoa: Optional[datetime] = None

    # Danh sách liên quan
    danh_sach_chan_doan: List[DiagnosisResponse] = []
    danh_sach_chi_dinh: List[OrderResponse] = []
