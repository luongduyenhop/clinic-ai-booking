# BẢNG KIỂM KÊ TOÀN DIỆN CƠ SỞ DỮ LIỆU CLINIC-AI (CURRENT STATE - 45 BẢNG)

> **Thời điểm xuất:** Tự động sinh từ `Base.metadata` SQLAlchemy
> **Tổng số bảng:** 45 bảng | **Cơ chế:** PostgreSQL Relational Schema | **Mã hóa:** UTF-8

## 1. THỐNG KÊ TỔNG QUAN
- **Tổng số thực thể (Bảng):** 45
- **Tổng số trường dữ liệu (Cột):** 589
- **Tổng số quan hệ khóa ngoại (FK):** 82
- **Tổng số chỉ mục (Indexes):** 147
- **Chuỗi Migration Alembic:** 5 revision liên tục (`001` -> `005`)

## 2. PHÂN BỔ 5 PHÂN HỆ VÀ TRÁCH NHIỆM REVIEW
| Phân hệ | Số bảng | Trọng tâm nghiệp vụ | Người phụ trách |
| :--- | :--- | :--- | :--- |
| **1. Quản trị & Hệ thống** | 16 (6 core + 10 Phase 2) | BFF State, Audit Log TT32, Red Flags, Cổng tin tức, Khám đoàn | **Thành viên 1 (Hợp - Lead)** |
| **2. Tài khoản & Nhân sự** | 7 | Phân quyền RBAC, Bệnh nhân, Bác sĩ, Chứng chỉ CCHN, Phòng khám | **Thành viên 2 (Tùng)** |
| **3. Đặt lịch & Tiếp đón** | 8 | Lịch hẹn, Lịch bác sĩ, Hàng đợi ưu tiên P1-P5, AI Triage | **Thành viên 3 (Trọng)** |
| **4. Khám lâm sàng & EMR** | 6 | Lượt khám, Chẩn đoán ICD-10, Khóa bệnh án TT32, Đính chính 4 mắt | **Thành viên 4 (Hoàng)** |
| **5. CLS, Đơn thuốc & Viện phí** | 8 | Chỉ định CLS, Danh mục DV, Đơn thuốc 4 cữ, Hóa đơn, Thu chi, Ca trực | **Thành viên 5 (An)** |

---
## 3. CHI TIẾT CẤU TRÚC TỪNG BẢNG DỮ LIỆU

### 1. Phân hệ Quản trị & Hệ thống

#### 1. Bảng `nguoi_dung`
**Mô tả:** Thông tin định danh chung của mọi cá nhân (họ tên, sđt, cccd, email, địa chỉ)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ho_ten` | `varchar(150)` | NOT NULL |  | INDEX |
| 2 | `email` | `varchar(100)` | NULL |  | UNIQUE, INDEX |
| 3 | `so_dien_thoai` | `varchar(20)` | NULL |  | UNIQUE, INDEX |
| 4 | `ngay_sinh` | `date` | NULL |  | - |
| 5 | `gioi_tinh` | `varchar(10)` | NULL |  | - |
| 6 | `dia_chi` | `varchar(255)` | NULL |  | - |
| 7 | `cccd_so` | `varchar(20)` | NULL |  | UNIQUE |
| 8 | `is_deleted` | `boolean` | NOT NULL |  | - |
| 9 | `id` | `int` | NOT NULL | PK | - |
| 10 | `created_at` | `datetime` | NOT NULL |  | - |
| 11 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_nguoi_dung_id` (id); `ix_nguoi_dung_ho_ten` (ho_ten); `ix_nguoi_dung_email` (UNIQUE email); `ix_nguoi_dung_so_dien_thoai` (UNIQUE so_dien_thoai)

---

#### 2. Bảng `tai_khoan`
**Mô tả:** Tài khoản bảo mật, thông tin đăng nhập, vai trò RBAC, hash mật khẩu và token

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `nguoi_dung_id` | `int` | NOT NULL |  | FK -> `nguoi_dung.id` | UNIQUE |
| 2 | `email` | `varchar(100)` | NOT NULL |  | UNIQUE, INDEX |
| 3 | `mat_khau_hash` | `varchar(255)` | NOT NULL |  | - |
| 4 | `vai_tro` | `varchar(20)` | NOT NULL |  | - |
| 5 | `is_active` | `boolean` | NOT NULL |  | - |
| 6 | `otp_code` | `varchar(10)` | NULL |  | - |
| 7 | `otp_expired_at` | `datetime` | NULL |  | - |
| 8 | `last_login_at` | `datetime` | NULL |  | - |
| 9 | `refresh_token` | `varchar(255)` | NULL |  | UNIQUE, INDEX |
| 10 | `refresh_token_expired_at` | `datetime` | NULL |  | - |
| 11 | `id` | `int` | NOT NULL | PK | - |
| 12 | `created_at` | `datetime` | NOT NULL |  | - |
| 13 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_tai_khoan_refresh_token` (UNIQUE refresh_token); `ix_tai_khoan_email` (UNIQUE email); `ix_tai_khoan_id` (id)

---

#### 3. Bảng `he_thong_trang_thai_bff`
**Mô tả:** Lưu trữ trạng thái tiến trình giao dịch nghiệp vụ phía Backend For Frontend

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `collection_key` | `varchar(100)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `data_json` | `json` | NOT NULL |  | - |
| 3 | `updated_by_id` | `int` | NULL |  | - |
| 4 | `id` | `int` | NOT NULL | PK | - |
| 5 | `created_at` | `datetime` | NOT NULL |  | - |
| 6 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_he_thong_trang_thai_bff_collection_key` (UNIQUE collection_key); `ix_he_thong_trang_thai_bff_id` (id)

---

#### 4. Bảng `nhat_ky_truy_cap_y_te`
**Mô tả:** Audit log ghi vết truy cập và thay đổi dữ liệu bệnh án theo chuẩn an toàn TT32

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `user_id` | `int` | NOT NULL |  | INDEX |
| 2 | `user_role` | `varchar(50)` | NOT NULL |  | - |
| 3 | `patient_id` | `int` | NOT NULL |  | INDEX |
| 4 | `action` | `varchar(50)` | NOT NULL |  | - |
| 5 | `resource_type` | `varchar(50)` | NOT NULL |  | - |
| 6 | `resource_id` | `int` | NULL |  | - |
| 7 | `purpose` | `varchar(255)` | NOT NULL |  | - |
| 8 | `client_ip` | `varchar(50)` | NULL |  | - |
| 9 | `timestamp` | `datetime` | NOT NULL |  | - |
| 10 | `id` | `int` | NOT NULL | PK | - |
| 11 | `created_at` | `datetime` | NOT NULL |  | - |
| 12 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_nhat_ky_truy_cap_y_te_id` (id); `ix_nhat_ky_truy_cap_y_te_user_id` (user_id); `ix_nhat_ky_truy_cap_y_te_patient_id` (patient_id)

---

#### 5. Bảng `tu_khoa_cap_cuu`
**Mô tả:** Từ điển từ khóa triệu chứng nguy cấp (Red flags) phục vụ AI Triage cảnh báo khẩn

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `tu_khoa` | `varchar(100)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `muc_do_nguy_hiem` | `varchar(30)` | NOT NULL |  | - |
| 3 | `huong_dan_xu_tri` | `varchar(255)` | NOT NULL |  | - |
| 4 | `van_ban_byt_ref` | `varchar(150)` | NULL |  | - |
| 5 | `ngay_ban_hanh` | `date` | NULL |  | - |
| 6 | `is_active` | `boolean` | NOT NULL |  | - |
| 7 | `id` | `int` | NOT NULL | PK | - |
| 8 | `created_at` | `datetime` | NOT NULL |  | - |
| 9 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_tu_khoa_cap_cuu_id` (id); `ix_tu_khoa_cap_cuu_tu_khoa` (UNIQUE tu_khoa)

---

