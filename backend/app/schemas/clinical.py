import enum
from datetime import date, datetime
from typing import Annotated, List, Literal, Optional
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints, field_validator


class VitalSignsSchema(BaseModel):
    """Chỉ số sinh hiệu cơ bản (Vital Signs) của người bệnh"""
    mach_lan_phut: Optional[int] = Field(None, ge=30, le=250, description="Mạch (nhịp/phút)")
    nhiet_do_c: Optional[float] = Field(None, ge=30.0, le=45.0, description="Thân nhiệt (°C)")
    huyet_ap_tam_thu: Optional[int] = Field(None, ge=50, le=300, description="Huyết áp tâm thu (mmHg)")
    huyet_ap_tam_truong: Optional[int] = Field(None, ge=30, le=200, description="Huyết áp tâm trương (mmHg)")
    nhip_tho_lan_phut: Optional[int] = Field(None, ge=5, le=80, description="Nhịp thở (lần/phút)")
    can_nang_kg: Optional[float] = Field(None, ge=0.5, le=500.0, description="Cân nặng (kg)")
    chieu_cao_cm: Optional[float] = Field(None, ge=20.0, le=250.0, description="Chiều cao (cm)")


class EncounterCreateRequest(BaseModel):
    """Yêu cầu bắt đầu lượt khám lâm sàng thực tế (OpenMRS Encounter)"""
    lich_kham_id: int = Field(..., description="ID lịch hẹn khám cần tiếp nhận")
    ly_do_vao_kham: Optional[str] = Field(None, description="Lý do vào khám của người bệnh")
    benh_su: Optional[str] = Field(None, description="Bệnh sử / tiền sử bệnh")

    # Chỉ số sinh hiệu (Vital Signs)
    mach_lan_phut: Optional[int] = Field(None, ge=30, le=250, description="Mạch (nhịp/phút)")
    nhiet_do_c: Optional[float] = Field(None, ge=30.0, le=45.0, description="Thân nhiệt (°C)")
    huyet_ap_tam_thu: Optional[int] = Field(None, ge=50, le=300, description="Huyết áp tâm thu (mmHg)")
    huyet_ap_tam_truong: Optional[int] = Field(None, ge=30, le=200, description="Huyết áp tâm trương (mmHg)")
    nhip_tho_lan_phut: Optional[int] = Field(None, ge=5, le=80, description="Nhịp thở (lần/phút)")
    can_nang_kg: Optional[float] = Field(None, ge=0.5, le=500.0, description="Cân nặng (kg)")
    chieu_cao_cm: Optional[float] = Field(None, ge=20.0, le=250.0, description="Chiều cao (cm)")

    kham_lam_sang_bo_phan: Optional[str] = Field(None, description="Khám lâm sàng các cơ quan/bộ phận")


class DiagnosisCreateRequest(BaseModel):
    """Yêu cầu thêm kết luận chẩn đoán bệnh theo mã ICD-10"""
    # Định dạng ICD-10: chữ cái + 2 ký tự nhóm bệnh, mã con tùy chọn sau dấu chấm (I10, K29.7, S72.001)
    # (chuẩn hóa ' k29.7 ' -> 'K29.7' ở BeforeValidator vì pattern của StringConstraints chạy trước strip/to_upper)
    ma_icd10: Annotated[
        str,
        BeforeValidator(lambda v: v.strip().upper() if isinstance(v, str) else v),
        StringConstraints(max_length=50, pattern=r"^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$"),
    ] = Field(..., description="Mã bệnh chuẩn WHO ICD-10 (VD: I10, K29.7, J20)")
    ten_benh_chan_doan: Optional[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]] = Field(
        None, description="Tên bệnh chẩn đoán; bỏ trống để dùng tên chuẩn trong từ điển ICD-10 (bắt buộc nếu mã chưa có trong từ điển)"
    )
    loai_chan_doan: Literal["chinh", "phu"] = Field("chinh", description="Phân loại: 'chinh' (chẩn đoán chính) hoặc 'phu' (chẩn đoán kèm theo)")
    ghi_chu_chuyen_mon: Optional[str] = Field(None, description="Ghi chú chi tiết chuyên môn của bác sĩ")


