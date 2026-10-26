from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class HopDongKhamDoan(BaseModelWithTimestamp):
    """Bảng quản lý hợp đồng khám sức khỏe đoàn doanh nghiệp B2B"""
    __tablename__ = "hop_dong_kham_doan"

    ma_hop_dong = Column(String(50), unique=True, nullable=False, index=True)
    ten_cong_ty = Column(String(255), nullable=False, index=True)
    ma_so_thue = Column(String(50), nullable=True)
    nguoi_dai_dien = Column(String(150), nullable=False)
    so_dien_thoai = Column(String(30), nullable=False)
    so_luong_nhan_vien = Column(Integer, default=1, nullable=False)
    ngay_bat_dau = Column(Date, nullable=False)
    ngay_ket_thuc = Column(Date, nullable=False)
    gia_tri_hop_dong = Column(Numeric(15, 2), default=0.00, nullable=False)
    trang_thai = Column(String(30), default="CHO_THUC_HIEN", nullable=False)  # 'CHO_THUC_HIEN', 'DANG_THUC_HIEN', 'HOAN_THANH', 'DA_THANH_LY'
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
    danh_sach_nhan_vien = relationship("NhanVienKhamDoan", back_populates="hop_dong", cascade="all, delete-orphan", lazy="selectin")


class NhanVienKhamDoan(BaseModelWithTimestamp):
    """Bảng danh sách nhân viên thuộc đoàn khám sức khỏe doanh nghiệp"""
    __tablename__ = "nhan_vien_kham_doan"

    hop_dong_id = Column(Integer, ForeignKey("hop_dong_kham_doan.id", ondelete="CASCADE"), nullable=False, index=True)
    ma_nhan_vien = Column(String(50), nullable=False)
    ho_ten = Column(String(150), nullable=False, index=True)
    ngay_sinh = Column(Date, nullable=True)
    gioi_tinh = Column(String(10), nullable=True)
    phong_ban = Column(String(100), nullable=True)
    so_dien_thoai = Column(String(30), nullable=True)
    cccd_so = Column(String(20), nullable=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="SET NULL"), nullable=True)
    phan_loai_suc_khoe = Column(String(20), nullable=True)  # 'LOAI_I' -> 'LOAI_V'
    trang_thai_kham = Column(String(30), default="CHUA_KHAM", nullable=False)  # 'CHUA_KHAM', 'DANG_KHAM', 'DA_KHAM'
    ket_luan = Column(Text, nullable=True)

    # Quan hệ
    hop_dong = relationship("HopDongKhamDoan", back_populates="danh_sach_nhan_vien")
    benh_nhan = relationship("BenhNhan")


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
    """Bảng ghi nhận bệnh nhân mua và sử dụng gói khám (Gói dịch vụ instance)"""
    __tablename__ = "dang_ky_goi_kham"

    ma_dang_ky = Column(String(50), unique=True, nullable=False, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False, index=True)
    goi_dich_vu_id = Column(Integer, ForeignKey("goi_dich_vu.id", ondelete="RESTRICT"), nullable=False, index=True)
    hoa_don_id = Column(Integer, ForeignKey("hoa_don.id", ondelete="SET NULL"), unique=True, nullable=True)
    ngay_dang_ky = Column(Date, nullable=False)
    han_su_dung = Column(Date, nullable=False)
    tong_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    giam_gia = Column(Numeric(15, 2), default=0.00, nullable=False)
    thanh_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    tong_so_dich_vu = Column(Integer, default=1, nullable=False)
    so_dich_vu_da_dung = Column(Integer, default=0, nullable=False)
    trang_thai = Column(String(30), default="MOI_TAO", nullable=False)  # 'MOI_TAO', 'XAC_NHAN', 'DANG_KHAM', 'KET_THUC_KHAM', 'TU_CHOI'

    # Quan hệ
    benh_nhan = relationship("BenhNhan")
    goi_dich_vu = relationship("GoiDichVu")
    hoa_don = relationship("HoaDon", foreign_keys=[hoa_don_id])
    danh_sach_chi_tiet = relationship("ChiTietDangKyGoiKham", back_populates="dang_ky_goi_kham", cascade="all, delete-orphan", lazy="selectin")


class ChiTietDangKyGoiKham(BaseModelWithTimestamp):
    """Snapshot từng dịch vụ kỹ thuật trong gói mà bệnh nhân đã mua (chi_tiet_goi_kham_da_mua)"""
    __tablename__ = "chi_tiet_dang_ky_goi_kham"

    dang_ky_goi_kham_id = Column(Integer, ForeignKey("dang_ky_goi_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    dich_vu_id = Column(Integer, ForeignKey("dich_vu.id", ondelete="RESTRICT"), nullable=False, index=True)
    so_luong_tong = Column(Integer, default=1, nullable=False)
    so_luong_da_dung = Column(Integer, default=0, nullable=False)
    don_gia_tai_thoi_diem = Column(Numeric(15, 2), default=0.00, nullable=False)
    thanh_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    trang_thai_muc = Column(String(30), default="CHUA_DUNG", nullable=False)  # 'CHUA_DUNG', 'DANG_DUNG', 'HOAN_THANH'
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
    dang_ky_goi_kham = relationship("DangKyGoiKham", back_populates="danh_sach_chi_tiet")
    dich_vu = relationship("DichVu")


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
