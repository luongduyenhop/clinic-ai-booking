import enum
from sqlalchemy import Column, String, Integer, ForeignKey, Text, Boolean, DateTime, Numeric, Date, JSON, CheckConstraint
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
    """Mô hình Concept Dictionary theo chuẩn OpenMRS - Quản lý danh mục ICD-10 và thuật ngữ y tế chuẩn"""
    __tablename__ = "khai_niem"

    ma_khai_niem = Column(String(50), unique=True, nullable=False, index=True)  # Mã WHO ICD-10: I10, J00, K29...
    ten_khai_niem = Column(String(255), nullable=False, index=True)
    loai_khai_niem = Column(String(50), default="benh_icd10", nullable=False)   # 'benh_icd10', 'trieu_chung', 'dich_vu'
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    mo_ta = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class TuKhoaCapCuu(BaseModelWithTimestamp):
    """Bảng quy tắc từ khóa cảnh báo cấp cứu (Red Flags Rules) cho bộ lọc an toàn y tế (Căn cứ pháp lý Bộ Y Tế)"""
    __tablename__ = "tu_khoa_cap_cuu"

    tu_khoa = Column(String(100), unique=True, nullable=False, index=True)  # 'đau ngực dữ dội', 'khó thở cấp', 'ngất xỉu'
    muc_do_nguy_hiem = Column(String(30), default="rat_nguy_hiem", nullable=False)
    huong_dan_xu_tri = Column(String(255), default="CẢNH BÁO NGUY HIỂM! Gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất", nullable=False)
    van_ban_byt_ref = Column(String(150), nullable=True)  # VD: "QĐ 1857/QĐ-BYT (05/07/2022) - Suy tim cấp"
    ngay_ban_hanh = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class DichVu(BaseModelWithTimestamp):
    """Bảng danh mục kỹ thuật và xét nghiệm cận lâm sàng (OpenMRS Medical Service / Thông tư 22/2023/TT-BYT)"""
    __tablename__ = "dich_vu"

    ma_dich_vu = Column(String(50), unique=True, nullable=False, index=True)
    ten_dich_vu = Column(String(150), nullable=False)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    don_gia = Column(Numeric(12, 2), default=0.00, nullable=False)
    don_vi_tinh = Column(String(30), default="Lần", nullable=False)
    quy_trinh_thuc_hien = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Chuẩn hóa phòng khám tư nhân & Điều phối cận lâm sàng
    ma_nhom_byt = Column(String(50), nullable=True) # Nhóm dịch vụ (XN, CDHA, TDCN, TT, KHAM)
    ma_tu_dong_bhyt = Column(String(50), nullable=True) # Giữ để tương thích dữ liệu cũ
    phong_thuc_hien_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True)
    thoi_gian_tra_ket_qua_phut = Column(Integer, default=30, nullable=False) # Turnaround Time (TAT)
    huong_dan_chuan_bi = Column(Text, nullable=True) # Hướng dẫn bệnh nhân chuẩn bị trước khi làm dịch vụ

    phong_thuc_hien = relationship("PhongKham", foreign_keys=[phong_thuc_hien_id], lazy="joined")
    chuyen_khoa = relationship("ChuyenKhoa", foreign_keys=[chuyen_khoa_id], lazy="joined")


