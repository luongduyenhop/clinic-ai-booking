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
   - *Evidence*: Quản trị trạng thái CCHN bác sĩ theo nguyên tắc nghiệp vụ đã phê duyệt (`ACTIVE`, `EXPIRED`, `SUSPENDED` theo US-03 AC-6, FR-034; riêng `REVOKED` là đề xuất kỹ thuật chưa phê duyệt chờ OQ-4); phát hiện xung đột buồng khám và bác sĩ theo yêu cầu đã duyệt (FR-035).
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
│       ├── test_admin_staff.py                # Test nhân sự, ca trực, CCHN và phân quyền
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
| **WP-01** | **Thành viên 1** (Lead Nền tảng) | `admin_bi.py`, `AdminTemplate.jsx`, `App.jsx`, `clinicSeed.json`, `DashboardAdminPage.jsx`, `GuideAndQaManagementPage.jsx` | - Audit và tinh gọn sidebar menu; phân loại chi tiết 6 menu thuộc nhóm `courses`: loại bỏ 3 menu lâm sàng/thao tác tuyến đầu (`Liệu trình`, `Hóa đơn`, `Lịch liệu trình`); đánh giá chuyển giao danh mục sang WP-02 và báo cáo tổng hợp sang WP-01; không xóa máy móc các danh mục/báo cáo hợp lệ.<br>- Xử lý an toàn empty state Dashboard khi DB rỗng; đánh giá tiếp nhận báo cáo liệu trình thống kê tổng hợp ẩn danh.<br>- Nối lại các route chết `/admin/huong-dan` và `/admin/hoi-dap`.<br>- Quản lý root router và CI `prRegressionGuard`. |
| **WP-02** | **Thành viên 2** (Danh mục Y tế) | `admin_catalog.py`, `CatalogManagementPage.jsx`, `TemplateManagementPage.jsx`, `ServicePackagesPage.jsx` | - Chuyển đổi dữ liệu dịch vụ, bảng giá, phòng khám từ JSON sang PostgreSQL.<br>- Kiểm tra tính bất biến của bảng giá.<br>- Hợp nhất biểu mẫu in ấn.<br>- Đánh giá tiếp nhận `Danh mục bài tập` và `Danh mục gói liệu trình mẫu` vào phạm vi `CatalogManagementPage.jsx` hiện tại (tuyệt đối không tạo module danh mục mới ngoài phạm vi). |
| **WP-03** | **Thành viên 3** (Nhân sự & RBAC) | `admin_staff.py`, `RolePermissionPage.jsx`, `SettingClinicPage.jsx` | - CRUD bác sĩ và quản trị CCHN.<br>- Chặn phân ca trực khi CCHN hết hạn/đình chỉ.<br>- Kiểm tra xung đột buồng khám và trùng giờ ca trực.<br>- Kiểm soát phân quyền ở cấp độ API (403 Forbidden). |
| **WP-04** | **Thành viên 4** (Kiểm toán & Data Seed) | `admin_audit.py`, `ComplianceAndAuditPage.jsx`, `scripts/seed_admin_demo.py` | - Xây dựng script seed dữ liệu mẫu với 6 rào chắn an toàn.<br>- Hiển thị và lọc nhật ký kiểm toán y tế append-only.<br>- Bảo đảm chỉ Admin có quyền mới xem được log. |
| **WP-05** | **Thành viên 5** (Tích hợp & Khám đoàn) | `admin_integration.py`, `CorporateHealthPage.jsx`, `App.jsx`, `AdminTemplate.jsx` | Tách thành 2 PR độc lập:<br>- **PR-06A**: Giám sát đơn thuốc quốc gia qua Mock Adapter và FSM nội bộ (`T038`, `T040`).<br>- **PR-06B**: Chuẩn hóa Khám đoàn (`CorporateHealthPage.jsx`) và loại bỏ các route `/admin/lieu-trinh`, `/admin/lieutrinh` khỏi Admin Portal theo Phương án A (`T039`, `T041`, `T042`, `T043`); bảo đảm Admin không truy cập component lâm sàng; tuyệt đối không mở rộng xây dựng workspace/API mới cho Doctor/Staff/Cashier. |

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

---

## 7. Architectural Decisions & Open Questions Boundaries (OQ-1..OQ-8)

Phân loại trạng thái mở của các Open Questions theo 3 cấp độ chuẩn hóa:
- **FULLY UNBLOCKED**: Không còn quyết định nào chưa giải quyết chặn việc triển khai.
- **PARTIALLY UNBLOCKED**: Việc triển khai có thể tiến hành nhưng bị giới hạn nghiêm ngặt trong ranh giới đã được phê duyệt; các thành phần ngoài ranh giới không được tự ý suy diễn.
- **BLOCKED**: Việc triển khai đòi hỏi quyết định chưa ban hành của PO hoặc bằng chứng/tài liệu pháp lý, tích hợp từ bên ngoài.

