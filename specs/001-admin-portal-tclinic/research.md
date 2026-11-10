# Phase 0 Research & Technical Investigations: Admin Portal TClinic

**Feature**: `001-admin-portal-tclinic` | **Date**: 2026-11-10

---

## 1. Data Channel Migration Strategy (JSON BFF → PostgreSQL)

### 1.1 Hiện trạng & Vấn đề
- Hiện tại, một số màn hình Admin (ví dụ: `CatalogManagementPage`, `SettingClinicPage`, một số tab trong `ServicePackagesPage`) tương tác với backend thông qua endpoint `/admin/bootstrap` và `/admin/collections/{key}` được định nghĩa trong `bff_admin_service.py`. Dữ liệu này được lưu trữ dưới dạng JSON blob trong bảng `he_thong_trang_thai_bff`.
- Đồng thời, backend đã có các model SQLAlchemy quan hệ hoàn chỉnh: `dich_vu_kham`, `phong_kham`, `chuyen_khoa`, `bac_si`, `lich_truc`, `hoa_don`.
- **Rủi ro lớn**: Hai kênh dữ liệu này hoàn toàn độc lập. Khi Admin cập nhật một dịch vụ qua giao diện gọi kho JSON, dữ liệu trong bảng `dich_vu_kham` thực tế không thay đổi, dẫn đến màn hình bác sĩ và quầy lễ tân không thấy dịch vụ mới hoặc nhận giá cũ.

### 1.2 Giải pháp Kiến trúc
1. **Chuyển đổi 100% Endpoint Nghiệp vụ**:
   - Mọi thao tác CRUD về danh mục y tế, bảng giá, phòng khám, nhân sự và lịch trực phải gọi trực tiếp vào API quan hệ tương ứng (`/api/admin/catalog/*`, `/api/admin/staff/*`, `/api/admin/bi/*`).
2. **Quy chuẩn giữ lại cho kho JSON**:
   - Bảng `he_thong_trang_thai_bff` CHỈ được dùng để lưu trữ các cấu hình hiển thị giao diện tùy biến (customizable navigation layout, dynamic UI preferences, và mẫu in biểu mẫu động khi chưa cấu hình cứng).
3. **Chiến lược Migration an toàn**:
   - Bước 1: Sao lưu toàn bộ bản ghi trong `he_thong_trang_thai_bff`.
   - Bước 2: Viết script trích xuất dữ liệu từ JSON sang các bảng quan hệ nếu có dữ liệu người dùng đã tạo trong JSON.
   - Bước 3: Cập nhật frontend `AdminService.js` để trỏ vào endpoint quan hệ thật.
   - Bước 4: Chạy kiểm thử hồi quy xác nhận dữ liệu hiển thị đồng bộ giữa Admin và các portal nghiệp vụ khác.

---

## 2. Router Modularization Strategy (Tách nhỏ `admin.py`)

### 2.1 Hiện trạng
- Tệp `clinic-ai/backend/app/routers/admin.py` hiện đang chứa một lượng lớn endpoint hỗn hợp: từ thống kê BI, bác sĩ, phòng khám, dịch vụ, ca trực, nghỉ phép, cấu hình phòng khám cho đến audit logs.
- Việc 5 thành viên cùng sửa đổi một tệp `admin.py` duy nhất là nguyên nhân hàng đầu dẫn đến xung đột Git và ghi đè code khi merge PR.

### 2.2 Kiến trúc Module hóa Đích
Tách `admin.py` thành gói module `clinic-ai/backend/app/routers/admin/`:
```text
clinic-ai/backend/app/routers/admin/
├── __init__.py                # Export admin_router tổng hợp (TV1 quản lý)
├── admin_bi.py                # Dashboard stats, KPI buồng khám, doanh thu, export Excel (WP-01)
├── admin_catalog.py           # Dịch vụ, bảng giá, thuốc BYT, ICD-10, buồng khám, khoa (WP-02)
├── admin_staff.py             # Nhân sự, CCHN bác sĩ, lịch trực, nghỉ phép, RBAC (WP-03)
├── admin_integration.py       # Giám sát đồng bộ đơn thuốc QG, cấu hình gateway (WP-05)
└── admin_audit.py             # Truy vấn nhật ký kiểm toán y tế append-only (WP-04)
```

**Nguyên tắc ranh giới phạm vi**:
- Tuyệt đối không đưa `admin_cashier.py` hoặc `admin_clinical.py` vào Admin Portal vì `cashier.py` và `clinical.py` đã tồn tại riêng biệt phục vụ bàn làm việc của Bác sĩ và Thu ngân.

---

## 3. Seed Script Architecture (`scripts/seed_admin_demo.py`)

### 3.1 Yêu cầu cốt lõi
Sau khi database vừa được làm sạch (chỉ giữ lại tài khoản đăng nhập), nhóm phát triển cần một công cụ sinh dữ liệu thử nghiệm nhanh chóng, nhất quán và an toàn tuyệt đối.

### 3.2 6 Rào chắn An toàn (Safeguards)
1. **Tính lũy nghiệm (Idempotency)**:
   - Script kiểm tra sự tồn tại của bản ghi dựa trên mã duy nhất (code/slug) trước khi tạo. Chạy 1 lần hay 10 lần đều cho ra cùng một trạng thái dữ liệu.
