from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013_unique_active_invoice_per_encounter"
down_revision: Union[str, None] = "012_fix_schema_drift_and_legacy_constraints"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEX_NAME = "uq_hoa_don_luot_kham_hieu_luc"
INDEX_CONDITION = "luot_kham_id IS NOT NULL AND trang_thai IN ('chua_thu', 'da_thu')"
MA_DICH_VU_KHAM_CO_BAN = "KHAM_LAM_SANG_CO_BAN"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("hoa_don")}
    if INDEX_NAME not in existing_indexes:
        op.create_index(
            INDEX_NAME,
            "hoa_don",
            ["luot_kham_id"],
            unique=True,
            postgresql_where=sa.text(INDEX_CONDITION),
            sqlite_where=sa.text(INDEX_CONDITION),
        )

    exists = bind.execute(
        sa.text("SELECT 1 FROM dich_vu WHERE ma_dich_vu = :ma"),
        {"ma": MA_DICH_VU_KHAM_CO_BAN},
    ).first()
    if not exists:
        bind.execute(
            sa.text(
                "INSERT INTO dich_vu (ma_dich_vu, ten_dich_vu, don_gia, don_vi_tinh, is_active, "
                "thoi_gian_tra_ket_qua_phut, created_at, updated_at) "
                "VALUES (:ma, :ten, :gia, :dvt, :active, :phut, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {
                "ma": MA_DICH_VU_KHAM_CO_BAN,
                "ten": "Khám lâm sàng cơ bản",
                "gia": 150000,
                "dvt": "Lần",
                "active": True,
                "phut": 30,
            },
        )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="hoa_don")
