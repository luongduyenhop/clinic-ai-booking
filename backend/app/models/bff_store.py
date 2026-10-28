from sqlalchemy import Column, Integer, JSON, String
from app.models.base import BaseModelWithTimestamp


class HeThongTrangThaiBff(BaseModelWithTimestamp):
    """
    Bảng lưu trữ và đồng bộ trạng thái BFF (Backend-For-Frontend) cho 19 phân hệ Quản trị.
    Kết hợp với các bảng quan hệ PostgreSQL để đảm bảo 100% thao tác CRUD từ giao diện React
    được lưu bền vững vào cơ sở dữ liệu PostgreSQL.
    """
    __tablename__ = "he_thong_trang_thai_bff"

    collection_key = Column(String(100), unique=True, nullable=False, index=True)
    data_json = Column(JSON, nullable=False)
    updated_by_id = Column(Integer, nullable=True)