#### 6. Bảng `thong_bao`
**Mô tả:** Hệ thống tin nhắn/thông báo đẩy cho bệnh nhân và nhân viên y tế

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `tai_khoan_id` | `int` | NOT NULL |  | FK -> `tai_khoan.id` | INDEX |
| 2 | `tieu_de` | `varchar(255)` | NOT NULL |  | - |
| 3 | `noi_dung` | `text` | NOT NULL |  | - |
| 4 | `loai_thong_bao` | `varchar(50)` | NOT NULL |  | - |
| 5 | `lien_ket_url` | `varchar(255)` | NULL |  | - |
| 6 | `du_lieu_phu_json` | `json` | NULL |  | - |
| 7 | `da_doc` | `boolean` | NOT NULL |  | INDEX |
| 8 | `thoi_gian_doc` | `datetime` | NULL |  | - |
| 9 | `id` | `int` | NOT NULL | PK | - |
| 10 | `created_at` | `datetime` | NOT NULL |  | - |
| 11 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_thong_bao_da_doc` (da_doc); `ix_thong_bao_tai_khoan_id` (tai_khoan_id); `ix_thong_bao_id` (id)

---

#### 7. Bảng `hop_dong_kham_doan`
**Mô tả:** [Phase 2] Hợp đồng khám sức khỏe định kỳ cho doanh nghiệp/cơ quan

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_hop_dong` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_cong_ty` | `varchar(255)` | NOT NULL |  | INDEX |
| 3 | `ma_so_thue` | `varchar(50)` | NULL |  | - |
| 4 | `nguoi_dai_dien` | `varchar(150)` | NOT NULL |  | - |
| 5 | `so_dien_thoai` | `varchar(30)` | NOT NULL |  | - |
| 6 | `so_luong_nhan_vien` | `int` | NOT NULL |  | - |
| 7 | `ngay_bat_dau` | `date` | NOT NULL |  | - |
| 8 | `ngay_ket_thuc` | `date` | NOT NULL |  | - |
| 9 | `gia_tri_hop_dong` | `numeric(15, 2)` | NOT NULL |  | - |
| 10 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 11 | `ghi_chu` | `text` | NULL |  | - |
| 12 | `id` | `int` | NOT NULL | PK | - |
| 13 | `created_at` | `datetime` | NOT NULL |  | - |
| 14 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_hop_dong_kham_doan_id` (id); `ix_hop_dong_kham_doan_ma_hop_dong` (UNIQUE ma_hop_dong); `ix_hop_dong_kham_doan_ten_cong_ty` (ten_cong_ty)

---

#### 8. Bảng `nhan_vien_kham_doan`
**Mô tả:** [Phase 2] Danh sách nhân sự thuộc đoàn khám sức khỏe doanh nghiệp

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `hop_dong_id` | `int` | NOT NULL |  | FK -> `hop_dong_kham_doan.id` | INDEX |
| 2 | `ma_nhan_vien` | `varchar(50)` | NOT NULL |  | - |
| 3 | `ho_ten` | `varchar(150)` | NOT NULL |  | INDEX |
| 4 | `ngay_sinh` | `date` | NULL |  | - |
| 5 | `gioi_tinh` | `varchar(10)` | NULL |  | - |
| 6 | `phong_ban` | `varchar(100)` | NULL |  | - |
| 7 | `so_dien_thoai` | `varchar(30)` | NULL |  | - |
| 8 | `cccd_so` | `varchar(20)` | NULL |  | - |
| 9 | `benh_nhan_id` | `int` | NULL |  | FK -> `benh_nhan.id` |
| 10 | `phan_loai_suc_khoe` | `varchar(20)` | NULL |  | - |
| 11 | `trang_thai_kham` | `varchar(30)` | NOT NULL |  | - |
| 12 | `ket_luan` | `text` | NULL |  | - |
| 13 | `id` | `int` | NOT NULL | PK | - |
| 14 | `created_at` | `datetime` | NOT NULL |  | - |
| 15 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_nhan_vien_kham_doan_ho_ten` (ho_ten); `ix_nhan_vien_kham_doan_hop_dong_id` (hop_dong_id); `ix_nhan_vien_kham_doan_id` (id)

---

#### 9. Bảng `goi_dich_vu`
**Mô tả:** [Phase 2] Danh mục gói khám sức khỏe tổng quát, tầm soát chuyên sâu

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_goi` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_goi` | `varchar(255)` | NOT NULL |  | INDEX |
| 3 | `chuyen_khoa_chinh_id` | `int` | NULL |  | FK -> `chuyen_khoa.id` |
| 4 | `doi_tuong_ap_dung` | `varchar(100)` | NOT NULL |  | - |
| 5 | `don_gia_niem_yet` | `numeric(15, 2)` | NOT NULL |  | - |
| 6 | `don_gia_khuyen_mai` | `numeric(15, 2)` | NOT NULL |  | - |
| 7 | `mo_ta` | `text` | NULL |  | - |
| 8 | `is_active` | `boolean` | NOT NULL |  | - |
| 9 | `id` | `int` | NOT NULL | PK | - |
| 10 | `created_at` | `datetime` | NOT NULL |  | - |
| 11 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_goi_dich_vu_ma_goi` (UNIQUE ma_goi); `ix_goi_dich_vu_id` (id); `ix_goi_dich_vu_ten_goi` (ten_goi)

---

#### 10. Bảng `chi_tiet_goi_dich_vu`
**Mô tả:** [Phase 2] Danh sách các dịch vụ thành phần nằm trong gói khám

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `goi_dich_vu_id` | `int` | NOT NULL |  | FK -> `goi_dich_vu.id` | INDEX |
| 2 | `dich_vu_id` | `int` | NOT NULL |  | FK -> `dich_vu.id` |
| 3 | `so_luong` | `int` | NOT NULL |  | - |
| 4 | `ghi_chu` | `text` | NULL |  | - |
| 5 | `id` | `int` | NOT NULL | PK | - |
| 6 | `created_at` | `datetime` | NOT NULL |  | - |
| 7 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_chi_tiet_goi_dich_vu_id` (id); `ix_chi_tiet_goi_dich_vu_goi_dich_vu_id` (goi_dich_vu_id)

---

#### 11. Bảng `dang_ky_goi_kham`
**Mô tả:** [Phase 2] Hợp đồng mua gói dịch vụ khám của bệnh nhân

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_dang_ky` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `benh_nhan_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` | INDEX |
| 3 | `goi_dich_vu_id` | `int` | NOT NULL |  | FK -> `goi_dich_vu.id` | INDEX |
| 4 | `ngay_dang_ky` | `date` | NOT NULL |  | - |
| 5 | `han_su_dung` | `date` | NOT NULL |  | - |
| 6 | `tong_so_dich_vu` | `int` | NOT NULL |  | - |
| 7 | `so_dich_vu_da_dung` | `int` | NOT NULL |  | - |
| 8 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 9 | `id` | `int` | NOT NULL | PK | - |
| 10 | `created_at` | `datetime` | NOT NULL |  | - |
| 11 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_dang_ky_goi_kham_id` (id); `ix_dang_ky_goi_kham_ma_dang_ky` (UNIQUE ma_dang_ky); `ix_dang_ky_goi_kham_goi_dich_vu_id` (goi_dich_vu_id); `ix_dang_ky_goi_kham_benh_nhan_id` (benh_nhan_id)

---

#### 12. Bảng `lieu_trinh_dieu_tri`
**Mô tả:** [Phase 2] Kế hoạch điều trị dài ngày (Vật lý trị liệu, nha khoa, phục hồi chức năng)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_lieu_trinh` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_lieu_trinh` | `varchar(255)` | NOT NULL |  | - |
| 3 | `benh_nhan_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` | INDEX |
| 4 | `bac_si_phu_trach_id` | `int` | NOT NULL |  | FK -> `bac_si.id` |
| 5 | `tong_so_buoi` | `int` | NOT NULL |  | - |
| 6 | `so_buoi_da_thuc_hien` | `int` | NOT NULL |  | - |
| 7 | `ngay_bat_dau` | `date` | NOT NULL |  | - |
| 8 | `ngay_du_kien_ket_thuc` | `date` | NULL |  | - |
| 9 | `muc_tieu_dieu_tri` | `text` | NULL |  | - |
| 10 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 11 | `id` | `int` | NOT NULL | PK | - |
| 12 | `created_at` | `datetime` | NOT NULL |  | - |
| 13 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_lieu_trinh_dieu_tri_ma_lieu_trinh` (UNIQUE ma_lieu_trinh); `ix_lieu_trinh_dieu_tri_benh_nhan_id` (benh_nhan_id); `ix_lieu_trinh_dieu_tri_id` (id)

