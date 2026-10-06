# QUY CHUẨN CODE & THIẾT KẾ HỆ THỐNG (PROJECT CODING STANDARDS)
## Dự án: Website Quản lý & Đặt Lịch Phòng Khám Trực Tuyến Tích Hợp AI
**Học phần:** Project 1 (IT1.241.3) - ĐH Giao Thông Vận Tải  
**Đối tượng áp dụng:** Toàn bộ thành viên Nhóm 2 (Hợp, Tùng, An, Trọng, Hoàng)  
**Công nghệ áp dụng:** FastAPI, PostgreSQL 15, SQLAlchemy 2.0 (Async), Pydantic v2, Next.js, Docker  

---

## MỤC LỤC
1. [Triết lý thiết kế & Kiến trúc BCE](#1-triết-lý-thiết-kế--kiến-trúc-bce)
2. [Quy tắc đặt tên (Naming Conventions)](#2-quy-tắc-đặt-tên-naming-conventions)
3. [Quy chuẩn thiết kế RESTful API & Response Envelope](#3-quy-chuẩn-thiết-kế-restful-api--response-envelope)
4. [Quy cách viết Code Backend (Python / FastAPI)](#4-quy-cách-viết-code-backend-python--fastapi)
5. [Quy tắc xử lý Database & Concurrency Control (PostgreSQL)](#5-quy-tắc-xử-lý-database--concurrency-control-postgresql)
6. [Quy tắc an toàn Y tế & Module AI (Clinical Safety Guard)](#6-quy-tắc-an-toàn-y-tế--module-ai-clinical-safety-guard)
7. [Quy trình Git Flow & Code Review](#7-quy-trình-git-flow--code-review)

---

## 1. TRIẾT LÝ THIẾT KẾ & KIẾN TRÚC BCE

Hệ thống tuân thủ mô hình **BCE (Boundary - Control - Entity)** theo đúng bản vẽ thiết kế đã được duyệt với thầy hướng dẫn:

```
[ Client (Next.js/Postman) ]
            │ (HTTP REST JSON)
            ▼
┌────────────────────────────────────────────────────────┐
│ 1. BOUNDARY LAYER (Routers / Presentation)             │
│    - Thư mục: app/routers/                             │
│    - Nhiệm vụ: Tiếp nhận request, xác thực HTTP params,│
│      inject dependencies, gọi Controller/Service.      │
│    - KHÔNG chứa logic tính toán, KHÔNG gọi trực tiếp DB│
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. CONTROL LAYER (Services / Business Logic)           │
│    - Thư mục: app/services/ (hoặc controllers/)        │
│    - Nhiệm vụ: Thực thi logic nghiệp vụ, tính toán slot,│
│      quét Red Flags, xác thực BCrypt, gọi AI, quản lý  │
│      transaction DB (commit/rollback).                 │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. ENTITY LAYER (Data Models & Schemas)                │
│    - Thư mục: app/models/ (SQLAlchemy) & app/schemas/  │
│    - Nhiệm vụ: Định nghĩa bảng PostgreSQL, quan hệ     │
│      (1-N, N-N), ràng buộc (FK, Unique, Enum) và       │
│      Pydantic schema validate dữ liệu I/O.             │
└────────────────────────────────────────────────────────┘
```

### Nguyên tắc bất di bất dịch (Zero-Tolerance Rules):
1. **Không truy vấn CSDL trong file Router**: Mọi câu lệnh `select`, `insert`, `update` đều phải nằm trong tầng Service/Repository. Router chỉ nhận DTO (Pydantic), chuyển qua Service và trả về ResponseEnvelope.
2. **Không để lộ Exception hệ thống**: Tuyệt đối không để xảy ra màn hình traceback 500 màu mè của Starlette/Uvicorn trên môi trường production. Mọi lỗi đều phải qua Custom Exception Handler chuẩn hóa JSON.
3. **Mọi thay đổi CSDL phải qua Alembic**: Nghiêm cấm chạy câu lệnh `ALTER TABLE` trực tiếp bằng tay trên PostgreSQL mà không có file migration script tương ứng.

---

## 2. QUY TẮC ĐẶT TÊN (NAMING CONVENTIONS)

### 2.1. Cơ sở dữ liệu (PostgreSQL)
* **Tên bảng:** Viết thường `snake_case`, dạng **số ít** (theo mô hình thực thể OpenMRS):  
  * ✅ Đúng: `tai_khoan`, `benh_nhan`, `bac_si`, `lich_kham`, `luot_kham`, `chan_doan`
  * ❌ Sai: `TaiKhoans`, `tbl_patient`, `tblLichKham`
* **Tên cột:** Viết thường `snake_case`:  
  * ✅ Đúng: `id`, `email`, `mat_khau_hash`, `ngay_sinh`, `chuyen_khoa_id`
  * Khóa chính luôn đặt là `id` (sử dụng kiểu `Integer` tự tăng hoặc `UUID`).
  * Khóa ngoại luôn có đuôi `_id`: `bac_si_id`, `chuyen_khoa_id`, `benh_nhan_id`.
  * Cột boolean dùng tiền tố `is_` hoặc `has_`: `is_active`, `is_locked`, `has_emergency`.
  * Cột thời gian dùng đuôi `_at`: `created_at`, `updated_at`, `deleted_at`, `expired_at`.

### 2.2. Mã nguồn Python (Backend)
* **Tên biến & hàm:** `snake_case`:
  * `def tinh_toan_slot_trong():`
  * `def kiem_tra_red_flags():`
  * `current_user_id = 123`
* **Tên Class (Model, Schema, Service, Exception):** `PascalCase`:
  * `class TaiKhoan(Base):`
  * `class AppointmentService:`
  * `class SymptomTriageRequest(BaseModel):`
  * `class BusinessException(Exception):`
* **Hằng số & Enum:** `UPPER_SNAKE_CASE`:
  * `DEFAULT_SLOT_DURATION_MINUTES = 30`
  * `JWT_ALGORITHM = "HS256"`
  * `class VaiTroEnum(str, Enum): BENH_NHAN = "benh_nhan"`
* **Tên file & thư mục:** `snake_case`:
  * `appointment_service.py`, `auth_router.py`, `nlp_preprocessor.py`

### 2.3. Quy ước API Endpoints (URL Routes)
* Định dạng: Dùng chữ thường, nối bằng dấu gạch ngang (`kebab-case`), danh từ số nhiều:
  * ✅ Đúng: `GET /api/v1/appointments`
  * ✅ Đúng: `POST /api/v1/appointments`
  * ✅ Đúng: `GET /api/v1/doctors/{doctor_id}/slots`
  * ✅ Đúng: `POST /api/v1/ai/analyze-symptoms`
  * ❌ Sai: `GET /api/getAppointments`, `POST /api/create_new_appointment` (Không đặt động từ vào path)
* Phiên bản API: Bắt buộc có tiền tố `/api/v1/` để dễ nâng cấp về sau.

---

## 3. QUY CHUẨN THIẾT KẾ RESTFUL API & RESPONSE ENVELOPE

Mọi endpoint trả về **BẮT BUỘC** phải tuân theo cấu trúc bao bọc chuẩn (Response Envelope Pattern):

### 3.1. Cấu trúc Response Thành công (HTTP 200, 201)
```json
{
  "success": true,
  "code": 200,
  "message": "Đặt lịch hẹn khám thành công",
  "data": {
    "appointment_id": 105,
    "ma_lich_kham": "LK-20260920-001",
    "ngay_kham": "2026-09-25",
    "gio_kham": "08:30:00",
    "bac_si": {
      "id": 4,
      "ho_ten": "BS. Nguyễn Văn A",
      "chuyen_khoa": "Tim mạch"
    },
    "trang_thai": "cho_xac_nhan"
  },
  "meta": null
}
```

### 3.2. Cấu trúc Response Phân trang (Pagination)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách lịch hẹn thành công",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "page_size": 10,
    "total_items": 45,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

### 3.3. Cấu trúc Response Lỗi (HTTP 4xx, 5xx)
```json
{
  "success": false,
  "code": 409,
  "message": "Khung giờ 08:30:00 ngày 2026-09-25 đã được bệnh nhân khác đặt trước.",
  "data": null,
  "errors": [
    {
      "field": "gio_kham",
      "detail": "Slot conflict detected with existing appointment"
    }
  ]
}
```

---

## 4. QUY CÁCH VIẾT CODE BACKEND (PYTHON / FASTAPI)

### 4.1. Bắt buộc Type Hinting (PEP 484)
Mọi hàm, phương thức đều phải có type hint đầy đủ cho tham số đầu vào và kiểu dữ liệu trả về:
```python
async def calculate_available_slots(
    doctor_id: int, 
    booking_date: date, 
    session: AsyncSession
) -> list[SlotResponse]:
    ...
```

### 4.2. Pydantic Schemas: Tách bạch Request và Response
* `AppointmentCreateRequest`: Chứa các trường bệnh nhân nhập (doctor_id, date, time, notes).
* `AppointmentUpdateRequest`: Chứa các trường được phép sửa (time, cancel_reason).
* `AppointmentResponse`: Chứa đầy đủ ID, mã hẹn, quan hệ Bác sĩ, trạng thái, thời gian tạo.

---

## 5. QUY TẮC XỬ LÝ DATABASE & CONCURRENCY CONTROL (POSTGRESQL)

### 5.1. Cơ chế khóa dòng (Pessimistic Locking với `SELECT ... FOR UPDATE`)
```python
stmt = (
    select(LichKham)
    .where(
        LichKham.bac_si_id == payload.bac_si_id,
        LichKham.ngay_kham == payload.ngay_kham,
        LichKham.gio_kham == payload.gio_kham,
        LichKham.trang_thai != TrangThaiLichEnum.DA_HUY
    )
    .with_for_update()  # Khóa dòng trên PostgreSQL
)
existing = (await db.execute(stmt)).scalar_one_or_none()
if existing:
    raise ConflictException("Khung giờ này vừa có người đặt. Vui lòng chọn khung giờ khác!")
```

### 5.2. Ràng buộc toàn vẹn dữ liệu cấp Database (Unique Partial Index)
```sql
CREATE UNIQUE INDEX uq_active_doctor_slot 
ON lich_kham (bac_si_id, ngay_kham, gio_kham) 
WHERE trang_thai NOT IN ('da_huy', 'tu_dong_huy');
```

---

## 6. QUY TẮC AN TOÀN Y TẾ & MODULE AI (CLINICAL SAFETY GUARD)

1. **Bộ lọc Red Flags chạy ĐỘC LẬP & ƯU TIÊN TRƯỚC HẾT:**
   * Đối soát danh từ khóa cấp cứu trong CSDL (`tu_khoa_cap_cuu`).
   * Nếu phát hiện: **NGẮT NGAY** luồng đặt lịch, trả về cảnh báo gọi 115.
2. **Ngưỡng tin cậy 60% (Confidence Threshold):**
   * Nếu điểm tin cậy $\ge 60\%$: Đề xuất 1-2 chuyên khoa và danh sách bác sĩ.
   * Nếu điểm tin cậy $< 60\%$: Tự động đề xuất về khoa `Nội tổng quát` để bác sĩ khám sàng lọc.
3. **Disclaimer y tế bắt buộc:**
   * `"disclaimer": "Kết quả phân tích từ AI chỉ mang tính chất tham khảo sơ bộ, không thay thế chẩn đoán y khoa của bác sĩ chuyên môn."`
4. **Bác sĩ là người quyết định cuối cùng:**
   * Bác sĩ là người duy nhất ký chẩn đoán và hoàn tất khóa hồ sơ bệnh án (Read-only).

---

## 7. QUY TRÌNH GIT FLOW & CODE REVIEW

1. **Tên nhánh:** `feature/<tên-thành-viên>-<chức-năng>` (VD: `feature/tung-auth-jwt`, `feature/an-ai-triage`).
2. **Commit Message (Conventional Commits):**
   * `feat: Thêm API đăng ký tài khoản với xác thực OTP`
   * `fix: Sửa lỗi race condition khi đặt trùng slot`
3. **Definition of Done (DoD):** Chạy lệnh `pytest tests/ -v` pass 100% tại máy trước khi tạo Pull Request.
