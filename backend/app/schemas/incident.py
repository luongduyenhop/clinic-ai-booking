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


class SingleTicketAssignment(BaseModel):
    """Chỉ định chuyển lẻ từng vé sang bác sĩ cụ thể"""
    ticket_id: int = Field(..., description="ID vé hàng đợi cần chuyển")
    bac_si_nhan_id: Optional[int] = Field(None, description="ID bác sĩ tiếp nhận cho vé này (None: để hệ thống tự cân bằng tải)")


class RebalanceQueueRequest(BaseModel):
    """Yêu cầu điều phối / chuyển bệnh nhân từ bác sĩ vắng sang bác sĩ khác"""
    nghi_phep_bac_si_id: int = Field(..., description="ID đơn nghỉ phép đột xuất cần xử lý")
    ticket_ids: Optional[List[int]] = Field(None, description="Danh sách vé cần chuyển (None nếu muốn chuyển toàn bộ vé đang chờ)")
    bac_si_nhan_id: Optional[int] = Field(None, description="ID bác sĩ tiếp nhận chung (None nếu để hệ thống tự cân bằng tải)")
    assignments: Optional[List[SingleTicketAssignment]] = Field(
        None,
        description="Danh sách chỉ định chuyển lẻ chi tiết cho từng vé sang bác sĩ tương ứng"
    )


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


class AffectedPatientItem(BaseModel):
    """Thông tin bệnh nhân trong hàng đợi bị ảnh hưởng bởi bác sĩ vắng mặt"""
    ticket_id: int
    so_thu_tu_kham: int
    benh_nhan_id: int
    ten_benh_nhan: str
    so_dien_thoai: Optional[str] = None
    muc_do_uu_tien: int = 5
    trang_thai: str
    thoi_gian_check_in: Optional[datetime] = None
    loai_hang_doi: str
    ma_lich_kham: Optional[str] = None
    gio_kham: Optional[str] = None


class AffectedWaitlistItem(BaseModel):
    """Thông tin bệnh nhân trong hàng chờ (waitlist) bị ảnh hưởng"""
    waitlist_id: int
    benh_nhan_id: int
    ten_benh_nhan: str
    so_dien_thoai: Optional[str] = None
    thu_tu_uu_tien: int
    ca_mong_muon: str
    ngay_mong_muon: date


class DoctorAbsenceAffectedPatientsResponse(BaseModel):
    """Danh sách chi tiết toàn bộ bệnh nhân trong hàng đợi & hàng chờ bị ảnh hưởng"""
    nghi_phep_id: int
    bac_si_id: int
    ten_bac_si: str
    ten_chuyen_khoa: Optional[str] = None
    tu_ngay: date
    den_ngay: date
    ca_lam_viec: Optional[str] = None
    tong_so_kẹt: int = 0
    hang_doi: List[AffectedPatientItem] = []
    hang_cho_waitlist: List[AffectedWaitlistItem] = []


class CancelIncidentTicketsRequest(BaseModel):
    """Yêu cầu hủy lượt khám cho các bệnh nhân không muốn chuyển buồng/bác sĩ khi có sự cố"""
    nghi_phep_bac_si_id: int = Field(..., description="ID đơn nghỉ phép đột xuất của bác sĩ")
    ticket_ids: Optional[List[int]] = Field(None, description="Danh sách vé hàng đợi cần hủy")
    waitlist_ids: Optional[List[int]] = Field(None, description="Danh sách lượt hàng chờ (Waitlist) cần hủy")
    ly_do: Optional[str] = Field(
        "Bệnh nhân không đồng ý đổi bác sĩ khi có sự cố bác sĩ nghỉ",
        description="Lý do hủy khám do sự cố"
    )


class CancelIncidentTicketsResponse(BaseModel):
    ok: bool
    so_ve_da_huy: int = 0
    so_waitlist_da_huy: int = 0
    so_lich_kham_da_huy: int = 0
    thong_diep: str
