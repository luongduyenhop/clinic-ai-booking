from datetime import date, time
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class DoctorAdminCreateRequest(BaseModel):
    """Tạo mới tài khoản và hồ sơ bác sĩ (Admin Portal)"""
    ho_ten: str = Field(..., min_length=2, max_length=150, description="Họ và tên bác sĩ")
    email: EmailStr = Field(..., description="Email đăng nhập của bác sĩ")
    so_dien_thoai: str = Field(..., pattern=r"^[0-9]{10,11}$", description="Số điện thoại")
    mat_khau: str = Field(..., min_length=8, description="Mật khẩu khởi tạo")
    chuyen_khoa_id: int = Field(..., description="Mã chuyên khoa công tác")
    hoc_vi: str = Field("BS", description="Học vị: BS, ThS.BS, BSCKI, BSCKII, PGS.TS, GS.TS")
    chung_chi_hanh_nghe: str = Field(..., description="Số chứng chỉ hành nghề y khoa")
    nam_kinh_nghiem: int = Field(0, ge=0, description="Số năm kinh nghiệm hành nghề")
    gia_kham_mac_dinh: float = Field(200000.0, ge=0, description="Giá khám mặc định (VNĐ)")
    mo_ta_chuyen_sau: Optional[str] = Field(None, description="Mô tả chuyên môn sâu")


class DoctorAdminUpdateRequest(BaseModel):
    """Cập nhật thông tin chuyên môn bác sĩ"""
    hoc_vi: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None
    nam_kinh_nghiem: Optional[int] = Field(None, ge=0)
    gia_kham_mac_dinh: Optional[float] = Field(None, ge=0)
    mo_ta_chuyen_sau: Optional[str] = None
    is_active: Optional[bool] = Field(None, description="Trạng thái nhận lịch hẹn (Bahmni Provider Availability)")


class DoctorAdminResponse(BaseModel):
    """Thông tin chi tiết bác sĩ cho màn hình quản trị"""
    id: int
    ho_ten: str
    email: str
    so_dien_thoai: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None
    ten_chuyen_khoa: Optional[str] = None
    phong_kham: Optional[str] = None
    hoc_vi: str
    chung_chi_hanh_nghe: str
    nam_kinh_nghiem: int
    gia_kham_mac_dinh: float
    is_active: bool
    so_luong_lich_hom_nay: int = 0


class ShiftCreateRequest(BaseModel):
    """Phân ca làm việc cho bác sĩ (OpenEMR 7 Calendar Shift)"""
    bac_si_id: int = Field(..., description="Mã bác sĩ")
    ngay_lam_viec: date = Field(..., description="Ngày phân ca (YYYY-MM-DD)")
    ca_lam_viec: Literal["sang", "chieu"] = Field("sang", description="'sang' (07:30-11:30) hoặc 'chieu' (13:30-17:00)")
    gio_bat_dau: Optional[time] = Field(None, description="Giờ bắt đầu cụ thể")
    gio_ket_thuc: Optional[time] = Field(None, description="Giờ kết thúc cụ thể")
    gioi_han_ca_kham: int = Field(8, ge=1, le=30, description="Số lượng bệnh nhân tối đa trong ca")


class ShiftToggleLockRequest(BaseModel):
    """Khóa ca trực hoặc báo nghỉ đột xuất"""
    is_active: bool = Field(..., description="True: Mở ca; False: Khóa ca")
    ghi_chu_nghi: Optional[str] = Field(None, max_length=255, description="Lý do khóa ca/báo nghỉ")


class ShiftResponse(BaseModel):
    """Thông tin 1 ca làm việc của bác sĩ"""
    id: int
    bac_si_id: int
    ten_bac_si: str
    chuyen_khoa: str
    phong_kham: Optional[str] = None
    ngay_lam_viec: date
    ca_lam_viec: str
    gio_bat_dau: time
    gio_ket_thuc: time
    gioi_han_ca_kham: int
    so_luong_da_dat: int = 0
    is_active: bool
    ghi_chu_nghi: Optional[str] = None


