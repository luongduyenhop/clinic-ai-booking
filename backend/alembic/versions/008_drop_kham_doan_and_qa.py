"""Drop Kham Doan B2B and Hoi Dap Y Khoa tables

Revision ID: 008_drop_kham_doan_and_qa
Revises: 007_add_5_specialty_exam_tables
Create Date: 2026-10-13

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008_drop_kham_doan_and_qa"
down_revision: Union[str, None] = "007_add_5_specialty_exam_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Thứ tự drop: Drop bảng con nhan_vien_kham_doan trước (chứa FK hop_dong_id), sau đó drop hop_dong_kham_doan
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "nhan_vien_kham_doan" in tables:
        op.drop_table("nhan_vien_kham_doan")
    if "hop_dong_kham_doan" in tables:
        op.drop_table("hop_dong_kham_doan")
    if "cau_hoi_y_khoa" in tables:
        op.drop_table("cau_hoi_y_khoa")


def downgrade() -> None:
    # Tái tạo lại nếu cần rollback
    op.create_table(
        "cau_hoi_y_khoa",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tieu_de", sa.String(length=255), nullable=False),
        sa.Column("chuyen_muc", sa.String(length=50), nullable=False),
        sa.Column("cau_hoi", sa.Text(), nullable=False),
        sa.Column("cau_tra_loi", sa.Text(), nullable=True),
        sa.Column("bac_si_tra_loi_id", sa.Integer(), nullable=True),
        sa.Column("luot_xem", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["bac_si_tra_loi_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

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
        sa.Column("so_luong_nhan_vien", sa.Integer(), nullable=False),
        sa.Column("ngay_bat_dau", sa.Date(), nullable=False),
        sa.Column("ngay_ket_thuc", sa.Date(), nullable=False),
        sa.Column("gia_tri_hop_dong", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("trang_thai", sa.String(length=30), nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ma_hop_dong"),
    )

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
        sa.Column("trang_thai_kham", sa.String(length=30), nullable=False),
        sa.Column("ket_luan", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["benh_nhan_id"], ["benh_nhan.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["hop_dong_id"], ["hop_dong_kham_doan.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
