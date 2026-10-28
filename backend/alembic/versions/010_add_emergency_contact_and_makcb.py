"""Add emergency contact to benh_nhan and ma_kcb to luot_kham

Revision ID: 010_add_emergency_contact_and_makcb
Revises: 009_align_clinical_encounter_with_tclinic
Create Date: 2026-10-13

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "010_add_emergency_contact_and_makcb"
down_revision: Union[str, None] = "009_align_clinical_encounter_with_tclinic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. Bảng benh_nhan: Thêm người liên hệ và SĐT người liên hệ
    benh_nhan_cols = [c["name"] for c in inspector.get_columns("benh_nhan")]
    if "nguoi_lien_he" not in benh_nhan_cols:
        op.add_column("benh_nhan", sa.Column("nguoi_lien_he", sa.String(length=100), nullable=True))
    if "sdt_nguoi_lien_he" not in benh_nhan_cols:
        op.add_column("benh_nhan", sa.Column("sdt_nguoi_lien_he", sa.String(length=20), nullable=True))

    # 2. Bảng luot_kham: Thêm mã đợt khám chữa bệnh (ma_kcb)
    luot_kham_cols = [c["name"] for c in inspector.get_columns("luot_kham")]
    if "ma_kcb" not in luot_kham_cols:
        op.add_column("luot_kham", sa.Column("ma_kcb", sa.String(length=50), nullable=True))
        try:
            op.create_index("ix_luot_kham_ma_kcb", "luot_kham", ["ma_kcb"])
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Downgrade luot_kham
    luot_kham_cols = [c["name"] for c in inspector.get_columns("luot_kham")]
    if "ma_kcb" in luot_kham_cols:
        try:
            op.drop_index("ix_luot_kham_ma_kcb", table_name="luot_kham")
        except Exception:
            pass
        op.drop_column("luot_kham", "ma_kcb")

    # Downgrade benh_nhan
    benh_nhan_cols = [c["name"] for c in inspector.get_columns("benh_nhan")]
    if "sdt_nguoi_lien_he" in benh_nhan_cols:
        op.drop_column("benh_nhan", "sdt_nguoi_lien_he")
    if "nguoi_lien_he" in benh_nhan_cols:
        op.drop_column("benh_nhan", "nguoi_lien_he")
