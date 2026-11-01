"""drop legacy unique constraint on don_thuoc.luot_kham_id

Revision ID: 014_drop_don_thuoc_luot_kham_id_key
Revises: 013_unique_active_invoice_per_encounter
Create Date: 2026-10-29 10:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "014_drop_don_thuoc_luot_kham_id_key"
down_revision: Union[str, None] = "013_unique_active_invoice_per_encounter"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bảng don_thuoc có quan hệ 1-N với luot_kham (cho phép đơn superseded và đơn thay thế mới)
    # Loại bỏ constraint UNIQUE cũ nếu còn tồn tại
    op.execute("ALTER TABLE don_thuoc DROP CONSTRAINT IF EXISTS don_thuoc_luot_kham_id_key;")


def downgrade() -> None:
    # Khôi phục UNIQUE constraint cho luot_kham_id nếu rollback
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_unique = {uq["name"] for uq in inspector.get_unique_constraints("don_thuoc")}
    if "don_thuoc_luot_kham_id_key" not in existing_unique:
        op.create_unique_constraint("don_thuoc_luot_kham_id_key", "don_thuoc", ["luot_kham_id"])
