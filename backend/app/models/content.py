from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModelWithTimestamp


class MauBieuYTe(BaseModelWithTimestamp):
    """Bảng quản lý mẫu biểu lâm sàng (Mẫu chỉ định CLS, mẫu lời dặn bác sĩ, mẫu kết luận khám)"""
    __tablename__ = "mau_bieu_y_te"

    ma_mau = Column(String(50), unique=True, nullable=False, index=True)
    ten_mau = Column(String(255), nullable=False, index=True)
    loai_mau = Column(String(30), default="CHI_DINH_CLS", nullable=False)  # 'CHI_DINH_CLS', 'LOI_DAN', 'KET_LUAN'
    chuyen_khoa_id = Column(Integer, ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True)
    bac_si_tao_id = Column(Integer, ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    noi_dung_text = Column(Text, nullable=False)
    is_public = Column(Boolean, default=True, nullable=False)

    # Quan hệ
    chuyen_khoa = relationship("ChuyenKhoa")
    bac_si_tao = relationship("BacSi")


class BaiVietTinTuc(BaseModelWithTimestamp):
    """Bảng bài viết tin tức, y học thường thức và khuyến cáo sức khỏe"""
    __tablename__ = "bai_viet_tin_tuc"

    tieu_de = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    chuyen_muc = Column(String(50), default="Y_HOC_THUONG_THUC", nullable=False, index=True)
    anh_dai_dien_url = Column(String(500), nullable=True)
    tom_tat = Column(Text, nullable=True)
    noi_dung_html = Column(Text, nullable=False)
    tac_gia = Column(String(150), default="Ban Biên Tập Clinic-AI", nullable=False)
    luot_xem = Column(Integer, default=0, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)


class ThongBao(BaseModelWithTimestamp):
    """Bảng lưu trữ thông báo đẩy và hộp thư thông báo (Nhắc lịch, Gọi số, Trả kết quả CLS, Đôn waitlist)"""
    __tablename__ = "thong_bao"

    tai_khoan_id = Column(Integer, ForeignKey("tai_khoan.id", ondelete="CASCADE"), nullable=False, index=True)
    tieu_de = Column(String(255), nullable=False)
    noi_dung = Column(Text, nullable=False)
    loai_thong_bao = Column(String(50), default="HE_THONG", nullable=False)  # 'NHAC_LICH', 'GOI_SO', 'KET_QUA_CLS', 'DON_WAITLIST', 'HE_THONG'
    lien_ket_url = Column(String(255), nullable=True)
    du_lieu_phu_json = Column(JSON, default=dict, nullable=True)
    da_doc = Column(Boolean, default=False, nullable=False, index=True)
    thoi_gian_doc = Column(DateTime(timezone=True), nullable=True)

    # Quan hệ
    tai_khoan = relationship("TaiKhoan")