---

#### 13. Bảng `buoi_dieu_tri`
**Mô tả:** [Phase 2] Từng buổi thực hiện thủ thuật trong liệu trình điều trị

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `lieu_trinh_id` | `int` | NOT NULL |  | FK -> `lieu_trinh_dieu_tri.id` | INDEX |
| 2 | `so_thu_tu_buoi` | `int` | NOT NULL |  | - |
| 3 | `ngay_thuc_hien` | `datetime` | NOT NULL |  | - |
| 4 | `ky_thuat_vien_id` | `int` | NULL |  | FK -> `nguoi_dung.id` |
| 5 | `noi_dung_thuc_hien` | `text` | NULL |  | - |
| 6 | `danh_gia_tien_trien` | `text` | NULL |  | - |
| 7 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 8 | `id` | `int` | NOT NULL | PK | - |
| 9 | `created_at` | `datetime` | NOT NULL |  | - |
| 10 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_buoi_dieu_tri_id` (id); `ix_buoi_dieu_tri_lieu_trinh_id` (lieu_trinh_id)

---

#### 14. Bảng `bai_viet_tin_tuc`
**Mô tả:** [Phase 2] Bài viết cẩm nang y tế, tin tức sức khỏe phòng khám

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `tieu_de` | `varchar(255)` | NOT NULL |  | INDEX |
| 2 | `slug` | `varchar(255)` | NOT NULL |  | UNIQUE, INDEX |
| 3 | `chuyen_muc` | `varchar(50)` | NOT NULL |  | INDEX |
| 4 | `anh_dai_dien_url` | `varchar(500)` | NULL |  | - |
| 5 | `tom_tat` | `text` | NULL |  | - |
| 6 | `noi_dung_html` | `text` | NOT NULL |  | - |
| 7 | `tac_gia` | `varchar(150)` | NOT NULL |  | - |
| 8 | `luot_xem` | `int` | NOT NULL |  | - |
| 9 | `is_published` | `boolean` | NOT NULL |  | - |
| 10 | `id` | `int` | NOT NULL | PK | - |
| 11 | `created_at` | `datetime` | NOT NULL |  | - |
| 12 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_bai_viet_tin_tuc_id` (id); `ix_bai_viet_tin_tuc_slug` (UNIQUE slug); `ix_bai_viet_tin_tuc_chuyen_muc` (chuyen_muc); `ix_bai_viet_tin_tuc_tieu_de` (tieu_de)

---

#### 15. Bảng `cau_hoi_y_khoa`
**Mô tả:** [Phase 2] Cổng hỏi đáp sức khỏe trực tuyến bác sĩ - bệnh nhân

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `tieu_de` | `varchar(255)` | NOT NULL |  | INDEX |
| 2 | `chuyen_muc` | `varchar(50)` | NOT NULL |  | INDEX |
| 3 | `cau_hoi` | `text` | NOT NULL |  | - |
| 4 | `cau_tra_loi` | `text` | NULL |  | - |
| 5 | `bac_si_tra_loi_id` | `int` | NULL |  | FK -> `bac_si.id` |
| 6 | `luot_xem` | `int` | NOT NULL |  | - |
| 7 | `is_published` | `boolean` | NOT NULL |  | - |
| 8 | `id` | `int` | NOT NULL | PK | - |
| 9 | `created_at` | `datetime` | NOT NULL |  | - |
| 10 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_cau_hoi_y_khoa_tieu_de` (tieu_de); `ix_cau_hoi_y_khoa_id` (id); `ix_cau_hoi_y_khoa_chuyen_muc` (chuyen_muc)

---

#### 16. Bảng `danh_gia_dich_vu`
**Mô tả:** [Phase 2] Khảo sát sự hài lòng của bệnh nhân sau khi kết thúc lượt khám

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `luot_kham_id` | `int` | NOT NULL |  | FK -> `luot_kham.id` | UNIQUE, INDEX |
| 2 | `benh_nhan_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` | INDEX |
| 3 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` | INDEX |
| 4 | `so_sao_bac_si` | `int` | NOT NULL |  | - |
| 5 | `so_sao_phong_kham` | `int` | NOT NULL |  | - |
| 6 | `tieu_chi_hai_long` | `json` | NULL |  | - |
| 7 | `nhan_xet` | `text` | NULL |  | - |
| 8 | `an_danh` | `boolean` | NOT NULL |  | - |
| 9 | `id` | `int` | NOT NULL | PK | - |
| 10 | `created_at` | `datetime` | NOT NULL |  | - |
| 11 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_danh_gia_dich_vu_bac_si_id` (bac_si_id); `ix_danh_gia_dich_vu_luot_kham_id` (UNIQUE luot_kham_id); `ix_danh_gia_dich_vu_id` (id); `ix_danh_gia_dich_vu_benh_nhan_id` (benh_nhan_id)

---

### 2. Phân hệ Tài khoản, Nhân sự & Cơ sở y tế

#### 17. Bảng `benh_nhan`
**Mô tả:** Hồ sơ y tế bệnh nhân (mã định danh y tế BN, nhóm máu, tiền sử dị ứng, BHYT)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `nguoi_dung_id` | `int` | NOT NULL |  | FK -> `nguoi_dung.id` | UNIQUE |
| 2 | `ma_dinh_danh_y_te` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 3 | `nhom_mau` | `varchar(10)` | NULL |  | - |
| 4 | `tien_su_benh` | `text` | NULL |  | - |
| 5 | `di_ung_thuoc` | `text` | NULL |  | - |
| 6 | `diem_tin_nhiem` | `int` | NOT NULL |  | - |
| 7 | `so_lan_no_show` | `int` | NOT NULL |  | - |
| 8 | `is_blocked_booking` | `boolean` | NOT NULL |  | - |
| 9 | `id` | `int` | NOT NULL | PK | - |
| 10 | `created_at` | `datetime` | NOT NULL |  | - |
| 11 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_benh_nhan_id` (id); `ix_benh_nhan_ma_dinh_danh_y_te` (UNIQUE ma_dinh_danh_y_te)

---

#### 18. Bảng `bac_si`
**Mô tả:** Thông tin bác sĩ (chứng chỉ hành nghề, học vị, chuyên khoa, số năm kinh nghiệm)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `nguoi_dung_id` | `int` | NOT NULL |  | FK -> `nguoi_dung.id` | UNIQUE |
| 2 | `chuyen_khoa_id` | `int` | NULL |  | FK -> `chuyen_khoa.id` |
| 3 | `hoc_vi` | `varchar(50)` | NOT NULL |  | - |
| 4 | `chung_chi_hanh_nghe` | `varchar(100)` | NOT NULL |  | UNIQUE |
| 5 | `nam_kinh_nghiem` | `int` | NOT NULL |  | - |
| 6 | `mo_ta_chuyen_sau` | `text` | NULL |  | - |
| 7 | `gia_kham_mac_dinh` | `numeric(12, 2)` | NOT NULL |  | - |
| 8 | `phong_kham_id` | `int` | NULL |  | FK -> `phong_kham.id` | INDEX |
| 9 | `is_active` | `boolean` | NOT NULL |  | - |
| 10 | `ngay_cap` | `datetime` | NULL |  | - |
| 11 | `ngay_het_han` | `datetime` | NULL |  | INDEX |
| 12 | `pham_vi_chuyen_mon` | `json` | NULL |  | - |
| 13 | `trang_thai_giay_phep` | `varchar(50)` | NOT NULL |  | INDEX |
| 14 | `tep_dinh_kem_url` | `varchar(500)` | NULL |  | - |
| 15 | `id` | `int` | NOT NULL | PK | - |
| 16 | `created_at` | `datetime` | NOT NULL |  | - |
| 17 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_bac_si_ngay_het_han` (ngay_het_han); `ix_bac_si_id` (id); `ix_bac_si_phong_kham_id` (phong_kham_id); `ix_bac_si_trang_thai_giay_phep` (trang_thai_giay_phep)

---

#### 19. Bảng `ho_so_nguoi_than`
**Mô tả:** Mối quan hệ bảo hộ/người thân của bệnh nhân (bố mẹ, vợ chồng, người giám hộ)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `benh_nhan_chinh_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` | INDEX |
| 2 | `ho_ten` | `varchar(150)` | NOT NULL |  | INDEX |
| 3 | `quan_he` | `varchar(50)` | NOT NULL |  | - |
| 4 | `ngay_sinh` | `date` | NOT NULL |  | - |
| 5 | `gioi_tinh` | `varchar(10)` | NOT NULL |  | - |
| 6 | `so_dien_thoai` | `varchar(20)` | NULL |  | - |
| 7 | `cccd_so` | `varchar(20)` | NULL |  | - |
| 8 | `tien_su_benh` | `text` | NULL |  | - |
| 9 | `di_ung_thuoc` | `text` | NULL |  | - |
| 10 | `nhom_mau` | `varchar(10)` | NULL |  | - |
| 11 | `ghi_chu` | `text` | NULL |  | - |
| 12 | `id` | `int` | NOT NULL | PK | - |
| 13 | `created_at` | `datetime` | NOT NULL |  | - |
| 14 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_ho_so_nguoi_than_ho_ten` (ho_ten); `ix_ho_so_nguoi_than_benh_nhan_chinh_id` (benh_nhan_chinh_id); `ix_ho_so_nguoi_than_id` (id)

