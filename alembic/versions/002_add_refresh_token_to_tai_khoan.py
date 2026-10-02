"""Thêm refresh_token và refresh_token_expired_at vào bảng tai_khoan

Revision ID: 002_add_refresh_token
Revises: 001_initial
Create Date: 2026-10-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_add_refresh_token"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Thêm cột refresh_token và thời hạn hết hạn vào bảng tai_khoan"""
    op.add_column(
        "tai_khoan",
        sa.Column("refresh_token", sa.String(255), nullable=True)
    )
    op.add_column(
        "tai_khoan",
        sa.Column("refresh_token_expired_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        "ix_tai_khoan_refresh_token",
        "tai_khoan",
        ["refresh_token"],
        unique=True
    )


def downgrade() -> None:
    """Xóa cột refresh_token khi rollback"""
    op.drop_index("ix_tai_khoan_refresh_token", table_name="tai_khoan")
    op.drop_column("tai_khoan", "refresh_token_expired_at")
    op.drop_column("tai_khoan", "refresh_token")