Toàn bộ 8 câu hỏi kiến trúc và nghiệp vụ hiện được xác định ở trạng thái **PARTIALLY UNBLOCKED** theo các ranh giới thực thi cụ thể:

1. **OQ-1: Patient Data Access & Audit Policy (TV4)** — **PARTIALLY UNBLOCKED**:
   - *Ranh giới được phép triển khai*: Tuân thủ triệt để 4 quyết định PO-01..PO-04 (ADMIN chỉ xem năm sinh qua `patient:read_basic`, cấm xem ngày sinh đầy đủ; xem CCCD masked phải có permission riêng; loại trừ toàn diện BHYT; số điện thoại/địa chỉ xem theo mục đích vận hành hợp lệ).
   - *Ranh giới kỹ thuật cần hoàn thiện*: Mở rộng schema `NhatKyTruyCapDuLieuYTe` bổ sung trường `result`, `purpose` và gắn permission guard cho các API tài chính (`/billing`, `/cashier`) tại Backend.
   - *Tasks bị ảnh hưởng*: `T030` (Middleware phân quyền chi tiết), `T035` (API truy vấn audit log), `T036` (Giao diện Audit Trail).

2. **OQ-2: Prescription Integration (TV5)** — **PARTIALLY UNBLOCKED**:
   - *Ranh giới được phép triển khai*: Khóa chặt kiến trúc trong Adapter Pattern nội bộ `MockNationalPrescriptionGatewayAdapter`; FSM đồng bộ (`PENDING_SYNC` -> `SYNCING` -> `SYNCED` / `SYNC_FAILED` -> `RETRY_PENDING`); cơ chế Idempotency gắn `correlation_id` (UUIDv4) trên từng lượt gửi để chống gửi trùng.
   - *Ranh giới bị chặn (BLOCKED)*: Tuyệt đối cấm kết nối API thật với Cổng đơn thuốc quốc gia do chưa có tài liệu kỹ thuật chính thức và chứng thư số.
   - *Tasks bị ảnh hưởng*: `T038` (Test nội bộ Mock Adapter & FSM), `T040` (API giám sát hàng đợi và trạng thái đơn thuốc).

3. **OQ-3: Audit Retention & Fail Policy (TV4)** — **PARTIALLY UNBLOCKED**:
   - *Ranh giới được phép triển khai*: Cơ chế lưu trữ bắt buộc cấu hình được (configurable parameter); cơ chế Fail-Closed cho thao tác nhạy cảm (rollback và trả HTTP 500 `AUDIT_LOG_FAILURE`); cơ chế Fail-Open cho báo cáo tổng hợp BI (ghi log cảnh báo, không ngắt luồng UI).
   - *Ranh giới bị chặn/chờ phê duyệt (BLOCKED/PENDING)*: Cấm hardcode thời hạn cố định (như 10 năm y tế / 2 năm vận hành) vào mã nguồn; số năm cụ thể tiếp tục chờ văn bản xác minh pháp lý (NĐ 102/2025/NĐ-CP, NĐ 13/2023/NĐ-CP) và phê chuẩn của PO.
   - *Tasks bị ảnh hưởng*: `T033` (Test truy vấn audit log), `T035` (API audit trail).

4. **OQ-4: CCHN & Multi-source Legal Mapping (PO/BA)** — **PARTIALLY UNBLOCKED**:
   - *Ranh giới được phép triển khai*: Áp dụng nguyên tắc nghiệp vụ đã phê duyệt: từ chối phân công chuyên môn cho bác sĩ có CCHN mang trạng thái `EXPIRED` hoặc `SUSPENDED` (FR-034, US-03 AC-6).
   - *Ranh giới bị chặn/chờ phê duyệt (BLOCKED/PENDING)*: Trạng thái `REVOKED` (Thu hồi CCHN) là đề xuất kỹ thuật chưa phê duyệt, cấm đưa vào mã nguồn/schema; chi tiết pháp lý tước quyền hành nghề theo Luật KCB 2023 chờ thẩm định pháp lý văn bản.
   - *Tasks bị ảnh hưởng*: `T025` (Test kiểm tra CCHN), `T028` (CRUD Bác sĩ & CCHN trong `admin_staff.py`).

5. **OQ-5: Scheduling Rules Matrix (TV3)** — **PARTIALLY UNBLOCKED**:
   - *Ranh giới được phép triển khai*: Yêu cầu phát hiện xung đột bác sĩ bị xếp trùng ca và buồng khám bị xếp trùng ca trong cùng khung giờ là yêu cầu đã phê duyệt (FR-035, Edge Case 8, US-03 AC-7). Tách biệt rạch ròi giữa Lịch trực nhân sự (Staff Shift) và Lịch hẹn bệnh nhân (Patient Appointments) là Invariant đã duyệt (FR-035, US-03 AC-8).
   - *Ranh giới bị chặn/chờ phê duyệt (BLOCKED/PENDING)*: Phân định Chặn cứng (Hard Block - từ chối lưu) vs Cảnh báo mềm (Soft Warning - cho phép lưu kèm cảnh báo); mã lỗi HTTP 409 Conflict là chi tiết triển khai API áp dụng khi cấu hình chặn cứng, không tự động áp dụng HTTP 409 cho mọi xung đột phát hiện được; các ngưỡng tham số minh họa (nghỉ < 8h, tuần > 48h, CCHN sắp hết hạn <= 30 ngày) chỉ là đề xuất kỹ thuật tham khảo chờ PO ban hành Quy chế điều phối ca trực.
   - *Tasks bị ảnh hưởng*: `T026` (Test phát hiện va chạm ca trực), `T029` (Logic kiểm tra xung đột trong `admin_staff.py`).

