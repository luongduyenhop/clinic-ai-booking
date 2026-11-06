from datetime import date, datetime

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator



from app.models.appointment import LyDoUuTienEnum





class CheckInRequest(BaseModel):

    """Yêu cầu Check-in tại quầy lễ tân cho bệnh nhân có hẹn trước (Bahmni Queue Check-in)"""

    lich_kham_id: int = Field(..., description="ID của lịch hẹn cần check-in")

    ghi_chu: Optional[str] = Field(None, description="Ghi chú tiếp đón của lễ tân")

    ly_do_uu_tien: Optional[LyDoUuTienEnum] = Field(None, description="Lý do ưu tiên đặc biệt nếu bệnh nhân thuộc diện ưu tiên (cấp cứu nhẹ, người già >=80, thai phụ...)")





class WalkInCheckInRequest(BaseModel):
    """Yêu cầu cấp số thứ tự khám cho bệnh nhân vãng lai (hỗ trợ cả bệnh nhân đã có ID hoặc nhập nhanh Họ tên + SĐT)"""
    benh_nhan_id: Optional[int] = Field(None, description="ID bệnh nhân tại phòng khám (nếu đã có hồ sơ)")
    ho_ten: Optional[str] = Field(None, min_length=2, max_length=150, description="Họ và tên bệnh nhân (nếu chưa có ID)")
    so_dien_thoai: Optional[str] = Field(None, pattern=r"^[0-9]{10,11}$", description="Số điện thoại (nếu chưa có ID)")
    gioi_tinh: Optional[str] = Field("Khác", description="Nam, Nữ hoặc Khác")
    nam_sinh: Optional[int] = Field(None, ge=1900, le=2026, description="Năm sinh")
    bac_si_id: Optional[int] = Field(None, description="ID bác sĩ tiếp nhận khám (None nếu muốn hệ thống tự cân bằng tải theo chuyên khoa)")
    chuyen_khoa_id: Optional[int] = Field(None, description="ID chuyên khoa khám (Bắt buộc nếu bac_si_id = None)")
    ca_kham: Literal["sang", "chieu"] = Field("sang", description="Ca khám: 'sang' hoặc 'chieu'")
    ly_do_kham: Optional[str] = Field(None, max_length=255, description="Lý do đến khám vãng lai")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú lễ tân")
    ly_do_uu_tien: Optional[LyDoUuTienEnum] = Field(None, description="Lý do ưu tiên đặc biệt nếu có")
    dang_ky_waitlist_neu_het_cho: bool = Field(False, description="Tự động ghi danh vào Danh sách chờ (Waitlist) nếu ca khám đã hết lượt/kín chỗ")

    @model_validator(mode="after")
    def validate_patient_identity(self):
        if not self.benh_nhan_id and not (self.ho_ten and self.so_dien_thoai):
            raise ValueError("Vui lòng cung cấp ID bệnh nhân hoặc nhập đầy đủ Họ tên và Số điện thoại!")
        return self


