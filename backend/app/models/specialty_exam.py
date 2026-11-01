from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import relationship, synonym
from app.models.base import BaseModelWithTimestamp


class KhamNoiKhoa(BaseModelWithTimestamp):
    __tablename__ = "kham_noi_khoa"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lan_kham = Column(Integer, default=1, nullable=False)
    bac_si_thuc_hien_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )
    bac_si_kham_id = synonym("bac_si_thuc_hien_id")
    tuan_hoan = Column(Text, nullable=True)
    ket_qua_kham_tim_mach = synonym("tuan_hoan")
    ho_hap = Column(Text, nullable=True)
    ket_qua_kham_ho_hap = synonym("ho_hap")
    tieu_hoa = Column(Text, nullable=True)
    ket_qua_kham_tieu_hoa = synonym("tieu_hoa")
    than_tiet_nieu = Column(Text, nullable=True)
    ket_qua_kham_tiet_nieu = synonym("than_tiet_nieu")
    noi_tiet = Column(Text, nullable=True)
    than_kinh = Column(Text, nullable=True)
    ket_qua_kham_than_kinh = synonym("than_kinh")
    co_xuong_khop = Column(Text, nullable=True)
    ket_qua_kham_co_xuong_khop = synonym("co_xuong_khop")
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    ghi_chu = synonym("ket_luan_chuyen_khoa")

    luot_kham = relationship("LuotKham", back_populates="kham_noi_khoa")
    bac_si_thuc_hien = relationship("BacSi", foreign_keys=[bac_si_thuc_hien_id])
    bac_si_kham = synonym("bac_si_thuc_hien")

    __table_args__ = (
        Index("uq_kham_noi_khoa_luot_lan", "luot_kham_id", "lan_kham", unique=True),
    )


class KhamNgoaiKhoa(BaseModelWithTimestamp):
    __tablename__ = "kham_ngoai_khoa"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lan_kham = Column(Integer, default=1, nullable=False)
    bac_si_thuc_hien_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )
    bac_si_kham_id = synonym("bac_si_thuc_hien_id")
    vi_tri_ton_thuong = Column(String(255), nullable=True)
    loai_ton_thuong = Column(String(100), nullable=True)
    mo_ta_ton_thuong = Column(Text, nullable=True)
    tinh_trang_vet_thuong = Column(Text, nullable=True)
    tinh_trang_vet_mo = synonym("tinh_trang_vet_thuong")
    ket_qua_kham_thuc_the = Column(Text, nullable=True)
    he_van_dong_ngoai = synonym("ket_qua_kham_thuc_the")
    chi_dinh_phau_thuat_thu_thuat = Column(Text, nullable=True)
    chi_dinh_tieu_phau = Column(Boolean, default=False, nullable=False)
    noi_dung_thu_thuat = synonym("chi_dinh_phau_thuat_thu_thuat")
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    ghi_chu = synonym("ket_luan_chuyen_khoa")

    luot_kham = relationship("LuotKham", back_populates="kham_ngoai_khoa")
    bac_si_thuc_hien = relationship("BacSi", foreign_keys=[bac_si_thuc_hien_id])
    bac_si_kham = synonym("bac_si_thuc_hien")

    __table_args__ = (
        Index("uq_kham_ngoai_khoa_luot_lan", "luot_kham_id", "lan_kham", unique=True),
    )


