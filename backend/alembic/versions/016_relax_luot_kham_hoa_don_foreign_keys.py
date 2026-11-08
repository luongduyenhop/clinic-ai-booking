from typing import Sequence, Union

from alembic import op


revision: str = "016_relax_luot_kham_hoa_don_fks"
down_revision: Union[str, None] = "015_drop_don_thuoc_luot_kham_id_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE luot_kham ALTER COLUMN lich_kham_id DROP NOT NULL;")
    op.execute("ALTER TABLE hoa_don ALTER COLUMN luot_kham_id DROP NOT NULL;")


def downgrade() -> None:
    op.execute("ALTER TABLE hoa_don ALTER COLUMN luot_kham_id SET NOT NULL;")
    op.execute("ALTER TABLE luot_kham ALTER COLUMN lich_kham_id SET NOT NULL;")
