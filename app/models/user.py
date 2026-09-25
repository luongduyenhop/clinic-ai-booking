from enum import Enum
from sqlalchemy import Column, String, Date, Boolean, Integer, ForeignKey, Text, Numeric, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class VaiTroEnum(str, Enum):
    BENH_NHAN = "benh_nhan"
    BAC_SI = "bac_si"
    ADMIN = "admin"


class ChuyenKhoa(BaseModelWithTimestamp):
    """Bảng danh mục các chuyên khoa lâm sàng của phòng khám (OpenMRS Department)"""
    __tablename__ = "chuyen_khoa"

    ma_chuyen_khoa = Column(String(50), unique=True, nullable=False, index=True)
    ten_chuyen_khoa = Column(String(100), unique=True, nullable=False, index=True)
    mo_ta = Column(Text, nullable=True)
    vi_tri_phong = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Quan hệ 1 - N với Bác Sĩ
    danh_sach_bac_si = relationship("BacSi", back_populates="chuyen_khoa")


class NguoiDung(BaseModelWithTimestamp):
    """Mô hình kế thừa mẫu Person Pattern từ OpenMRS - lưu thông tin nhân khẩu học chung"""
    __tablename__ = "nguoi_dung"

    ho_ten = Column(String(150), nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    so_dien_thoai = Column(String(20), unique=True, nullable=True, index=True)
    ngay_sinh = Column(Date, nullable=True)
    gioi_tinh = Column(String(10), nullable=True)
    dia_chi = Column(String(255), nullable=True)
    cccd_so = Column(String(20), unique=True, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)

    # Quan hệ 1 - 1
    tai_khoan = relationship("TaiKhoan", back_populates="nguoi_dung", uselist=False, cascade="all, delete-orphan")
    benh_nhan = relationship("BenhNhan", back_populates="nguoi_dung", uselist=False, cascade="all, delete-orphan")
    bac_si = relationship("BacSi", back_populates="nguoi_dung", uselist=False, cascade="all, delete-orphan")


class TaiKhoan(BaseModelWithTimestamp):
    """Bảng quản lý bảo mật định danh, mật khẩu băm BCrypt, vai trò và trạng thái OTP (OpenMRS User)"""
    __tablename__ = "tai_khoan"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    mat_khau_hash = Column(String(255), nullable=False)
    vai_tro = Column(String(20), default=VaiTroEnum.BENH_NHAN.value, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)  # True sau khi kích hoạt OTP
    otp_code = Column(String(10), nullable=True)
    otp_expired_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Quan hệ
    nguoi_dung = relationship("NguoiDung", back_populates="tai_khoan")


class BenhNhan(BaseModelWithTimestamp):
    """Bảng hồ sơ bệnh nhân (OpenMRS Patient Pattern)"""
    __tablename__ = "benh_nhan"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    ma_dinh_danh_y_te = Column(String(50), unique=True, nullable=False, index=True)  # BN-2026-XXXX
    nhom_mau = Column(String(10), nullable=True)
    tien_su_benh = Column(Text, nullable=True)
    di_ung_thuoc = Column(Text, nullable=True)
    diem_tin_nhiem = Column(Integer, default=100, nullable=False)
    so_lan_no_show = Column(Integer, default=0, nullable=False)
    is_blocked_booking = Column(Boolean, default=False, nullable=False)

    # Quan hệ
    nguoi_dung = relationship("NguoiDung", back_populates="benh_nhan")
    danh_sach_lich_kham = relationship("LichKham", back_populates="benh_nhan")
    danh_sach_cho = relationship("DanhSachCho", back_populates="benh_nhan")


class BacSi(BaseModelWithTimestamp):
    """Bảng hồ sơ chuyên môn Bác sĩ (OpenMRS Provider Pattern)"""
    __tablename__ = "bac_si"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    hoc_vi = Column(String(50), nullable=False)  # ThS.BS, BSCKI, PGS.TS
    chung_chi_hanh_nghe = Column(String(100), unique=True, nullable=False)
    nam_kinh_nghiem = Column(Integer, default=0, nullable=False)
    mo_ta_chuyen_sau = Column(Text, nullable=True)
    gia_kham_mac_dinh = Column(Numeric(12, 2), default=200000.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Quan hệ
    nguoi_dung = relationship("NguoiDung", back_populates="bac_si")
    chuyen_khoa = relationship("ChuyenKhoa", back_populates="danh_sach_bac_si")
    danh_sach_lich_lam_viec = relationship("LichLamViec", back_populates="bac_si")
    danh_sach_lich_kham = relationship("LichKham", back_populates="bac_si")
