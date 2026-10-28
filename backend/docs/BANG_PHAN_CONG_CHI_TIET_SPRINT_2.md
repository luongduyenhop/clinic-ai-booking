# BẢNG PHÂN CÔNG CÔNG VIỆC CHI TIẾT SPRINT 2 (21/09/2026 – 04/10/2026)
## Dự án: Website Quản Lý & Đặt Lịch Phòng Khám Trực Tuyến Tích Hợp AI
**Học phần:** Project 1 (IT1.241.3) — GVHD: TS. Nguyễn Đức Dư — Nhóm 2  

---

### 📊 TỔNG QUAN PHÂN BỔ STORY POINTS (CÂN BẰNG 5 THÀNH VIÊN)

| STT | Thành viên | Vai trò Sprint 2 | Trọng tâm công việc | Story Points |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **Lương Duyên Hợp** | Nhóm trưởng / DevOps & Database Master | Hạ tầng GitHub, CI/CD, PostgreSQL 15, Migration Alembic & **Viết trọn bộ Seed Data CSDL** | **12 SP** |
| 2 | **Bùi Thanh Tùng** | Backend Developer | Module Xác thực (Pkg A): Đăng ký OTP, Đăng nhập JWT, Băm BCrypt cost 12, Hồ sơ cá nhân | **11 SP** |
| 3 | **Đỗ Văn An** | Backend Dev & AI Engineer | Module Trí tuệ nhân tạo (Pkg C): **Train model trên Kaggle**, Tích hợp `ai_bac_si.pkl` vào Backend, Dựng khung FE cơ bản | **11 SP** |
| 4 | **Hoàng Đức Trọng** | Backend Developer | Module Lõi Đặt lịch (Pkg B Core): Danh mục BS/Khoa, Thuật toán Dynamic Slot 30p, Khóa dòng `SELECT FOR UPDATE` | **11 SP** |
| 5 | **Đinh Đức Hoàng** | Backend Dev & QA | Module Đặt lịch mở rộng (Pkg B Adv & QA): Kiểm soát No-show 24h, Danh sách chờ (Waitlist), Package D Skeleton, Pytest Suite | **11 SP** |
| **TỔNG** | **Cả nhóm** | **Sprint 2 Implementation** | **Toàn bộ Backend Core + AI Model + Khung FE Prototype** | **56 SP** |

---

### CHI TIẾT CÁC TASKS:
1. **Lương Duyên Hợp (12 SP):**
   * S2-HOP-01 (2 SP): Khởi tạo GitHub Repo, Branch protection, cấm push đè.
   * S2-HOP-02 (3 SP): PostgreSQL 15 Docker & Alembic migration 12 bảng thực thể.
   * S2-HOP-03 (3 SP): [HỢP LÀM] Viết & chạy script Seed Data CSDL mẫu hoàn chỉnh (`seed_data.py`).
   * S2-HOP-04 (4 SP): CI GitHub Actions, Daily Scrum T2-T4-T6, Burn-down chart báo cáo thầy Dư.
2. **Bùi Thanh Tùng (11 SP):**
   * S2-TUNG-01 (4 SP): API Đăng ký tài khoản & OTP Email (`POST /auth/register`).
   * S2-TUNG-02 (3 SP): API Xác thực OTP, băm BCrypt & tạo hồ sơ bệnh nhân (`POST /auth/verify-otp`).
   * S2-TUNG-03 (2 SP): API Đăng nhập cấp JWT Bearer Token 24h (`POST /auth/login`).
   * S2-TUNG-04 (2 SP): API Xem hồ sơ cá nhân và Cập nhật thông tin (`GET /auth/me`).
3. **Đỗ Văn An (11 SP):**
   * S2-AN-01 (3 SP): Huấn luyện mô hình phân loại chuyên khoa trên Kaggle $\rightarrow$ Xuất file `ai_bac_si.pkl`.
   * S2-AN-02 (3 SP): Tích hợp model `ai_bac_si.pkl` vào FastAPI backend kết hợp Red Flags 115 và ngưỡng 60%.
   * S2-AN-03 (3 SP): Dựng Khung Giao diện Frontend Cơ bản (Next.js Prototype) cho màn hình Symptom Checker.
   * S2-AN-04 (2 SP): Đấu nối API từ Frontend Next.js sang Backend FastAPI (`/api/v1/ai/analyze-symptoms`).
4. **Hoàng Đức Trọng (11 SP):**
   * S2-TRONG-01 (2 SP): API Danh mục Chuyên khoa & Bác sĩ lọc theo khoa/học vị (`GET /medical/specialties`, `GET /medical/doctors`).
   * S2-TRONG-02 (4 SP): Thuật toán Dynamic Slot 30 phút trong ngày (`GET /appointments/doctors/{id}/slots`).
   * S2-TRONG-03 (3 SP): API Đặt lịch khám & Khóa dòng PostgreSQL `SELECT FOR UPDATE` (`POST /appointments`).
   * S2-TRONG-04 (2 SP): API Hủy lịch khám với ràng buộc thời gian tối thiểu 02 tiếng (`POST /appointments/{id}/cancel`).
5. **Đinh Đức Hoàng (11 SP):**
   * S2-DHOANG-01 (4 SP): Module Kiểm soát No-show: API Xác nhận hẹn 24h, tự động giải phóng slot, danh sách chờ Waitlist.
   * S2-DHOANG-02 (2 SP): API Bệnh nhân tra cứu lịch hẹn của bản thân (`GET /appointments/my-appointments`).
   * S2-DHOANG-03 (2 SP): Khởi tạo Skeleton phân hệ Khám bệnh lâm sàng Package D OpenMRS (`luot_kham`, `chan_doan`, `chi_dinh`).
   * S2-DHOANG-04 (3 SP): Viết & Vận hành bộ Automated Tests (`Pytest`) cho cả nhóm chạy trước khi push.
