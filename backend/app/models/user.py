from enum import Enum
from sqlalchemy import Column, String, Date, Boolean, Integer, ForeignKey, Text, Numeric, DateTime, JSON
from sqlalchemy.orm import relationship, synonym
from app.models.base import BaseModelWithTimestamp


class VaiTroEnum(str, Enum):
    BENH_NHAN = "benh_nhan"
    BAC_SI = "bac_si"
    LE_TAN = "le_tan"
    ADMIN = "admin"


class ChuyenKhoa(BaseModelWithTimestamp):
    """Bảng danh mục các chuyên khoa lâm sàng của phòng khám (OpenMRS Department)"""
    __tablename__ = "chuyen_khoa"

    ma_chuyen_khoa = Column(String(50), unique=True, nullable=False, index=True)
    ten_chuyen_khoa = Column(String(100), unique=True, nullable=False, index=True)
    mo_ta = Column(Text, nullable=True)
    vi_tri_phong = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Quan hệ 1 - N với Bác Sĩ & Buồng Khám
    danh_sach_bac_si = relationship("BacSi", back_populates="chuyen_khoa")
    danh_sach_phong_kham = relationship("PhongKham", back_populates="chuyen_khoa")


class PhongKham(BaseModelWithTimestamp):
    """Bảng buồng khám vật lý và phòng kỹ thuật cận lâm sàng (OpenMRS / FHIR Location)"""
    __tablename__ = "phong_kham"

    ma_phong = Column(String(50), unique=True, nullable=False, index=True)
    ten_phong = Column(String(100), nullable=False)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True, index=True)
    tang = Column(String(20), default="Tầng 1", nullable=False)
    loai_phong = Column(String(30), default="kham_benh", nullable=False)  # 'kham_benh', 'xet_nghiem', 'chan_doan_hinh_anh', 'thu_thuat'
    thiet_bi_chinh = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Quan hệ
    chuyen_khoa = relationship("ChuyenKhoa", back_populates="danh_sach_phong_kham")
    danh_sach_lich_lam_viec = relationship("LichLamViec", back_populates="phong_kham")


class NguoiDung(BaseModelWithTimestamp):
    """Mô hình kế thừa mẫu Person Pattern từ OpenMRS - lưu thông tin nhân khẩu học chung"""
    __tablename__ = "nguoi_dung"

    ho_ten = Column(String(150), nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=True, index=True)
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
    nhan_vien = relationship("NhanVien", back_populates="nguoi_dung", uselist=False, cascade="all, delete-orphan")


class TaiKhoan(BaseModelWithTimestamp):
    """Bảng quản lý bảo mật định danh, mật khẩu băm BCrypt, vai trò và trạng thái OTP (OpenMRS User)"""
    __tablename__ = "tai_khoan"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nhan_vien.id", ondelete="SET NULL"), unique=True, nullable=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    mat_khau_hash = Column(String(255), nullable=False)
    vai_tro = Column(String(20), default=VaiTroEnum.BENH_NHAN.value, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)  # True sau khi kích hoạt OTP
    otp_code = Column(String(10), nullable=True)
    otp_expired_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    refresh_token = Column(String(255), unique=True, nullable=True, index=True)
    refresh_token_expired_at = Column(DateTime(timezone=True), nullable=True)

    # Quan hệ
    nguoi_dung = relationship("NguoiDung", back_populates="tai_khoan")


class NhanVien(BaseModelWithTimestamp):
    """Bảng hồ sơ nhân sự/nhân viên tổng quát (KTV, Lễ tân, Thu ngân, Bác sĩ)"""
    __tablename__ = "nhan_vien"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nhan_vien.id", ondelete="SET NULL"), unique=True, nullable=True)
    ma_nhan_vien = Column(String(50), unique=True, nullable=False, index=True)
    chuc_danh = Column(String(50), nullable=True)  # Kỹ thuật viên, Lễ tân, Thu ngân, Bác sĩ
    loai_nhan_vien = Column(String(30), default="BAC_SI", nullable=False)  # 'BAC_SI', 'KTV', 'LE_TAN', 'THU_NGAN'
    is_active = Column(Boolean, default=True, nullable=False)

    # Quan hệ
    nguoi_dung = relationship("NguoiDung", back_populates="nhan_vien")
    bac_si = relationship("BacSi", back_populates="nhan_vien", uselist=False)


