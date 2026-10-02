from datetime import date, datetime, time
from typing import Annotated, Literal, Optional, List
from pydantic import AfterValidator, BaseModel, Field, StringConstraints


def _ensure_clinic_local_time(value: time) -> time:
    """Giờ khám luôn là giờ địa phương của phòng khám (naive); giờ kèm múi giờ (VD 09:00+07:00)
    không so sánh được với clinic_now() và không bao giờ khớp slot nên bị từ chối (422)"""
    if value.tzinfo is not None:
        raise ValueError("Giờ khám không được kèm múi giờ, vui lòng gửi theo giờ phòng khám (HH:MM:SS)")
    return value


ClinicLocalTime = Annotated[time, AfterValidator(_ensure_clinic_local_time)]


class TimeSlotResponse(BaseModel):
    """Thông tin 1 khung giờ khám 30 phút"""
    time_str: str = Field(..., description="Thời gian khung giờ (VD: '08:00', '08:30')")
    time_val: time = Field(..., description="Đối tượng thời gian time")
    status: str = Field(..., description="'available' (còn trống), 'booked' (đã đặt), 'past' (đã qua)")


class DoctorScheduleSlotsResponse(BaseModel):
    """Danh sách khung giờ khám của bác sĩ trong 1 ngày cụ thể (UC-B02)"""
    doctor_id: int
    doctor_name: str
    specialty_name: str
    date: date
    slots: List[TimeSlotResponse]


class AppointmentCreateRequest(BaseModel):
    """Dữ liệu yêu cầu đặt lịch khám trực tuyến (UC-B03)"""
    bac_si_id: int = Field(..., description="Mã bác sĩ muốn khám")
    ngay_kham: date = Field(..., description="Ngày hẹn khám (YYYY-MM-DD)")
    gio_kham: ClinicLocalTime = Field(..., description="Khung giờ khám được chọn (HH:MM:SS)")
    ly_do_kham: Optional[str] = Field(None, max_length=255, description="Lý do khám bệnh sơ bộ")
    trieu_chung_ban_dau: Optional[str] = Field(None, description="Triệu chứng người bệnh tự nhập hoặc từ gợi ý AI")


class AppointmentCancelRequest(BaseModel):
    """Yêu cầu hủy lịch hẹn khám (UC-B05)"""
    # Cắt khoảng trắng trước khi kiểm tra độ dài để chặn lý do toàn dấu cách
    ly_do_huy: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=255)] = Field(
        ..., description="Lý do hủy lịch khám"
    )


class AppointmentCancelResponse(BaseModel):
    """Kết quả hủy lịch hẹn khám (UC-B05)"""
    appointment_id: int
    ma_lich_kham: str
    trang_thai: str
    ly_do_huy: str
    thoi_gian_huy: datetime
    nguoi_huy_vai_tro: str = Field(..., description="Vai trò người hủy: benh_nhan, bac_si, admin")


class AppointmentRescheduleRequest(BaseModel):
    """Yêu cầu đổi sang khung giờ hoặc ngày khám mới (UC-B05)"""
    ngay_kham_moi: date = Field(..., description="Ngày khám mới")
    gio_kham_moi: ClinicLocalTime = Field(..., description="Giờ khám mới")


class DoctorBriefResponse(BaseModel):
    id: int
    ho_ten: str
    chuyen_khoa: str
    hoc_vi: Optional[str] = None


class PatientBriefResponse(BaseModel):
    id: int
    ho_ten: str
    so_dien_thoai: Optional[str] = None


class AppointmentResponse(BaseModel):
    """Thông tin chi tiết lịch hẹn khám trả về"""
    id: int
    ma_lich_kham: str
    ngay_kham: date
    gio_kham: time
    so_thu_tu: int
    trang_thai: str
    ly_do_kham: Optional[str] = None
    trieu_chung_ban_dau: Optional[str] = None
    bac_si: DoctorBriefResponse
    benh_nhan: PatientBriefResponse


class AppointmentConfirmResponse(BaseModel):
    """Kết quả xác nhận lịch hẹn trước 24h"""
    appointment_id: int
    ma_lich_kham: str
    trang_thai: str
    is_reconfirmed_24h: bool
    thoi_gian_xac_nhan: datetime
    message: str


class NoShowMarkRequest(BaseModel):
    """Yêu cầu đánh dấu bệnh nhân vắng mặt (No-show)"""
    ghi_chu: Optional[str] = Field(None, max_length=255, description="Ghi chú về việc vắng mặt của bệnh nhân")


class NoShowMarkResponse(BaseModel):
    """Kết quả đánh dấu No-show và cảnh báo vi phạm"""
    appointment_id: int
    ma_lich_kham: str
    trang_thai: str
    benh_nhan_id: int
    so_lan_no_show: int
    canh_bao_khoa_tai_khoan: bool


class WaitlistCreateRequest(BaseModel):
    """Dữ liệu đăng ký vào danh sách chờ khám khi ca làm việc hết slot (OpenMRS Waitlist)"""
    bac_si_id: int = Field(..., description="ID bác sĩ muốn đăng ký chờ")
    ngay_mong_muon: date = Field(..., description="Ngày mong muốn khám (YYYY-MM-DD)")
    # Chỉ nhận đúng 2 ca làm việc: giá trị khác không bao giờ được đôn slot (_promote_waitlist_candidate chỉ tìm sang/chieu)
    ca_mong_muon: Literal["sang", "chieu"] = Field("sang", description="Ca khám mong muốn: 'sang' hoặc 'chieu'")
    trieu_chung: Optional[str] = Field(None, max_length=500, description="Mô tả triệu chứng hoặc lý do khám")


class WaitlistResponse(BaseModel):
    """Thông tin vị trí trong danh sách chờ khám"""
    id: int
    benh_nhan_id: int
    bac_si_id: int
    bac_si_ho_ten: Optional[str] = None
    chuyen_khoa: Optional[str] = None
    ngay_mong_muon: date
    ca_mong_muon: str
    trieu_chung: Optional[str] = None
    thu_tu_uu_tien: int
    trang_thai: str
    thoi_gian_thong_bao: Optional[datetime] = None
    thoi_gian_het_han_giu_slot: Optional[datetime] = None
    slot_duoc_cap_id: Optional[int] = None
    created_at: Optional[datetime] = None


class AutoProcessNoShowResponse(BaseModel):
    """Kết quả quét tự động giải phóng slot và đôn danh sách chờ"""
    so_lich_tu_dong_huy: int
    so_nguoi_don_waitlist: int
    danh_sach_ma_lich_huy: List[str]

