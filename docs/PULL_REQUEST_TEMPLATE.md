# PULL REQUEST: [ARCH-REFACTOR] Hoàn thiện CSDL 45 Bảng, Bóc Tách Service Layer (SRP), Minh Chứng Kiểm Thử & Hướng Dẫn Phối Hợp Nhóm

## 1. BỐI CẢNH & MỤC TIÊU (WHY & WHAT)
Hệ thống **Clinic-AI** mở rộng từ phân hệ Quản trị (Admin HIS - 17 module) sang hỗ trợ đầy đủ **3 phân hệ tiếp theo**:
- **Lễ tân (Receptionist Portal)**: Điều phối hàng đợi sảnh chờ, tiếp đón vãng lai, đo chỉ số sinh hiệu sơ bộ.
- **Bác sĩ (Doctor Clinic & Orders)**: Bàn làm việc bác sĩ, chẩn đoán ICD-10, hoàn tất & khóa bệnh án theo Thông tư 32/2023/TT-BYT, y lệnh cận lâm sàng (CLS) và kê đơn thuốc ngoại trú.
- **Khách hàng (Patient Portal)**: Đăng ký & đăng nhập bằng Email, đặt lịch hẹn online slot 30 phút, quản lý hồ sơ người thân, sổ khám bệnh điện tử EMR, đánh giá chất lượng dịch vụ.

PR này cung cấp **nền tảng Cơ sở Dữ liệu 45 bảng hoàn chỉnh**, tái cấu trúc **Clean Architecture (Single Responsibility Principle)** cho Service Layer, cùng bộ **minh chứng kiểm thử tự động (15/15 tests passed)** và tài liệu hướng dẫn nhóm.

---

## 2. GIẢI TRÌNH KIẾN TRÚC KHO CHỨA (MONOREPO ARCHITECTURE RATIONALE)
Dự án áp dụng mô hình **Modular Monorepo** có chủ đích:
- Thư mục gốc `src/` hiện tại là **Phân hệ Quản trị HIS Nội bộ (Back-office Admin & Doctor HIS)** phục vụ vận hành phòng khám.
- Nhánh `fe-main` là nhánh phát triển chuyên biệt cho **Cổng Khách hàng / Bệnh nhân Ngoại trú (Patient Portal)**.
- Thư mục `backend/` cung cấp hệ thống API dùng chung (Shared Core API) cho toàn bộ các cổng giao tiếp, phân quyền qua JWT RBAC (`ADMIN`, `DOCTOR`, `RECEPTIONIST`, `PATIENT`).

---

## 3. TÁI CẤU TRÚC SERVICE LAYER (CHỐNG GOD OBJECT THEO CHUẨN SRP)
Để triệt tiêu lỗi thiết kế God Object (`admin_service.py` 2.196 dòng code), hệ thống đã được phân rã thành **5 Service chuyên trách** theo Bounded Context:

```
backend/app/services/
├── admin_doctor_service.py      # Bác sĩ & Danh bạ Bệnh nhân (425 dòng)
├── admin_department_service.py  # Khoa phòng, Buồng khám vật lý & Thiết bị y tế (175 dòng)
├── admin_shift_service.py       # Phân ca trực, Roster tuần & Quản lý vắng mặt (970 dòng)
├── admin_catalog_service.py     # Danh mục Kỹ thuật, Khái niệm AI OpenMRS (410 dòng)
├── admin_analytics_service.py   # Dashboard KPIs, Doanh thu & Duyệt đính chính (200 dòng)
└── admin_service.py             # Facade Coordinator (Kế thừa 5 service, bảo toàn 100% backward compatibility)
```
- **Lợi ích**: Code module hóa rõ ràng, dễ bảo trì, dễ viết test độc lập, không vi phạm nguyên tắc Single Responsibility.
- **An toàn**: Toàn bộ Routers (`routers/admin.py`) và test suites không bị gãy hoặc phải sửa đổi code gọi hàm.

---

## 4. CHI TIẾT CSDL 45 BẢNG (ALEMBIC MIGRATIONS 001 -> 005)
Chuỗi Migration Alembic tuân thủ nghiêm ngặt mô hình DAG liên tục:
- `001_initial_schema.py`: 28 bảng nền tảng người dùng, khám chữa bệnh, lịch hẹn, AI.
- `002_add_refresh_token_to_tai_khoan.py`: Bổ sung cơ chế Refresh Token cho xác thực JWT.
- `003_compliance_layer.py`: Bảng tuân thủ y tế, giấy phép cơ sở, nhật ký truy cập y tế.
- `004_tclinic_extensions.py`: Bảng phiếu thu chi, khóa sổ ca trực, buồng khám vật lý.
- `005_master_clinic_data_architecture.py`: Bổ sung hợp đồng khám đoàn B2B, gói dịch vụ, liệu trình, hồ sơ người thân, thông báo, đánh giá dịch vụ.