class LuotKham(BaseModelWithTimestamp):
    """Phiên khám lâm sàng thực tế (OpenMRS Encounter Pattern)"""
    __tablename__ = "luot_kham"

    lich_kham_id = Column(Integer, ForeignKey("lich_kham.id", ondelete="RESTRICT"), unique=True, nullable=True)
    hang_doi_kham_id = Column(Integer, ForeignKey("hang_doi_kham.id", ondelete="SET NULL"), unique=True, nullable=True, index=True)
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
    ma_kcb = Column(String(50), nullable=True, index=True)
    trieu_chung = Column(Text, nullable=True)
    chan_doan_so_bo = Column(String(255), nullable=True)
    tien_su_di_ung = Column(Text, nullable=True)
    spo2 = Column(Numeric(4, 1), nullable=True)
    bmi = Column(Numeric(4, 1), nullable=True)
    loi_dan_tai_kham = Column(Text, nullable=True)
    ket_luan_dieu_tri = Column(Text, nullable=True)
    loi_dan_bac_si = Column(Text, nullable=True)
    ngay_hen_tai_kham = Column(Date, nullable=True)
    
    # Khóa hồ sơ bệnh án theo Thông tư 32/2023/TT-BYT (chống sửa hồi tố)
    is_locked = Column(Boolean, default=False, nullable=False)
    thoi_gian_khoa = Column(DateTime(timezone=True), nullable=True)
    nguoi_khoa_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True)
    tiep_quan_boi_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    ly_do_tiep_quan = Column(Text, nullable=True)

    # Quan hệ
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
    """Bảng phiếu khám chuyên khoa lẻ (Mắt, TMH, RHM, Da liễu, Nội...) trong một lượt khám tổng quát"""
    __tablename__ = "phieu_kham_chuyen_khoa"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False, index=True)
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="RESTRICT"), nullable=False, index=True)
    phong_kham_id = Column(Integer, ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    noi_dung_kham = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    phan_loai_suc_khoe = Column(String(20), default="LOAI_1", nullable=True)

    # Quan hệ
    luot_kham = relationship("LuotKham", back_populates="danh_sach_phieu_chuyen_khoa")
    bac_si = relationship("BacSi")
    chuyen_khoa = relationship("ChuyenKhoa")
    phong_kham = relationship("PhongKham")


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
    chi_tiet_goi_kham_da_mua_id = Column(Integer, ForeignKey("chi_tiet_dang_ky_goi_kham.id", ondelete="SET NULL"), nullable=True, index=True)
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

    # Quan hệ
    luot_kham = relationship("LuotKham", back_populates="danh_sach_chi_dinh")
    dich_vu = relationship("DichVu")
    phong_thuc_hien = relationship("PhongKham", foreign_keys=[phong_thuc_hien_id])
    ky_thuat_vien = relationship("NguoiDung", foreign_keys=[ky_thuat_vien_id])
    ket_qua = relationship("KetQuaCLS", back_populates="chi_dinh", uselist=False, cascade="all, delete-orphan")
    chi_tiet_goi_kham_da_mua = relationship("ChiTietDangKyGoiKham")


class KetQuaCLS(BaseModelWithTimestamp):
    """Bảng kết quả cận lâm sàng chi tiết (tách rời y lệnh chỉ định theo chuẩn HL7 FHIR)"""
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

    # Quan hệ
    chi_dinh = relationship("ChiDinh", back_populates="ket_qua")
    nguoi_thuc_hien = relationship("NguoiDung", foreign_keys=[nguoi_thuc_hien_id])
    bac_si_duyet = relationship("BacSi", foreign_keys=[bac_si_duyet_id])


class DonThuoc(BaseModelWithTimestamp):
    """Bảng đơn thuốc điều trị ngoại trú (OpenMRS Drug Order Header)"""
    __tablename__ = "don_thuoc"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), index=True, nullable=False)
    bac_si_ke_don_id = Column(Integer, ForeignKey("bac_si.id", ondelete="RESTRICT"), nullable=False)
    ngay_ke_don = Column(DateTime(timezone=True), nullable=False)
    loi_dan_uong_thuoc = Column(Text, nullable=True)
    ghi_chu_duoc_lam_sang = Column(Text, nullable=True)
    so_ngay_dung = Column(Integer, default=5, nullable=False)

    # Quản lý Tuân thủ Pháp lý & Liên thông Cổng Quốc gia (INT-04 / R3)
    trang_thai = Column(String(50), default="DRAFT", nullable=False)
    ma_don_quoc_gia = Column(String(100), nullable=True)
    chu_ky_so = Column(Text, nullable=True)
    ngay_ky = Column(DateTime(timezone=True), nullable=True)
    idempotency_key = Column(String(100), nullable=True, index=True)
    bien_nhan_giao_dich = Column(String(255), nullable=True)
    thoi_gian_gui_cong = Column(DateTime(timezone=True), nullable=True)
    ma_ket_qua_cong = Column(String(100), nullable=True)
    thong_diep_cong = Column(Text, nullable=True)
    superseded_by_id = Column(Integer, ForeignKey("don_thuoc.id", ondelete="SET NULL"), nullable=True)
    thay_the_cho_don_id = Column(Integer, ForeignKey("don_thuoc.id", ondelete="SET NULL"), nullable=True)
    ly_do_thay_the = Column(Text, nullable=True)
    nguoi_ky_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    du_lieu_don_thuoc_hash = Column(String(100), nullable=True)

    # Synonyms for field naming flexibility
    thoi_gian_ky = synonym("ngay_ky")
    transaction_receipt = synonym("bien_nhan_giao_dich")

    # Quan hệ
    luot_kham = relationship("LuotKham", foreign_keys=[luot_kham_id], back_populates="danh_sach_don_thuoc")
    danh_sach_chi_tiet = relationship("ChiTietDonThuoc", back_populates="don_thuoc", cascade="all, delete-orphan")
    superseded_by = relationship("DonThuoc", foreign_keys=[superseded_by_id], remote_side="[DonThuoc.id]")
    thay_the_cho_don = relationship("DonThuoc", foreign_keys=[thay_the_cho_don_id], remote_side="[DonThuoc.id]")
    nguoi_ky = relationship("BacSi", foreign_keys=[nguoi_ky_id])

    def __init__(self, **kwargs):
        if "trang_thai" not in kwargs:
            kwargs["trang_thai"] = "DRAFT"
        super().__init__(**kwargs)