---

#### 20. Bảng `chuyen_khoa`
**Mô tả:** Danh mục chuyên khoa y tế (Nội, Ngoại, Nhi, Sản, Mắt, Tai Mũi Họng, v.v.)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_chuyen_khoa` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_chuyen_khoa` | `varchar(100)` | NOT NULL |  | UNIQUE, INDEX |
| 3 | `mo_ta` | `text` | NULL |  | - |
| 4 | `vi_tri_phong` | `varchar(50)` | NULL |  | - |
| 5 | `is_active` | `boolean` | NOT NULL |  | - |
| 6 | `id` | `int` | NOT NULL | PK | - |
| 7 | `created_at` | `datetime` | NOT NULL |  | - |
| 8 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_chuyen_khoa_id` (id); `ix_chuyen_khoa_ma_chuyen_khoa` (UNIQUE ma_chuyen_khoa); `ix_chuyen_khoa_ten_chuyen_khoa` (UNIQUE ten_chuyen_khoa)

---

#### 21. Bảng `phong_kham`
**Mô tả:** Phòng khám vật lý, vị trí tầng, loại phòng (khám, thủ thuật, xét nghiệm)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_phong` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_phong` | `varchar(100)` | NOT NULL |  | - |
| 3 | `chuyen_khoa_id` | `int` | NULL |  | FK -> `chuyen_khoa.id` | INDEX |
| 4 | `tang` | `varchar(20)` | NOT NULL |  | - |
| 5 | `loai_phong` | `varchar(30)` | NOT NULL |  | - |
| 6 | `thiet_bi_chinh` | `text` | NULL |  | - |
| 7 | `is_active` | `boolean` | NOT NULL |  | - |
| 8 | `id` | `int` | NOT NULL | PK | - |
| 9 | `created_at` | `datetime` | NOT NULL |  | - |
| 10 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_phong_kham_chuyen_khoa_id` (chuyen_khoa_id); `ix_phong_kham_ma_phong` (UNIQUE ma_phong); `ix_phong_kham_id` (id)

---

