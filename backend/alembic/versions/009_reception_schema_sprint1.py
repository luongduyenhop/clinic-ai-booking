"""Reception Schema Sprint 1: nullable doctor/time for specialty booking, add queue restore timestamp

Revision ID: 009_reception_schema_sprint1
Revises: 007_add_5_specialty_exam_tables, 008_add_emergency_contact_and_makcb
Create Date: 2026-10-27

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009_reception_schema_sprint1"
down_revision: Union[str, Sequence[str], None] = (
    "007_add_5_specialty_exam_tables",
    "008_add_emergency_contact_and_makcb",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. Bảng lich_kham: nullable bac_si_id & gio_kham, thêm chuyen_khoa_id & ca_kham
    lich_cols = [c["name"] for c in inspector.get_columns("lich_kham")]
    
    op.alter_column("lich_kham", "bac_si_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("lich_kham", "gio_kham", existing_type=sa.Time(), nullable=True)

    if "chuyen_khoa_id" not in lich_cols:
        op.add_column("lich_kham", sa.Column("chuyen_khoa_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_lich_kham_chuyen_khoa",
            "lich_kham",
            "chuyen_khoa",
            ["chuyen_khoa_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        op.create_index("ix_lich_kham_chuyen_khoa_id", "lich_kham", ["chuyen_khoa_id"])

    if "ca_kham" not in lich_cols:
        op.add_column("lich_kham", sa.Column("ca_kham", sa.String(length=20), nullable=True))

    # Cập nhật partial indexes uq_active_doctor_slot & uq_active_patient_slot
    op.execute("DROP INDEX IF EXISTS uq_active_doctor_slot")
    op.execute("""
        CREATE UNIQUE INDEX uq_active_doctor_slot
        ON lich_kham (bac_si_id, ngay_kham, gio_kham)
        WHERE trang_thai IN ('da_tiep_nhan', 'da_xac_nhan', 'dang_kham')
          AND bac_si_id IS NOT NULL
          AND gio_kham IS NOT NULL
    """)

    op.execute("DROP INDEX IF EXISTS uq_active_patient_slot")
    op.execute("""
        CREATE UNIQUE INDEX uq_active_patient_slot
        ON lich_kham (benh_nhan_id, ngay_kham, gio_kham)
        WHERE trang_thai IN ('da_tiep_nhan', 'da_xac_nhan', 'dang_kham')
          AND gio_kham IS NOT NULL
    """)

    # 2. Bảng hang_doi_kham: thêm cột thoi_gian_xep_hang_lai
    hang_doi_cols = [c["name"] for c in inspector.get_columns("hang_doi_kham")]
    if "thoi_gian_xep_hang_lai" not in hang_doi_cols:
        op.add_column(
            "hang_doi_kham",
            sa.Column("thoi_gian_xep_hang_lai", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    # 2. Bảng hang_doi_kham: drop cột thoi_gian_xep_hang_lai
    op.drop_column("hang_doi_kham", "thoi_gian_xep_hang_lai")

    # 1. Bảng lich_kham: hoàn tác
    op.execute("DROP INDEX IF EXISTS uq_active_patient_slot")
    op.execute("""
        CREATE UNIQUE INDEX uq_active_patient_slot
        ON lich_kham (benh_nhan_id, ngay_kham, gio_kham)
        WHERE trang_thai IN ('da_tiep_nhan', 'da_xac_nhan', 'dang_kham')
    """)

    op.execute("DROP INDEX IF EXISTS uq_active_doctor_slot")
    op.execute("""
        CREATE UNIQUE INDEX uq_active_doctor_slot
        ON lich_kham (bac_si_id, ngay_kham, gio_kham)
        WHERE trang_thai IN ('da_tiep_nhan', 'da_xac_nhan', 'dang_kham')
    """)

    op.drop_column("lich_kham", "ca_kham")
    op.drop_index("ix_lich_kham_chuyen_khoa_id", table_name="lich_kham")
    op.drop_constraint("fk_lich_kham_chuyen_khoa", "lich_kham", type_="foreignkey")
    op.drop_column("lich_kham", "chuyen_khoa_id")

    op.alter_column("lich_kham", "gio_kham", existing_type=sa.Time(), nullable=False)
    op.alter_column("lich_kham", "bac_si_id", existing_type=sa.Integer(), nullable=False)
