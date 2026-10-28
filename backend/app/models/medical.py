import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, ForeignKey, Text, Boolean, DateTime, Numeric, Date, JSON, CheckConstraint, Index
from sqlalchemy.orm import relationship, synonym
from app.models.base import BaseModelWithTimestamp


class AmendmentStatus(str, enum.Enum):
    CHO_PHE_DUYET = "CHO_PHE_DUYET"
    DA_PHE_DUYET = "DA_PHE_DUYET"
    TU_CHOI = "TU_CHOI"
    HUY_BO = "HUY_BO"


class AmendmentEntityType(str, enum.Enum):
    CHAN_DOAN = "CHAN_DOAN"
    DON_THUOC = "DON_THUOC"
    CHI_TIET_DON_THUOC = "CHI_TIET_DON_THUOC"
    CHI_DINH = "CHI_DINH"
    KET_LUAN = "KET_LUAN"


class KhaiNiem(BaseModelWithTimestamp):
    __tablename__ = "khai_niem"

    ma_khai_niem = Column(String(50), unique=True, nullable=False, index=True)
    ten_khai_niem = Column(String(255), nullable=False, index=True)
    loai_khai_niem = Column(String(50), default="benh_icd10", nullable=False)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    mo_ta = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class DanhMucICD10(BaseModelWithTimestamp):
    __tablename__ = "danh_muc_icd10"

    ma_icd10 = Column(String(20), nullable=False, index=True)
    ten_benh = Column(String(255), nullable=False, index=True)
    phien_ban = Column(String(30), default="WHO_2019", nullable=False)
    mo_ta = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("uq_danh_muc_icd10_ma_phien_ban", "ma_icd10", "phien_ban", unique=True),
    )


class TuKhoaCapCuu(BaseModelWithTimestamp):
    __tablename__ = "tu_khoa_cap_cuu"

    tu_khoa = Column(String(100), unique=True, nullable=False, index=True)
    muc_do_nguy_hiem = Column(String(30), default="rat_nguy_hiem", nullable=False)
    huong_dan_xu_tri = Column(String(255), default="CẢNH BÁO NGUY HIỂM! Gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất", nullable=False)
    van_ban_byt_ref = Column(String(150), nullable=True)
    ngay_ban_hanh = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class DichVu(BaseModelWithTimestamp):
    __tablename__ = "dich_vu"

    ma_dich_vu = Column(String(50), unique=True, nullable=False, index=True)
    ten_dich_vu = Column(String(150), nullable=False)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    don_gia = Column(Numeric(12, 2), default=0.00, nullable=False)
    don_vi_tinh = Column(String(30), default="Lần", nullable=False)
    quy_trinh_thuc_hien = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    ma_nhom_byt = Column(String(50), nullable=True)
    ma_tu_dong_bhyt = Column(String(50), nullable=True)
    phong_thuc_hien_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True)
    thoi_gian_tra_ket_qua_phut = Column(Integer, default=30, nullable=False)
    huong_dan_chuan_bi = Column(Text, nullable=True)

    phong_thuc_hien = relationship("PhongKham", foreign_keys=[phong_thuc_hien_id], lazy="joined")
    chuyen_khoa = relationship("ChuyenKhoa", foreign_keys=[chuyen_khoa_id], lazy="joined")


