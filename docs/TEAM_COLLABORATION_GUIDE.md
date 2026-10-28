# HƯỚNG DẪN KIẾN TRÚC & PHỐI HỢP PHÁT TRIỂN DỰ ÁN CLINIC-AI
**Dành cho 4 Thành viên xây dựng 3 Phân hệ: Lễ tân, Bác sĩ và Khách hàng (Bệnh nhân)**
*Tài liệu chuẩn hóa bởi Lead Architect & Project Manager*

---

## 1. TỔNG QUAN DỰ ÁN & PHẠM VI HỆ THỐNG

Dự án **Clinic-AI** là nền tảng quản lý phòng khám ngoại trú thông minh, tích hợp trợ lý AI lâm sàng.
Hệ thống hiện tại đã hoàn thiện toàn bộ phân hệ **Quản trị (Admin HIS - 17 module)** và khung kiến trúc cốt lõi. CSDL hiện đã đạt **45 bảng** bao phủ đầy đủ toàn bộ nghiệp vụ phòng khám.

### 4 RÀNG BUỘC KIẾN TRÚC BẮT BUỘC (CRITICAL CONSTRAINTS)
1. **Định danh tài khoản bằng Email**: Tất cả các tài khoản người dùng (Admin, Bác sĩ, Lễ tân, Bệnh nhân) đều sử dụng **Email** làm khóa định danh duy nhất (Primary Identity) khi đăng ký và đăng nhập (`TaiKhoan.email` là duy nhất). Số điện thoại là thông tin liên lạc bổ trợ.
2. **KHÔNG quản lý kho dược / nhập xuất tồn thuốc**: Hệ thống không tính tồn kho theo lô/hạn dùng (`inventoryBatches = []`), chỉ lưu danh mục thuốc tham chiếu để bác sĩ kê đơn ngoại trú theo Thông tư BYT.
3. **KHÔNG thanh toán BHYT**: Mô hình phòng khám tư nhân thu phí dịch vụ trực tiếp, không tích hợp cổng giám định BHYT.
4. **Chuẩn hóa API Envelope**: Mọi API trả về đều phải bọc qua `ResponseEnvelope[T]`.

---

## 2. PHÂN CÔNG CÔNG VIỆC (WBS) CHO 4 THÀNH VIÊN

Hệ thống được chia thành 4 gói module Fullstack (từ Giao diện React đến Backend FastAPI/Database):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLINIC-AI PLATFORM ARCHITECTURE                 │
├────────────────────┬────────────────────┬──────────────────────────────┤
│  THÀNH VIÊN 1      │  THÀNH VIÊN 2 & 3  │  THÀNH VIÊN 4                │
│  Phân hệ Lễ tân    │  Phân hệ Bác sĩ    │  Phân hệ Khách hàng / BN     │
│  (Receptionist)    │  (Doctor Clinic)   │  (Patient Portal)            │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

### THÀNH VIÊN 1: PHÂN HỆ LỄ TÂN (RECEPTIONIST PORTAL)
- **Mục tiêu**: Điều phối dòng bệnh nhân tại sảnh chờ, tiếp đón, đăng ký khám vãng lai và thu ngân ban đầu.
- **Frontend Pages/Components**:
  - `ReceptionQueuePage.jsx`: Bảng điều phối hàng đợi thông minh (Phân loại: Đúng hẹn, Đến sớm, Đến muộn, Vãng lai, Trả kết quả CLS).
  - `WalkInCheckinModal.jsx`: Tiếp nhận bệnh nhân tại quầy, tra cứu hồ sơ cũ qua Email/SĐT/CCCD hoặc tạo bệnh nhân mới.
  - `VitalsTriageModal.jsx`: Nhập chỉ số sinh hiệu sơ bộ (Mạch, Nhiệt độ, Huyết áp, Chiều cao, Cân nặng).
