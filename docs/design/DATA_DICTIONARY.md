# TỪ ĐIỂN DỮ LIỆU CƠ SỞ DỮ LIỆU MỞ RỘNG (DATA DICTIONARY)
## BẢNG & TRƯỜNG DỮ LIỆU BỔ SUNG TRONG CLINIC-AI

**Thời điểm lập:** 12/10/2026  
**Tài liệu:** `docs/design/DATA_DICTIONARY.md`  

---

## 1. Bảng `hoa_don` (Hóa đơn Viện phí)

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ |
|---|---|---|---|
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Mã định danh nội bộ |
| `ma_hoa_don` | `VARCHAR(50)` | UNIQUE, NOT NULL, INDEX | Mã hóa đơn y tế (Format: `HD-YYMMDD-xxxx`) |
| `ma_kcb` | `VARCHAR(50)` | NOT NULL, INDEX | Mã đợt khám chữa bệnh liên kết |
| `benh_nhan_id` | `INTEGER` | FOREIGN KEY (`benh_nhan.id`), NOT NULL | Bệnh nhân thụ hưởng |
| `luot_kham_id` | `INTEGER` | FOREIGN KEY (`luot_kham.id`), NULLABLE | Lượt khám lâm sàng tương ứng (nếu có) |
| `thu_ngan_id` | `INTEGER` | FOREIGN KEY (`tai_khoan.id`), NULLABLE | Nhân viên thu ngân xử lý hóa đơn |
| `tong_tien` | `NUMERIC(14, 2)` | NOT NULL, DEFAULT 0 | Tổng tiền nguyên giá trước giảm trừ |
| `mien_giam` | `NUMERIC(14, 2)` | NOT NULL, DEFAULT 0 | Số tiền giảm giá, khuyến mại, chiết khấu |
| `thuc_thu` | `NUMERIC(14, 2)` | NOT NULL, DEFAULT 0 | Số tiền thực tế phải thu (`tong_tien - mien_giam`) |
| `phuong_thuc_thanh_toan` | `VARCHAR(30)` | NOT NULL, DEFAULT 'tien_mat' | `tien_mat`, `chuyen_khoan`, `the_pos`, `ket_hop` |
| `trang_thai` | `VARCHAR(30)` | NOT NULL, DEFAULT 'chua_thu' | `chua_thu`, `da_thu`, `da_huy`, `da_hoan_tien` |
| `ngay_thu` | `TIMESTAMP WITH TIME ZONE` | NULLABLE | Thời điểm thanh toán thành công |
| `ghi_chu` | `TEXT` | NULLABLE | Ghi chú thu ngân |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT NOW() | Thời điểm khởi tạo |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT NOW() | Thời điểm cập nhật cuối |

---

## 2. Bảng `chi_tiet_hoa_don` (Dòng Chi tiết Hóa đơn)

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ |
|---|---|---|---|
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Mã định danh dòng hóa đơn |
| `hoa_don_id` | `INTEGER` | FOREIGN KEY (`hoa_don.id`, CASCADE), NOT NULL | Thuộc hóa đơn nào |
| `loai_muc` | `VARCHAR(30)` | NOT NULL | `cong_kham`, `can_lam_sang`, `thuoc`, `thu_thuat` |
| `chi_dinh_dich_vu_id` | `INTEGER` | FOREIGN KEY (`chi_dinh_dich_vu.id`), NULLABLE | Liên kết chỉ định CLS tương ứng |
| `chi_tiet_don_thuoc_id` | `INTEGER` | FOREIGN KEY (`chi_tiet_don_thuoc.id`), NULLABLE | Liên kết chi tiết thuốc tương ứng |
| `ten_khoan_thu` | `VARCHAR(255)` | NOT NULL | Tên dịch vụ hoặc tên biệt dược |
| `don_vi_tinh` | `VARCHAR(50)` | NULLABLE | Lần, Viên, Lọ, Gói, Tuýp |
| `so_luong` | `NUMERIC(10, 2)` | NOT NULL, DEFAULT 1 | Số lượng sử dụng |
| `don_gia` | `NUMERIC(14, 2)` | NOT NULL | Đơn giá niêm yết tại thời điểm thu |
| `thanh_tien` | `NUMERIC(14, 2)` | NOT NULL | Thành tiền sau chiết khấu |