class LuotKham(BaseModelWithTimestamp):
    __tablename__ = "luot_kham"

    ma_kcb = Column(String(50), unique=True, nullable=True, index=True)
    lich_kham_id = Column(Integer, ForeignKey("lich_kham.id", ondelete="RESTRICT"), unique=True, nullable=True)
    hang_doi_kham_id = Column(Integer, ForeignKey("hang_doi_kham.id", ondelete="SET NULL"), unique=True, nullable=True, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False)
    loai_kham = Column(String(30), default="KHAM_MOI", nullable=False)
    thoi_gian_bat_dau = Column(DateTime(timezone=True), nullable=False)
    thoi_gian_ket_thuc = Column(DateTime(timezone=True), nullable=True)
    ly_do_vao_kham = Column(Text, nullable=True)
    benh_su = Column(Text, nullable=True)
    kham_lam_sang_bo_phan = Column(Text, nullable=True)
    ma_luot_kham = synonym("ma_kcb")
    trieu_chung = Column(Text, nullable=True)
    chan_doan_so_bo = Column(String(255), nullable=True)
    tien_su_di_ung = Column(Text, nullable=True)
    mach_lan_phut = Column(Integer, nullable=True)
    nhiet_do_c = Column(Numeric(4, 1), nullable=True)
    huyet_ap_tam_thu = Column(Integer, nullable=True)
    huyet_ap_tam_truong = Column(Integer, nullable=True)
    nhip_tho_lan_phut = Column(Integer, nullable=True)
    can_nang_kg = Column(Numeric(5, 2), nullable=True)
    chieu_cao_cm = Column(Numeric(5, 2), nullable=True)
    spo2 = Column(Numeric(4, 1), nullable=True)
    bmi = Column(Numeric(4, 1), nullable=True)
    loi_dan_tai_kham = Column(Text, nullable=True)
    ket_luan_dieu_tri = Column(Text, nullable=True)
    loi_dan_bac_si = Column(Text, nullable=True)
    ngay_hen_tai_kham = Column(Date, nullable=True)
    is_locked = Column(Boolean, default=False, nullable=False)
    thoi_gian_khoa = Column(DateTime(timezone=True), nullable=True)
    nguoi_khoa_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    tiep_quan_boi_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    ly_do_tiep_quan = Column(Text, nullable=True)

    lich_kham = relationship("LichKham", back_populates="luot_kham")
    hang_doi_kham = relationship("HangDoiKham")
    danh_sach_phieu_chuyen_khoa = relationship("PhieuKhamChuyenKhoa", back_populates="luot_kham", cascade="all, delete-orphan")
    benh_nhan = relationship("BenhNhan", foreign_keys=[benh_nhan_id])
    bac_si = relationship("BacSi", foreign_keys=[bac_si_id])
    nguoi_khoa = relationship("NguoiDung", foreign_keys=[nguoi_khoa_id])
    tiep_quan_boi = relationship("BacSi", foreign_keys=[tiep_quan_boi_id])
    danh_sach_chan_doan = relationship("ChanDoan", back_populates="luot_kham", cascade="all, delete-orphan")
    danh_sach_chi_dinh = relationship("ChiDinh", back_populates="luot_kham", cascade="all, delete-orphan")
    danh_sach_don_thuoc = relationship("DonThuoc", foreign_keys="[DonThuoc.luot_kham_id]", back_populates="luot_kham", cascade="all, delete-orphan")
    don_thuoc = relationship(
        "DonThuoc",
        primaryjoin="and_(LuotKham.id == foreign(DonThuoc.luot_kham_id), DonThuoc.trang_thai != 'SUPERSEDED')",
        uselist=False,
        viewonly=True,
    )
    dinh_chinh_list = relationship("BienBanDinhChinh", back_populates="luot_kham", cascade="all, delete-orphan")
    kham_the_luc = relationship("LuotKhamTheLuc", back_populates="luot_kham", uselist=False, cascade="all, delete-orphan")
    kham_noi_khoa = relationship("KhamNoiKhoa", back_populates="luot_kham", uselist=False, cascade="all, delete-orphan")
    kham_ngoai_khoa = relationship("KhamNgoaiKhoa", back_populates="luot_kham", uselist=False, cascade="all, delete-orphan")
    kham_mat = relationship("KhamMat", back_populates="luot_kham", uselist=False, cascade="all, delete-orphan")
    kham_tai_mui_hong = relationship("KhamTaiMuiHong", back_populates="luot_kham", uselist=False, cascade="all, delete-orphan")
    kham_rang_ham_mat = relationship("KhamRangHamMat", back_populates="luot_kham", uselist=False, cascade="all, delete-orphan")


class PhieuKhamChuyenKhoa(BaseModelWithTimestamp):
    __tablename__ = "phieu_kham_chuyen_khoa"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False, index=True)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="RESTRICT"), nullable=False, index=True)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    noi_dung_kham = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    phan_loai_suc_khoe = Column(String(20), default="LOAI_1", nullable=True)

    luot_kham = relationship("LuotKham", back_populates="danh_sach_phieu_chuyen_khoa")
    bac_si = relationship("BacSi")
    chuyen_khoa = relationship("ChuyenKhoa")
    phong_kham = relationship("PhongKham")


