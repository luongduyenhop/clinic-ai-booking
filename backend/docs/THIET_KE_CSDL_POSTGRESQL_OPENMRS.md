# TÀI LIỆU ĐẶC TẢ THIẾT KẾ CƠ SỞ DỮ LIỆU CHUẨN OPENMRS 3.0 (POSTGRESQL 15+)
## Đề tài: Website Quản Lý & Đặt Lịch Phòng Khám Trực Tuyến Tích Hợp AI
**Học phần:** Project 1 (IT1.241.3) — GVHD: TS. Nguyễn Đức Dư  
**Nhóm sinh viên thực hiện:** Nhóm 2 (Hợp, Tùng, An, Trọng, Hoàng)  
**Mã nguồn DDL:** `backend/database/schema_postgresql.sql`  
**ORM Framework:** SQLAlchemy 2.0 Async (Python 3.11+, asyncpg)  

---

## 1. TRIẾT LÝ THIẾT KẾ & NGUỒN THAM CHIẾU CHUẨN MỰC
Kế thừa 4 mẫu thiết kế quốc tế cốt lõi từ **OpenMRS 3.0** và Thông tư 32/2023/TT-BYT của Bộ Y Tế:
1. **Person & User Pattern:** Tách biệt `nguoi_dung` và `tai_khoan`.
2. **Patient & Provider Role Pattern:** `benh_nhan` và `bac_si` kế thừa `nguoi_dung`.
3. **Encounter & Orders Pattern:** `luot_kham` quản lý y lệnh cận lâm sàng (`chi_dinh`), chẩn đoán (`chan_doan`), đơn thuốc (`don_thuoc`).
4. **Concept Dictionary Pattern:** Chuẩn hóa mã bệnh **WHO ICD-10** qua bảng `khai_niem`.

---

## 2. DANH MỤC 18 BẢNG CSDL THEO 4 PHÂN HỆ

### Phân hệ 1: Con người, Tài khoản & Phân quyền (Package A)
1. `chuyen_khoa`: Danh mục khoa phòng (`KHOA_TIM_MACH`, `KHOA_NOI`...).
2. `nguoi_dung`: Thông tin nhân khẩu học (Họ tên, ngày sinh, giới tính, SĐT, CCCD).
3. `tai_khoan`: Mật khẩu băm BCrypt, vai trò `vai_tro_enum` ('benh_nhan', 'bac_si', 'admin'), OTP và thời hạn.
4. `benh_nhan`: Mã y tế `BN-2026-XXXX`, nhóm máu, tiền sử bệnh, dị ứng thuốc, điểm tín nhiệm, số lần no-show.
5. `bac_si`: Học vị, chứng chỉ hành nghề, số năm kinh nghiệm, giá khám mặc định.

### Phân hệ 2: Lịch trực, Đặt lịch & Chống Overbooking (Package B)
6. `lich_lam_viec`: Ca trực Bác sĩ (ca sáng 07:30–11:30, ca chiều 13:30–17:00, giới hạn 8 ca/buổi).
7. `lich_kham`: Lịch hẹn trực tuyến 30 phút, mã hẹn `LK-YYYYMMDD-XXX`, trạng thái, xác nhận 24h.
   * **Unique Partial Index:** `(bac_si_id, ngay_kham, gio_kham) WHERE trang_thai NOT IN ('da_huy', 'tu_dong_huy')`.
8. `danh_sach_cho`: Danh sách chờ thông minh khi ca khám đã kín slot, tự động đôn người lên khi có người hủy.

### Phân hệ 3: Khái niệm Y tế & Trí tuệ Nhân tạo (Package C)
9. `khai_niem`: Từ điển chuẩn hóa OpenMRS, danh mục mã bệnh **WHO ICD-10** (I10, K29, H81...).
10. `tu_khoa_cap_cuu`: Từ khóa Red Flags (`đau ngực dữ dội`, `khó thở cấp`...) ngắt luồng đặt lịch, cảnh báo gọi 115.
11. `phan_tich_ai`: Nhật ký lưu vết toàn bộ suy luận AI, độ tin cậy, cờ cấp cứu, version model (`ai_bac_si.pkl`).
12. `danh_gia_ai`: Đánh giá 1–5 sao của bệnh nhân và bác sĩ đối với kết quả gợi ý chuyên khoa của AI.

### Phân hệ 4: Khám lâm sàng & Bệnh án điện tử EMR (Package D)
13. `dich_vu`: Bảng giá dịch vụ xét nghiệm, X-quang, siêu âm cận lâm sàng.
14. `luot_kham` (Encounter): Phiên khám thực tế, lưu 7 chỉ số sinh hiệu, kết luận điều trị và **cờ khóa bệnh án `is_locked`**.
15. `chan_doan`: Kết luận bệnh liên kết mã ICD-10 trong bảng `khai_niem`, phân định chẩn đoán chính/phụ.
16. `chi_dinh`: Phiếu chỉ định cận lâm sàng trong buổi khám, lưu đơn giá tại thời điểm chỉ định và link kết quả.
17. `don_thuoc`: Thông tin đơn thuốc ngoại trú, ngày kê, lời dặn của bác sĩ.
18. `chi_tiet_don_thuoc`: Từng dòng thuốc cụ thể (Tên thuốc, hoạt chất, hàm lượng, số lượng, cách dùng).
