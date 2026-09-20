from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.appointment import DoctorBriefResponse


class SymptomTriageRequest(BaseModel):
    """Yêu cầu phân tích triệu chứng ngôn ngữ tự nhiên (UC-C01)"""
    trieu_chung: str = Field(..., min_length=5, description="Mô tả các triệu chứng khó chịu người bệnh đang gặp phải")
    tuoi: Optional[int] = Field(None, ge=0, le=120, description="Độ tuổi bệnh nhân (hỗ trợ phân loại)")
    gioi_tinh: Optional[str] = Field(None, description="Giới tính")


class SpecialtySuggestion(BaseModel):
    """Gợi ý chuyên khoa phù hợp kèm độ tin cậy và danh sách bác sĩ"""
    chuyen_khoa_id: int
    ten_chuyen_khoa: str
    do_tin_cay: float = Field(..., description="Độ tin cậy từ mô hình AI (0.0 - 1.0)")
    ly_do_de_xuat: str = Field(..., description="Giải thích căn cứ y khoa tóm tắt")
    danh_sach_bac_si: List[DoctorBriefResponse] = []


class SymptomTriageResponse(BaseModel):
    """Kết quả phân tích từ AI Triage Assistant (UC-C02, UC-C03)"""
    has_emergency: bool = Field(False, description="Cờ cảnh báo đỏ dấu hiệu nguy kịch cấp cứu")
    emergency_alert: Optional[str] = Field(None, description="Nội dung cảnh báo khẩn cấp (nếu có)")
    suggested_specialties: List[SpecialtySuggestion] = []
    default_assigned: bool = Field(False, description="True nếu tự động gán Nội tổng quát do độ tin cậy thấp < 60%")
    disclaimer: str = Field(
        "Kết quả phân tích AI chỉ mang tính chất tham khảo sơ bộ, không thay thế chẩn đoán chuyên môn của bác sĩ.",
        description="Khuyến cáo miễn trừ trách nhiệm y tế bắt buộc"
    )
