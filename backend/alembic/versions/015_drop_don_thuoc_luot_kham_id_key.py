from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015_drop_don_thuoc_luot_kham_id_key"
down_revision: Union[str, None] = "014_reception_schema_sprint1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE don_thuoc DROP CONSTRAINT IF EXISTS don_thuoc_luot_kham_id_key;")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_unique = {uq["name"] for uq in inspector.get_unique_constraints("don_thuoc")}
    if "don_thuoc_luot_kham_id_key" not in existing_unique:
        op.create_unique_constraint("don_thuoc_luot_kham_id_key", "don_thuoc", ["luot_kham_id"])
