# TÀI LIỆU HƯỚNG DẪN NGHIỆP VỤ & KIẾN TRÚC HỆ THỐNG
## Website Quản Lý & Đặt Lịch Trực Tuyến Phòng Khám Tích Hợp AI
**Dành cho:** Toàn bộ thành viên Đội ngũ Phát triển (Nhóm 2)  
**Cơ sở nghiệp vụ:** Khảo sát thực tế phòng khám đa khoa & Thông tư 32/2023/TT-BYT của Bộ Y Tế  

---

## 1. BẢN CHẤT BÀI TOÁN & TẠI SAO PHẢI XÂY DỰNG HỆ THỐNG?

Qua khảo sát thực tế tại các phòng khám đa khoa tư nhân trên địa bàn Hà Nội, nhóm đã xác định 4 điểm nghẽn nghiêm trọng trong quy trình truyền thống:
1. **58% bệnh nhân tự phán đoán bệnh dẫn tới đặt nhầm chuyên khoa:** Ví dụ: Đau bụng dưới tự đặt khám Tiêu hóa (thực chất là Phụ khoa/Tiết niệu); Chóng mặt quay cuồng tự đặt Thần kinh (thực chất là Rối loạn tiền đình thuộc Tai - Mũi - Họng).
2. **Quá tải cục bộ và lãng phí thời gian:** Đa số gọi hotline hoặc đến lấy số trực tiếp, thời gian chờ khám kéo dài 45–90 phút trong khi khám chỉ mất 15–20 phút.
3. **Quản lý lịch làm việc rời rạc:** Lễ tân ghi sổ tay hoặc Excel, dễ trùng lịch hoặc lúng túng khi bác sĩ có việc đột xuất.
4. **Bác sĩ thiếu thông tin trước khám:** Không nắm được lý do và triệu chứng ban đầu của bệnh nhân trước khi bước vào phòng khám.

👉 **Mục tiêu của hệ thống:** Tự động hóa toàn bộ quy trình từ Đăng ký, Đặt lịch thông minh theo Time-slot 30 phút, Tích hợp AI Triage trợ lý sơ bộ hướng dẫn đúng bác sĩ/chuyên khoa, Thiết lập bộ lọc Red Flags bảo vệ an toàn tính mạng, đến việc hỗ trợ Bác sĩ khám lâm sàng, chỉ định cận lâm sàng và khóa bệnh án điện tử.

---

## 2. NĂM (05) LUỒNG NGHIỆP VỤ CỐT LÕI TOÀN HỆ THỐNG

### 2.1. Luồng 1: Xác thực người dùng & Bảo mật đa tầng (Authentication Flow)
1. Bệnh nhân nhập họ tên, email, số điện thoại, ngày sinh và mật khẩu.
2. Hệ thống kiểm tra định dạng email và kiểm tra trùng lặp trên bảng `tai_khoan`.
3. Tạo mã xác thực OTP 6 số ngẫu nhiên với TTL 5 phút, gửi email xác thực qua Gmail SMTP.
4. Bệnh nhân nhập mã OTP. Hệ thống mã hóa mật khẩu 1 chiều bằng thuật toán **BCrypt** (`cost_factor = 12`).
5. Kích hoạt tài khoản và phát hành **JSON Web Token (JWT)** 24 giờ.

### 2.2. Luồng 2: Điều phối lịch làm việc & Tính toán Slot khám động (Scheduling Engine)
* Mỗi ca làm việc (07:30 - 11:30 và 13:30 - 17:00) được chia thành các slot **30 phút/ca**.
* Khi bệnh nhân tra cứu lịch: Hệ thống đối chiếu `lich_lam_viec` và `lich_kham` đã đặt để trừ tập hợp, hiển thị trạng thái `available`, `booked`, `past`.

### 2.3. Luồng 3: Đặt lịch khám trực tuyến & Kiểm soát đồng thời (Booking & Concurrency)
* Dùng **Pessimistic Locking** (`SELECT ... FOR UPDATE`) kết hợp **Unique Partial Index** cấp CSDL trên PostgreSQL để triệt tiêu tuyệt đối Race condition khi 2 người cùng đặt 1 slot.
* Quy tắc đổi/hủy: Chỉ được hủy trước giờ khám tối thiểu 02 tiếng.

### 2.4. Luồng 4: Trí tuệ nhân tạo phân tích triệu chứng & An toàn y tế (AI Triage & Red Flags)
* **Chốt chặn 1:** Bộ lọc Red Flags quét từ điển `tu_khoa_cap_cuu`. Bắt trúng dấu hiệu nguy kịch $\rightarrow$ ngắt luồng, cảnh báo gọi 115.
* **Chốt chặn 2:** Mô hình AI phân loại chuyên khoa (huấn luyện từ Kaggle `ai_bac_si.pkl`).
* **Chốt chặn 3:** Ngưỡng tin cậy 60% ($\ge 60\%$ gợi ý khoa/bác sĩ, $< 60\%$ gán về Nội tổng quát); kèm disclaimer y tế bắt buộc.

### 2.5. Luồng 5: Thăm khám lâm sàng & Khóa bệnh án điện tử (Medical Visit & EMR)
* Bác sĩ khám lâm sàng, đo sinh hiệu, tạo bản ghi `luot_kham`.
* Ra chỉ định cận lâm sàng (`chi_dinh`), chẩn đoán theo mã quốc tế WHO ICD-10 (`chan_doan`), kê đơn thuốc (`don_thuoc`).
* Bấm "Hoàn tất ca khám" $\rightarrow$ Khóa hồ sơ bệnh án thành Read-only (`is_locked = True`) theo Thông tư 32/2023/TT-BYT.
