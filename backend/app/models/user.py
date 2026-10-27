from enum import Enum
from sqlalchemy import Column, String, Date, Boolean, Integer, ForeignKey, Text, Numeric, DateTime, JSON
from sqlalchemy.orm import relationship, synonym, foreign
from app.models.base import BaseModelWithTimestamp


class VaiTroEnum(str, Enum):
    BENH_NHAN = "benh_nhan"
    BAC_SI = "bac_si"
    LE_TAN = "le_tan"
    ADMIN = "admin"
    THU_NGAN = "thu_ngan"
    KY_THUAT_VIEN = "ky_thuat_vien"


class ChuyenKhoa(BaseModelWithTimestamp):
    __tablename__ = "chuyen_khoa"

    ma_chuyen_khoa = Column(String(50), unique=True, nullable=False, index=True)
    ten_chuyen_khoa = Column(String(100), unique=True, nullable=False, index=True)
    mo_ta = Column(Text, nullable=True)
    vi_tri_phong = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    danh_sach_bac_si = relationship("BacSi", back_populates="chuyen_khoa")
    danh_sach_phong_kham = relationship("PhongKham", back_populates="chuyen_khoa")


class PhongKham(BaseModelWithTimestamp):
    __tablename__ = "phong_kham"

    ma_phong = Column(String(50), unique=True, nullable=False, index=True)
    ten_phong = Column(String(100), nullable=False)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True, index=True)
    tang = Column(String(20), default="Tầng 1", nullable=False)
    loai_phong = Column(String(30), default="kham_benh", nullable=False)
    thiet_bi_chinh = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    chuyen_khoa = relationship("ChuyenKhoa", back_populates="danh_sach_phong_kham")
    danh_sach_lich_lam_viec = relationship("LichLamViec", back_populates="phong_kham")


class NguoiDung(BaseModelWithTimestamp):
    __tablename__ = "nguoi_dung"

    ho_ten = Column(String(150), nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=True, index=True)
    so_dien_thoai = Column(String(20), unique=True, nullable=True, index=True)
    ngay_sinh = Column(Date, nullable=True)
    gioi_tinh = Column(String(10), nullable=True)
    dia_chi = Column(String(255), nullable=True)
    cccd_so = Column(String(20), unique=True, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)

    tai_khoan = relationship("TaiKhoan", back_populates="nguoi_dung", uselist=False, cascade="all, delete-orphan")
    benh_nhan = relationship("BenhNhan", back_populates="nguoi_dung", uselist=False, cascade="all, delete-orphan")
    bac_si = relationship("BacSi", back_populates="nguoi_dung", uselist=False, cascade="all, delete-orphan")
    nhan_vien = relationship("NhanVien", back_populates="nguoi_dung", uselist=False, cascade="all, delete-orphan")