6. **OQ-6: Session & Token Invalidation (TV3)** — **PARTIALLY UNBLOCKED**:
   - *Ranh giới được phép triển khai*: Token Versioning (`token_version` trên `User`) kết hợp kiểm tra per-request tại dependency `get_current_user`; vô hiệu hóa token ngay lập tức khi Admin khóa tài khoản hoặc thu hồi quyền.
   - *Ranh giới chờ xác minh (PENDING)*: Chỉ số cam kết độ trễ vô hiệu hóa ($p95 \le 50$ms, tối đa $\le 500$ms) cần số liệu benchmark đo lường thực tế trên môi trường chạy thử nghiệm.
   - *Tasks bị ảnh hưởng*: `T027` (Test 403 Forbidden khi thu hồi quyền), `T030` (Middleware RBAC).

7. **OQ-7: Revenue Recognition Rules (PO / TV1)** — **PARTIALLY UNBLOCKED**:
   - *Ranh giới được phép triển khai*: Doanh thu KCB ghi nhận tại thời điểm hóa đơn chuyển sang trạng thái `PAID` căn cứ theo mốc `paid_at`; tạm ứng là nợ phải trả; hoàn tiền ghi nhận giảm trừ doanh thu thuần; nguồn dữ liệu thẩm quyền là PostgreSQL `invoices`.
   - *Ranh giới chờ hướng dẫn (PENDING)*: Các trường hợp biên kế toán phức tạp (thanh toán dở dang nhiều đợt, cấn trừ công nợ đa dịch vụ, hoàn tiền sau khóa sổ) tiếp tục chờ quy chế tài chính nội bộ.
   - *Tasks bị ảnh hưởng*: `T012` (Test API thống kê BI khi DB rỗng và có dữ liệu), `T014` (API `admin_bi.py`).

8. **OQ-8: In-Flight Pricing Rules (PO / TV2)** — **PARTIALLY UNBLOCKED**:
   - *Ranh giới được phép triển khai*: Hóa đơn và chứng từ lịch sử đã phát hành giữ nguyên đơn giá lịch sử bất biến 100%; cập nhật giá dịch vụ tạo bản ghi phiên bản mới kèm mốc hiệu lực, đóng mốc bản ghi cũ, không xóa đè.
   - *Ranh giới chờ phê duyệt (PENDING)*: Quy chế giá chuyển tiếp cho y lệnh lâm sàng dở dang và lịch hẹn đặt trước có nhiều mức bảo lãnh viện phí chờ văn bản phê duyệt của PO.
   - *Tasks bị ảnh hưởng*: `T018` (Test tính bất biến của giá), `T020` (CRUD Catalog), `T021` (Pricing Service).

---

## 8. Requirements Traceability Matrix (RTM Reference)

Toàn bộ 46 Functional Requirements (FR-001 đến FR-046) đã được thiết lập chuỗi truy vết hai chiều đầy đủ trong Mục 5.9 của tài liệu đặc tả `spec.md`:
- **FR → US**: Kết nối trực tiếp 6 User Stories nghiệp vụ (US-01 đến US-06) và gói hạ tầng chung (Foundation).
- **FR → AC**: Tương ứng 35 kịch bản chấp nhận (Acceptance Scenarios) đã được Chủ dự án phê duyệt chính thức.
- **FR → Task**: Ánh xạ chính xác tới 48 công việc triển khai cụ thể (T001 đến T048 trong `tasks.md`).
- **FR → Test**: Ràng buộc chặt chẽ với các file kiểm thử tự động trên Backend (`pytest`) và Frontend (`prRegressionGuard.test.mjs`).

Rà soát Definition of Ready (DoR): 7/8 tiêu chí đã ĐẠT (PASS); DoR-5 duy trì trạng thái MỞ có kiểm soát (Pending PO Sign-off trên các quy tắc chuyển tiếp OQ-3, OQ-5, OQ-7, OQ-8). Trạng thái quy hoạch: **PLANNING BASELINE APPROVED — IMPLEMENTATION NOT YET AUTHORIZED** (DoR 7/8 tiêu chí ĐẠT [x]; DoR-5 duy trì trạng thái MỞ [ ] có kiểm soát; toàn bộ 48 tasks được phân định ranh giới READY / CONDITIONAL / BLOCKED; tuyệt đối không tự ý thực thi triển khai mã nguồn khi chưa có văn bản phê duyệt PR cụ thể từ PO).
