from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class CheckInRequest(BaseModel):
    """Yêu cầu Check-in tại quầy lễ tân cho bệnh nhân có hẹn trước (Bahmni Queue Check-in)"""
    lich_kham_id: int = Field(..., description="ID của lịch hẹn cần check-in")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú tiếp đón của lễ tân")


class WalkInCheckInRequest(BaseModel):
    """Yêu cầu cấp số thứ tự khám cho bệnh nhân vãng lai không đặt hẹn trước"""
    benh_nhan_id: int = Field(..., description="ID bệnh nhân tại phòng khám")
    bac_si_id: int = Field(..., description="ID bác sĩ tiếp nhận khám")
    ca_kham: Literal["sang", "chieu"] = Field("sang", description="Ca khám: 'sang' hoặc 'chieu'")
    ly_do_kham: Optional[str] = Field(None, max_length=255, description="Lý do đến khám vãng lai")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú lễ tân")


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
    loai_hang_doi: str
    muc_do_uu_tien: int
    trang_thai: str
    thoi_gian_check_in: datetime
    thoi_gian_goi_kham: Optional[datetime] = None
    thoi_gian_bat_dau: Optional[datetime] = None
    thoi_gian_ket_thuc: Optional[datetime] = None
    so_lan_goi: int
    ghi_chu_dieu_phoi: Optional[str] = None
    gio_hen_du_kien: Optional[str] = Field(None, description="Giờ hẹn khám ban đầu (HH:MM) theo chuẩn OpenEMR Flow Board")
    thoi_gian_cho_phut: int = Field(0, description="Tổng thời gian chờ từ lúc check-in đến thời điểm hiện tại (phút)")
    thoi_gian_o_trang_thai_phut: int = Field(0, description="Thời gian đã ở trong trạng thái hiện tại (phút)")


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
    bac_si_id: int = Field(..., description="Bác sĩ tiếp nhận khám")
    ca_kham: Literal["sang", "chieu"] = Field("sang", description="Ca khám")
    ly_do_kham: Optional[str] = Field("Khám bệnh vãng lai", max_length=255)