class ChanDoan(BaseModelWithTimestamp):
    __tablename__ = "chan_doan"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    khai_niem_id = Column(Integer, ForeignKey("khai_niem.id", ondelete="RESTRICT"), nullable=True)
    danh_muc_icd10_id = Column(Integer, ForeignKey("danh_muc_icd10.id", ondelete="SET NULL"), nullable=True)
    ma_icd10 = Column(String(50), nullable=False)
    ten_benh_chan_doan = Column(String(255), nullable=False)
    loai_chan_doan = Column(String(20), default="CHINH", nullable=False)
    ghi_chu_chuyen_mon = Column(Text, nullable=True)
    bac_si_ghi_nhan_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)

    luot_kham = relationship("LuotKham", back_populates="danh_sach_chan_doan")
    khai_niem = relationship("KhaiNiem")
    danh_muc_icd10 = relationship("DanhMucICD10")
    bac_si_ghi_nhan = relationship("BacSi")


class ChiDinh(BaseModelWithTimestamp):
    __tablename__ = "chi_dinh"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    dich_vu_id = Column(Integer, ForeignKey("dich_vu.id", ondelete="RESTRICT"), nullable=False)
    so_luong = Column(Integer, default=1, nullable=False)
    don_gia_tai_thoi_diem = Column(Numeric(12, 2), default=0.00, nullable=False)
    giam_gia = Column(Numeric(12, 2), default=0.00, nullable=True)
    thanh_tien = Column(Numeric(12, 2), default=0.00, nullable=True)
    trang_thai = Column(String(30), default="da_chi_dinh", nullable=False)
    bac_si_chi_dinh_id = Column(Integer, ForeignKey("bac_si.id"), nullable=True)
    chi_tiet_goi_kham_da_mua_id = Column(Integer, nullable=True, index=True)
    ket_qua_chi_tiet = Column(Text, nullable=True)
    tep_dinh_kem_url = Column(String(255), nullable=True)
    thoi_gian_tra_ket_qua = Column(DateTime(timezone=True), nullable=True)
    ket_qua_phan_loai = Column(String(20), nullable=True, default="BINH_THUONG")
    phong_thuc_hien_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    ky_thuat_vien_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    thoi_gian_lay_mau = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_thuc_hien = Column(DateTime(timezone=True), nullable=True)
    file_dinh_kem_urls = Column(JSON, default=list, nullable=True)
    tri_so_chi_tiet = Column(JSON, default=dict, nullable=True)

    luot_kham = relationship("LuotKham", back_populates="danh_sach_chi_dinh")
    dich_vu = relationship("DichVu")
    phong_thuc_hien = relationship("PhongKham", foreign_keys=[phong_thuc_hien_id])
    ky_thuat_vien = relationship("NguoiDung", foreign_keys=[ky_thuat_vien_id])
    ket_qua = relationship("KetQuaCLS", back_populates="chi_dinh", uselist=False, cascade="all, delete-orphan")
    phieu_ket_qua = relationship("PhieuKetQuaCLS", back_populates="chi_dinh", uselist=False, cascade="all, delete-orphan")


