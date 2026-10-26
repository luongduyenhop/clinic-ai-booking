# PHIẾU THẨM ĐỊNH PHÂN HỆ CSDL: TÀI KHOẢN, NHÂN SỰ & CƠ SỞ Y TẾ
**Dự án:** Clinic-AI | **Giai đoạn:** Thẩm định ERD Mục tiêu MVP  
**Người phụ trách:** Thành viên 2 — Tùng (Backend & Security/Auth)  
**Tài liệu đối chiếu:** [BANG_KIEM_KE_CSDL_45_BANG.md](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/BANG_KIEM_KE_CSDL_45_BANG.md) | [erd_hien_trang.dbml](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/erd_hien_trang.dbml)

---

## 1. PHẠM VI BẢNG PHỤ TRÁCH (7 BẢNG)
Phân hệ này chịu trách nhiệm quản lý thông tin định danh người dùng, xác thực tài khoản, quyền hạn RBAC, hồ sơ bệnh nhân, hồ sơ người thân bảo hộ, danh mục bác sĩ, giấy phép hành nghề, chuyên khoa và phòng khám vật lý.

| STT | Tên bảng | Trách nhiệm dữ liệu cốt lõi | Khóa chính (PK) | Khóa ngoại (FK) chính |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `nguoi_dung` | Thông tin định danh cá nhân (họ tên, SĐT, CCCD, email, địa chỉ) | `id` | Không có |
| 2 | `tai_khoan` | Tài khoản bảo mật, mật khẩu hash, `vai_tro` Enum, OTP, refresh token | `id` | `nguoi_dung_id` -> `nguoi_dung.id` (1-1) |
| 3 | `benh_nhan` | Hồ sơ y tế bệnh nhân (mã BN, BHYT, nhóm máu, tiền sử dị ứng) | `id` | `nguoi_dung_id` -> `nguoi_dung.id` (1-1) |
| 4 | `bac_si` | Bác sĩ chuyên môn (CCHN, học vị, chuyên khoa, số năm kinh nghiệm) | `id` | `nguoi_dung_id` -> `nguoi_dung.id`, `chuyen_khoa_id` |
| 5 | `ho_so_nguoi_than` | Quan hệ bảo trợ y tế (cha mẹ đặt lịch cho con, con đặt cho cha mẹ) | `id` | `chu_ho_so_id`, `nguoi_than_id` -> `benh_nhan.id` |
| 6 | `chuyen_khoa` | Danh mục chuyên khoa lâm sàng (Nội, Ngoại, Nhi, Sản, Mắt, TMH...) | `id` | Không có |
| 7 | `phong_kham` | Phòng khám vật lý tại cơ sở (mã phòng, tên, tầng, loại phòng) | `id` | `chuyen_khoa_id` -> `chuyen_khoa.id` |
| 8 | `giay_phep_co_so` | Giấy phép hoạt động phòng khám do Sở Y tế cấp theo luật khám chữa bệnh | `id` | Không có |
| 9 | `lich_su_giay_phep_bac_si` | Lịch sử cấp đổi, đình chỉ hoặc gia hạn chứng chỉ CCHN của bác sĩ | `id` | `bac_si_id` -> `bac_si.id` |

---

## 2. KẾT QUẢ RÀ SOÁT VÀ PHÂN LOẠI HÀNH ĐỘNG ĐỀ XUẤT

### 2.1. Nhóm Bảng GIỮ NGUYÊN (Đạt chuẩn 100% cho MVP)
- [x] `nguoi_dung`: Đã có đầy đủ ràng buộc `unique` cho `so_dien_thoai`, `email`, `cccd_so`. Hỗ trợ tìm kiếm nhanh theo SĐT tại quầy tiếp đón.
- [x] `tai_khoan`: Đã hỗ trợ JWT + Refresh Token (`refresh_token`, `refresh_token_expired_at`) và mã OTP đặt lịch. `vai_tro` dùng Enum (`BENH_NHAN`, `BAC_SI`, `LE_TAN`, `THU_NGAN`, `QUAN_TRI`) hoàn toàn đáp ứng MVP.
- [x] `chuyen_khoa` & `phong_kham`: Quan hệ 1-N chuẩn xác, hỗ trợ lọc phòng khám theo chuyên khoa và quản lý phòng khám vật lý.
- [x] `ho_so_nguoi_than`: Đã có trường quan hệ (`BO_ME`, `CON`, `VO_CHONG`, `NGUOI_GIAM_HO`), giải quyết trọn vẹn nghiệp vụ phụ huynh đặt lịch khám cho trẻ em dưới 6 tuổi.

