from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.appointment import LyDoUuTienEnum


class CheckInRequest(BaseModel):
    """Yêu cầu Check-in tại quầy lễ tân cho bệnh nhân có hẹn trước (Bahmni Queue Check-in)"""
    lich_kham_id: int = Field(..., description="ID của lịch hẹn cần check-in")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú tiếp đón của lễ tân")
    ly_do_uu_tien: Optional[LyDoUuTienEnum] = Field(None, description="Lý do ưu tiên đặc biệt nếu bệnh nhân thuộc diện ưu tiên (cấp cứu nhẹ, người già >=80, thai phụ...)")


class WalkInCheckInRequest(BaseModel):
    """Yêu cầu cấp số thứ tự khám cho bệnh nhân vãng lai không đặt hẹn trước"""
    benh_nhan_id: int = Field(..., description="ID bệnh nhân tại phòng khám")
    bac_si_id: Optional[int] = Field(None, description="ID bác sĩ tiếp nhận khám (None nếu muốn hệ thống tự cân bằng tải theo chuyên khoa)")
    chuyen_khoa_id: Optional[int] = Field(None, description="ID chuyên khoa khám (Bắt buộc nếu bac_si_id = None)")
    ca_kham: Literal["sang", "chieu"] = Field("sang", description="Ca khám: 'sang' hoặc 'chieu'")
    ly_do_kham: Optional[str] = Field(None, max_length=255, description="Lý do đến khám vãng lai")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú lễ tân")
    ly_do_uu_tien: Optional[LyDoUuTienEnum] = Field(None, description="Lý do ưu tiên đặc biệt nếu có")


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


class CloseTicketRequest(BaseModel):
    """Yêu cầu đóng vé hàng đợi từ lễ tân (hành chính hoặc bệnh nhân xin về)"""
    ly_do: Optional[str] = Field(None, max_length=255, description="Lý do đóng vé")


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
    ngay_kham: date
    ca_kham: str
    tong_so_tiep_nhan: int
    so_nguoi_dang_cho: int
    benh_nhan_dang_kham: Optional[QueueTicketResponse] = None
    danh_sach_cho_kham: List[QueueTicketResponse] = []
    danh_sach_tam_hoan: List[QueueTicketResponse] = []


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


class WalkInQuickRequest(BaseModel):
    """Tiếp nhận trực tiếp bệnh nhân vãng lai (nhập nhanh họ tên, SĐT, chọn bác sĩ/ca)"""
    ho_ten: str = Field(..., min_length=2, max_length=150, description="Họ và tên bệnh nhân")
    so_dien_thoai: str = Field(..., pattern=r"^[0-9]{10,11}$", description="Số điện thoại")
    gioi_tinh: Optional[str] = Field("Khác", description="Nam, Nữ hoặc Khác")
    nam_sinh: Optional[int] = Field(None, ge=1900, le=2026, description="Năm sinh")
    bac_si_id: Optional[int] = Field(None, description="Bác sĩ tiếp nhận khám (None nếu tự phân bổ theo chuyên khoa)")
    chuyen_khoa_id: Optional[int] = Field(None, description="Chuyên khoa khám (Bắt buộc nếu bac_si_id = None)")
    ca_kham: Literal["sang", "chieu"] = Field("sang", description="Ca khám")
    ly_do_kham: Optional[str] = Field("Khám bệnh vãng lai", max_length=255)
    ly_do_uu_tien: Optional[LyDoUuTienEnum] = Field(None, description="Lý do ưu tiên đặc biệt nếu có")
    nguoi_lien_he: Optional[str] = Field(None, max_length=100, description="Họ tên người liên hệ / thân nhân khẩn cấp")
    sdt_nguoi_lien_he: Optional[str] = Field(None, max_length=20, description="SĐT người liên hệ / thân nhân")


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
    phong_kham_id: Optional[int] = None
    ten_phong: Optional[str] = None
    ngay_lam_viec: date
    ca_lam_viec: str
    gio_bat_dau: str
    gio_ket_thuc: str
    is_active: bool


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