class QueueTicketResponse(BaseModel):

    """Thông tin phiếu số thứ tự hàng đợi phòng khám (Queue Ticket)"""

    model_config = ConfigDict(from_attributes=True)



    id: int

    lich_kham_id: Optional[int] = None

    benh_nhan_id: int

    ten_benh_nhan: Optional[str] = None

    so_dien_thoai: Optional[str] = None

    bac_si_id: int

    ten_bac_si: Optional[str] = None

    phong_kham: Optional[str] = None

    phong_kham_id: Optional[int] = None

    chuyen_khoa_id: Optional[int] = None

    ten_chuyen_khoa: Optional[str] = None

    ngay_kham: date

    ca_kham: str

    so_thu_tu_kham: int

    ma_so_thu_tu: Optional[str] = Field(None, description="Mã số thứ tự khám định dạng buồng khám / chuyên khoa (ví dụ: NOI-01, TMH-02, RHM-01)")

    loai_hang_doi: str

    muc_do_uu_tien: int

    trang_thai: str

    thoi_gian_check_in: datetime

    thoi_gian_xep_hang_lai: Optional[datetime] = None

    thoi_gian_goi_kham: Optional[datetime] = None

    thoi_gian_bat_dau: Optional[datetime] = None

    thoi_gian_ket_thuc: Optional[datetime] = None

    so_lan_goi: int

    ghi_chu_dieu_phoi: Optional[str] = None

    gio_hen_du_kien: Optional[str] = Field(None, description="Giờ hẹn khám ban đầu (HH:MM) theo chuẩn OpenEMR Flow Board")

    thoi_gian_cho_phut: int = Field(0, description="Tổng thời gian chờ từ lúc check-in đến thời điểm hiện tại (phút)")

    thoi_gian_o_trang_thai_phut: int = Field(0, description="Thời gian đã ở trong trạng thái hiện tại (phút)")
    is_waitlist: bool = Field(False, description="Phiếu này có phải là đăng ký Danh sách chờ do ca kín chỗ hay không")
    waitlist_id: Optional[int] = Field(None, description="ID bản ghi trong danh_sach_cho nếu là Waitlist")
    thu_tu_waitlist: Optional[int] = Field(None, description="Số thứ tự ưu tiên trong danh sách chờ")
    thong_bao_waitlist: Optional[str] = Field(None, description="Thông điệp hướng dẫn khi vào danh sách chờ")





class CloseTicketRequest(BaseModel):

    """Yêu cầu đóng vé hàng đợi từ lễ tân (hành chính hoặc bệnh nhân xin về)"""

    ly_do: Optional[str] = Field(None, max_length=255, description="Lý do đóng vé")







class PostponeTicketRequest(BaseModel):
    """Yêu cầu tạm hoãn lượt khám"""
    ly_do: Optional[str] = Field(None, max_length=255, description="Lý do tạm hoãn lượt khám")


class TransferTicketRequest(BaseModel):

    """Yêu cầu điều chuyển buồng khám / bác sĩ tiếp nhận cho một lượt khám trong hàng đợi"""

    phong_kham_id: int = Field(..., description="ID buồng khám đích cần chuyển đến")

    bac_si_id: Optional[int] = Field(None, description="ID bác sĩ tiếp nhận mới (nếu có)")

    ly_do: str = Field(..., min_length=1, max_length=255, description="Lý do điều chuyển buồng khám")





class CloseTicketResponse(BaseModel):

    """Phản hồi sau khi đóng vé khám"""

    ticket_id: int

    trang_thai: str

    ghi_chu_dieu_phoi: Optional[str] = None

    thoi_gian_dong: datetime





class CallNextResponse(BaseModel):

    """Kết quả gọi bệnh nhân tiếp theo vào phòng khám"""

    message: str

    ticket: Optional[QueueTicketResponse] = None

    so_nguoi_con_lai: int





class DoctorQueueBoardResponse(BaseModel):

    """Bảng hiển thị trạng thái hàng đợi phòng khám theo thời gian thực (Real-time Queue Board)"""

    bac_si_id: int

    ten_bac_si: str

    phong_kham: Optional[str] = None

    phong_kham_id: Optional[int] = None

    chuyen_khoa_id: Optional[int] = None

    ten_chuyen_khoa: Optional[str] = None

    ngay_kham: date

    ca_kham: str

    tong_so_tiep_nhan: int

    so_nguoi_dang_cho: int

    benh_nhan_dang_kham: Optional[QueueTicketResponse] = None

    danh_sach_cho_kham: List[QueueTicketResponse] = []

    danh_sach_tam_hoan: List[QueueTicketResponse] = []

    danh_sach_da_kham: List[QueueTicketResponse] = []

    danh_sach_tat_ca: List[QueueTicketResponse] = []





class PatientFlowBoardItem(BaseModel):

    """Một dòng theo dõi trong bảng Patient Flow Board (Chuẩn OpenEMR)"""

    ticket_id: int

    lich_kham_id: Optional[int] = None

    benh_nhan_id: int

    ten_benh_nhan: str

    so_dien_thoai: Optional[str] = None

    bac_si_id: int

    ten_bac_si: str

    phong_kham: Optional[str] = None

    ngay_kham: date

    ca_kham: str

    so_thu_tu_kham: int

    ma_so_thu_tu: Optional[str] = Field(None, description="Mã số thứ tự khám định dạng buồng khám / chuyên khoa (ví dụ: NOI-01, TMH-02, RHM-01)")

    loai_hang_doi: str

    muc_do_uu_tien: int

    trang_thai: str

    gio_hen_du_kien: Optional[str] = None

    thoi_gian_check_in: datetime

    thoi_gian_cho_phut: int

    thoi_gian_o_trang_thai_phut: int

    so_lan_goi: int

    ghi_chu: Optional[str] = None





