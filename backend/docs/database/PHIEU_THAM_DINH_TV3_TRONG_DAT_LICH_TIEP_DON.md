# PHIẾU THẨM ĐỊNH PHÂN HỆ CSDL: ĐẶT LỊCH & TIẾP ĐÓN (SCHEDULING & QUEUING)
**Dự án:** Clinic-AI | **Giai đoạn:** Thẩm định ERD Mục tiêu MVP  
**Người phụ trách:** Thành viên 3 — Trọng (Backend & Booking/Queuing Engine)  
**Tài liệu đối chiếu:** [BANG_KIEM_KE_CSDL_45_BANG.md](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/BANG_KIEM_KE_CSDL_45_BANG.md) | [erd_hien_trang.dbml](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/erd_hien_trang.dbml)

---

## 1. PHẠM VI BẢNG PHỤ TRÁCH (8 BẢNG)
Phân hệ Đặt lịch & Tiếp đón là "cửa ngõ" vận hành của toàn bộ hệ thống phòng khám, chịu trách nhiệm quản lý ca trực bác sĩ, lịch hẹn khám, ngăn chặn đặt trùng slot (overbooking/race condition), tiếp đón phân luồng ưu tiên theo chuẩn OpenMRS/Bahmni, hàng đợi chờ slot (waitlist) và tích hợp AI Triage phân tích triệu chứng ban đầu.

| STT | Tên bảng | Trách nhiệm dữ liệu cốt lõi | Khóa chính (PK) | Khóa ngoại (FK) chính |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `lich_kham` | Phiếu hẹn khám bệnh (ngày hẹn, ca khám, giờ hẹn, trạng thái hẹn, kênh đặt) | `id` | `benh_nhan_id`, `bac_si_id`, `chuyen_khoa_id` |
| 2 | `lich_lam_viec` | Ca trực của bác sĩ trong ngày (Sáng/Chiều/Tối), giới hạn slot tối đa (`so_luong_toi_da`) | `id` | `bac_si_id` -> `bac_si.id`, `phong_kham_id` -> `phong_kham.id` |
| 3 | `hang_doi_kham` | Hàng đợi tiếp đón tại phòng khám theo 5 bậc ưu tiên (P1 cấp cứu -> P5 thông thường) | `id` | `lich_kham_id`, `benh_nhan_id`, `phong_kham_id` |
| 4 | `danh_sach_cho` | Danh sách chờ slot (Waitlist) khi ca khám đã kín lịch | `id` | `benh_nhan_id`, `bac_si_id`, `chuyen_khoa_id` |
| 5 | `lich_dinh_ky_bac_si` | Mẫu lịch làm việc định kỳ hàng tuần (Thứ 2 - Chủ nhật) để tự động sinh ca | `id` | `bac_si_id` -> `bac_si.id` |
| 6 | `nghi_phep_bac_si` | Đăng ký nghỉ phép (nghỉ ốm, công tác, việc riêng) để tự động khóa slot khám | `id` | `bac_si_id` -> `bac_si.id` |
| 7 | `phan_tich_ai` | Kết quả phân tích triệu chứng AI Triage, gợi ý chuyên khoa, độ khẩn cấp, red flags | `id` | `nguoi_dung_id` -> `nguoi_dung.id` |
| 8 | `danh_gia_ai` | Đánh giá phản hồi của bác sĩ về chất lượng tư vấn/triage của AI | `id` | `phan_tich_ai_id`, `bac_si_id` |

---

## 2. KẾT QUẢ RÀ SOÁT VÀ PHÂN LOẠI HÀNH ĐỘNG ĐỀ XUẤT

### 2.1. Nhóm Bảng GIỮ NGUYÊN (Đạt chuẩn 100% cho MVP)
- [x] `lich_lam_viec`: Đã có các trường quản lý dung lượng ca trực (`so_luong_toi_da`, `so_luong_da_dat`, `gio_bat_dau`, `gio_ket_thuc`). Unique key `(bac_si_id, ngay_lam_viec, ca_lam_viec)` chống xếp trùng ca trực của một bác sĩ trong cùng buổi.
- [x] `hang_doi_kham`: Đã thiết kế cột `muc_do_uu_tien` hỗ trợ phân luồng 5 mức ưu tiên chuẩn Bahmni (`P1_CAP_CUU`, `P2_UU_TIEN_TRE_EM_NGUOI_GIA`, `P3_DA_DAT_HEN_TRUOC`, `P4_TAI_KHAM`, `P5_VANG_LAI`), kèm số thứ tự gọi khám `stt` và trạng thái hàng đợi.
- [x] `danh_sach_cho`: Quản lý tốt bệnh nhân xếp hàng đợi slot hủy, có trường `thoi_gian_het_han_giu_cho` để tự động nhường slot cho người tiếp theo nếu không xác nhận sau 15 phút.
- [x] `lich_dinh_ky_bac_si` & `nghi_phep_bac_si`: Cung cấp khả năng tự động hóa xếp lịch và chặn đặt lịch vào ngày bác sĩ xin nghỉ phép.
- [x] `phan_tich_ai` & `danh_gia_ai`: Lưu vết hội thoại AI Triage, chuyên khoa gợi ý, cờ đỏ cấp cứu và đánh giá của bác sĩ.

