"""Bổ sung 5 bảng khám chuyên khoa độc lập theo Kiến trúc khám 2 tầng (Two-Tier Encounter Architecture)

Revision ID: 007_add_5_specialty_exam_tables
Revises: 006_sync_erd_and_package_lifecycle
Create Date: 2026-10-24

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "007_add_5_specialty_exam_tables"
down_revision: Union[str, None] = "006_sync_erd_and_package_lifecycle"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Bảng kham_noi_khoa
    op.create_table(
        "kham_noi_khoa",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("luot_kham_id", sa.Integer(), nullable=False),
        sa.Column("tuan_hoan", sa.Text(), nullable=True),
        sa.Column("ho_hap", sa.Text(), nullable=True),
        sa.Column("tieu_hoa", sa.Text(), nullable=True),
        sa.Column("than_tiet_nieu", sa.Text(), nullable=True),
        sa.Column("noi_tiet", sa.Text(), nullable=True),
        sa.Column("than_kinh", sa.Text(), nullable=True),
        sa.Column("co_xuong_khop", sa.Text(), nullable=True),
        sa.Column("ket_luan_chuyen_khoa", sa.Text(), nullable=True),
        sa.Column("bac_si_kham_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["luot_kham_id"], ["luot_kham.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bac_si_kham_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("luot_kham_id", name="uq_kham_noi_khoa_luot_kham_id"),
    )
    op.create_index("ix_kham_noi_khoa_luot_kham_id", "kham_noi_khoa", ["luot_kham_id"], unique=True)

    # 2. Bảng kham_ngoai_khoa
    op.create_table(
        "kham_ngoai_khoa",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("luot_kham_id", sa.Integer(), nullable=False),
        sa.Column("vi_tri_ton_thuong", sa.String(length=255), nullable=True),
        sa.Column("mo_ta_ton_thuong", sa.Text(), nullable=True),
        sa.Column("tinh_trang_vet_mo", sa.Text(), nullable=True),
        sa.Column("he_van_dong_ngoai", sa.Text(), nullable=True),
        sa.Column("chi_dinh_tieu_phau", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("noi_dung_thu_thuat", sa.Text(), nullable=True),
        sa.Column("ket_luan_chuyen_khoa", sa.Text(), nullable=True),
        sa.Column("bac_si_kham_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["luot_kham_id"], ["luot_kham.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bac_si_kham_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("luot_kham_id", name="uq_kham_ngoai_khoa_luot_kham_id"),
    )
    op.create_index("ix_kham_ngoai_khoa_luot_kham_id", "kham_ngoai_khoa", ["luot_kham_id"], unique=True)

    # 3. Bảng kham_mat
    op.create_table(
        "kham_mat",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("luot_kham_id", sa.Integer(), nullable=False),
        sa.Column("thi_luc_khong_kinh_phai", sa.String(length=20), nullable=True),
        sa.Column("thi_luc_khong_kinh_trai", sa.String(length=20), nullable=True),
        sa.Column("thi_luc_co_kinh_phai", sa.String(length=20), nullable=True),
        sa.Column("thi_luc_co_kinh_trai", sa.String(length=20), nullable=True),
        sa.Column("nhan_ap_phai", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("nhan_ap_trai", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("ban_phan_truoc_phai", sa.Text(), nullable=True),
        sa.Column("ban_phan_truoc_trai", sa.Text(), nullable=True),
        sa.Column("day_mat_phai", sa.Text(), nullable=True),
        sa.Column("day_mat_trai", sa.Text(), nullable=True),
        sa.Column("ket_luan_chuyen_khoa", sa.Text(), nullable=True),
        sa.Column("bac_si_kham_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["luot_kham_id"], ["luot_kham.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bac_si_kham_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("luot_kham_id", name="uq_kham_mat_luot_kham_id"),
    )
    op.create_index("ix_kham_mat_luot_kham_id", "kham_mat", ["luot_kham_id"], unique=True)

    # 4. Bảng kham_tai_mui_hong
    op.create_table(
        "kham_tai_mui_hong",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("luot_kham_id", sa.Integer(), nullable=False),
        sa.Column("thinh_luc_tai_phai", sa.String(length=50), nullable=True),
        sa.Column("thinh_luc_tai_trai", sa.String(length=50), nullable=True),
        sa.Column("tai_phai", sa.Text(), nullable=True),
        sa.Column("tai_trai", sa.Text(), nullable=True),
        sa.Column("mui_xoang", sa.Text(), nullable=True),
        sa.Column("hong_amidan", sa.Text(), nullable=True),
        sa.Column("thanh_quan", sa.Text(), nullable=True),
        sa.Column("ket_luan_chuyen_khoa", sa.Text(), nullable=True),
        sa.Column("bac_si_kham_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["luot_kham_id"], ["luot_kham.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bac_si_kham_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("luot_kham_id", name="uq_kham_tai_mui_hong_luot_kham_id"),
    )
    op.create_index("ix_kham_tai_mui_hong_luot_kham_id", "kham_tai_mui_hong", ["luot_kham_id"], unique=True)

    # 5. Bảng kham_rang_ham_mat
    op.create_table(
        "kham_rang_ham_mat",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("luot_kham_id", sa.Integer(), nullable=False),
        sa.Column("so_do_rang_fdi", sa.Text(), nullable=True),
        sa.Column("ham_tren", sa.Text(), nullable=True),
        sa.Column("ham_duoi", sa.Text(), nullable=True),
        sa.Column("nha_chu_nuou", sa.Text(), nullable=True),
        sa.Column("khop_can", sa.String(length=100), nullable=True),
        sa.Column("niem_mac_mieng", sa.Text(), nullable=True),
        sa.Column("ket_luan_chuyen_khoa", sa.Text(), nullable=True),
        sa.Column("bac_si_kham_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["luot_kham_id"], ["luot_kham.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bac_si_kham_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("luot_kham_id", name="uq_kham_rang_ham_mat_luot_kham_id"),
    )
    op.create_index("ix_kham_rang_ham_mat_luot_kham_id", "kham_rang_ham_mat", ["luot_kham_id"], unique=True)


def downgrade() -> None:
    op.drop_table("kham_rang_ham_mat")
    op.drop_table("kham_tai_mui_hong")
    op.drop_table("kham_mat")
    op.drop_table("kham_ngoai_khoa")
    op.drop_table("kham_noi_khoa")