### 2.2. Nhóm Bảng SỬA / TINH CHỈNH (Cần bổ sung cột hoặc đổi constraint)
- [x] **`benh_nhan`**:
  - *Đề xuất hiện tại:* `nguoi_dung_id` là 1-1 với `nguoi_dung`.
  - *Rà soát nghiệp vụ:* Cần đảm bảo mã bệnh nhân `ma_benh_nhan` (ví dụ `BN20261001-001`) có ràng buộc `UNIQUE` và tự động đánh số tăng dần theo ngày để nhân viên tiếp đón tra cứu barcode. Hiện tại cột này đã `unique=True`.
- [x] **`bac_si`**:
  - *Đề xuất:* Đã liên kết với `chuyen_khoa_id`. Giữ nguyên để phục vụ bộ lọc tìm kiếm bác sĩ theo chuyên khoa.

### 2.3. Nhóm Bảng BỔ SUNG MỚI
- *Không cần tạo mới bảng*: Không phát sinh bảng mới. Mô hình RBAC tích hợp trên `tai_khoan.vai_tro` giúp đơn giản hóa hệ thống, tránh phân rã thành 4 bảng quyền động phức tạp (`roles`, `permissions`, `user_roles`, `role_permissions`) vốn không cần thiết cho phòng khám quy mô vừa.

### 2.4. Nhóm Bảng ĐỀ XUẤT LOẠI KHỎI MVP (Chuyển sang Phase 2)
- Không có bảng nào thuộc nhóm này cần loại bỏ. Cả 9 bảng đều hỗ trợ trực tiếp việc đăng nhập, phân quyền, hiển thị danh bạ bác sĩ và tiếp nhận bệnh nhân.

---

## 3. RÀ SOÁT QUAN HỆ KHÓA NGOẠI XUYÊN PHÂN HỆ (CROSS-SUBSYSTEM FKs)
| Bảng nguồn | Cột FK | Bảng đích | Phân hệ liên đới | Tình trạng kiểm tra |
| :--- | :--- | :--- | :--- | :--- |
| `lich_kham` | `benh_nhan_id` | `benh_nhan.id` | Phân hệ 3 (Đặt lịch) | Khớp 100% |
| `lich_kham` | `bac_si_id` | `bac_si.id` | Phân hệ 3 (Đặt lịch) | Khớp 100% |
| `lich_lam_viec` | `bac_si_id` | `bac_si.id` | Phân hệ 3 (Đặt lịch) | Khớp 100% |
| `luot_kham` | `benh_nhan_id` | `benh_nhan.id` | Phân hệ 4 (Khám bệnh) | Khớp 100% |
| `luot_kham` | `bac_si_id` | `bac_si.id` | Phân hệ 4 (Khám bệnh) | Khớp 100% |
| `hoa_don` | `benh_nhan_id` | `benh_nhan.id` | Phân hệ 5 (Viện phí) | Khớp 100% |

---

## 4. CÂU HỎI TƯ DUY PHẢN BIỆN DÀNH CHO THÀNH VIÊN 2 (THINKING PROMPTS)
1. **Lễ tân và Thu ngân có cần bảng hồ sơ riêng như Bác sĩ không?**
   - *Phân tích logic:* Bác sĩ cần lưu chứng chỉ hành nghề (CCHN), chuyên khoa, học hàm/học vị để in lên đơn thuốc theo TT 52/2017/TT-BYT. Lễ tân và Thu ngân chỉ là người thao tác nghiệp vụ, mọi thông tin định danh nằm trọn trong `nguoi_dung` + `tai_khoan.vai_tro`. Do đó không cần tạo thêm bảng `nhan_vien` để tránh dư thừa dữ liệu.
2. **Nếu bệnh nhân chưa từng có tài khoản đến khám trực tiếp tại quầy thì sao?**
   - *Phân tích logic:* Lễ tân nhập họ tên, SĐT, CCCD để tạo bản ghi `nguoi_dung` và `benh_nhan`. Tài khoản `tai_khoan` có thể sinh sau hoặc để cờ `is_active=False` cho đến khi bệnh nhân kích hoạt qua OTP.

---

## 5. KẾT LUẬN & XÁC NHẬN CỦA THÀNH VIÊN
- **Đánh giá chung:** Schema phân hệ Tài khoản & Nhân sự đã hoàn chỉnh, quan hệ 1-1 và 1-N chuẩn xác, không có xung đột constraint.
- **Ý kiến đề xuất:** Đồng ý thông qua schema phân hệ này để đưa vào ERD Mục tiêu.

*Ngày hoàn thành:* 19/10/2026  
*Chữ ký rà soát:* **Thành viên 2 — Tùng**
