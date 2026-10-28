"""Mở rộng nghiệp vụ theo khảo sát thực tế tClinic: Thu ngân, Cận lâm sàng & Khám thể lực TT32

Revision ID: 004_tclinic_extensions
Revises: 003_compliance_layer
Create Date: 2026-10-12

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004_tclinic_extensions"
down_revision: Union[str, None] = "003_compliance_layer"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Mở rộng bảng chi_dinh (Subclinical Orders)
    with op.batch_alter_table("chi_dinh") as batch_op:
        batch_op.add_column(sa.Column("phong_thuc_hien_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("ky_thuat_vien_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("thoi_gian_lay_mau", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("thoi_gian_thuc_hien", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("file_dinh_kem_urls", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("tri_so_chi_tiet", sa.JSON(), nullable=True))
        batch_op.create_foreign_key("fk_chi_dinh_phong_thuc_hien", "phong_kham", ["phong_thuc_hien_id"], ["id"], ondelete="SET NULL")
        batch_op.create_foreign_key("fk_chi_dinh_ky_thuat_vien", "nguoi_dung", ["ky_thuat_vien_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_chi_dinh_phong_thuc_hien_id", ["phong_thuc_hien_id"])

    # 2. Tạo bảng hoa_don (Cashier / Billing)
    op.create_table(
        "hoa_don",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_hoa_don", sa.String(length=50), nullable=False),
        sa.Column("luot_kham_id", sa.Integer(), nullable=False),
        sa.Column("benh_nhan_id", sa.Integer(), nullable=False),
        sa.Column("thu_ngan_id", sa.Integer(), nullable=False),
        sa.Column("tong_tien", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("mien_giam", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("thuc_thu", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("phuong_thuc_thanh_toan", sa.String(length=30), server_default="tien_mat", nullable=False),
        sa.Column("trang_thai", sa.String(length=30), server_default="chua_thu", nullable=False),
        sa.Column("so_hoa_don_in", sa.String(length=50), nullable=True),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.Column("ngay_thanh_toan", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["luot_kham_id"], ["luot_kham.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["benh_nhan_id"], ["benh_nhan.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["thu_ngan_id"], ["nguoi_dung.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hoa_don_ma_hoa_don", "hoa_don", ["ma_hoa_don"], unique=True)
    op.create_index("ix_hoa_don_luot_kham_id", "hoa_don", ["luot_kham_id"])
    op.create_index("ix_hoa_don_benh_nhan_id", "hoa_don", ["benh_nhan_id"])
    op.create_index("ix_hoa_don_thu_ngan_id", "hoa_don", ["thu_ngan_id"])
    op.create_index("ix_hoa_don_trang_thai", "hoa_don", ["trang_thai"])

    # 3. Tạo bảng chi_tiet_hoa_don (Invoice Line Items)
    op.create_table(
        "chi_tiet_hoa_don",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hoa_don_id", sa.Integer(), nullable=False),
        sa.Column("loai_muc", sa.String(length=30), nullable=False),
        sa.Column("muc_tham_chieu_id", sa.Integer(), nullable=True),
        sa.Column("ten_khoan_thu", sa.String(length=255), nullable=False),
        sa.Column("so_luong", sa.Integer(), server_default="1", nullable=False),
        sa.Column("don_gia", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("thanh_tien", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["hoa_don_id"], ["hoa_don.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chi_tiet_hoa_don_hoa_don_id", "chi_tiet_hoa_don", ["hoa_don_id"])

    # 4. Tạo bảng phieu_thu_chi (Receipt & Payment Slips)
    op.create_table(
        "phieu_thu_chi",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_phieu", sa.String(length=50), nullable=False),
        sa.Column("loai_phieu", sa.String(length=20), nullable=False),
        sa.Column("hoa_don_id", sa.Integer(), nullable=True),
        sa.Column("nguoi_giao_dich", sa.String(length=255), nullable=False),
        sa.Column("so_tien", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("phuong_thuc", sa.String(length=30), server_default="tien_mat", nullable=False),
        sa.Column("ly_do", sa.Text(), nullable=False),
        sa.Column("nhan_vien_id", sa.Integer(), nullable=False),
        sa.Column("thoi_gian", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trang_thai_khoa_so", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["hoa_don_id"], ["hoa_don.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["nhan_vien_id"], ["nguoi_dung.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_phieu_thu_chi_ma_phieu", "phieu_thu_chi", ["ma_phieu"], unique=True)
    op.create_index("ix_phieu_thu_chi_hoa_don_id", "phieu_thu_chi", ["hoa_don_id"])
    op.create_index("ix_phieu_thu_chi_nhan_vien_id", "phieu_thu_chi", ["nhan_vien_id"])

    # 5. Tạo bảng luot_kham_the_luc (Physical Exam TT32)
    op.create_table(
        "luot_kham_the_luc",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("luot_kham_id", sa.Integer(), nullable=False),
        sa.Column("chieu_cao", sa.Numeric(precision=5, scale=1), nullable=True),
        sa.Column("can_nang", sa.Numeric(precision=5, scale=1), nullable=True),
        sa.Column("bmi", sa.Numeric(precision=4, scale=1), nullable=True),
        sa.Column("mach", sa.Integer(), nullable=True),
        sa.Column("huyet_ap_tam_thu", sa.Integer(), nullable=True),
        sa.Column("huyet_ap_tam_truong", sa.Integer(), nullable=True),
        sa.Column("nhiet_do", sa.Numeric(precision=4, scale=1), nullable=True),
        sa.Column("nhip_tho", sa.Integer(), nullable=True),
        sa.Column("thi_luc_mat_phai", sa.String(length=20), nullable=True),
        sa.Column("thi_luc_mat_trai", sa.String(length=20), nullable=True),
        sa.Column("tai_mui_hong", sa.Text(), nullable=True),
        sa.Column("rang_ham_mat", sa.Text(), nullable=True),
        sa.Column("tuan_hoan", sa.Text(), nullable=True),
        sa.Column("ho_hap", sa.Text(), nullable=True),
        sa.Column("tieu_hoa", sa.Text(), nullable=True),
        sa.Column("than_kinh", sa.Text(), nullable=True),
        sa.Column("da_lieu", sa.Text(), nullable=True),
        sa.Column("phan_loai_the_luc", sa.String(length=10), nullable=True),
        sa.Column("bac_si_ket_luan_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["luot_kham_id"], ["luot_kham.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bac_si_ket_luan_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("luot_kham_id"),
    )
    op.create_index("ix_luot_kham_the_luc_luot_kham_id", "luot_kham_the_luc", ["luot_kham_id"])


def downgrade() -> None:
    # 5. Drop luot_kham_the_luc
    op.drop_index("ix_luot_kham_the_luc_luot_kham_id", table_name="luot_kham_the_luc")
    op.drop_table("luot_kham_the_luc")

    # 4. Drop phieu_thu_chi
    op.drop_index("ix_phieu_thu_chi_nhan_vien_id", table_name="phieu_thu_chi")
    op.drop_index("ix_phieu_thu_chi_hoa_don_id", table_name="phieu_thu_chi")
    op.drop_index("ix_phieu_thu_chi_ma_phieu", table_name="phieu_thu_chi")
    op.drop_table("phieu_thu_chi")

    # 3. Drop chi_tiet_hoa_don
    op.drop_index("ix_chi_tiet_hoa_don_hoa_don_id", table_name="chi_tiet_hoa_don")
    op.drop_table("chi_tiet_hoa_don")

    # 2. Drop hoa_don
    op.drop_index("ix_hoa_don_trang_thai", table_name="hoa_don")
    op.drop_index("ix_hoa_don_thu_ngan_id", table_name="hoa_don")
    op.drop_index("ix_hoa_don_benh_nhan_id", table_name="hoa_don")
    op.drop_index("ix_hoa_don_luot_kham_id", table_name="hoa_don")
    op.drop_index("ix_hoa_don_ma_hoa_don", table_name="hoa_don")
    op.drop_table("hoa_don")

    # 1. Rollback chi_dinh
    with op.batch_alter_table("chi_dinh") as batch_op:
        batch_op.drop_index("ix_chi_dinh_phong_thuc_hien_id")
        batch_op.drop_constraint("fk_chi_dinh_ky_thuat_vien", type_="foreignkey")
        batch_op.drop_constraint("fk_chi_dinh_phong_thuc_hien", type_="foreignkey")
        batch_op.drop_column("tri_so_chi_tiet")
        batch_op.drop_column("file_dinh_kem_urls")
        batch_op.drop_column("thoi_gian_thuc_hien")
        batch_op.drop_column("thoi_gian_lay_mau")
        batch_op.drop_column("ky_thuat_vien_id")
        batch_op.drop_column("phong_thuc_hien_id")
