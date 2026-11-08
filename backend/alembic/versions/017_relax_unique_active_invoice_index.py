from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "017_relax_unique_active_invoice_index"
down_revision: Union[str, None] = "016_relax_luot_kham_hoa_don_fks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEX_NAME = "uq_hoa_don_luot_kham_hieu_luc"
INDEX_CONDITION = "luot_kham_id IS NOT NULL AND trang_thai = 'chua_thu'"
OLD_CONDITION = "luot_kham_id IS NOT NULL AND trang_thai IN ('chua_thu', 'da_thu')"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("hoa_don")}
    if INDEX_NAME in existing_indexes:
        op.drop_index(INDEX_NAME, table_name="hoa_don")
    op.create_index(
        INDEX_NAME,
        "hoa_don",
        ["luot_kham_id"],
        unique=True,
        postgresql_where=sa.text(INDEX_CONDITION),
        sqlite_where=sa.text(INDEX_CONDITION),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("hoa_don")}
    if INDEX_NAME in existing_indexes:
        op.drop_index(INDEX_NAME, table_name="hoa_don")
    op.create_index(
        INDEX_NAME,
        "hoa_don",
        ["luot_kham_id"],
        unique=True,
        postgresql_where=sa.text(OLD_CONDITION),
        sqlite_where=sa.text(OLD_CONDITION),
    )
