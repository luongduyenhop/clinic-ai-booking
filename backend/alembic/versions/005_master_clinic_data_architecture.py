"""Master Clinic Data Architecture (Không bao gồm quản lý kho thuốc)

Revision ID: 005_master_clinic_data_architecture
Revises: 004_tclinic_extensions
Create Date: 2026-10-12

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005_master_clinic_data_architecture"
down_revision: Union[str, None] = "004_tclinic_extensions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Bảng khoa_so_ca_truc (Biên bản bàn giao ca trực thu ngân)
    op.create_table(
        "khoa_so_ca_truc",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_khoa_so", sa.String(length=50), nullable=False),
        sa.Column("ca_lam_viec", sa.String(length=20), server_default="SANG", nullable=False),
        sa.Column("ngay_khoa_so", sa.Date(), nullable=False),
        sa.Column("thu_ngan_giao_id", sa.Integer(), nullable=False),
        sa.Column("thu_ngan_nhan_id", sa.Integer(), nullable=True),
        sa.Column("tong_tien_mat_he_thong", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("tong_chuyen_khoan_he_thong", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("tong_the_pos_he_thong", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("tien_mat_thuc_te", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("chenh_lech_tien_mat", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("tong_so_phieu_thu", sa.Integer(), server_default="0", nullable=False),
        sa.Column("tong_so_phieu_chi", sa.Integer(), server_default="0", nullable=False),
        sa.Column("trang_thai", sa.String(length=30), server_default="DA_KHOA_SO", nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["thu_ngan_giao_id"], ["nguoi_dung.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["thu_ngan_nhan_id"], ["nguoi_dung.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_khoa_so_ca_truc_ma_khoa_so", "khoa_so_ca_truc", ["ma_khoa_so"], unique=True)
    op.create_index("ix_khoa_so_ca_truc_ngay_khoa_so", "khoa_so_ca_truc", ["ngay_khoa_so"])
    op.create_index("ix_khoa_so_ca_truc_thu_ngan_giao_id", "khoa_so_ca_truc", ["thu_ngan_giao_id"])

    # 2. Bảng hop_dong_kham_doan (Khám đoàn doanh nghiệp B2B)
    op.create_table(
        "hop_dong_kham_doan",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_hop_dong", sa.String(length=50), nullable=False),
        sa.Column("ten_cong_ty", sa.String(length=255), nullable=False),
        sa.Column("ma_so_thue", sa.String(length=50), nullable=True),
        sa.Column("nguoi_dai_dien", sa.String(length=150), nullable=False),
        sa.Column("so_dien_thoai", sa.String(length=30), nullable=False),
        sa.Column("so_luong_nhan_vien", sa.Integer(), server_default="1", nullable=False),
        sa.Column("ngay_bat_dau", sa.Date(), nullable=False),
        sa.Column("ngay_ket_thuc", sa.Date(), nullable=False),
        sa.Column("gia_tri_hop_dong", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("trang_thai", sa.String(length=30), server_default="CHO_THUC_HIEN", nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hop_dong_kham_doan_ma_hop_dong", "hop_dong_kham_doan", ["ma_hop_dong"], unique=True)
    op.create_index("ix_hop_dong_kham_doan_ten_cong_ty", "hop_dong_kham_doan", ["ten_cong_ty"])

    # 3. Bảng nhan_vien_kham_doan (Nhân viên trong đoàn khám)
    op.create_table(
        "nhan_vien_kham_doan",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hop_dong_id", sa.Integer(), nullable=False),
        sa.Column("ma_nhan_vien", sa.String(length=50), nullable=False),
        sa.Column("ho_ten", sa.String(length=150), nullable=False),
        sa.Column("ngay_sinh", sa.Date(), nullable=True),
        sa.Column("gioi_tinh", sa.String(length=10), nullable=True),
        sa.Column("phong_ban", sa.String(length=100), nullable=True),
        sa.Column("so_dien_thoai", sa.String(length=30), nullable=True),
        sa.Column("cccd_so", sa.String(length=20), nullable=True),
        sa.Column("benh_nhan_id", sa.Integer(), nullable=True),
        sa.Column("phan_loai_suc_khoe", sa.String(length=20), nullable=True),
        sa.Column("trang_thai_kham", sa.String(length=30), server_default="CHUA_KHAM", nullable=False),
        sa.Column("ket_luan", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["hop_dong_id"], ["hop_dong_kham_doan.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["benh_nhan_id"], ["benh_nhan.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_nhan_vien_kham_doan_hop_dong_id", "nhan_vien_kham_doan", ["hop_dong_id"])
    op.create_index("ix_nhan_vien_kham_doan_ho_ten", "nhan_vien_kham_doan", ["ho_ten"])

    # 4. Bảng goi_dich_vu (Gói khám sức khỏe)
    op.create_table(
        "goi_dich_vu",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_goi", sa.String(length=50), nullable=False),
        sa.Column("ten_goi", sa.String(length=255), nullable=False),
        sa.Column("chuyen_khoa_chinh_id", sa.Integer(), nullable=True),
        sa.Column("doi_tuong_ap_dung", sa.String(length=100), server_default="NAM_NU_TRUONG_THANH", nullable=False),
        sa.Column("don_gia_niem_yet", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("don_gia_khuyen_mai", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("mo_ta", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(["chuyen_khoa_chinh_id"], ["chuyen_khoa.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_goi_dich_vu_ma_goi", "goi_dich_vu", ["ma_goi"], unique=True)
    op.create_index("ix_goi_dich_vu_ten_goi", "goi_dich_vu", ["ten_goi"])

    # 5. Bảng chi_tiet_goi_dich_vu
    op.create_table(
        "chi_tiet_goi_dich_vu",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("goi_dich_vu_id", sa.Integer(), nullable=False),
        sa.Column("dich_vu_id", sa.Integer(), nullable=False),
        sa.Column("so_luong", sa.Integer(), server_default="1", nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["goi_dich_vu_id"], ["goi_dich_vu.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dich_vu_id"], ["dich_vu.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chi_tiet_goi_dich_vu_goi_dich_vu_id", "chi_tiet_goi_dich_vu", ["goi_dich_vu_id"])

    # 6. Bảng dang_ky_goi_kham
    op.create_table(
        "dang_ky_goi_kham",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_dang_ky", sa.String(length=50), nullable=False),
        sa.Column("benh_nhan_id", sa.Integer(), nullable=False),
        sa.Column("goi_dich_vu_id", sa.Integer(), nullable=False),
        sa.Column("ngay_dang_ky", sa.Date(), nullable=False),
        sa.Column("han_su_dung", sa.Date(), nullable=False),
        sa.Column("tong_so_dich_vu", sa.Integer(), server_default="1", nullable=False),
        sa.Column("so_dich_vu_da_dung", sa.Integer(), server_default="0", nullable=False),
        sa.Column("trang_thai", sa.String(length=30), server_default="DANG_SU_DUNG", nullable=False),
        sa.ForeignKeyConstraint(["benh_nhan_id"], ["benh_nhan.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["goi_dich_vu_id"], ["goi_dich_vu.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dang_ky_goi_kham_ma_dang_ky", "dang_ky_goi_kham", ["ma_dang_ky"], unique=True)
    op.create_index("ix_dang_ky_goi_kham_benh_nhan_id", "dang_ky_goi_kham", ["benh_nhan_id"])

    # 7. Bảng lieu_trinh_dieu_tri (Liệu trình phục hồi chức năng/vật lý trị liệu)
    op.create_table(
        "lieu_trinh_dieu_tri",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_lieu_trinh", sa.String(length=50), nullable=False),
        sa.Column("ten_lieu_trinh", sa.String(length=255), nullable=False),
        sa.Column("benh_nhan_id", sa.Integer(), nullable=False),
        sa.Column("bac_si_phu_trach_id", sa.Integer(), nullable=False),
        sa.Column("tong_so_buoi", sa.Integer(), server_default="10", nullable=False),
        sa.Column("so_buoi_da_thuc_hien", sa.Integer(), server_default="0", nullable=False),
        sa.Column("ngay_bat_dau", sa.Date(), nullable=False),
        sa.Column("ngay_du_kien_ket_thuc", sa.Date(), nullable=True),
        sa.Column("muc_tieu_dieu_tri", sa.Text(), nullable=True),
        sa.Column("trang_thai", sa.String(length=30), server_default="DANG_DIEU_TRI", nullable=False),
        sa.ForeignKeyConstraint(["benh_nhan_id"], ["benh_nhan.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["bac_si_phu_trach_id"], ["bac_si.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lieu_trinh_dieu_tri_ma_lieu_trinh", "lieu_trinh_dieu_tri", ["ma_lieu_trinh"], unique=True)
    op.create_index("ix_lieu_trinh_dieu_tri_benh_nhan_id", "lieu_trinh_dieu_tri", ["benh_nhan_id"])

    # 8. Bảng buoi_dieu_tri
    op.create_table(
        "buoi_dieu_tri",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lieu_trinh_id", sa.Integer(), nullable=False),
        sa.Column("so_thu_tu_buoi", sa.Integer(), nullable=False),
        sa.Column("ngay_thuc_hien", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ky_thuat_vien_id", sa.Integer(), nullable=True),
        sa.Column("noi_dung_thuc_hien", sa.Text(), nullable=True),
        sa.Column("danh_gia_tien_trien", sa.Text(), nullable=True),
        sa.Column("trang_thai", sa.String(length=30), server_default="HOAN_THANH", nullable=False),
        sa.ForeignKeyConstraint(["lieu_trinh_id"], ["lieu_trinh_dieu_tri.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ky_thuat_vien_id"], ["nguoi_dung.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_buoi_dieu_tri_lieu_trinh_id", "buoi_dieu_tri", ["lieu_trinh_id"])

    # 9. Bảng mau_bieu_y_te (Mẫu chỉ định, mẫu lời dặn)
    op.create_table(
        "mau_bieu_y_te",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_mau", sa.String(length=50), nullable=False),
        sa.Column("ten_mau", sa.String(length=255), nullable=False),
        sa.Column("loai_mau", sa.String(length=30), server_default="CHI_DINH_CLS", nullable=False),
        sa.Column("chuyen_khoa_id", sa.Integer(), nullable=True),
        sa.Column("bac_si_tao_id", sa.Integer(), nullable=True),
        sa.Column("noi_dung_text", sa.Text(), nullable=False),
        sa.Column("is_public", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(["chuyen_khoa_id"], ["chuyen_khoa.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["bac_si_tao_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mau_bieu_y_te_ma_mau", "mau_bieu_y_te", ["ma_mau"], unique=True)
    op.create_index("ix_mau_bieu_y_te_ten_mau", "mau_bieu_y_te", ["ten_mau"])

    # 10. Bảng cau_hoi_y_khoa (Q&A)
    op.create_table(
        "cau_hoi_y_khoa",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tieu_de", sa.String(length=255), nullable=False),
        sa.Column("chuyen_muc", sa.String(length=50), server_default="NOI_KHOA", nullable=False),
        sa.Column("cau_hoi", sa.Text(), nullable=False),
        sa.Column("cau_tra_loi", sa.Text(), nullable=True),
        sa.Column("bac_si_tra_loi_id", sa.Integer(), nullable=True),
        sa.Column("luot_xem", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(["bac_si_tra_loi_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cau_hoi_y_khoa_tieu_de", "cau_hoi_y_khoa", ["tieu_de"])
    op.create_index("ix_cau_hoi_y_khoa_chuyen_muc", "cau_hoi_y_khoa", ["chuyen_muc"])

    # 11. Bảng bai_viet_tin_tuc
    op.create_table(
        "bai_viet_tin_tuc",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tieu_de", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("chuyen_muc", sa.String(length=50), server_default="Y_HOC_THUONG_THUC", nullable=False),
        sa.Column("anh_dai_dien_url", sa.String(length=500), nullable=True),
        sa.Column("tom_tat", sa.Text(), nullable=True),
        sa.Column("noi_dung_html", sa.Text(), nullable=False),
        sa.Column("tac_gia", sa.String(length=150), server_default="Ban Biên Tập Clinic-AI", nullable=False),
        sa.Column("luot_xem", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bai_viet_tin_tuc_tieu_de", "bai_viet_tin_tuc", ["tieu_de"])
    op.create_index("ix_bai_viet_tin_tuc_slug", "bai_viet_tin_tuc", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_table("bai_viet_tin_tuc")
    op.drop_table("cau_hoi_y_khoa")
    op.drop_table("mau_bieu_y_te")
    op.drop_table("buoi_dieu_tri")
    op.drop_table("lieu_trinh_dieu_tri")
    op.drop_table("dang_ky_goi_kham")
    op.drop_table("chi_tiet_goi_dich_vu")
    op.drop_table("goi_dich_vu")
    op.drop_table("nhan_vien_kham_doan")
    op.drop_table("hop_dong_kham_doan")
    op.drop_table("khoa_so_ca_truc")