---

## 3. Mở rộng Bảng `chi_dinh_dich_vu` (Subclinical Orders Extensions)

| Tên Cột Bổ Sung | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ |
|---|---|---|---|
| `trang_thai_thuc_hien` | `VARCHAR(30)` | NOT NULL, DEFAULT 'cho_thanh_toan' | `cho_thanh_toan`, `da_thanh_toan`, `dang_thuc_hien`, `da_co_ket_qua`, `da_huy` |
| `phong_thuc_hien_id` | `INTEGER` | FOREIGN KEY (`phong_kham.id`), NULLABLE | Phòng kỹ thuật CLS được phân công thực hiện |
| `ky_thuat_vien_id` | `INTEGER` | FOREIGN KEY (`tai_khoan.id`), NULLABLE | Kỹ thuật viên phụ trách lấy mẫu/thực hiện |
| `thoi_gian_lay_mau` | `TIMESTAMP WITH TIME ZONE` | NULLABLE | Thời điểm lấy bệnh phẩm / bắt đầu chụp chiếu |
| `thoi_gian_tra_kq` | `TIMESTAMP WITH TIME ZONE` | NULLABLE | Thời điểm hoàn tất nhập kết quả CLS |

---

## 4. Bảng `luot_kham_the_luc` (Khám Chuyên khoa Sâu & Thể lực TT 32/2023)

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ |
|---|---|---|---|
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Mã định danh nội bộ |
| `luot_kham_id` | `INTEGER` | FOREIGN KEY (`luot_kham.id`, CASCADE), UNIQUE, NOT NULL | Liên kết 1-1 với phiên khám lâm sàng |
| `mat_phai_khong_kinh` | `VARCHAR(20)` | NULLABLE | Thị lực mắt phải (1/10 - 10/10) |
| `mat_trai_khong_kinh` | `VARCHAR(20)` | NULLABLE | Thị lực mắt trái (1/10 - 10/10) |
| `mat_phai_co_kinh` | `VARCHAR(20)` | NULLABLE | Thị lực mắt phải có kính |
| `mat_trai_co_kinh` | `VARCHAR(20)` | NULLABLE | Thị lực mắt trái có kính |
| `tai_mui_hong` | `TEXT` | NULLABLE | Khám tai, mũi, họng, thanh quản |
| `rang_ham_mat` | `TEXT` | NULLABLE | Khám răng, hàm, nướu |
| `tuan_hoan` | `TEXT` | NULLABLE | Tiếng tim, nhịp tim |
| `ho_hap` | `TEXT` | NULLABLE | Rì rào phế nang, tiếng rale |
| `tieu_hoa` | `TEXT` | NULLABLE | Gan, lách, điểm đau bụng |
| `than_tiet_nieu` | `TEXT` | NULLABLE | Chạm thận, bập bềnh thận |
| `than_kinh_tam_than` | `TEXT` | NULLABLE | Phản xạ thần kinh, trạng thái tâm lý |
| `co_xuong_khop` | `TEXT` | NULLABLE | Biên độ vận động khớp |
| `da_lieu` | `TEXT` | NULLABLE | Tình trạng tổn thương da, nấm da |
| `san_phu_khoa` | `TEXT` | NULLABLE | Khám phụ khoa (nếu bệnh nhân nữ) |
| `phan_loai_the_luc` | `VARCHAR(20)` | NULLABLE | `LOAI_1`, `LOAI_2`, `LOAI_3`, `LOAI_4`, `LOAI_5` |
| `ket_luan_suc_khoe` | `TEXT` | NULLABLE | Đủ sức khỏe làm việc / lái xe / học tập |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT NOW() | Thời điểm ghi nhận |

