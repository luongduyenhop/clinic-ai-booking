# 🏥 NỀN TẢNG Y TẾ THÔNG MINH: BACKEND FASTAPI & POSTGRESQL TÍCH HỢP AI
> **Học phần:** Project 1 (IT1.241.3) — Trường Đại học Giao Thông Vận Tải (UTC)  
> **Giảng viên hướng dẫn:** TS. Nguyễn Đức Dư  
> **Đơn vị thực hiện:** Nhóm 2 — Lớp Project 1-1-1-26 (N05)  
> **Mô hình kế thừa:** Chuẩn quốc tế **OpenMRS 3.0** (Person, Encounter, Concept Dictionary) & Thông tư 32/2023/TT-BYT  

---

## 🌟 TỔNG QUAN HỆ THỐNG

Dự án cung cấp hệ thống Backend API hoàn chỉnh phục vụ nền tảng quản lý phòng khám đa khoa và đặt lịch khám trực tuyến thông minh tích hợp trí tuệ nhân tạo (AI Triage):
* **Xác thực & Bảo mật (Package A):** Đăng ký tài khoản xác thực OTP qua Email, băm mật khẩu chuẩn **BCrypt** (`cost=12`), cấp phát JWT Bearer Token 24 giờ, phân quyền 3 cấp độ (Bệnh nhân, Bác sĩ, Quản trị viên).
* **Điều phối & Đặt lịch khám 30 phút (Package B):** Thuật toán tính toán Dynamic Slot 30 phút trong ngày, cơ chế khóa dòng **Pessimistic Locking (`SELECT ... FOR UPDATE`)** kết hợp **Unique Partial Index** cấp CSDL trên PostgreSQL triệt tiêu hoàn toàn lỗi đặt trùng khung giờ (Race Condition / Overbooking).
* **Kiểm soát No-Show & Danh sách chờ (Waiting List):** Cơ chế nhắc hẹn trước 24h & 2h, tự động giải phóng slot nếu bỏ quên, hàng đợi thông minh (Smart Waitlist) tự động đôn người lên khi có chỗ trống.
* **Trí tuệ nhân tạo & Red Flags (Package C):** Bộ lọc dấu hiệu cấp cứu khẩn cấp (ngắt luồng đặt lịch, cảnh báo gọi 115), mô hình học máy NLP phân loại 14 chuyên khoa lâm sàng (`ai_bac_si.pkl`), ngưỡng tin cậy 60% và nhật ký suy luận.
* **Thăm khám lâm sàng & Bệnh án điện tử (Package D):** Mô hình hóa buổi khám thực tế (OpenMRS Encounter Pattern), ghi nhận 7 chỉ số sinh hiệu, chẩn đoán bệnh theo mã quốc tế **WHO ICD-10**, y lệnh cận lâm sàng và kê đơn thuốc ngoại trú kèm cơ chế **Khóa bệnh án Read-only** chống sửa đổi hồi tố.

---

## 🏗️ CÔNG NGHỆ ÁP DỤNG (TECH STACK)

| Tầng hệ thống | Công nghệ sử dụng | Vai trò & Đặc tính |
| :--- | :--- | :--- |
| **Framework** | **FastAPI (Python 3.11+)** | Hiệu năng cao, bất đồng bộ (Asynchronous ASGI), tự động sinh tài liệu OpenAPI / Swagger UI |
| **Cơ sở dữ liệu** | **PostgreSQL 15+** | Hệ quản trị CSDL quan hệ mạnh mẽ, hỗ trợ khóa dòng `SELECT FOR UPDATE`, Unique Partial Indexes |
| **ORM & Driver** | **SQLAlchemy 2.0 Async + asyncpg** | Ánh xạ đối tượng CSDL bất đồng bộ với Connection Pool tối ưu hóa truy vấn |
| **Database Migration** | **Alembic** | Quản lý phiên bản cấu trúc CSDL tự động theo mã nguồn |
| **Validation & Schemas** | **Pydantic v2** | Xác thực kiểu dữ liệu đầu vào/ra nghiêm ngặt, chuẩn hóa `ResponseEnvelope` |
| **Security & Auth** | **Passlib (BCrypt) + Python-Jose (JWT)** | Băm mật khẩu 1 chiều an toàn, ký số và xác thực JWT Bearer token |
| **Email Gateway** | **aiosmtplib** | Gửi email chứa mã xác thực OTP 6 số bất đồng bộ qua Gmail SMTP |
| **Containerization** | **Docker & Docker Compose** | Đóng gói môi trường đồng nhất giữa máy lập trình và máy chủ chạy thực tế |
| **Testing & CI** | **Pytest + Ruff + GitHub Actions** | Kiểm thử tự động cục bộ trong 1.5s và tự động kiểm tra tích hợp khi tạo Pull Request |