- **Backend API Endpoints**:
  - `GET /api/v1/reception/queue` - Lấy danh sách hàng đợi theo ca trực.
  - `POST /api/v1/reception/check-in` - Tiếp nhận bệnh nhân và cấp số thứ tự (STT).
  - `POST /api/v1/reception/walk-in` - Tạo lượt khám vãng lai tại quầy.
  - `PUT /api/v1/reception/queue/{id}/call` - Gọi số vào phòng khám.
- **Bảng CSDL liên quan**: `danh_sach_cho`, `lich_kham`, `benh_nhan`, `nguoi_dung`, `phong_kham`.

---

### THÀNH VIÊN 2: PHÂN HỆ BÁC SĨ - LÂM SÀNG & BỆNH ÁN (DOCTOR EMR)
- **Mục tiêu**: Bàn làm việc bác sĩ, gọi bệnh nhân, khám lâm sàng, chẩn đoán ICD-10 và hoàn tất/khóa bệnh án theo Thông tư 32/2023/TT-BYT.
- **Frontend Pages/Components**:
  - `DoctorWorkstationPage.jsx`: Giao diện khám bệnh chính (thông tin bệnh nhân, hàng đợi phòng khám, nút "Gọi tiếp theo", "Tạm hoãn").
  - `ClinicalDiagnosisCard.jsx`: Nhập bệnh sử, khám cơ quan, tra cứu gợi ý mã bệnh ICD-10 (`KhaiNiem` catalog).
  - `EmrLockModal.jsx`: Xem tổng kết bệnh án, ký xác nhận và khóa bệnh án chống sửa đổi hồi tố.
- **Backend API Endpoints**:
  - `GET /api/v1/clinical/encounters/current` - Lấy lượt khám hiện tại của bác sĩ.
  - `POST /api/v1/clinical/encounters` - Bắt đầu phiên khám lâm sàng (`LuotKham`).
  - `POST /api/v1/clinical/encounters/{id}/diagnoses` - Ghi nhận chẩn đoán chính/phụ (ICD-10).
  - `POST /api/v1/clinical/encounters/{id}/complete` - Khóa hồ sơ bệnh án theo Thông tư 32 BYT.
- **Bảng CSDL liên quan**: `luot_kham`, `chan_doan`, `khai_niem`, `bien_ban_dinh_chinh`, `luot_kham_the_luc`.

---

### THÀNH VIÊN 3: PHÂN HỆ BÁC SĨ - CHỈ ĐỊNH CẬN LÂM SÀNG & KÊ ĐƠN THUỐC
- **Mục tiêu**: Y lệnh xét nghiệm/chẩn đoán hình ảnh, xem kết quả CLS và kê đơn thuốc ngoại trú an toàn.
- **Frontend Pages/Components**:
  - `SubclinicalOrderPanel.jsx`: Chọn dịch vụ CLS (Xét nghiệm máu, Siêu âm, X-Quang, ECG), in phiếu chỉ định.
  - `LabResultsViewer.jsx`: Xem chỉ số kết quả xét nghiệm, file ảnh X-Quang/siêu âm đính kèm.
  - `PrescriptionForm.jsx`: Kê đơn thuốc ngoại trú, tự động cảnh báo tương tác thuốc và dị ứng qua AI.
- **Backend API Endpoints**:
  - `POST /api/v1/clinical/encounters/{id}/orders` - Tạo y lệnh chỉ định CLS.
  - `GET /api/v1/clinical/encounters/{id}/orders` - Tra cứu danh sách và kết quả CLS.
  - `POST /api/v1/clinical/prescriptions` - Tạo đơn thuốc mới (FSM: DRAFT -> SUBMITTED -> DISPENSED).
  - `POST /api/v1/clinical/prescriptions/{id}/supersede` - Sửa đơn thuốc (tạo bản mới, hủy bản cũ có lưu vết audit).
- **Bảng CSDL liên quan**: `chi_dinh`, `ket_qua_cls`, `don_thuoc`, `chi_tiet_don_thuoc`, `danh_muc_thuoc`, `dich_vu_cls`.