**Ràng buộc cốt lõi:**
- **Định danh bằng Email**: Bảng `tai_khoan.email` là duy nhất (`UNIQUE, NOT NULL`), đăng ký & đăng nhập qua Email.
- **Không quản lý kho dược**: Nghiêm cấm quản lý tồn kho theo lô/hạn (`inventoryBatches = []`), chỉ lưu danh mục thuốc tham chiếu kê đơn ngoại trú.

---

## 5. BẢNG BẰNG CHỨNG KIỂM THỬ TỰ ĐỘNG (TEST EVIDENCE MATRIX)

Lệnh thực thi kiểm thử:
```powershell
& "backend/.venv/Scripts/python.exe" -m pytest tests/test_frontend_backend_integration.py tests/test_multirole_expansion.py tests/test_admin_doctor_management.py tests/test_alembic_migrations.py -v
```

### Kết quả: 15/15 PASSED (100% Success Rate)

| STT | Tên Test Case | File Kiểm Thử | Trạng Thái | Mô Tả Nghiệp Vụ Kiểm Chứng |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `test_frontend_login_contract_and_default_accounts` | `test_frontend_backend_integration.py` | **PASSED** | Đăng nhập Admin, Bác sĩ, tài khoản mặc định FE |
| 2 | `test_frontend_refresh_token_and_demo_token_support` | `test_frontend_backend_integration.py` | **PASSED** | Cấp lại Access Token, xử lý phiên hết hạn |
| 3 | `test_admin_bootstrap_and_no_drug_inventory` | `test_frontend_backend_integration.py` | **PASSED** | Khởi tạo cấu hình Admin & không có kho thuốc tồn |
| 4 | `test_admin_collection_and_catalog_sync_persistence` | `test_frontend_backend_integration.py` | **PASSED** | Đồng bộ và lưu trữ danh mục phòng khám |
| 5 | `test_frontend_ai_triage_analyze_contract` | `test_frontend_backend_integration.py` | **PASSED** | Hợp đồng phân loại triệu chứng AI Triage |
| 6 | `test_all_17_admin_modules_and_relational_db_sync` | `test_frontend_backend_integration.py` | **PASSED** | 17 module Admin HIS đồng bộ CSDL quan hệ |
| 7 | `test_patient_registration_and_auth_flow` | `test_multirole_expansion.py` | **PASSED** | Đăng ký tài khoản Bệnh nhân qua Email & Đăng nhập |
| 8 | `test_patient_profile_and_family_members` | `test_multirole_expansion.py` | **PASSED** | Quản lý hồ sơ cá nhân và hồ sơ người thân (con/bố mẹ) |
| 9 | `test_notifications_lifecycle` | `test_multirole_expansion.py` | **PASSED** | Vòng đời thông báo nhắc lịch, đếm số chưa đọc |
| 10 | `test_patient_medical_records_and_feedback` | `test_multirole_expansion.py` | **PASSED** | Tra cứu EMR cá nhân & Đánh giá dịch vụ 5 sao |
| 11 | `test_create_doctor_with_assigned_physical_room` | `test_admin_doctor_management.py` | **PASSED** | Tạo bác sĩ và gắn buồng khám vật lý |
| 12 | `test_update_doctor_profile_and_room` | `test_admin_doctor_management.py` | **PASSED** | Cập nhật hồ sơ chuyên môn và đổi buồng khám |
| 13 | `test_get_doctors_includes_physical_room` | `test_admin_doctor_management.py` | **PASSED** | Danh sách bác sĩ hiển thị đúng buồng khám |
| 14 | `test_alembic_migration_chain_integrity` | `test_alembic_migrations.py` | **PASSED** | Chuỗi migration 001->005 liên tục, DAG hợp lệ |
| 15 | `test_full_45_tables_schema_metadata_integrity` | `test_alembic_migrations.py` | **PASSED** | Đủ 45 bảng trong Base.metadata, có khóa chính PK |

---

## 6. HƯỚNG DẪN TRIỂN KHAI CHO CÁC THÀNH VIÊN (DEPLOYMENT / ROLLOUT GUIDE)
Sau khi Pull Request này được merge vào nhánh `develop`:

1. **Kéo code mới nhất**:
   ```powershell
   git checkout <nhanh_cua_ban>
   git pull origin develop
   ```

2. **Khởi tạo CSDL 45 bảng**:
   ```powershell
   cd backend
   .venv\Scripts\activate
   python scripts/create_tables.py
   ```

3. **Chạy kiểm thử xác minh môi trường local**:
   ```powershell
   python -m pytest tests/test_alembic_migrations.py tests/test_multirole_expansion.py -v
   ```

4. **Đọc tài liệu phân công WBS chi tiết**:
   Xem tại `docs/TEAM_COLLABORATION_GUIDE.md`.