2. **Bảo vệ môi trường (Environment Guard)**:
   - Cờ `--reset` bắt buộc kiểm tra biến môi trường `ENVIRONMENT in ['dev', 'test', 'local']` hoặc `DATABASE_URL` chứa `localhost`/`127.0.0.1`/`test`. Chặn đứng và dừng khẩn cấp nếu phát hiện chạy trên môi trường khác.
3. **Bảo tồn tài khoản người dùng (Account Preservation)**:
   - Thao tác `--reset` KHÔNG DROP bảng `nguoi_dung`, giữ nguyên toàn bộ tài khoản và mật khẩu đã tạo.
4. **Bảo đảm toàn vẹn khóa ngoại (Referential Integrity)**:
   - Khởi tạo tuần tự theo đúng thứ tự phụ thuộc: `ChuyenKhoa` → `PhongKham` → `BacSi` (kèm CCHN) → `CaTruc` → `DichVuKham` (kèm giá) → `BenhNhan` → `LichHen` → `LuotKham` → `HoaDon`.
5. **100% Dữ liệu giả lập (Synthetic Data)**:
   - Toàn bộ họ tên bệnh nhân, số điện thoại (`0900000001`..`0900000010`), CCCD (`001200000001`), địa chỉ đều là dữ liệu mẫu quy ước, không chứa PII của người thật.
6. **Chống trùng lặp khi `--append`**:
   - Sử dụng cơ chế UPSERT (`ON CONFLICT DO NOTHING` hoặc truy vấn kiểm tra trước) để bảo đảm khi append không sinh ra các bản ghi trùng lặp mã dịch vụ hay mã phòng.

---

## 4. Quy trình 6 bước Audit và Tinh gọn Menu Admin

### 4.1 Bảng phân loại sơ bộ các nhóm menu hiện hữu
| Nhóm hiện tại (~60 mục) | Hành động đề xuất | Gói công việc |
|---|---|---|
| Dashboard, Doanh thu, Thống kê, Báo cáo | **Giữ** & đồng bộ API thật | WP-01 (TV1) |
| Khoa phòng, Buồng khám, Dịch vụ, Bảng giá, Thuốc, ICD-10 | **Giữ** & chuẩn hóa TT32 | WP-02 (TV2) |
| Biểu mẫu in ấn (4 tab rời rạc) | **Hợp nhất** thành 1 màn hình quản lý mẫu in | WP-02 (TV2) |
| Bác sĩ, Nhân viên, Phân ca, Nghỉ phép, Quyền | **Giữ** & siết chặt RBAC API | WP-03 (TV3) |
| Hướng dẫn, Hỏi đáp (`/admin/huong-dan`, `/admin/hoi-dap`) | **Sửa** (nối lại vào `GuideAndQaManagementPage.jsx`) | WP-01 (TV1) |
| Khám đoàn, Đăng ký đoàn | **Sửa** (nối lại vào `CorporateHealthPage.jsx`) | WP-05 / WP-01 |
| BHYT (Giám định, cổng bảo hiểm) | **Xóa** (Out of Scope phòng khám tư) | WP-01 (TV1) |
| Gói dịch vụ (4 tab), Liệu trình (6 tab) | **Hợp nhất** theo query `?tab=` | WP-02, WP-05 |

### 4.2 Kế hoạch dọn dẹp mã nguồn
- Sử dụng công cụ kiểm tra tĩnh (ESLint, grep) để rà soát toàn bộ import của các component trước khi xóa.
- Bổ sung test kiểm tra các route chính trong `fe/tests/prRegressionGuard.test.mjs`.

---

## 5. Rào chắn Ngăn ngừa Xung đột PR (Git & CI Guard)

### 5.1 Phân định quyền sở hữu tệp (CODEOWNERS)
Tạo tệp `.github/CODEOWNERS` chỉ định:
- `clinic-ai/fe/src/App.jsx` @thanhvien1
- `clinic-ai/fe/src/layouts/AdminTemplate.jsx` @thanhvien1
- `clinic-ai/fe/src/services/admin/seed/clinicSeed.json` @thanhvien1
- `clinic-ai/backend/app/routers/admin/__init__.py` @thanhvien1
- `clinic-ai/backend/app/routers/admin/admin_catalog.py` @thanhvien2
- `clinic-ai/backend/app/routers/admin/admin_staff.py` @thanhvien3
- `clinic-ai/backend/app/routers/admin/admin_audit.py` @thanhvien4
- `clinic-ai/backend/app/routers/admin/admin_integration.py` @thanhvien5

### 5.2 Quy tắc làm việc bắt buộc trên Git
1. Mỗi thành viên làm việc trên branch riêng tạo từ `origin/develop` mới nhất.
2. Giới hạn quy mô PR: Mỗi PR chỉ giải quyết 1 tính năng hoặc 1 menu cụ thể, không gộp nhiều màn hình.
3. Trước khi mở PR: Thực hiện `git fetch origin` và `git rebase origin/develop`.
4. Tuyệt đối cấm giải quyết xung đột bằng cách "accept ours" hay "accept theirs" trên toàn bộ tệp.
5. Chạy lệnh kiểm thử tự động bắt buộc trước khi push:
   - Frontend: `npm --prefix clinic-ai/fe test` (đặc biệt là `prRegressionGuard.test.mjs`).
   - Backend: `pytest clinic-ai/backend/tests`.
