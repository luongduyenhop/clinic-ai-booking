# Nhật ký triển khai Frontend

## Task 1 — PJ2026-81

### Phạm vi

Xây dựng Trang chủ Bệnh nhân & Cộng đồng, cùng giao diện Đăng nhập/Đăng ký và xác thực OTP mô phỏng.

### Những phần đã thực hiện

- Chuyển Trang chủ từ giao diện giới thiệu các portal quản trị sang cổng thông tin dành cho bệnh nhân.
- Xây dựng hero với CTA đặt lịch và khảo sát triệu chứng AI.
- Xây dựng nhóm thao tác nhanh: đặt lịch, tìm bác sĩ, khảo sát AI và tra cứu lịch khám.
- Hiển thị đúng 5 chuyên khoa trong tài liệu nghiệp vụ: Nội tổng quát, Ngoại tổng quát, Mắt, Tai Mũi Họng và Răng Hàm Mặt.
- Xây dựng danh sách bác sĩ với chuyên khoa, kinh nghiệm và lịch gần nhất.
- Hiển thị quy trình đặt lịch 3 bước.
- Bổ sung khu vực trợ lý AI với tuyên bố AI chỉ hỗ trợ phân luồng, không chẩn đoán hoặc kê thuốc.
- Bổ sung cảnh báo gọi 115 hoặc đến cơ sở cấp cứu khi có dấu hiệu nguy hiểm.
- Thiết kế lại header, menu mobile và footer bệnh nhân.
- Xây dựng trang đăng nhập bệnh nhân bằng số điện thoại và mật khẩu.
- Xây dựng trang đăng ký với Formik/Yup, bước xác thực OTP, countdown gửi lại và trạng thái thành công.
- OTP demo dùng để kiểm thử: `123456`; OTP không được ghi vào localStorage.
- Phiên đăng nhập demo sau đăng ký được lưu theo luồng Redux `authSlice` → `authStorage`.
- Loại bỏ hành vi cũ tự khởi tạo quyền admin khi trình duyệt chưa có token.

### Cấu trúc chính

```text
src/components/user/home/
├── AiTriageSection.jsx
├── BookingSteps.jsx
├── DoctorSection.jsx
├── HomeHero.jsx
├── QuickActions.jsx
└── SpecialtySection.jsx

src/data/user/publicPortalData.js
src/pages/user/HomePage.jsx
src/pages/user/LoginPage.jsx
src/pages/user/RegisterPage.jsx
```

### Design system

- Màu chính: `#00B5F1`.
- Màu navy: `#003553`.
- Nền phụ: `#E8F4FD`.
- Font hiển thị: Montserrat; nội dung và control: Roboto.
- Layout giới hạn 1225px, responsive mobile-first.
- CTA chính dạng pill, card có border và bóng nhẹ.
- Không sử dụng gradient cho giao diện public mới.

### Kiểm tra

- Targeted lint phần Task 1: PASS.
- Production build: PASS.
- Dependency audit tại thời điểm triển khai: không phát hiện vulnerability.
- Build có cảnh báo bundle lớn thuộc phạm vi toàn ứng dụng; chưa xử lý trong Task 1.

### Commit

- Commit: `79e67ba`
- Message: `feat: build patient home and authentication flow`
- Branch: `dvan_fe_sprint3`

### Giới hạn hiện tại

- OTP đang là mô phỏng phía frontend do chưa có API contract.
- Dữ liệu chuyên khoa và bác sĩ đang là dữ liệu demo.
- Chưa có API đặt lịch và tra cứu lịch thật từ backend.

---

## Task 2 — PJ2026-82

### Phạm vi

Xây dựng giao diện đặt lịch khám trực tuyến theo chuyên khoa, bác sĩ và slot 30 phút.

### Những phần đã thực hiện

- Tạo route public `/dat-lich`, không bắt buộc đăng nhập.
- Xây dựng wizard 3 bước: chọn khoa/bác sĩ, chọn ngày/giờ, nhập thông tin người khám.
- Hỗ trợ chọn sẵn chuyên khoa hoặc bác sĩ từ query parameter của CTA Trang chủ.
- Hiển thị 7 ngày gần nhất và slot 30 phút theo buổi sáng/buổi chiều.
- Phân biệt slot còn trống, đang chọn và đã hết.
- Form người khám dùng Formik/Yup và tự điền thông tin khi người dùng đã đăng nhập.
- Tạo mã hẹn dạng `KCB-YYYYMMDD-XXXX` và trạng thái `PENDING`.
- Lưu lịch hẹn demo qua `BookingService` và Redux; component không truy cập localStorage trực tiếp.
- Kiểm tra lại xung đột slot ngay trước khi tạo lịch.
- Hiển thị màn hình thành công, mã hẹn, lịch khám và hướng dẫn đến trước 15 phút.
- Nối CTA đặt lịch, card chuyên khoa và card bác sĩ trên Trang chủ vào wizard.

