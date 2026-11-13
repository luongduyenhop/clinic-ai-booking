# TỔNG HỢP TẤT CẢ TÀI KHOẢN VÀ MẬT KHẨU TRÊN HỆ THỐNG CLINIC-AI

- **Địa chỉ truy cập chính thức (HTTPS):** [https://clinic-ai.luongduyenhop.me](https://clinic-ai.luongduyenhop.me)
- **Địa chỉ IP máy chủ (HTTP):** [http://3.27.138.183](http://3.27.138.183)
- **MẬT KHẨU DÙNG CHUNG CHO TẤT CẢ CÁC TÀI KHOẢN DƯỚI ĐÂY:** **`Demo@12345678`**

---

## 1. KHỐI QUẢN TRỊ & NHÂN VIÊN VẬN HÀNH

| STT | Phân hệ / Vai trò | Họ tên hiển thị | Email đăng nhập | Mật khẩu | Chức năng chính |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Quản trị viên (Admin)** | Quản trị viên [DEMO] | `admin.demo@clinic-ai.test` | `Demo@12345678` | Quản trị viện phí, dashboard 7 ngày, duyệt biên bản đính chính bệnh án EMR, cấu hình hệ thống. |
| **2** | **Lễ tân & Điều phối** | Lễ tân [DEMO] | `letan.demo@clinic-ai.test` | `Demo@12345678` | Tiếp đón, phân luồng triệu chứng AI, cấp số thứ tự, điều phối bệnh nhân vào các phòng. |
| **3** | **Thu ngân viện phí** | Thu ngân [DEMO] | `thungan.demo@clinic-ai.test` | `Demo@12345678` | Quầy thu ngân, hiển thị mã VietQR SePay động, in phiếu hóa đơn kèm mã QR tự quét. |
| **4** | **Kỹ thuật viên Cận lâm sàng** | Kỹ thuật viên [DEMO] | `ktv.demo@clinic-ai.test` | `Demo@12345678` | Nhận mẫu xét nghiệm, nhập kết quả sinh hóa, upload ảnh X-quang/siêu âm lên Cloudinary, duyệt trả kết quả. |

---

## 2. KHỐI BÁC SĨ CÁC CHUYÊN KHOA LÂM SÀNG

| STT | Chuyên khoa | Bác sĩ phụ trách | Buồng khám | Email đăng nhập | Mật khẩu |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **1** | **Khoa Nội tổng quát** | BS.CKI Nguyễn Văn An (Trưởng khoa) | **P101** | `doctor.demo@clinic-ai.test` | `Demo@12345678` |
| **2** | **Khoa Tim mạch & Nội** | BS.CKII Nguyễn Minh Hoàng | **P102** | `hoang.doctor@clinic-ai.test` | `Demo@12345678` |
| **3** | **Khoa Ngoại & Tiểu phẫu** | ThS.BS Trần Mai Phương | **P201** | `phuong.doctor@clinic-ai.test` | `Demo@12345678` |
| **4** | **Khoa Tai Mũi Họng & Nội soi** | BS.CKI Lê Hoàng Long | **P202** | `minh.doctor@clinic-ai.test` | `Demo@12345678` |
| **5** | **Khoa Răng & Nha khoa** | BS. Vũ Anh Dũng | **P301** | `dung.doctor@clinic-ai.test` | `Demo@12345678` |
| **6** | **Khoa Mắt & Đo khúc xạ** | BS.CKI Đỗ Thanh Thảo | **P302** | `thao.doctor@clinic-ai.test` | `Demo@12345678` |

---

## 3. KHỐI BỆNH NHÂN (ĐẶT LỊCH TRỰC TUYẾN & XEM BỆNH ÁN)

### A. Tài khoản Bệnh nhân Test Trực Tiếp (Live Demo):

| STT | Họ tên Bệnh nhân | Mã Y Tế (Mã BN) | Trạng thái hiện tại | Email đăng nhập | Mật khẩu |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | Bệnh nhân mẫu 01 | `BN-DEMO-001` | Lịch sử khám 7 ngày | `patient01@clinic-ai.test` | `Demo@12345678` |
| **2** | Lê Văn Tiến | `BN-TODAY-001` | Đang trong phòng khám P101 (`DANG_KHAM`) | `patient_p101_curr@clinic-ai.test` | `Demo@12345678` |
| **3** | Nguyễn Hải Đăng | `BN-TODAY-002` | Đang ngồi chờ gọi số P101 (`CHO_KHAM`) | `patient_p101_waiting@clinic-ai.test` | `Demo@12345678` |
| **4** | Trần Thu Hà | `BN-TODAY-003` | Đang chờ thực hiện xét nghiệm tại Lab | `patient_lab_wait@clinic-ai.test` | `Demo@12345678` |
| **5** | Đỗ Minh Tuấn | `BN-TODAY-004` | Đang chờ thanh toán hóa đơn tại Quầy thu ngân | `patient_cashier_wait@clinic-ai.test` | `Demo@12345678` |
| **6** | Phạm Quỳnh Chi | `BN-TODAY-005` | Đang xếp hàng chờ khám Răng Hàm Mặt | `patient_queue_05@clinic-ai.test` | `Demo@12345678` |
| **7** | Nguyễn Hoàng Minh | `BN-2026-0043` | Bệnh nhân tự đăng ký qua Gmail | `hoangminh.test@gmail.com` | `Demo@12345678` |
| **8** | Lê Thu Thảo | `BN-2026-0044` | Bệnh nhân tự đăng ký qua Gmail + SĐT | `thuthao.clinic@gmail.com` | `Demo@12345678` |

### B. Danh Sách 25 Bệnh Nhân Vận Hành Tuần Qua (Đã có bệnh án, đơn thuốc & hóa đơn thực tế):

| STT | Họ tên Bệnh nhân | Mã Y Tế | Số điện thoại | Email đăng nhập | Mật khẩu |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **1** | Nguyễn Văn An | `BN-2026-0001` | `0912001001` | `patient_0912001001@clinic-ai.test` | `Demo@12345678` |
| **2** | Trần Thị Bích | `BN-2026-0002` | `0912001002` | `patient_0912001002@clinic-ai.test` | `Demo@12345678` |
| **3** | Lê Hoàng Cường | `BN-2026-0003` | `0912001003` | `patient_0912001003@clinic-ai.test` | `Demo@12345678` |
| **4** | Phạm Minh Dung | `BN-2026-0004` | `0912001004` | `patient_0912001004@clinic-ai.test` | `Demo@12345678` |
| **5** | Hoàng Quốc Em | `BN-2026-0005` | `0912001005` | `patient_0912001005@clinic-ai.test` | `Demo@12345678` |
| **6** | Vũ Thị Giang | `BN-2026-0006` | `0912001006` | `patient_0912001006@clinic-ai.test` | `Demo@12345678` |
| **7** | Đỗ Văn Hùng | `BN-2026-0007` | `0912001007` | `patient_0912001007@clinic-ai.test` | `Demo@12345678` |
| **8** | Bùi Thị Hương | `BN-2026-0008` | `0912001008` | `patient_0912001008@clinic-ai.test` | `Demo@12345678` |
| **9** | Đinh Trọng Kiên | `BN-2026-0009` | `0912001009` | `patient_0912001009@clinic-ai.test` | `Demo@12345678` |
| **10** | Ngô Thị Lan | `BN-2026-0010` | `0912001010` | `patient_0912001010@clinic-ai.test` | `Demo@12345678` |
| **11** | Dương Quốc Mạnh | `BN-2026-0011` | `0912001011` | `patient_0912001011@clinic-ai.test` | `Demo@12345678` |
| **12** | Lý Thị Mai | `BN-2026-0012` | `0912001012` | `patient_0912001012@clinic-ai.test` | `Demo@12345678` |
| **13** | Đoàn Văn Nam | `BN-2026-0013` | `0912001013` | `patient_0912001013@clinic-ai.test` | `Demo@12345678` |
| **14** | Mai Thị Oanh | `BN-2026-0014` | `0912001014` | `patient_0912001014@clinic-ai.test` | `Demo@12345678` |
| **15** | Hồ Văn Phúc | `BN-2026-0015` | `0912001015` | `patient_0912001015@clinic-ai.test` | `Demo@12345678` |
| **16** | Trịnh Thị Quyên | `BN-2026-0016` | `0912001016` | `patient_0912001016@clinic-ai.test` | `Demo@12345678` |
| **17** | Cao Văn Sơn | `BN-2026-0017` | `0912001017` | `patient_0912001017@clinic-ai.test` | `Demo@12345678` |
| **18** | Lương Thị Thảo | `BN-2026-0018` | `0912001018` | `patient_0912001018@clinic-ai.test` | `Demo@12345678` |
| **19** | Tạ Văn Uy | `BN-2026-0019` | `0912001019` | `patient_0912001019@clinic-ai.test` | `Demo@12345678` |
| **20** | Võ Thị Xuân | `BN-2026-0020` | `0912001020` | `patient_0912001020@clinic-ai.test` | `Demo@12345678` |
| **21** | Phan Văn Yên | `BN-2026-0021` | `0912001021` | `patient_0912001021@clinic-ai.test` | `Demo@12345678` |
| **22** | Đỗ Kim Chi | `BN-2026-0022` | `0912001022` | `patient_0912001022@clinic-ai.test` | `Demo@12345678` |
| **23** | Trương Hoàng Đạt | `BN-2026-0023` | `0912001023` | `patient_0912001023@clinic-ai.test` | `Demo@12345678` |
| **24** | Lê Hồng Gấm | `BN-2026-0024` | `0912001024` | `patient_0912001024@clinic-ai.test` | `Demo@12345678` |
| **25** | Bùi Quang Khải | `BN-2026-0025` | `0912001025` | `patient_0912001025@clinic-ai.test` | `Demo@12345678` |
