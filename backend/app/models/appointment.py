from enum import Enum
from sqlalchemy import (
    CheckConstraint, Column, String, Date, Time, Integer, ForeignKey, Text, Boolean, Index, DateTime, Numeric,
    UniqueConstraint, text
)
from sqlalchemy.orm import relationship
from app.core.config import ALLOWED_SLOT_DURATIONS
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


# Whitelist các trạng thái đang thực sự chiếm dụng slot (Occupying Statuses) theo chuẩn OpenMRS O3 / FHIR
OCCUPYING_SLOT_STATUSES = frozenset({
    TrangThaiLichEnum.DA_XAC_NHAN.value,
    TrangThaiLichEnum.DA_TIEP_NHAN.value,
    TrangThaiLichEnum.DANG_KHAM.value,
})
_OCCUPYING_CONDITION_STR = ", ".join(f"'{status}'" for status in sorted(OCCUPYING_SLOT_STATUSES))
_ACTIVE_BOOKING_CONDITION = text(f"trang_thai IN ({_OCCUPYING_CONDITION_STR})")

# Giữ CANCELLED_STATUSES cho kiểm tra điều kiện hủy/hoàn tác
CANCELLED_STATUSES = {TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value}


class TrangThaiWaitlistEnum(str, Enum):
    DANG_CHO = "dang_cho"
    DA_THONG_BAO = "da_thong_bao"
    DA_NHAN_SLOT = "da_nhan_slot"
    DA_BO_QUA = "da_bo_qua"
    DA_HUY = "da_huy"


class LoaiHangDoiEnum(str, Enum):
    """Phân loại nguồn gốc bệnh nhân trong hàng đợi theo chuẩn Bahmni Queue"""
    DUNG_HEN = "dung_hen"            # Bệnh nhân đến đúng khung giờ hẹn (trước 0-30p)
    DEN_SOM = "den_som"              # Bệnh nhân đến sớm hơn 30p so với giờ hẹn
    DEN_MUON = "den_muon"            # Bệnh nhân đến trễ hơn khung giờ hẹn (> 30p)
    VANG_LAI = "vang_lai"            # Bệnh nhân không đặt trước, lấy số tại quầy
    TRA_KET_QUA_CLS = "tra_ket_qua"  # Bệnh nhân quay lại phòng khám sau khi làm xét nghiệm


class TrangThaiHangDoiEnum(str, Enum):
    """Trạng thái điều phối thực tế tại phòng khám ngoại trú (Bahmni Clinic Queue)"""
    CHO_KHAM = "cho_kham"            # Đang đợi gọi số trước cửa phòng
    DANG_KHAM = "dang_kham"          # Đang trong phòng khám với bác sĩ
    TAM_HOAN = "tam_hoan"            # Gọi quá 3 lần không vào, tạm hoãn chờ kích hoạt lại
    DA_KHAM = "da_kham"              # Đã hoàn tất buổi khám
    BO_KHAM = "bo_kham"              # Bỏ về không khám


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

    # Khớp database/schema_postgresql.sql: mỗi bác sĩ chỉ có 1 ca sáng và 1 ca chiều mỗi ngày
    __table_args__ = (
        UniqueConstraint("bac_si_id", "ngay_lam_viec", "ca_lam_viec", name="uq_doctor_shift"),
    )


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
    trang_thai = Column(String(30), default=TrangThaiLichEnum.DA_XAC_NHAN.value, nullable=False)
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
        # Kiểm tra lịch trùng giờ của chính bệnh nhân khi đặt lịch (UC-B03)
        Index("idx_lich_kham_benh_nhan", "benh_nhan_id", "ngay_kham"),
        # Khớp các ràng buộc CHECK của database/schema_postgresql.sql
        CheckConstraint(
            f"thoi_luong_phut IN ({', '.join(str(minutes) for minutes in ALLOWED_SLOT_DURATIONS)})",
            name="ck_lich_kham_thoi_luong_phut"
        ),
        CheckConstraint("so_thu_tu > 0", name="ck_lich_kham_so_thu_tu"),
        # Chốt chặn cuối cấp CSDL (khớp database/schema_postgresql.sql): không bao giờ có 2 lịch còn hiệu lực
        # trùng giờ của cùng 1 bác sĩ hoặc cùng 1 bệnh nhân
        Index(
            "uq_active_doctor_slot", "bac_si_id", "ngay_kham", "gio_kham",
            unique=True, postgresql_where=_ACTIVE_BOOKING_CONDITION
        ),
        Index(
            "uq_active_patient_slot", "benh_nhan_id", "ngay_kham", "gio_kham",
            unique=True, postgresql_where=_ACTIVE_BOOKING_CONDITION
        ),
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


class HangDoiKham(BaseModelWithTimestamp):
    """Bảng quản lý Hàng đợi gọi số khám bệnh tại phòng khám (OpenMRS / Bahmni Queue Ticket Pattern)"""
    __tablename__ = "hang_doi_kham"

    lich_kham_id = Column(Integer, ForeignKey("lich_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    ngay_kham = Column(Date, nullable=False, index=True)
    ca_kham = Column(String(20), default=CaLamViecEnum.SANG.value, nullable=False)
    
    so_thu_tu_kham = Column(Integer, nullable=False)  # STT hiển thị trên màn hình cửa phòng (1, 2, 3...)
    loai_hang_doi = Column(String(30), default=LoaiHangDoiEnum.DUNG_HEN.value, nullable=False)
    # Mức độ ưu tiên điều phối: 1: Cấp cứu, 2: Đúng hẹn đã check-in, 3: Trả kết quả CLS, 4: Đến sớm, 5: Vãng lai / Đến muộn
    muc_do_uu_tien = Column(Integer, default=2, nullable=False, index=True)
    trang_thai = Column(String(30), default=TrangThaiHangDoiEnum.CHO_KHAM.value, nullable=False, index=True)

    thoi_gian_check_in = Column(DateTime(timezone=True), nullable=False)
    thoi_gian_goi_kham = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_bat_dau = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_ket_thuc = Column(DateTime(timezone=True), nullable=True)
    so_lan_goi = Column(Integer, default=0, nullable=False)  # Đếm số lần gọi loa (tối đa 3 lần)
    
    nguoi_tiep_nhan_id = Column(Integer, ForeignKey("tai_khoan.id", ondelete="SET NULL"), nullable=True)
    ghi_chu_dieu_phoi = Column(Text, nullable=True)

    # Quan hệ
    lich_kham = relationship("LichKham")
    benh_nhan = relationship("BenhNhan")
    bac_si = relationship("BacSi")
    nguoi_tiep_nhan = relationship("TaiKhoan")

    __table_args__ = (
        Index("idx_queue_doctor_date_status", "bac_si_id", "ngay_kham", "trang_thai", "muc_do_uu_tien"),
    )
