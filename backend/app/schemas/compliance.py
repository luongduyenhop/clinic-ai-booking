import enum
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DoctorLicenseUpdateRequest(BaseModel):
    """Yêu cầu cập nhật thông tin giấy phép/chứng chỉ hành nghề của bác sĩ"""
    ngay_cap: Optional[datetime] = Field(None, description="Ngày cấp CCHN")
    ngay_het_han: Optional[datetime] = Field(None, description="Ngày hết hạn CCHN")
    pham_vi_chuyen_mon: Optional[List[str]] = Field(None, description="Danh mục chuyên môn/dịch vụ được cấp phép")
    trang_thai_giay_phep: Optional[str] = Field(None, description="Trạng thái giấy phép: ACTIVE, EXPIRING_SOON, EXPIRED, SUSPENDED, REVOKED")
    tep_dinh_kem_url: Optional[str] = Field(None, description="Đường dẫn file đính kèm CCHN")


class DoctorLicenseStatusUpdateRequest(BaseModel):
    """Yêu cầu cập nhật trạng thái giấy phép có lưu vết kiểm toán (Audit History)"""
    trang_thai_moi: str = Field(..., description="Trạng thái mới: ACTIVE, EXPIRING_SOON, EXPIRED, SUSPENDED, REVOKED")
    ly_do: str = Field(..., description="Lý do thay đổi trạng thái (bắt buộc theo chuẩn kiểm toán y tế)")
    ngay_hieu_luc: Optional[datetime] = Field(None, description="Ngày bắt đầu có hiệu lực")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú bổ sung")


class DoctorLicenseResponse(BaseModel):
    """Thông tin chi tiết giấy phép hành nghề của bác sĩ"""
    bac_si_id: int
    ho_ten: Optional[str] = None
    so_cchn: str
    chuyen_khoa: Optional[str] = None
    ngay_cap: Optional[datetime] = None
    ngay_het_han: Optional[datetime] = None
    pham_vi_chuyen_mon: List[str] = []
    trang_thai_giay_phep: str
    tep_dinh_kem_url: Optional[str] = None
    is_active: bool
    days_until_expiry: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class FacilityLicenseCreateRequest(BaseModel):
    """Yêu cầu tạo mới Giấy phép hoạt động cơ sở khám chữa bệnh (GiayPhepCoSo)"""
    so_giay_phep: str = Field(..., description="Số giấy phép hoạt động cơ sở do Sở/Bộ Y tế cấp")
    ten_co_so: str = Field(..., description="Tên cơ sở y tế")
    ngay_cap: datetime = Field(..., description="Ngày cấp giấy phép")
    ngay_het_han: Optional[datetime] = Field(None, description="Ngày hết hạn giấy phép (nếu có)")
    pham_vi_hoat_dong: Optional[str] = Field(None, description="Phạm vi hoạt động chuyên môn")
    trang_thai: Optional[str] = Field("ACTIVE", description="Trạng thái: ACTIVE, EXPIRING_SOON, EXPIRED, SUSPENDED, REVOKED")
    tep_dinh_kem_url: Optional[str] = Field(None, description="Đường dẫn file scan giấy phép")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú")


class FacilityLicenseUpdateRequest(BaseModel):
    """Yêu cầu cập nhật Giấy phép hoạt động cơ sở"""
    ten_co_so: Optional[str] = None
    ngay_cap: Optional[datetime] = None
    ngay_het_han: Optional[datetime] = None
    pham_vi_hoat_dong: Optional[str] = None
    trang_thai: Optional[str] = None
    tep_dinh_kem_url: Optional[str] = None
    ghi_chu: Optional[str] = None