---

### THÀNH VIÊN 4: PHÂN HỆ KHÁCH HÀNG / BỆNH NHÂN (PATIENT PORTAL)
- **Mục tiêu**: Cổng thông tin người bệnh - Đăng ký/đăng nhập bằng Email, đặt lịch hẹn online slot 30 phút, quản lý hồ sơ người thân, sổ sức khỏe điện tử và gửi đánh giá dịch vụ.
- **Frontend Pages/Components**:
  - `PatientRegisterPage.jsx` & `PatientLoginPage.jsx`: Đăng ký bằng Email + mật khẩu, xem thông tin cá nhân.
  - `OnlineBookingWizard.jsx`: Đặt lịch khám theo chuyên khoa/bác sĩ, chọn khung giờ 30 phút, mô tả triệu chứng (AI Triage sơ bộ).
  - `FamilyProfilesManager.jsx`: Thêm hồ sơ người thân (con nhỏ, bố mẹ) để đặt lịch hộ.
  - `MyHealthRecordsPage.jsx`: Tra cứu lịch sử khám bệnh (EMR timeline), xem đơn thuốc và lời dặn.
  - `ServiceFeedbackModal.jsx`: Đánh giá 1-5 sao chất lượng bác sĩ và phòng khám sau buổi khám.
- **Backend API Endpoints**:
  - `POST /api/v1/auth/register-patient` - Đăng ký tài khoản bệnh nhân nhanh bằng Email.
  - `GET /api/v1/patient/profile` & `PUT /api/v1/patient/profile` - Xem/sửa hồ sơ cá nhân.
  - `GET /api/v1/patient/family-members` & `POST /api/v1/patient/family-members` - Quản lý hồ sơ người thân.
  - `GET /api/v1/patient/medical-records` - Tra cứu sổ khám bệnh điện tử cá nhân.
  - `POST /api/v1/patient/feedback` - Gửi đánh giá dịch vụ và khảo sát hài lòng.
  - `GET /api/v1/notifications` - Xem thông báo nhắc lịch và trạng thái gọi số.
- **Bảng CSDL liên quan**: `tai_khoan`, `nguoi_dung`, `benh_nhan`, `ho_so_nguoi_than`, `thong_bao`, `danh_gia_dich_vu`, `lich_kham`.

---

## 3. QUY CHUẨN LẬP TRÌNH BACKEND (FASTAPI / SQLALCHEMY)

### CẤU TRÚC THƯ MỤC CHUẨN
```
backend/app/
├── models/             # SQLAlchemy ORM Models (45 bảng CSDL)
├── schemas/            # Pydantic Schemas (Request/Response DTO)
├── services/           # Business Logic Layer (Không gọi trực tiếp DB từ Router)
├── routers/            # API Endpoints & Request Handling
├── core/
│   ├── database.py     # Database engine & async session
│   ├── dependencies.py # get_current_user, require_roles
│   ├── response.py     # ResponseEnvelope[T] chuẩn
│   ├── security.py     # BCrypt hashing & JWT issuance
│   └── exceptions.py   # Custom Business Exceptions (Conflict, NotFound, ...)
```

### QUY TẮC RESPONSE CHUẨN HÓA (RESPONSE ENVELOPE)
Mọi API trả về bắt buộc sử dụng `ResponseEnvelope`:
```python
from app.core.response import ResponseEnvelope

@router.get("/my-endpoint", response_model=ResponseEnvelope[MyDataSchema])
async def my_endpoint(db: AsyncSession = Depends(get_db)):
    result = await my_service.get_data(db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Thực hiện thành công!"
    )
```

JSON trả về cho Frontend luôn có cấu trúc:
```json
{
  "code": 200,
  "success": true,
  "message": "Thực hiện thành công!",
  "data": { ... },
  "timestamp": "2026-10-13T16:25:00.000Z"
}
```