class KetQuaCLS(BaseModelWithTimestamp):
    __tablename__ = "ket_qua_cls"

    chi_dinh_id = Column(Integer, ForeignKey("chi_dinh.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    nguoi_thuc_hien_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    bac_si_duyet_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    ket_qua_chi_tiet = Column(Text, nullable=True)
    tri_so_chi_tiet = Column(JSON, default=dict, nullable=True)
    file_dinh_kem_urls = Column(JSON, default=list, nullable=True)
    ket_qua_phan_loai = Column(String(20), default="BINH_THUONG", nullable=True)
    thoi_gian_lay_mau = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_thuc_hien = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_duyet = Column(DateTime(timezone=True), nullable=True)

    chi_dinh = relationship("ChiDinh", back_populates="ket_qua")
    nguoi_thuc_hien = relationship("NguoiDung", foreign_keys=[nguoi_thuc_hien_id])
    bac_si_duyet = relationship("BacSi", foreign_keys=[bac_si_duyet_id])


class PhieuKetQuaCLS(BaseModelWithTimestamp):
    __tablename__ = "phieu_ket_qua_cls"

    chi_dinh_id = Column(Integer, ForeignKey("chi_dinh.id", ondelete="CASCADE"), nullable=False, index=True)
    lan_thuc_hien = Column(Integer, default=1, nullable=False)
    loai_ket_qua = Column(String(30), default="XET_NGHIEM", nullable=False)
    trang_thai = Column(String(30), default="DA_CO_KET_QUA", nullable=False)
    thoi_gian_lay_mau = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_thuc_hien = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_tra_ket_qua = Column(DateTime(timezone=True), nullable=True)
    ky_thuat_vien_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    bac_si_doc_ket_qua_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    thoi_gian_doc_ket_qua = Column(DateTime(timezone=True), nullable=True)
    bac_si_duyet_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    thoi_gian_duyet = Column(DateTime(timezone=True), nullable=True)
    mo_ta_hinh_anh = Column(Text, nullable=True)
    ket_luan = Column(Text, nullable=True)
    de_nghi = Column(Text, nullable=True)
    tep_dinh_kem_urls = Column(JSON, default=list, nullable=True)
    thiet_bi_thuc_hien = Column(String(255), nullable=True)
    ghi_chu = Column(Text, nullable=True)

    chi_dinh = relationship("ChiDinh", back_populates="phieu_ket_qua")
    ky_thuat_vien = relationship("NguoiDung", foreign_keys=[ky_thuat_vien_id])
    bac_si_doc_ket_qua = relationship("BacSi", foreign_keys=[bac_si_doc_ket_qua_id])
    bac_si_duyet = relationship("BacSi", foreign_keys=[bac_si_duyet_id])
    danh_sach_chi_tiet = relationship("ChiTietKetQuaCLS", back_populates="phieu_ket_qua_cls", cascade="all, delete-orphan")

    __table_args__ = (
        Index("uq_phieu_ket_qua_cls_lan", "chi_dinh_id", "lan_thuc_hien", unique=True),
    )


class ChiTietKetQuaCLS(BaseModelWithTimestamp):
    __tablename__ = "chi_tiet_ket_qua_cls"

    phieu_ket_qua_cls_id = Column(Integer, ForeignKey("phieu_ket_qua_cls.id", ondelete="CASCADE"), nullable=False, index=True)
    ma_chi_so = Column(String(100), nullable=True)
    ten_chi_so = Column(String(255), nullable=False)
    gia_tri_text = Column(Text, nullable=True)
    gia_tri_so = Column(Numeric(18, 6), nullable=True)
    don_vi = Column(String(50), nullable=True)
    khoang_tham_chieu = Column(String(100), nullable=True)
    gia_tri_thap = Column(Numeric(18, 6), nullable=True)
    gia_tri_cao = Column(Numeric(18, 6), nullable=True)
    danh_gia = Column(String(30), nullable=True)
    thu_tu_hien_thi = Column(Integer, default=0, nullable=False)
    ghi_chu = Column(Text, nullable=True)

    phieu_ket_qua_cls = relationship("PhieuKetQuaCLS", back_populates="danh_sach_chi_tiet")


class Thuoc(BaseModelWithTimestamp):
    __tablename__ = "thuoc"

    ma_thuoc_noi_bo = Column(String(50), unique=True, nullable=False, index=True)
    ma_thuoc = synonym("ma_thuoc_noi_bo")
    ten_thuoc = Column(String(255), nullable=False, index=True)
    ten_thuong_mai = Column(String(255), nullable=True)
    hoat_chat = Column(String(255), nullable=True)
    ham_luong = Column(String(100), nullable=True)
    dang_bao_che = Column(String(100), nullable=True)
    duong_dung = Column(String(100), default="Uống", nullable=True)
    don_vi_tinh = Column(String(50), default="Viên", nullable=False)
    ma_dinh_danh_ngoai = Column(String(100), unique=True, nullable=True)
    nguon_dinh_danh = Column(String(255), nullable=True)
    trang_thai_xac_minh = Column(String(30), default="CHUA_XAC_MINH", nullable=False)
    trang_thai_danh_muc = Column(String(30), default="CHO_DUYET", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    ghi_chu = Column(Text, nullable=True)


class YeuCauBoSungThuoc(BaseModelWithTimestamp):
    __tablename__ = "yeu_cau_bo_sung_thuoc"

    ten_thuoc_de_xuat = Column(String(255), nullable=False)
    ten_thuong_mai_de_xuat = Column(String(255), nullable=True)
    hoat_chat_de_xuat = Column(String(255), nullable=True)
    ham_luong_de_xuat = Column(String(100), nullable=True)
    dang_bao_che_de_xuat = Column(String(100), nullable=True)
    duong_dung_de_xuat = Column(String(100), nullable=True)
    don_vi_tinh_de_xuat = Column(String(50), default="Viên", nullable=False)
    ma_dinh_danh_ngoai_de_xuat = Column(String(100), nullable=True)
    nguon_tham_chieu = Column(String(500), nullable=True)
    ly_do_de_xuat = Column(Text, nullable=False)
    nguoi_yeu_cau_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), nullable=False)
    thuoc_id = Column(Integer, ForeignKey("thuoc.id", ondelete="SET NULL"), nullable=True)
    trang_thai = Column(String(30), default="CHO_XU_LY", nullable=False)
    nguoi_xu_ly_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    ly_do_xu_ly = Column(Text, nullable=True)
    thoi_gian_xu_ly = Column(DateTime(timezone=True), nullable=True)

    nguoi_yeu_cau = relationship("NguoiDung", foreign_keys=[nguoi_yeu_cau_id])
    nguoi_xu_ly = relationship("NguoiDung", foreign_keys=[nguoi_xu_ly_id])
    thuoc = relationship("Thuoc")


class DonThuoc(BaseModelWithTimestamp):
    __tablename__ = "don_thuoc"

    ma_don_thuoc = Column(String(50), unique=True, nullable=True, index=True)
    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), index=True, nullable=False)
    bac_si_ke_don_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False)
    ngay_ke_don = Column(DateTime(timezone=True), nullable=False)
    loai_don_thuoc = Column(String(10), default="NGOAI_TRU", nullable=True)
    loi_dan_uong_thuoc = Column(Text, nullable=True)
    ghi_chu_duoc_lam_sang = Column(Text, nullable=True)
    so_ngay_dung = Column(Integer, default=5, nullable=False)
    trang_thai = Column(String(50), default="DRAFT", nullable=False)
    trang_thai_kiem_tra_lien_thong = Column(String(30), default="CHUA_KIEM_TRA", nullable=False)
    trang_thai_dong_bo = Column(String(30), default="CHUA_GUI", nullable=False)
    thoi_gian_kiem_tra_lien_thong = Column(DateTime(timezone=True), nullable=True)
    ma_don_quoc_gia = Column(String(100), unique=True, nullable=True)
    ma_lien_thong_bac_si_snapshot = Column(String(100), nullable=True)
    ma_lien_thong_co_so_snapshot = Column(String(100), nullable=True)
    chu_ky_so = Column(Text, nullable=True)
    ngay_ky = Column(DateTime(timezone=True), nullable=True)
    thoi_gian_ky = synonym("ngay_ky")
    idempotency_key = Column(String(100), nullable=True, index=True)
    bien_nhan_giao_dich = Column(String(255), nullable=True)
    transaction_receipt = synonym("bien_nhan_giao_dich")
    thoi_gian_gui_cong = Column(DateTime(timezone=True), nullable=True)
    ma_ket_qua_cong = Column(String(100), nullable=True)
    thong_diep_cong = Column(Text, nullable=True)
    superseded_by_id = Column(Integer, ForeignKey("don_thuoc.id", ondelete="SET NULL"), nullable=True)
    thay_the_cho_don_id = Column(Integer, ForeignKey("don_thuoc.id", ondelete="SET NULL"), nullable=True)
    ly_do_thay_the = Column(Text, nullable=True)
    nguoi_ky_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    du_lieu_don_thuoc_hash = Column(String(100), nullable=True)

    luot_kham = relationship("LuotKham", foreign_keys=[luot_kham_id], back_populates="danh_sach_don_thuoc")
    bac_si_ke_don = relationship("BacSi", foreign_keys=[bac_si_ke_don_id])
    danh_sach_chi_tiet = relationship("ChiTietDonThuoc", back_populates="don_thuoc", cascade="all, delete-orphan")
    superseded_by = relationship("DonThuoc", foreign_keys=[superseded_by_id], remote_side="[DonThuoc.id]")
    thay_the_cho_don = relationship("DonThuoc", foreign_keys=[thay_the_cho_don_id], remote_side="[DonThuoc.id]")
    nguoi_ky = relationship("BacSi", foreign_keys=[nguoi_ky_id])
    danh_sach_lich_su_dong_bo = relationship("LichSuDongBoDonThuoc", back_populates="don_thuoc", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        if "trang_thai" not in kwargs:
            kwargs["trang_thai"] = "DRAFT"
        super().__init__(**kwargs)


class ChiTietDonThuoc(BaseModelWithTimestamp):
    __tablename__ = "chi_tiet_don_thuoc"

    don_thuoc_id = Column(Integer, ForeignKey("don_thuoc.id", ondelete="CASCADE"), nullable=False, index=True)
    thuoc_id = Column(Integer, ForeignKey("thuoc.id", ondelete="RESTRICT"), nullable=True, index=True)
    ten_thuoc = Column(String(150), nullable=False)
    hoat_chat = Column(String(150), nullable=True)
    ham_luong = Column(String(50), nullable=True)
    dang_bao_che_snapshot = Column(String(100), nullable=True)
    duong_dung_snapshot = Column(String(100), nullable=True)
    ma_dinh_danh_ngoai_snapshot = Column(String(100), nullable=True)
    don_vi_tinh = Column(String(30), nullable=False)
    so_luong = Column(Integer, default=1, nullable=False)
    cach_dung = Column(Text, nullable=False)
    so_ngay_dung = Column(Integer, default=5, nullable=False)
    lieu_sang = Column(String(20), nullable=True, default="")
    lieu_trua = Column(String(20), nullable=True, default="")
    lieu_chieu = Column(String(20), nullable=True, default="")
    lieu_toi = Column(String(20), nullable=True, default="")
    ghi_chu = Column(Text, nullable=True)

    don_thuoc = relationship("DonThuoc", back_populates="danh_sach_chi_tiet")
    thuoc = relationship("Thuoc")


class LichSuDongBoDonThuoc(BaseModelWithTimestamp):
    __tablename__ = "lich_su_dong_bo_don_thuoc"

    don_thuoc_id = Column(Integer, ForeignKey("don_thuoc.id", ondelete="CASCADE"), nullable=False, index=True)
    lan_thu = Column(Integer, default=1, nullable=False)
    loai_thao_tac = Column(String(30), default="DONG_BO_MOI", nullable=False)
    thoi_gian_bat_dau = Column(DateTime(timezone=True), nullable=False)
    thoi_gian_ket_thuc = Column(DateTime(timezone=True), nullable=True)
    nguoi_thuc_hien_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    trang_thai = Column(String(30), default="DANG_XU_LY", nullable=False)
    ma_phan_hoi = Column(String(100), nullable=True)
    thong_diep_phan_hoi = Column(Text, nullable=True)
    ma_bien_nhan = Column(String(255), nullable=True)
    du_lieu_gui_hash = Column(String(128), nullable=True)
    du_lieu_phan_hoi_json = Column(JSON, nullable=True)
    idempotency_key = Column(String(100), unique=True, nullable=True)

    don_thuoc = relationship("DonThuoc", back_populates="danh_sach_lich_su_dong_bo")
    nguoi_thuc_hien = relationship("NguoiDung")


class BienBanDinhChinh(BaseModelWithTimestamp):
    __tablename__ = "bien_ban_dinh_chinh"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    thuc_the_loai = Column(String(50), nullable=False)
    thuc_the_id = Column(Integer, nullable=False)
    ly_do_ma = Column(String(50), nullable=True)
    ly_do_text = Column(Text, nullable=False)
    noi_dung_cu_json = Column(JSON, nullable=True)
    noi_dung_moi_json = Column(JSON, nullable=False)
    muc_do_nghiem_trong = Column(String(20), default="TRUNG_BINH", nullable=False)
    ma_kiem_thao = Column(String(100), nullable=True)
    thoi_gian_kiem_thao = Column(DateTime(timezone=True), nullable=True)
    requested_by_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="CASCADE"), nullable=False, index=True)
    approved_by_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    trang_thai = Column(String(50), default=AmendmentStatus.CHO_PHE_DUYET.value, nullable=False)
    ghi_chu = Column(Text, nullable=True)

    luot_kham = relationship("LuotKham", back_populates="dinh_chinh_list")
    requested_by = relationship("NguoiDung", foreign_keys=[requested_by_id])
    approved_by = relationship("NguoiDung", foreign_keys=[approved_by_id])

    __table_args__ = (
        CheckConstraint(
            "approved_by_id IS NULL OR approved_by_id != requested_by_id",
            name="ck_bien_ban_dinh_chinh_no_self_approval",
        ),
    )