class FacilityLicenseResponse(BaseModel):
    """Phản hồi thông tin Giấy phép hoạt động cơ sở"""
    id: Optional[int] = None
    so_giay_phep: str
    ten_co_so: str
    ngay_cap: datetime
    ngay_het_han: Optional[datetime] = None
    pham_vi_hoat_dong: Optional[str] = None
    trang_thai: str
    tep_dinh_kem_url: Optional[str] = None
    ghi_chu: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LicenseAuditHistoryResponse(BaseModel):
    """Bản ghi lịch sử thay đổi trạng thái giấy phép bác sĩ"""
    id: int
    bac_si_id: int
    bac_si_ho_ten: Optional[str] = None
    trang_thai_cu: Optional[str] = None
    trang_thai_moi: str
    nguoi_thuc_hien_id: Optional[int] = None
    nguoi_thuc_hien_email: Optional[str] = None
    ly_do: str
    ngay_hieu_luc: Optional[datetime] = None
    ghi_chu: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LicenseExpiryAlertItem(BaseModel):
    """Chi tiết bác sĩ có giấy phép sắp hết hạn hoặc đã hết hạn"""
    bac_si_id: int
    ho_ten: str
    so_cchn: str
    chuyen_khoa: Optional[str] = None
    ngay_het_han: Optional[datetime] = None
    days_until_expiry: Optional[int] = None
    trang_thai_giay_phep: str

    model_config = ConfigDict(from_attributes=True)


class LicenseExpiryAlertResponse(BaseModel):
    """Báo cáo tổng hợp cảnh báo hết hạn giấy phép theo các mốc 90, 60, 30 ngày (INT-05)"""
    expiring_90_days: List[LicenseExpiryAlertItem] = []
    expiring_60_days: List[LicenseExpiryAlertItem] = []
    expiring_30_days: List[LicenseExpiryAlertItem] = []
    expired: List[LicenseExpiryAlertItem] = []
    total_alerts: int = 0


# ==============================================================================
# QUẢN LÝ MÁY TRẠNG THÁI ĐƠN THUỐC & CỔNG QUỐC GIA (INT-04 / R3)
# ==============================================================================

class TrangThaiDonThuoc(str, enum.Enum):
    """Máy trạng thái 11 bước của đơn thuốc điện tử theo chuẩn liên thông Cổng Quốc gia BYT"""
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    SIGNED = "SIGNED"
    ISSUED = "ISSUED"
    SUBMISSION_PENDING = "SUBMISSION_PENDING"
    SUBMITTED = "SUBMITTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    RETRY_PENDING = "RETRY_PENDING"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    UNKNOWN_RESULT = "UNKNOWN_RESULT"
    SUPERSEDED = "SUPERSEDED"


class PrescriptionSignRequest(BaseModel):
    """Yêu cầu ký số đơn thuốc điện tử bởi bác sĩ điều trị"""
    chu_ky_so: str = Field(..., description="Dữ liệu chữ ký số hoặc chuỗi xác thực token ký của bác sĩ")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú khi ký số")


class PrescriptionIssueRequest(BaseModel):
    """Yêu cầu ban hành đơn thuốc sau khi đã ký số thành công"""
    ghi_chu: Optional[str] = Field(None, description="Ghi chú ban hành")


class GatewaySubmissionResult(BaseModel):
    """Kết quả liên thông giao dịch với Cổng đơn thuốc quốc gia"""
    status: str = Field(..., description="Trạng thái phản hồi từ Cổng: ACCEPTED, UNKNOWN_RESULT, REJECTED, RETRY_PENDING")
    transaction_receipt: Optional[str] = Field(None, description="Mã biên nhận giao dịch điện tử từ Cổng BYT")
    code: int = Field(..., description="Mã HTTP phản hồi (200, 504, 422, ...)")
    idempotency_key: str = Field(..., description="Khóa định danh chống gửi trùng lặp")
    message: str = Field(..., description="Thông điệp phản hồi từ Cổng")


class PrescriptionGatewaySubmitRequest(BaseModel):
    """Yêu cầu gửi đơn thuốc lên Cổng đơn thuốc quốc gia"""
    facility_code: Optional[str] = Field(None, description="Mã định danh cơ sở khám chữa bệnh do BYT cấp")
    practitioner_code: Optional[str] = Field(None, description="Mã chứng chỉ hành nghề của bác sĩ kê đơn")
    idempotency_key: Optional[str] = Field(None, description="Khóa chống trùng lặp giao dịch (Header Idempotency-Key hoặc Body)")