class EmergencyLeaveDeclareRequest(BaseModel):
    """Admin khai báo bác sĩ nghỉ đột xuất cho ca trực"""
    ly_do_nghi: str = Field(..., min_length=3, max_length=255, description="Lý do bác sĩ nghỉ đột xuất")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú thêm của Admin")


class EmergencyLeaveSummaryResponse(BaseModel):
    """Báo cáo thống kê tác động khi bác sĩ nghỉ đột xuất"""
    lich_lam_viec_id: int
    bac_si_id: int
    ten_bac_si: str
    chuyen_khoa: str
    ngay_lam_viec: date
    ca_lam_viec: str
    is_active: bool
    ly_do_nghi: str
    so_ve_cho_kham: int
    so_ve_dang_kham: int
    so_lich_chua_checkin: int


class ReassignQueueRequest(BaseModel):
    """Yêu cầu điều phối hàng đợi sang Bác sĩ trực thay thế"""
    bac_si_thay_the_id: int = Field(..., description="ID bác sĩ trực thay thế (cùng chuyên khoa)")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú điều phối")


class ReassignQueueResponse(BaseModel):
    """Kết quả điều phối chuyển hàng đợi"""
    lich_lam_viec_id: int
    bac_si_goc_id: int
    ten_bac_si_goc: str
    bac_si_thay_the_id: int
    ten_bac_si_thay_the: str
    so_ve_cho_kham_da_chuyen: int
    so_ve_dang_kham_ban_giao: int
    so_lich_chua_checkin_da_chuyen: int
    ghi_chu: str


class PostponeAndCancelResponse(BaseModel):
    """Kết quả tạm hoãn hàng đợi và hủy lịch có bảo vệ quyền lợi bệnh nhân"""
    lich_lam_viec_id: int
    bac_si_id: int
    so_ve_tam_hoan: int
    so_lich_da_huy: int
    ghi_chu: str


class ServiceCreateRequest(BaseModel):
    """Tạo mới dịch vụ y tế / cận lâm sàng niêm yết"""
    ma_dich_vu: str = Field(..., min_length=2, max_length=50)
    ten_dich_vu: str = Field(..., min_length=2, max_length=150)
    chuyen_khoa_id: Optional[int] = None
    don_gia: float = Field(..., ge=0, description="Đơn vị tiền tệ VNĐ")
    don_vi_tinh: str = Field("Lần", max_length=30)
    quy_trinh_thuc_hien: Optional[str] = None


class ServiceUpdateRequest(BaseModel):
    """Cập nhật dịch vụ y tế"""
    ten_dich_vu: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None
    don_gia: Optional[float] = Field(None, ge=0)
    don_vi_tinh: Optional[str] = None
    quy_trinh_thuc_hien: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceItemAdminResponse(BaseModel):
    """Thông tin dịch vụ trả về cho quản trị"""
    id: int
    ma_dich_vu: str
    ten_dich_vu: str
    chuyen_khoa_id: Optional[int] = None
    ten_chuyen_khoa: Optional[str] = None
    don_gia: float
    don_vi_tinh: str
    quy_trinh_thuc_hien: Optional[str] = None
    is_active: bool


class AdminDashboardStatsResponse(BaseModel):
    """Số liệu thống kê vận hành phòng khám theo thời gian thực (Live KPIs)"""
    ngay_bao_cao: date
    tong_lich_hen_hom_nay: int = 0
    so_ca_da_check_in: int = 0
    so_ca_dang_kham: int = 0
    so_ca_hoan_tat_kham: int = 0
    so_ca_da_huy: int = 0
    so_ca_no_show: int = 0
    thoi_gian_cho_trung_binh_phut: float = 0.0
    tong_bac_si_hoat_dong: int = 0
    tong_chuyen_khoa: int = 0
    doanh_thu_du_kien_hom_nay: float = 0.0
