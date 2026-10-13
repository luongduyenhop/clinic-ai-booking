# ĐẶC TẢ HỢP ĐỒNG API MỞ RỘNG (API SPECIFICATION)
## REST API ENDPOINTS CHO PHÂN HỆ THU NGÂN, CẬN LÂM SÀNG & KHÁM THỂ LỰC

**Thời điểm lập:** 12/10/2026  
**Tài liệu:** `docs/design/API_SPECIFICATION.md`  

---

## 1. Phân hệ Thu ngân Viện phí (`/api/v1/cashier`)

### 1.1. Lấy danh sách hóa đơn chờ thu
- **Method:** `GET /api/v1/cashier/pending-bills`
- **Query Params:** `ma_kcb` (optional), `page` (default 1), `page_size` (default 50)
- **Role:** `le_tan`, `admin`
- **Response 200 OK:**
  ```json
  {
    "items": [
      {
        "id": 101,
        "ma_hoa_don": "HD-261012-0001",
        "ma_kcb": "2610120001",
        "benh_nhan": { "mabn": "00011540", "ho_ten": "Nguyễn Thị Hồng Hạnh", "so_dien_thoai": "0934300414" },
        "tong_tien": 450000.0,
        "mien_giam": 0.0,
        "thuc_thu": 450000.0,
        "trang_thai": "chua_thu",
        "cac_khoan_thu": [
          { "loai_muc": "cong_kham", "ten_khoan_thu": "Khám Chuyên khoa Nhi", "thanh_tien": 150000.0 },
          { "loai_muc": "can_lam_sang", "ten_khoan_thu": "Xét nghiệm công thức máu", "thanh_tien": 300000.0 }
        ]
      }
    ],
    "total": 1
  }
  ```

### 1.2. Thu tiền viện phí & Xác nhận thanh toán
- **Method:** `POST /api/v1/cashier/invoices/{id}/pay`
- **Role:** `le_tan`, `admin`
- **Request Body:**
  ```json
  {
    "phuong_thuc_thanh_toan": "chuyen_khoan",
    "so_tien_khach_tra": 450000.0,
    "ghi_chu": "Chuyển khoản VietQR mã 2610120001"
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "ma_hoa_don": "HD-261012-0001",
    "trang_thai": "da_thu",
    "ngay_thu": "2026-10-12T05:51:00Z",
    "so_hoa_don_in": "BL-2026-000101"
  }
  ```

### 1.3. Báo cáo tổng kết ca trực & Khóa sổ Thu ngân
- **Method:** `GET /api/v1/cashier/shift-summary`
- **Method:** `POST /api/v1/cashier/close-shift`
- **Response 200 OK:**
  ```json
  {
    "thu_ngan_id": 5,
    "thoi_gian_dong_so": "2026-10-12T11:30:00Z",
    "tong_doanh_thu": 8862777.0,
    "theo_hinh_thuc": {
      "tien_mat": 3200000.0,
      "chuyen_khoan": 4662777.0,
      "the_pos": 1000000.0
    },
    "tong_luot_hoa_don": 18,
    "trang_thai_so": "DA_KHOA_SO"
  }
  ```

---

## 2. Phân hệ Bàn làm việc Kỹ thuật viên CLS (`/api/v1/subclinical`)

### 2.1. Danh sách hàng đợi kỹ thuật viên
- **Method:** `GET /api/v1/subclinical/queue`
- **Query Params:** `phong_thuc_hien_id` (optional), `loai_cls` (optional)
- **Role:** `bac_si`, `admin`
- **Response 200 OK:**
  ```json
  {
    "items": [
      {
        "chi_dinh_id": 88,
        "ma_kcb": "2610120001",
        "ten_benh_nhan": "Nguyễn Thị Hồng Hạnh",
        "ten_dich_vu": "Chụp X-quang tim phổi thẳng",
        "phong_thuc_hien": "Phòng X-Quang kỹ thuật số (Phòng 104)",
        "trang_thai_thuc_hien": "da_thanh_toan",
        "thoi_gian_chi_dinh": "2026-10-12T03:50:00Z"
      }
    ]
  }
  ```

### 2.2. Nhận ca & Tiếp nhận thực hiện
- **Method:** `POST /api/v1/subclinical/orders/{id}/start`
- **Chuyển trạng thái:** `da_thanh_toan` -> `dang_thuc_hien`.

### 2.3. Nhập kết quả cận lâm sàng
- **Method:** `POST /api/v1/subclinical/orders/{id}/result`
- **Request Body:**
  ```json
  {
    "tri_so_ket_qua": { "ket_qua": "Bình thường", "chi_tiet": "Phế trường sáng đều hai bên, tim không to" },
    "ket_luan": "Hình ảnh tim phổi bình thường",
    "hinh_anh_urls": ["/uploads/xquang/2610120001_p1.png"]
  }
  ```
- **Chuyển trạng thái:** `dang_thuc_hien` -> `da_co_ket_qua`.

---

## 3. Phân hệ Khám Thể lực TT 32/2023 (`/api/v1/clinical/encounters/{id}/physical-exam`)

- **Method:** `POST /api/v1/clinical/encounters/{id}/physical-exam`
- **Role:** `bac_si`, `admin`
- **Request Body:**
  ```json
  {
    "mat_phai_khong_kinh": "10/10",
    "mat_trai_khong_kinh": "10/10",
    "tai_mui_hong": "Tai, mũi, họng bình thường",
    "rang_ham_mat": "Không sâu răng, khớp cắn chuẩn",
    "tuan_hoan": "T1, T2 rõ, nhịp đều 75ck/phút",
    "ho_hap": "Rì rào phế nang êm dịu, không rale",
    "tieu_hoa": "Bụng mềm, gan lách không to",
    "phan_loai_the_luc": "LOAI_1",
    "ket_luan_suc_khoe": "Đủ sức khỏe làm việc"
  }
  ```
- **Response 200 OK:** Lưu thành công hồ sơ thể lực gắn liền với `luot_kham_id`.
