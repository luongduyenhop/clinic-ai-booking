from sqlalchemy import Column, String, Integer, ForeignKey, Text, Boolean, DateTime, Numeric, Date
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class KhaiNiem(BaseModelWithTimestamp):
    """Mô hình Concept Dictionary theo chuẩn OpenMRS - Quản lý danh mục ICD-10 và thuật ngữ y tế chuẩn"""
    __tablename__ = "khai_niem"

    ma_khai_niem = Column(String(50), unique=True, nullable=False, index=True)  # Mã WHO ICD-10: I10, J00, K29...
    ten_khai_niem = Column(String(255), nullable=False, index=True)
    loai_khai_niem = Column(String(50), default="benh_icd10", nullable=False)   # 'benh_icd10', 'trieu_chung', 'dich_vu'
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    mo_ta = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class TuKhoaCapCuu(BaseModelWithTimestamp):
    """Bảng quy tắc từ khóa cảnh báo cấp cứu (Red Flags Rules) cho bộ lọc an toàn y tế"""
    __tablename__ = "tu_khoa_cap_cuu"

    tu_khoa = Column(String(100), unique=True, nullable=False, index=True)  # 'đau ngực dữ dội', 'khó thở cấp', 'ngất xỉu'
    muc_do_nguy_hiem = Column(String(30), default="rat_nguy_hiem", nullable=False)
    huong_dan_xu_tri = Column(String(255), default="CẢNH BÁO NGUY HIỂM! Gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class DichVu(BaseModelWithTimestamp):
    """Bảng danh mục kỹ thuật và xét nghiệm cận lâm sàng (OpenMRS Medical Service)"""
    __tablename__ = "dich_vu"

    ma_dich_vu = Column(String(50), unique=True, nullable=False, index=True)
    ten_dich_vu = Column(String(150), nullable=False)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    don_gia = Column(Numeric(12, 2), default=0.00, nullable=False)
    don_vi_tinh = Column(String(30), default="Lần", nullable=False)
    quy_trinh_thuc_hien = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class LuotKham(BaseModelWithTimestamp):
    """Phiên khám lâm sàng thực tế (OpenMRS Encounter Pattern)"""
    __tablename__ = "luot_kham"

    lich_kham_id = Column(Integer, ForeignKey("lich_kham.id", ondelete="RESTRICT"), unique=True, nullable=False)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False)
    thoi_gian_bat_dau = Column(DateTime(timezone=True), nullable=False)
    thoi_gian_ket_thuc = Column(DateTime(timezone=True), nullable=True)
    ly_do_vao_kham = Column(Text, nullable=True)
    benh_su = Column(Text, nullable=True)
    
    # Chỉ số sinh hiệu (Vital Signs)
    mach_lan_phut = Column(Integer, nullable=True)
    nhiet_do_c = Column(Numeric(4, 1), nullable=True)
    huyet_ap_tam_thu = Column(Integer, nullable=True)
    huyet_ap_tam_truong = Column(Integer, nullable=True)
    nhip_tho_lan_phut = Column(Integer, nullable=True)
    can_nang_kg = Column(Numeric(5, 2), nullable=True)
    chieu_cao_cm = Column(Numeric(5, 2), nullable=True)
    
    kham_lam_sang_bo_phan = Column(Text, nullable=True)
    ket_luan_dieu_tri = Column(Text, nullable=True)
    loi_dan_bac_si = Column(Text, nullable=True)
    ngay_hen_tai_kham = Column(Date, nullable=True)
    
    # Khóa hồ sơ bệnh án theo Thông tư 32/2023/TT-BYT (chống sửa hồi tố)
    is_locked = Column(Boolean, default=False, nullable=False)
    thoi_gian_khoa = Column(DateTime(timezone=True), nullable=True)

    # Quan hệ
    lich_kham = relationship("LichKham", back_populates="luot_kham")
    danh_sach_chan_doan = relationship("ChanDoan", back_populates="luot_kham", cascade="all, delete-orphan")
    danh_sach_chi_dinh = relationship("ChiDinh", back_populates="luot_kham", cascade="all, delete-orphan")
    don_thuoc = relationship("DonThuoc", back_populates="luot_kham", uselist=False, cascade="all, delete-orphan")