#### 22. Bảng `giay_phep_co_so`
**Mô tả:** Giấy phép hoạt động khám chữa bệnh của cơ sở y tế theo quy định Bộ Y tế

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `so_giay_phep` | `varchar(100)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_co_so` | `varchar(255)` | NOT NULL |  | - |
| 3 | `ngay_cap` | `datetime` | NOT NULL |  | - |
| 4 | `ngay_het_han` | `datetime` | NULL |  | INDEX |
| 5 | `pham_vi_hoat_dong` | `text` | NULL |  | - |
| 6 | `trang_thai` | `varchar(50)` | NOT NULL |  | INDEX |
| 7 | `tep_dinh_kem_url` | `varchar(500)` | NULL |  | - |
| 8 | `ghi_chu` | `text` | NULL |  | - |
| 9 | `id` | `int` | NOT NULL | PK | - |
| 10 | `created_at` | `datetime` | NOT NULL |  | - |
| 11 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_giay_phep_co_so_id` (id); `ix_giay_phep_co_so_trang_thai` (trang_thai); `ix_giay_phep_co_so_ngay_het_han` (ngay_het_han); `ix_giay_phep_co_so_so_giay_phep` (UNIQUE so_giay_phep)

---

#### 23. Bảng `lich_su_giay_phep_bac_si`
**Mô tả:** Lịch sử cấp đổi, đình chỉ hoặc gia hạn chứng chỉ hành nghề của bác sĩ

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` | INDEX |
| 2 | `trang_thai_cu` | `varchar(50)` | NULL |  | - |
| 3 | `trang_thai_moi` | `varchar(50)` | NOT NULL |  | - |
| 4 | `nguoi_thuc_hien_id` | `int` | NULL |  | FK -> `tai_khoan.id` |
| 5 | `ly_do` | `text` | NOT NULL |  | - |
| 6 | `ngay_hieu_luc` | `datetime` | NOT NULL |  | - |
| 7 | `ghi_chu` | `text` | NULL |  | - |
| 8 | `id` | `int` | NOT NULL | PK | - |
| 9 | `created_at` | `datetime` | NOT NULL |  | - |
| 10 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_lich_su_giay_phep_bac_si_id` (id); `ix_lich_su_giay_phep_bac_si_bac_si_id` (bac_si_id)

---

### 3. Phân hệ Đặt lịch & Tiếp đón (Scheduling & Queuing)

#### 24. Bảng `lich_kham`
**Mô tả:** Phiếu hẹn khám (ngày hẹn, khung giờ, triệu chứng ban đầu, trạng thái hẹn, kênh đặt)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_lich_kham` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `benh_nhan_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` | INDEX |
| 3 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` | INDEX |
| 4 | `ngay_kham` | `date` | NOT NULL |  | INDEX |
| 5 | `gio_kham` | `time` | NOT NULL |  | INDEX |
| 6 | `thoi_luong_phut` | `int` | NOT NULL |  | - |
| 7 | `so_thu_tu` | `int` | NOT NULL |  | - |
| 8 | `ly_do_kham` | `varchar(255)` | NULL |  | - |
| 9 | `trieu_chung_ban_dau` | `text` | NULL |  | - |
| 10 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 11 | `is_reconfirmed_24h` | `boolean` | NOT NULL |  | - |
| 12 | `thoi_gian_xac_nhan` | `datetime` | NULL |  | - |
| 13 | `thoi_gian_huy` | `datetime` | NULL |  | - |
| 14 | `ly_do_huy` | `text` | NULL |  | - |
| 15 | `nguoi_huy_vai_tro` | `varchar(20)` | NULL |  | - |
| 16 | `id` | `int` | NOT NULL | PK | - |
| 17 | `created_at` | `datetime` | NOT NULL |  | - |
| 18 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `uq_active_doctor_slot` (UNIQUE bac_si_id, ngay_kham, gio_kham); `ix_lich_kham_ngay_kham` (ngay_kham); `ix_lich_kham_id` (id); `idx_lich_kham_benh_nhan` (benh_nhan_id, ngay_kham); `ix_doctor_schedule_date` (bac_si_id, ngay_kham); `uq_active_patient_slot` (UNIQUE benh_nhan_id, ngay_kham, gio_kham); `ix_lich_kham_gio_kham` (gio_kham); `ix_lich_kham_bac_si_id` (bac_si_id); `ix_lich_kham_ma_lich_kham` (UNIQUE ma_lich_kham); `ix_lich_kham_benh_nhan_id` (benh_nhan_id)

---

#### 25. Bảng `lich_lam_viec`
**Mô tả:** Ca làm việc của bác sĩ theo ngày (Sáng, Chiều, Tối), số slot tối đa và slot đã đặt

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` | INDEX |
| 2 | `ngay_lam_viec` | `date` | NOT NULL |  | INDEX |
| 3 | `ca_lam_viec` | `varchar(20)` | NOT NULL |  | - |
| 4 | `gio_bat_dau` | `time` | NOT NULL |  | - |
| 5 | `gio_ket_thuc` | `time` | NOT NULL |  | - |
| 6 | `gioi_han_ca_kham` | `int` | NOT NULL |  | - |
| 7 | `phong_kham_id` | `int` | NULL |  | FK -> `phong_kham.id` | INDEX |
| 8 | `han_muc_dat_truoc` | `int` | NOT NULL |  | - |
| 9 | `han_muc_vang_lai` | `int` | NOT NULL |  | - |
| 10 | `is_active` | `boolean` | NOT NULL |  | - |
| 11 | `ghi_chu_nghi` | `text` | NULL |  | - |
| 12 | `id` | `int` | NOT NULL | PK | - |
| 13 | `created_at` | `datetime` | NOT NULL |  | - |
| 14 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_lich_lam_viec_bac_si_id` (bac_si_id); `ix_lich_lam_viec_id` (id); `uq_room_shift` (UNIQUE phong_kham_id, ngay_lam_viec, ca_lam_viec); `ix_lich_lam_viec_phong_kham_id` (phong_kham_id); `ix_lich_lam_viec_ngay_lam_viec` (ngay_lam_viec)

---

#### 26. Bảng `hang_doi_kham`
**Mô tả:** Hàng đợi tiếp đón tại phòng khám theo 5 bậc ưu tiên (P1 cấp cứu -> P5 thông thường)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `lich_kham_id` | `int` | NULL |  | FK -> `lich_kham.id` | INDEX |
| 2 | `benh_nhan_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` | INDEX |
| 3 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` | INDEX |
| 4 | `ngay_kham` | `date` | NOT NULL |  | INDEX |
| 5 | `ca_kham` | `varchar(20)` | NOT NULL |  | - |
| 6 | `so_thu_tu_kham` | `int` | NOT NULL |  | - |
| 7 | `loai_hang_doi` | `varchar(30)` | NOT NULL |  | - |
| 8 | `muc_do_uu_tien` | `int` | NOT NULL |  | INDEX |
| 9 | `trang_thai` | `varchar(30)` | NOT NULL |  | INDEX |
| 10 | `thoi_gian_check_in` | `datetime` | NOT NULL |  | - |
| 11 | `thoi_gian_goi_kham` | `datetime` | NULL |  | - |
| 12 | `thoi_gian_bat_dau` | `datetime` | NULL |  | - |
| 13 | `thoi_gian_ket_thuc` | `datetime` | NULL |  | - |
| 14 | `so_lan_goi` | `int` | NOT NULL |  | - |
| 15 | `nguoi_tiep_nhan_id` | `int` | NULL |  | FK -> `tai_khoan.id` |
| 16 | `ghi_chu_dieu_phoi` | `text` | NULL |  | - |
| 17 | `id` | `int` | NOT NULL | PK | - |
| 18 | `created_at` | `datetime` | NOT NULL |  | - |
| 19 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_hang_doi_kham_lich_kham_id` (lich_kham_id); `ix_hang_doi_kham_ngay_kham` (ngay_kham); `ix_hang_doi_kham_id` (id); `idx_queue_doctor_date_status` (bac_si_id, ngay_kham, trang_thai, muc_do_uu_tien); `ix_hang_doi_kham_benh_nhan_id` (benh_nhan_id); `ix_hang_doi_kham_trang_thai` (trang_thai); `ix_hang_doi_kham_muc_do_uu_tien` (muc_do_uu_tien); `ix_hang_doi_kham_bac_si_id` (bac_si_id)

---

#### 27. Bảng `danh_sach_cho`
**Mô tả:** Hàng đợi chờ slot hủy (Waitlist) khi ca khám đã kín chỗ

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `benh_nhan_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` | INDEX |
| 2 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` | INDEX |
| 3 | `ngay_mong_muon` | `date` | NOT NULL |  | INDEX |
| 4 | `ca_mong_muon` | `varchar(20)` | NOT NULL |  | - |
| 5 | `trieu_chung` | `text` | NULL |  | - |
| 6 | `thu_tu_uu_tien` | `int` | NOT NULL |  | - |
| 7 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 8 | `thoi_gian_thong_bao` | `datetime` | NULL |  | - |
| 9 | `thoi_gian_het_han_giu_slot` | `datetime` | NULL |  | - |
| 10 | `slot_duoc_cap_id` | `int` | NULL |  | FK -> `lich_kham.id` |
| 11 | `id` | `int` | NOT NULL | PK | - |
| 12 | `created_at` | `datetime` | NOT NULL |  | - |
| 13 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_danh_sach_cho_bac_si_id` (bac_si_id); `ix_danh_sach_cho_ngay_mong_muon` (ngay_mong_muon); `ix_danh_sach_cho_benh_nhan_id` (benh_nhan_id); `ix_danh_sach_cho_id` (id)

---

#### 28. Bảng `lich_dinh_ky_bac_si`
**Mô tả:** Mẫu lịch làm việc định kỳ hàng tuần của bác sĩ để tự động sinh lịch

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` | INDEX |
| 2 | `thu_trong_tuan` | `int` | NOT NULL |  | INDEX |
| 3 | `ca_lam_viec` | `varchar(20)` | NOT NULL |  | - |
| 4 | `gio_bat_dau` | `time` | NOT NULL |  | - |
| 5 | `gio_ket_thuc` | `time` | NOT NULL |  | - |
| 6 | `phong_kham_id` | `int` | NULL |  | FK -> `phong_kham.id` | INDEX |
| 7 | `thoi_luong_slot_phut` | `int` | NOT NULL |  | - |
| 8 | `gioi_han_ca_kham` | `int` | NOT NULL |  | - |
| 9 | `han_muc_dat_truoc` | `int` | NOT NULL |  | - |
| 10 | `han_muc_vang_lai` | `int` | NOT NULL |  | - |
| 11 | `is_active` | `boolean` | NOT NULL |  | - |
| 12 | `id` | `int` | NOT NULL | PK | - |
| 13 | `created_at` | `datetime` | NOT NULL |  | - |
| 14 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_lich_dinh_ky_bac_si_id` (id); `ix_lich_dinh_ky_bac_si_thu_trong_tuan` (thu_trong_tuan); `ix_lich_dinh_ky_bac_si_phong_kham_id` (phong_kham_id); `ix_lich_dinh_ky_bac_si_bac_si_id` (bac_si_id)

---

#### 29. Bảng `nghi_phep_bac_si`
**Mô tả:** Đăng ký nghỉ phép của bác sĩ để khóa slot và tự động điều phối lịch khám

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` | INDEX |
| 2 | `loai_nghi` | `varchar(30)` | NOT NULL |  | - |
| 3 | `tu_ngay` | `date` | NOT NULL |  | INDEX |
| 4 | `den_ngay` | `date` | NOT NULL |  | INDEX |
| 5 | `ca_lam_viec` | `varchar(20)` | NULL |  | - |
| 6 | `ly_do` | `text` | NOT NULL |  | - |
| 7 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 8 | `nguoi_duyet_id` | `int` | NULL |  | FK -> `tai_khoan.id` |
| 9 | `ghi_chu_duyet` | `text` | NULL |  | - |
| 10 | `so_ca_anh_huong` | `int` | NOT NULL |  | - |
| 11 | `so_lich_anh_huong` | `int` | NOT NULL |  | - |
| 12 | `id` | `int` | NOT NULL | PK | - |
| 13 | `created_at` | `datetime` | NOT NULL |  | - |
| 14 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_nghi_phep_bac_si_tu_ngay` (tu_ngay); `ix_nghi_phep_bac_si_id` (id); `ix_nghi_phep_bac_si_bac_si_id` (bac_si_id); `ix_nghi_phep_bac_si_den_ngay` (den_ngay)

---

#### 30. Bảng `phan_tich_ai`
**Mô tả:** Kết quả phân tích triệu chứng AI Triage, gợi ý chuyên khoa, độ khẩn cấp, red flags

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `lich_kham_id` | `int` | NULL |  | FK -> `lich_kham.id` | UNIQUE |
| 2 | `benh_nhan_id` | `int` | NULL |  | FK -> `benh_nhan.id` |
| 3 | `trieu_chung_nhap` | `text` | NOT NULL |  | - |
| 4 | `chuyen_khoa_goi_y_id` | `int` | NULL |  | FK -> `chuyen_khoa.id` |
| 5 | `do_tin_cay` | `numeric(5, 4)` | NOT NULL |  | - |
| 6 | `co_dau_hieu_cap_cuu` | `boolean` | NOT NULL |  | - |
| 7 | `tu_khoa_cap_cuu_phat_hien` | `varchar(100)` | NULL |  | - |
| 8 | `mo_hinh_ap_dung` | `varchar(50)` | NOT NULL |  | - |
| 9 | `thoi_gian_suy_luan_ms` | `numeric(8, 2)` | NULL |  | - |
| 10 | `id` | `int` | NOT NULL | PK | - |
| 11 | `created_at` | `datetime` | NOT NULL |  | - |
| 12 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_phan_tich_ai_id` (id)