class HoaDon(BaseModelWithTimestamp):
    __tablename__ = "hoa_don"

    ma_hoa_don = Column(String(50), unique=True, nullable=False, index=True)
    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="RESTRICT"), nullable=True, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False, index=True)
    kenh_ban = Column(String(20), default="TAI_QUAY", nullable=False)
    tong_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    mien_giam = Column(Numeric(15, 2), default=0.00, nullable=False)
    so_tien_phai_thu = Column(Numeric(15, 2), default=0.00, nullable=False)
    thuc_thu = Column(Numeric(15, 2), default=0.00, nullable=True)
    trang_thai = Column(String(30), default="chua_thu", nullable=False, index=True)
    nguoi_lap_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="RESTRICT"), nullable=True, index=True)
    thu_ngan_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="RESTRICT"), nullable=True, index=True)
    nguoi_huy_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    thoi_gian_huy = Column(DateTime(timezone=True), nullable=True)
    ly_do_huy = Column(Text, nullable=True)
    so_hoa_don_in = Column(String(50), nullable=True)
    ghi_chu = Column(Text, nullable=True)
    ngay_thanh_toan = Column(DateTime(timezone=True), nullable=True)
    phuong_thuc_thanh_toan = Column(String(30), default="tien_mat", nullable=True)
    goi_kham_da_mua_id = Column(Integer, nullable=True, index=True)

    def __init__(self, **kwargs):
        if "thuc_thu" in kwargs and "so_tien_phai_thu" not in kwargs:
            kwargs["so_tien_phai_thu"] = kwargs["thuc_thu"]
        elif "so_tien_phai_thu" in kwargs and "thuc_thu" not in kwargs:
            kwargs["thuc_thu"] = kwargs["so_tien_phai_thu"]
        if "thu_ngan_id" in kwargs and "nguoi_lap_id" not in kwargs:
            kwargs["nguoi_lap_id"] = kwargs["thu_ngan_id"]
        elif "nguoi_lap_id" in kwargs and "thu_ngan_id" not in kwargs:
            kwargs["thu_ngan_id"] = kwargs["nguoi_lap_id"]
        super().__init__(**kwargs)

    luot_kham = relationship("LuotKham")
    benh_nhan = relationship("BenhNhan")
    nguoi_lap = relationship("NguoiDung", foreign_keys=[nguoi_lap_id])
    nguoi_huy = relationship("NguoiDung", foreign_keys=[nguoi_huy_id])
    chi_tiet_hoa_don = relationship("ChiTietHoaDon", back_populates="hoa_don", cascade="all, delete-orphan")
    danh_sach_giao_dich = relationship("GiaoDichThanhToan", back_populates="hoa_don", cascade="all, delete-orphan")