---

## 5. Chuẩn hóa Khám Bệnh & Kê Đơn theo Demo tClinic (Migration 007)

### 5.1 Bảng `luot_kham` (Bổ sung chỉ số lâm sàng & sinh hiệu)
| Tên Cột Bổ Sung | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ theo tClinic |
|---|---|---|---|
| `spo2` | `FLOAT` | NULLABLE | Nồng độ oxy bão hòa trong máu (%) |
| `bmi` | `FLOAT` | NULLABLE | Chỉ số khối cơ thể ($kg/m^2$) |
| `trieu_chung` | `TEXT` | NULLABLE | Triệu chứng cơ năng khi vào khám |
| `chan_doan_so_bo` | `TEXT` | NULLABLE | Chẩn đoán sơ bộ ban đầu của bác sĩ |
| `tien_su_di_ung` | `TEXT` | NULLABLE | Tiền sử dị ứng thuốc / thức ăn / hóa chất |
| `loi_dan_tai_kham` | `TEXT` | NULLABLE | Hướng dẫn chuyên biệt khi bệnh nhân quay lại tái khám |

### 5.2 Bảng `don_thuoc` (Bổ sung liệu trình tổng thể)
| Tên Cột Bổ Sung | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ theo tClinic |
|---|---|---|---|
| `so_ngay_dung` | `INTEGER` | NULLABLE, DEFAULT 1 | Tổng số ngày dùng thuốc của đơn |

### 5.3 Bảng `chi_tiet_don_thuoc` (Bổ sung liều 4 cữ chuẩn)
| Tên Cột Bổ Sung | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ theo tClinic |
|---|---|---|---|
| `lieu_sang` | `VARCHAR(50)` | NULLABLE | Liều lượng dùng buổi sáng (ví dụ: "1 viên", "5ml") |
| `lieu_trua` | `VARCHAR(50)` | NULLABLE | Liều lượng dùng buổi trưa |
| `lieu_chieu` | `VARCHAR(50)` | NULLABLE | Liều lượng dùng buổi chiều |
| `lieu_toi` | `VARCHAR(50)` | NULLABLE | Liều lượng dùng buổi tối |

### 5.4 Bảng `chi_dinh_dich_vu` (Bổ sung tài chính dịch vụ CLS)
| Tên Cột Bổ Sung | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ theo tClinic |
|---|---|---|---|
| `giam_gia` | `NUMERIC(14, 2)` | NOT NULL, DEFAULT 0 | Mức giảm trừ / chiết khấu trực tiếp trên dịch vụ |
| `thanh_tien` | `NUMERIC(14, 2)` | NULLABLE | Thành tiền dịch vụ sau giảm giá (`don_gia * so_luong - giam_gia`) |

---

## 6. Chuẩn hóa Khẩn cấp & Mã Đợt KCB theo tClinic (Migration 008)

### 6.1 Bảng `benh_nhan` (Thông tin thân nhân & liên hệ khẩn cấp)
| Tên Cột Bổ Sung | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ theo tClinic |
|---|---|---|---|
| `nguoi_lien_he` | `VARCHAR(100)` | NULLABLE | Họ tên thân nhân / người đưa đi khám (dành cho nhi & người cao tuổi) |
| `sdt_nguoi_lien_he` | `VARCHAR(20)` | NULLABLE | Số điện thoại liên hệ khẩn cấp của thân nhân |

### 6.2 Bảng `luot_kham` (Đồng bộ mã đợt khám chữa bệnh)
| Tên Cột Bổ Sung | Kiểu Dữ Liệu | Ràng Buộc / Thuộc Tính | Diễn Giải Nghiệp Vụ theo tClinic |
|---|---|---|---|
| `ma_kcb` | `VARCHAR(50)` | NULLABLE, INDEX | Mã đợt khám chữa bệnh thống nhất (Format: `KCB-YYMMDD-xxxx`) |

