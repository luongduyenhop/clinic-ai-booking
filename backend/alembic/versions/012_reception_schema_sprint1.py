"""Reception Schema Sprint 1: nullable doctor/time for specialty booking, add queue restore timestamp

Revision ID: 012_reception_schema_sprint1
Revises: 011_align_schema_to_erd_v8_2
Create Date: 2026-10-27

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "012_reception_schema_sprint1"
down_revision: Union[str, Sequence[str], None] = "011_align_schema_to_erd_v8_2"
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

    # 3. Bảng nghi_phep_bac_si: đảm bảo đồng bộ với model ERD v8.2
    nghi_phep_cols = [c["name"] for c in inspector.get_columns("nghi_phep_bac_si")]
    if "phong_kham_id" not in nghi_phep_cols:
        op.add_column(
            "nghi_phep_bac_si",
            sa.Column("phong_kham_id", sa.Integer(), sa.ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True),
        )
        op.create_index("ix_nghi_phep_bac_si_phong_kham_id", "nghi_phep_bac_si", ["phong_kham_id"])
    if "thoi_gian_duyet" not in nghi_phep_cols:
        op.add_column(
            "nghi_phep_bac_si",
            sa.Column("thoi_gian_duyet", sa.DateTime(timezone=True), nullable=True),
        )

    # 4. Bảng luot_kham: thêm cột loai_kham nếu thiếu
    luot_kham_cols = [c["name"] for c in inspector.get_columns("luot_kham")]
    if "loai_kham" not in luot_kham_cols:
        op.add_column(
            "luot_kham",
            sa.Column("loai_kham", sa.String(length=30), nullable=True, server_default="KHAM_MOI"),
        )

    # 5. Bảng hoa_don: chuyển thu_ngan_id và thuc_thu sang nullable để đồng bộ ERD v8.2
    op.alter_column("hoa_don", "thu_ngan_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("hoa_don", "thuc_thu", existing_type=sa.Numeric(15, 2), nullable=True)
    op.alter_column("chi_dinh", "giam_gia", existing_type=sa.Numeric(12, 2), nullable=True, server_default="0.00")
    op.alter_column("chi_dinh", "thanh_tien", existing_type=sa.Numeric(12, 2), nullable=True, server_default="0.00")

    # 6. Đồng bộ bổ sung các trường schema drift từ ERD v8.2
    def _add_col_if_missing(table, col_name, col_type, *args, **kwargs):
        cols = [c["name"] for c in inspector.get_columns(table)]
        if col_name not in cols:
            op.add_column(table, sa.Column(col_name, col_type, *args, **kwargs))

    _add_col_if_missing("danh_sach_cho", "phong_kham_id", sa.Integer(), sa.ForeignKey("phong_kham.id", ondelete="SET NULL"), nullable=True)
    _add_col_if_missing("chan_doan", "bac_si_ghi_nhan_id", sa.Integer(), sa.ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)
    _add_col_if_missing("chan_doan", "danh_muc_icd10_id", sa.Integer(), sa.ForeignKey("danh_muc_icd10.id", ondelete="SET NULL"), nullable=True)
    _add_col_if_missing("thuoc", "ghi_chu", sa.Text(), nullable=True)
    _add_col_if_missing("luot_kham_the_luc", "spo2", sa.Numeric(4, 1), nullable=True)
    _add_col_if_missing("luot_kham_the_luc", "thoi_gian_do", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now())
    _add_col_if_missing("giay_phep_co_so", "ma_lien_thong_co_so", sa.String(length=100), nullable=True)

    # 5 bảng chuyên khoa
    for spec_table in ["kham_noi_khoa", "kham_ngoai_khoa", "kham_mat", "kham_tai_mui_hong", "kham_rang_ham_mat"]:
        _add_col_if_missing(spec_table, "lan_kham", sa.Integer(), nullable=False, server_default="1")
        _add_col_if_missing(spec_table, "bac_si_thuc_hien_id", sa.Integer(), sa.ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True)

    _add_col_if_missing("kham_ngoai_khoa", "loai_ton_thuong", sa.String(100), nullable=True)
    _add_col_if_missing("kham_ngoai_khoa", "tinh_trang_vet_thuong", sa.String(100), nullable=True)
    _add_col_if_missing("kham_ngoai_khoa", "ket_qua_kham_thuc_the", sa.Text(), nullable=True)
    _add_col_if_missing("kham_ngoai_khoa", "chi_dinh_phau_thuat_thu_thuat", sa.Text(), nullable=True)

    _add_col_if_missing("kham_mat", "thi_luc_mat_phai", sa.String(20), nullable=True)
    _add_col_if_missing("kham_mat", "thi_luc_mat_trai", sa.String(20), nullable=True)
    _add_col_if_missing("kham_mat", "nhan_ap_mat_phai", sa.String(20), nullable=True)
    _add_col_if_missing("kham_mat", "nhan_ap_mat_trai", sa.String(20), nullable=True)
    _add_col_if_missing("kham_mat", "ket_qua_kham_mat", sa.Text(), nullable=True)
    _add_col_if_missing("kham_mat", "ghi_chu", sa.Text(), nullable=True)

    _add_col_if_missing("kham_tai_mui_hong", "trieu_chung_lien_quan", sa.Text(), nullable=True)
    _add_col_if_missing("kham_tai_mui_hong", "hong_thanh_quan", sa.Text(), nullable=True)

    _add_col_if_missing("kham_rang_ham_mat", "vi_tri_rang", sa.String(50), nullable=True)
    _add_col_if_missing("kham_rang_ham_mat", "tinh_trang_rang", sa.Text(), nullable=True)
    _add_col_if_missing("kham_rang_ham_mat", "huong_dieu_tri", sa.Text(), nullable=True)
    _add_col_if_missing("kham_rang_ham_mat", "ghi_chu", sa.Text(), nullable=True)



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