class DiagnosisResponse(BaseModel):
    """Thông tin chẩn đoán bệnh"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    luot_kham_id: int
    ma_icd10: str
    ten_benh_chan_doan: str
    loai_chan_doan: str
    ghi_chu_chuyen_mon: Optional[str] = None
    created_at: Optional[datetime] = None


class OrderCreateRequest(BaseModel):
    """Yêu cầu kê phiếu chỉ định cận lâm sàng (Test Order)"""
    dich_vu_id: int = Field(..., description="ID dịch vụ cận lâm sàng (xét nghiệm, X-quang, v.v.)")
    so_luong: int = Field(1, ge=1, le=100, description="Số lượng thực hiện")


class OrderResponse(BaseModel):
    """Thông tin phiếu chỉ định cận lâm sàng"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    luot_kham_id: int
    dich_vu_id: int
    ten_dich_vu: Optional[str] = None
    so_luong: int
    don_gia_tai_thoi_diem: float
    trang_thai: str
    bac_si_chi_dinh_id: Optional[int] = None
    ket_qua_chi_tiet: Optional[str] = None
    tep_dinh_kem_url: Optional[str] = None
    thoi_gian_tra_ket_qua: Optional[datetime] = None
    ket_qua_phan_loai: Optional[str] = "BINH_THUONG"
    created_at: Optional[datetime] = None


ALLOWED_ORDER_STATUSES = {"da_chi_dinh", "dang_thuc_hien", "da_co_ket_qua", "da_huy"}


class OrderResultUpdateRequest(BaseModel):
    """Yêu cầu cập nhật kết quả cận lâm sàng (Lab/Imaging Result)"""
    ket_qua_chi_tiet: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] = Field(
        ..., description="Trị số xét nghiệm hoặc kết luận chẩn đoán hình ảnh"
    )
    tep_dinh_kem_url: Optional[str] = Field(
        None, max_length=255, description="URL file đính kèm (ảnh phim X-quang, PDF kết quả xét nghiệm)"
    )
    thoi_gian_tra_ket_qua: Optional[datetime] = Field(
        None, description="Thời gian trả kết quả (mặc định lấy thời điểm hiện tại)"
    )
    ket_qua_phan_loai: Optional[Literal["BINH_THUONG", "BAT_THUONG", "NGUY_KICH"]] = Field(
        "BINH_THUONG", description="Mức độ phân loại trị số cảnh báo lâm sàng (Bình thường / Bất thường / Nguy kịch)"
    )
    trang_thai: Optional[str] = Field(
        "da_co_ket_qua", description="Trạng thái y lệnh sau khi cập nhật (mặc định: da_co_ket_qua)"
    )

    @field_validator("trang_thai")
    @classmethod
    def validate_trang_thai(cls, v):
        if v and v not in ALLOWED_ORDER_STATUSES:
            raise ValueError(f"trang_thai không hợp lệ. Chỉ chấp nhận: {', '.join(ALLOWED_ORDER_STATUSES)}")
        return v


class PrescriptionItemCreateRequest(BaseModel):
    """Dữ liệu từng loại thuốc trong đơn (OpenMRS Drug Order Item)"""
    ten_thuoc: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)] = Field(
        ..., description="Tên thuốc biệt dược hoặc tên gốc (VD: Amlodipine, Paracetamol)"
    )
    hoat_chat: Optional[str] = Field(None, max_length=150, description="Hoạt chất chính")
    ham_luong: Optional[str] = Field(None, max_length=50, description="Hàm lượng (VD: 5mg, 500mg, 10ml)")
    don_vi_tinh: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)] = Field(
        ..., description="Đơn vị tính (Viên, Gói, Chai, Lọ, Ống, Tuýp)"
    )
    so_luong: int = Field(..., gt=0, le=1000, description="Số lượng cấp phát")
    cach_dung: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)] = Field(
        ..., description="Hướng dẫn liều lượng và cách dùng (VD: Sáng 1 viên sau ăn, tối 1 viên)"
    )
    so_ngay_dung: int = Field(5, gt=0, le=90, description="Số ngày dùng thuốc")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú thêm về thuốc")


class PrescriptionCreateRequest(BaseModel):
    """Yêu cầu kê đơn thuốc ngoại trú cho ca khám (OpenMRS Drug Order Header)"""
    loi_dan_uong_thuoc: Optional[str] = Field(None, description="Lời dặn chung của bác sĩ khi uống thuốc")
    ghi_chu_duoc_lam_sang: Optional[str] = Field(None, description="Ghi chú lưu ý tương tác thuốc hoặc dược lâm sàng")
    danh_sach_thuoc: List[PrescriptionItemCreateRequest] = Field(
        ..., min_length=1, description="Danh sách các loại thuốc kê trong đơn (tối thiểu 1 loại)"
    )