class ChanDoan(BaseModelWithTimestamp):
    """Bảng lưu kết luận chẩn đoán bệnh theo mã ICD-10 (OpenMRS Encounter Diagnosis)"""
    __tablename__ = "chan_doan"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    khai_niem_id = Column(Integer, ForeignKey("khai_niem.id", ondelete="RESTRICT"), nullable=True)
    ma_icd10 = Column(String(50), nullable=False)
    ten_benh_chan_doan = Column(String(255), nullable=False)
    loai_chan_doan = Column(String(20), default="chinh", nullable=False)  # 'chinh' hoặc 'phu'
    ghi_chu_chuyen_mon = Column(Text, nullable=True)

    # Quan hệ
    luot_kham = relationship("LuotKham", back_populates="danh_sach_chan_doan")
    khai_niem = relationship("KhaiNiem")


class ChiDinh(BaseModelWithTimestamp):
    """Bảng y lệnh dịch vụ cận lâm sàng trong buổi khám (OpenMRS Test Order)"""
    __tablename__ = "chi_dinh"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    dich_vu_id = Column(Integer, ForeignKey("dich_vu.id", ondelete="RESTRICT"), nullable=False)
    so_luong = Column(Integer, default=1, nullable=False)
    don_gia_tai_thoi_diem = Column(Numeric(12, 2), default=0.00, nullable=False)
    trang_thai = Column(String(30), default="da_chi_dinh", nullable=False)  # 'da_chi_dinh', 'dang_thuc_hien', 'da_co_ket_qua', 'da_huy'
    bac_si_chi_dinh_id = Column(Integer, ForeignKey("bac_si.id"), nullable=True)
    ket_qua_chi_tiet = Column(Text, nullable=True)
    tep_dinh_kem_url = Column(String(255), nullable=True)
    thoi_gian_tra_ket_qua = Column(DateTime(timezone=True), nullable=True)

    # Quan hệ
    luot_kham = relationship("LuotKham", back_populates="danh_sach_chi_dinh")
    dich_vu = relationship("DichVu")


class DonThuoc(BaseModelWithTimestamp):
    """Bảng đơn thuốc điều trị ngoại trú (OpenMRS Drug Order Header)"""
    __tablename__ = "don_thuoc"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), unique=True, nullable=False)
    bac_si_ke_don_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False)
    ngay_ke_don = Column(DateTime(timezone=True), nullable=False)
    loi_dan_uong_thuoc = Column(Text, nullable=True)
    ghi_chu_duoc_lam_sang = Column(Text, nullable=True)

    # Quan hệ
    luot_kham = relationship("LuotKham", back_populates="don_thuoc")
    danh_sach_chi_tiet = relationship("ChiTietDonThuoc", back_populates="don_thuoc", cascade="all, delete-orphan")


class ChiTietDonThuoc(BaseModelWithTimestamp):
    """Bảng chi tiết từng dòng thuốc trong đơn (OpenMRS Drug Order Item)"""
    __tablename__ = "chi_tiet_don_thuoc"

    don_thuoc_id = Column(Integer, ForeignKey("don_thuoc.id", ondelete="CASCADE"), nullable=False, index=True)
    ten_thuoc = Column(String(150), nullable=False)
    hoat_chat = Column(String(150), nullable=True)
    ham_luong = Column(String(50), nullable=True)  # 500mg, 10ml
    don_vi_tinh = Column(String(30), nullable=False)  # Viên, Gói, Chai
    so_luong = Column(Integer, default=1, nullable=False)
    cach_dung = Column(Text, nullable=False)  # Sáng 1 viên, Tối 1 viên sau ăn
    so_ngay_dung = Column(Integer, default=5, nullable=False)
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
    don_thuoc = relationship("DonThuoc", back_populates="danh_sach_chi_tiet")
