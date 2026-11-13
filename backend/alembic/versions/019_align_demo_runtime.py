"""Keep application configuration in PostgreSQL."""
from alembic import op
import sqlalchemy as sa


revision = "019_align_demo_runtime"
down_revision = "018_production_3nf_schema_and_clean_bff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("he_thong_trang_thai_bff"):
        op.create_table(
            "he_thong_trang_thai_bff",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("collection_key", sa.String(100), nullable=False, unique=True),
            sa.Column("data_json", sa.JSON(), nullable=False),
            sa.Column("updated_by_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    # Older installations can already have this table and its saved configuration.
    pass