class PatientFlowBoardResponse(BaseModel):

    """Bảng theo dõi luân chuyển người bệnh theo thời gian thực (OpenEMR Patient Flow Board)"""

    ngay_theo_doi: date

    tong_so_tiep_nhan: int

    so_dang_cho: int

    so_dang_kham: int

    so_tam_hoan: int

    so_hoan_thanh: int

    danh_sach: List[PatientFlowBoardItem] = []





class AppointmentReceptionSearchResult(BaseModel):

    """Kết quả tìm kiếm lịch hẹn tại quầy tiếp đón"""

    id: int

    ma_lich_kham: str

    benh_nhan_id: Optional[int] = None

    ten_benh_nhan: str

    so_dien_thoai: Optional[str] = None

    bac_si_id: int

    ten_bac_si: str

    chuyen_khoa: str

    phong_kham: Optional[str] = None

    ngay_kham: date

    gio_kham: str

    trang_thai: str

    da_check_in: bool = False

    so_thu_tu_kham: Optional[int] = None

    ticket_id: Optional[int] = None





# Alias tương thích ngược cho các test cũ (Đã gộp endpoint vào WalkInCheckInRequest)
WalkInQuickRequest = WalkInCheckInRequest





class HourlyCheckInDensityItem(BaseModel):
    """Mật độ check-in theo khung giờ (FC-10)"""
    khung_gio: str
    so_luong: int = 0


class UpcomingAppointmentSummaryItem(BaseModel):
    """Lịch hẹn sắp đến trong ngày góc nhìn Dashboard (FC-10)"""
    id: int
    ma_lich_kham: str
    benh_nhan_id: int
    ten_benh_nhan: str
    so_dien_thoai: Optional[str] = None
    gio_kham: str
    ten_chuyen_khoa: Optional[str] = None
    ten_bac_si: Optional[str] = None
    trang_thai: str


class LongWaitingTicketItem(BaseModel):
    """Vé khám có thời gian chờ lâu trong hàng đợi (FC-10)"""
    ticket_id: int
    ma_so_thu_tu: str
    benh_nhan_id: int
    ten_benh_nhan: str
    so_dien_thoai: Optional[str] = None
    ten_phong: Optional[str] = None
    ma_phong: Optional[str] = None
    thoi_gian_check_in: str
    thoi_gian_cho_phut: int
    muc_do_uu_tien: int = 5


class ReceptionActivityItem(BaseModel):
    """Nhật ký thao tác tiếp nhận và điều phối của Lễ tân (FC-10)"""
    id: str
    loai_thao_tac: str
    noi_dung: str
    thoi_gian: str
    nguoi_thuc_hien: str


class ShiftDashboardResponse(BaseModel):
    """Báo cáo metrics vận hành ca trực lễ tân (FC-10)"""
    ngay: date
    ca_kham: str
    tong_hen_truoc: int = 0
    so_da_check_in: int = 0
    so_dang_cho: int = 0
    so_dang_kham: int = 0
    so_da_kham: int = 0
    so_tam_hoan: int = 0
    so_vang_mat_chua_xu_ly: int = 0
    so_vang_lai: int = 0
    so_bo_kham: int = 0
    so_da_dong_ve: int = 0

    # Alias fields đồng bộ 100% với Frontend React
    da_check_in: int = 0
    dang_cho_kham: int = 0
    dang_kham: int = 0
    da_kham: int = 0
    vang_mat: int = 0
    bo_kham: int = 0
    vang_lai: int = 0

    # Trực quan hóa và Dữ liệu chi tiết cho Dashboard
    mat_do_theo_gio: List[HourlyCheckInDensityItem] = []
    lich_hen_sap_toi: List[UpcomingAppointmentSummaryItem] = []
    benh_nhan_cho_lau: List[LongWaitingTicketItem] = []
    hoat_dong_gan_day: List[ReceptionActivityItem] = []


