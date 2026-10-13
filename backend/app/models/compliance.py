from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class TrangThaiGiayPhep(str, Enum):
    """Trạng thái vòng đời giấy phép hành nghề bác sĩ & cơ sở (INT-05)"""
    ACTIVE = "ACTIVE"                  # Còn hiệu lực
    EXPIRING_SOON = "EXPIRING_SOON"    # Sắp hết hạn (<= 90 ngày)
    EXPIRED = "EXPIRED"                # Đã hết hạn
    SUSPENDED = "SUSPENDED"            # Tạm đình chỉ hoạt động
    REVOKED = "REVOKED"                # Bị thu hồi giấy phép


class GiayPhepCoSo(BaseModelWithTimestamp):
    """Quản lý Giấy phép hoạt động của Cơ sở khám chữa bệnh (Facility Credentialing - INT-05)"""
    __tablename__ = "giay_phep_co_so"

    so_giay_phep = Column(String(100), unique=True, nullable=False, index=True)
    ten_co_so = Column(String(255), nullable=False)
    ngay_cap = Column(DateTime(timezone=True), nullable=False)
    ngay_het_han = Column(DateTime(timezone=True), nullable=True, index=True)
    pham_vi_hoat_dong = Column(Text, nullable=True)
    trang_thai = Column(String(50), default=TrangThaiGiayPhep.ACTIVE.value, nullable=False, index=True)
    tep_dinh_kem_url = Column(String(500), nullable=True)
    ghi_chu = Column(Text, nullable=True)


class LichSuGiayPhepBacSi(BaseModelWithTimestamp):
    """Nhật ký biến động và thẩm định giấy phép hành nghề bác sĩ (INT-05 Audit Log)"""
    __tablename__ = "lich_su_giay_phep_bac_si"

    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    trang_thai_cu = Column(String(50), nullable=True)
    trang_thai_moi = Column(String(50), nullable=False)
    nguoi_thuc_hien_id = Column(Integer, ForeignKey("tai_khoan.id", ondelete="SET NULL"), nullable=True)
    ly_do = Column(Text, nullable=False)
    ngay_hieu_luc = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
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
    """Bảng nhật ký kiểm toán truy cập dữ liệu sức khỏe (Health Data Access Log - INT-03 / NĐ 102/2025/NĐ-CP)"""
    __tablename__ = "nhat_ky_truy_cap_y_te"

    user_id = Column(Integer, nullable=False, index=True)
    user_role = Column(String(50), nullable=False)
    patient_id = Column(Integer, nullable=False, index=True)
    action = Column(String(50), nullable=False)  # VIEW, EDIT, EXPORT, AMEND
    resource_type = Column(String(50), nullable=False)  # ENCOUNTER, PRESCRIPTION, PATIENT_HISTORY, DIAGNOSIS
    resource_id = Column(Integer, nullable=True)
    purpose = Column(String(255), nullable=False)  # KHAM_BENH, HO_TRO_DUOC, THANH_TRA, TRA_CUU
    client_ip = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