class Thuoc(BaseModelWithTimestamp):
    """Bảng danh mục thuốc điều trị ngoại trú"""
    __tablename__ = "thuoc"

    ma_thuoc = Column(String(50), unique=True, nullable=False, index=True)
    ten_thuoc = Column(String(255), nullable=False, index=True)
    hoat_chat = Column(String(255), nullable=True)
    ham_luong = Column(String(100), nullable=True)
    don_vi_tinh = Column(String(30), default="Viên", nullable=False)
    duong_dung = Column(String(50), default="Uống", nullable=True)
    don_gia_niem_yet = Column(Numeric(15, 2), default=0.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


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
    lieu_sang = Column(String(20), nullable=True, default="")
    lieu_trua = Column(String(20), nullable=True, default="")
    lieu_chieu = Column(String(20), nullable=True, default="")
    lieu_toi = Column(String(20), nullable=True, default="")
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
    don_thuoc = relationship("DonThuoc", back_populates="danh_sach_chi_tiet")


class BienBanDinhChinh(BaseModelWithTimestamp):
    """Biên bản đính chính bệnh án điện tử (Medical Record Amendment/Addendum - Thông tư 32/2023/TT-BYT)"""
    __tablename__ = "bien_ban_dinh_chinh"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    thuc_the_loai = Column(
        String(50),
        nullable=False,
    )
    thuc_the_id = Column(
        Integer,
        nullable=False,
    )
    ly_do_ma = Column(
        String(50),
        nullable=True,
    )
    ly_do_text = Column(
        Text,
        nullable=False,
    )
    noi_dung_cu_json = Column(
        JSON,
        nullable=True,
    )
    noi_dung_moi_json = Column(
        JSON,
        nullable=False,
    )
    muc_do_nghiem_trong = Column(
        String(20),
        default="TRUNG_BINH",
        nullable=False,
    )
    ma_kiem_thao = Column(
        String(100),
        nullable=True,
    )
    thoi_gian_kiem_thao = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    requested_by_id = Column(
        Integer,
        ForeignKey("nguoi_dung.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    approved_by_id = Column(
        Integer,
        ForeignKey("nguoi_dung.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approved_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    trang_thai = Column(
        String(50),
        default=AmendmentStatus.CHO_PHE_DUYET.value,
        nullable=False,
    )
    ghi_chu = Column(
        Text,
        nullable=True,
    )

    # Quan hệ
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
    """Bảng hóa đơn viện phí ngoại trú (OpenMRS / FHIR Invoice & Charge Item)"""
    __tablename__ = "hoa_don"

    ma_hoa_don = Column(String(50), unique=True, nullable=False, index=True)
    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="RESTRICT"), nullable=True, index=True)
    goi_kham_da_mua_id = Column(Integer, ForeignKey("dang_ky_goi_kham.id", ondelete="SET NULL"), unique=True, nullable=True, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False, index=True)
    thu_ngan_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="RESTRICT"), nullable=False, index=True)
    tong_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    mien_giam = Column(Numeric(15, 2), default=0.00, nullable=False)
    thuc_thu = Column(Numeric(15, 2), default=0.00, nullable=False)
    phuong_thuc_thanh_toan = Column(String(30), default="tien_mat", nullable=False)
    trang_thai = Column(String(30), default="chua_thu", nullable=False, index=True)
    so_hoa_don_in = Column(String(50), nullable=True)
    ghi_chu = Column(Text, nullable=True)
    ngay_thanh_toan = Column(DateTime(timezone=True), nullable=True)

    # Quan hệ
    luot_kham = relationship("LuotKham")
    benh_nhan = relationship("BenhNhan")
    thu_ngan = relationship("NguoiDung", foreign_keys=[thu_ngan_id])
    goi_kham_da_mua = relationship("DangKyGoiKham", foreign_keys=[goi_kham_da_mua_id])
    chi_tiet_hoa_don = relationship("ChiTietHoaDon", back_populates="hoa_don", cascade="all, delete-orphan")


