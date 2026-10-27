from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


# ── 1. Đăng ký tài khoản Bệnh nhân mới ──────────────────────────────
class PatientRegisterRequest(BaseModel):
    ho_ten: str = Field(..., min_length=2, max_length=150, description="Họ và tên bệnh nhân")
    email: EmailStr = Field(..., description="Email đăng ký tài khoản và đăng nhập")
    mat_khau: str = Field(..., min_length=6, description="Mật khẩu bảo mật")
    so_dien_thoai: Optional[str] = Field(None, min_length=9, max_length=15, description="Số điện thoại liên hệ (tùy chọn)")
    ngay_sinh: date = Field(..., description="Ngày tháng năm sinh")
    gioi_tinh: str = Field(default="Nam", description="Giới tính (Nam, Nữ)")
    dia_chi: Optional[str] = Field(None, max_length=255, description="Địa chỉ thường trú")
    cccd_so: Optional[str] = Field(None, max_length=20, description="Số CCCD/Định danh")
    nhom_mau: Optional[str] = Field(default="O+", max_length=10, description="Nhóm máu (A+, B+, O+, AB+)")
    tien_su_benh: Optional[str] = Field(None, description="Tiền sử bệnh lý bản thân")
    di_ung_thuoc: Optional[str] = Field(None, description="Tiền sử dị ứng thuốc/thực phẩm")


# ── 2. Cập nhật hồ sơ bệnh nhân ─────────────────────────────────────
class PatientProfileUpdateRequest(BaseModel):
    ho_ten: Optional[str] = Field(None, max_length=150)
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = Field(None, max_length=10)
    dia_chi: Optional[str] = Field(None, max_length=255)
    cccd_so: Optional[str] = Field(None, max_length=20)
    nhom_mau: Optional[str] = Field(None, max_length=10)
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None


class PatientProfileResponse(BaseModel):
    id: int
    ma_dinh_danh_y_te: str
    ho_ten: str
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    dia_chi: Optional[str] = None
    cccd_so: Optional[str] = None
    nhom_mau: Optional[str] = None
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    diem_tin_nhiem: int = 100
    so_lan_no_show: int = 0
    is_blocked_booking: bool = False

    class Config:
        from_attributes = True


# ── 3. Quản lý hồ sơ người thân (Gia đình) ──────────────────────────
class FamilyMemberCreateRequest(BaseModel):
    ho_ten: str = Field(..., min_length=2, max_length=150, description="Họ tên người thân")
    quan_he: str = Field(default="CON", description="Quan hệ: CON, VO_CHONG, CHA_ME, NGUOI_THAN")
    ngay_sinh: date = Field(..., description="Ngày sinh")
    gioi_tinh: str = Field(default="Nam", description="Giới tính")
    so_dien_thoai: Optional[str] = Field(None, max_length=20)
    cccd_so: Optional[str] = Field(None, max_length=20)
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    nhom_mau: Optional[str] = None
    ghi_chu: Optional[str] = None


class FamilyMemberUpdateRequest(BaseModel):
    ho_ten: Optional[str] = None
    quan_he: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    cccd_so: Optional[str] = None
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    nhom_mau: Optional[str] = None
    ghi_chu: Optional[str] = None


class FamilyMemberResponse(BaseModel):
    id: int
    benh_nhan_chinh_id: int
    ho_ten: str
    quan_he: str
    ngay_sinh: date
    gioi_tinh: str
    so_dien_thoai: Optional[str] = None
    cccd_so: Optional[str] = None
    tien_su_benh: Optional[str] = None
    di_ung_thuoc: Optional[str] = None
    nhom_mau: Optional[str] = None
    ghi_chu: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 4. Khảo sát & Đánh giá dịch vụ sau khám ─────────────────────────