---

#### 31. Bảng `danh_gia_ai`
**Mô tả:** Phản hồi/đánh giá của bác sĩ về độ chính xác của gợi ý AI

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `phan_tich_ai_id` | `int` | NOT NULL |  | FK -> `phan_tich_ai.id` | UNIQUE |
| 2 | `nguoi_danh_gia_id` | `int` | NULL |  | FK -> `nguoi_dung.id` |
| 3 | `vai_tro_nguoi_danh_gia` | `varchar(20)` | NOT NULL |  | - |
| 4 | `so_sao` | `int` | NULL |  | - |
| 5 | `chuyen_khoa_thuc_te_id` | `int` | NULL |  | FK -> `chuyen_khoa.id` |
| 6 | `nhan_xet` | `text` | NULL |  | - |
| 7 | `id` | `int` | NOT NULL | PK | - |
| 8 | `created_at` | `datetime` | NOT NULL |  | - |
| 9 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_danh_gia_ai_id` (id)

---

### 4. Phân hệ Khám lâm sàng & Bệnh án điện tử (EMR & Clinical)

#### 32. Bảng `luot_kham`
**Mô tả:** Phiếu khám lâm sàng / Encounter EMR ngoại trú (bệnh sử, khám thực thể, kết luận, cờ khóa TT32)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `lich_kham_id` | `int` | NOT NULL |  | FK -> `lich_kham.id` | UNIQUE |
| 2 | `bac_si_id` | `int` | NOT NULL |  | FK -> `bac_si.id` |
| 3 | `benh_nhan_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` |
| 4 | `thoi_gian_bat_dau` | `datetime` | NOT NULL |  | - |
| 5 | `thoi_gian_ket_thuc` | `datetime` | NULL |  | - |
| 6 | `ly_do_vao_kham` | `text` | NULL |  | - |
| 7 | `benh_su` | `text` | NULL |  | - |
| 8 | `mach_lan_phut` | `int` | NULL |  | - |
| 9 | `nhiet_do_c` | `numeric(4, 1)` | NULL |  | - |
| 10 | `huyet_ap_tam_thu` | `int` | NULL |  | - |
| 11 | `huyet_ap_tam_truong` | `int` | NULL |  | - |
| 12 | `nhip_tho_lan_phut` | `int` | NULL |  | - |
| 13 | `can_nang_kg` | `numeric(5, 2)` | NULL |  | - |
| 14 | `chieu_cao_cm` | `numeric(5, 2)` | NULL |  | - |
| 15 | `kham_lam_sang_bo_phan` | `text` | NULL |  | - |
| 16 | `ket_luan_dieu_tri` | `text` | NULL |  | - |
| 17 | `loi_dan_bac_si` | `text` | NULL |  | - |
| 18 | `ngay_hen_tai_kham` | `date` | NULL |  | - |
| 19 | `is_locked` | `boolean` | NOT NULL |  | - |
| 20 | `thoi_gian_khoa` | `datetime` | NULL |  | - |
| 21 | `nguoi_khoa_id` | `int` | NULL |  | FK -> `nguoi_dung.id` |
| 22 | `tiep_quan_boi_id` | `int` | NULL |  | FK -> `bac_si.id` |
| 23 | `ly_do_tiep_quan` | `text` | NULL |  | - |
| 24 | `id` | `int` | NOT NULL | PK | - |
| 25 | `created_at` | `datetime` | NOT NULL |  | - |
| 26 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_luot_kham_id` (id)

---

#### 33. Bảng `luot_kham_the_luc`
**Mô tả:** Hồ sơ khám thể lực chuyên sâu (tai, mũi, họng, răng hàm mặt, mắt)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `luot_kham_id` | `int` | NOT NULL |  | FK -> `luot_kham.id` | UNIQUE, INDEX |
| 2 | `chieu_cao` | `numeric(5, 1)` | NULL |  | - |
| 3 | `can_nang` | `numeric(5, 1)` | NULL |  | - |
| 4 | `bmi` | `numeric(4, 1)` | NULL |  | - |
| 5 | `mach` | `int` | NULL |  | - |
| 6 | `huyet_ap_tam_thu` | `int` | NULL |  | - |
| 7 | `huyet_ap_tam_truong` | `int` | NULL |  | - |
| 8 | `nhiet_do` | `numeric(4, 1)` | NULL |  | - |
| 9 | `nhip_tho` | `int` | NULL |  | - |
| 10 | `thi_luc_mat_phai` | `varchar(20)` | NULL |  | - |
| 11 | `thi_luc_mat_trai` | `varchar(20)` | NULL |  | - |
| 12 | `tai_mui_hong` | `text` | NULL |  | - |
| 13 | `rang_ham_mat` | `text` | NULL |  | - |
| 14 | `tuan_hoan` | `text` | NULL |  | - |
| 15 | `ho_hap` | `text` | NULL |  | - |
| 16 | `tieu_hoa` | `text` | NULL |  | - |
| 17 | `than_kinh` | `text` | NULL |  | - |
| 18 | `da_lieu` | `text` | NULL |  | - |
| 19 | `phan_loai_the_luc` | `varchar(10)` | NULL |  | - |
| 20 | `bac_si_ket_luan_id` | `int` | NULL |  | FK -> `bac_si.id` |
| 21 | `id` | `int` | NOT NULL | PK | - |
| 22 | `created_at` | `datetime` | NOT NULL |  | - |
| 23 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_luot_kham_the_luc_id` (id); `ix_luot_kham_the_luc_luot_kham_id` (UNIQUE luot_kham_id)

---

#### 34. Bảng `chan_doan`
**Mô tả:** Chẩn đoán bệnh theo mã danh mục bệnh tật quốc tế ICD-10 (chính và phụ)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `luot_kham_id` | `int` | NOT NULL |  | FK -> `luot_kham.id` | INDEX |
| 2 | `khai_niem_id` | `int` | NULL |  | FK -> `khai_niem.id` |
| 3 | `ma_icd10` | `varchar(50)` | NOT NULL |  | - |
| 4 | `ten_benh_chan_doan` | `varchar(255)` | NOT NULL |  | - |
| 5 | `loai_chan_doan` | `varchar(20)` | NOT NULL |  | - |
| 6 | `ghi_chu_chuyen_mon` | `text` | NULL |  | - |
| 7 | `id` | `int` | NOT NULL | PK | - |
| 8 | `created_at` | `datetime` | NOT NULL |  | - |
| 9 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_chan_doan_id` (id); `ix_chan_doan_luot_kham_id` (luot_kham_id)

---