class PrescriptionGatewayRetryRequest(BaseModel):
    """Yêu cầu gửi lại đơn thuốc khi gặp lỗi timeout hoặc UNKNOWN_RESULT"""
    idempotency_key: Optional[str] = Field(None, description="Khóa idempotency ban đầu để gửi lại không sinh giao dịch mới")


class PrescriptionSupersedeRequest(BaseModel):
    """Yêu cầu thu hồi đơn cũ và tạo đơn thuốc mới thay thế (SUPERSEDED Protocol)"""
    ly_do: str = Field(..., min_length=5, description="Lý do thay thế đơn thuốc (tối thiểu 5 ký tự)")
    loi_dan_uong_thuoc: Optional[str] = Field(None, description="Lời dặn uống thuốc mới cho đơn thay thế")
    ghi_chu_duoc_lam_sang: Optional[str] = Field(None, description="Ghi chú dược lâm sàng mới")
    danh_sach_thuoc: Optional[List[Dict[str, Any]]] = Field(None, description="Danh sách thuốc mới cho đơn thay thế (nếu có cập nhật)")


class PrescriptionSupersedeResponse(BaseModel):
    """Phản hồi sau khi hoàn tất quy trình thay thế đơn thuốc"""
    old_prescription: Dict[str, Any] = Field(..., description="Thông tin đơn thuốc cũ ở trạng thái SUPERSEDED")
    new_prescription: Dict[str, Any] = Field(..., description="Thông tin đơn thuốc mới được tạo ở trạng thái DRAFT")
    message: str = Field("Đã thay thế đơn thuốc thành công", description="Thông điệp kết quả")


# ==============================================================================
# NHẬT KÝ KIỂM TOÁN TRUY CẬP DỮ LIỆU SỨC KHỎE (INT-03 / R4)
# ==============================================================================

class HealthDataAccessLogCreate(BaseModel):
    """Yêu cầu ghi nhận truy cập dữ liệu y tế"""
    patient_id: int = Field(..., description="ID bệnh nhân")
    action: str = Field(..., description="Hành động: VIEW, EDIT, EXPORT, AMEND")
    resource_type: str = Field(..., description="Loại tài nguyên: ENCOUNTER, PRESCRIPTION, PATIENT_HISTORY, DIAGNOSIS")
    resource_id: Optional[int] = Field(None, description="ID tài nguyên cụ thể")
    purpose: str = Field(..., min_length=3, description="Mục đích truy cập (NĐ 102/2025/NĐ-CP): KHAM_BENH, HO_TRO_DUOC, THANH_TRA, TRA_CUU")


class HealthDataAccessLogResponse(BaseModel):
    """Bản ghi kiểm toán truy cập dữ liệu sức khỏe bất biến"""
    id: int
    user_id: int
    user_role: str
    patient_id: int
    action: str
    resource_type: str
    resource_id: Optional[int] = None
    purpose: str
    client_ip: Optional[str] = None
    timestamp: datetime
    is_immutable: bool = True

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# BẢNG ĐIỀU KHIỂN GIÁM SÁT TUÂN THỦ PHÁP LÝ (INT-05 / INT-04 / INT-03 / R5)
# ==============================================================================

class GatewayQueueSummary(BaseModel):
    retry_pending_count: int = 0
    manual_review_count: int = 0
    unknown_result_count: int = 0
    total_attention_required: int = 0


class EMRComplianceSummary(BaseModel):
    total_encounters: int = 0
    locked_encounters: int = 0
    locked_completion_rate: float = 100.0
    pending_amendments: int = 0


class ComplianceDashboardResponse(BaseModel):
    facility_license_status: str = "ACTIVE"
    doctor_licenses_active: int = 0
    doctor_licenses_expiring_soon: int = 0
    doctor_licenses_expired: int = 0
    alerts_90_days: int = 0
    alerts_60_days: int = 0
    alerts_30_days: int = 0
    gateway_queues: GatewayQueueSummary = Field(default_factory=GatewayQueueSummary)
    emr_compliance: EMRComplianceSummary = Field(default_factory=EMRComplianceSummary)
    statutory_compliance_status: str = "COMPLIANT"  # COMPLIANT, ATTENTION_REQUIRED, NON_COMPLIANT
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


