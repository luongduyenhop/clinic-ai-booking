from datetime import date, time, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class DoctorAdminCreateRequest(BaseModel):
    """Tạo mới tài khoản và hồ sơ bác sĩ (Admin Portal)"""
    ho_ten: str = Field(..., min_length=2, max_length=150, description="Họ và tên bác sĩ")
    email: EmailStr = Field(..., description="Email đăng nhập của bác sĩ")
    so_dien_thoai: str = Field(..., pattern=r"^[0-9]{10,11}$", description="Số điện thoại")
    mat_khau: str = Field(..., min_length=8, description="Mật khẩu khởi tạo")
    chuyen_khoa_id: int = Field(..., description="Mã chuyên khoa công tác")
    phong_kham_id: Optional[int] = Field(None, description="Buồng khám làm việc chính (cố định)")
    hoc_vi: str = Field("BS", description="Học vị: BS, ThS.BS, BSCKI, BSCKII, PGS.TS, GS.TS")
    chung_chi_hanh_nghe: str = Field(..., description="Số chứng chỉ hành nghề y khoa")
    nam_kinh_nghiem: int = Field(0, ge=0, description="Số năm kinh nghiệm hành nghề")
    gia_kham_mac_dinh: float = Field(200000.0, ge=0, description="Giá khám mặc định (VNĐ)")
    mo_ta_chuyen_sau: Optional[str] = Field(None, description="Mô tả chuyên môn sâu")


class DoctorAdminUpdateRequest(BaseModel):
    """Cập nhật thông tin chuyên môn bác sĩ"""
    ho_ten: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    hoc_vi: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None
    phong_kham_id: Optional[int] = None
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
    phong_kham_id: Optional[int] = None
    ma_phong_kham: Optional[str] = None
    ten_phong_kham: Optional[str] = None
    phong_kham: Optional[str] = None
    hoc_vi: str
    chung_chi_hanh_nghe: str
    nam_kinh_nghiem: int
    gia_kham_mac_dinh: float
    is_active: bool
    so_luong_lich_hom_nay: int = 0


class RoomCreateRequest(BaseModel):
    """Tạo mới buồng khám vật lý (Physical Clinic Room)"""
    ma_phong: str = Field(..., min_length=2, max_length=20, description="Mã phòng (ví dụ P101, P201)")
    ten_phong: str = Field(..., min_length=2, max_length=100, description="Tên buồng khám/phòng chức năng")
    chuyen_khoa_id: Optional[int] = Field(None, description="Mã chuyên khoa quản lý buồng khám")
    tang: str = Field("Tầng 1", description="Vị trí tầng")
    loai_phong: str = Field("kham_benh", description="Loại phòng: kham_benh, can_lam_sang, thu_thuat, tiep_don")
    thiet_bi_chinh: Optional[str] = Field(None, description="Thiết bị y tế chính trong phòng")


class RoomResponse(BaseModel):
    """Thông tin buồng khám vật lý"""
    id: int
    ma_phong: str
    ten_phong: str
    chuyen_khoa_id: Optional[int] = None
    ten_chuyen_khoa: Optional[str] = None
    tang: str
    loai_phong: str
    thiet_bi_chinh: Optional[str] = None
    is_active: bool


