from enum import Enum
from sqlalchemy import (
    CheckConstraint, Column, String, Date, Time, Integer, ForeignKey, Text, Boolean, Index, DateTime, Numeric,
    UniqueConstraint, text
)
from sqlalchemy.orm import relationship, synonym
from app.core.config import ALLOWED_SLOT_DURATIONS
from app.models.base import BaseModelWithTimestamp


class CaLamViecEnum(str, Enum):
    SANG = "sang"
    CHIEU = "chieu"


class TrangThaiLichEnum(str, Enum):
    CHO_XAC_NHAN = "cho_xac_nhan"
    DA_XAC_NHAN = "da_xac_nhan"
    DA_TIEP_NHAN = "da_tiep_nhan"
    DANG_KHAM = "dang_kham"
    DA_KHAM = "da_kham"
    DA_HUY = "da_huy"
    TU_DONG_HUY = "tu_dong_huy"
    NO_SHOW = "no_show"


OCCUPYING_SLOT_STATUSES = frozenset({
    TrangThaiLichEnum.DA_XAC_NHAN.value,
    TrangThaiLichEnum.DA_TIEP_NHAN.value,
    TrangThaiLichEnum.DANG_KHAM.value,
})
_OCCUPYING_CONDITION_STR = ", ".join(f"'{status}'" for status in sorted(OCCUPYING_SLOT_STATUSES))
_ACTIVE_BOOKING_CONDITION = text(f"trang_thai IN ({_OCCUPYING_CONDITION_STR})")
CANCELLED_STATUSES = {TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value}


class TrangThaiWaitlistEnum(str, Enum):
    DANG_CHO = "dang_cho"
    DA_THONG_BAO = "da_thong_bao"
    DA_NHAN_SLOT = "da_nhan_slot"
    DA_BO_QUA = "da_bo_qua"
    DA_HUY = "da_huy"


class LoaiHangDoiEnum(str, Enum):
    DUNG_HEN = "dung_hen"
    DEN_SOM = "den_som"
    DEN_MUON = "den_muon"
    VANG_LAI = "vang_lai"
    TRA_KET_QUA_CLS = "tra_ket_qua"


class TrangThaiHangDoiEnum(str, Enum):
    """Trạng thái điều phối thực tế tại phòng khám ngoại trú (Bahmni Clinic Queue)"""
    CHO_KHAM = "cho_kham"            # Đang đợi gọi số trước cửa phòng
    CHO_GOI = "CHO_GOI"              # Tương thích develop
    DANG_GOI = "DANG_GOI"            # Tương thích develop
    DANG_KHAM = "dang_kham"          # Đang trong phòng khám với bác sĩ
    TAM_HOAN = "tam_hoan"            # Gọi quá 3 lần không vào, tạm hoãn chờ kích hoạt lại
    DA_KHAM = "da_kham"              # Đã hoàn tất buổi khám
    BO_KHAM = "bo_kham"              # Bỏ về không khám
    DA_DONG_VE = "da_dong_ve"        # Lễ tân chủ động đóng vé (lý do hành chính)


class LyDoUuTienEnum(str, Enum):
    """Danh mục lý do ưu tiên đặc biệt khám chữa bệnh (Ưu tiên mức 1)"""
    CAP_CUU_NHE = "cap_cuu_nhe"          # Cấp cứu nhẹ
    NGUOI_GIA = "nguoi_gia"              # Người già ≥ 80 tuổi
    THAI_PHU = "thai_phu"               # Phụ nữ mang thai
    TRE_SO_SINH = "tre_so_sinh"          # Trẻ sơ sinh ≤ 6 tháng
    THUONG_BINH = "thuong_binh"          # Thương binh liệt sĩ


class LoaiNghiPhepEnum(str, Enum):
    NGHI_PHEP = "NGHI_PHEP"
    NGHI_DOT_XUAT = "NGHI_DOT_XUAT"


class TrangThaiNghiPhepEnum(str, Enum):
    CHO_DUYET = "CHO_DUYET"
    DA_DUYET = "DA_DUYET"
    TU_CHOI = "TU_CHOI"
    DA_XU_LY = "DA_XU_LY"