### 2.2. Nhóm Bảng SỬA / TINH CHỈNH (Cần bổ sung cột hoặc đổi constraint)
- [x] **`lich_kham`**:
  - **Bổ sung cột:** `idempotency_key VARCHAR(64) UNIQUE NULL`.
  - **Lý do nghiệp vụ:** Khi bệnh nhân bấm nút "Xác nhận đặt lịch" trên ứng dụng di động/web, nếu đường truyền mạng lag hoặc bệnh nhân nhấn đúp 2 lần (double-click), hệ thống có nguy cơ tạo ra 2 phiếu hẹn giống hệt nhau hoặc tranh chấp cùng một slot khám. Khóa Idempotency Key (sinh ra từ frontend dạng UUID v4) đảm bảo request lặp sẽ trả về cùng kết quả mà không tạo thêm bản ghi trùng.
  - **Rà soát Unique Constraint:** Đã có Partial Unique Constraint ngăn chặn 2 lịch khám trùng cùng 1 khung giờ của bác sĩ khi trạng thái chưa bị hủy.

### 2.3. Nhóm Bảng BỔ SUNG MỚI
- *Không cần tạo mới bảng*: 8 bảng hiện tại đã bao phủ hoàn hảo luồng Đặt lịch $\rightarrow$ Tiếp đón $\rightarrow$ Hàng đợi $\rightarrow$ Chuyển vào phòng khám.

### 2.4. Nhóm Bảng ĐỀ XUẤT LOẠI KHỎI MVP (Chuyển sang Phase 2)
- Không có bảng nào thuộc nhóm này bị loại bỏ. Cả 8 bảng đều đóng vai trò sống còn trong việc vận hành phòng khám mỗi ngày.

---

## 3. RÀ SOÁT QUAN HỆ KHÓA NGOẠI XUYÊN PHÂN HỆ (CROSS-SUBSYSTEM FKs)
| Bảng nguồn | Cột FK | Bảng đích | Phân hệ liên đới | Tình trạng kiểm tra |
| :--- | :--- | :--- | :--- | :--- |
| `lich_kham` | `benh_nhan_id` | `benh_nhan.id` | Phân hệ 2 (Nhân sự) | Khớp 100% |
| `lich_kham` | `bac_si_id` | `bac_si.id` | Phân hệ 2 (Nhân sự) | Khớp 100% |
| `lich_kham` | `chuyen_khoa_id` | `chuyen_khoa.id` | Phân hệ 2 (Nhân sự) | Khớp 100% |
| `luot_kham` | `lich_kham_id` | `lich_kham.id` | Phân hệ 4 (Khám bệnh) | Quan hệ 1-1 chính xác |
| `hang_doi_kham` | `phong_kham_id` | `phong_kham.id` | Phân hệ 2 (Nhân sự) | Khớp 100% |

---

## 4. CÂU HỎI TƯ DUY PHẢN BIỆN DÀNH CHO THÀNH VIÊN 3 (THINKING PROMPTS)
1. **Nếu bệnh nhân đến khám nhưng không đặt lịch trước (khách vãng lai / walk-in) thì hệ thống xử lý thế nào?**
   - *Phân tích logic:* Lễ tân tại quầy sẽ tạo nhanh một bản ghi `lich_kham` với kênh đặt `TRUC_TIEP_TAI_QUAY`, sau đó ngay lập tức đẩy bản ghi vào `hang_doi_kham` với mức ưu tiên `P5_VANG_LAI`. Bệnh nhân sẽ được xếp số sau các bệnh nhân đã đặt hẹn trước (`P3_DA_DAT_HEN_TRUOC`).
2. **Khi một bệnh nhân hủy lịch khám (`DA_HUY`), làm sao chuyển slot đó cho người trong danh sách chờ (`danh_sach_cho`)?**
   - *Phân tích logic:* Trong Service layer, sự kiện hủy lịch sẽ kích hoạt hàm tìm bản ghi `danh_sach_cho` sớm nhất có cùng `bac_si_id` và `ngay_kham`. Cập nhật trạng thái `DA_THONG_BAO` và gửi thông báo cho bệnh nhân đó trong vòng 15 phút.

---

## 5. KẾT LUẬN & XÁC NHẬN CỦA THÀNH VIÊN
- **Đánh giá chung:** Phân hệ Đặt lịch & Tiếp đón rất chặt chẽ. Việc bổ sung `idempotency_key` vào `lich_kham` là quyết định kiến trúc chuẩn mực để chống xung đột dữ liệu.
- **Ý kiến đề xuất:** Đồng ý đưa `idempotency_key` vào ERD Mục tiêu và chuẩn bị migration Alembic.

*Ngày hoàn thành:* 19/10/2026  
*Chữ ký rà soát:* **Thành viên 3 — Trọng**