class ShiftCreateRequest(BaseModel):
    """Phân ca làm việc cho bác sĩ (OpenEMR 7 Calendar Shift)"""
    bac_si_id: int = Field(..., description="Mã bác sĩ")
    phong_kham_id: Optional[int] = Field(None, description="Mã buồng khám vật lý (Physical Clinic Room)")
    ngay_lam_viec: date = Field(..., description="Ngày phân ca (YYYY-MM-DD)")
    ca_lam_viec: Literal["sang", "chieu"] = Field("sang", description="'sang' (07:30-11:30) hoặc 'chieu' (13:30-17:00)")
    gio_bat_dau: Optional[time] = Field(None, description="Giờ bắt đầu cụ thể")
    gio_ket_thuc: Optional[time] = Field(None, description="Giờ kết thúc cụ thể")
    gioi_han_ca_kham: int = Field(12, ge=1, le=50, description="Số lượng bệnh nhân tối đa trong ca (tính theo thời lượng ca và slot)")
    han_muc_dat_truoc: Optional[int] = Field(None, ge=0, description="Hạn mức đặt khám trực tuyến (mặc định 70-75% giới hạn)")
    han_muc_vang_lai: Optional[int] = Field(None, ge=0, description="Hạn mức bệnh nhân vãng lai/cấp cứu (mặc định 25-30% giới hạn)")


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
    phong_kham_id: Optional[int] = None
    ma_phong: Optional[str] = None
    ten_phong: Optional[str] = None
    tang_phong: Optional[str] = None
    ngay_lam_viec: date
    ca_lam_viec: str
    gio_bat_dau: time
    gio_ket_thuc: time
    gioi_han_ca_kham: int
    han_muc_dat_truoc: int = 6
    han_muc_vang_lai: int = 2
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
    """Tạo mới dịch vụ y tế / cận lâm sàng niêm yết (Thông tư 22/2023/TT-BYT)"""
    ma_dich_vu: str = Field(..., min_length=2, max_length=50)
    ten_dich_vu: str = Field(..., min_length=2, max_length=150)
    chuyen_khoa_id: Optional[int] = None
    don_gia: float = Field(..., ge=0, description="Đơn vị tiền tệ VNĐ")
    don_vi_tinh: str = Field("Lần", max_length=30)
    quy_trinh_thuc_hien: Optional[str] = None
    ma_nhom_byt: Optional[str] = Field(None, max_length=50, description="Phân loại dịch vụ (XN, CDHA, TDCN, TT, KHAM)")
    ma_tu_dong_bhyt: Optional[str] = Field(None, max_length=50, description="Mã tham chiếu cũ")
    phong_thuc_hien_id: Optional[int] = Field(None, description="Buồng/phòng thực hiện kỹ thuật")
    thoi_gian_tra_ket_qua_phut: int = Field(30, ge=5, le=1440, description="Thời gian trả kết quả (TAT - Turnaround Time tính bằng phút)")
    huong_dan_chuan_bi: Optional[str] = Field(None, max_length=1000, description="Hướng dẫn chuẩn bị bệnh nhân trước khi thực hiện")


class ServiceUpdateRequest(BaseModel):
    """Cập nhật dịch vụ y tế"""
    ten_dich_vu: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None
    don_gia: Optional[float] = Field(None, ge=0)
    don_vi_tinh: Optional[str] = None
    quy_trinh_thuc_hien: Optional[str] = None
    ma_nhom_byt: Optional[str] = None
    ma_tu_dong_bhyt: Optional[str] = None
    phong_thuc_hien_id: Optional[int] = None
    thoi_gian_tra_ket_qua_phut: Optional[int] = Field(None, ge=5, le=1440)
    huong_dan_chuan_bi: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None


class ServiceItemAdminResponse(BaseModel):
    """Thông tin dịch vụ trả về cho quản trị kèm nơi thực hiện kỹ thuật"""
    id: int
    ma_dich_vu: str
    ten_dich_vu: str
    chuyen_khoa_id: Optional[int] = None
    ten_chuyen_khoa: Optional[str] = None
    don_gia: float
    don_vi_tinh: str
    quy_trinh_thuc_hien: Optional[str] = None
    is_active: bool
    ma_nhom_byt: Optional[str] = None
    ma_tu_dong_bhyt: Optional[str] = None
    phong_thuc_hien_id: Optional[int] = None
    ten_phong_thuc_hien: Optional[str] = None
    ma_phong_thuc_hien: Optional[str] = None
    thoi_gian_tra_ket_qua_phut: int = 30
    huong_dan_chuan_bi: Optional[str] = None


