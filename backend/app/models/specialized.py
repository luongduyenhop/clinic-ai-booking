from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class GoiDichVu(BaseModelWithTimestamp):
    """Bảng danh mục các gói khám sức khỏe tổng quát và chuyên sâu"""
    __tablename__ = "goi_dich_vu"

    ma_goi = Column(String(50), unique=True, nullable=False, index=True)
    ten_goi = Column(String(255), nullable=False, index=True)
    chuyen_khoa_chinh_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    doi_tuong_ap_dung = Column(String(100), default="NAM_NU_TRUONG_THANH", nullable=False)
    don_gia_niem_yet = Column(Numeric(15, 2), default=0.00, nullable=False)
    don_gia_khuyen_mai = Column(Numeric(15, 2), default=0.00, nullable=False)
    mo_ta = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Quan hệ
    chuyen_khoa = relationship("ChuyenKhoa")
    chi_tiet_dich_vu = relationship("ChiTietGoiDichVu", back_populates="goi_dich_vu", cascade="all, delete-orphan", lazy="selectin")


class ChiTietGoiDichVu(BaseModelWithTimestamp):
    """Bảng liên kết các dịch vụ kỹ thuật nằm trong một gói khám"""
    __tablename__ = "chi_tiet_goi_dich_vu"

    goi_dich_vu_id = Column(Integer, ForeignKey("goi_dich_vu.id", ondelete="CASCADE"), nullable=False, index=True)
    dich_vu_id = Column(Integer, ForeignKey("dich_vu.id", ondelete="RESTRICT"), nullable=False)
    so_luong = Column(Integer, default=1, nullable=False)
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
    goi_dich_vu = relationship("GoiDichVu", back_populates="chi_tiet_dich_vu")
    dich_vu = relationship("DichVu")


class DangKyGoiKham(BaseModelWithTimestamp):
    """Bảng ghi nhận bệnh nhân mua và sử dụng gói khám"""
    __tablename__ = "dang_ky_goi_kham"

    ma_dang_ky = Column(String(50), unique=True, nullable=False, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False, index=True)
    goi_dich_vu_id = Column(Integer, ForeignKey("goi_dich_vu.id", ondelete="RESTRICT"), nullable=False, index=True)
    ngay_dang_ky = Column(Date, nullable=False)
    han_su_dung = Column(Date, nullable=False)
    tong_so_dich_vu = Column(Integer, default=1, nullable=False)
    so_dich_vu_da_dung = Column(Integer, default=0, nullable=False)
    trang_thai = Column(String(30), default="DANG_SU_DUNG", nullable=False)  # 'DANG_SU_DUNG', 'HOAN_THANH', 'HET_HAN'

    # Quan hệ
    benh_nhan = relationship("BenhNhan")
    goi_dich_vu = relationship("GoiDichVu")


class LieuTrinhDieuTri(BaseModelWithTimestamp):
    """Bảng kế hoạch liệu trình điều trị dài ngày (Vật lý trị liệu, phục hồi chức năng)"""
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
    trang_thai = Column(String(30), default="DANG_DIEU_TRI", nullable=False)  # 'DANG_DIEU_TRI', 'TAM_DUNG', 'HOAN_THANH'

    # Quan hệ
    benh_nhan = relationship("BenhNhan")
    bac_si_phu_trach = relationship("BacSi")
    danh_sach_buoi = relationship("BuoiDieuTri", back_populates="lieu_trinh", cascade="all, delete-orphan", lazy="selectin")


class BuoiDieuTri(BaseModelWithTimestamp):
    """Bảng chi tiết từng buổi điều trị trong một liệu trình"""
    __tablename__ = "buoi_dieu_tri"

    lieu_trinh_id = Column(Integer, ForeignKey("lieu_trinh_dieu_tri.id", ondelete="CASCADE"), nullable=False, index=True)
    so_thu_tu_buoi = Column(Integer, nullable=False)
    ngay_thuc_hien = Column(DateTime(timezone=True), nullable=False)
    ky_thuat_vien_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    noi_dung_thuc_hien = Column(Text, nullable=True)
    danh_gia_tien_trien = Column(Text, nullable=True)
    trang_thai = Column(String(30), default="HOAN_THANH", nullable=False)

    # Quan hệ
    lieu_trinh = relationship("LieuTrinhDieuTri", back_populates="danh_sach_buoi")
    ky_thuat_vien = relationship("NguoiDung")