---

## 📂 CẤU TRÚC THƯ MỤC DỰ ÁN (MÔ HÌNH PHÂN TẦNG BCE)

```text
backend/
├── app/
│   ├── main.py                  # Điểm khởi chạy FastAPI, middleware CORS, Lifespan, Exception Handlers
│   ├── core/                    # Tầng hạ tầng, cấu hình & an ninh
│   │   ├── config.py            # Quản lý biến môi trường Pydantic Settings
│   │   ├── database.py          # Kết nối AsyncEngine, session factory, get_db dependency
│   │   ├── security.py          # Băm BCrypt, sinh/giải mã JWT token, sinh mã OTP 6 số
│   │   ├── response.py          # Chuẩn hóa Response Envelope (success, code, data, meta, errors)
│   │   ├── exceptions.py        # Bộ xử lý lỗi toàn cục (Global Exception Handlers)
│   │   └── dependencies.py      # Dependency Injection (get_current_user, require_roles RBAC)
│   ├── models/                  # ENTITY LAYER: 18 bảng CSDL SQLAlchemy 2.0 Async chuẩn OpenMRS
│   │   ├── base.py              # BaseModel chứa ID và created_at/updated_at
│   │   ├── user.py              # NguoiDung, TaiKhoan, BenhNhan, BacSi, ChuyenKhoa
│   │   ├── appointment.py       # LichLamViec, LichKham, DanhSachCho, PhanTichAI, DanhGiaAI
│   │   └── medical.py           # KhaiNiem (ICD-10), TuKhoaCapCuu, DichVu, LuotKham, ChanDoan, ChiDinh, DonThuoc...
│   ├── schemas/                 # BOUNDARY LAYER: Pydantic v2 DTOs
│   │   ├── common.py            # ResponseEnvelope, PaginationParams, PaginationMeta
│   │   ├── auth.py              # RegisterRequest, VerifyOtpRequest, LoginRequest, TokenResponse...
│   │   ├── appointment.py       # DoctorScheduleSlotsResponse, AppointmentCreateRequest...
│   │   └── ai.py                # SymptomTriageRequest, SymptomTriageResponse...
│   ├── services/                # CONTROL LAYER: Logic nghiệp vụ & Giao dịch Database
│   │   ├── auth_service.py      # Đăng ký, gửi OTP, xác thực BCrypt, kích hoạt tài khoản
│   │   ├── appointment_service.py # Thuật toán tính slot 30 phút, Khóa SELECT FOR UPDATE, Waitlist
│   │   └── ai_service.py        # 3 chốt chặn y tế: Red Flags 115 -> Model AI -> Ngưỡng 60%
│   └── routers/                 # BOUNDARY LAYER: REST API Endpoints (/api/v1)
│       ├── api_v1.py            # Tập hợp các router con
│       ├── auth.py              # /api/v1/auth
│       ├── appointment.py       # /api/v1/appointments
│       ├── ai_triage.py         # /api/v1/ai
│       └── medical.py           # /api/v1/medical
├── database/
│   └── schema_postgresql.sql    # Bản vẽ DDL PostgreSQL 18 bảng chuẩn OpenMRS
├── docs/                        # THƯ MỤC TÀI LIỆU QUY CHUẨN DỰ ÁN
│   ├── CODING_STANDARDS.md      # Quy tắc đặt tên, Response Envelope, Clean Code & An toàn y tế
│   ├── PRE_PUSH_AND_CI_GUIDE.md # Hướng dẫn test 2 giây trước khi push & CI GitHub Actions
│   ├── NGHIEP_VU_VA_KIEN_TRUC.md # 5 Luồng nghiệp vụ chuyên sâu & Đối chiếu OpenMRS
│   ├── THIET_KE_CSDL_POSTGRESQL_OPENMRS.md # Đặc tả chi tiết 18 bảng CSDL PostgreSQL
│   └── BANG_PHAN_CONG_CHI_TIET_SPRINT_2.md # Phân công chi tiết nhiệm vụ từng người
├── tests/                       # BỘ KIỂM THỬ TỰ ĐỘNG (PYTEST)
│   ├── test_security.py         # Test BCrypt, JWT, sinh OTP
│   ├── test_ai_red_flags.py     # Test bộ lọc Red Flags cấp cứu y tế
│   ├── test_appointment_rules.py# Test thuật toán chia 8 slot 30 phút, quy tắc hủy 2 tiếng
│   └── test_api_smoke.py        # Test Response Envelope và validation lỗi 422
├── .env.example                 # Biến môi trường mẫu
├── Dockerfile                   # Build image backend Python 3.11
├── docker-compose.yml           # Khởi chạy PostgreSQL 15 + FastAPI
├── requirements.txt             # Danh mục thư viện Python
└── seed_data.py                 # Script tự động nạp CSDL mẫu hoàn chỉnh
```

