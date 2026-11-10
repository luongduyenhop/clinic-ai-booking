# Implementation Plan: Phân hệ Quản trị viên (Admin Portal) theo chuẩn TClinic

**Branch**: `001-admin-portal-tclinic` | **Date**: 2026-11-10 | **Spec**: [`spec.md`](file:///d:/dowload/tailieu/specs/001-admin-portal-tclinic/spec.md)

---

## 1. Summary

Kế hoạch này triển khai kiến trúc kỹ thuật và lộ trình thực thi để hoàn thiện phân hệ Quản trị viên (Admin Portal) theo chuẩn tham chiếu TClinic (`demo.tclinic.io`), loại bỏ dứt điểm tình trạng 2 kênh dữ liệu song song (chuyển 100% về cơ sở dữ liệu quan hệ PostgreSQL), phân tách module hóa router backend nhằm triệt tiêu xung đột code giữa các Pull Request của 5 thành viên, xử lý an toàn trạng thái dữ liệu rỗng và cung cấp script seed dữ liệu mẫu kiểm thử có rào chắn bảo vệ.

---

## 2. Technical Context

- **Language/Version**: Python 3.11+ (Backend), JavaScript / JSX / TypeScript, Node.js 18+ (Frontend)
- **Primary Dependencies**: FastAPI, SQLAlchemy 2.0 (Async), Pydantic v2, Alembic; React 18, Vite, Tailwind CSS, Lucide React
- **Storage**: PostgreSQL (các bảng quan hệ: `chuyen_khoa`, `phong_kham`, `bac_si`, `dich_vu_kham`, `bang_gia_dich_vu`, `danh_muc_thuoc`, `benh_icd10`, `ca_truc`, `nhat_ky_truy_cap_y_te`). Bảng `he_thong_trang_thai_bff` chỉ lưu trữ cấu hình giao diện động
- **Testing**: `pytest`, `pytest-asyncio` cho backend; `vitest`, `node` test runner cho frontend (`fe/tests/prRegressionGuard.test.mjs`)
- **Target Platform**: Trình duyệt web hiện đại (Chrome, Edge, Firefox, Safari); máy chủ Linux / Windows
- **Project Type**: Full-stack Web Service & Single Page Application (SPA)
- **Performance Goals**: Tải trang và truy vấn danh mục dưới 1.5 giây cho 1,000 bản ghi; thời gian phản hồi API p95 < 200ms
- **Constraints**: Tuân thủ tuyệt đối Hiến pháp dự án: Không có comment (`#`, `//`, `/* */`) và không có docstring trong mã nguồn; phân quyền RBAC chặt chẽ tại API; hồ sơ y tế và lịch sử giá bất biến
- **Scale/Scope**: Phân hệ quản trị phòng khám đa khoa quy mô ~50 buồng khám, ~100 nhân sự y tế, ~1,000 lượt khám/ngày

---

## 3. Constitution Check

*Tất cả 5 nguyên tắc Hiến pháp dự án Clinic-AI đều được kiểm tra và đáp ứng đầy đủ:*

1. **Principle I — Clinical Immutability & Audit Trail**:
   - *Status*: PASS
   - *Evidence*: Mọi truy vấn và sửa đổi cấu hình được ghi log append-only qua `admin_audit.py`; bảng giá lịch sử giữ nguyên (không in-place update).
2. **Principle II — Deterministic State Machines & Invariants**:
   - *Status*: PASS
   - *Evidence*: Quản trị trạng thái CCHN bác sĩ (`ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `SUSPENDED`, `REVOKED`) chặn cứng phân ca trực khi vi phạm điều kiện hành nghề; phát hiện xung đột buồng khám và bác sĩ.
3. **Principle III — Strict Clean Code & Zero Inline Comments**:
   - *Status*: PASS
   - *Evidence*: Toàn bộ mã nguồn mới phát triển hoặc refactor đảm bảo sạch 100%, không chứa comment và không chứa docstring.
4. **Principle IV — Role-Based Segregation & Credential Guarding**:
   - *Status*: PASS
   - *Evidence*: Các API `/api/admin/*` bắt buộc kiểm tra JWT và quyền hạn tại route dependencies; phân tách rạch ròi giữa Admin quản trị và các workspace lâm sàng (khám bệnh, thu ngân).
5. **Principle V — Specification-Driven & Test-First Verification**:
   - *Status*: PASS
   - *Evidence*: Quy trình đi đúng thứ tự Spec → Clarify → Plan → Tasks → Tests → Implementation; duy trì rào chắn `prRegressionGuard.test.mjs`.

---

## 4. Project Structure & Concrete File Layout

```text
clinic-ai/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── admin/                         # Module hóa router Admin
│   │   │   │   ├── __init__.py                # Root admin router (TV1 sở hữu)
│   │   │   │   ├── admin_bi.py                # Dashboard stats, KPI buồng khám, export Excel (WP-01)
│   │   │   │   ├── admin_catalog.py           # Dịch vụ, bảng giá, thuốc, ICD-10, buồng khám (WP-02)
│   │   │   │   ├── admin_staff.py             # Nhân sự, CCHN, ca trực, nghỉ phép, RBAC (WP-03)
│   │   │   │   ├── admin_integration.py       # Giám sát đồng bộ đơn thuốc quốc gia (WP-05)
│   │   │   │   └── admin_audit.py             # Nhật ký kiểm toán y tế append-only (WP-04)
│   │   │   ├── cashier.py                     # Giữ nguyên (thuộc Cashier workspace riêng)
│   │   │   └── clinical.py                    # Giữ nguyên (thuộc Doctor workspace riêng)
│   │   ├── services/
│   │   │   ├── admin_service.py               # Chuyển đổi đọc/ghi từ PostgreSQL
│   │   │   └── bff_admin_service.py           # Chỉ giữ cấu hình UI động
│   ├── scripts/
│   │   └── seed_admin_demo.py                 # Script CLI seed dữ liệu mẫu với 6 rào chắn an toàn
│   └── tests/
│       ├── test_admin_catalog.py              # Test CRUD danh mục và bất biến bảng giá
│       ├── test_admin_staff_shift.py          # Test xung đột ca trực và CCHN
│       └── test_seed_admin_demo.py            # Test tính lũy nghiệm (idempotency) của seed script
├── fe/
│   ├── src/
│   │   ├── App.jsx                            # Cập nhật route sạch, nối route chết (TV1 sở hữu)
│   │   ├── layouts/
│   │   │   └── AdminTemplate.jsx              # Sidebar tinh gọn 5 nhóm nghiệp vụ (TV1 sở hữu)
│   │   ├── pages/admin/
│   │   │   ├── DashboardAdminPage.jsx         # Sửa empty state hiển thị 0 thay vì sập (WP-01)
│   │   │   ├── CatalogManagementPage.jsx      # Chuyển sang gọi API quan hệ thật (WP-02)
│   │   │   ├── RolePermissionPage.jsx         # Quản trị vai trò & quyền hạn (WP-03)
│   │   │   ├── ComplianceAndAuditPage.jsx     # Giám sát đơn thuốc & audit log (WP-04, WP-05)
│   │   │   ├── GuideAndQaManagementPage.jsx   # Nối lại route từ App.jsx (WP-01)
│   │   │   └── CorporateHealthPage.jsx        # Nối lại route từ App.jsx (WP-05)
│   │   └── services/admin/
│   │       ├── AdminService.js                # Chuyển endpoint sang các sub-router mới
│   │       └── seed/clinicSeed.json           # Tinh gọn menu còn 5 nhóm nghiệp vụ chính
│   └── tests/
│       └── prRegressionGuard.test.mjs         # Rào chắn kiểm thử hồi quy bắt buộc trên CI
├── .github/
│   └── CODEOWNERS                             # Phân định quyền sở hữu tệp dùng chung
└── specs/001-admin-portal-tclinic/
    ├── spec.md                                # Đặc tả yêu cầu đã được làm rõ
    ├── research.md                            # Phase 0: Điều tra kỹ thuật và giải pháp
    ├── data-model.md                          # Phase 1: Mô hình thực thể và FSM
    ├── quickstart.md                          # Phase 1: Hướng dẫn khởi chạy & test
    ├── contracts/                             # Phase 1: API OpenAPI contracts
    └── tasks.md                               # Phase 2: Danh sách công việc phân rã
```

---

## 5. Work Breakdown Structure (5 Gói Công việc Thực thi)

| Gói | Phụ trách | Phạm vi & Trách nhiệm tệp | Trọng tâm kiểm thử & Nghiệm thu |
|:---:|:---:|---|---|
| **WP-01** | **Thành viên 1** (Lead Nền tảng) | `admin_bi.py`, `AdminTemplate.jsx`, `App.jsx`, `clinicSeed.json`, `DashboardAdminPage.jsx`, `GuideAndQaManagementPage.jsx` | - Audit và tinh gọn menu sidebar.<br>- Xử lý an toàn empty state Dashboard khi DB rỗng.<br>- Nối lại các route chết.<br>- Quản lý root router và CI `prRegressionGuard`. |
| **WP-02** | **Thành viên 2** (Danh mục Y tế) | `admin_catalog.py`, `CatalogManagementPage.jsx`, `TemplateManagementPage.jsx`, `ServicePackagesPage.jsx` | - Chuyển đổi dữ liệu dịch vụ, bảng giá, phòng khám từ JSON sang PostgreSQL.<br>- Kiểm tra tính bất biến của bảng giá.<br>- Hợp nhất biểu mẫu in ấn. |
| **WP-03** | **Thành viên 3** (Nhân sự & RBAC) | `admin_staff.py`, `RolePermissionPage.jsx`, `SettingClinicPage.jsx` | - CRUD bác sĩ và quản trị CCHN.<br>- Chặn phân ca trực khi CCHN hết hạn/đình chỉ.<br>- Kiểm tra xung đột buồng khám và trùng giờ ca trực.<br>- Kiểm soát phân quyền ở cấp độ API (403 Forbidden). |
| **WP-04** | **Thành viên 4** (Kiểm toán & Data Seed) | `admin_audit.py`, `ComplianceAndAuditPage.jsx`, `scripts/seed_admin_demo.py` | - Xây dựng script seed dữ liệu mẫu với 6 rào chắn an toàn.<br>- Hiển thị và lọc nhật ký kiểm toán y tế append-only.<br>- Bảo đảm chỉ Admin có quyền mới xem được log. |
| **WP-05** | **Thành viên 5** (Tích hợp & Khám đoàn) | `admin_integration.py`, `CorporateHealthPage.jsx` | - Giám sát trạng thái hàng đợi đồng bộ đơn thuốc quốc gia.<br>- Khôi phục và chuẩn hóa trang Khám sức khỏe đoàn (quản lý hợp đồng/danh mục gói).<br>- Loại bỏ các route `/admin/lieu-trinh` và `/admin/lieutrinh` khỏi Admin Portal theo Phương án A. |

---

## 6. Definition of Done (DoD) cho từng PR

Mỗi Pull Request của từng thành viên chỉ được phê duyệt và merge vào nhánh `develop` khi:
1. Tuân thủ đúng nhánh tính năng (`feature/admin-wp*`) tạo từ `origin/develop` mới nhất.
2. Được thành viên sở hữu file (CODEOWNERS) review và approve.
3. 100% không chứa comment (`#`, `//`, `/* */`) và không chứa docstring.
4. Chạy vượt qua bộ kiểm thử tự động trên CI:
   - `npm --prefix clinic-ai/fe test`
   - `node clinic-ai/fe/tests/prRegressionGuard.test.mjs`
   - `pytest clinic-ai/backend/tests`
5. Đạt phiếu nghiệm thu 8 tiêu chí đã cam kết tại tài liệu đặc tả.