class BenhNhan(BaseModelWithTimestamp):
    """Bảng hồ sơ bệnh nhân (OpenMRS Patient Pattern)"""
    __tablename__ = "benh_nhan"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nhan_vien.id", ondelete="SET NULL"), unique=True, nullable=True)
    ma_dinh_danh_y_te = Column(String(50), unique=True, nullable=False, index=True)  # BN-2026-XXXX
    nhom_mau = Column(String(10), nullable=True)
    tien_su_benh = Column(Text, nullable=True)
    di_ung_thuoc = Column(Text, nullable=True)
    diem_tin_nhiem = Column(Integer, default=100, nullable=False)
    so_lan_no_show = Column(Integer, default=0, nullable=False)
    is_blocked_booking = Column(Boolean, default=False, nullable=False)
    nguoi_lien_he = Column(String(100), nullable=True)
    sdt_nguoi_lien_he = Column(String(20), nullable=True)

    # Quan hệ
    nguoi_dung = relationship("NguoiDung", back_populates="benh_nhan")
    danh_sach_lich_kham = relationship("LichKham", back_populates="benh_nhan")
    danh_sach_cho = relationship("DanhSachCho", back_populates="benh_nhan")
    danh_sach_nguoi_than = relationship("HoSoNguoiThan", back_populates="benh_nhan_chinh", cascade="all, delete-orphan")


class BacSi(BaseModelWithTimestamp):
    """Bảng hồ sơ chuyên môn Bác sĩ (OpenMRS Provider Pattern)"""
    __tablename__ = "bac_si"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nhan_vien.id", ondelete="SET NULL"), unique=True, nullable=True)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    hoc_vi = Column(String(50), nullable=False)  # ThS.BS, BSCKI, PGS.TS
    chung_chi_hanh_nghe = Column(String(100), unique=True, nullable=False)
    so_cchn = synonym("chung_chi_hanh_nghe")
    nam_kinh_nghiem = Column(Integer, default=0, nullable=False)
    mo_ta_chuyen_sau = Column(Text, nullable=True)
    gia_kham_mac_dinh = Column(Numeric(12, 2), default=200000.00, nullable=False)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Vòng đời giấy phép hành nghề (Credentialing & License Lifecycle - INT-05)
    ngay_cap = Column(DateTime(timezone=True), nullable=True)
    ngay_het_han = Column(DateTime(timezone=True), nullable=True, index=True)
    pham_vi_chuyen_mon = Column(JSON, default=list, nullable=True)
    trang_thai_giay_phep = Column(String(50), default="ACTIVE", nullable=False, index=True)
    tep_dinh_kem_url = Column(String(500), nullable=True)

    def __init__(self, **kwargs):
        if "trang_thai_giay_phep" not in kwargs:
            kwargs["trang_thai_giay_phep"] = "ACTIVE"
        if "pham_vi_chuyen_mon" not in kwargs:
            kwargs["pham_vi_chuyen_mon"] = []
        super().__init__(**kwargs)

    # Quan hệ
    nguoi_dung = relationship("NguoiDung", back_populates="bac_si")
    nhan_vien = relationship("NhanVien", back_populates="bac_si")
    chuyen_khoa = relationship("ChuyenKhoa", back_populates="danh_sach_bac_si")
    phong_kham = relationship("PhongKham", foreign_keys=[phong_kham_id], lazy="joined")
    danh_sach_lich_lam_viec = relationship("LichLamViec", back_populates="bac_si")
    danh_sach_lich_kham = relationship("LichKham", back_populates="bac_si")


class HoSoNguoiThan(BaseModelWithTimestamp):
    """Bảng hồ sơ sức khỏe thành viên gia đình (Con cái, Bố mẹ, Vợ chồng) liên kết với tài khoản Bệnh nhân"""
    __tablename__ = "ho_so_nguoi_than"

    benh_nhan_chinh_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False, index=True)
    ho_ten = Column(String(150), nullable=False, index=True)
    quan_he = Column(String(50), default="CON", nullable=False)  # 'CON', 'VO_CHONG', 'CHA_ME', 'NGUOI_THAN'
    ngay_sinh = Column(Date, nullable=False)
    gioi_tinh = Column(String(10), default="Nam", nullable=False)
    so_dien_thoai = Column(String(20), nullable=True)
    cccd_so = Column(String(20), nullable=True)
    tien_su_benh = Column(Text, nullable=True)
    di_ung_thuoc = Column(Text, nullable=True)
    nhom_mau = Column(String(10), nullable=True)
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
    benh_nhan_chinh = relationship("BenhNhan", back_populates="danh_sach_nguoi_than")