---

## 🚀 HƯỚNG DẪN CẤU HÌNH & KHỞI CHẠY HỆ THỐNG

### 1. Yêu cầu môi trường tối thiểu
* **Python**: Phiên bản `3.11` trở lên.
* **Cơ sở dữ liệu**: `PostgreSQL 15+` (hoặc chạy qua Docker).
* **Hệ điều hành**: Windows 10/11, macOS hoặc Linux.

---

### 2. Cấu hình biến môi trường (`.env`)
Sao chép file mẫu `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Nội dung file `.env` mẫu:
```ini
PROJECT_NAME="Clinic AI Booking Backend"
API_V1_STR="/api/v1"
DEBUG=True

# Cấu hình PostgreSQL Async
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=clinic_user
POSTGRES_PASSWORD=clinic_password
POSTGRES_DB=clinic_db
DATABASE_URL=postgresql+asyncpg://clinic_user:clinic_password@localhost:5432/clinic_db

# JWT Security
SECRET_KEY=super_secret_clinic_jwt_key_project_1_change_in_production_2026
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI Parameters
AI_CONFIDENCE_THRESHOLD=0.60
SLOT_DURATION_MINUTES=30
CANCELLATION_MINIMUM_HOURS=2
```

---

### 3. Khởi chạy hệ thống (Chọn 1 trong 2 cách)

#### 🌟 CÁCH 1: Khởi chạy bằng Docker Compose (Khuyên dùng — Nhanh nhất)
Chỉ cần mở Terminal tại thư mục `backend/` và gõ 1 câu lệnh:
```bash
docker compose up -d
```
Docker sẽ tự động:
1. Tải và khởi chạy container **PostgreSQL 15** tại cổng `5432`.
2. Tự động kiểm tra sức khỏe CSDL (Healthcheck).
3. Build và khởi chạy **FastAPI Backend** tại cổng `8000`.

---

#### 💻 CÁCH 2: Khởi chạy cục bộ bằng Python (Local Virtualenv)
1. **Tạo và kích hoạt môi trường ảo Python:**
   ```bash
   # Trên Windows:
   python -m venv venv
   .\venv\Scripts\activate

   # Trên Linux/macOS:
   python3 -m venv venv
   source venv/bin/activate
   ```
2. **Cài đặt các thư viện phụ thuộc:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Khởi động Database PostgreSQL (nếu đã có sẵn Postgres cục bộ hoặc bật container DB):**
   ```bash
   docker compose up -d db
   ```
4. **Khởi tạo dữ liệu mẫu (Seed Data) vào PostgreSQL:**
   ```bash
   python seed_data.py
   ```
5. **Khởi chạy máy chủ phát triển (Development Server):**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

---

## 🔑 TÀI KHOẢN MẪU ĐỂ ĐĂNG NHẬP & TEST NGAY (SEED DATA)

Sau khi chạy `seed_data.py`, hệ thống tự động nạp sẵn các tài khoản thử nghiệm:

| Vai trò (Role) | Email đăng nhập | Mật khẩu | Thông tin chi tiết |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (ADMIN)** | `admin@clinic.com` | `Admin@123456` | Toàn quyền quản trị hệ thống, danh mục khoa phòng |
| **Bác sĩ (DOCTOR)** | `an.doctor@clinic.com` | `Doctor@123456` | BSCKI. Nguyễn Văn An (Khoa Tim mạch, phòng 201) |
| **Bác sĩ (DOCTOR)** | `bich.doctor@clinic.com` | `Doctor@123456` | ThS.BS. Trần Thị Bích (Khoa Tiêu hóa, phòng 202) |
| **Bệnh nhân (PATIENT)**| `patient@test.com` | `Patient@123456` | Nguyễn Thị Bệnh Nhân (Mã y tế: BN-2026-0001, O+) |

*Ngoài ra, hệ thống đã nạp sẵn **lịch làm việc 14 ngày tới** cho 4 bác sĩ mẫu và **1 ca khám mẫu hoàn chỉnh** gồm chẩn đoán ICD-10 và đơn thuốc.*

---

## 📖 TÀI LIỆU API SWAGGER UI TƯƠNG TÁC TRỰC TIẾP

Khi server đang chạy, truy cập vào trình duyệt:
* 📘 **Swagger UI (Interactive API Docs):** [http://localhost:8000/docs](http://localhost:8000/docs)
* 📕 **ReDoc (Specification Docs):** [http://localhost:8000/redoc](http://localhost:8000/redoc)
* 🟢 **Health Check Endpoint:** [http://localhost:8000/health](http://localhost:8000/health)

---

## 🧪 QUY TRÌNH KIỂM THỬ TỰ ĐỘNG (PRE-PUSH AUTOMATED TESTING)

Trước khi thực hiện `git push` lên GitHub, mọi thành viên **bắt buộc** chạy lệnh kiểm thử tự động tại Terminal:

```bash
pytest tests/ -v
```

**Kết quả mong đợi (100% Passed trong 1.5 giây):**
```text
tests/test_security.py::test_password_hashing PASSED                  [ 20%]
tests/test_security.py::test_otp_generation PASSED                    [ 40%]
tests/test_security.py::test_jwt_token_encode_decode PASSED           [ 60%]
tests/test_ai_red_flags.py::test_vietnamese_normalization PASSED     [ 80%]
tests/test_appointment_rules.py::test_slot_generator_calculation PASSED [100%]
============================== 10 passed in 1.48s ==============================
```

---

## 📚 DANH MỤC TÀI LIỆU KỸ THUẬT NỘI BỘ (THƯ MỤC `docs/`)

Toàn bộ các quy tắc kỹ thuật của dự án được lưu trữ chi tiết tại:
* 📄 [**CODING_STANDARDS.md**](docs/CODING_STANDARDS.md) — Quy tắc đặt tên biến/hàm/bảng CSDL, chuẩn Response Envelope, quy tắc khóa dòng PostgreSQL, đạo đức AI y tế.
* 📄 [**PRE_PUSH_AND_CI_GUIDE.md**](docs/PRE_PUSH_AND_CI_GUIDE.md) — Hướng dẫn 2 bước kiểm thử trước khi push và cơ chế tự động chặn lỗi của GitHub Actions CI.
* 📄 [**NGHIEP_VU_VA_KIEN_TRUC.md**](docs/NGHIEP_VU_VA_KIEN_TRUC.md) — Phân tích thực trạng 58% đặt nhầm khoa, chi tiết 5 luồng nghiệp vụ y tế cốt lõi và đối chiếu mô hình OpenMRS 3.0.
* 📄 [**THIET_KE_CSDL_POSTGRESQL_OPENMRS.md**](docs/THIET_KE_CSDL_POSTGRESQL_OPENMRS.md) — Bản đặc tả kiến trúc 18 bảng CSDL PostgreSQL, sơ đồ quan hệ ERD Mermaid và giải pháp kỹ thuật.
* 📄 [**BANG_PHAN_CONG_CHI_TIET_SPRINT_2.md**](docs/BANG_PHAN_CONG_CHI_TIET_SPRINT_2.md) — Bảng phân công chi tiết công việc cho 5 thành viên (What - How - Output).

---

## 👥 THÔNG TIN ĐỘI NGŨ PHÁT TRIỂN (NHÓM 2)

| STT | Họ và tên | Mã sinh viên | Vai trò phụ trách |
| :---: | :--- | :---: | :--- |
| 1 | **Lương Duyên Hợp** | 231230794 | **Nhóm trưởng** — DevOps, Hạ tầng CSDL PostgreSQL 15, Seed Data & CI/CD |
| 2 | **Bùi Thanh Tùng** | 231230948 | **Backend Developer** — Phân hệ Xác thực, Bảo mật JWT/BCrypt, OTP & Hồ sơ (Pkg A) |
| 3 | **Đỗ Văn An** | 231220700 | **Backend & AI Engineer** — Huấn luyện mô hình AI trên Kaggle, Tích hợp Model & Khung FE (Pkg C) |
| 4 | **Hoàng Đức Trọng** | 231230931 | **Backend Developer** — Lõi Đặt lịch, Thuật toán Dynamic Slot 30p, Khóa Concurrency (Pkg B) |
| 5 | **Đinh Đức Hoàng** | 231230787 | **Backend & QA** — Kiểm soát No-show, Danh sách chờ Waitlist, Khám lâm sàng Pkg D & Pytest |

---
*© 2026 Nhóm 2 — Học phần Project 1 (IT1.241.3) — Trường Đại học Giao Thông Vận Tải.*
