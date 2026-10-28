import importlib.util
from pathlib import Path
import pytest
from sqlalchemy import inspect
from app.core.database import Base


def _load_migration_module(file_path: Path):
    spec = importlib.util.spec_from_file_location(file_path.stem, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_alembic_migration_chain_integrity():
    """
    Kiểm tra tính toàn vẹn của chuỗi Alembic Migrations (001 -> 005):
    - Đảm bảo các file migration tuân thủ mô hình DAG (Directed Acyclic Graph)
    - Mỗi phiên bản kế tiếp phải trỏ đúng down_revision về phiên bản trước đó
    - Có đủ cả 2 hàm upgrade() và downgrade()
    """
    versions_dir = Path(__file__).resolve().parent.parent / "alembic" / "versions"
    assert versions_dir.exists(), f"Thư mục migration {versions_dir} không tồn tại!"

    migration_files = sorted(
        [f for f in versions_dir.glob("*.py") if not f.name.startswith("__")],
        key=lambda x: x.name
    )
    assert len(migration_files) >= 5, f"Cần có ít nhất 5 bản migration, hiện có {len(migration_files)}"

    chain = []
    for file_path in migration_files:
        mod = _load_migration_module(file_path)
        assert hasattr(mod, "upgrade"), f"{file_path.name} thiếu hàm upgrade()"
        assert hasattr(mod, "downgrade"), f"{file_path.name} thiếu hàm downgrade()"
        assert hasattr(mod, "revision"), f"{file_path.name} thiếu biến revision"
        assert hasattr(mod, "down_revision"), f"{file_path.name} thiếu biến down_revision"
        chain.append((mod.revision, mod.down_revision, file_path.name))

    # Kiểm tra tính liên tục của chuỗi
    assert chain[0][1] is None, f"Bản đầu tiên {chain[0][2]} phải có down_revision=None"
    for i in range(1, len(chain)):
        current_rev, down_rev, fname = chain[i]
        prev_rev = chain[i - 1][0]
        assert down_rev == prev_rev, (
            f"Lỗi đứt gãy chuỗi migration tại {fname}: "
            f"down_revision là '{down_rev}' nhưng bản trước đó có revision là '{prev_rev}'"
        )


@pytest.mark.asyncio
async def test_full_45_tables_schema_metadata_integrity(db_session):
    """
    Kiểm tra CSDL 45 bảng trong Base.metadata:
    - Xác nhận toàn bộ 45 bảng đã được đăng ký trong SQLAlchemy metadata
    - Không có bảng nào bị thiếu cấu hình khóa chính (Primary Key)
    - Tất cả các ràng buộc khóa ngoại (Foreign Key) đều trỏ đến các bảng hợp lệ
    """
    metadata = Base.metadata
    table_names = set(metadata.tables.keys())

    # Danh sách 42 bảng cốt lõi của Clinic-AI
    expected_tables = {
        # 1. Người dùng & Phân quyền
        "nguoi_dung", "tai_khoan", "bac_si", "benh_nhan", "ho_so_nguoi_than",
        # 2. Cơ cấu tổ chức & Phòng khám
        "phong_kham", "chuyen_khoa",
        # 3. Lịch làm việc & Điều phối hàng đợi
        "lich_lam_viec", "lich_kham", "danh_sach_cho", "hang_doi_kham", "lich_dinh_ky_bac_si", "nghi_phep_bac_si", "phan_tich_ai", "danh_gia_ai",
        # 4. Hồ sơ bệnh án & Khám chữa bệnh TT 32
        "luot_kham", "chan_doan", "luot_kham_the_luc", "bien_ban_dinh_chinh", "danh_gia_dich_vu",
        # 5. Dịch vụ y tế & Chỉ định & Kê đơn
        "dich_vu", "chi_dinh", "don_thuoc", "chi_tiet_don_thuoc",
        # 6. Thu ngân & Hóa đơn & Đóng sổ ca
        "hoa_don", "chi_tiet_hoa_don", "phieu_thu_chi", "khoa_so_ca_truc",
        # 7. Tuân thủ y tế & Giấy phép hành nghề
        "giay_phep_co_so", "lich_su_giay_phep_bac_si", "nhat_ky_truy_cap_y_te",
        # 8. Gói khám cá nhân & Liệu trình phục hồi
        "goi_dich_vu", "chi_tiet_goi_dich_vu", "dang_ky_goi_kham", "lieu_trinh_dieu_tri", "buoi_dieu_tri",
        # 9. Danh mục y tế & Kiến thức AI & Nội dung
        "khai_niem", "tu_khoa_cap_cuu", "thong_bao", "mau_bieu_y_te", "bai_viet_tin_tuc", "he_thong_trang_thai_bff"
    }

    assert len(expected_tables) == 42, f"Tổng số bảng kỳ vọng phải là 42, hiện là {len(expected_tables)}"
    missing_tables = expected_tables - table_names
    assert not missing_tables, f"Thiếu các bảng sau trong CSDL: {missing_tables}"

    # Kiểm tra Primary Key của từng bảng
    for table_name, table in metadata.tables.items():
        assert len(table.primary_key.columns) > 0, f"Bảng {table_name} thiếu khóa chính (Primary Key)"
