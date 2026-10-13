# NHẬT KÝ BẰNG CHỨNG KHẢO SÁT HỆ THỐNG THỰC TẾ TCLINIC
## QUAN SÁT THỰC ĐỊA QUA CHROME DEVTOOLS MCP & HAR LOGS

**Thời điểm ghi nhận:** 12/10/2026  
**Nguồn:** `https://demo.tclinic.io` (Tài khoản: `phongkham5`, Cơ sở: Phòng khám Đa khoa Quang Lâm)  
**Công cụ khảo sát:** Chrome DevTools MCP (`take_snapshot`, `list_network_requests`, `get_network_request`, `evaluate_script`)  
**Tài liệu:** `docs/analysis/EVIDENCE_LOG.md`  

---

## 1. Bằng chứng Xác thực Phiên (Authentication & Session Evidence)

- **Cookie lưu trữ:**
  - `token`: JWT Token HS256 (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`).
  - Payload giải mã: `{"_id": "6aa11e1bbbcf39001b81d1ab", "iat": 1791776277, "exp": 1823312277}`.
  - `refreshToken`: 64 ký tự hex (`14ee594edc69f9275d34b1f2873fc24bc008462b3c952995a0451e785327fa62...`).
- **Endpoint kiểm tra nhân viên hiện tại:** `GET /api/nhanvien/me` -> Trả về thông tin tài khoản `pksan`, Bác sĩ VŨ THỊ MỸ DUNG, vai trò Bác sĩ / Quản trị viên.

---

## 2. Bằng chứng Tiếp đón & Đăng ký Khám bệnh (Registration Evidence)

- **Trang giao diện:** `/dangky`
- **Các phím tắt quan sát được:**
  - `F2`: Thêm mới đăng ký bệnh nhân.
  - `F5`: Lưu thông tin đăng ký.
  - `F7`: Mở tab Kê dịch vụ khám / CLS.
  - `F8`: Tra cứu lịch sử khám cũ.
  - `F9`: In phiếu đăng ký / Xử trí.
- **Request quan sát:** `GET /api/dangky/6acc579883fa5000e560840b`
- **Payload trích xuất thực tế:**
  ```json
  {
    "_id": "6acc579883fa5000e560840b",
    "benhnhan_id": {
      "_id": "6ab0984697d5f8001a01d3e1",
      "mabn": "00011540",
      "hoten": "Nguyễn Thị Hồng Hạnh",
      "dienthoai": "0934300414",
      "ngaysinh": "1977-10-16T00:00:00.000Z",
      "gioitinh": 2,
      "diachi": "32 Nguyễn Công Trứ Phường Hai Bà Trưng Hà Nội ",
      "bhyt": "2301546789",
      "cccd": "123456789011"
    },
    "khambenh_id": "6acc58bd83fa5000e56086e7",
    "phongkham_id": { "_id": "65d2bdb301267d0013807e94", "tenphong": "Phòng khám Nhi" },
    "bacsi_id": { "_id": "6a7ad75184ecf500133581fd", "taikhoan": "pksan", "hoten": "VŨ THỊ MỸ DUNG" },
    "ngaykham": "2026-10-12T03:49:03.391Z",
    "ngaydk": "2026-10-12T03:43:31.690Z",
    "makcb": "2610120001",
    "sothutu": 1,
    "uutien": false,
    "trangthai": 2,
    "hoanthanhkham": false
  }
  ```
- **Quy tắc quan sát được:**
  - Quy ước Mã KCB (`makcb`): Định dạng `YYMMDD` + 4 chữ số tăng dần theo ngày (`2610120001`).
  - STT hàng đợi (`sothutu`): Đánh số độc lập theo ngày và buồng khám.
  - Phân loại đối tượng: Có cờ `uutien` (Ưu tiên) và `khamtuxa` (Khám từ xa).

---

## 3. Bằng chứng Bàn khám Lâm sàng (Clinical Examination Evidence)

- **Trang giao diện:** `/khambenh`
- **Sinh hiệu bắt buộc / khuyến nghị:**
  - Nhiệt độ (`℃`), Nhịp thở (`L/P`), Cân nặng (`Kg`), SpO2 (`%`).
  - Chỉ số BMI: Tự động tính toán hiển thị (Disabled/Read-only).
  - Tiền sử dị ứng: Textarea độc lập.
- **Bảng Chẩn đoán ICD-10:**
  - Cột `BC` (Bệnh chính): Radio button độc nhất — Bắt buộc phải chọn đúng 1 bệnh chính trước khi hoàn tất.
  - Cột `Mã ICD`: Ví dụ `A04.8` (Nhiễm trùng đường ruột...).
  - Cột `Diễn giải`: Cho phép bác sĩ bổ sung chi tiết chẩn đoán lâm sàng.
- **Đơn thuốc & Ký số:**
  - Nút `medicine-box Đơn mẫu`: Nạp đơn mẫu theo chẩn đoán.
  - Nút `upload Đồng bộ`: Đẩy đơn thuốc lên Cổng Đơn thuốc Quốc gia.
  - Nút `save Hoàn thành khám`: Khóa phiên khám.

---

## 4. Bằng chứng Kê dịch vụ & Cận lâm sàng (Order & Procedure Evidence)

- **Trang giao diện:** Tab `Kê dịch vụ (F7)` và trang `/pttt`
- **Request quan sát:** `GET /api/kedichvu/canlamsang`, `GET /api/kedichvu/pttt`, `GET /api/dangky/:id/ketqua`
- **Cấu trúc cột dịch vụ kỹ thuật:**
  - `Mã dịch vụ`, `Tên dịch vụ`, `ĐVT`, `SL`, `Đơn giá`, `Giảm giá`, `Thành tiền`.
  - `Phòng CLS`: Chỉ định phòng kỹ thuật thực hiện (X-quang, Siêu âm, Phòng xét nghiệm).
  - `Thanh toán`: Trạng thái đã thanh toán viện phí chưa.
  - `Trạng thái`: Trạng thái thực hiện tại phòng CLS.

---

## 5. Bằng chứng Thu ngân & Viện phí (Billing & Invoice Evidence)

- **Trang giao diện:** `/thutien` và `/hoadon`
- **Request quan sát:** `GET /api/hoadon/thutien`, `GET /api/banlamviec/thungan/thongke`, `GET /api/banlamviec/thungan/hinhthucthu`
- **Cấu trúc hóa đơn thu tiền:**
  - Thông tin bệnh nhân: Mã BN, Họ tên, Ngày sinh, Giới tính, Điện thoại.
  - Hóa đơn: Mã hóa đơn, Ngày thu, Người thu, Tổng tiền, Giảm giá/Công nợ, Thành tiền.
  - 4 Hình thức thu tiền thực tế:
    1. **Tiền mặt** (Cash)
    2. **Chuyển khoản** (Bank Transfer / VietQR động)
    3. **Cà thẻ** (POS / Credit card)
    4. **Kết hợp** (Thanh toán hỗn hợp nhiều hình thức)
  - Chức năng: Tạo mã VietQR động, In phiếu thu F9, Khóa sổ ca trực cuối ngày.

---

## 6. Bằng chứng Thiết lập Hệ thống (Settings Evidence)

- **Endpoint:** `GET /api/setting`
- **Payload trích xuất:**
  - Ca sáng: `sang_bd`: "08:30" -> `sang_kt`: "11:30".
  - Ca chiều: `chieu_bd`: "14:30" -> `chieu_kt`: "17:30".
  - Ca tối: `toi_bd`: "17:30" -> `toi_kt`: "20:30".
  - Khoảng cách slot hẹn: `khoangcachlanhen`: 15 phút.
