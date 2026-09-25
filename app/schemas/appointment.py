from datetime import date, datetime, time
from typing import Annotated, Optional, List
from pydantic import BaseModel, Field, StringConstraints


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
    gio_kham: time = Field(..., description="Khung giờ khám được chọn (HH:MM:SS)")
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
    gio_kham_moi: time = Field(..., description="Giờ khám mới")


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