class ChiTietHoaDon(BaseModelWithTimestamp):
    __tablename__ = "chi_tiet_hoa_don"

    hoa_don_id = Column(Integer, ForeignKey("hoa_don.id", ondelete="CASCADE"), nullable=False, index=True)
    loai_muc = Column(String(30), nullable=False)
    muc_tham_chieu_id = Column(Integer, nullable=True)
    chi_dinh_id = Column(Integer, ForeignKey("chi_dinh.id", ondelete="SET NULL"), nullable=True, index=True)
    goi_kham_da_mua_id = Column(Integer, nullable=True, index=True)
    ten_khoan_thu = Column(String(255), nullable=False)
    so_luong = Column(Integer, default=1, nullable=False)
    don_gia = Column(Numeric(15, 2), default=0.00, nullable=False)
    thanh_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    ghi_chu = Column(Text, nullable=True)

    hoa_don = relationship("HoaDon", back_populates="chi_tiet_hoa_don")
    chi_dinh = relationship("ChiDinh")


class GiaoDichThanhToan(BaseModelWithTimestamp):
    __tablename__ = "giao_dich_thanh_toan"

    ma_giao_dich = Column(String(50), unique=True, nullable=False, index=True)
    hoa_don_id = Column(Integer, ForeignKey("hoa_don.id", ondelete="CASCADE"), nullable=False, index=True)
    loai_giao_dich = Column(String(20), default="THU_VIEN_PHI", nullable=False)
    so_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    phuong_thuc = Column(String(30), default="TIEN_MAT", nullable=False)
    ma_tham_chieu_cong_thanh_toan = Column(String(255), nullable=True)
    nguon_tao_giao_dich = Column(String(20), default="TAI_QUAY", nullable=False)
    nguoi_thu_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True, index=True)
    nhan_vien_id = synonym("nguoi_thu_id")
    thoi_gian_giao_dich = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    thoi_gian = synonym("thoi_gian_giao_dich")
    thoi_gian_xac_nhan = Column(DateTime(timezone=True), nullable=True)
    trang_thai = Column(String(30), default="THANH_CONG", nullable=False)
    giao_dich_goc_id = Column(Integer, ForeignKey("giao_dich_thanh_toan.id", ondelete="SET NULL"), nullable=True)
    ghi_chu = Column(Text, nullable=True)

    hoa_don = relationship("HoaDon", back_populates="danh_sach_giao_dich")
    nguoi_thu = relationship("NguoiDung", foreign_keys=[nguoi_thu_id])
    giao_dich_goc = relationship("GiaoDichThanhToan", remote_side="[GiaoDichThanhToan.id]")


