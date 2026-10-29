from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "012_fix_schema_drift_and_legacy_constraints"
down_revision: Union[str, None] = "011_align_schema_to_erd_v8_2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "phong_kham" not in tables:
        op.create_table(
            "phong_kham",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("ma_phong", sa.String(length=50), nullable=False, unique=True),
            sa.Column("ten_phong", sa.String(length=100), nullable=False),
            sa.Column("chuyen_khoa_id", sa.Integer(), sa.ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True),
            sa.Column("tang", sa.String(length=20), nullable=False),
            sa.Column("loai_phong", sa.String(length=30), nullable=False, server_default="KHAM_BENH"),
            sa.Column("thiet_bi_chinh", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_phong_kham_ma_phong", "phong_kham", ["ma_phong"])

    if "nghi_phep_bac_si" not in tables:
        op.create_table(
            "nghi_phep_bac_si",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("bac_si_id", sa.Integer(), sa.ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False),
            sa.Column("phong_kham_id", sa.Integer(), sa.ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True),
            sa.Column("loai_nghi", sa.String(length=30), nullable=False, server_default="NGHI_PHEP"),
            sa.Column("tu_ngay", sa.Date(), nullable=False),
            sa.Column("den_ngay", sa.Date(), nullable=False),
            sa.Column("ca_lam_viec", sa.String(length=20), nullable=True),
            sa.Column("ly_do", sa.Text(), nullable=False),
            sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="CHO_DUYET"),
            sa.Column("nguoi_duyet_id", sa.Integer(), sa.ForeignKey("tai_khoan.id", ondelete="SET NULL"), nullable=True),
            sa.Column("thoi_gian_duyet", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ghi_chu_duyet", sa.Text(), nullable=True),
            sa.Column("so_ca_anh_huong", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("so_lich_anh_huong", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_nghi_phep_bac_si_id", "nghi_phep_bac_si", ["bac_si_id"])
        op.create_index("ix_nghi_phep_phong_kham_id", "nghi_phep_bac_si", ["phong_kham_id"])
    else:
        nghi_phep_cols = [c["name"] for c in inspector.get_columns("nghi_phep_bac_si")]
        if "phong_kham_id" not in nghi_phep_cols:
            op.add_column("nghi_phep_bac_si", sa.Column("phong_kham_id", sa.Integer(), sa.ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True))
            op.create_index("ix_nghi_phep_phong_kham_id", "nghi_phep_bac_si", ["phong_kham_id"])

    if "danh_sach_cho" not in tables:
        if "hang_cho" in tables:
            op.rename_table("hang_cho", "danh_sach_cho")
        else:
            op.create_table(
                "danh_sach_cho",
                sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
                sa.Column("benh_nhan_id", sa.Integer(), sa.ForeignKey("benh_nhan.id", ondelete="CASCADE"), nullable=False),
                sa.Column("bac_si_id", sa.Integer(), sa.ForeignKey("bac_si.id", ondelete="CASCADE"), nullable=False),
                sa.Column("phong_kham_id", sa.Integer(), sa.ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True),
                sa.Column("ngay_mong_muon", sa.Date(), nullable=False),
                sa.Column("ca_mong_muon", sa.String(length=20), nullable=False, server_default="sang"),
                sa.Column("trieu_chung", sa.Text(), nullable=True),
                sa.Column("thu_tu_uu_tien", sa.Integer(), nullable=False, server_default="1"),
                sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="dang_cho"),
                sa.Column("thoi_gian_thong_bao", sa.DateTime(timezone=True), nullable=True),
                sa.Column("thoi_gian_het_han_giu_slot", sa.DateTime(timezone=True), nullable=True),
                sa.Column("slot_duoc_cap_id", sa.Integer(), sa.ForeignKey("lich_kham.id", ondelete="SET NULL"), nullable=True),
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            )
            op.create_index("ix_danh_sach_cho_benh_nhan", "danh_sach_cho", ["benh_nhan_id"])
            op.create_index("ix_danh_sach_cho_bac_si", "danh_sach_cho", ["bac_si_id"])

    tables_refreshed = set(inspector.get_table_names())
    if "danh_sach_cho" in tables_refreshed:
        waitlist_cols = [c["name"] for c in inspector.get_columns("danh_sach_cho")]
        if "phong_kham_id" not in waitlist_cols:
            op.add_column("danh_sach_cho", sa.Column("phong_kham_id", sa.Integer(), sa.ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True))
            op.create_index("ix_danh_sach_cho_phong_kham", "danh_sach_cho", ["phong_kham_id"])
        if "trieu_chung" not in waitlist_cols:
            op.add_column("danh_sach_cho", sa.Column("trieu_chung", sa.Text(), nullable=True))
        if "ca_mong_muon" not in waitlist_cols:
            op.add_column("danh_sach_cho", sa.Column("ca_mong_muon", sa.String(length=20), server_default="sang", nullable=False))
        if "thu_tu_uu_tien" not in waitlist_cols:
            op.add_column("danh_sach_cho", sa.Column("thu_tu_uu_tien", sa.Integer(), server_default="1", nullable=False))
        if "thoi_gian_thong_bao" not in waitlist_cols:
            op.add_column("danh_sach_cho", sa.Column("thoi_gian_thong_bao", sa.DateTime(timezone=True), nullable=True))
        if "thoi_gian_het_han_giu_slot" not in waitlist_cols:
            op.add_column("danh_sach_cho", sa.Column("thoi_gian_het_han_giu_slot", sa.DateTime(timezone=True), nullable=True))
        if "slot_duoc_cap_id" not in waitlist_cols:
            op.add_column("danh_sach_cho", sa.Column("slot_duoc_cap_id", sa.Integer(), sa.ForeignKey("lich_kham.id", ondelete="SET NULL"), nullable=True))
        if "updated_at" not in waitlist_cols:
            op.add_column("danh_sach_cho", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))

    if "bien_ban_dinh_chinh" not in tables:
        op.create_table(
            "bien_ban_dinh_chinh",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("luot_kham_id", sa.Integer(), sa.ForeignKey("luot_kham.id", ondelete="CASCADE"), nullable=False),
            sa.Column("thuc_the_loai", sa.String(length=50), nullable=False),
            sa.Column("thuc_the_id", sa.Integer(), nullable=False),
            sa.Column("ly_do_ma", sa.String(length=50), nullable=True),
            sa.Column("ly_do_text", sa.Text(), nullable=False),
            sa.Column("noi_dung_cu_json", sa.JSON(), nullable=True),
            sa.Column("noi_dung_moi_json", sa.JSON(), nullable=False),
            sa.Column("muc_do_nghiem_trong", sa.String(length=20), server_default="TRUNG_BINH", nullable=False),
            sa.Column("ma_kiem_thao", sa.String(length=100), nullable=True),
            sa.Column("thoi_gian_kiem_thao", sa.DateTime(timezone=True), nullable=True),
            sa.Column("requested_by_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="CASCADE"), nullable=False),
            sa.Column("approved_by_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("trang_thai", sa.String(length=50), server_default="CHO_PHE_DUYET", nullable=False),
            sa.Column("ghi_chu", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_bien_ban_dinh_chinh_luot_kham", "bien_ban_dinh_chinh", ["luot_kham_id"])

    if "chan_doan" in tables:
        chan_doan_cols = [c["name"] for c in inspector.get_columns("chan_doan")]
        if "danh_muc_icd10_id" not in chan_doan_cols:
            op.add_column("chan_doan", sa.Column("danh_muc_icd10_id", sa.Integer(), sa.ForeignKey("danh_muc_icd10.id", ondelete="SET NULL"), nullable=True))
            op.create_index("ix_chan_doan_danh_muc_icd10", "chan_doan", ["danh_muc_icd10_id"])
        if "bac_si_ghi_nhan_id" not in chan_doan_cols:
            op.add_column("chan_doan", sa.Column("bac_si_ghi_nhan_id", sa.Integer(), sa.ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True))
        if "ghi_chu_chuyen_mon" not in chan_doan_cols:
            op.add_column("chan_doan", sa.Column("ghi_chu_chuyen_mon", sa.Text(), nullable=True))

    if "hoa_don" in tables:
        hoa_don_cols = [c["name"] for c in inspector.get_columns("hoa_don")]
        if "thu_ngan_id" in hoa_don_cols:
            op.alter_column("hoa_don", "thu_ngan_id", nullable=True)
        if "thuc_thu" in hoa_don_cols:
            op.alter_column("hoa_don", "thuc_thu", nullable=True, server_default="0.00")
        if "nguoi_lap_id" not in hoa_don_cols:
            op.add_column("hoa_don", sa.Column("nguoi_lap_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="RESTRICT"), nullable=True))
        if "so_tien_phai_thu" not in hoa_don_cols:
            op.add_column("hoa_don", sa.Column("so_tien_phai_thu", sa.Numeric(15, 2), server_default="0.00", nullable=False))

    if "chi_dinh" in tables:
        chi_dinh_cols = [c["name"] for c in inspector.get_columns("chi_dinh")]
        if "giam_gia" in chi_dinh_cols:
            op.alter_column("chi_dinh", "giam_gia", nullable=True, server_default="0.00")
        else:
            op.add_column("chi_dinh", sa.Column("giam_gia", sa.Numeric(12, 2), server_default="0.00", nullable=True))
        if "thanh_tien" in chi_dinh_cols:
            op.alter_column("chi_dinh", "thanh_tien", nullable=True, server_default="0.00")
        else:
            op.add_column("chi_dinh", sa.Column("thanh_tien", sa.Numeric(12, 2), server_default="0.00", nullable=True))

    if "luot_kham" in tables:
        luot_kham_cols = [c["name"] for c in inspector.get_columns("luot_kham")]
        if "ma_kcb" not in luot_kham_cols:
            op.add_column("luot_kham", sa.Column("ma_kcb", sa.String(length=50), nullable=True))
            op.create_index("ix_luot_kham_ma_kcb", "luot_kham", ["ma_kcb"], unique=True)


def downgrade() -> None:
    pass
