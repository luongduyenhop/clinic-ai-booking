# PHIẾU THẨM ĐỊNH PHÂN HỆ CSDL: CẬN LÂM SÀNG, ĐƠN THUỐC & VIỆN PHÍ (SUBCLINICAL, PHARMACY & BILLING)
**Dự án:** Clinic-AI | **Giai đoạn:** Thẩm định ERD Mục tiêu MVP  
**Người phụ trách:** Thành viên 5 — An (Backend & Subclinical/Billing Engine)  
**Tài liệu đối chiếu:** [BANG_KIEM_KE_CSDL_45_BANG.md](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/BANG_KIEM_KE_CSDL_45_BANG.md) | [erd_hien_trang.dbml](file:///d:/dowload/tailieu/clinic-ai-backend/backend/docs/database/erd_hien_trang.dbml)

---

## 1. PHẠM VI BẢNG PHỤ TRÁCH (8 BẢNG CỐT LÕI + 1 BẢNG MỞ RỘNG)
Phân hệ này đảm nhận toàn bộ các nghiệp vụ chuyên môn sau khám lâm sàng: chỉ định và trả kết quả xét nghiệm / chẩn đoán hình ảnh (X-quang, Siêu âm), kê đơn thuốc điện tử ngoại trú theo tiêu chuẩn Bộ Y tế, tính toán chi phí khám chữa bệnh, xuất hóa đơn tài chính và quản lý dòng tiền mặt ca trực của thu ngân.

| STT | Tên bảng | Trách nhiệm dữ liệu cốt lõi | Khóa chính (PK) | Khóa ngoại (FK) chính |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `dich_vu` | Danh mục dịch vụ y tế kỹ thuật (khám, chụp X-quang, xét nghiệm máu, siêu âm) | `id` | Không có |
| 2 | `chi_dinh` | Phiếu chỉ định cận lâm sàng (bác sĩ chỉ định, kỹ thuật viên thực hiện, kết quả, kết luận) | `id` | `luot_kham_id`, `dich_vu_id`, `bac_si_chi_dinh_id` |
| 3 | `don_thuoc` | Đơn thuốc điện tử (lời dặn bác sĩ, mã đơn quốc gia, trạng thái phát thuốc) | `id` | `luot_kham_id`, `bac_si_id`, `benh_nhan_id` |
| 4 | `chi_tiet_don_thuoc` | Chi tiết thuốc: tên hoạt chất, biệt dược, liều dùng, chia 4 cữ (Sáng-Trưa-Chiều-Tối) | `id` | `don_thuoc_id` -> `don_thuoc.id` |
| 5 | `hoa_don` | Hóa đơn viện phí (tổng tiền, BHYT thanh toán, tiền bệnh nhân trả, trạng thái) | `id` | `benh_nhan_id`, `luot_kham_id`, `thu_ngan_id` |
| 6 | `chi_tiet_hoa_don` | Chi tiết từng khoản mục cấu thành viện phí (tiền khám, tiền CLS, tiền thuốc) | `id` | `hoa_don_id` -> `hoa_don.id` |
| 7 | `phieu_thu_chi` | Phiếu giao dịch tiền mặt/chuyển khoản thực tế tại quầy thu ngân | `id` | `hoa_don_id` -> `hoa_don.id`, `nguoi_thuc_hien_id` |
| 8 | `khoa_so_ca_truc` | Biên bản bàn giao doanh thu tiền mặt ca trực cuối ngày giữa các thu ngân | `id` | `thu_ngan_id` -> `nguoi_dung.id` |
| 9 | `danh_gia_dich_vu` | Khảo sát mức độ hài lòng của bệnh nhân sau khi thanh toán và nhận thuốc | `id` | `benh_nhan_id`, `luot_kham_id` |

---

## 2. KẾT QUẢ RÀ SOÁT VÀ PHÂN LOẠI HÀNH ĐỘNG ĐỀ XUẤT

### 2.1. Nhóm Bảng GIỮ NGUYÊN (Đạt chuẩn 100% cho MVP)
- [x] **`dich_vu`**: Đã lưu mã dịch vụ (`ma_dich_vu`), tên dịch vụ, đơn giá niêm yết (`don_gia`), loại dịch vụ (`XET_NGHIEM`, `CHAN_DOAN_HINH_ANH`, `THU_THUAT`, `KHAM`).
- [x] **`don_thuoc` & `chi_tiet_don_thuoc`**:
  - Hỗ trợ kê đơn thuốc chuẩn Bộ Y tế: liều dùng, đường dùng (`uong`, `tiem`, `boi`), số ngày dùng, phân chia rõ ràng 4 cữ thời điểm: `sang`, `trua`, `chieu`, `toi`, ghi chú hướng dẫn dùng (uống trước/sau ăn).
- [x] **`hoa_don` & `chi_tiet_hoa_don`**:
  - Mô hình hóa chuẩn xác dòng tiền viện phí: `tong_tien`, `tien_bhyt_chi_tra`, `tien_mien_giam`, `tien_benh_nhan_tra`, trạng thái `trang_thai` (`CHUA_THANH_TOAN`, `DA_THANH_TOAN`, `HOAN_TIEN`).
- [x] **`phieu_thu_chi` & `khoa_so_ca_truc`**:
  - Đảm bảo tính minh bạch tài chính cho quầy thu ngân: đối soát số tiền hệ thống tính toán với số tiền mặt thực thu trong két trước khi bàn giao ca.

### 2.2. Nhóm Bảng SỬA / TINH CHỈNH (Cần bổ sung cột hoặc đổi constraint)
- [x] **`chi_dinh`**:
  - **Bổ sung cột:** `tep_dinh_kem_url VARCHAR(500) NULL`.
  - **Lý do nghiệp vụ:** Trong khám chữa bệnh thực tế, các dịch vụ Cận lâm sàng (CLS) như Chụp X-quang, Siêu âm Doppler tim/bụng, hoặc Xét nghiệm sinh hóa máu luôn có file ảnh chụp DICOM/PNG hoặc file phiếu in PDF từ máy phân tích. Hiện tại bảng `chi_dinh` chỉ có cột text `ket_qua_do` và `ket_luan`, thiếu nơi lưu đường dẫn tải file đính kèm này để bác sĩ điều trị và bệnh nhân xem trực tiếp trên cổng giao diện.

### 2.3. Nhóm Bảng BỔ SUNG MỚI
- *Không cần tạo mới bảng*: 8 bảng cốt lõi đã bao phủ đầy đủ chuỗi giá trị từ Kê đơn $\rightarrow$ Thu ngân $\rightarrow$ Khóa sổ ca trực.

### 2.4. Nhóm Bảng ĐỀ XUẤT LOẠI KHỎI MVP (Chuyển sang Phase 2)
- [x] **`danh_gia_dich_vu`**: Đề xuất xếp vào nhóm Phase 2 (Cổng chăm sóc khách hàng & trải nghiệm người dùng) để tập trung nguồn lực kiểm thử luồng viện phí cốt lõi.

---

## 3. RÀ SOÁT QUAN HỆ KHÓA NGOẠI XUYÊN PHÂN HỆ (CROSS-SUBSYSTEM FKs)
| Bảng nguồn | Cột FK | Bảng đích | Phân hệ liên đới | Tình trạng kiểm tra |
| :--- | :--- | :--- | :--- | :--- |
| `chi_dinh` | `luot_kham_id` | `luot_kham.id` | Phân hệ 4 (Khám bệnh) | Khớp 100% |
| `don_thuoc` | `luot_kham_id` | `luot_kham.id` | Phân hệ 4 (Khám bệnh) | Khớp 100% |
| `hoa_don` | `luot_kham_id` | `luot_kham.id` | Phân hệ 4 (Khám bệnh) | Khớp 100% |
| `hoa_don` | `benh_nhan_id` | `benh_nhan.id` | Phân hệ 2 (Nhân sự) | Khớp 100% |
| `khoa_so_ca_truc`| `thu_ngan_id` | `nguoi_dung.id` | Phân hệ 1 (Người dùng) | Khớp 100% |

---

## 4. CÂU HỎI TƯ DUY PHẢN BIỆN DÀNH CHO THÀNH VIÊN 5 (THINKING PROMPTS)
1. **Nếu bệnh nhân chỉ định làm 3 xét nghiệm, nhưng chỉ đủ tiền làm 2 xét nghiệm thì xử lý ở CSDL thế nào?**
   - *Phân tích logic:* Mỗi xét nghiệm là 1 dòng độc lập trong bảng `chi_dinh` với trạng thái riêng (`CHO_THUC_HIEN`, `DA_THUC_HIEN`, `DA_HUY`). Khi sinh hóa đơn `hoa_don`, bảng `chi_tiet_hoa_don` sẽ chỉ liên kết với 2 bản ghi `chi_dinh` được bệnh nhân đồng ý thực hiện và thanh toán. Bản ghi thứ 3 sẽ được chuyển sang trạng thái hủy.
2. **Tại sao cần bảng `khoa_so_ca_truc` độc lập với `phieu_thu_chi`?**
   - *Phân tích logic:* `phieu_thu_chi` là từng giao dịch vi mô (micro-transaction) của từng bệnh nhân. `khoa_so_ca_truc` là nghiệp vụ kế toán vĩ mô (macro-reconciliation) nhằm chốt tổng thu trong ca làm việc, đối chiếu chênh lệch giữa tiền mặt thực tế trong két và tiền ghi nhận trên phần mềm, tránh thất thoát tài chính.

---

## 5. KẾT LUẬN & XÁC NHẬN CỦA THÀNH VIÊN
- **Đánh giá chung:** Nghiệp vụ tài chính, cận lâm sàng và đơn thuốc được thiết kế rất chặt chẽ. Cột `tep_dinh_kem_url` bổ sung cho `chi_dinh` là cực kỳ thiết thực.
- **Ý kiến đề xuất:** Đồng ý đưa `tep_dinh_kem_url` vào bảng `chi_dinh` trong ERD Mục tiêu.

*Ngày hoàn thành:* 19/10/2026  
*Chữ ký rà soát:* **Thành viên 5 — An**