class PrescriptionItemResponse(BaseModel):
    """Thông tin chi tiết một dòng thuốc trong đơn đã kê"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    don_thuoc_id: int
    ten_thuoc: str
    hoat_chat: Optional[str] = None
    ham_luong: Optional[str] = None
    don_vi_tinh: str
    so_luong: int
    cach_dung: str
    so_ngay_dung: int
    ghi_chu: Optional[str] = None


class PrescriptionResponse(BaseModel):
    """Đơn thuốc điều trị ngoại trú đầy đủ của ca khám"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    luot_kham_id: int
    bac_si_ke_don_id: int
    ngay_ke_don: datetime
    loi_dan_uong_thuoc: Optional[str] = None
    ghi_chu_duoc_lam_sang: Optional[str] = None
    danh_sach_chi_tiet: List[PrescriptionItemResponse] = []
    created_at: Optional[datetime] = None


class EncounterCompleteRequest(BaseModel):
    """Yêu cầu hoàn tất ca khám và khóa hồ sơ bệnh án theo Thông tư 32/2023/TT-BYT"""
    ket_luan_dieu_tri: Optional[str] = Field(None, description="Kết luận điều trị y khoa")
    loi_dan_bac_si: Optional[str] = Field(None, description="Lời dặn của bác sĩ")
    ngay_hen_tai_kham: Optional[date] = Field(None, description="Ngày hẹn tái khám (nếu có)")


class EncounterResponse(BaseModel):
    """Chi tiết lượt khám lâm sàng / Bệnh án điện tử EMR"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    lich_kham_id: int
    bac_si_id: int
    benh_nhan_id: int
    thoi_gian_bat_dau: datetime
    thoi_gian_ket_thuc: Optional[datetime] = None
    ly_do_vao_kham: Optional[str] = None
    benh_su: Optional[str] = None

    # Sinh hiệu
    mach_lan_phut: Optional[int] = None
    nhiet_do_c: Optional[float] = None
    huyet_ap_tam_thu: Optional[int] = None
    huyet_ap_tam_truong: Optional[int] = None
    nhip_tho_lan_phut: Optional[int] = None
    can_nang_kg: Optional[float] = None
    chieu_cao_cm: Optional[float] = None

    kham_lam_sang_bo_phan: Optional[str] = None
    ket_luan_dieu_tri: Optional[str] = None
    loi_dan_bac_si: Optional[str] = None
    ngay_hen_tai_kham: Optional[date] = None

    # Khóa bệnh án
    is_locked: bool
    thoi_gian_khoa: Optional[datetime] = None
    nguoi_khoa_id: Optional[int] = None

    # Danh sách liên quan
    danh_sach_chan_doan: List[DiagnosisResponse] = []
    danh_sach_chi_dinh: List[OrderResponse] = []
    don_thuoc: Optional[PrescriptionResponse] = None


class AmendmentEntityType(str, enum.Enum):
    CHAN_DOAN = "CHAN_DOAN"
    DON_THUOC = "DON_THUOC"
    CHI_TIET_DON_THUOC = "CHI_TIET_DON_THUOC"
    CHI_DINH = "CHI_DINH"
    KET_LUAN = "KET_LUAN"


class AmendmentStatus(str, enum.Enum):
    CHO_PHE_DUYET = "CHO_PHE_DUYET"
    DA_PHE_DUYET = "DA_PHE_DUYET"
    TU_CHOI = "TU_CHOI"
    HUY_BO = "HUY_BO"


class AmendmentCreateRequest(BaseModel):
    """Schema bác sĩ gửi khi tạo yêu cầu đính chính bệnh án đã khóa"""
    thuc_the_loai: str = Field(..., description="Loại thực thể cần đính chính: CHAN_DOAN, DON_THUOC, CHI_TIET_DON_THUOC, CHI_DINH, KET_LUAN")
    thuc_the_id: int = Field(..., description="ID bản ghi cần đính chính (ChanDoan/DonThuoc/...)")
    ly_do_ma: Optional[str] = Field(None, max_length=50, description="Mã phân loại lý do đính chính")
    ly_do_text: str = Field(..., min_length=5, description="Mô tả lý do đính chính")
    noi_dung_moi_json: dict = Field(..., description="Nội dung mới dưới dạng JSON có cấu trúc")
    ghi_chu: Optional[str] = Field(None, description="Ghi chú bổ sung")


class AmendmentResponse(BaseModel):
    """Schema trả về thông tin biên bản đính chính"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    luot_kham_id: int
    thuc_the_loai: str
    thuc_the_id: int
    ly_do_ma: Optional[str] = None
    ly_do_text: str
    noi_dung_moi_json: dict
    requested_by_id: int
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    trang_thai: str
    ghi_chu: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AmendmentApproveRequest(BaseModel):
    """Schema trưởng khoa / admin gửi khi phê duyệt hoặc từ chối đính chính"""
    ghi_chu: Optional[str] = Field(None, description="Ghi chú của người phê duyệt/từ chối")