class ChiTietHoaDon(BaseModelWithTimestamp):
    """Bảng chi tiết từng khoản thu trong hóa đơn"""
    __tablename__ = "chi_tiet_hoa_don"

    hoa_don_id = Column(Integer, ForeignKey("hoa_don.id", ondelete="CASCADE"), nullable=False, index=True)
    loai_muc = Column(String(30), nullable=False)  # 'cong_kham', 'can_lam_sang', 'thuoc', 'vat_tu', 'khac'
    muc_tham_chieu_id = Column(Integer, nullable=True)
    chi_dinh_id = Column(Integer, ForeignKey("chi_dinh.id", ondelete="SET NULL"), nullable=True, index=True)
    goi_kham_da_mua_id = Column(Integer, ForeignKey("dang_ky_goi_kham.id", ondelete="SET NULL"), nullable=True, index=True)
    ten_khoan_thu = Column(String(255), nullable=False)
    so_luong = Column(Integer, default=1, nullable=False)
    don_gia = Column(Numeric(15, 2), default=0.00, nullable=False)
    thanh_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
    hoa_don = relationship("HoaDon", back_populates="chi_tiet_hoa_don")
    chi_dinh = relationship("ChiDinh")
    goi_kham_da_mua = relationship("DangKyGoiKham", foreign_keys=[goi_kham_da_mua_id])


class PhieuThuChi(BaseModelWithTimestamp):
    """Bảng quản lý phiếu thu / phiếu chi tiền mặt và ngân hàng"""
    __tablename__ = "phieu_thu_chi"

    ma_phieu = Column(String(50), unique=True, nullable=False, index=True)
    loai_phieu = Column(String(20), nullable=False)  # 'THU', 'CHI'
    hoa_don_id = Column(Integer, ForeignKey("hoa_don.id", ondelete="SET NULL"), nullable=True, index=True)
    nguoi_giao_dich = Column(String(255), nullable=False)
    so_tien = Column(Numeric(15, 2), default=0.00, nullable=False)
    phuong_thuc = Column(String(30), default="tien_mat", nullable=False)
    ly_do = Column(Text, nullable=False)
    nhan_vien_id = Column(Integer, ForeignKey("nguoi_dung.id", ondelete="RESTRICT"), nullable=False, index=True)
    thoi_gian = Column(DateTime(timezone=True), nullable=False)
    trang_thai_khoa_so = Column(Boolean, default=False, nullable=False)

    # Quan hệ
    hoa_don = relationship("HoaDon")
    nhan_vien = relationship("NguoiDung", foreign_keys=[nhan_vien_id])