class TaiKhoan(BaseModelWithTimestamp):
    __tablename__ = "tai_khoan"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nhan_vien.id", ondelete="SET NULL"), unique=True, nullable=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    mat_khau_hash = Column(String(255), nullable=False)
    vai_tro = Column(String(50), default=VaiTroEnum.BENH_NHAN.value, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    otp_code_hash = Column(String(255), nullable=True)
    otp_code = synonym("otp_code_hash")
    otp_expired_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    refresh_token_hash = Column(String(255), unique=True, nullable=True, index=True)
    refresh_token = synonym("refresh_token_hash")
    refresh_token_expired_at = Column(DateTime(timezone=True), nullable=True)

    nguoi_dung = relationship("NguoiDung", back_populates="tai_khoan")
    danh_sach_tai_khoan_vai_tro = relationship(
        "TaiKhoanVaiTro",
        primaryjoin="TaiKhoan.id == foreign(TaiKhoanVaiTro.tai_khoan_id)",
        back_populates="tai_khoan",
        cascade="all, delete-orphan",
    )


class VaiTro(BaseModelWithTimestamp):
    __tablename__ = "vai_tro"

    ma_vai_tro = Column(String(50), unique=True, nullable=False, index=True)
    ten_vai_tro = Column(String(100), nullable=False)
    mo_ta = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    danh_sach_tai_khoan_vai_tro = relationship("TaiKhoanVaiTro", back_populates="vai_tro", cascade="all, delete-orphan")
    danh_sach_vai_tro_quyen = relationship("VaiTroQuyen", back_populates="vai_tro", cascade="all, delete-orphan")


class Quyen(BaseModelWithTimestamp):
    __tablename__ = "quyen"

    ma_quyen = Column(String(100), unique=True, nullable=False, index=True)
    ten_quyen = Column(String(150), nullable=False)
    mo_ta = Column(Text, nullable=True)

    danh_sach_vai_tro_quyen = relationship("VaiTroQuyen", back_populates="quyen", cascade="all, delete-orphan")


class TaiKhoanVaiTro(BaseModelWithTimestamp):
    __tablename__ = "tai_khoan_vai_tro"

    tai_khoan_id = Column(Integer, ForeignKey("tai_khoan.id", ondelete="CASCADE"), nullable=False, index=True)
    vai_tro_id = Column(Integer, ForeignKey("vai_tro.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_id = Column(Integer, ForeignKey("tai_khoan.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=False)

    tai_khoan = relationship("TaiKhoan", foreign_keys=[tai_khoan_id], back_populates="danh_sach_tai_khoan_vai_tro")
    vai_tro = relationship("VaiTro", foreign_keys=[vai_tro_id], back_populates="danh_sach_tai_khoan_vai_tro")
    assigned_by = relationship("TaiKhoan", foreign_keys=[assigned_by_id])


class VaiTroQuyen(BaseModelWithTimestamp):
    __tablename__ = "vai_tro_quyen"

    vai_tro_id = Column(Integer, ForeignKey("vai_tro.id", ondelete="CASCADE"), nullable=False, index=True)
    quyen_id = Column(Integer, ForeignKey("quyen.id", ondelete="CASCADE"), nullable=False, index=True)

    vai_tro = relationship("VaiTro", foreign_keys=[vai_tro_id], back_populates="danh_sach_vai_tro_quyen")
    quyen = relationship("Quyen", foreign_keys=[quyen_id], back_populates="danh_sach_vai_tro_quyen")


class NhanVien(BaseModelWithTimestamp):
    __tablename__ = "nhan_vien"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nhan_vien.id", ondelete="SET NULL"), unique=True, nullable=True)
    ma_nhan_vien = Column(String(50), unique=True, nullable=False, index=True)
    chuc_danh = Column(String(50), nullable=True)
    loai_nhan_vien = Column(String(30), default="BAC_SI", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    nguoi_dung = relationship("NguoiDung", back_populates="nhan_vien")
    bac_si = relationship("BacSi", back_populates="nhan_vien", uselist=False)


class BenhNhan(BaseModelWithTimestamp):
    __tablename__ = "benh_nhan"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nhan_vien.id", ondelete="SET NULL"), unique=True, nullable=True)
    ma_dinh_danh_y_te = Column(String(50), unique=True, nullable=False, index=True)
    nhom_mau = Column(String(10), nullable=True)
    tien_su_benh = Column(Text, nullable=True)
    di_ung_thuoc = Column(Text, nullable=True)
    diem_tin_nhiem = Column(Integer, default=100, nullable=False)
    so_lan_no_show = Column(Integer, default=0, nullable=False)
    nguoi_lien_he_khan_cap = Column(String(100), nullable=True)
    nguoi_lien_he = synonym("nguoi_lien_he_khan_cap")
    moi_quan_he_khan_cap = Column(String(30), nullable=True)
    sdt_lien_he_khan_cap = Column(String(20), nullable=True)
    sdt_nguoi_lien_he = synonym("sdt_lien_he_khan_cap")
    is_blocked_booking = Column(Boolean, default=False, nullable=False)

    nguoi_dung = relationship("NguoiDung", back_populates="benh_nhan")
    danh_sach_lich_kham = relationship("LichKham", back_populates="benh_nhan")
    danh_sach_cho = relationship("DanhSachCho", back_populates="benh_nhan")
    danh_sach_nguoi_than = relationship("HoSoNguoiThan", back_populates="benh_nhan_chinh", cascade="all, delete-orphan")


class BacSi(BaseModelWithTimestamp):
    __tablename__ = "bac_si"

    nguoi_dung_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), unique=True, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nhan_vien.id", ondelete="SET NULL"), unique=True, nullable=True)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    hoc_vi = Column(String(50), nullable=False)
    chung_chi_hanh_nghe = Column(String(100), unique=True, nullable=False)
    so_cchn = synonym("chung_chi_hanh_nghe")
    ma_lien_thong_nguoi_ke_don = Column(String(100), nullable=True)
    nam_kinh_nghiem = Column(Integer, default=0, nullable=False)
    mo_ta_chuyen_sau = Column(Text, nullable=True)
    gia_kham_mac_dinh = Column(Numeric(12, 2), default=200000.00, nullable=False)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    ngay_cap = Column(Date, nullable=True)
    ngay_het_han = Column(Date, nullable=True, index=True)
    pham_vi_chuyen_mon = Column(JSON, default=list, nullable=True)
    trang_thai_giay_phep = Column(String(50), default="ACTIVE", nullable=False, index=True)
    tep_dinh_kem_url = Column(String(500), nullable=True)

    def __init__(self, **kwargs):
        if "trang_thai_giay_phep" not in kwargs:
            kwargs["trang_thai_giay_phep"] = "ACTIVE"
        if "pham_vi_chuyen_mon" not in kwargs:
            kwargs["pham_vi_chuyen_mon"] = []
        super().__init__(**kwargs)

    nguoi_dung = relationship("NguoiDung", back_populates="bac_si")
    nhan_vien = relationship("NhanVien", back_populates="bac_si")
    chuyen_khoa = relationship("ChuyenKhoa", back_populates="danh_sach_bac_si")
    phong_kham = relationship("PhongKham", foreign_keys=[phong_kham_id], lazy="joined")
    danh_sach_lich_lam_viec = relationship("LichLamViec", back_populates="bac_si")
    danh_sach_lich_kham = relationship("LichKham", back_populates="bac_si")


class HoSoNguoiThan(BaseModelWithTimestamp):
    __tablename__ = "ho_so_nguoi_than"

    benh_nhan_chinh_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False, index=True)
    ho_ten = Column(String(150), nullable=False, index=True)
    quan_he = Column(String(50), default="CON", nullable=False)
    ngay_sinh = Column(Date, nullable=False)
    gioi_tinh = Column(String(10), default="Nam", nullable=False)
    so_dien_thoai = Column(String(20), nullable=True)
    cccd_so = Column(String(20), nullable=True)
    tien_su_benh = Column(Text, nullable=True)
    di_ung_thuoc = Column(Text, nullable=True)
    nhom_mau = Column(String(10), nullable=True)
    ghi_chu = Column(Text, nullable=True)

    benh_nhan_chinh = relationship("BenhNhan", back_populates="danh_sach_nguoi_than")