class RoomStatusItem(BaseModel):

    """Giám sát tình trạng buồng khám vật lý thời gian thực (FC-11)"""

    phong_kham_id: int

    ma_phong: str

    ten_phong: str

    tang: str

    bac_si_id: Optional[int] = None

    ten_bac_si: Optional[str] = None

    chuyen_khoa: Optional[str] = None

    so_benh_nhan_cho: int = 0

    benh_nhan_dang_kham: Optional[str] = None

    canh_bao_qua_tai: bool = False





class RoomStatusDashboardResponse(BaseModel):

    ngay: date

    ca_kham: str

    tong_so_phong: int

    danh_sach: List[RoomStatusItem] = []





class ReceptionAppointmentItem(BaseModel):

    """Một dòng lịch hẹn góc nhìn Lễ tân (FC-12)"""

    id: int

    ma_lich_kham: str

    benh_nhan_id: int

    ten_benh_nhan: str

    so_dien_thoai: Optional[str] = None

    bac_si_id: Optional[int] = None

    ten_bac_si: Optional[str] = None

    chuyen_khoa_id: Optional[int] = None

    ten_chuyen_khoa: Optional[str] = None

    phong_kham: Optional[str] = None

    ngay_kham: date

    gio_kham: Optional[str] = None

    ca_kham: Optional[str] = None

    trang_thai_lich: str

    trang_thai_hang_doi: Optional[str] = None

    so_thu_tu_kham: Optional[int] = None

    ticket_id: Optional[int] = None





class ReceptionAppointmentsResponse(BaseModel):

    total: int

    page: int

    page_size: int

    items: List[ReceptionAppointmentItem] = []





class RosterItem(BaseModel):

    """Lịch trực bác sĩ trong ngày (FC-15)"""

    lich_lam_viec_id: int

    bac_si_id: int

    ten_bac_si: str

    chuyen_khoa: str

    chuyen_khoa_id: Optional[int] = None

    phong_kham_id: Optional[int] = None

    ten_phong: Optional[str] = None

    ma_phong: Optional[str] = None

    ngay_lam_viec: date

    ca_lam_viec: str

    gio_bat_dau: str

    gio_ket_thuc: str

    is_active: bool

    so_luot_da_nhan: int = 0

    gioi_han_ca_kham: int = 30





class RoomResourceItem(BaseModel):

    """Thông tin buồng khám vật lý (FC-15)"""

    id: int

    ma_phong: str

    ten_phong: str

    chuyen_khoa_id: Optional[int] = None

    ten_chuyen_khoa: Optional[str] = None

    tang: str

    loai_phong: str

    is_active: bool





class RosterTemplateItem(BaseModel):

    """Khuôn mẫu phân ca trực định kỳ (FC-15)"""

    id: int

    bac_si_id: int

    ten_bac_si: str

    thu_trong_tuan: int

    ca_lam_viec: str

    gio_bat_dau: str

    gio_ket_thuc: str

    phong_kham: Optional[str] = None

    is_active: bool





class PatientPackageItem(BaseModel):

    """Thông tin gói khám bệnh nhân đã mua (FC-17)"""

    id: int

    ma_dang_ky: str

    ten_goi: str

    ma_goi: str

    ngay_dang_ky: date

    han_su_dung: date

    tong_so_dich_vu: int

    so_dich_vu_da_dung: int

    so_dich_vu_con_lai: int

    trang_thai: str

    is_con_han: bool





class PatientPastVisitItem(BaseModel):

    """Lịch sử lượt khám trước đây (FC-17)"""

    ngay_kham: date

    bac_si: Optional[str] = None

    chuyen_khoa: Optional[str] = None

    chan_doan: Optional[str] = None

    trang_thai: str