class AdminDashboardStatsResponse(BaseModel):
    """Số liệu thống kê vận hành phòng khám đa tầng theo thời gian thực (Multi-Tier Command Center)"""
    ngay_bao_cao: date

    # --- Tầng 1: Vận hành & Hàng đợi (Operational & Flow Board) ---
    tong_lich_hen_hom_nay: int = 0
    so_ca_da_check_in: int = 0
    so_ca_cho_kham: int = 0
    so_ca_dang_kham: int = 0
    so_ca_hoan_tat_kham: int = 0
    so_ca_tam_hoan: int = 0
    so_ca_bo_kham: int = 0
    so_ca_da_huy: int = 0
    so_ca_no_show: int = 0
    thoi_gian_cho_trung_binh_phut: float = 0.0
    cong_suat_buong_kham_pct: float = 0.0
    tong_bac_si_hoat_dong: int = 0
    tong_chuyen_khoa: int = 0

    # --- Tầng 2: Giám sát An toàn Lâm sàng (Clinical Safety & Governance) ---
    so_ca_canh_bao_cap_cuu: int = 0
    so_bien_ban_dinh_chinh: int = 0
    so_dinh_chinh_muc_cao: int = 0
    so_benh_an_da_khoa: int = 0

    # --- Tầng 3: Đối soát Tài chính Y tế (Financial & Revenue Audit) ---
    doanh_thu_kham_lam_sang: float = 0.0
    doanh_thu_can_lam_sang: float = 0.0
    tong_doanh_thu_trong_ngay: float = 0.0
    ty_le_that_thoat_noshow_pct: float = 0.0
    doanh_thu_du_kien_hom_nay: float = 0.0  # Backward-compatibility alias


# ==============================================================================
# GÓI 1: QUẢN LÝ DANH MỤC CHUYÊN KHOA KHÁM BỆNH (OpenMRS Department Catalog)
# ==============================================================================

class DepartmentCreateRequest(BaseModel):
    """Tạo mới chuyên khoa khám bệnh"""
    ma_chuyen_khoa: str = Field(..., min_length=2, max_length=50, description="Mã chuyên khoa (VD: NOI_TIM_MACH, MAT)")
    ten_chuyen_khoa: str = Field(..., min_length=2, max_length=100, description="Tên chuyên khoa")
    mo_ta: Optional[str] = Field(None, description="Mô tả phạm vi khám chuyên môn")
    vi_tri_phong: Optional[str] = Field(None, max_length=50, description="Vị trí mặc định (VD: Khu A - Tầng 2)")
    is_active: bool = Field(True, description="Trạng thái hoạt động")


class DepartmentUpdateRequest(BaseModel):
    """Cập nhật chuyên khoa khám bệnh"""
    ten_chuyen_khoa: Optional[str] = Field(None, min_length=2, max_length=100)
    mo_ta: Optional[str] = None
    vi_tri_phong: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class DepartmentAdminResponse(BaseModel):
    """Thông tin chuyên khoa trả về cho Admin kèm số lượng bác sĩ và buồng khám"""
    id: int
    ma_chuyen_khoa: str
    ten_chuyen_khoa: str
    mo_ta: Optional[str] = None
    vi_tri_phong: Optional[str] = None
    is_active: bool
    so_luong_bac_si: int = 0
    so_luong_phong_kham: int = 0


# ==============================================================================
# GÓI 2: QUẢN LÝ LỊCH LÀM VIỆC ĐỊNH KỲ CỦA BÁC SĨ (Bahmni Weekly Roster)
# ==============================================================================