### Giới hạn hiện tại

- Dữ liệu và slot đang được mô phỏng phía frontend do chưa có API contract.
- Lịch đặt phía bệnh nhân chưa đồng bộ sang dữ liệu của cổng lễ tân.
- Cần thay phần lưu localStorage trong `BookingService` khi backend cung cấp API chính thức.

---

## Task 3 — PJ2026-83

### Phạm vi

Xây dựng khảo sát triệu chứng ban đầu và widget AI gợi ý chuyên khoa.

### Những phần đã thực hiện

- Tạo route public `/khao-sat-trieu-chung`.
- Xây dựng khảo sát 3 bước ngắn: triệu chứng chính, đặc điểm và thông tin bổ sung.
- Kết hợp ô nhập tự do với các lựa chọn nhanh về vị trí, thời điểm, mức độ, tính chất và triệu chứng đi kèm.
- Xây dựng service phân luồng demo theo đúng boundary Service → Redux Action → Slice → UI.
- Phát hiện Red Flag từ lựa chọn trực tiếp và nội dung nhập tự do.
- Dừng luồng gợi ý thông thường khi có Red Flag và hiển thị cảnh báo gọi `115`.
- Xử lý confidence dưới 60% bằng khuyến nghị Nội tổng quát hoặc liên hệ nhân viên y tế.
- Confidence từ 60% trở lên hiển thị tối đa hai chuyên khoa cùng lý do gợi ý.
- Nối kết quả AI sang trang đặt lịch bằng query parameter chuyên khoa.
- Không lưu nội dung khảo sát vào localStorage.
- Bổ sung disclaimer AI không chẩn đoán và không kê thuốc.

### Giới hạn hiện tại

- Phân tích AI và confidence đang được mô phỏng bằng luật từ khóa phía frontend.
- Red Flag demo không thay thế đánh giá của nhân viên y tế hoặc dịch vụ cấp cứu.
- Cần thay `AiTriageService` bằng API chính thức khi backend Task 98 hoàn thành.

---

## Bổ sung Cổng bệnh nhân

### Phạm vi

Xây dựng khu vực bảo vệ sau đăng nhập để bệnh nhân quản lý hành trình khám chữa bệnh.

### Những phần đã thực hiện

- Tạo dashboard tổng quan cho bệnh nhân với lịch hẹn và hồ sơ gần nhất.
- Tạo màn hình lịch hẹn, hỗ trợ lọc lịch sắp tới, đã khám và đã hủy.
- Tạo màn hình lịch sử khám, chẩn đoán và lời dặn của bác sĩ.
- Tạo màn hình đơn thuốc với thuốc, liều dùng, tần suất và thời gian sử dụng.
- Tạo màn hình kết quả cận lâm sàng cho xét nghiệm và chẩn đoán hình ảnh.
- Tạo màn hình lịch làm việc bác sĩ trong 7 ngày và liên kết sang luồng đặt lịch.
- Bảo vệ toàn bộ hồ sơ y tế bằng `ProtectedRoute` và nhóm vai trò bệnh nhân.
- Tái sử dụng lịch hẹn được lưu bởi `BookingService`; không tạo nguồn lưu lịch hẹn thứ hai.
- Bổ sung loading, error và empty state cho các trang.

### Giới hạn hiện tại

- Hồ sơ khám, đơn thuốc, kết quả cận lâm sàng và lịch bác sĩ đang dùng dữ liệu demo vì chưa có API contract.
- Lịch làm việc hiển thị là lịch dự kiến; slot thực tế được kiểm tra lại trong luồng đặt lịch.

### Tài khoản kiểm thử

- Bổ sung tài khoản bệnh nhân demo cố định cho môi trường frontend.
- Số điện thoại: `0901234567`.
- Mật khẩu: `Patient@123`.
- Vai trò: `PATIENT`.
- Chỉ cặp thông tin demo được xử lý cục bộ; các tài khoản khác vẫn gọi API đăng nhập backend.
- Mật khẩu demo không được lưu vào `localStorage`.
