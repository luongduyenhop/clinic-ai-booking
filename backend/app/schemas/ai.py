from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from app.schemas.appointment import DoctorBriefResponse


class TriageContext(BaseModel):
    age: Optional[Literal['', 'age_newborn', 'age_infant', 'age_child', 'age_adolescent', 'age_adult', 'age_older_adult']] = None
    sex: Optional[Literal['', 'sex_female', 'sex_male']] = None
    duration: Optional[Literal['', 'duration_hours', 'duration_1_3_days', 'duration_4_7_days', 'duration_1_4_weeks', 'duration_over_4_weeks']] = None
    onset: Optional[Literal['', 'onset_sudden', 'onset_gradual', 'onset_after_meal', 'onset_after_trauma', 'onset_after_infection']] = None
    severity: Optional[Literal['', 'severity_mild', 'severity_moderate', 'severity_severe']] = None


class SymptomTriageRequest(BaseModel):
    """Yêu cầu phân tích triệu chứng ngôn ngữ tự nhiên (UC-C01)"""
    trieu_chung: str = Field(..., min_length=5, max_length=4000, description="Mô tả các triệu chứng khó chịu người bệnh đang gặp phải")
    tuoi: Optional[int] = Field(None, ge=0, le=120, description="Độ tuổi bệnh nhân (hỗ trợ phân loại)")
    gioi_tinh: Optional[str] = Field(None, description="Giới tính")
    structured: Optional[TriageContext] = None


class SpecialtySuggestion(BaseModel):
    """Gợi ý chuyên khoa phù hợp kèm độ tin cậy và danh sách bác sĩ"""
    chuyen_khoa_id: Optional[int] = Field(None, description="Mã chuyên khoa, null nếu chuyên khoa gợi ý chưa có trong hệ thống")
    ten_chuyen_khoa: str
    do_tin_cay: float = Field(..., description="Độ tin cậy từ mô hình AI (0.0 - 1.0)")
    muc_do_tin_cay: Optional[str] = Field(None, description="Mức độ tin cậy: 'cao' (>=75%), 'trung_binh' (60-74%), 'thap' (<60%)")
    ly_do_de_xuat: str = Field(..., description="Giải thích căn cứ y khoa tóm tắt")
    danh_sach_bac_si: List[DoctorBriefResponse] = []


class DiseasePrediction(BaseModel):
    """Bệnh có xác suất cao để giải thích kết quả model; không phải chẩn đoán."""

    ma_benh: str
    ten_benh: str
    chuyen_khoa: str
    xac_suat: float = Field(..., ge=0, le=1)


class SymptomTriageResponse(BaseModel):
    """Kết quả phân tích từ AI Triage Assistant (UC-C02, UC-C03)"""
    has_emergency: bool = Field(False, description="Cờ cảnh báo đỏ dấu hiệu nguy kịch cấp cứu")
    emergency_alert: Optional[str] = Field(None, description="Nội dung cảnh báo khẩn cấp (nếu có)")
    suggested_specialties: List[SpecialtySuggestion] = []
    default_assigned: bool = Field(False, description="True nếu tự động gán Nội tổng quát do độ tin cậy thấp < 60%")
    needs_more_information: bool = Field(
        False,
        description="True khi mô tả chưa đủ dấu hiệu để model định tuyến an toàn",
    )
    recognized_symptoms: List[str] = Field(
        default_factory=list,
        description="Các đặc trưng triệu chứng NLP đã nhận diện",
    )
    disease_predictions: List[DiseasePrediction] = Field(
        default_factory=list,
        description="Tối đa 5 bệnh có xác suất cao nhất, chỉ dùng để giải thích model",
    )
    model_version: Optional[str] = Field(None, description="Phiên bản model AI Triage đã sử dụng")
    disclaimer: str = Field(
        "Kết quả phân tích AI chỉ mang tính chất tham khảo sơ bộ, không thay thế chẩn đoán chuyên môn của bác sĩ.",
        description="Khuyến cáo miễn trừ trách nhiệm y tế bắt buộc"
    )
