"""Thêm các bảng và trường tuân thủ pháp lý y tế (INT-05, INT-04, INT-03)

Revision ID: 003_compliance_layer
Revises: 002_add_refresh_token
Create Date: 2026-10-11

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003_compliance_layer"
down_revision: Union[str, None] = "002_add_refresh_token"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Bảng giay_phep_co_so (Facility Credentialing - INT-05)
    op.create_table(
        "giay_phep_co_so",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("so_giay_phep", sa.String(length=100), nullable=False),
        sa.Column("ten_co_so", sa.String(length=255), nullable=False),
        sa.Column("ngay_cap", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ngay_het_han", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pham_vi_hoat_dong", sa.Text(), nullable=True),
        sa.Column("trang_thai", sa.String(length=50), nullable=False, server_default="ACTIVE"),
        sa.Column("tep_dinh_kem_url", sa.String(length=500), nullable=True),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_giay_phep_co_so_so_giay_phep", "giay_phep_co_so", ["so_giay_phep"], unique=True)
    op.create_index("ix_giay_phep_co_so_ngay_het_han", "giay_phep_co_so", ["ngay_het_han"], unique=False)
    op.create_index("ix_giay_phep_co_so_trang_thai", "giay_phep_co_so", ["trang_thai"], unique=False)

    # 2. Bảng lich_su_giay_phep_bac_si (Doctor Credential Audit - INT-05)
    op.create_table(
        "lich_su_giay_phep_bac_si",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("bac_si_id", sa.Integer(), nullable=False),
        sa.Column("trang_thai_cu", sa.String(length=50), nullable=True),
        sa.Column("trang_thai_moi", sa.String(length=50), nullable=False),
        sa.Column("nguoi_thuc_hien_id", sa.Integer(), nullable=True),
        sa.Column("ly_do", sa.Text(), nullable=False),
        sa.Column("ngay_hieu_luc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["bac_si_id"], ["bac_si.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["nguoi_thuc_hien_id"], ["tai_khoan.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lich_su_giay_phep_bac_si_bac_si_id", "lich_su_giay_phep_bac_si", ["bac_si_id"], unique=False)

    # 3. Bảng nhat_ky_truy_cap_y_te (Health Data Access Log - INT-03 / NĐ 102/2025/NĐ-CP)
    op.create_table(
        "nhat_ky_truy_cap_y_te",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("user_role", sa.String(length=50), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("purpose", sa.String(length=255), nullable=False),
        sa.Column("client_ip", sa.String(length=50), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_nhat_ky_truy_cap_y_te_user_id", "nhat_ky_truy_cap_y_te", ["user_id"], unique=False)
    op.create_index("ix_nhat_ky_truy_cap_y_te_patient_id", "nhat_ky_truy_cap_y_te", ["patient_id"], unique=False)

    # 4. Thêm các cột cho bảng bac_si
    op.add_column("bac_si", sa.Column("ngay_cap", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bac_si", sa.Column("ngay_het_han", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bac_si", sa.Column("pham_vi_chuyen_mon", sa.JSON(), nullable=True))
    op.add_column("bac_si", sa.Column("trang_thai_giay_phep", sa.String(length=50), nullable=False, server_default="ACTIVE"))
    op.add_column("bac_si", sa.Column("tep_dinh_kem_url", sa.String(length=500), nullable=True))
    op.create_index("ix_bac_si_ngay_het_han", "bac_si", ["ngay_het_han"], unique=False)
    op.create_index("ix_bac_si_trang_thai_giay_phep", "bac_si", ["trang_thai_giay_phep"], unique=False)

    # 5. Thêm các cột cho bảng don_thuoc (Prescription FSM & Gateway - INT-04)
    op.add_column("don_thuoc", sa.Column("trang_thai", sa.String(length=50), nullable=False, server_default="DRAFT"))
    op.add_column("don_thuoc", sa.Column("ma_don_quoc_gia", sa.String(length=100), nullable=True))
    op.add_column("don_thuoc", sa.Column("chu_ky_so", sa.Text(), nullable=True))
    op.add_column("don_thuoc", sa.Column("ngay_ky", sa.DateTime(timezone=True), nullable=True))
    op.add_column("don_thuoc", sa.Column("idempotency_key", sa.String(length=100), nullable=True))
    op.add_column("don_thuoc", sa.Column("bien_nhan_giao_dich", sa.String(length=255), nullable=True))
    op.add_column("don_thuoc", sa.Column("thoi_gian_gui_cong", sa.DateTime(timezone=True), nullable=True))
    op.add_column("don_thuoc", sa.Column("ma_ket_qua_cong", sa.String(length=100), nullable=True))
    op.add_column("don_thuoc", sa.Column("thong_diep_cong", sa.Text(), nullable=True))
    op.add_column("don_thuoc", sa.Column("superseded_by_id", sa.Integer(), nullable=True))
    op.add_column("don_thuoc", sa.Column("thay_the_cho_don_id", sa.Integer(), nullable=True))
    op.add_column("don_thuoc", sa.Column("ly_do_thay_the", sa.Text(), nullable=True))
    op.add_column("don_thuoc", sa.Column("nguoi_ky_id", sa.Integer(), nullable=True))
    op.add_column("don_thuoc", sa.Column("du_lieu_don_thuoc_hash", sa.String(length=100), nullable=True))

    op.create_index("ix_don_thuoc_idempotency_key", "don_thuoc", ["idempotency_key"], unique=False)
    op.create_foreign_key("fk_don_thuoc_superseded_by_id", "don_thuoc", "don_thuoc", ["superseded_by_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_don_thuoc_thay_the_cho_don_id", "don_thuoc", "don_thuoc", ["thay_the_cho_don_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_don_thuoc_nguoi_ky_id", "don_thuoc", "bac_si", ["nguoi_ky_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    # Rollback don_thuoc
    op.drop_constraint("fk_don_thuoc_nguoi_ky_id", "don_thuoc", type_="foreignkey")
    op.drop_constraint("fk_don_thuoc_thay_the_cho_don_id", "don_thuoc", type_="foreignkey")
    op.drop_constraint("fk_don_thuoc_superseded_by_id", "don_thuoc", type_="foreignkey")
    op.drop_index("ix_don_thuoc_idempotency_key", table_name="don_thuoc")
    op.drop_column("don_thuoc", "du_lieu_don_thuoc_hash")
    op.drop_column("don_thuoc", "nguoi_ky_id")
    op.drop_column("don_thuoc", "ly_do_thay_the")
    op.drop_column("don_thuoc", "thay_the_cho_don_id")
    op.drop_column("don_thuoc", "superseded_by_id")
    op.drop_column("don_thuoc", "thong_diep_cong")
    op.drop_column("don_thuoc", "ma_ket_qua_cong")
    op.drop_column("don_thuoc", "thoi_gian_gui_cong")
    op.drop_column("don_thuoc", "bien_nhan_giao_dich")
    op.drop_column("don_thuoc", "idempotency_key")
    op.drop_column("don_thuoc", "ngay_ky")
    op.drop_column("don_thuoc", "chu_ky_so")
    op.drop_column("don_thuoc", "ma_don_quoc_gia")
    op.drop_column("don_thuoc", "trang_thai")

    # Rollback bac_si
    op.drop_index("ix_bac_si_trang_thai_giay_phep", table_name="bac_si")
    op.drop_index("ix_bac_si_ngay_het_han", table_name="bac_si")
    op.drop_column("bac_si", "tep_dinh_kem_url")
    op.drop_column("bac_si", "trang_thai_giay_phep")
    op.drop_column("bac_si", "pham_vi_chuyen_mon")
    op.drop_column("bac_si", "ngay_het_han")
    op.drop_column("bac_si", "ngay_cap")

    # Rollback tables
    op.drop_index("ix_nhat_ky_truy_cap_y_te_patient_id", table_name="nhat_ky_truy_cap_y_te")
    op.drop_index("ix_nhat_ky_truy_cap_y_te_user_id", table_name="nhat_ky_truy_cap_y_te")
    op.drop_table("nhat_ky_truy_cap_y_te")

    op.drop_index("ix_lich_su_giay_phep_bac_si_bac_si_id", table_name="lich_su_giay_phep_bac_si")
    op.drop_table("lich_su_giay_phep_bac_si")

    op.drop_index("ix_giay_phep_co_so_trang_thai", table_name="giay_phep_co_so")
    op.drop_index("ix_giay_phep_co_so_ngay_het_han", table_name="giay_phep_co_so")
    op.drop_index("ix_giay_phep_co_so_so_giay_phep", table_name="giay_phep_co_so")
    op.drop_table("giay_phep_co_so")
