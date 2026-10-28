from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "011_align_schema_to_erd_v8_2"
down_revision: Union[str, None] = "010_add_emergency_contact_and_makcb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "vai_tro" not in existing_tables:
        op.create_table(
            "vai_tro",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("ma_vai_tro", sa.String(length=50), nullable=False, unique=True),
            sa.Column("ten_vai_tro", sa.String(length=100), nullable=False),
            sa.Column("mo_ta", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_vai_tro_ma_vai_tro", "vai_tro", ["ma_vai_tro"])

    if "quyen" not in existing_tables:
        op.create_table(
            "quyen",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("ma_quyen", sa.String(length=100), nullable=False, unique=True),
            sa.Column("ten_quyen", sa.String(length=150), nullable=False),
            sa.Column("mo_ta", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_quyen_ma_quyen", "quyen", ["ma_quyen"])

    if "tai_khoan_vai_tro" not in existing_tables:
        op.create_table(
            "tai_khoan_vai_tro",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tai_khoan_id", sa.Integer(), sa.ForeignKey("tai_khoan.id", ondelete="CASCADE"), nullable=False),
            sa.Column("vai_tro_id", sa.Integer(), sa.ForeignKey("vai_tro.id", ondelete="CASCADE"), nullable=False),
            sa.Column("assigned_by_id", sa.Integer(), sa.ForeignKey("tai_khoan.id", ondelete="SET NULL"), nullable=True),
            sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("uq_tai_khoan_vai_tro", "tai_khoan_vai_tro", ["tai_khoan_id", "vai_tro_id"], unique=True)

    if "vai_tro_quyen" not in existing_tables:
        op.create_table(
            "vai_tro_quyen",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("vai_tro_id", sa.Integer(), sa.ForeignKey("vai_tro.id", ondelete="CASCADE"), nullable=False),
            sa.Column("quyen_id", sa.Integer(), sa.ForeignKey("quyen.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("uq_vai_tro_quyen", "vai_tro_quyen", ["vai_tro_id", "quyen_id"], unique=True)

    if "danh_muc_icd10" not in existing_tables:
        op.create_table(
            "danh_muc_icd10",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("ma_icd10", sa.String(length=20), nullable=False),
            sa.Column("ten_benh", sa.String(length=255), nullable=False),
            sa.Column("phien_ban", sa.String(length=30), nullable=False, server_default="WHO_2019"),
            sa.Column("mo_ta", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("uq_danh_muc_icd10_ma_phien_ban", "danh_muc_icd10", ["ma_icd10", "phien_ban"], unique=True)
        op.create_index("ix_danh_muc_icd10_ten_benh", "danh_muc_icd10", ["ten_benh"])

    if "phieu_ket_qua_cls" not in existing_tables:
        op.create_table(
            "phieu_ket_qua_cls",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("chi_dinh_id", sa.Integer(), sa.ForeignKey("chi_dinh.id", ondelete="CASCADE"), nullable=False),
            sa.Column("lan_thuc_hien", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("loai_ket_qua", sa.String(length=30), nullable=False, server_default="XET_NGHIEM"),
            sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="DA_CO_KET_QUA"),
            sa.Column("thoi_gian_lay_mau", sa.DateTime(timezone=True), nullable=True),
            sa.Column("thoi_gian_thuc_hien", sa.DateTime(timezone=True), nullable=True),
            sa.Column("thoi_gian_tra_ket_qua", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ky_thuat_vien_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True),
            sa.Column("bac_si_doc_ket_qua_id", sa.Integer(), sa.ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True),
            sa.Column("thoi_gian_doc_ket_qua", sa.DateTime(timezone=True), nullable=True),
            sa.Column("bac_si_duyet_id", sa.Integer(), sa.ForeignKey("bac_si.id", ondelete="SET NULL"), nullable=True),
            sa.Column("thoi_gian_duyet", sa.DateTime(timezone=True), nullable=True),
            sa.Column("mo_ta_hinh_anh", sa.Text(), nullable=True),
            sa.Column("ket_luan", sa.Text(), nullable=True),
            sa.Column("de_nghi", sa.Text(), nullable=True),
            sa.Column("tep_dinh_kem_urls", sa.JSON(), nullable=True),
            sa.Column("thiet_bi_thuc_hien", sa.String(length=255), nullable=True),
            sa.Column("ghi_chu", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("uq_phieu_ket_qua_cls_lan", "phieu_ket_qua_cls", ["chi_dinh_id", "lan_thuc_hien"], unique=True)

    if "chi_tiet_ket_qua_cls" not in existing_tables:
        op.create_table(
            "chi_tiet_ket_qua_cls",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("phieu_ket_qua_cls_id", sa.Integer(), sa.ForeignKey("phieu_ket_qua_cls.id", ondelete="CASCADE"), nullable=False),
            sa.Column("ma_chi_so", sa.String(length=100), nullable=True),
            sa.Column("ten_chi_so", sa.String(length=255), nullable=False),
            sa.Column("gia_tri_text", sa.Text(), nullable=True),
            sa.Column("gia_tri_so", sa.Numeric(precision=18, scale=6), nullable=True),
            sa.Column("don_vi", sa.String(length=50), nullable=True),
            sa.Column("khoang_tham_chieu", sa.String(length=100), nullable=True),
            sa.Column("gia_tri_thap", sa.Numeric(precision=18, scale=6), nullable=True),
            sa.Column("gia_tri_cao", sa.Numeric(precision=18, scale=6), nullable=True),
            sa.Column("danh_gia", sa.String(length=30), nullable=True),
            sa.Column("thu_tu_hien_thi", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("ghi_chu", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_chi_tiet_ket_qua_cls_phieu_id", "chi_tiet_ket_qua_cls", ["phieu_ket_qua_cls_id"])

    if "yeu_cau_bo_sung_thuoc" not in existing_tables:
        op.create_table(
            "yeu_cau_bo_sung_thuoc",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("ten_thuoc_de_xuat", sa.String(length=255), nullable=False),
            sa.Column("ten_thuong_mai_de_xuat", sa.String(length=255), nullable=True),
            sa.Column("hoat_chat_de_xuat", sa.String(length=255), nullable=True),
            sa.Column("ham_luong_de_xuat", sa.String(length=100), nullable=True),
            sa.Column("dang_bao_che_de_xuat", sa.String(length=100), nullable=True),
            sa.Column("duong_dung_de_xuat", sa.String(length=100), nullable=True),
            sa.Column("don_vi_tinh_de_xuat", sa.String(length=50), nullable=False, server_default="Viên"),
            sa.Column("ma_dinh_danh_ngoai_de_xuat", sa.String(length=100), nullable=True),
            sa.Column("nguon_tham_chieu", sa.String(length=500), nullable=True),
            sa.Column("ly_do_de_xuat", sa.Text(), nullable=False),
            sa.Column("nguoi_yeu_cau_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="CASCADE"), nullable=False),
            sa.Column("thuoc_id", sa.Integer(), sa.ForeignKey("thuoc.id", ondelete="SET NULL"), nullable=True),
            sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="CHO_XU_LY"),
            sa.Column("nguoi_xu_ly_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True),
            sa.Column("ly_do_xu_ly", sa.Text(), nullable=True),
            sa.Column("thoi_gian_xu_ly", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    if "lich_su_dong_bo_don_thuoc" not in existing_tables:
        op.create_table(
            "lich_su_dong_bo_don_thuoc",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("don_thuoc_id", sa.Integer(), sa.ForeignKey("don_thuoc.id", ondelete="CASCADE"), nullable=False),
            sa.Column("lan_thu", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("loai_thao_tac", sa.String(length=30), nullable=False, server_default="DONG_BO_MOI"),
            sa.Column("thoi_gian_bat_dau", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("thoi_gian_ket_thuc", sa.DateTime(timezone=True), nullable=True),
            sa.Column("nguoi_thuc_hien_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True),
            sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="DANG_XU_LY"),
            sa.Column("ma_phan_hoi", sa.String(length=100), nullable=True),
            sa.Column("thong_diep_phan_hoi", sa.Text(), nullable=True),
            sa.Column("ma_bien_nhan", sa.String(length=255), nullable=True),
            sa.Column("du_lieu_gui_hash", sa.String(length=128), nullable=True),
            sa.Column("du_lieu_phan_hoi_json", sa.JSON(), nullable=True),
            sa.Column("idempotency_key", sa.String(length=100), nullable=True, unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("uq_lich_su_dong_bo_don_thuoc_lan", "lich_su_dong_bo_don_thuoc", ["don_thuoc_id", "lan_thu"], unique=True)

    if "giao_dich_thanh_toan" not in existing_tables:
        op.create_table(
            "giao_dich_thanh_toan",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("ma_giao_dich", sa.String(length=50), nullable=False, unique=True),
            sa.Column("hoa_don_id", sa.Integer(), sa.ForeignKey("hoa_don.id", ondelete="CASCADE"), nullable=False),
            sa.Column("loai_giao_dich", sa.String(length=20), nullable=False, server_default="THU_VIEN_PHI"),
            sa.Column("so_tien", sa.Numeric(precision=15, scale=2), nullable=False, server_default="0.00"),
            sa.Column("phuong_thuc", sa.String(length=30), nullable=False, server_default="TIEN_MAT"),
            sa.Column("ma_tham_chieu_cong_thanh_toan", sa.String(length=255), nullable=True),
            sa.Column("nguon_tao_giao_dich", sa.String(length=20), nullable=False, server_default="TAI_QUAY"),
            sa.Column("nguoi_thu_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True),
            sa.Column("thoi_gian_giao_dich", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("thoi_gian_xac_nhan", sa.DateTime(timezone=True), nullable=True),
            sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="THANH_CONG"),
            sa.Column("giao_dich_goc_id", sa.Integer(), sa.ForeignKey("giao_dich_thanh_toan.id", ondelete="SET NULL"), nullable=True),
            sa.Column("ghi_chu", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_giao_dich_hoa_don_trang_thai", "giao_dich_thanh_toan", ["hoa_don_id", "trang_thai"])
        op.create_index("ix_giao_dich_nguoi_thu_trang_thai", "giao_dich_thanh_toan", ["nguoi_thu_id", "trang_thai"])

    if "goi_kham" not in existing_tables:
        op.create_table(
            "goi_kham",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("ma_goi", sa.String(length=50), nullable=False, unique=True),
            sa.Column("ten_goi", sa.String(length=255), nullable=False),
            sa.Column("chuyen_khoa_chinh_id", sa.Integer(), sa.ForeignKey("chuyen_khoa.id", ondelete="SET NULL"), nullable=True),
            sa.Column("doi_tuong_ap_dung", sa.String(length=100), nullable=False, server_default="NAM_NU_TRUONG_THANH"),
            sa.Column("don_gia_niem_yet", sa.Numeric(precision=15, scale=2), nullable=False, server_default="0.00"),
            sa.Column("don_gia_khuyen_mai", sa.Numeric(precision=15, scale=2), nullable=False, server_default="0.00"),
            sa.Column("mo_ta", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_goi_kham_ma_goi", "goi_kham", ["ma_goi"])
        op.create_index("ix_goi_kham_ten_goi", "goi_kham", ["ten_goi"])

    if "chi_tiet_goi_kham" not in existing_tables:
        op.create_table(
            "chi_tiet_goi_kham",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("goi_kham_id", sa.Integer(), sa.ForeignKey("goi_kham.id", ondelete="CASCADE"), nullable=False),
            sa.Column("dich_vu_id", sa.Integer(), sa.ForeignKey("dich_vu.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("so_luong", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("ghi_chu", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("uq_chi_tiet_goi_kham", "chi_tiet_goi_kham", ["goi_kham_id", "dich_vu_id"], unique=True)

    if "goi_kham_da_mua" not in existing_tables:
        op.create_table(
            "goi_kham_da_mua",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("benh_nhan_id", sa.Integer(), sa.ForeignKey("benh_nhan.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("luot_kham_id", sa.Integer(), sa.ForeignKey("luot_kham.id", ondelete="SET NULL"), nullable=True),
            sa.Column("goi_kham_id", sa.Integer(), sa.ForeignKey("goi_kham.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("hoa_don_id", sa.Integer(), sa.ForeignKey("hoa_don.id", ondelete="SET NULL"), nullable=True, unique=True),
            sa.Column("ma_goi_snapshot", sa.String(length=50), nullable=True),
            sa.Column("ten_goi_snapshot", sa.String(length=255), nullable=True),
            sa.Column("don_gia_goi_snapshot", sa.Numeric(precision=15, scale=2), nullable=False, server_default="0.00"),
            sa.Column("mien_giam", sa.Numeric(precision=15, scale=2), nullable=False, server_default="0.00"),
            sa.Column("so_tien_phai_thu", sa.Numeric(precision=15, scale=2), nullable=False, server_default="0.00"),
            sa.Column("trang_thai", sa.String(length=30), nullable=False, server_default="HOAT_DONG"),
            sa.Column("thoi_gian_mua", sa.DateTime(timezone=True), nullable=True),
            sa.Column("nguoi_ban_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True),
            sa.Column("ghi_chu", sa.Text(), nullable=True),
            sa.Column("ma_dang_ky", sa.String(length=50), nullable=True, unique=True),
            sa.Column("ngay_dang_ky", sa.Date(), nullable=True),
            sa.Column("han_su_dung", sa.Date(), nullable=True),
            sa.Column("tong_so_dich_vu", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("so_dich_vu_da_dung", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_goi_kham_da_mua_benh_nhan", "goi_kham_da_mua", ["benh_nhan_id"])

    if "chi_tiet_goi_kham_da_mua" not in existing_tables:
        op.create_table(
            "chi_tiet_goi_kham_da_mua",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("goi_kham_da_mua_id", sa.Integer(), sa.ForeignKey("goi_kham_da_mua.id", ondelete="CASCADE"), nullable=False),
            sa.Column("chi_tiet_goi_kham_id", sa.Integer(), sa.ForeignKey("chi_tiet_goi_kham.id", ondelete="SET NULL"), nullable=True),
            sa.Column("dich_vu_id", sa.Integer(), sa.ForeignKey("dich_vu.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("ma_dich_vu_snapshot", sa.String(length=50), nullable=True),
            sa.Column("ten_dich_vu_snapshot", sa.String(length=150), nullable=True),
            sa.Column("so_luong_duoc_huong", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("don_gia_tham_chieu_snapshot", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
            sa.Column("so_luong_da_su_dung", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("thanh_tien", sa.Numeric(precision=15, scale=2), nullable=False, server_default="0.00"),
            sa.Column("trang_thai_muc", sa.String(length=30), nullable=False, server_default="CHUA_DUNG"),
            sa.Column("ghi_chu", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("uq_goi_da_mua_chi_tiet_dich_vu", "chi_tiet_goi_kham_da_mua", ["goi_kham_da_mua_id", "dich_vu_id"], unique=True)

    tai_khoan_cols = [c["name"] for c in inspector.get_columns("tai_khoan")]
    if "otp_code_hash" not in tai_khoan_cols:
        op.add_column("tai_khoan", sa.Column("otp_code_hash", sa.String(length=255), nullable=True))
    if "refresh_token_hash" not in tai_khoan_cols:
        op.add_column("tai_khoan", sa.Column("refresh_token_hash", sa.String(length=255), nullable=True, unique=True))

    benh_nhan_cols = [c["name"] for c in inspector.get_columns("benh_nhan")]
    if "nguoi_lien_he_khan_cap" not in benh_nhan_cols:
        op.add_column("benh_nhan", sa.Column("nguoi_lien_he_khan_cap", sa.String(length=100), nullable=True))
    if "moi_quan_he_khan_cap" not in benh_nhan_cols:
        op.add_column("benh_nhan", sa.Column("moi_quan_he_khan_cap", sa.String(length=30), nullable=True))
    if "sdt_lien_he_khan_cap" not in benh_nhan_cols:
        op.add_column("benh_nhan", sa.Column("sdt_lien_he_khan_cap", sa.String(length=20), nullable=True))

    bac_si_cols = [c["name"] for c in inspector.get_columns("bac_si")]
    if "ma_lien_thong_nguoi_ke_don" not in bac_si_cols:
        op.add_column("bac_si", sa.Column("ma_lien_thong_nguoi_ke_don", sa.String(length=100), nullable=True))

    lich_lam_viec_cols = [c["name"] for c in inspector.get_columns("lich_lam_viec")]
    if "buoc_gio_hen_phut" not in lich_lam_viec_cols:
        op.add_column("lich_lam_viec", sa.Column("buoc_gio_hen_phut", sa.Integer(), nullable=False, server_default="30"))
    if "so_luot_toi_da_moi_khung" not in lich_lam_viec_cols:
        op.add_column("lich_lam_viec", sa.Column("so_luot_toi_da_moi_khung", sa.Integer(), nullable=False, server_default="1"))

    lich_kham_cols = [c["name"] for c in inspector.get_columns("lich_kham")]
    if "lich_lam_viec_id" not in lich_kham_cols:
        op.add_column("lich_kham", sa.Column("lich_lam_viec_id", sa.Integer(), sa.ForeignKey("lich_lam_viec.id", ondelete="SET NULL"), nullable=True))
    if "thoi_gian_xac_nhan_lai" not in lich_kham_cols:
        op.add_column("lich_kham", sa.Column("thoi_gian_xac_nhan_lai", sa.DateTime(timezone=True), nullable=True))
    if "nguoi_huy_id" not in lich_kham_cols:
        op.add_column("lich_kham", sa.Column("nguoi_huy_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True))
    if "phan_tich_ai_id" not in lich_kham_cols:
        op.add_column("lich_kham", sa.Column("phan_tich_ai_id", sa.Integer(), sa.ForeignKey("phan_tich_ai.id", ondelete="SET NULL"), nullable=True))
    if "idempotency_key" not in lich_kham_cols:
        op.add_column("lich_kham", sa.Column("idempotency_key", sa.String(length=64), nullable=True))
        op.create_index("uq_lich_kham_benh_nhan_idempotency", "lich_kham", ["benh_nhan_id", "idempotency_key"], unique=True)

    hang_doi_kham_cols = [c["name"] for c in inspector.get_columns("hang_doi_kham")]
    if "lich_lam_viec_id" not in hang_doi_kham_cols:
        op.add_column("hang_doi_kham", sa.Column("lich_lam_viec_id", sa.Integer(), sa.ForeignKey("lich_lam_viec.id", ondelete="SET NULL"), nullable=True))

    phan_tich_ai_cols = [c["name"] for c in inspector.get_columns("phan_tich_ai")]
    if "ma_phien_phan_tich" not in phan_tich_ai_cols:
        op.add_column("phan_tich_ai", sa.Column("ma_phien_phan_tich", sa.String(length=100), nullable=True))

    phan_tich_ai_goi_y_cols = [c["name"] for c in inspector.get_columns("phan_tich_ai_goi_y")]
    if "thu_tu_uu_tien" not in phan_tich_ai_goi_y_cols:
        op.add_column("phan_tich_ai_goi_y", sa.Column("thu_tu_uu_tien", sa.Integer(), nullable=False, server_default="1"))

    thuoc_cols = [c["name"] for c in inspector.get_columns("thuoc")]
    if "ma_thuoc_noi_bo" not in thuoc_cols:
        op.add_column("thuoc", sa.Column("ma_thuoc_noi_bo", sa.String(length=50), nullable=True))
        op.execute("UPDATE thuoc SET ma_thuoc_noi_bo = ma_thuoc WHERE ma_thuoc_noi_bo IS NULL")
    if "ten_thuong_mai" not in thuoc_cols:
        op.add_column("thuoc", sa.Column("ten_thuong_mai", sa.String(length=255), nullable=True))
    if "dang_bao_che" not in thuoc_cols:
        op.add_column("thuoc", sa.Column("dang_bao_che", sa.String(length=100), nullable=True))
    if "ma_dinh_danh_ngoai" not in thuoc_cols:
        op.add_column("thuoc", sa.Column("ma_dinh_danh_ngoai", sa.String(length=100), nullable=True, unique=True))
    if "nguon_dinh_danh" not in thuoc_cols:
        op.add_column("thuoc", sa.Column("nguon_dinh_danh", sa.String(length=255), nullable=True))
    if "trang_thai_xac_minh" not in thuoc_cols:
        op.add_column("thuoc", sa.Column("trang_thai_xac_minh", sa.String(length=30), nullable=False, server_default="CHUA_XAC_MINH"))
    if "trang_thai_danh_muc" not in thuoc_cols:
        op.add_column("thuoc", sa.Column("trang_thai_danh_muc", sa.String(length=30), nullable=False, server_default="CHO_DUYET"))

    don_thuoc_cols = [c["name"] for c in inspector.get_columns("don_thuoc")]
    if "ma_don_thuoc" not in don_thuoc_cols:
        op.add_column("don_thuoc", sa.Column("ma_don_thuoc", sa.String(length=50), nullable=True, unique=True))
    if "loai_don_thuoc" not in don_thuoc_cols:
        op.add_column("don_thuoc", sa.Column("loai_don_thuoc", sa.String(length=10), nullable=True, server_default="NGOAI_TRU"))
    if "trang_thai_kiem_tra_lien_thong" not in don_thuoc_cols:
        op.add_column("don_thuoc", sa.Column("trang_thai_kiem_tra_lien_thong", sa.String(length=30), nullable=False, server_default="CHUA_KIEM_TRA"))
    if "trang_thai_dong_bo" not in don_thuoc_cols:
        op.add_column("don_thuoc", sa.Column("trang_thai_dong_bo", sa.String(length=30), nullable=False, server_default="CHUA_GUI"))
    if "thoi_gian_kiem_tra_lien_thong" not in don_thuoc_cols:
        op.add_column("don_thuoc", sa.Column("thoi_gian_kiem_tra_lien_thong", sa.DateTime(timezone=True), nullable=True))
    if "ma_lien_thong_bac_si_snapshot" not in don_thuoc_cols:
        op.add_column("don_thuoc", sa.Column("ma_lien_thong_bac_si_snapshot", sa.String(length=100), nullable=True))
    if "ma_lien_thong_co_so_snapshot" not in don_thuoc_cols:
        op.add_column("don_thuoc", sa.Column("ma_lien_thong_co_so_snapshot", sa.String(length=100), nullable=True))

    chi_tiet_don_thuoc_cols = [c["name"] for c in inspector.get_columns("chi_tiet_don_thuoc")]
    if "thuoc_id" not in chi_tiet_don_thuoc_cols:
        op.add_column("chi_tiet_don_thuoc", sa.Column("thuoc_id", sa.Integer(), sa.ForeignKey("thuoc.id", ondelete="RESTRICT"), nullable=True))
    if "dang_bao_che_snapshot" not in chi_tiet_don_thuoc_cols:
        op.add_column("chi_tiet_don_thuoc", sa.Column("dang_bao_che_snapshot", sa.String(length=100), nullable=True))
    if "duong_dung_snapshot" not in chi_tiet_don_thuoc_cols:
        op.add_column("chi_tiet_don_thuoc", sa.Column("duong_dung_snapshot", sa.String(length=100), nullable=True))
    if "ma_dinh_danh_ngoai_snapshot" not in chi_tiet_don_thuoc_cols:
        op.add_column("chi_tiet_don_thuoc", sa.Column("ma_dinh_danh_ngoai_snapshot", sa.String(length=100), nullable=True))

    hoa_don_cols = [c["name"] for c in inspector.get_columns("hoa_don")]
    if "kenh_ban" not in hoa_don_cols:
        op.add_column("hoa_don", sa.Column("kenh_ban", sa.String(length=20), nullable=False, server_default="TAI_QUAY"))
    if "so_tien_phai_thu" not in hoa_don_cols:
        op.add_column("hoa_don", sa.Column("so_tien_phai_thu", sa.Numeric(precision=15, scale=2), nullable=False, server_default="0.00"))
    if "nguoi_lap_id" not in hoa_don_cols:
        op.add_column("hoa_don", sa.Column("nguoi_lap_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="RESTRICT"), nullable=True))
    if "nguoi_huy_id" not in hoa_don_cols:
        op.add_column("hoa_don", sa.Column("nguoi_huy_id", sa.Integer(), sa.ForeignKey("nguoi_dung.id", ondelete="SET NULL"), nullable=True))
    if "thoi_gian_huy" not in hoa_don_cols:
        op.add_column("hoa_don", sa.Column("thoi_gian_huy", sa.DateTime(timezone=True), nullable=True))
    if "ly_do_huy" not in hoa_don_cols:
        op.add_column("hoa_don", sa.Column("ly_do_huy", sa.Text(), nullable=True))

    nhat_ky_cols = [c["name"] for c in inspector.get_columns("nhat_ky_truy_cap_y_te")]
    if "loai_nhat_ky" not in nhat_ky_cols:
        op.add_column("nhat_ky_truy_cap_y_te", sa.Column("loai_nhat_ky", sa.String(length=30), nullable=False, server_default="Y_TE"))
    if "noi_dung_cu_json" not in nhat_ky_cols:
        op.add_column("nhat_ky_truy_cap_y_te", sa.Column("noi_dung_cu_json", sa.JSON(), nullable=True))
    if "noi_dung_moi_json" not in nhat_ky_cols:
        op.add_column("nhat_ky_truy_cap_y_te", sa.Column("noi_dung_moi_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    pass