class PhieuThuChi(BaseModelWithTimestamp):
    __tablename__ = "phieu_thu_chi"

    ma_phieu = Column(String(50), unique=True, nullable=False, index=True)
    loai_phieu = Column(String(20), default="THU", nullable=False)
    hoa_don_id = Column(Integer, ForeignKey("hoa_don.id", ondelete="SET NULL"), nullable=True, index=True)
    nguoi_giao_dich = Column(String(255), nullable=False)
    so_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    phuong_thuc = Column(String(30), default="tien_mat", nullable=False)
    ly_do = Column(Text, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="RESTRICT"), nullable=False, index=True)
    thoi_gian = Column(DateTime(timezone=True), nullable=False)
    trang_thai_khoa_so = Column(Boolean, default=False, nullable=False)

    hoa_don = relationship("HoaDon")
    nhan_vien = relationship("NguoiDung", foreign_keys=[nhan_vien_id])


class LuotKhamTheLuc(BaseModelWithTimestamp):
    __tablename__ = "luot_kham_the_luc"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    thoi_gian_do = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    chieu_cao = Column(Numeric(5, 2), nullable=True)
    can_nang = Column(Numeric(5, 2), nullable=True)
    bmi = Column(Numeric(4, 1), nullable=True)
    mach = Column(Integer, nullable=True)
    huyet_ap_tam_thu = Column(Integer, nullable=True)
    huyet_ap_tam_truong = Column(Integer, nullable=True)
    nhiet_do = Column(Numeric(4, 1), nullable=True)
    nhip_tho = Column(Integer, nullable=True)
    spo2 = Column(Numeric(4, 1), nullable=True)
    thi_luc_mat_phai = Column(String(20), nullable=True)
    thi_luc_mat_trai = Column(String(20), nullable=True)
    tai_mui_hong = Column(Text, nullable=True)
    rang_ham_mat = Column(Text, nullable=True)
    tuan_hoan = Column(Text, nullable=True)
    ho_hap = Column(Text, nullable=True)
    tieu_hoa = Column(Text, nullable=True)
    than_kinh = Column(Text, nullable=True)
    da_lieu = Column(Text, nullable=True)
    phan_loai_the_luc = Column(String(10), nullable=True)
    bac_si_ket_luan_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)

    luot_kham = relationship("LuotKham", back_populates="kham_the_luc")
    bac_si_ket_luan = relationship("BacSi", foreign_keys=[bac_si_ket_luan_id])


