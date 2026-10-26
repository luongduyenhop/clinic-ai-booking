"""Đồng bộ CSDL theo ERD nghiệp vụ: Nhân sự, Gói khám snapshot, Đa chuyên khoa và Kết quả CLS

Revision ID: 006_sync_erd_and_package_lifecycle
Revises: 005_master_clinic_data_architecture
Create Date: 2026-10-24

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006_sync_erd_and_package_lifecycle"
down_revision: Union[str, None] = "005_master_clinic_data_architecture"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Bảng nhan_vien (Hồ sơ nhân sự chung: Bác sĩ, KTV, Lễ tân, Thu ngân)
    op.create_table(
        "nhan_vien",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("nguoi_dung_id", sa.Integer(), nullable=False),
        sa.Column("ma_nhan_vien", sa.String(length=50), nullable=False),
        sa.Column("chuc_danh", sa.String(length=50), nullable=True),
        sa.Column("loai_nhan_vien", sa.String(length=30), server_default="BAC_SI", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(["nguoi_dung_id"], ["nguoi_dung.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nguoi_dung_id", name="uq_nhan_vien_nguoi_dung_id"),
    )
    op.create_index("ix_nhan_vien_ma_nhan_vien", "nhan_vien", ["ma_nhan_vien"], unique=True)

    # 2. Bổ sung nhan_vien_id vào bac_si
    with op.batch_alter_table("bac_si") as batch_op:
        batch_op.add_column(sa.Column("nhan_vien_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_bac_si_nhan_vien", "nhan_vien", ["nhan_vien_id"], ["id"], ondelete="SET NULL")
        batch_op.create_unique_constraint("uq_bac_si_nhan_vien_id", ["nhan_vien_id"])

    # 3. Bổ sung phong_kham_id vào hang_doi_kham (Điều phối hàng đợi theo buồng/phòng vật lý)
    with op.batch_alter_table("hang_doi_kham") as batch_op:
        batch_op.add_column(sa.Column("phong_kham_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_hang_doi_phong_kham", "phong_kham", ["phong_kham_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_hang_doi_kham_phong_kham_id", ["phong_kham_id"])

    # 4. Bảng phan_tich_ai_goi_y (Chuẩn hóa gợi ý chuyên khoa 1-N)
    op.create_table(
        "phan_tich_ai_goi_y",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("phan_tich_ai_id", sa.Integer(), nullable=False),
        sa.Column("chuyen_khoa_id", sa.Integer(), nullable=False),
        sa.Column("do_tin_cay", sa.Numeric(precision=5, scale=2), server_default="0.00", nullable=False),
        sa.Column("ly_do_goi_y", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["phan_tich_ai_id"], ["phan_tich_ai.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["chuyen_khoa_id"], ["chuyen_khoa.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_phan_tich_ai_goi_y_phan_tich_ai_id", "phan_tich_ai_goi_y", ["phan_tich_ai_id"])
    op.create_index("ix_phan_tich_ai_goi_y_chuyen_khoa_id", "phan_tich_ai_goi_y", ["chuyen_khoa_id"])

    # 5. Mở rộng luot_kham: Hỗ trợ khám vãng lai (walk-in) & liên kết hang_doi_kham
    with op.batch_alter_table("luot_kham") as batch_op:
        batch_op.alter_column("lich_kham_id", nullable=True)
        batch_op.add_column(sa.Column("hang_doi_kham_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_luot_kham_hang_doi", "hang_doi_kham", ["hang_doi_kham_id"], ["id"], ondelete="SET NULL")
        batch_op.create_unique_constraint("uq_luot_kham_hang_doi_id", ["hang_doi_kham_id"])

    # 6. Bảng phieu_kham_chuyen_khoa (Khám đa chuyên khoa trong gói KSK)
    op.create_table(
        "phieu_kham_chuyen_khoa",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("luot_kham_id", sa.Integer(), nullable=False),
        sa.Column("bac_si_id", sa.Integer(), nullable=False),
        sa.Column("chuyen_khoa_id", sa.Integer(), nullable=False),
        sa.Column("phong_kham_id", sa.Integer(), nullable=True),
        sa.Column("noi_dung_kham", sa.Text(), nullable=True),
        sa.Column("ket_luan_chuyen_khoa", sa.Text(), nullable=True),
        sa.Column("phan_loai_suc_khoe", sa.String(length=20), server_default="LOAI_1", nullable=True),
        sa.ForeignKeyConstraint(["luot_kham_id"], ["luot_kham.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bac_si_id"], ["bac_si.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["chuyen_khoa_id"], ["chuyen_khoa.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["phong_kham_id"], ["phong_kham.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_phieu_kham_chuyen_khoa_luot_kham_id", "phieu_kham_chuyen_khoa", ["luot_kham_id"])
    op.create_index("ix_phieu_kham_chuyen_khoa_bac_si_id", "phieu_kham_chuyen_khoa", ["bac_si_id"])
    op.create_index("ix_phieu_kham_chuyen_khoa_chuyen_khoa_id", "phieu_kham_chuyen_khoa", ["chuyen_khoa_id"])

    # 7. Bảng thuoc (Danh mục thuốc riêng biệt)
    op.create_table(
        "thuoc",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ma_thuoc", sa.String(length=50), nullable=False),
        sa.Column("ten_thuoc", sa.String(length=255), nullable=False),
        sa.Column("hoat_chat", sa.String(length=255), nullable=True),
        sa.Column("ham_luong", sa.String(length=100), nullable=True),
        sa.Column("don_vi_tinh", sa.String(length=30), server_default="Viên", nullable=False),
        sa.Column("duong_dung", sa.String(length=50), server_default="Uống", nullable=True),
        sa.Column("don_gia_niem_yet", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_thuoc_ma_thuoc", "thuoc", ["ma_thuoc"], unique=True)
    op.create_index("ix_thuoc_ten_thuoc", "thuoc", ["ten_thuoc"])

    # 8. Bổ sung thuoc_id vào chi_tiet_don_thuoc
    with op.batch_alter_table("chi_tiet_don_thuoc") as batch_op:
        batch_op.add_column(sa.Column("thuoc_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_chi_tiet_don_thuoc", "thuoc", ["thuoc_id"], ["id"], ondelete="RESTRICT")
        batch_op.create_index("ix_chi_tiet_don_thuoc_thuoc_id", ["thuoc_id"])

    # 9. Bổ sung tài chính & liên kết hóa đơn vào dang_ky_goi_kham
    with op.batch_alter_table("dang_ky_goi_kham") as batch_op:
        batch_op.add_column(sa.Column("hoa_don_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("tong_tien", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False))
        batch_op.add_column(sa.Column("giam_gia", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False))
        batch_op.add_column(sa.Column("thanh_tien", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False))
        batch_op.create_foreign_key("fk_dang_ky_goi_hoa_don", "hoa_don", ["hoa_don_id"], ["id"], ondelete="SET NULL")
        batch_op.create_unique_constraint("uq_dang_ky_goi_hoa_don_id", ["hoa_don_id"])

    # 10. Bảng chi_tiet_dang_ky_goi_kham (Snapshot quyền lợi chi tiết gói đã mua)
    op.create_table(
        "chi_tiet_dang_ky_goi_kham",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("dang_ky_goi_kham_id", sa.Integer(), nullable=False),
        sa.Column("dich_vu_id", sa.Integer(), nullable=False),
        sa.Column("so_luong_tong", sa.Integer(), server_default="1", nullable=False),
        sa.Column("so_luong_da_dung", sa.Integer(), server_default="0", nullable=False),
        sa.Column("don_gia_tai_thoi_diem", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("thanh_tien", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("trang_thai_muc", sa.String(length=30), server_default="CHUA_DUNG", nullable=False),
        sa.Column("ghi_chu", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["dang_ky_goi_kham_id"], ["dang_ky_goi_kham.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dich_vu_id"], ["dich_vu.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ct_dang_ky_goi_kham_id", "chi_tiet_dang_ky_goi_kham", ["dang_ky_goi_kham_id"])
    op.create_index("ix_ct_dang_ky_dich_vu_id", "chi_tiet_dang_ky_goi_kham", ["dich_vu_id"])

    # 11. Bổ sung chi_tiet_goi_kham_da_mua_id vào chi_dinh
    with op.batch_alter_table("chi_dinh") as batch_op:
        batch_op.add_column(sa.Column("chi_tiet_goi_kham_da_mua_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_chi_dinh_goi_da_mua", "chi_tiet_dang_ky_goi_kham", ["chi_tiet_goi_kham_da_mua_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_chi_dinh_ct_goi_id", ["chi_tiet_goi_kham_da_mua_id"])

    # 12. Bảng ket_qua_cls (Chuẩn hóa kết quả theo chuẩn HL7 FHIR DiagnosticReport)
    op.create_table(
        "ket_qua_cls",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("chi_dinh_id", sa.Integer(), nullable=False),
        sa.Column("nguoi_thuc_hien_id", sa.Integer(), nullable=True),
        sa.Column("bac_si_duyet_id", sa.Integer(), nullable=True),
        sa.Column("ket_qua_chi_tiet", sa.Text(), nullable=True),
        sa.Column("tri_so_chi_tiet", sa.JSON(), nullable=True),
        sa.Column("file_dinh_kem_urls", sa.JSON(), nullable=True),
        sa.Column("ket_qua_phan_loai", sa.String(length=20), server_default="BINH_THUONG", nullable=True),
        sa.Column("thoi_gian_lay_mau", sa.DateTime(timezone=True), nullable=True),
        sa.Column("thoi_gian_thuc_hien", sa.DateTime(timezone=True), nullable=True),
        sa.Column("thoi_gian_duyet", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["chi_dinh_id"], ["chi_dinh.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["nguoi_thuc_hien_id"], ["nguoi_dung.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["bac_si_duyet_id"], ["bac_si.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chi_dinh_id", name="uq_ket_qua_cls_chi_dinh_id"),
    )
    op.create_index("ix_ket_qua_cls_chi_dinh_id", "ket_qua_cls", ["chi_dinh_id"])

    # 13. Mở rộng hoa_don: Cho phép luot_kham_id nullable & liên kết mua gói
    with op.batch_alter_table("hoa_don") as batch_op:
        batch_op.alter_column("luot_kham_id", nullable=True)
        batch_op.add_column(sa.Column("goi_kham_da_mua_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_hoa_don_dang_ky_goi", "dang_ky_goi_kham", ["goi_kham_da_mua_id"], ["id"], ondelete="SET NULL")
        batch_op.create_unique_constraint("uq_hoa_don_goi_kham_da_mua_id", ["goi_kham_da_mua_id"])

    # 14. Bổ sung liên kết chi_dinh_id & goi_kham_da_mua_id vào chi_tiet_hoa_don
    with op.batch_alter_table("chi_tiet_hoa_don") as batch_op:
        batch_op.add_column(sa.Column("chi_dinh_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("goi_kham_da_mua_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_ct_hoa_don_chi_dinh", "chi_dinh", ["chi_dinh_id"], ["id"], ondelete="SET NULL")
        batch_op.create_foreign_key("fk_ct_hoa_don_goi_da_mua", "dang_ky_goi_kham", ["goi_kham_da_mua_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_ct_hoa_don_chi_dinh_id", ["chi_dinh_id"])
        batch_op.create_index("ix_ct_hoa_don_goi_id", ["goi_kham_da_mua_id"])


def downgrade() -> None:
    # 14. Hoàn tác chi_tiet_hoa_don
    with op.batch_alter_table("chi_tiet_hoa_don") as batch_op:
        batch_op.drop_constraint("fk_ct_hoa_don_goi_da_mua", type_="foreignkey")
        batch_op.drop_constraint("fk_ct_hoa_don_chi_dinh", type_="foreignkey")
        batch_op.drop_column("goi_kham_da_mua_id")
        batch_op.drop_column("chi_dinh_id")

    # 13. Hoàn tác hoa_don
    with op.batch_alter_table("hoa_don") as batch_op:
        batch_op.drop_constraint("uq_hoa_don_goi_kham_da_mua_id", type_="unique")
        batch_op.drop_constraint("fk_hoa_don_dang_ky_goi", type_="foreignkey")
        batch_op.drop_column("goi_kham_da_mua_id")
        batch_op.alter_column("luot_kham_id", nullable=False)

    # 12. Xóa bảng ket_qua_cls
    op.drop_table("ket_qua_cls")

    # 11. Hoàn tác chi_dinh
    with op.batch_alter_table("chi_dinh") as batch_op:
        batch_op.drop_constraint("fk_chi_dinh_goi_da_mua", type_="foreignkey")
        batch_op.drop_column("chi_tiet_goi_kham_da_mua_id")

    # 10. Xóa bảng chi_tiet_dang_ky_goi_kham
    op.drop_table("chi_tiet_dang_ky_goi_kham")

    # 9. Hoàn tác dang_ky_goi_kham
    with op.batch_alter_table("dang_ky_goi_kham") as batch_op:
        batch_op.drop_constraint("uq_dang_ky_goi_hoa_don_id", type_="unique")
        batch_op.drop_constraint("fk_dang_ky_goi_hoa_don", type_="foreignkey")
        batch_op.drop_column("thanh_tien")
        batch_op.drop_column("giam_gia")
        batch_op.drop_column("tong_tien")
        batch_op.drop_column("hoa_don_id")

    # 8. Hoàn tác chi_tiet_don_thuoc
    with op.batch_alter_table("chi_tiet_don_thuoc") as batch_op:
        batch_op.drop_constraint("fk_chi_tiet_don_thuoc", type_="foreignkey")
        batch_op.drop_column("thuoc_id")

    # 7. Xóa bảng thuoc
    op.drop_table("thuoc")

    # 6. Xóa bảng phieu_kham_chuyen_khoa
    op.drop_table("phieu_kham_chuyen_khoa")

    # 5. Hoàn tác luot_kham
    with op.batch_alter_table("luot_kham") as batch_op:
        batch_op.drop_constraint("uq_luot_kham_hang_doi_id", type_="unique")
        batch_op.drop_constraint("fk_luot_kham_hang_doi", type_="foreignkey")
        batch_op.drop_column("hang_doi_kham_id")
        batch_op.alter_column("lich_kham_id", nullable=False)

    # 4. Xóa bảng phan_tich_ai_goi_y
    op.drop_table("phan_tich_ai_goi_y")

    # 3. Hoàn tác hang_doi_kham
    with op.batch_alter_table("hang_doi_kham") as batch_op:
        batch_op.drop_constraint("fk_hang_doi_phong_kham", type_="foreignkey")
        batch_op.drop_column("phong_kham_id")

    # 2. Hoàn tác bac_si
    with op.batch_alter_table("bac_si") as batch_op:
        batch_op.drop_constraint("uq_bac_si_nhan_vien_id", type_="unique")
        batch_op.drop_constraint("fk_bac_si_nhan_vien", type_="foreignkey")
        batch_op.drop_column("nhan_vien_id")

    # 1. Xóa bảng nhan_vien
    op.drop_table("nhan_vien")