class KhamMat(BaseModelWithTimestamp):
    __tablename__ = "kham_mat"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lan_kham = Column(Integer, default=1, nullable=False)
    bac_si_thuc_hien_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )
    bac_si_kham_id = synonym("bac_si_thuc_hien_id")
    thi_luc_mat_phai = Column(String(20), nullable=True)
    thi_luc_khong_kinh_phai = synonym("thi_luc_mat_phai")
    thi_luc_mat_trai = Column(String(20), nullable=True)
    thi_luc_khong_kinh_trai = synonym("thi_luc_mat_trai")
    thi_luc_co_kinh_phai = Column(String(20), nullable=True)
    thi_luc_co_kinh_trai = Column(String(20), nullable=True)
    nhan_ap_mat_phai = Column(String(20), nullable=True)
    nhan_ap_phai = synonym("nhan_ap_mat_phai")
    nhan_ap_mat_trai = Column(String(20), nullable=True)
    nhan_ap_trai = synonym("nhan_ap_mat_trai")
    ban_phan_truoc_phai = Column(Text, nullable=True)
    ban_phan_truoc_trai = Column(Text, nullable=True)
    day_mat_phai = Column(Text, nullable=True)
    day_mat_trai = Column(Text, nullable=True)
    ket_qua_kham_mat = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = synonym("ket_qua_kham_mat")
    ghi_chu = Column(Text, nullable=True)

    luot_kham = relationship("LuotKham", back_populates="kham_mat")
    bac_si_thuc_hien = relationship("BacSi", foreign_keys=[bac_si_thuc_hien_id])
    bac_si_kham = synonym("bac_si_thuc_hien")

    __table_args__ = (
        Index("uq_kham_mat_luot_lan", "luot_kham_id", "lan_kham", unique=True),
    )


class KhamTaiMuiHong(BaseModelWithTimestamp):
    __tablename__ = "kham_tai_mui_hong"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lan_kham = Column(Integer, default=1, nullable=False)
    bac_si_thuc_hien_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )
    bac_si_kham_id = synonym("bac_si_thuc_hien_id")
    thinh_luc_tai_phai = Column(String(50), nullable=True)
    thinh_luc_tai_trai = Column(String(50), nullable=True)
    tai_phai = Column(Text, nullable=True)
    tai_trai = Column(Text, nullable=True)
    ket_qua_kham_tai = synonym("tai_phai")
    mui_xoang = Column(Text, nullable=True)
    ket_qua_kham_mui = synonym("mui_xoang")
    hong_thanh_quan = Column(Text, nullable=True)
    ket_qua_kham_hong = synonym("hong_thanh_quan")
    trieu_chung_lien_quan = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = Column(Text, nullable=True)
    ghi_chu = synonym("ket_luan_chuyen_khoa")

    luot_kham = relationship("LuotKham", back_populates="kham_tai_mui_hong")
    bac_si_thuc_hien = relationship("BacSi", foreign_keys=[bac_si_thuc_hien_id])
    bac_si_kham = synonym("bac_si_thuc_hien")

    __table_args__ = (
        Index("uq_kham_tai_mui_hong_luot_lan", "luot_kham_id", "lan_kham", unique=True),
    )


class KhamRangHamMat(BaseModelWithTimestamp):
    __tablename__ = "kham_rang_ham_mat"

    luot_kham_id = Column(
        Integer,
        ForeignKey("luot_kham.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lan_kham = Column(Integer, default=1, nullable=False)
    bac_si_thuc_hien_id = Column(
        Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True
    )
    bac_si_kham_id = synonym("bac_si_thuc_hien_id")
    vi_tri_rang = Column(String(50), nullable=True)
    tinh_trang_rang = Column(Text, nullable=True)
    so_do_rang_fdi = synonym("tinh_trang_rang")
    ham_tren = Column(Text, nullable=True)
    ham_duoi = Column(Text, nullable=True)
    nha_chu_nuou = Column(Text, nullable=True)
    tinh_trang_loi = synonym("nha_chu_nuou")
    khop_can = Column(Text, nullable=True)
    ket_qua_kham_khoang_mieng = synonym("khop_can")
    huong_dieu_tri = Column(Text, nullable=True)
    ket_luan_chuyen_khoa = synonym("huong_dieu_tri")
    ghi_chu = Column(Text, nullable=True)

    luot_kham = relationship("LuotKham", back_populates="kham_rang_ham_mat")
    bac_si_thuc_hien = relationship("BacSi", foreign_keys=[bac_si_thuc_hien_id])
    bac_si_kham = synonym("bac_si_thuc_hien")

    __table_args__ = (
        Index("uq_kham_rang_ham_mat_luot_lan", "luot_kham_id", "lan_kham", unique=True),
    )
