# PHÂN TÍCH KHOẢNG TRỐNG CHỨC NĂNG (FUNCTIONAL GAP ANALYSIS)
## ĐỐI CHIẾU TCLINIC VÀ CLINIC-AI

**Thời điểm lập:** 12/10/2026  
**Tài liệu:** `docs/design/FUNCTIONAL_GAP_ANALYSIS.md`  

---

## 1. Ma trận Phân loại Chức năng

| Chức năng | Phân loại | Hiện trạng Clinic-AI | Nhu cầu Thực tế tClinic | Quyết định Kỹ thuật cho Clinic-AI |
|---|:---:|---|---|---|
| **Đặt lịch trực tuyến & Chia slot 15p** | **ĐÃ CÓ & ĐÚNG** | Service `appointment_service.py` chia slot 15p, có giữ chỗ tạm thời và chống đặt trùng. | tClinic dùng `khoangcachlanhen: 15`. | Giữ nguyên 100%, bảo vệ các invariant kiểm thử. |
| **Phân luồng & Hàng đợi STT** | **ĐÃ CÓ & ĐÚNG** | STT cấp khi check-in, phân luồng theo buồng khám & ca trực, có chính sách ưu tiên. | Cấp STT theo ngày và buồng khám, có cờ `uutien`. | Giữ nguyên, đã vượt trội tClinic về mặt kiểm soát concurrency. |
| **Khám lâm sàng & Sinh hiệu** | **ĐÃ CÓ NHƯNG CẦN MỞ RỘNG** | Đã có nhiệt độ, huyết áp, mạch, cân nặng, chiều cao, chẩn đoán ICD-10. | tClinic có hiển thị tự động BMI, SpO2, tiền sử dị ứng rõ ràng trên form. | Mở rộng schema trả về tự động tính BMI và lưu trữ SpO2, tiền sử dị ứng. |
| **Bắt buộc 1 Chẩn đoán chính ICD-10** | **ĐÃ CÓ & ĐÚNG** | `test_encounter_completion_diagnosis_invariant.py` chặn kết thúc nếu thiếu chẩn đoán chính. | tClinic có radio button chọn đúng 1 bệnh chính (`BC`). | Đã khớp 100% nghiệp vụ thực tế. |
| **Kê đơn thuốc & FSM 11 bước** | **ĐÃ CÓ & VƯỢT TRỘI** | Máy trạng thái FSM 11 bước, khóa cứng đơn khi ký, đính chính có liên kết supersede, Idempotency-Key. | tClinic kê đơn theo sáng/trưa/chiều/tối, đồng bộ Cổng Quốc gia. | Giữ nguyên kiến trúc FSM, đảm bảo tương thích form kê đơn. |
| **Kỹ thuật viên Cận lâm sàng (CLS/PACS)** | **CHƯA CÓ & CẦN THÊM** | Có bảng `chi_dinh_dich_vu` nhưng chưa có luồng thực hiện cho KTV CLS. | tClinic có trang riêng `/pttt` và `/kedichvu/canlamsang` để KTV cập nhật trạng thái & trả kết quả. | **THÊM MỚI:** `subclinical_service.py` + Router `/api/v1/subclinical/*` + Enum trạng thái thực hiện. |
| **Thu ngân & Quản lý Viện phí Chi tiết** | **CHƯA CÓ & CẦN THÊM** | Chỉ có bảng giá dịch vụ và cờ đã thanh toán đơn giản. | tClinic có Bàn Thu ngân `/thutien`, gom tiền công khám, thuốc, CLS, hỗ trợ VietQR, in biên lai, khóa sổ ca trực. | **THÊM MỚI:** `cashier_service.py` + Router `/api/v1/cashier/*` + Bảng `hoa_don`, `chi_tiet_hoa_don`. |
| **Khám Thể lực theo TT 32/2023** | **CHƯA CÓ & CẦN THÊM** | Chưa có mẫu khám chuyên sâu theo 8 hệ cơ quan. | tClinic có các tab khám chuyên khoa (Nội, Ngoại, Mắt, TMH, RHM, Da liễu, Phụ sản). | **THÊM MỚI:** Bảng `luot_kham_the_luc` + API ghi nhận kết quả khám chuyên khoa và xếp loại thể lực. |
| **Quyết toán BHYT & Giám định** | **NGOÀI PHẠM VI (OUT OF SCOPE)** | Không triển khai. | tClinic có cổng BHYT. | **BẢO LƯU QUYẾT ĐỊNH:** Phòng khám tư nhân ngoại trú thanh toán trực tiếp, không làm BHYT. |
