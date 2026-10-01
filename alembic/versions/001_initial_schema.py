"""Khởi tạo toàn bộ schema CSDL phòng khám (initial schema)

Migration đầu tiên: tạo tất cả 18 bảng theo thiết kế OpenMRS-inspired.
Đây tương đương với "commit đầu tiên" trong Git.

Revision ID: 001_initial
Revises: None (đây là migration gốc)
Create Date: 2026-09-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# ---------------------------------------------------------------------------
# Metadata định danh migration (Alembic dùng để theo dõi thứ tự)
# ---------------------------------------------------------------------------
revision: str = "001_initial"
down_revision: Union[str, None] = None          # Không có migration trước đó
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Tạo toàn bộ ENUM types và 18 bảng CSDL.
    Được gọi khi chạy: alembic upgrade head
    """

    # ──────────────────────────────────────────────────────────────────
    # 1. Tạo ENUM types (phải tạo trước khi tạo bảng sử dụng chúng)
    # ──────────────────────────────────────────────────────────────────
    vai_tro_enum = postgresql.ENUM(
        "benh_nhan", "bac_si", "admin",
        name="vai_tro_enum", create_type=False
    )
    vai_tro_enum.create(op.get_bind(), checkfirst=True)

    ca_lam_viec_enum = postgresql.ENUM(
        "sang", "chieu",
        name="ca_lam_viec_enum", create_type=False
    )
    ca_lam_viec_enum.create(op.get_bind(), checkfirst=True)

    trang_thai_lich_enum = postgresql.ENUM(
        "cho_xac_nhan", "da_xac_nhan", "da_tiep_nhan",
        "dang_kham", "da_kham", "da_huy", "tu_dong_huy", "no_show",
        name="trang_thai_lich_enum", create_type=False
    )
    trang_thai_lich_enum.create(op.get_bind(), checkfirst=True)

    trang_thai_waitlist_enum = postgresql.ENUM(
        "dang_cho", "da_thong_bao", "da_nhan_slot", "da_bo_qua", "da_huy",
        name="trang_thai_waitlist_enum", create_type=False
    )
    trang_thai_waitlist_enum.create(op.get_bind(), checkfirst=True)

    loai_chan_doan_enum = postgresql.ENUM(
        "chinh", "phu",
        name="loai_chan_doan_enum", create_type=False
    )
    loai_chan_doan_enum.create(op.get_bind(), checkfirst=True)

    # ──────────────────────────────────────────────────────────────────
    # 2. Bảng CHUYEN_KHOA (Department)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "chuyen_khoa",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ma_chuyen_khoa", sa.String(20), nullable=False, unique=True),
        sa.Column("ten_chuyen_khoa", sa.String(100), nullable=False),
        sa.Column("mo_ta", sa.Text(), nullable=True),
        sa.Column("vi_tri_phong", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 3. Bảng NGUOI_DUNG (Person - tương tự OpenMRS Person)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "nguoi_dung",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ho_ten", sa.String(100), nullable=False),
        sa.Column("email", sa.String(150), nullable=True),
        sa.Column("so_dien_thoai", sa.String(15), nullable=True),
        sa.Column("ngay_sinh", sa.Date(), nullable=True),
        sa.Column("gioi_tinh", sa.String(10), nullable=True),
        sa.Column("dia_chi", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), onupdate=sa.text("NOW()"), nullable=True),
    )

    # ──────────────────────────────────────────────────────────────────
    # 4. Bảng TAI_KHOAN (User Account)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "tai_khoan",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nguoi_dung_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("mat_khau_hash", sa.String(255), nullable=False),
        sa.Column("vai_tro", sa.Enum("benh_nhan", "bac_si", "admin", name="vai_tro_enum"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("otp_code", sa.String(6), nullable=True),
        sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 5. Bảng BENH_NHAN (Patient - tương tự OpenMRS Patient)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "benh_nhan",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nguoi_dung_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("ma_dinh_danh_y_te", sa.String(30), nullable=True, unique=True),
        sa.Column("nhom_mau", sa.String(5), nullable=True),
        sa.Column("tien_su_benh", sa.Text(), nullable=True),
        sa.Column("di_ung_thuoc", sa.Text(), nullable=True),
        sa.Column("diem_tin_nhiem", sa.Integer(), server_default="100", nullable=False),
        sa.Column("so_lan_no_show", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 6. Bảng BAC_SI (Provider - tương tự OpenMRS Provider)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "bac_si",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nguoi_dung_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("chuyen_khoa_id", sa.Integer(), sa.ForeignKey("chuyen_khoa.id"), nullable=True),
        sa.Column("hoc_vi", sa.String(20), nullable=True),
        sa.Column("chung_chi_hanh_nghe", sa.String(50), nullable=True, unique=True),
        sa.Column("nam_kinh_nghiem", sa.Integer(), server_default="0", nullable=False),
        sa.Column("mo_ta_chuyen_sau", sa.Text(), nullable=True),
        sa.Column("gia_kham_mac_dinh", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 7. Bảng LICH_LAM_VIEC (Appointment Block - lịch trực của bác sĩ)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "lich_lam_viec",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("bac_si_id", sa.Integer(), sa.ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ngay_lam_viec", sa.Date(), nullable=False),
        sa.Column("ca_lam_viec", sa.Enum("sang", "chieu", name="ca_lam_viec_enum"), nullable=False),
        sa.Column("gio_bat_dau", sa.Time(), nullable=False),
        sa.Column("gio_ket_thuc", sa.Time(), nullable=False),
        sa.Column("gioi_han_ca_kham", sa.Integer(), server_default="8", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.UniqueConstraint("bac_si_id", "ngay_lam_viec", "ca_lam_viec", name="uq_bac_si_ngay_ca"),
    )

    # ──────────────────────────────────────────────────────────────────
    # 8. Bảng LICH_KHAM (Appointment - lịch hẹn cụ thể)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "lich_kham",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ma_lich_kham", sa.String(25), nullable=False, unique=True),
        sa.Column("benh_nhan_id", sa.Integer(), sa.ForeignKey("benh_nhan.id"), nullable=False),
        sa.Column("bac_si_id", sa.Integer(), sa.ForeignKey("bac_si.id"), nullable=False),
        sa.Column("ngay_kham", sa.Date(), nullable=False),
        sa.Column("gio_kham", sa.Time(), nullable=False),
        sa.Column("so_thu_tu", sa.Integer(), nullable=True),
        sa.Column("ly_do_kham", sa.Text(), nullable=True),
        sa.Column("trieu_chung_ban_dau", sa.Text(), nullable=True),
        sa.Column("trang_thai", sa.Enum(
            "cho_xac_nhan", "da_xac_nhan", "da_tiep_nhan",
            "dang_kham", "da_kham", "da_huy", "tu_dong_huy", "no_show",
            name="trang_thai_lich_enum"
        ), server_default="cho_xac_nhan", nullable=False),
        sa.Column("thoi_luong_phut", sa.Integer(), server_default="30", nullable=False),
        sa.Column("is_reconfirmed_24h", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("thoi_diem_dat", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("thoi_diem_xac_nhan", sa.DateTime(timezone=True), nullable=True),
        sa.Column("thoi_diem_huy", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ly_do_huy", sa.Text(), nullable=True),
        sa.Column("ghi_chu_admin", sa.Text(), nullable=True),
        sa.UniqueConstraint("bac_si_id", "ngay_kham", "gio_kham", name="uq_bac_si_slot"),
    )

    # ──────────────────────────────────────────────────────────────────
    # 9. Bảng TU_KHOA_CAP_CUU (Red Flags - từ khóa nguy hiểm cho AI)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "tu_khoa_cap_cuu",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tu_khoa", sa.String(200), nullable=False, unique=True),
        sa.Column("muc_do_nguy_hiem", sa.String(30), nullable=False),
        sa.Column("huong_dan_xu_tri", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 10. Bảng DICH_VU (Medical Service - dịch vụ cận lâm sàng)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "dich_vu",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ma_dich_vu", sa.String(20), nullable=False, unique=True),
        sa.Column("ten_dich_vu", sa.String(200), nullable=False),
        sa.Column("don_gia", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("don_vi_tinh", sa.String(20), server_default="Lần", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 11. Bảng KHAI_NIEM (Concept Dictionary - ICD-10 chuẩn hóa)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "khai_niem",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ma_khai_niem", sa.String(20), nullable=False, unique=True),
        sa.Column("ten_khai_niem", sa.String(200), nullable=False),
        sa.Column("loai_khai_niem", sa.String(50), nullable=False),
        sa.Column("mo_ta", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 12. Bảng LUOT_KHAM (Encounter - phiên khám thực tế)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "luot_kham",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("lich_kham_id", sa.Integer(), sa.ForeignKey("lich_kham.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("bac_si_id", sa.Integer(), sa.ForeignKey("bac_si.id"), nullable=False),
        sa.Column("benh_nhan_id", sa.Integer(), sa.ForeignKey("benh_nhan.id"), nullable=False),
        sa.Column("thoi_gian_bat_dau", sa.DateTime(timezone=True), nullable=True),
        sa.Column("thoi_gian_ket_thuc", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ly_do_vao_kham", sa.Text(), nullable=True),
        sa.Column("benh_su", sa.Text(), nullable=True),
        sa.Column("mach_lan_phut", sa.Integer(), nullable=True),
        sa.Column("nhiet_do_c", sa.Numeric(4, 1), nullable=True),
        sa.Column("huyet_ap_tam_thu", sa.Integer(), nullable=True),
        sa.Column("huyet_ap_tam_truong", sa.Integer(), nullable=True),
        sa.Column("ket_luan_dieu_tri", sa.Text(), nullable=True),
        sa.Column("loi_dan_bac_si", sa.Text(), nullable=True),
        sa.Column("ngay_hen_tai_kham", sa.Date(), nullable=True),
        sa.Column("is_locked", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("thoi_gian_khoa", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 13. Bảng CHAN_DOAN (Diagnosis - chẩn đoán ICD-10)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "chan_doan",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("luot_kham_id", sa.Integer(), sa.ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False),
        sa.Column("khai_niem_id", sa.Integer(), sa.ForeignKey("khai_niem.id"), nullable=True),
        sa.Column("ma_icd10", sa.String(10), nullable=False),
        sa.Column("ten_benh_chan_doan", sa.String(200), nullable=False),
        sa.Column("loai_chan_doan", sa.Enum("chinh", "phu", name="loai_chan_doan_enum"), server_default="chinh", nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
    )

    # ──────────────────────────────────────────────────────────────────
    # 14. Bảng DON_THUOC (Prescription)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "don_thuoc",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("luot_kham_id", sa.Integer(), sa.ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bac_si_ke_don_id", sa.Integer(), sa.ForeignKey("bac_si.id"), nullable=False),
        sa.Column("ngay_ke_don", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("loi_dan_uong_thuoc", sa.Text(), nullable=True),
    )

    # ──────────────────────────────────────────────────────────────────
    # 15. Bảng CHI_TIET_DON_THUOC (Prescription Detail)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "chi_tiet_don_thuoc",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("don_thuoc_id", sa.Integer(), sa.ForeignKey("don_thuoc.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ten_thuoc", sa.String(200), nullable=False),
        sa.Column("hoat_chat", sa.String(200), nullable=True),
        sa.Column("ham_luong", sa.String(50), nullable=True),
        sa.Column("don_vi_tinh", sa.String(20), nullable=False),
        sa.Column("so_luong", sa.Integer(), nullable=False),
        sa.Column("cach_dung", sa.Text(), nullable=True),
        sa.Column("so_ngay_dung", sa.Integer(), nullable=True),
    )

    # ──────────────────────────────────────────────────────────────────
    # 16. Bảng CHI_DINH_DICH_VU (Service Order - chỉ định cận lâm sàng)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "chi_dinh_dich_vu",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("luot_kham_id", sa.Integer(), sa.ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dich_vu_id", sa.Integer(), sa.ForeignKey("dich_vu.id"), nullable=False),
        sa.Column("so_luong", sa.Integer(), server_default="1", nullable=False),
        sa.Column("don_gia_tai_thoi_diem", sa.Numeric(12, 2), nullable=False),
        sa.Column("ket_qua", sa.Text(), nullable=True),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 17. Bảng HANG_CHO (Waitlist - hàng chờ slot trống)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "hang_cho",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("benh_nhan_id", sa.Integer(), sa.ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bac_si_id", sa.Integer(), sa.ForeignKey("bac_si.id"), nullable=False),
        sa.Column("ngay_mong_muon", sa.Date(), nullable=False),
        sa.Column("ca_lam_viec", sa.Enum("sang", "chieu", name="ca_lam_viec_enum"), nullable=True),
        sa.Column("trang_thai", sa.Enum(
            "dang_cho", "da_thong_bao", "da_nhan_slot", "da_bo_qua", "da_huy",
            name="trang_thai_waitlist_enum"
        ), server_default="dang_cho", nullable=False),
        sa.Column("slot_duoc_giu", sa.DateTime(timezone=True), nullable=True),
        sa.Column("han_xac_nhan", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # 18. Bảng LICH_SU_AI (AI Triage Log - lịch sử phân tích triệu chứng)
    # ──────────────────────────────────────────────────────────────────
    op.create_table(
        "lich_su_ai",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("benh_nhan_id", sa.Integer(), sa.ForeignKey("benh_nhan.id", ondelete="SET NULL"), nullable=True),
        sa.Column("trieu_chung_dau_vao", sa.Text(), nullable=False),
        sa.Column("ket_qua_phan_tich", sa.Text(), nullable=True),
        sa.Column("chuyen_khoa_goi_y", sa.String(100), nullable=True),
        sa.Column("is_red_flag", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("do_tin_cay", sa.Numeric(5, 4), nullable=True),
        sa.Column("thoi_gian_phan_tich", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    # ──────────────────────────────────────────────────────────────────
    # Index tăng tốc truy vấn thường dùng
    # ──────────────────────────────────────────────────────────────────
    op.create_index("ix_lich_kham_bac_si_ngay", "lich_kham", ["bac_si_id", "ngay_kham"])
    op.create_index("ix_lich_kham_trang_thai", "lich_kham", ["trang_thai"])
    op.create_index("ix_tai_khoan_email", "tai_khoan", ["email"])
    op.create_index("ix_lich_lam_viec_bac_si_ngay", "lich_lam_viec", ["bac_si_id", "ngay_lam_viec"])


def downgrade() -> None:
    """
    Xóa toàn bộ bảng và ENUM types (rollback về trạng thái chưa có gì).
    Được gọi khi chạy: alembic downgrade base
    """
    # Xóa bảng theo thứ tự ngược lại (tránh lỗi foreign key)
    op.drop_index("ix_lich_lam_viec_bac_si_ngay", table_name="lich_lam_viec")
    op.drop_index("ix_tai_khoan_email", table_name="tai_khoan")
    op.drop_index("ix_lich_kham_trang_thai", table_name="lich_kham")
    op.drop_index("ix_lich_kham_bac_si_ngay", table_name="lich_kham")

    op.drop_table("lich_su_ai")
    op.drop_table("hang_cho")
    op.drop_table("chi_dinh_dich_vu")
    op.drop_table("chi_tiet_don_thuoc")
    op.drop_table("don_thuoc")
    op.drop_table("chan_doan")
    op.drop_table("luot_kham")
    op.drop_table("khai_niem")
    op.drop_table("dich_vu")
    op.drop_table("tu_khoa_cap_cuu")
    op.drop_table("lich_kham")
    op.drop_table("lich_lam_viec")
    op.drop_table("bac_si")
    op.drop_table("benh_nhan")
    op.drop_table("tai_khoan")
    op.drop_table("nguoi_dung")
    op.drop_table("chuyen_khoa")

    # Xóa ENUM types sau cùng
    op.execute("DROP TYPE IF EXISTS loai_chan_doan_enum")
    op.execute("DROP TYPE IF EXISTS trang_thai_waitlist_enum")
    op.execute("DROP TYPE IF EXISTS trang_thai_lich_enum")
    op.execute("DROP TYPE IF EXISTS ca_lam_viec_enum")
    op.execute("DROP TYPE IF EXISTS vai_tro_enum")