class ServiceFeedbackCreateRequest(BaseModel):
    luot_kham_id: int = Field(..., description="ID lượt khám cần đánh giá")
    so_sao_bac_si: int = Field(5, ge=1, le=5, description="Đánh giá bác sĩ (1-5 sao)")
    so_sao_phong_kham: int = Field(5, ge=1, le=5, description="Đánh giá phòng khám (1-5 sao)")
    tieu_chi_hai_long: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Tiêu chí chi tiết (thái độ, chuyên môn, cơ sở vật chất)")
    nhan_xet: Optional[str] = Field(None, description="Ý kiến đóng góp")
    an_danh: bool = Field(False, description="Đánh giá ẩn danh")


class ServiceFeedbackResponse(BaseModel):
    id: int
    luot_kham_id: int
    benh_nhan_id: int
    bac_si_id: int
    so_sao_bac_si: int
    so_sao_phong_kham: int
    tieu_chi_hai_long: Dict[str, Any]
    nhan_xet: Optional[str] = None
    an_danh: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── 5. Sổ khám bệnh điện tử cá nhân (EMR Health Records) ───────────
class PatientMedicalRecordSummaryResponse(BaseModel):
    luot_kham_id: int
    ngay_kham: date
    bac_si_ho_ten: str
    chuyen_khoa: str
    phong_kham: str
    chan_doan_chinh: str
    ma_icd10: str
    loi_dan_bac_si: Optional[str] = None
    ngay_hen_tai_kham: Optional[date] = None
    tong_so_chi_dinh_cls: int = 0
    co_don_thuoc: bool = False
    so_loai_thuoc: int = 0
    trang_thai_luot_kham: str = "DA_KHAM"


class PatientDiagnosisResponse(BaseModel):
    id: int
    ma_icd10: str
    ten_benh_chan_doan: str
    loai_chan_doan: str
    ghi_chu_chuyen_mon: Optional[str] = None


class PatientLabResultResponse(BaseModel):
    id: int
    luot_kham_id: int
    ngay_kham: date
    ten_dich_vu: str
    ma_dich_vu: Optional[str] = None
    trang_thai: str
    ket_qua_chi_tiet: Optional[str] = None
    ket_qua_phan_loai: Optional[str] = None
    tri_so_chi_tiet: Dict[str, Any] = Field(default_factory=dict)
    file_dinh_kem_urls: List[str] = Field(default_factory=list)
    thoi_gian_tra_ket_qua: Optional[datetime] = None


class PatientPrescriptionItemResponse(BaseModel):
    id: int
    ten_thuoc: str
    hoat_chat: Optional[str] = None
    ham_luong: Optional[str] = None
    don_vi_tinh: str
    so_luong: int
    lieu_sang: Optional[str] = ""
    lieu_trua: Optional[str] = ""
    lieu_chieu: Optional[str] = ""
    lieu_toi: Optional[str] = ""
    cach_dung: str
    so_ngay_dung: int
    ghi_chu: Optional[str] = None


class PatientPrescriptionResponse(BaseModel):
    id: int
    luot_kham_id: int
    ngay_kham: date
    ngay_ke_don: datetime
    bac_si_ho_ten: str
    chuyen_khoa: str
    trang_thai: str
    so_ngay_dung: int
    loi_dan_uong_thuoc: Optional[str] = None
    ghi_chu_duoc_lam_sang: Optional[str] = None
    ma_don_quoc_gia: Optional[str] = None
    danh_sach_thuoc: List[PatientPrescriptionItemResponse] = Field(default_factory=list)


class PatientMedicalRecordDetailResponse(PatientMedicalRecordSummaryResponse):
    ly_do_vao_kham: Optional[str] = None
    benh_su: Optional[str] = None
    trieu_chung: Optional[str] = None
    chan_doan_so_bo: Optional[str] = None
    ket_luan_dieu_tri: Optional[str] = None
    loi_dan_tai_kham: Optional[str] = None
    danh_sach_chan_doan: List[PatientDiagnosisResponse] = Field(default_factory=list)
    ket_qua_can_lam_sang: List[PatientLabResultResponse] = Field(default_factory=list)
    don_thuoc: List[PatientPrescriptionResponse] = Field(default_factory=list)
