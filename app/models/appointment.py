from enum import Enum
from sqlalchemy import Column, String, Date, Time, Integer, ForeignKey, Text, Boolean, Index, DateTime, Numeric
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class CaLamViecEnum(str, Enum):
    SANG = "sang"    # 07:30 - 11:30
    CHIEU = "chieu"  # 13:30 - 17:00


class TrangThaiLichEnum(str, Enum):
    CHO_XAC_NHAN = "cho_xac_nhan"
    DA_XAC_NHAN = "da_xac_nhan"
    DA_TIEP_NHAN = "da_tiep_nhan"
    DANG_KHAM = "dang_kham"
    DA_KHAM = "da_kham"
    DA_HUY = "da_huy"
    TU_DONG_HUY = "tu_dong_huy"
    NO_SHOW = "no_show"


class TrangThaiWaitlistEnum(str, Enum):
    DANG_CHO = "dang_cho"
    DA_THONG_BAO = "da_thong_bao"
    DA_NHAN_SLOT = "da_nhan_slot"
    DA_BO_QUA = "da_bo_qua"
    DA_HUY = "da_huy"


class LichLamViec(BaseModelWithTimestamp):
    """Bảng cấu hình ca làm việc định kỳ của Bác sĩ (OpenMRS Appointment Block)"""
    __tablename__ = "lich_lam_viec"

    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    ngay_lam_viec = Column(Date, nullable=False, index=True)
    ca_lam_viec = Column(String(20), default=CaLamViecEnum.SANG.value, nullable=False)
    gio_bat_dau = Column(Time, nullable=False)
    gio_ket_thuc = Column(Time, nullable=False)
    gioi_han_ca_kham = Column(Integer, default=8, nullable=False)  # Tối đa 8 bệnh nhân/ca
    is_active = Column(Boolean, default=True, nullable=False)      # False nếu nghỉ đột xuất
    ghi_chu_nghi = Column(Text, nullable=True)

    # Quan hệ
    bac_si = relationship("BacSi", back_populates="danh_sach_lich_lam_viec")


class LichKham(BaseModelWithTimestamp):
    """Bảng lịch hẹn khám bệnh trực tuyến (OpenMRS Appointment / TimeSlot)"""
    __tablename__ = "lich_kham"

    ma_lich_kham = Column(String(50), unique=True, nullable=False, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False, index=True)
    ngay_kham = Column(Date, nullable=False, index=True)
    gio_kham = Column(Time, nullable=False, index=True)
    thoi_luong_phut = Column(Integer, default=30, nullable=False)
    so_thu_tu = Column(Integer, default=1, nullable=False)
    ly_do_kham = Column(String(255), nullable=True)
    trieu_chung_ban_dau = Column(Text, nullable=True)
    trang_thai = Column(String(30), default=TrangThaiLichEnum.CHO_XAC_NHAN.value, nullable=False)
    is_reconfirmed_24h = Column(Boolean, default=False, nullable=False)
    thoi_gian_xac_nhan = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_huy = Column(DateTime(timezone=True), nullable=True)
    ly_do_huy = Column(Text, nullable=True)
    nguoi_huy_vai_tro = Column(String(20), nullable=True)

    # Quan hệ
    benh_nhan = relationship("BenhNhan", back_populates="danh_sach_lich_kham")
    bac_si = relationship("BacSi", back_populates="danh_sach_lich_kham")
    luot_kham = relationship("LuotKham", back_populates="lich_kham", uselist=False)
    phan_tich_ai = relationship("PhanTichAI", back_populates="lich_kham", uselist=False)

    # Đánh chỉ mục Index phục vụ truy vấn slot nhanh
    __table_args__ = (
        Index("ix_doctor_schedule_date", "bac_si_id", "ngay_kham"),
    )


class DanhSachCho(BaseModelWithTimestamp):
    """Bảng danh sách chờ thông minh khi hết slot khám (OpenMRS Appointment Waitlist)"""
    __tablename__ = "danh_sach_cho"

    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    ngay_mong_muon = Column(Date, nullable=False, index=True)
    ca_mong_muon = Column(String(20), default=CaLamViecEnum.SANG.value, nullable=False)
    trieu_chung = Column(Text, nullable=True)
    thu_tu_uu_tien = Column(Integer, default=1, nullable=False)
    trang_thai = Column(String(30), default=TrangThaiWaitlistEnum.DANG_CHO.value, nullable=False)
    thoi_gian_thong_bao = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_het_han_giu_slot = Column(DateTime(timezone=True), nullable=True)
    slot_duoc_cap_id = Column(Integer, ForeignKey("lich_kham.id", ondelete="SET NULL"), nullable=True)

    # Quan hệ
    benh_nhan = relationship("BenhNhan", back_populates="danh_sach_cho")
    bac_si = relationship("BacSi")


class PhanTichAI(BaseModelWithTimestamp):
    """Bảng ghi nhận vết suy luận triệu chứng ngôn ngữ tự nhiên từ AI"""
    __tablename__ = "phan_tich_ai"

    lich_kham_id = Column(Integer, ForeignKey("lich_kham.id", ondelete="SET NULL"), nullable=True, unique=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="SET NULL"), nullable=True)
    trieu_chung_nhap = Column(Text, nullable=False)
    chuyen_khoa_goi_y_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    do_tin_cay = Column(Numeric(5, 4), default=0.0000, nullable=False)
    co_dau_hieu_cap_cuu = Column(Boolean, default=False, nullable=False)
    tu_khoa_cap_cuu_phat_hien = Column(String(100), nullable=True)
    mo_hinh_ap_dung = Column(String(50), default="TFIDF_LOGISTIC_V1", nullable=False)
    thoi_gian_suy_luan_ms = Column(Numeric(8, 2), nullable=True)

    # Quan hệ
    lich_kham = relationship("LichKham", back_populates="phan_tich_ai")
    chuyen_khoa_goi_y = relationship("ChuyenKhoa")
    danh_gia = relationship("DanhGiaAI", back_populates="phan_tich_ai", uselist=False)


class DanhGiaAI(BaseModelWithTimestamp):
    """Bảng đánh giá độ chính xác của AI từ Bác sĩ hoặc Bệnh nhân (AI Feedback Loop)"""
    __tablename__ = "danh_gia_ai"

    phan_tich_ai_id = Column(Integer, ForeignKey("phan_tich_ai.id", ondelete="CASCADE"), unique=True, nullable=False)
    nguoi_danh_gia_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    vai_tro_nguoi_danh_gia = Column(String(20), nullable=False)
    so_sao = Column(Integer, nullable=True) # 1 - 5 sao
    chuyen_khoa_thuc_te_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    nhan_xet = Column(Text, nullable=True)

    # Quan hệ
    phan_tich_ai = relationship("PhanTichAI", back_populates="danh_gia")
