from sqlalchemy import JSON, Column, Integer, String

from app.models.base import BaseModelWithTimestamp


class HeThongTrangThaiBff(BaseModelWithTimestamp):
    __tablename__ = "he_thong_trang_thai_bff"

    collection_key = Column(String(100), nullable=False, unique=True)
    data_json = Column(JSON, nullable=False)
    updated_by_id = Column(Integer, nullable=True)