class LichLamViec(BaseModelWithTimestamp):
    __tablename__ = "lich_lam_viec"

    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    ngay_lam_viec = Column(Date, nullable=False, index=True)
    ca_lam_viec = Column(String(20), default=CaLamViecEnum.SANG.value, nullable=False)
    gio_bat_dau = Column(Time, nullable=False)
    gio_ket_thuc = Column(Time, nullable=False)
    buoc_gio_hen_phut = Column(Integer, default=30, nullable=False)
    gioi_han_ca_kham = Column(Integer, default=8, nullable=False)
    han_muc_dat_truoc = Column(Integer, default=6, nullable=False)
    han_muc_vang_lai = Column(Integer, default=2, nullable=False)
    so_luot_toi_da_moi_khung = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    ghi_chu_nghi = Column(Text, nullable=True)

    bac_si = relationship("BacSi", back_populates="danh_sach_lich_lam_viec")
    phong_kham = relationship("PhongKham", back_populates="danh_sach_lich_lam_viec")

    __table_args__ = (
        UniqueConstraint("bac_si_id", "ngay_lam_viec", "ca_lam_viec", name="uq_doctor_shift"),
        Index(
            "uq_room_shift",
            "phong_kham_id", "ngay_lam_viec", "ca_lam_viec",
            unique=True,
            postgresql_where=text("phong_kham_id IS NOT NULL AND is_active = true")
        ),
    )


class LichKham(BaseModelWithTimestamp):
    __tablename__ = "lich_kham"

    ma_lich_kham = Column(String(50), unique=True, nullable=False, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=True, index=True)
    lich_lam_viec_id = Column(Integer, ForeignKey("lich_lam_viec.id", ondelete="SET NULL"), nullable=True, index=True)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="RESTRICT"), nullable=True, index=True)
    ca_kham = Column(String(20), nullable=True)  # 'sang' hoặc 'chieu'
    ngay_kham = Column(Date, nullable=False, index=True)
    gio_kham = Column(Time, nullable=True, index=True)
    thoi_luong_phut = Column(Integer, default=30, nullable=False)
    so_thu_tu = Column(Integer, default=1, nullable=False)
    ly_do_kham = Column(String(255), nullable=True)
    trieu_chung_ban_dau = Column(Text, nullable=True)
    trang_thai = Column(String(30), default=TrangThaiLichEnum.DA_XAC_NHAN.value, nullable=False)
    is_reconfirmed_24h = Column(Boolean, default=False, nullable=False)
    thoi_gian_xac_nhan = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_xac_nhan_lai = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_huy = Column(DateTime(timezone=True), nullable=True)
    ly_do_huy = Column(Text, nullable=True)
    nguoi_huy_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    nguoi_huy_vai_tro = Column(String(20), nullable=True)
    phan_tich_ai_id = Column(Integer, ForeignKey("phan_tich_ai.id", ondelete="SET NULL"), nullable=True)
    idempotency_key = Column(String(64), nullable=True, index=True)

    benh_nhan = relationship("BenhNhan", back_populates="danh_sach_lich_kham")
    bac_si = relationship("BacSi", back_populates="danh_sach_lich_kham")
    lich_lam_viec = relationship("LichLamViec")
    chuyen_khoa = relationship("ChuyenKhoa")
    luot_kham = relationship("LuotKham", back_populates="lich_kham", uselist=False)
    phan_tich_ai = relationship("PhanTichAI", foreign_keys=[phan_tich_ai_id])

    __table_args__ = (
        Index("ix_doctor_schedule_date", "bac_si_id", "ngay_kham"),
        Index("idx_lich_kham_benh_nhan", "benh_nhan_id", "ngay_kham"),
        CheckConstraint(
            f"thoi_luong_phut IN ({', '.join(str(minutes) for minutes in ALLOWED_SLOT_DURATIONS)})",
            name="ck_lich_kham_thoi_luong_phut"
        ),
        CheckConstraint("so_thu_tu > 0", name="ck_lich_kham_so_thu_tu"),
        Index(
            "uq_active_doctor_slot", "bac_si_id", "ngay_kham", "gio_kham",
            unique=True,
            postgresql_where=text(f"trang_thai IN ({_OCCUPYING_CONDITION_STR}) AND bac_si_id IS NOT NULL AND gio_kham IS NOT NULL"),
            sqlite_where=text(f"trang_thai IN ({_OCCUPYING_CONDITION_STR}) AND bac_si_id IS NOT NULL AND gio_kham IS NOT NULL")
        ),
        Index(
            "uq_active_patient_slot", "benh_nhan_id", "ngay_kham", "gio_kham",
            unique=True,
            postgresql_where=text(f"trang_thai IN ({_OCCUPYING_CONDITION_STR}) AND gio_kham IS NOT NULL"),
            sqlite_where=text(f"trang_thai IN ({_OCCUPYING_CONDITION_STR}) AND gio_kham IS NOT NULL")
        ),
    )


