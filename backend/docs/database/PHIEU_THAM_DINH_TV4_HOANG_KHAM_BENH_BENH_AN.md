# PHIẾU THẨM ĐỊNH PHÂN HỆ CSDL: KHÁM LÂM SÀNG & BỆNH ÁN ĐIỆN TỬ (EMR & CLINICAL)
**Dự án:** Clinic-AI | **Giai đoạn:** Thẩm định ERD Mục tiêu MVP  
**Người phụ trách:** Thành viên 4 — Hoàng (Backend & Clinical EMR Engine)  
**Tài liệu đối chiếu:** [BANG_KIEM_KE_CSDL_45_BANG.md](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/BANG_KIEM_KE_CSDL_45_BANG.md) | [erd_hien_trang.dbml](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/erd_hien_trang.dbml)

---

## 1. PHẠM VI BẢNG PHỤ TRÁCH (6 BẢNG)
Phân hệ Khám lâm sàng & Bệnh án điện tử là "trái tim chuyên môn y khoa" của hệ thống Clinic-AI, chịu trách nhiệm ghi nhận quá trình thăm khám của bác sĩ, tiền sử bệnh tật, dấu hiệu sinh tồn (vitals), khám thể lực chuyên khoa, chẩn đoán bệnh theo chuẩn quốc tế ICD-10, bảo đảm tính toàn vẹn pháp lý của hồ sơ bệnh án theo Thông tư 32/2023/TT-BYT (khóa bệnh án sau khi kết thúc khám, quy trình đính chính 4 mắt).

| STT | Tên bảng | Trách nhiệm dữ liệu cốt lõi | Khóa chính (PK) | Khóa ngoại (FK) chính |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `luot_kham` | Phiếu khám lâm sàng ngoại trú (bệnh sử, triệu chứng cơ năng, kết luận, 7 chỉ số sinh hiệu, cờ khóa EMR TT32) | `id` | `lich_kham_id` (1-1), `benh_nhan_id`, `bac_si_id`, `phong_kham_id` |
| 2 | `luot_kham_the_luc` | Khám thể lực chuyên sâu (tai mũi họng, răng hàm mặt, mắt, da liễu, tuần hoàn, hô hấp) | `id` | `luot_kham_id` -> `luot_kham.id` (1-1) |
| 3 | `chan_doan` | Chẩn đoán xác định và phân biệt theo mã ICD-10 (chẩn đoán chính, phụ, ghi chú lâm sàng) | `id` | `luot_kham_id` -> `luot_kham.id` (1-N) |
| 4 | `khai_niem` | Từ điển khái niệm y khoa mở rộng (Concept Dictionary mô phỏng OpenMRS/Bahmni) | `id` | Không có |
| 5 | `bien_ban_dinh_chinh` | Biên bản sửa đổi thông tin bệnh án sau khi đã khóa (Quy trình 4 mắt theo TT 32/2023/TT-BYT) | `id` | `luot_kham_id`, `bac_si_yeu_cau_id`, `nguoi_duyet_id` |
| 6 | `mau_bieu_y_te` | Mẫu biểu văn bản nghiệp vụ phục vụ in phiếu khám, tóm tắt bệnh án và liên thông | `id` | Không có |

---

## 2. KẾT QUẢ RÀ SOÁT VÀ PHÂN LOẠI HÀNH ĐỘNG ĐỀ XUẤT

### 2.1. Nhóm Bảng GIỮ NGUYÊN (Đạt chuẩn 100% cho MVP)
- [x] **`luot_kham`**:
  - Đã tích hợp sẵn 7 chỉ số sinh tồn chuẩn y tế: Huyết áp tâm thu/tâm trương (`huyet_ap_tam_thu`, `huyet_ap_tam_truong`), mạch (`mach`), nhiệt độ (`nhiet_do`), nhịp thở (`nhip_tho`), chiều cao (`chieu_cao`), cân nặng (`can_nang`), chỉ số khối cơ thể (`bmi`).
  - Đã có cơ chế bảo vệ bệnh án điện tử bất biến theo Điều 54 Thông tư 32/2023/TT-BYT: Cờ `is_locked`, `khoa_ho_so_at`, `nguoi_khoa_id`. Khi `is_locked = True`, mọi thao tác UPDATE trực tiếp trên API đều bị chặn tuyệt đối (HTTP 403 Forbidden).
- [x] **`chan_doan`**:
  - Hỗ trợ lưu trữ mã bệnh ICD-10 (`ma_icd10`), tên bệnh chuẩn (`ten_benh`), phân loại bệnh chính/bệnh kèm theo (`loai_chan_doan = 'CHINH' / 'PHU'`). Quan hệ 1 Lượt khám có thể có nhiều chẩn đoán.
