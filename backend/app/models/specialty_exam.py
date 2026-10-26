from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class KhamNoiKhoa(BaseModelWithTimestamp):
    """Bảng khám chuyên khoa Nội (Tuần hoàn, Hô hấp, Tiêu hóa, Thận-Tiết niệu, Thần kinh, Cơ xương khớp)"""
    __tablename__ = "kham_noi_khoa"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    tuan_hoan = Column(Text, nullable=True)
    ho_hap = Column(Text, nullable=True)
    tieu_hoa = Column(Text, nullable=True)
    than_tiet_nieu = Column(Text, nullable=True)
    noi_tiet = Column(Text, nullable=True)
    than_kinh = Column(Text, nullable=True)
    co_xuong_khop = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    bac_si_kham_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )

    luot_kham = relationship("LuotKham", back_populates="kham_noi_khoa")
    bac_si_kham = relationship("BacSi")


class KhamNgoaiKhoa(BaseModelWithTimestamp):
    """Bảng khám chuyên khoa Ngoại (Vết thương, khối u, thoát vị, chỉ định tiểu phẫu / thủ thuật)"""
    __tablename__ = "kham_ngoai_khoa"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    vi_tri_ton_thuong = Column(String(255), nullable=True)
    mo_ta_ton_thuong = Column(Text, nullable=True)
    tinh_trang_vet_mo = Column(Text, nullable=True)
    he_van_dong_ngoai = Column(Text, nullable=True)
    chi_dinh_tieu_phau = Column(Boolean, default=False, nullable=False)
    noi_dung_thu_thuat = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    bac_si_kham_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )

    luot_kham = relationship("LuotKham", back_populates="kham_ngoai_khoa")
    bac_si_kham = relationship("BacSi")


class KhamMat(BaseModelWithTimestamp):
    """Bảng khám chuyên khoa Mắt - Nhãn khoa (Thị lực Snellen OD/OS, Nhãn áp, Bán phần trước, Đáy mắt)"""
    __tablename__ = "kham_mat"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    thi_luc_khong_kinh_phai = Column(String(20), nullable=True)
    thi_luc_khong_kinh_trai = Column(String(20), nullable=True)
    thi_luc_co_kinh_phai = Column(String(20), nullable=True)
    thi_luc_co_kinh_trai = Column(String(20), nullable=True)
    nhan_ap_phai = Column(Numeric(5, 2), nullable=True)
    nhan_ap_trai = Column(Numeric(5, 2), nullable=True)
    ban_phan_truoc_phai = Column(Text, nullable=True)
    ban_phan_truoc_trai = Column(Text, nullable=True)
    day_mat_phai = Column(Text, nullable=True)
    day_mat_trai = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    bac_si_kham_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )

    luot_kham = relationship("LuotKham", back_populates="kham_mat")
    bac_si_kham = relationship("BacSi")


class KhamTaiMuiHong(BaseModelWithTimestamp):
    """Bảng khám chuyên khoa Tai Mũi Họng (Nội soi Tai, Mũi xoang, Họng - Thanh quản)"""
    __tablename__ = "kham_tai_mui_hong"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    thinh_luc_tai_phai = Column(String(50), nullable=True)
    thinh_luc_tai_trai = Column(String(50), nullable=True)
    tai_phai = Column(Text, nullable=True)
    tai_trai = Column(Text, nullable=True)
    mui_xoang = Column(Text, nullable=True)
    hong_amidan = Column(Text, nullable=True)
    thanh_quan = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    bac_si_kham_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )

    luot_kham = relationship("LuotKham", back_populates="kham_tai_mui_hong")
    bac_si_kham = relationship("BacSi")


class KhamRangHamMat(BaseModelWithTimestamp):
    """Bảng khám chuyên khoa Răng Hàm Mặt (Sơ đồ răng FDI 32 răng, Nha chu, Khớp cắn, Niêm mạc miệng)"""
    __tablename__ = "kham_rang_ham_mat"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    so_do_rang_fdi = Column(Text, nullable=True)  # Chuỗi JSON lưu trạng thái răng 11..48
    ham_tren = Column(Text, nullable=True)
    ham_duoi = Column(Text, nullable=True)
    nha_chu_nuou = Column(Text, nullable=True)
    khop_can = Column(String(100), nullable=True)
    niem_mac_mieng = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    bac_si_kham_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )

    luot_kham = relationship("LuotKham", back_populates="kham_rang_ham_mat")
    bac_si_kham = relationship("BacSi")