#### 35. Bảng `khai_niem`
**Mô tả:** Từ điển thuật ngữ y khoa mở rộng (Concept dictionary theo kiến trúc OpenMRS)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_khai_niem` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_khai_niem` | `varchar(255)` | NOT NULL |  | INDEX |
| 3 | `loai_khai_niem` | `varchar(50)` | NOT NULL |  | - |
| 4 | `chuyen_khoa_id` | `int` | NULL |  | FK -> `chuyen_khoa.id` |
| 5 | `mo_ta` | `text` | NULL |  | - |
| 6 | `is_active` | `boolean` | NOT NULL |  | - |
| 7 | `id` | `int` | NOT NULL | PK | - |
| 8 | `created_at` | `datetime` | NOT NULL |  | - |
| 9 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_khai_niem_ten_khai_niem` (ten_khai_niem); `ix_khai_niem_ma_khai_niem` (UNIQUE ma_khai_niem); `ix_khai_niem_id` (id)

---

#### 36. Bảng `bien_ban_dinh_chinh`
**Mô tả:** Biên bản đính chính bệnh án sau khi đã khóa theo quy trình 4 mắt TT 32/2023/TT-BYT

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `luot_kham_id` | `int` | NOT NULL |  | FK -> `luot_kham.id` | INDEX |
| 2 | `thuc_the_loai` | `varchar(50)` | NOT NULL |  | - |
| 3 | `thuc_the_id` | `int` | NOT NULL |  | - |
| 4 | `ly_do_ma` | `varchar(50)` | NULL |  | - |
| 5 | `ly_do_text` | `text` | NOT NULL |  | - |
| 6 | `noi_dung_cu_json` | `json` | NULL |  | - |
| 7 | `noi_dung_moi_json` | `json` | NOT NULL |  | - |
| 8 | `muc_do_nghiem_trong` | `varchar(20)` | NOT NULL |  | - |
| 9 | `ma_kiem_thao` | `varchar(100)` | NULL |  | - |
| 10 | `thoi_gian_kiem_thao` | `datetime` | NULL |  | - |
| 11 | `requested_by_id` | `int` | NOT NULL |  | FK -> `nguoi_dung.id` | INDEX |
| 12 | `approved_by_id` | `int` | NULL |  | FK -> `nguoi_dung.id` | INDEX |
| 13 | `approved_at` | `datetime` | NULL |  | - |
| 14 | `trang_thai` | `varchar(50)` | NOT NULL |  | - |
| 15 | `ghi_chu` | `text` | NULL |  | - |
| 16 | `id` | `int` | NOT NULL | PK | - |
| 17 | `created_at` | `datetime` | NOT NULL |  | - |
| 18 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_bien_ban_dinh_chinh_requested_by_id` (requested_by_id); `ix_bien_ban_dinh_chinh_luot_kham_id` (luot_kham_id); `ix_bien_ban_dinh_chinh_approved_by_id` (approved_by_id); `ix_bien_ban_dinh_chinh_id` (id)

---

#### 37. Bảng `mau_bieu_y_te`
**Mô tả:** Mẫu biểu văn bản y tế động phục vụ in ấn và liên thông báo cáo

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_mau` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_mau` | `varchar(255)` | NOT NULL |  | INDEX |
| 3 | `loai_mau` | `varchar(30)` | NOT NULL |  | - |
| 4 | `chuyen_khoa_id` | `int` | NULL |  | FK -> `chuyen_khoa.id` |
| 5 | `bac_si_tao_id` | `int` | NULL |  | FK -> `bac_si.id` |
| 6 | `noi_dung_text` | `text` | NOT NULL |  | - |
| 7 | `is_public` | `boolean` | NOT NULL |  | - |
| 8 | `id` | `int` | NOT NULL | PK | - |
| 9 | `created_at` | `datetime` | NOT NULL |  | - |
| 10 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_mau_bieu_y_te_ten_mau` (ten_mau); `ix_mau_bieu_y_te_ma_mau` (UNIQUE ma_mau); `ix_mau_bieu_y_te_id` (id)

---

### 5. Phân hệ Cận lâm sàng, Đơn thuốc & Viện phí (Billing & Pharmacy)

#### 38. Bảng `chi_dinh`
**Mô tả:** Chỉ định cận lâm sàng (trạng thái, kết quả đo, kết luận bác sĩ CLS, khoảng tham chiếu)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `luot_kham_id` | `int` | NOT NULL |  | FK -> `luot_kham.id` | INDEX |
| 2 | `dich_vu_id` | `int` | NOT NULL |  | FK -> `dich_vu.id` |
| 3 | `so_luong` | `int` | NOT NULL |  | - |
| 4 | `don_gia_tai_thoi_diem` | `numeric(12, 2)` | NOT NULL |  | - |
| 5 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 6 | `bac_si_chi_dinh_id` | `int` | NULL |  | FK -> `bac_si.id` |
| 7 | `ket_qua_chi_tiet` | `text` | NULL |  | - |
| 8 | `tep_dinh_kem_url` | `varchar(255)` | NULL |  | - |
| 9 | `thoi_gian_tra_ket_qua` | `datetime` | NULL |  | - |
| 10 | `ket_qua_phan_loai` | `varchar(20)` | NULL |  | - |
| 11 | `phong_thuc_hien_id` | `int` | NULL |  | FK -> `phong_kham.id` | INDEX |
| 12 | `ky_thuat_vien_id` | `int` | NULL |  | FK -> `nguoi_dung.id` |
| 13 | `thoi_gian_lay_mau` | `datetime` | NULL |  | - |
| 14 | `thoi_gian_thuc_hien` | `datetime` | NULL |  | - |
| 15 | `file_dinh_kem_urls` | `json` | NULL |  | - |
| 16 | `tri_so_chi_tiet` | `json` | NULL |  | - |
| 17 | `id` | `int` | NOT NULL | PK | - |
| 18 | `created_at` | `datetime` | NOT NULL |  | - |
| 19 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_chi_dinh_id` (id); `ix_chi_dinh_phong_thuc_hien_id` (phong_thuc_hien_id); `ix_chi_dinh_luot_kham_id` (luot_kham_id)

---

#### 39. Bảng `dich_vu`
**Mô tả:** Danh mục dịch vụ y tế kỹ thuật (khám, xét nghiệm máu, X-quang, siêu âm, nội soi)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_dich_vu` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ten_dich_vu` | `varchar(150)` | NOT NULL |  | - |
| 3 | `chuyen_khoa_id` | `int` | NULL |  | FK -> `chuyen_khoa.id` |
| 4 | `don_gia` | `numeric(12, 2)` | NOT NULL |  | - |
| 5 | `don_vi_tinh` | `varchar(30)` | NOT NULL |  | - |
| 6 | `quy_trinh_thuc_hien` | `text` | NULL |  | - |
| 7 | `is_active` | `boolean` | NOT NULL |  | - |
| 8 | `ma_nhom_byt` | `varchar(50)` | NULL |  | - |
| 9 | `ma_tu_dong_bhyt` | `varchar(50)` | NULL |  | - |
| 10 | `phong_thuc_hien_id` | `int` | NULL |  | FK -> `phong_kham.id` |
| 11 | `thoi_gian_tra_ket_qua_phut` | `int` | NOT NULL |  | - |
| 12 | `huong_dan_chuan_bi` | `text` | NULL |  | - |
| 13 | `id` | `int` | NOT NULL | PK | - |
| 14 | `created_at` | `datetime` | NOT NULL |  | - |
| 15 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_dich_vu_ma_dich_vu` (UNIQUE ma_dich_vu); `ix_dich_vu_id` (id)

---

#### 40. Bảng `don_thuoc`
**Mô tả:** Đơn thuốc điện tử ngoại trú (lời dặn, mã đơn quốc gia, trạng thái phát thuốc)

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `luot_kham_id` | `int` | NOT NULL |  | FK -> `luot_kham.id` | INDEX |
| 2 | `bac_si_ke_don_id` | `int` | NOT NULL |  | FK -> `bac_si.id` |
| 3 | `ngay_ke_don` | `datetime` | NOT NULL |  | - |
| 4 | `loi_dan_uong_thuoc` | `text` | NULL |  | - |
| 5 | `ghi_chu_duoc_lam_sang` | `text` | NULL |  | - |
| 6 | `trang_thai` | `varchar(50)` | NOT NULL |  | - |
| 7 | `ma_don_quoc_gia` | `varchar(100)` | NULL |  | - |
| 8 | `chu_ky_so` | `text` | NULL |  | - |
| 9 | `ngay_ky` | `datetime` | NULL |  | - |
| 10 | `idempotency_key` | `varchar(100)` | NULL |  | INDEX |
| 11 | `bien_nhan_giao_dich` | `varchar(255)` | NULL |  | - |
| 12 | `thoi_gian_gui_cong` | `datetime` | NULL |  | - |
| 13 | `ma_ket_qua_cong` | `varchar(100)` | NULL |  | - |
| 14 | `thong_diep_cong` | `text` | NULL |  | - |
| 15 | `superseded_by_id` | `int` | NULL |  | FK -> `don_thuoc.id` |
| 16 | `thay_the_cho_don_id` | `int` | NULL |  | FK -> `don_thuoc.id` |
| 17 | `ly_do_thay_the` | `text` | NULL |  | - |
| 18 | `nguoi_ky_id` | `int` | NULL |  | FK -> `bac_si.id` |
| 19 | `du_lieu_don_thuoc_hash` | `varchar(100)` | NULL |  | - |
| 20 | `id` | `int` | NOT NULL | PK | - |
| 21 | `created_at` | `datetime` | NOT NULL |  | - |
| 22 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_don_thuoc_idempotency_key` (idempotency_key); `ix_don_thuoc_luot_kham_id` (luot_kham_id); `ix_don_thuoc_id` (id)

