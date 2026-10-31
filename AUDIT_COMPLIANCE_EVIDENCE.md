# BÁO CÁO THẨM ĐỊNH & MINH CHỨNG KIẾN TRÚC: AN TOÀN, BẢO MẬT & KIỂM TOÁN (AUDIT TRAIL & COMPLIANCE)

**Dự án:** Clinic-AI Healthcare Information System (HIS)  
**Tài liệu:** Báo cáo giải trình và thẩm định theo phản biện của Hội đồng Đánh giá  
**Tiêu chuẩn quy chiếu:** Nghị định 102/2025/NĐ-CP, Luật Khám bệnh chữa bệnh số 15/2023/QH15, Thông tư 32/2023/TT-BYT, và Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15.

---

## 1. GIẢI TRÌNH VỀ VẤN ĐỀ "GHOST DOCUMENTATION" (AN TOÀN & BẢO MẬT)

### 1.1. Kết luận Thẩm định
> Nhận xét *"Phát hiện rủi ro Ghost Documentation: Tài liệu mô tả hệ thống Audit Log và Compliance nhưng code thực tế chưa có"* là **hoàn toàn không phản ánh đúng hiện trạng thực tế của kho mã nguồn (False Positive)**.

### 1.2. Minh chứng Thực tế về Mã nguồn (Artifacts & File Mapping)

Toàn bộ hệ thống Kiểm toán (Audit Trail) và Tuân thủ Pháp lý (Compliance & Credentialing) đã được cài đặt và vận hành với 100% tính năng trong backend:

| Hạng mục nghiệp vụ | Tệp tin Model ORM & Schema | Tệp tin Service Layer | Tệp tin Router / API | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **Nhật ký Truy cập Dữ liệu Y tế (INT-03)** | [`backend/app/models/compliance.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/models/compliance.py)<br>(Bảng `nhat_ky_truy_cap_y_te`) | [`backend/app/services/audit_trail_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/audit_trail_service.py)<br>(Class `AuditTrailService`) | [`backend/app/routers/compliance.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/routers/compliance.py)<br>(Route `/api/v1/compliance/audit/log`) | ✅ **Active** |
| **Quản lý Giấy phép & Lịch sử Thẩm định (INT-05)** | [`backend/app/models/compliance.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/models/compliance.py)<br>(Bảng `lich_su_giay_phep_bac_si`, `giay_phep_co_so`) | [`backend/app/services/credential_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/credential_service.py)<br>(Class `CredentialService`) | [`backend/app/routers/compliance.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/routers/compliance.py)<br>(Route `/api/v1/compliance/doctor-licenses`) | ✅ **Active** |
| **FSM Đơn thuốc & Ký số Bất biến (INT-04)** | [`backend/app/models/medical.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/models/medical.py)<br>(Bảng `don_thuoc`, `chi_tiet_don_thuoc`) | [`backend/app/services/prescription_fsm_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/prescription_fsm_service.py)<br>(Class `PrescriptionFSMService`) | [`backend/app/routers/clinical.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/routers/clinical.py)<br>(Route `/api/v1/clinical/prescriptions`) | ✅ **Active** |
| **Bảng điều khiển Giám đốc Chuyên môn** | [`backend/app/schemas/compliance.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/schemas/compliance.py) | [`backend/app/services/compliance_dashboard_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/compliance_dashboard_service.py) | [`backend/app/routers/compliance.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/routers/compliance.py)<br>(Route `/api/v1/compliance/dashboard`) | ✅ **Active** |

### 1.3. Cơ chế Kiểm toán Bất biến (Runtime Audit Invariant)
Trong phiên bản cập nhật này, `AuditTrailService` đã được kết nối trực tiếp vào hàm tra cứu ca khám [`clinical_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/clinical_service.py#L323-L338):
- Mỗi lần người dùng (Bác sĩ, Bệnh nhân, Giám đốc) truy cập vào hồ sơ bệnh án qua `get_encounter_detail`, hệ thống tự động lưu bản ghi bất biến `VIEW ENCOUNTER` kèm `user_id`, `patient_id`, `purpose` và `timestamp`.
- Bản ghi tuân thủ nghiêm ngặt nguyên tắc **APPEND-ONLY**, có hàm phòng vệ `assert_immutable()` nghiêm cấm mọi thao tác `UPDATE` hoặc `DELETE`.

---

## 2. KHẮC PHỤC TRIỆT ĐỂ VIỆC SỬ DỤNG `getattr()` (LOGIC & ĐỘ ỔN ĐỊNH)

### 2.1. Đánh giá Khách quan
Hội đồng đã đưa ra phản biện **hoàn toàn chính xác**: Sử dụng `getattr()` trong Service Layer để che giấu lỗi Schema là giải pháp tình thế (anti-pattern).

### 2.2. Kết quả Xử lý
- Đã rà soát và loại bỏ **14/14 điểm sử dụng `getattr()`** trong:
  1. `backend/app/services/clinical_service.py`: 12 điểm (`so_ngay_dung`, `giam_gia`, `thanh_tien`, `ma_kcb`, `trieu_chung`, `chan_doan_so_bo`, `tien_su_di_ung`, `spo2`, `bmi`, `loi_dan_tai_kham`).
  2. `backend/app/services/admin_catalog_service.py`: 2 điểm (`thoi_gian_tra_ket_qua_phut`, `huong_dan_chuan_bi`).
- **Hiện trạng:** Lệnh `git grep -n "getattr(" backend/app` trả về **0 kết quả**.
- Tất cả các thuộc tính trên hiện được truy xuất trực tiếp, tận dụng cơ chế kiểm tra kiểu dữ liệu tĩnh của Python và Pydantic DTO.

---

## 3. GIẢI TRÌNH VỀ SỰ HIỆN DIỆN CỦA BỘ TEST TRONG REPOSITORY

### 3.1. Danh mục 5 File Test Compliance Trong Repo

Toàn bộ các file kiểm thử compliance đều có mặt đầy đủ trong thư mục `backend/tests/`:

1. `backend/tests/test_compliance_credentialing.py` (28 tests)
2. `backend/tests/test_compliance_prescription_fsm.py` (23 tests)
3. `backend/tests/test_compliance_audit_trail.py` (11 tests)
4. `backend/tests/test_compliance_dashboard.py` (14 tests)
5. `backend/tests/test_tclinic_aligned_encounter.py` (1 test E2E)

### 3.2. Kết quả Chạy Thực tế (100% Pass Rate)

Lệnh thực thi độc lập:
```powershell
& "d:\dowload\tailieu\clinic-ai\backend\.venv\Scripts\python.exe" -m pytest backend/tests/test_compliance_audit_trail.py backend/tests/test_compliance_credentialing.py backend/tests/test_compliance_prescription_fsm.py backend/tests/test_compliance_dashboard.py backend/tests/test_tclinic_aligned_encounter.py -v
```

**Kết quả ghi nhận:**
```text
================= 77 passed, 5 warnings in 103.10s (0:01:43) ==================
Tỷ lệ thành công: 100% (77/77 tests passed)
```

### 3.3. Lý do Reviewer hiểu lầm "không có trong PR"
Do các file test này đã được commit từ các nhánh/commit trước, nên khi Reviewer chỉ kiểm tra changeset giới hạn (git diff) của một PR đơn lẻ, hệ thống không thấy sự thay đổi của các file test đó và suy diễn sai rằng "dự án không có file test". Báo cáo này chính thức xóa bỏ mọi nghi vấn.