- [x] **`bien_ban_dinh_chinh`**:
  - Tuân thủ nguyên tắc y khoa "Four-Eyes Principle" (Nguyên tắc 4 mắt): Khi bệnh án đã khóa, bác sĩ khám không thể tự ý sửa. Bác sĩ phải lập biên bản ghi rõ lý do sửa, dữ liệu trước và sau khi sửa. Biên bản phải được phê duyệt bởi người có thẩm quyền chuyên môn (`nguoi_duyet_id` — Trưởng khoa/Hội đồng chuyên môn).
- [x] **`luot_kham_the_luc`**, **`khai_niem`**, **`mau_bieu_y_te`**: Cấu trúc đầy đủ, phục vụ khám chuyên khoa và in ấn.

### 2.2. Nhóm Bảng SỬA / TINH CHỈNH (Cần bổ sung cột hoặc đổi constraint)
- Không cần sửa đổi cấu trúc cột của 6 bảng này trong MVP. Các cột hiện tại đã đáp ứng hoàn hảo tiêu chí lâm sàng và pháp lý.

### 2.3. Nhóm Bảng BỔ SUNG MỚI
- *Không cần tạo mới bảng*: Vấn đề "Có nên tách sinh hiệu thành bảng riêng `vital_signs`?" đã được phân tích: Với phòng khám ngoại trú (1 lượt khám chỉ đo sinh hiệu 1 lần lúc tiếp đón hoặc đầu buổi khám), việc để sinh hiệu ngay trên bảng `luot_kham` giúp tăng tốc độ đọc dữ liệu (tránh JOIN bảng phụ) mà vẫn đảm bảo tính độc lập dữ liệu.

### 2.4. Nhóm Bảng ĐỀ XUẤT LOẠI KHỎI MVP (Chuyển sang Phase 2)
- Cả 6 bảng đều bắt buộc phải có mặt trong MVP để phục vụ luồng nghiệp vụ khám bệnh thực tế của Bác sĩ.

---

## 3. RÀ SOÁT QUAN HỆ KHÓA NGOẠI XUYÊN PHÂN HỆ (CROSS-SUBSYSTEM FKs)
| Bảng nguồn | Cột FK | Bảng đích | Phân hệ liên đới | Tình trạng kiểm tra |
| :--- | :--- | :--- | :--- | :--- |
| `luot_kham` | `lich_kham_id` | `lich_kham.id` | Phân hệ 3 (Đặt lịch) | Quan hệ 1-1 chính xác |
| `luot_kham` | `benh_nhan_id` | `benh_nhan.id` | Phân hệ 2 (Nhân sự) | Khớp 100% |
| `luot_kham` | `bac_si_id` | `bac_si.id` | Phân hệ 2 (Nhân sự) | Khớp 100% |
| `chi_dinh` | `luot_kham_id` | `luot_kham.id` | Phân hệ 5 (CLS & Đơn thuốc) | 1-N (1 lượt khám có nhiều chỉ định CLS) |
| `don_thuoc` | `luot_kham_id` | `luot_kham.id` | Phân hệ 5 (CLS & Đơn thuốc) | 1-N (1 lượt khám có đơn thuốc) |

---

## 4. CÂU HỎI TƯ DUY PHẢN BIỆN DÀNH CHO THÀNH VIÊN 4 (THINKING PROMPTS)
1. **Tại sao không cho phép Bác sĩ tự ý sửa chẩn đoán hoặc đơn thuốc sau khi bấm Hoàn thành khám?**
   - *Phân tích logic:* Theo Luật Khám bệnh, chữa bệnh 2023 và Thông tư 32/2023/TT-BYT, hồ sơ bệnh án điện tử có giá trị pháp lý tương đương bệnh án giấy. Sau khi bác sĩ ký số và hoàn tất, bệnh án phải đóng băng để bảo đảm không bị làm sai lệch trong trường hợp xảy ra tai biến y khoa hoặc thanh tra BHYT. Mọi sửa đổi bắt buộc phải có biên bản giải trình (`bien_ban_dinh_chinh`) và lưu vết audit log.
2. **Nếu bệnh nhân khám ở chuyên khoa Nhi, các chỉ số sinh hiệu có gì khác biệt?**
   - *Phân tích logic:* Với trẻ em, cân nặng và chiều cao quyết định trực tiếp đến liều lượng thuốc (tính theo mg/kg cân nặng). Việc tích hợp sẵn chiều cao, cân nặng và BMI trên `luot_kham` hỗ trợ bác sĩ kê đơn an toàn.

---

## 5. KẾT LUẬN & XÁC NHẬN CỦA THÀNH VIÊN
- **Đánh giá chung:** Phân hệ Khám lâm sàng & EMR thiết kế rất chuẩn mực y tế, bảo đảm tuân thủ quy chuẩn quốc gia TT 32/2023/TT-BYT.
- **Ý kiến đề xuất:** Đồng ý phê chuẩn toàn bộ 6 bảng của phân hệ vào ERD Mục tiêu.

*Ngày hoàn thành:* 19/10/2026  
*Chữ ký rà soát:* **Thành viên 4 — Hoàng**
