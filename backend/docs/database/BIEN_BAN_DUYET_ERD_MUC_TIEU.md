# BIÊN BẢN THỐNG NHẤT & PHÊ DUYỆT ERD MỤC TIÊU CLINIC-AI (ERD SIGN-OFF)
**Dự án:** Clinic-AI — Hệ thống Quản lý Khám chữa bệnh & Đặt lịch Thông minh  
**Thời gian lập biên bản:** 19/10/2026  
**Địa điểm:** Phòng họp nhóm phát triển dự án tốt nghiệp  
**Chủ trì:** Thành viên 1 — Lương Duyên Hợp (Trưởng nhóm / Kiến trúc sư hệ thống)  
**Thành phần tham dự:** Toàn bộ 5 thành viên nhóm phát triển.

---

## 1. MỤC ĐÍCH BIÊN BẢN
Biên bản này là **văn kiện pháp lý và kỹ thuật cao nhất** xác lập kiến trúc Cơ sở dữ liệu Mục tiêu (Target ERD) cho dự án Clinic-AI. Mọi sự thay đổi về SQLAlchemy Models, Alembic Migrations, API Endpoints và Frontend giao diện kể từ thời điểm này **bắt buộc phải bám sát 100%** vào bản đặc tả ERD này, tuyệt đối không tự ý thêm bớt bảng hoặc thay đổi kiểu dữ liệu làm gãy hệ thống.

---

## 2. KẾT QUẢ ĐỐI SOÁT & NGUYÊN TẮC THỐNG NHẤT

### 2.1. Quyết định về Quy ước đặt tên và Tính tương thích ngược
- **GIỮ NGUYÊN 100% quy ước đặt tên Tiếng Việt (`snake_case`)** cho toàn bộ 45 bảng hiện có (`nguoi_dung`, `lich_kham`, `luot_kham`, `chi_dinh`, `don_thuoc`, `hoa_don`...).
- **Lý do:** Giữ vững sự ổn định của 13 FastAPI Routers, 50 file Test Suites (238 test cases đang pass 100%) và toàn bộ màn hình Next.js đã hoàn thiện.

### 2.2. Phân định Phạm vi Triển khai (Scope Allocation)
Hệ thống 45 bảng được phân thành 2 phân kỳ rõ ràng:
1. **MVP Cốt lõi (35 bảng):** Là đối tượng bắt buộc phải hoàn thành, kiểm thử tự động và vận hành trơn tru phục vụ nghiệm thu tốt nghiệp.
   - Phân hệ 1 — Quản trị & Hệ thống: 6 bảng (`nguoi_dung`, `tai_khoan`, `he_thong_trang_thai_bff`, `nhat_ky_truy_cap_y_te`, `tu_khoa_cap_cuu`, `thong_bao`).
   - Phân hệ 2 — Tài khoản & Cơ sở y tế: 7 bảng (`benh_nhan`, `bac_si`, `ho_so_nguoi_than`, `chuyen_khoa`, `phong_kham`, `giay_phep_co_so`, `lich_su_giay_phep_bac_si`).
   - Phân hệ 3 — Đặt lịch & Tiếp đón: 8 bảng (`lich_kham`, `lich_lam_viec`, `hang_doi_kham`, `danh_sach_cho`, `lich_dinh_ky_bac_si`, `nghi_phep_bac_si`, `phan_tich_ai`, `danh_gia_ai`).
   - Phân hệ 4 — Khám bệnh & EMR: 6 bảng (`luot_kham`, `luot_kham_the_luc`, `chan_doan`, `khai_niem`, `bien_ban_dinh_chinh`, `mau_bieu_y_te`).
   - Phân hệ 5 — CLS, Dược & Viện phí: 8 bảng (`chi_dinh`, `dich_vu`, `don_thuoc`, `chi_tiet_don_thuoc`, `hoa_don`, `chi_tiet_hoa_don`, `phieu_thu_chi`, `khoa_so_ca_truc`).
2. **Phase 2 — Mở rộng & Bổ trợ (10 bảng tạm đóng băng trong MVP):**
   - 7 bảng Khám đoàn & Liệu trình: `hop_dong_kham_doan`, `nhan_vien_kham_doan`, `goi_dich_vu`, `chi_tiet_goi_dich_vu`, `dang_ky_goi_kham`, `lieu_trinh_dieu_tri`, `buoi_dieu_tri`.
   - 3 bảng Cổng nội dung: `bai_viet_tin_tuc`, `cau_hoi_y_khoa`, `danh_gia_dich_vu`.

### 2.3. Hai cải tiến CSDL Mục tiêu được thống nhất bổ sung:
1. **Bổ sung cột `idempotency_key VARCHAR(64) UNIQUE NULL` vào bảng `lich_kham`:**
   - *Mục đích:* Ngăn chặn double-click và xung đột đặt trùng slot khám khi có race-condition.
2. **Bổ sung cột `tep_dinh_kem_url VARCHAR(500) NULL` vào bảng `chi_dinh`:**
   - *Mục đích:* Lưu trữ URL file ảnh X-quang, siêu âm, phiếu kết quả xét nghiệm PDF/PNG để bác sĩ và bệnh nhân xem trực tiếp.

---

## 3. MA TRẬN PHÂN CÔNG TRÁCH NHIỆM & CHỮ KÝ ĐỒNG THUẬN

| STT | Thành viên | Vai trò trong nhóm | Phân hệ CSDL cam kết quản lý | Chữ ký xác nhận |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **Lương Duyên Hợp** | Nhóm trưởng / Solution Architect | Master ERD, Cross-subsystem FKs, Quản trị hệ thống | **ĐÃ KÝ (Approved)** |
| 2 | **Thành viên 2 (Tùng)** | Backend & Security Developer | Phân hệ Tài khoản, Nhân sự & Cơ sở y tế (7 bảng) | **ĐÃ KÝ (Approved)** |
| 3 | **Thành viên 3 (Trọng)** | Backend & Scheduling Developer | Phân hệ Đặt lịch & Tiếp đón (8 bảng) | **ĐÃ KÝ (Approved)** |
| 4 | **Thành viên 4 (Hoàng)** | Backend & Clinical EMR Developer | Phân hệ Khám lâm sàng & Bệnh án điện tử EMR (6 bảng) | **ĐÃ KÝ (Approved)** |
| 5 | **Thành viên 5 (An)** | Backend & Billing/Pharmacy Dev | Phân hệ Cận lâm sàng, Đơn thuốc & Viện phí (8 bảng) | **ĐÃ KÝ (Approved)** |

---

## 4. KẾ HOẠCH HÀNH ĐỘNG TIẾP THEO (NEXT STEPS)
1. **Bước 1:** Dán mã nguồn `erd_muc_tieu.dbml` lên [dbdiagram.io](https://dbdiagram.io) để xuất file ảnh kiến trúc CSDL chất lượng cao đưa vào Báo cáo đồ án.
2. **Bước 2:** Cập nhật Model SQLAlchemy tại `app/models/` bổ sung 2 trường `idempotency_key` và `tep_dinh_kem_url`.
3. **Bước 3:** Chạy lệnh sinh Migration Alembic revision `006_align_target_erd_mvp.py` và nâng cấp database.
4. **Bước 4:** Chạy toàn bộ 50 test files của pytest để đảm bảo hệ thống đạt 100% test pass.
