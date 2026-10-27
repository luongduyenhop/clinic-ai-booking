from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class TrangThaiGiayPhep(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRING_SOON = "EXPIRING_SOON"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"
    REVOKED = "REVOKED"


class GiayPhepCoSo(BaseModelWithTimestamp):
    __tablename__ = "giay_phep_co_so"

    so_giay_phep = Column(String(100), unique=True, nullable=False, index=True)
    ma_lien_thong_co_so = Column(String(100), nullable=True)
    ten_co_so = Column(String(255), nullable=False)
    ngay_cap = Column(DateTime(timezone=True), nullable=False)
    ngay_het_han = Column(DateTime(timezone=True), nullable=True, index=True)
    pham_vi_hoat_dong = Column(Text, nullable=True)
    trang_thai = Column(String(50), default=TrangThaiGiayPhep.ACTIVE.value, nullable=False, index=True)
    tep_dinh_kem_url = Column(String(500), nullable=True)
    ghi_chu = Column(Text, nullable=True)


class LichSuGiayPhepBacSi(BaseModelWithTimestamp):
    __tablename__ = "lich_su_giay_phep_bac_si"

    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    trang_thai_cu = Column(String(50), nullable=True)
    trang_thai_moi = Column(String(50), nullable=False)
    nguoi_thuc_hien_id = Column(Integer, ForeignKey("tai_khoan.id", ondelete="SET NULL"), nullable=True)
    ly_do = Column(Text, nullable=False)
    ngay_hieu_luc = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    ghi_chu = Column(Text, nullable=True)

    bac_si = relationship("BacSi", backref="lich_su_giay_phep")
    nguoi_thuc_hien = relationship("TaiKhoan")


class HealthDataAccessAction(str, Enum):
    VIEW = "VIEW"
    EDIT = "EDIT"
    EXPORT = "EXPORT"
    AMEND = "AMEND"


class HealthDataResourceType(str, Enum):
    ENCOUNTER = "ENCOUNTER"
    PRESCRIPTION = "PRESCRIPTION"
    PATIENT_HISTORY = "PATIENT_HISTORY"
    DIAGNOSIS = "DIAGNOSIS"


class NhatKyTruyCapDuLieuYTe(BaseModelWithTimestamp):
    __tablename__ = "nhat_ky_truy_cap_y_te"

    user_id = Column(Integer, nullable=False, index=True)
    user_role = Column(String(50), nullable=False)
    loai_nhat_ky = Column(String(30), default="Y_TE", nullable=False)
    patient_id = Column(Integer, nullable=True, index=True)
    action = Column(String(50), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(Integer, nullable=True)
    purpose = Column(String(255), nullable=False)
    noi_dung_cu_json = Column(JSON, nullable=True)
    noi_dung_moi_json = Column(JSON, nullable=True)
    client_ip = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
