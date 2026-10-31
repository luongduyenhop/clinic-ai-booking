from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class DoctorAlternativeItem(BaseModel):
    """Thông tin bác sĩ cùng chuyên khoa có thể tiếp nhận thay thế"""
    bac_si_id: int
    ten_bac_si: str
    phong_kham: Optional[str] = None
    so_benh_nhan_cho: int = 0


class DoctorAbsenceIncidentResponse(BaseModel):
    """Sự cố bác sĩ nghỉ phép đột xuất cần lễ tân điều phối"""
    nghi_phep_id: int
    bac_si_id: int
    ten_bac_si: str
    chuyen_khoa_id: Optional[int] = None
    ten_chuyen_khoa: Optional[str] = None
    tu_ngay: date
    den_ngay: date
    ca_lam_viec: Optional[str] = None
    ly_do: str
    trang_thai: str
    so_benh_nhan_cho: int = 0
    danh_sach_bac_si_thay_the: List[DoctorAlternativeItem] = []


class RebalanceQueueRequest(BaseModel):
    """Yêu cầu điều phối / chuyển bệnh nhân từ bác sĩ vắng sang bác sĩ khác"""
    nghi_phep_bac_si_id: int = Field(..., description="ID đơn nghỉ phép đột xuất cần xử lý")
    ticket_ids: Optional[List[int]] = Field(None, description="Danh sách vé cần chuyển (None nếu muốn chuyển toàn bộ vé đang chờ)")
    bac_si_nhan_id: Optional[int] = Field(None, description="ID bác sĩ tiếp nhận (None nếu để hệ thống tự cân bằng tải)")


class RebalanceTicketItem(BaseModel):
    old_ticket_id: int
    new_ticket_id: int
    benh_nhan_id: int
    ten_benh_nhan: str
    bac_si_giao_id: int
    bac_si_nhan_id: int
    ten_bac_si_nhan: str
    so_thu_tu_moi: int


class RebalanceQueueResponse(BaseModel):
    ok: bool
    nghi_phep_bac_si_id: int
    so_ve_chuyen: int
    chi_tiet: List[RebalanceTicketItem] = []
