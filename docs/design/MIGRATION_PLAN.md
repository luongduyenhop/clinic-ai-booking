# KẾ HOẠCH MIGRATION CƠ SỞ DỮ LIỆU (DATABASE MIGRATION PLAN)
## ALEMBIC REVISION 004: TCLINIC EXTENSIONS (CASHIER, SUBCLINICAL & PHYSICAL EXAM)

**Thời điểm lập:** 12/10/2026  
**Tài liệu:** `docs/design/MIGRATION_PLAN.md`  
**Phiên bản đích:** `004_tclinic_extensions`  
**Phiên bản trước:** `003_compliance_layer`  

---

## 1. Mục tiêu và Nguyên tắc An toàn (Safety Principles)

1. **Bảo toàn dữ liệu 100%:** Tuyệt đối không xóa bảng, không drop cột, không đổi kiểu dữ liệu các cột hiện có.
2. **Backward Compatibility:** Tất cả các cột bổ sung vào bảng hiện có (`chi_dinh_dich_vu`, `luot_kham`) đều có `nullable=True` hoặc có `server_default` an toàn. 
3. **Tính độc lập của Test Suite:** Khi chạy test với SQLite in-memory hoặc PostgreSQL test database, migration 004 phải tự động apply trơn tru mà không làm gãy bất kỳ fixture nào trong 359 baseline test.
4. **Khả năng Rollback (Downgrade):** Hàm `downgrade()` phải được viết chi tiết, hoàn trả schema về trạng thái chính xác của `003_compliance_layer`.

---

## 2. Chi tiết Thay đổi Schema (Alembic Operations)

### 2.1. Mở rộng Bảng hiện hữu

#### Bảng `chi_dinh_dich_vu`:
- Thêm cột `trang_thai_thuc_hien` (`VARCHAR(30)`, default `'cho_thanh_toan'`, nullable=False).
- Thêm cột `phong_thuc_hien_id` (`INTEGER`, nullable=True, FK `phong_kham(id)`).
- Thêm cột `ky_thuat_vien_id` (`INTEGER`, nullable=True, FK `nhan_vien(id)`).
- Thêm cột `thoi_gian_lay_mau` (`TIMESTAMPTZ`, nullable=True).
- Thêm cột `thoi_gian_thuc_hien` (`TIMESTAMPTZ`, nullable=True).
- Thêm cột `thoi_gian_tra_kq` (`TIMESTAMPTZ`, nullable=True).
- Thêm cột `file_dinh_kem_urls` (`JSONB` / `JSON`, nullable=True, default `[]`).
- Thêm cột `tri_so_chi_tiet` (`JSONB` / `JSON`, nullable=True, default `{}`).
- Thêm indexes: `ix_chi_dinh_trang_thai_thuc_hien`, `ix_chi_dinh_phong_thuc_hien_id`.

### 2.2. Tạo mới các Bảng Nghiệp vụ

#### Bảng `hoa_don` (Invoices):
- `id` (`INT`, PK, autoincrement)
- `ma_hoa_don` (`VARCHAR(50)`, unique, index) - VD: `HD-YYMMDD-XXXX`
- `luot_kham_id` (`INT`, FK `luot_kham(id)`, nullable=False, index)
- `benh_nhan_id` (`INT`, FK `benh_nhan(id)`, nullable=False, index)
- `thu_ngan_id` (`INT`, FK `nhan_vien(id)`, nullable=False, index)
- `tong_tien` (`NUMERIC(15, 2)`, nullable=False, default 0)
- `mien_giam` (`NUMERIC(15, 2)`, nullable=False, default 0)
- `thuc_thu` (`NUMERIC(15, 2)`, nullable=False, default 0)
- `phuong_thuc_thanh_toan` (`VARCHAR(30)`, nullable=False, default `'tien_mat'`)
- `trang_thai` (`VARCHAR(30)`, nullable=False, default `'chua_thu'`, index)
- `so_hoa_don_in` (`VARCHAR(50)`, nullable=True)
- `ghi_chu` (`TEXT`, nullable=True)
- `ngay_tao` (`TIMESTAMPTZ`, nullable=False)
- `ngay_thanh_toan` (`TIMESTAMPTZ`, nullable=True)