### PHÂN QUYỀN (RBAC DEPENDENCIES)
Bảo vệ router bằng `require_roles`:
```python
from app.core.dependencies import get_current_user, require_roles

# Chỉ bác sĩ mới được gọi
@router.post("/clinical/diagnoses")
async def save_diagnosis(
    current_user: TaiKhoan = Depends(require_roles(["bac_si", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    ...
```

---

## 4. QUY CHUẨN LẬP TRÌNH FRONTEND (REACT / VITE)

### TÍCH HỢP HTTP CLIENT (BaseService.js)
Gọi API backend thông qua instance Axios chung:
```javascript
import api from '../services/BaseService';

// Gọi API có tự động đính kèm Bearer JWT và xử lý Refresh Token khi 401
export const getMyHealthRecords = async () => {
  const response = await api.get('/api/v1/patient/medical-records');
  return response.data.data; // Lấy mảng dữ liệu bên trong envelope
};
```

### QUẢN LÝ TRẠNG THÁI (REDUX SLICE)
- Auth State nằm tại `src/redux/authSlice.js` lưu trữ: `token`, `refreshToken`, `role`, `user`.
- Sau khi đăng nhập, `role` sẽ nhận một trong 4 giá trị: `ADMIN`, `DOCTOR`, `RECEPTIONIST`, `PATIENT`.

---

## 5. HƯỚNG DẪN KHỞI CHẠY VÀ KIỂM THỬ DỰ ÁN

### 1. Khởi chạy Backend (Port 8000)
```powershell
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Swagger API Docs: `http://localhost:8000/docs`

### 2. Khởi chạy Frontend (Port 3000)
```powershell
npm run dev -- --host 0.0.0.0 --port 3000
```
- Web UI: `http://localhost:3000`

### 3. Chạy Automated Tests (10/10 Tests Passed)
```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_frontend_backend_integration.py tests/test_multirole_expansion.py -v
```

---

## 6. DANH SÁCH 45 BẢNG CƠ SỞ DỮ LIỆU ĐÃ SẴN SÀNG
Toàn bộ 45 bảng đã được định nghĩa trong SQLAlchemy models và sẵn sàng trong SQLite / PostgreSQL:
1. **Người dùng & Phân quyền**: `nguoi_dung`, `tai_khoan`, `vai_tro`, `tai_khoan_vai_tro`, `bac_si`, `benh_nhan`, `ho_so_nguoi_than` *(Mới)*.
2. **Cơ cấu tổ chức**: `khoa_phong`, `phong_kham`, `chuyen_khoa`, `thiet_bi_y_te`.
3. **Lịch làm việc & Đặt hẹn**: `lich_lam_viec`, `lich_kham`, `danh_sach_cho`, `hang_doi_lich_kham`, `lich_nghi_phep`, `phan_tich_ai`.
4. **Hồ sơ bệnh án & Khám chữa bệnh**: `luot_kham`, `chan_doan`, `luot_kham_the_luc`, `bien_ban_dinh_chinh`, `danh_gia_dich_vu` *(Mới)*.
5. **Cận lâm sàng & Chẩn đoán hình ảnh**: `dich_vu_cls`, `nhom_dich_vu_cls`, `chi_dinh`, `ket_qua_cls`, `chi_tiet_ket_qua_cls`.
6. **Thuốc & Đơn thuốc ngoại trú**: `danh_muc_thuoc`, `nhom_thuoc`, `don_thuoc`, `chi_tiet_don_thuoc`, `tuong_tac_thuoc`.
7. **Thu ngân & Hóa đơn**: `hoa_don`, `chi_tiet_hoa_don`, `thanh_toan`, `khoa_so_ca_truc`.
8. **Danh mục y tế & Kiến thức AI**: `khai_niem`, `ten_khai_niem`, `anh_xa_khai_niem`, `nguon_tham_chieu`, `thuoc_tinh_khai_niem`, `thong_bao` *(Mới)*.
9. **Kiểm toán & Tuân thủ**: `nhat_ky_kiem_toan`.