class DanhSachCho(BaseModelWithTimestamp):
    __tablename__ = "danh_sach_cho"

    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    ngay_mong_muon = Column(Date, nullable=False, index=True)
    ca_mong_muon = Column(String(20), default=CaLamViecEnum.SANG.value, nullable=False)
    trieu_chung = Column(Text, nullable=True)
    thu_tu_uu_tien = Column(Integer, default=1, nullable=False)
    trang_thai = Column(String(30), default=TrangThaiWaitlistEnum.DANG_CHO.value, nullable=False)
    thoi_gian_thong_bao = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_het_han_giu_slot = Column(DateTime(timezone=True), nullable=True)
    slot_duoc_cap_id = Column(Integer, ForeignKey("lich_kham.id", ondelete="SET NULL"), nullable=True)

    benh_nhan = relationship("BenhNhan", back_populates="danh_sach_cho")
    bac_si = relationship("BacSi")
    phong_kham = relationship("PhongKham")


class PhanTichAI(BaseModelWithTimestamp):
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
    ma_phien_phan_tich = Column(String(100), nullable=True)

    lich_kham = relationship("LichKham", foreign_keys=[lich_kham_id])
    chuyen_khoa_goi_y = relationship("ChuyenKhoa")
    danh_gia = relationship("DanhGiaAI", back_populates="phan_tich_ai", uselist=False)
    danh_sach_goi_y = relationship("PhanTichAIGoiY", back_populates="phan_tich_ai", cascade="all, delete-orphan", lazy="selectin")


class PhanTichAIGoiY(BaseModelWithTimestamp):
    __tablename__ = "phan_tich_ai_goi_y"

    phan_tich_ai_id = Column(Integer, ForeignKey("phan_tich_ai.id", ondelete="CASCADE"), nullable=False, index=True)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="RESTRICT"), nullable=False, index=True)
    thu_tu_uu_tien = Column(Integer, default=1, nullable=False)
    do_tin_cay = Column(Numeric(5, 4), default=0.0000, nullable=False)
    ly_do_goi_y = Column(Text, nullable=True)

    phan_tich_ai = relationship("PhanTichAI", back_populates="danh_sach_goi_y")
    chuyen_khoa = relationship("ChuyenKhoa")


class DanhGiaAI(BaseModelWithTimestamp):
    __tablename__ = "danh_gia_ai"

    phan_tich_ai_id = Column(Integer, ForeignKey("phan_tich_ai.id", ondelete="CASCADE"), unique=True, nullable=False)
    nguoi_danh_gia_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    vai_tro_nguoi_danh_gia = Column(String(20), nullable=False)
    so_sao = Column(Integer, nullable=True)
    chuyen_khoa_thuc_te_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    nhan_xet = Column(Text, nullable=True)

    phan_tich_ai = relationship("PhanTichAI", back_populates="danh_gia")


