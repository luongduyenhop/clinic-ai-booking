# DANH MỤC TÍNH NĂNG KHẢO SÁT THỰC TẾ TCLINIC (FEATURE INVENTORY)
## PHÂN HỆ, VAI TRÒ & ĐỐI CHIẾU NỀN TẢNG CLINIC-AI

**Thời điểm lập:** 12/10/2026  
**Cơ sở y tế khảo sát:** Phòng khám Đa khoa Quang Lâm (`https://demo.tclinic.io`)  
**Tài liệu:** `docs/analysis/TCLINIC_FEATURE_INVENTORY.md`  

---

## 1. Bảng Danh mục Tính năng Tổng thể Quan sát được

| Phân hệ (Module) | Tính năng chi tiết quan sát được | Vai trò thực hiện | Trạng thái trên tClinic | Trạng thái trên Clinic-AI | Hướng xử lý / Nâng cấp |
|---|---|:---:|:---:|:---:|---|
| **1. Bàn làm việc (Workbench)** | Bàn Quản lý, Lễ tân, Bác sĩ, Thu ngân, Thống kê | Đa vai trò | Có sẵn trên Topbar & Tabs | Đã có 5 Bàn làm việc | Nâng cấp liên kết dữ liệu thời gian thực giữa các Bàn |
| **2. Tiếp đón (Reception)** | Đăng ký nhanh F2, Lưu F5, Kê dịch vụ F7, Lịch sử F8 | Lễ tân | Hoạt động đầy đủ | Đã có giao diện F2/F5 | Mở rộng API tạo mã KCB `YYMMDDxxxx` và tra cứu <300ms |
| **3. Lịch hẹn (Appointments)** | Đặt khám, chia slot 15p, hẹn tái khám | Bệnh nhân / Lễ tân | Có module riêng | Đã có `test_appointment_booking.py` | Bảo toàn thuật toán chia slot 15p |
| **4. Hàng đợi (Queue)** | Cấp STT theo buồng khám, cờ Ưu tiên (UT), gọi loa | Lễ tân / Bác sĩ | Cấp STT theo ngày | Đã có `test_queue_guard_a4.py` | Giữ nguyên Invariant STT theo phòng & ca |
| **5. Khám lâm sàng (Clinical)** | Sinh hiệu (Temp, Breath, Weight, BMI, SpO2), Dị ứng | Bác sĩ | Hoạt động đầy đủ | Đã có `test_clinical_skeleton.py` | Bổ sung tự động tính BMI và SpO2 |
| **6. Chẩn đoán ICD-10** | Chọn đúng 1 Bệnh chính (BC) qua Radio, Bệnh kèm theo | Bác sĩ | Bắt buộc 1 Bệnh chính | Đã có `test_encounter_completion` | Đã khớp 100% Invariant chẩn đoán chính |
| **7. Cận lâm sàng (CLS/PT-TT)** | Kê CLS, chỉ định phòng thực hiện, nhận mẫu, trả kết quả | Bác sĩ / KTV | Module riêng `/pttt`, `/kedichvu` | Thiếu workbench riêng cho KTV | **CẦN BỔ SUNG:** Phân hệ Kỹ thuật viên CLS & API kết quả |
| **8. Đơn thuốc & Dược** | Kê đơn, chia sáng/trưa/chiều/tối, đơn mẫu, đồng bộ QG | Bác sĩ / Dược sĩ | Hoạt động đầy đủ | Đã có FSM 11 bước (TT 26/2025) | Đã chuẩn hóa vượt trội tClinic |
| **9. Thu ngân & Viện phí** | Hóa đơn đa khoản, Tiền mặt/Chuyển khoản/POS, VietQR, Khóa sổ | Thu ngân / Kế toán | Hoạt động đầy đủ `/thutien` | Chưa có service hóa đơn chi tiết | **CẦN BỔ SUNG:** `cashier_service.py` & Invoicing API |
| **10. Khám thể lực TT 32** | Khám 8 chuyên khoa sâu, phân loại sức khỏe Loại I - V | Bác sĩ | Có trong khám lâm sàng | Chưa có bảng chi tiết thể lực | **CẦN BỔ SUNG:** Bảng `luot_kham_the_luc` |
| **11. Quyết toán BHYT** | Đẩy cổng giám định BHYT, tra cứu thẻ BHYT | Kế toán BHYT | Có trên tClinic | **LOẠI BỎ (OUT OF SCOPE)** | Tuyệt đối không tích hợp theo Baseline phòng khám tư |
