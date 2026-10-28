from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Index
from sqlalchemy.orm import relationship, synonym
from app.models.base import BaseModelWithTimestamp


class GoiKham(BaseModelWithTimestamp):
    __tablename__ = "goi_kham"

    ma_goi = Column(String(50), unique=True, nullable=False, index=True)
    ten_goi = Column(String(255), nullable=False, index=True)
    chuyen_khoa_chinh_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    doi_tuong_ap_dung = Column(String(100), default="NAM_NU_TRUONG_THANH", nullable=False)
    don_gia_niem_yet = Column(Numeric(15, 2), default=0.00, nullable=False)
    don_gia_khuyen_mai = Column(Numeric(15, 2), default=0.00, nullable=False)
    mo_ta = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    chuyen_khoa = relationship("ChuyenKhoa")
    chi_tiet_goi_kham = relationship("ChiTietGoiKham", back_populates="goi_kham", cascade="all, delete-orphan", lazy="selectin")
    chi_tiet_dich_vu = synonym("chi_tiet_goi_kham")


GoiDichVu = GoiKham


class ChiTietGoiKham(BaseModelWithTimestamp):
    __tablename__ = "chi_tiet_goi_kham"

    goi_kham_id = Column(Integer, ForeignKey("goi_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    goi_dich_vu_id = synonym("goi_kham_id")
    dich_vu_id = Column(Integer, ForeignKey("dich_vu.id", ondelete="RESTRICT"), nullable=False)
    so_luong = Column(Integer, default=1, nullable=False)
    ghi_chu = Column(Text, nullable=True)

    goi_kham = relationship("GoiKham", back_populates="chi_tiet_goi_kham")
    dich_vu = relationship("DichVu")

    __table_args__ = (
        Index("uq_chi_tiet_goi_kham", "goi_kham_id", "dich_vu_id", unique=True),
    )


ChiTietGoiDichVu = ChiTietGoiKham


class GoiKhamDaMua(BaseModelWithTimestamp):
    __tablename__ = "goi_kham_da_mua"

    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False, index=True)
    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    goi_kham_id = Column(Integer, ForeignKey("goi_kham.id", ondelete="RESTRICT"), nullable=False, index=True)
    goi_dich_vu_id = synonym("goi_kham_id")
    hoa_don_id = Column(Integer, ForeignKey("hoa_don.id", ondelete="SET NULL"), unique=True, nullable=True)
    ma_goi_snapshot = Column(String(50), nullable=True)
    ten_goi_snapshot = Column(String(255), nullable=True)
    don_gia_goi_snapshot = Column(Numeric(15, 2), default=0.00, nullable=False)
    mien_giam = Column(Numeric(15, 2), default=0.00, nullable=False)
    so_tien_phai_thu = Column(Numeric(15, 2), default=0.00, nullable=False)
    trang_thai = Column(String(30), default="HOAT_DONG", nullable=False)
    thoi_gian_mua = Column(DateTime(timezone=True), nullable=True)
    nguoi_ban_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    ghi_chu = Column(Text, nullable=True)
    ma_dang_ky = Column(String(50), unique=True, nullable=True, index=True)
    ngay_dang_ky = Column(Date, nullable=True)
    han_su_dung = Column(Date, nullable=True)
    tong_tien = synonym("don_gia_goi_snapshot")
    giam_gia = synonym("mien_giam")
    thanh_tien = synonym("so_tien_phai_thu")
    tong_so_dich_vu = Column(Integer, default=1, nullable=False)
    so_dich_vu_da_dung = Column(Integer, default=0, nullable=False)

    benh_nhan = relationship("BenhNhan")
    goi_kham = relationship("GoiKham")
    goi_dich_vu = synonym("goi_kham")
    hoa_don = relationship("HoaDon", foreign_keys=[hoa_don_id])
    chi_tiet_goi_kham_da_mua = relationship("ChiTietGoiKhamDaMua", back_populates="goi_kham_da_mua", cascade="all, delete-orphan", lazy="selectin")
    danh_sach_chi_tiet = synonym("chi_tiet_goi_kham_da_mua")


DangKyGoiKham = GoiKhamDaMua


class ChiTietGoiKhamDaMua(BaseModelWithTimestamp):
    __tablename__ = "chi_tiet_goi_kham_da_mua"

    goi_kham_da_mua_id = Column(Integer, ForeignKey("goi_kham_da_mua.id", ondelete="CASCADE"), nullable=False, index=True)
    dang_ky_goi_kham_id = synonym("goi_kham_da_mua_id")
    chi_tiet_goi_kham_id = Column(Integer, ForeignKey("chi_tiet_goi_kham.id", ondelete="SET NULL"), nullable=True)
    dich_vu_id = Column(Integer, ForeignKey("dich_vu.id", ondelete="RESTRICT"), nullable=False, index=True)
    ma_dich_vu_snapshot = Column(String(50), nullable=True)
    ten_dich_vu_snapshot = Column(String(150), nullable=True)
    so_luong_duoc_huong = Column(Integer, default=1, nullable=False)
    so_luong_tong = synonym("so_luong_duoc_huong")
    don_gia_tham_chieu_snapshot = Column(Numeric(12, 2), default=0.00, nullable=False)
    don_gia_tai_thoi_diem = synonym("don_gia_tham_chieu_snapshot")
    so_luong_da_su_dung = Column(Integer, default=0, nullable=False)
    so_luong_da_dung = synonym("so_luong_da_su_dung")
    thanh_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    trang_thai_muc = Column(String(30), default="CHUA_DUNG", nullable=False)
    ghi_chu = Column(Text, nullable=True)

    goi_kham_da_mua = relationship("GoiKhamDaMua", back_populates="chi_tiet_goi_kham_da_mua")
    dang_ky_goi_kham = synonym("goi_kham_da_mua")
    dich_vu = relationship("DichVu")

    __table_args__ = (
        Index("uq_goi_da_mua_chi_tiet_dich_vu", "goi_kham_da_mua_id", "dich_vu_id", unique=True),
    )


ChiTietDangKyGoiKham = ChiTietGoiKhamDaMua


class LieuTrinhDieuTri(BaseModelWithTimestamp):
    __tablename__ = "lieu_trinh_dieu_tri"

    ma_lieu_trinh = Column(String(50), unique=True, nullable=False, index=True)
    ten_lieu_trinh = Column(String(255), nullable=False)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False, index=True)
    bac_si_phu_trach_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False)
    tong_so_buoi = Column(Integer, default=10, nullable=False)
    so_buoi_da_thuc_hien = Column(Integer, default=0, nullable=False)
    ngay_bat_dau = Column(Date, nullable=False)
    ngay_du_kien_ket_thuc = Column(Date, nullable=True)
    muc_tieu_dieu_tri = Column(Text, nullable=True)
    trang_thai = Column(String(30), default="DANG_DIEU_TRI", nullable=False)

    benh_nhan = relationship("BenhNhan")
    bac_si_phu_trach = relationship("BacSi")
    danh_sach_buoi = relationship("BuoiDieuTri", back_populates="lieu_trinh", cascade="all, delete-orphan", lazy="selectin")


class BuoiDieuTri(BaseModelWithTimestamp):
    __tablename__ = "buoi_dieu_tri"

    lieu_trinh_id = Column(Integer, ForeignKey("lieu_trinh_dieu_tri.id", ondelete="CASCADE"), nullable=False, index=True)
    so_thu_tu_buoi = Column(Integer, nullable=False)
    ngay_thuc_hien = Column(DateTime(timezone=True), nullable=False)
    ky_thuat_vien_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    noi_dung_thuc_hien = Column(Text, nullable=True)
    danh_gia_tien_trien = Column(Text, nullable=True)
    trang_thai = Column(String(30), default="HOAN_THANH", nullable=False)

    lieu_trinh = relationship("LieuTrinhDieuTri", back_populates="danh_sach_buoi")
    ky_thuat_vien = relationship("NguoiDung")