class RosterTemplateCreateRequest(BaseModel):
    """Thiết lập mẫu lịch định kỳ tuần cho Bác sĩ (Bahmni Provider Roster)"""
    bac_si_id: int = Field(..., description="ID Bác sĩ")
    thu_trong_tuan: int = Field(..., ge=2, le=8, description="Thứ trong tuần (2: Thứ 2 ... 7: Thứ 7, 8: Chủ Nhật)")
    ca_lam_viec: Literal["sang", "chieu"] = Field("sang", description="Ca sáng hoặc chiều")
    gio_bat_dau: Optional[time] = Field(None, description="Giờ bắt đầu")
    gio_ket_thuc: Optional[time] = Field(None, description="Giờ kết thúc")
    phong_kham_id: Optional[int] = Field(None, description="Buồng khám làm việc cố định")
    thoi_luong_slot_phut: int = Field(20, description="Thời lượng 1 slot khám (15, 20, 30)")
    gioi_han_ca_kham: int = Field(12, ge=1, le=50, description="Tổng số bệnh nhân trong ca")
    han_muc_dat_truoc: int = Field(10, ge=0, description="Hạn mức đặt trước trực tuyến")
    han_muc_vang_lai: int = Field(2, ge=0, description="Hạn mức vãng lai")


class RosterTemplateUpdateRequest(BaseModel):
    """Cập nhật mẫu lịch định kỳ tuần"""
    phong_kham_id: Optional[int] = None
    thoi_luong_slot_phut: Optional[int] = None
    gioi_han_ca_kham: Optional[int] = None
    han_muc_dat_truoc: Optional[int] = None
    han_muc_vang_lai: Optional[int] = None
    is_active: Optional[bool] = None


class RosterTemplateResponse(BaseModel):
    """Thông tin mẫu lịch định kỳ tuần của bác sĩ"""
    id: int
    bac_si_id: int
    ten_bac_si: str
    chuyen_khoa: str
    thu_trong_tuan: int
    ten_thu_tieng_viet: str
    ca_lam_viec: str
    gio_bat_dau: time
    gio_ket_thuc: time
    phong_kham_id: Optional[int] = None
    ten_phong_kham: Optional[str] = None
    thoi_luong_slot_phut: int
    gioi_han_ca_kham: int
    han_muc_dat_truoc: int
    han_muc_vang_lai: int
    is_active: bool


class RosterBatchGenerateRequest(BaseModel):
    """Yêu cầu phát sinh ca trực tự động theo mẫu lịch tuần (Batch Shift Generator)"""
    tu_ngay: date = Field(..., description="Từ ngày (YYYY-MM-DD)")
    den_ngay: date = Field(..., description="Đến ngày (YYYY-MM-DD)")
    bac_si_ids: Optional[List[int]] = Field(None, description="Danh sách ID bác sĩ áp dụng (bỏ trống = tất cả bác sĩ đang hoạt động)")


class RosterBatchGenerateResponse(BaseModel):
    """Kết quả phát sinh ca trực tự động hàng loạt"""
    tu_ngay: date
    den_ngay: date
    tong_so_ngay: int
    so_ca_tao_thanh_cong: int
    so_ca_bo_qua_da_ton_tai: int
    so_ca_xung_dot_phong: int
    chi_tiet: List[str] = []


# ==============================================================================
# GÓI 3: QUẢN LÝ NGÀY NGHỈ & LỊCH NGHỈ ĐỘT XUẤT CỦA BÁC SĨ (Absence Management)
# ==============================================================================

class DoctorLeaveCreateRequest(BaseModel):
    """Đăng ký lịch nghỉ phép hoặc báo nghỉ đột xuất của bác sĩ"""
    bac_si_id: int = Field(..., description="ID Bác sĩ xin nghỉ")
    loai_nghi: Literal["NGHI_PHEP", "NGHI_DOT_XUAT"] = Field("NGHI_PHEP", description="NGHI_PHEP (có kế hoạch) hoặc NGHI_DOT_XUAT (trong ngày)")
    tu_ngay: date = Field(..., description="Nghỉ từ ngày")
    den_ngay: date = Field(..., description="Nghỉ đến ngày")
    ca_lam_viec: Optional[Literal["sang", "chieu"]] = Field(None, description="Ca cụ thể (bỏ trống = cả ngày)")
    ly_do: str = Field(..., min_length=3, max_length=500, description="Lý do nghỉ phép")