---

#### 41. Bảng `chi_tiet_don_thuoc`
**Mô tả:** Chi tiết từng loại thuốc, liều dùng, đường dùng, chia 4 cữ Sáng-Trưa-Chiều-Tối

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `don_thuoc_id` | `int` | NOT NULL |  | FK -> `don_thuoc.id` | INDEX |
| 2 | `ten_thuoc` | `varchar(150)` | NOT NULL |  | - |
| 3 | `hoat_chat` | `varchar(150)` | NULL |  | - |
| 4 | `ham_luong` | `varchar(50)` | NULL |  | - |
| 5 | `don_vi_tinh` | `varchar(30)` | NOT NULL |  | - |
| 6 | `so_luong` | `int` | NOT NULL |  | - |
| 7 | `cach_dung` | `text` | NOT NULL |  | - |
| 8 | `so_ngay_dung` | `int` | NOT NULL |  | - |
| 9 | `ghi_chu` | `text` | NULL |  | - |
| 10 | `id` | `int` | NOT NULL | PK | - |
| 11 | `created_at` | `datetime` | NOT NULL |  | - |
| 12 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_chi_tiet_don_thuoc_don_thuoc_id` (don_thuoc_id); `ix_chi_tiet_don_thuoc_id` (id)

---

#### 42. Bảng `hoa_don`
**Mô tả:** Hóa đơn viện phí / tài chính, tổng tiền, bảo hiểm miễn giảm, trạng thái thanh toán

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_hoa_don` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `luot_kham_id` | `int` | NOT NULL |  | FK -> `luot_kham.id` | INDEX |
| 3 | `benh_nhan_id` | `int` | NOT NULL |  | FK -> `benh_nhan.id` | INDEX |
| 4 | `thu_ngan_id` | `int` | NOT NULL |  | FK -> `nguoi_dung.id` | INDEX |
| 5 | `tong_tien` | `numeric(15, 2)` | NOT NULL |  | - |
| 6 | `mien_giam` | `numeric(15, 2)` | NOT NULL |  | - |
| 7 | `thuc_thu` | `numeric(15, 2)` | NOT NULL |  | - |
| 8 | `phuong_thuc_thanh_toan` | `varchar(30)` | NOT NULL |  | - |
| 9 | `trang_thai` | `varchar(30)` | NOT NULL |  | INDEX |
| 10 | `so_hoa_don_in` | `varchar(50)` | NULL |  | - |
| 11 | `ghi_chu` | `text` | NULL |  | - |
| 12 | `ngay_thanh_toan` | `datetime` | NULL |  | - |
| 13 | `id` | `int` | NOT NULL | PK | - |
| 14 | `created_at` | `datetime` | NOT NULL |  | - |
| 15 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_hoa_don_thu_ngan_id` (thu_ngan_id); `ix_hoa_don_ma_hoa_don` (UNIQUE ma_hoa_don); `ix_hoa_don_id` (id); `ix_hoa_don_trang_thai` (trang_thai); `ix_hoa_don_benh_nhan_id` (benh_nhan_id); `ix_hoa_don_luot_kham_id` (luot_kham_id)

---

#### 43. Bảng `chi_tiet_hoa_don`
**Mô tả:** Chi tiết từng khoản mục viện phí cấu thành nên hóa đơn

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `hoa_don_id` | `int` | NOT NULL |  | FK -> `hoa_don.id` | INDEX |
| 2 | `loai_muc` | `varchar(30)` | NOT NULL |  | - |
| 3 | `muc_tham_chieu_id` | `int` | NULL |  | - |
| 4 | `ten_khoan_thu` | `varchar(255)` | NOT NULL |  | - |
| 5 | `so_luong` | `int` | NOT NULL |  | - |
| 6 | `don_gia` | `numeric(15, 2)` | NOT NULL |  | - |
| 7 | `thanh_tien` | `numeric(15, 2)` | NOT NULL |  | - |
| 8 | `ghi_chu` | `text` | NULL |  | - |
| 9 | `id` | `int` | NOT NULL | PK | - |
| 10 | `created_at` | `datetime` | NOT NULL |  | - |
| 11 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_chi_tiet_hoa_don_hoa_don_id` (hoa_don_id); `ix_chi_tiet_hoa_don_id` (id)

---

#### 44. Bảng `phieu_thu_chi`
**Mô tả:** Phiếu giao dịch thu chi tiền mặt/chuyển khoản thực tế tại quầy thu ngân

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_phieu` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `loai_phieu` | `varchar(20)` | NOT NULL |  | - |
| 3 | `hoa_don_id` | `int` | NULL |  | FK -> `hoa_don.id` | INDEX |
| 4 | `nguoi_giao_dich` | `varchar(255)` | NOT NULL |  | - |
| 5 | `so_tien` | `numeric(15, 2)` | NOT NULL |  | - |
| 6 | `phuong_thuc` | `varchar(30)` | NOT NULL |  | - |
| 7 | `ly_do` | `text` | NOT NULL |  | - |
| 8 | `nhan_vien_id` | `int` | NOT NULL |  | FK -> `nguoi_dung.id` | INDEX |
| 9 | `thoi_gian` | `datetime` | NOT NULL |  | - |
| 10 | `trang_thai_khoa_so` | `boolean` | NOT NULL |  | - |
| 11 | `id` | `int` | NOT NULL | PK | - |
| 12 | `created_at` | `datetime` | NOT NULL |  | - |
| 13 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_phieu_thu_chi_id` (id); `ix_phieu_thu_chi_nhan_vien_id` (nhan_vien_id); `ix_phieu_thu_chi_hoa_don_id` (hoa_don_id); `ix_phieu_thu_chi_ma_phieu` (UNIQUE ma_phieu)

---

#### 45. Bảng `khoa_so_ca_truc`
**Mô tả:** Biên bản bàn giao và khóa sổ doanh thu tiền mặt ca trực của thu ngân

| STT | Tên cột | Kiểu dữ liệu | Nullable | Khóa | Ràng buộc / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ma_khoa_so` | `varchar(50)` | NOT NULL |  | UNIQUE, INDEX |
| 2 | `ca_lam_viec` | `varchar(20)` | NOT NULL |  | - |
| 3 | `ngay_khoa_so` | `date` | NOT NULL |  | INDEX |
| 4 | `thu_ngan_giao_id` | `int` | NOT NULL |  | FK -> `nguoi_dung.id` | INDEX |
| 5 | `thu_ngan_nhan_id` | `int` | NULL |  | FK -> `nguoi_dung.id` |
| 6 | `tong_tien_mat_he_thong` | `numeric(15, 2)` | NOT NULL |  | - |
| 7 | `tong_chuyen_khoan_he_thong` | `numeric(15, 2)` | NOT NULL |  | - |
| 8 | `tong_the_pos_he_thong` | `numeric(15, 2)` | NOT NULL |  | - |
| 9 | `tien_mat_thuc_te` | `numeric(15, 2)` | NOT NULL |  | - |
| 10 | `chenh_lech_tien_mat` | `numeric(15, 2)` | NOT NULL |  | - |
| 11 | `tong_so_phieu_thu` | `int` | NOT NULL |  | - |
| 12 | `tong_so_phieu_chi` | `int` | NOT NULL |  | - |
| 13 | `trang_thai` | `varchar(30)` | NOT NULL |  | - |
| 14 | `ghi_chu` | `text` | NULL |  | - |
| 15 | `id` | `int` | NOT NULL | PK | - |
| 16 | `created_at` | `datetime` | NOT NULL |  | - |
| 17 | `updated_at` | `datetime` | NOT NULL |  | - |

*Chỉ mục bổ sung:* `ix_khoa_so_ca_truc_id` (id); `ix_khoa_so_ca_truc_thu_ngan_giao_id` (thu_ngan_giao_id); `ix_khoa_so_ca_truc_ngay_khoa_so` (ngay_khoa_so); `ix_khoa_so_ca_truc_ma_khoa_so` (UNIQUE ma_khoa_so)

---