class PatientHistorySummaryResponse(BaseModel):

    """Tóm tắt lịch sử khám & gói dịch vụ phục vụ tiếp đón tại quầy (FC-17)"""

    benh_nhan_id: int

    ma_dinh_danh_y_te: str

    ho_ten: str

    so_dien_thoai: Optional[str] = None

    so_lan_no_show: int = 0

    is_blocked_booking: bool = False

    so_lan_kham: int = 0

    lich_su_kham_gan_day: List[PatientPastVisitItem] = []

    goi_kham_hien_co: List[PatientPackageItem] = []





class ProcessNoShowResponse(BaseModel):

    """Kết quả quét và xử lý bệnh nhân vắng mặt no-show cuối ca (FC-18)"""

    ngay: date

    ca_kham: Optional[str] = None

    tong_so_no_show: int

    danh_sach_ma_lich: List[str] = []

    so_benh_nhan_bi_khoa_moi: int = 0

class ReceptionWaitlistItem(BaseModel):
    """Một dòng người bệnh trong Danh sách chờ của phòng khám (Waitlist Item)"""
    id: int
    benh_nhan_id: int
    ten_benh_nhan: str
    so_dien_thoai: Optional[str] = None
    gioi_tinh: Optional[str] = None
    nam_sinh: Optional[int] = None
    bac_si_id: Optional[int] = None
    ten_bac_si: Optional[str] = None
    phong_kham_id: Optional[int] = None
    ten_phong: Optional[str] = None
    chuyen_khoa_id: Optional[int] = None
    ten_chuyen_khoa: Optional[str] = None
    ngay_mong_muon: date
    ca_mong_muon: str
    trieu_chung: Optional[str] = None
    thu_tu_uu_tien: int
    trang_thai: str
    thoi_gian_dang_ky: datetime
    thoi_gian_thong_bao: Optional[datetime] = None
    thoi_gian_het_han_giu_slot: Optional[datetime] = None
    con_han_giu_slot: bool = False
    co_bac_si_chi_dinh: bool = False


class ReceptionWaitlistResponse(BaseModel):
    total: int
    items: List[ReceptionWaitlistItem] = []


# ============================================================================
# Phân hệ 9: Báo cáo đối soát & Nhật ký kiểm toán (Reports & Audit Trail)
# ============================================================================

class ReceptionReportKpiItem(BaseModel):
    tong_luot_tiep_nhan: int = 0
    so_lich_hen: int = 0
    so_vang_lai: int = 0
    thoi_gian_cho_trung_binh_phut: float = 0.0
    so_lich_huy: int = 0
    so_no_show: int = 0


class DepartmentDistributionItem(BaseModel):
    chuyen_khoa_id: Optional[int] = None
    ma_chuyen_khoa: Optional[str] = None
    ten_chuyen_khoa: str
    so_luot: int = 0
    ti_le_phan_tram: float = 0.0
    thoi_gian_cho_tb_phut: float = 0.0


class ReceptionReportSummaryResponse(BaseModel):
    ngay: date
    ca_kham: Optional[str] = None
    kpi: ReceptionReportKpiItem
    phan_bo_chuyen_khoa: List[DepartmentDistributionItem] = []


class ReceptionAuditLogItem(BaseModel):
    id: str
    timestamp: str
    actor: str
    action_type: str
    ticket_number: Optional[str] = None
    patient_name: Optional[str] = None
    phone: Optional[str] = None
    room_name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ReceptionAuditLogPagination(BaseModel):
    page: int
    page_size: int
    pageSize: int
    total_items: int
    totalItems: int
    total_pages: int
    totalPages: int
    has_next: bool
    hasNext: bool
    has_prev: bool
    hasPrev: bool


class ReceptionAuditLogResponse(BaseModel):
    items: List[ReceptionAuditLogItem] = []
    pagination: ReceptionAuditLogPagination


# ============================================================================
# Quản lý Đóng & Bàn giao Ca trực Lễ tân (Reception Shift Close & Handover)
# ============================================================================

class PreCloseAuditWarningSummary(BaseModel):
    so_dang_kham: int = 0
    so_cho_kham_chua_kham: int = 0
    so_tam_hoan: int = 0
    so_lich_hen_no_show: int = 0
    so_waitlist_ton: int = 0
    thu_ngan_da_khoa_so: bool = False
    tien_mat_da_thu: float = 0.0