class DoctorLeaveResponse(BaseModel):
    """Thông tin đơn nghỉ phép của bác sĩ"""
    id: int
    bac_si_id: int
    ten_bac_si: str
    chuyen_khoa: str
    loai_nghi: str
    tu_ngay: date
    den_ngay: date
    ca_lam_viec: Optional[str] = None
    ly_do: str
    trang_thai: str
    ghi_chu_duyet: Optional[str] = None
    so_ca_anh_huong: int = 0
    so_lich_anh_huong: int = 0
    created_at: datetime


class DoctorLeaveApproveRequest(BaseModel):
    """Duyệt hoặc từ chối đơn nghỉ phép"""
    hanh_dong: Literal["DA_DUYET", "TU_CHOI"] = Field("DA_DUYET")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú phản hồi duyệt")


class AffectedBookingItem(BaseModel):
    """Danh sách bệnh nhân bị ảnh hưởng bởi ca nghỉ để nhân viên hỗ trợ dời lịch"""
    lich_kham_id: int
    ma_lich_kham: str
    ten_benh_nhan: str
    so_dien_thoai: Optional[str] = None
    ngay_kham: date
    gio_kham: time
    trang_thai: str


# ==============================================================================
# GÓI 4: QUẢN TRỊ ÁNH XẠ TRIỆU CHỨNG - CHUYÊN KHOA & ĐÁNH GIÁ AI
# ==============================================================================

class ConceptCreateRequest(BaseModel):
    """Tạo mới khái niệm triệu chứng / chẩn đoán ánh xạ chuyên khoa"""
    ma_khai_niem: str = Field(..., min_length=2, max_length=50, description="Mã thuật ngữ (VD: TT-001 hoặc mã ICD-10)")
    ten_khai_niem: str = Field(..., min_length=2, max_length=255, description="Tên triệu chứng / chẩn đoán")
    loai_khai_niem: str = Field("trieu_chung", description="'trieu_chung', 'benh_icd10', 'dich_vu'")
    chuyen_khoa_id: Optional[int] = Field(None, description="Chuyên khoa tiếp nhận phụ trách")
    mo_ta: Optional[str] = Field(None, description="Mô tả lâm sàng")
    is_active: bool = Field(True)


class ConceptUpdateRequest(BaseModel):
    """Cập nhật khái niệm triệu chứng"""
    ten_khai_niem: Optional[str] = None
    loai_khai_niem: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None
    mo_ta: Optional[str] = None
    is_active: Optional[bool] = None


class ConceptAdminResponse(BaseModel):
    """Thông tin khái niệm triệu chứng - chuyên khoa"""
    id: int
    ma_khai_niem: str
    ten_khai_niem: str
    loai_khai_niem: str
    chuyen_khoa_id: Optional[int] = None
    ten_chuyen_khoa: Optional[str] = None
    mo_ta: Optional[str] = None
    is_active: bool


class RedFlagCreateRequest(BaseModel):
    """Tạo mới từ khóa cảnh báo cấp cứu (Red Flags)"""
    tu_khoa: str = Field(..., min_length=2, max_length=100, description="Từ khóa dấu hiệu nguy hiểm")
    muc_do_nguy_hiem: str = Field("rat_nguy_hiem", description="Mức độ: nguy_hiem, rat_nguy_hiem")
    huong_dan_xu_tri: str = Field("CẢNH BÁO NGUY HIỂM! Gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất")
    van_ban_byt_ref: Optional[str] = Field(None, description="Văn bản QĐ Bộ Y Tế tham chiếu")


class RedFlagUpdateRequest(BaseModel):
    """Cập nhật từ khóa cảnh báo cấp cứu"""
    tu_khoa: Optional[str] = None
    muc_do_nguy_hiem: Optional[str] = None
    huong_dan_xu_tri: Optional[str] = None
    van_ban_byt_ref: Optional[str] = None
    is_active: Optional[bool] = None