class LuotKhamTheLuc(BaseModelWithTimestamp):
    """Bảng khám thể lực và chuyên khoa sâu theo Thông tư 32/2023/TT-BYT"""
    __tablename__ = "luot_kham_the_luc"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    chieu_cao = Column(Numeric(5, 1), nullable=True)
    can_nang = Column(Numeric(5, 1), nullable=True)
    bmi = Column(Numeric(4, 1), nullable=True)
    mach = Column(Integer, nullable=True)
    huyet_ap_tam_thu = Column(Integer, nullable=True)
    huyet_ap_tam_truong = Column(Integer, nullable=True)
    nhiet_do = Column(Numeric(4, 1), nullable=True)
    nhip_tho = Column(Integer, nullable=True)
    thi_luc_mat_phai = Column(String(20), nullable=True)
    thi_luc_mat_trai = Column(String(20), nullable=True)
    tai_mui_hong = Column(Text, nullable=True)
    rang_ham_mat = Column(Text, nullable=True)
    tuan_hoan = Column(Text, nullable=True)
    ho_hap = Column(Text, nullable=True)
    tieu_hoa = Column(Text, nullable=True)
    than_kinh = Column(Text, nullable=True)
    da_lieu = Column(Text, nullable=True)
    phan_loai_the_luc = Column(String(10), nullable=True)  # 'LOAI_I' -> 'LOAI_V'
    bac_si_ket_luan_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)

    # Quan hệ
    luot_kham = relationship("LuotKham", back_populates="kham_the_luc")
    bac_si_ket_luan = relationship("BacSi", foreign_keys=[bac_si_ket_luan_id])


class KhoaSoCaTruc(BaseModelWithTimestamp):
    """Bảng quản lý biên bản bàn giao và đóng sổ ca trực thu ngân"""
    __tablename__ = "khoa_so_ca_truc"

    ma_khoa_so = Column(String(50), unique=True, nullable=False, index=True)
    ca_lam_viec = Column(String(20), default="SANG", nullable=False)  # 'SANG', 'CHIEU', 'TOI'
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
    trang_thai = Column(String(30), default="DA_KHOA_SO", nullable=False)  # 'DA_KHOA_SO', 'DA_BAN_GIAO', 'DA_DUYET'
    ghi_chu = Column(Text, nullable=True)

    # Quan hệ
    thu_ngan_giao = relationship("NguoiDung", foreign_keys=[thu_ngan_giao_id])
    thu_ngan_nhan = relationship("NguoiDung", foreign_keys=[thu_ngan_nhan_id])


class DanhGiaDichVu(BaseModelWithTimestamp):
    """Bảng đánh giá chất lượng dịch vụ phòng khám và bác sĩ từ Khách hàng sau khi hoàn tất lượt khám"""
    __tablename__ = "danh_gia_dich_vu"

    luot_kham_id = Column(Integer, ForeignKey("luot_kham.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    benh_nhan_id = Column(Integer, ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False, index=True)
    bac_si_id = Column(Integer, ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False, index=True)
    so_sao_bac_si = Column(Integer, default=5, nullable=False)  # 1 - 5 sao
    so_sao_phong_kham = Column(Integer, default=5, nullable=False)  # 1 - 5 sao
    tieu_chi_hai_long = Column(JSON, default=dict, nullable=True)  # {'thai_do': 5, 'chuyen_mon': 5, 'thoi_gian_cho': 4}
    nhan_xet = Column(Text, nullable=True)
    an_danh = Column(Boolean, default=False, nullable=False)

    # Quan hệ
    luot_kham = relationship("LuotKham")
    benh_nhan = relationship("BenhNhan")
    bac_si = relationship("BacSi")