class HangDoiKham(BaseModelWithTimestamp):
    __tablename__ = "hang_doi_kham"

    lich_kham_id = Column(Integer, ForeignKey("lich_kham.id", ondelete="SET NULL"), nullable=True, unique=True)
    lich_lam_viec_id = Column(Integer, ForeignKey("lich_lam_viec.id", ondelete="SET NULL"), nullable=True, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    ngay_kham = Column(Date, nullable=False, index=True)
    ca_kham = Column(String(20), default=CaLamViecEnum.SANG.value, nullable=False)
    so_thu_tu_kham = Column(Integer, nullable=False)
    loai_hang_doi = Column(String(30), default=LoaiHangDoiEnum.DUNG_HEN.value, nullable=False)
    muc_do_uu_tien = Column(Integer, default=5, nullable=False, index=True)
    trang_thai = Column(String(30), default=TrangThaiHangDoiEnum.CHO_GOI.value, nullable=False, index=True)
    thoi_gian_check_in = Column(DateTime(timezone=True), nullable=False)
    thoi_gian_xep_hang_lai = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_goi_kham = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_bat_dau = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_ket_thuc = Column(DateTime(timezone=True), nullable=True)
    so_lan_goi = Column(Integer, default=0, nullable=False)
    nguoi_tiep_nhan_id = Column(Integer, ForeignKey("tai_khoan.id", ondelete="SET NULL"), nullable=True)
    ghi_chu_dieu_phoi = Column(Text, nullable=True)

    lich_kham = relationship("LichKham")
    lich_lam_viec = relationship("LichLamViec")
    benh_nhan = relationship("BenhNhan")
    bac_si = relationship("BacSi")
    phong_kham = relationship("PhongKham")
    nguoi_tiep_nhan = relationship("TaiKhoan")

    __table_args__ = (
        Index("idx_queue_doctor_date_status", "bac_si_id", "ngay_kham", "trang_thai", "muc_do_uu_tien"),
    )


class LichDinhKyBacSi(BaseModelWithTimestamp):
    __tablename__ = "lich_dinh_ky_bac_si"

    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    thu_trong_tuan = Column(Integer, nullable=False, index=True)
    ca_lam_viec = Column(String(20), default=CaLamViecEnum.SANG.value, nullable=False)
    gio_bat_dau = Column(Time, nullable=False)
    gio_ket_thuc = Column(Time, nullable=False)
    thoi_luong_slot_phut = Column(Integer, default=20, nullable=False)
    gioi_han_ca_kham = Column(Integer, default=12, nullable=False)
    han_muc_dat_truoc = Column(Integer, default=10, nullable=False)
    han_muc_vang_lai = Column(Integer, default=2, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    bac_si = relationship("BacSi")
    phong_kham = relationship("PhongKham")

    __table_args__ = (
        UniqueConstraint("bac_si_id", "thu_trong_tuan", "ca_lam_viec", name="uq_doctor_roster_shift"),
    )


class NghiPhepBacSi(BaseModelWithTimestamp):
    __tablename__ = "nghi_phep_bac_si"

    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    loai_nghi = Column(String(30), default=LoaiNghiPhepEnum.NGHI_PHEP.value, nullable=False)
    tu_ngay = Column(Date, nullable=False, index=True)
    den_ngay = Column(Date, nullable=False, index=True)
    ca_lam_viec = Column(String(20), nullable=True)
    ly_do = Column(Text, nullable=False)
    trang_thai = Column(String(30), default=TrangThaiNghiPhepEnum.CHO_DUYET.value, nullable=False)
    nguoi_duyet_id = Column(Integer, ForeignKey("tai_khoan.id", ondelete="SET NULL"), nullable=True)
    thoi_gian_duyet = Column(DateTime(timezone=True), nullable=True)
    ghi_chu_duyet = Column(Text, nullable=True)
    so_ca_anh_huong = Column(Integer, default=0, nullable=False)
    so_lich_anh_huong = Column(Integer, default=0, nullable=False)

    bac_si = relationship("BacSi")
    phong_kham = relationship("PhongKham")
    nguoi_duyet = relationship("TaiKhoan")