class PreCloseExaminingDetailItem(BaseModel):
    ticket_id: int
    ticket_code: str
    ten_benh_nhan: str
    bac_si_id: int
    ten_bac_si: str
    phong_kham: str
    gio_vao_kham: str


class PreCloseWaitingDetailItem(BaseModel):
    ticket_id: int
    ticket_code: str
    ten_benh_nhan: str
    loai_hang_doi: str
    bac_si_id: Optional[int] = None
    ten_bac_si: str
    phong_kham: str
    thoi_gian_cho_phut: int


class PreCloseDeferredDetailItem(BaseModel):
    ticket_id: int
    ticket_code: str
    ten_benh_nhan: str
    so_lan_goi: int
    ten_bac_si: str
    phong_kham: str


class PreCloseNoShowDetailItem(BaseModel):
    lich_kham_id: int
    ma_lich_kham: str
    ten_benh_nhan: str
    so_dien_thoai: Optional[str] = None
    gio_kham: str
    ten_bac_si: str


class PreCloseWaitlistDetailItem(BaseModel):
    waitlist_id: int
    ten_benh_nhan: str
    so_dien_thoai: Optional[str] = None
    ten_bac_si_mong_muon: str
    thu_tu_uu_tien: int


class PreCloseCashierAuditDetail(BaseModel):
    da_khoa_so: bool = False
    ma_khoa_so: Optional[str] = None
    thu_ngan_chot: Optional[str] = None
    tong_tien_mat: float = 0.0
    tong_chuyen_khoan: float = 0.0


class PreCloseAuditDetailGroup(BaseModel):
    dang_kham: List[PreCloseExaminingDetailItem] = []
    cho_kham: List[PreCloseWaitingDetailItem] = []
    tam_hoan: List[PreCloseDeferredDetailItem] = []
    lich_hen_no_show: List[PreCloseNoShowDetailItem] = []
    waitlist_ton: List[PreCloseWaitlistDetailItem] = []
    doi_chieu_thu_ngan: PreCloseCashierAuditDetail


class PreCloseActionRecommendation(BaseModel):
    loai_ca: str
    de_xuat_xu_ly_cho_kham: str
    tu_dong_chot_no_show: bool = True
    ghi_chu_canh_bao: Optional[str] = None


class PreCloseShiftAuditResponse(BaseModel):
    ngay: date
    ca_kham: str
    canh_bao: PreCloseAuditWarningSummary
    chi_tiet: PreCloseAuditDetailGroup
    de_xuat_hanh_dong: PreCloseActionRecommendation


class CloseReceptionShiftRequest(BaseModel):
    ca_kham: str = Field(..., description="Ca khám cần đóng: 'sang' hoặc 'chieu'")
    ngay: Optional[date] = Field(None, description="Ngày đóng ca (mặc định hôm nay)")
    xu_ly_cho_kham: Literal["CHUYEN_CA_TIEP_THEO", "DONG_VE"] = Field(
        "CHUYEN_CA_TIEP_THEO",
        description="Hình thức xử lý vé đang chờ: 'CHUYEN_CA_TIEP_THEO' (chuyển ca chiều) hoặc 'DONG_VE' (đóng vé cuối ngày)"
    )
    tu_dong_chot_no_show: bool = Field(True, description="Tự động chuyển các lịch hẹn quá giờ sang NO_SHOW")
    ghi_chu_ban_giao: Optional[str] = Field(None, description="Ghi chú nội dung bàn giao ca trực")
    nguoi_nhan_ban_giao_id: Optional[int] = Field(None, description="ID của nhân viên Lễ tân nhận ca tiếp theo")


class CloseReceptionShiftResponse(BaseModel):
    ca_kham_dong: str
    ngay: date
    so_ve_chuyen_ca_chieu: int = 0
    so_ve_dong: int = 0
    so_lich_chot_no_show: int = 0
    nguoi_dong_ca: str
    nguoi_nhan_ban_giao: Optional[str] = None
    thoi_gian_dong_ca: datetime
    ghi_chu_ban_giao: Optional[str] = None