#### Bảng `chi_tiet_hoa_don` (Invoice Line Items):
- `id` (`INT`, PK, autoincrement)
- `hoa_don_id` (`INT`, FK `hoa_don(id)`, nullable=False, index)
- `loai_muc` (`VARCHAR(30)`, nullable=False) - Enum: `cong_kham`, `can_lam_sang`, `thuoc`, `vat_tu`, `khac`
- `muc_tham_chieu_id` (`INT`, nullable=True) - ID của `chi_dinh_dich_vu` hoặc `don_thuoc`
- `ten_khoan_thu` (`VARCHAR(255)`, nullable=False)
- `so_luong` (`INT`, nullable=False, default 1)
- `don_gia` (`NUMERIC(15, 2)`, nullable=False)
- `thanh_tien` (`NUMERIC(15, 2)`, nullable=False)
- `ghi_chu` (`TEXT`, nullable=True)

#### Bảng `phieu_thu_chi` (Receipt & Expense Slips):
- `id` (`INT`, PK, autoincrement)
- `ma_phieu` (`VARCHAR(50)`, unique, index) - VD: `PT-YYMMDD-XXXX` hoặc `PC-YYMMDD-XXXX`
- `loai_phieu` (`VARCHAR(20)`, nullable=False) - `THU` hoặc `CHI`
- `hoa_don_id` (`INT`, FK `hoa_don(id)`, nullable=True, index)
- `nguoi_giao_dich` (`VARCHAR(255)`, nullable=False)
- `so_tien` (`NUMERIC(15, 2)`, nullable=False)
- `phuong_thuc` (`VARCHAR(30)`, nullable=False)
- `ly_do` (`TEXT`, nullable=False)
- `nhan_vien_id` (`INT`, FK `nhan_vien(id)`, nullable=False)
- `thoi_gian` (`TIMESTAMPTZ`, nullable=False)
- `trang_thai_khoa_so` (`BOOLEAN`, nullable=False, default False)

#### Bảng `luot_kham_the_luc` (Physical Examination per TT 32/2023):
- `id` (`INT`, PK, autoincrement)
- `luot_kham_id` (`INT`, FK `luot_kham(id)`, unique=True, nullable=False, index)
- `chieu_cao` (`NUMERIC(5, 1)`, nullable=True) - cm
- `can_nang` (`NUMERIC(5, 1)`, nullable=True) - kg
- `bmi` (`NUMERIC(4, 1)`, nullable=True) - kg/m2
- `mach` (`INT`, nullable=True) - bpm
- `huyet_ap_tam_thu` (`INT`, nullable=True)
- `huyet_ap_tam_truong` (`INT`, nullable=True)
- `nhiet_do` (`NUMERIC(4, 1)`, nullable=True) - do C
- `nhip_tho` (`INT`, nullable=True) - l/p
- `thi_luc_mat_phai` (`VARCHAR(20)`, nullable=True)
- `thi_luc_mat_trai` (`VARCHAR(20)`, nullable=True)
- `tai_mui_hong` (`TEXT`, nullable=True)
- `rang_ham_mat` (`TEXT`, nullable=True)
- `tuan_hoan` (`TEXT`, nullable=True)
- `ho_hap` (`TEXT`, nullable=True)
- `tieu_hoa` (`TEXT`, nullable=True)
- `than_kinh` (`TEXT`, nullable=True)
- `da_lieu` (`TEXT`, nullable=True)
- `phan_loai_the_luc` (`VARCHAR(10)`, nullable=True) - `LOAI_I` đến `LOAI_V`
- `bac_si_ket_luan_id` (`INT`, FK `nhan_vien(id)`, nullable=True)
- `ngay_kham` (`TIMESTAMPTZ`, nullable=False)

---

## 3. Trình tự Thực thi Migration (Execution Strategy)

1. **Kiểm tra Pre-flight:**
   - Chạy lệnh `alembic current` để xác nhận database đang ở head `003_compliance_layer`.
2. **Khởi tạo File Migration:**
   - Tạo file `backend/alembic/versions/004_tclinic_extensions.py`.
   - Khai báo đúng `revision = "004_tclinic_extensions"` và `down_revision = "003_compliance_layer"`.
3. **Thực thi:**
   - Sử dụng `op.create_table`, `op.add_column`, `op.create_index`.
   - Với các môi trường SQLite dùng trong unit tests, sử dụng `batch_alter_table` của Alembic để tương thích việc add foreign keys.
4. **Kiểm tra Khả năng Rollback:**
   - Viết đầy đủ `op.drop_table` và `op.drop_column` trong hàm `downgrade()`.
