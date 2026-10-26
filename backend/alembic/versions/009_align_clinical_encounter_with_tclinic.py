"""Align clinical encounter schema with tClinic

Revision ID: 009_align_clinical_encounter_with_tclinic
Revises: 008_drop_kham_doan_and_qa
Create Date: 2026-10-13

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009_align_clinical_encounter_with_tclinic"
down_revision: Union[str, None] = "008_drop_kham_doan_and_qa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. Cập nhật bảng luot_kham
    luot_kham_cols = [c["name"] for c in inspector.get_columns("luot_kham")]
    if "trieu_chung" not in luot_kham_cols:
        op.add_column("luot_kham", sa.Column("trieu_chung", sa.Text(), nullable=True))
    if "chan_doan_so_bo" not in luot_kham_cols:
        op.add_column("luot_kham", sa.Column("chan_doan_so_bo", sa.String(length=255), nullable=True))
    if "tien_su_di_ung" not in luot_kham_cols:
        op.add_column("luot_kham", sa.Column("tien_su_di_ung", sa.Text(), nullable=True))
    if "spo2" not in luot_kham_cols:
        op.add_column("luot_kham", sa.Column("spo2", sa.Numeric(precision=4, scale=1), nullable=True))
    if "bmi" not in luot_kham_cols:
        op.add_column("luot_kham", sa.Column("bmi", sa.Numeric(precision=4, scale=1), nullable=True))
    if "loi_dan_tai_kham" not in luot_kham_cols:
        op.add_column("luot_kham", sa.Column("loi_dan_tai_kham", sa.Text(), nullable=True))

    # 2. Cập nhật bảng don_thuoc
    don_thuoc_cols = [c["name"] for c in inspector.get_columns("don_thuoc")]
    if "so_ngay_dung" not in don_thuoc_cols:
        op.add_column("don_thuoc", sa.Column("so_ngay_dung", sa.Integer(), nullable=False, server_default="5"))

    # 3. Cập nhật bảng chi_tiet_don_thuoc
    ct_don_thuoc_cols = [c["name"] for c in inspector.get_columns("chi_tiet_don_thuoc")]
    if "lieu_sang" not in ct_don_thuoc_cols:
        op.add_column("chi_tiet_don_thuoc", sa.Column("lieu_sang", sa.String(length=20), nullable=True, server_default=""))
    if "lieu_trua" not in ct_don_thuoc_cols:
        op.add_column("chi_tiet_don_thuoc", sa.Column("lieu_trua", sa.String(length=20), nullable=True, server_default=""))
    if "lieu_chieu" not in ct_don_thuoc_cols:
        op.add_column("chi_tiet_don_thuoc", sa.Column("lieu_chieu", sa.String(length=20), nullable=True, server_default=""))
    if "lieu_toi" not in ct_don_thuoc_cols:
        op.add_column("chi_tiet_don_thuoc", sa.Column("lieu_toi", sa.String(length=20), nullable=True, server_default=""))

    # 4. Cập nhật bảng chi_dinh
    chi_dinh_cols = [c["name"] for c in inspector.get_columns("chi_dinh")]
    if "giam_gia" not in chi_dinh_cols:
        op.add_column("chi_dinh", sa.Column("giam_gia", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"))
    if "thanh_tien" not in chi_dinh_cols:
        op.add_column("chi_dinh", sa.Column("thanh_tien", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"))


def downgrade() -> None:
    # Xóa các cột đã thêm
    for col in ["thanh_tien", "giam_gia"]:
        op.drop_column("chi_dinh", col)
    for col in ["lieu_toi", "lieu_chieu", "lieu_trua", "lieu_sang"]:
        op.drop_column("chi_tiet_don_thuoc", col)
    op.drop_column("don_thuoc", "so_ngay_dung")
    for col in ["loi_dan_tai_kham", "bmi", "spo2", "tien_su_di_ung", "chan_doan_so_bo", "trieu_chung"]:
        op.drop_column("luot_kham", col)
