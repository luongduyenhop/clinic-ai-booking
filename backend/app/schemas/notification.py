from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class NotificationCreateRequest(BaseModel):
    tai_khoan_id: int
    tieu_de: str = Field(..., max_length=255)
    noi_dung: str
    loai_thong_bao: str = Field(default="HE_THONG")  # 'NHAC_LICH', 'GOI_SO', 'KET_QUA_CLS', 'DON_WAITLIST', 'HE_THONG'
    lien_ket_url: Optional[str] = None
    du_lieu_phu_json: Optional[Dict[str, Any]] = None


class NotificationResponse(BaseModel):
    id: int
    tai_khoan_id: int
    tieu_de: str
    noi_dung: str
    loai_thong_bao: str
    lien_ket_url: Optional[str] = None
    du_lieu_phu_json: Optional[Dict[str, Any]] = None
    da_doc: bool
    thoi_gian_doc: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    unread_count: int