class KhoaSoCaTruc(BaseModelWithTimestamp):
    __tablename__ = "khoa_so_ca_truc"

    ma_khoa_so = Column(String(50), unique=True, nullable=False, index=True)
    ca_lam_viec = Column(String(20), default="SANG", nullable=False)
    ngay_khoa_so = Column(Date, nullable=False, index=True)
    thu_ngan_giao_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="RESTRICT"), nullable=False, index=True)
    thu_ngan_nhan_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    tong_tien_mat_he_thong = Column(Numeric(15, 2), default=0.00, nullable=False)
    tong_chuyen_khoan_he_thong = Column(Numeric(15, 2), default=0.00, nullable=False)
    tong_the_pos_he_thong = Column(Numeric(15, 2), default=0.00, nullable=False)
    tien_mat_thuc_te = Column(Numeric(15, 2), default=0.00, nullable=False)
    chenh_lech_tien_mat = Column(Numeric(15, 2), default=0.00, nullable=False)
    tong_so_phieu_thu = Column(Integer, default=0, nullable=False)
    tong_so_phieu_chi = Column(Integer, default=0, nullable=False)
    trang_thai = Column(String(30), default="DA_KHOA_SO", nullable=False)
    ghi_chu = Column(Text, nullable=True)

    thu_ngan_giao = relationship("NguoiDung", foreign_keys=[thu_ngan_giao_id])
    thu_ngan_nhan = relationship("NguoiDung", foreign_keys=[thu_ngan_nhan_id])


class DanhGiaDichVu(BaseModelWithTimestamp):
    __tablename__ = "danh_gia_dich_vu"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    so_sao_bac_si = Column(Integer, default=5, nullable=False)
    so_sao_phong_kham = Column(Integer, default=5, nullable=False)
    tieu_chi_hai_long = Column(JSON, default=dict, nullable=True)
    nhan_xet = Column(Text, nullable=True)
    an_danh = Column(Boolean, default=False, nullable=False)

    luot_kham = relationship("LuotKham")
    benh_nhan = relationship("BenhNhan")
    bac_si = relationship("BacSi")