class RedFlagAdminResponse(BaseModel):
    """Thông tin từ khóa cảnh báo cấp cứu"""
    id: int
    tu_khoa: str
    muc_do_nguy_hiem: str
    huong_dan_xu_tri: str
    van_ban_byt_ref: Optional[str] = None
    is_active: bool


class AIAccuracySpecialtyItem(BaseModel):
    chuyen_khoa_id: int
    ten_chuyen_khoa: str
    so_ca_goi_y: int
    so_ca_khop_thuc_te: int
    ty_le_chinh_xac_pct: float


class AIAccuracyReportResponse(BaseModel):
    """Báo cáo đánh giá chất lượng gợi ý lâm sàng của AI"""
    tong_so_ca_phan_tich_ai: int
    so_ca_duoc_bac_si_kham: int
    so_ca_khop_chuyen_khoa: int
    ty_le_chinh_xac_toan_vien_pct: float
    danh_gia_sao_trung_binh: float
    chi_tiet_theo_chuyen_khoa: List[AIAccuracySpecialtyItem] = []


# ==============================================================================
# GÓI 5: XEM BÁO CÁO THỐNG KÊ CHUYÊN SÂU (Analytics & Intelligence)
# ==============================================================================

class SpecialtyBookingStat(BaseModel):
    chuyen_khoa_id: int
    ten_chuyen_khoa: str
    so_luot_dat: int
    so_hoan_tat: int
    so_da_huy: int


class CancellationReasonBreakdown(BaseModel):
    benh_nhan_tu_huy: int = 0
    tu_dong_huy_qua_han_24h: int = 0
    phong_kham_huy_do_bac_si_nghi: int = 0
    tong_so_huy: int = 0


class AdminAnalyticsReportResponse(BaseModel):
    """Báo cáo thống kê toàn diện lượt đặt, hủy, và hiệu quả tiếp đón AI"""
    tu_ngay: date
    den_ngay: date
    tong_luot_dat_kham: int
    so_luot_kham_hoan_tat: int
    so_luot_no_show: int
    ty_le_no_show_pct: float
    phan_tich_huy: CancellationReasonBreakdown
    ty_le_huy_tong_hop_pct: float
    do_chinh_xac_ai_pct: float
    thong_ke_chuyen_khoa: List[SpecialtyBookingStat] = []


# ==============================================================================
# GÓI 6: QUẢN TRỊ HỒ SƠ BỆNH NHÂN (OpenMRS Master Patient Directory)
# ==============================================================================

class PatientAdminItemResponse(BaseModel):
    """Thông tin tóm tắt hồ sơ bệnh nhân cho danh mục quản trị"""
    id: int
    nguoi_dung_id: int
    ma_dinh_danh_y_te: str
    ho_ten: str
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    cccd_so: Optional[str] = None
    ngay_sinh: Optional[date] = None
    gioi_tinh: Optional[str] = None
    nhom_mau: Optional[str] = None
    diem_tin_nhiem: int
    so_lan_no_show: int
    is_blocked_booking: bool
    tong_so_lich_kham: int = 0


class PatientAppointmentBrief(BaseModel):
    id: int
    ma_lich_kham: str
    ngay_kham: date
    gio_kham: time
    ten_bac_si: str
    ten_chuyen_khoa: str
    trang_thai: str


class PatientAdminDetailResponse(BaseModel):
    """Chi tiết hồ sơ bệnh án và lịch sử khám của bệnh nhân"""
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
    diem_tin_nhiem: int
    so_lan_no_show: int
    is_blocked_booking: bool
    lich_su_dat_kham: List[PatientAppointmentBrief] = []


class PatientStatusUpdateRequest(BaseModel):
    """Cập nhật quyền đặt lịch hoặc điều chỉnh điểm tín nhiệm bệnh nhân"""
    is_blocked_booking: Optional[bool] = None
    diem_tin_nhiem: Optional[int] = Field(None, ge=0, le=100)
    ghi_chu_quan_tri: Optional[str] = None
