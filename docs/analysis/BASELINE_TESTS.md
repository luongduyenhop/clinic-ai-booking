# BÁO CÁO KIỂM THỬ TRẠNG THÁI GỐC (BASELINE TEST SUITE REPORT)
## DỰ ÁN CLINIC-AI BACKEND

**Thời điểm chạy:** 12/10/2026  
**Môi trường:** Python 3.14.0, Pytest 9.1.1, AnyIO 4.15.1, AsyncIO 1.4.0, Windows 11  
**Tài liệu:** `docs/analysis/BASELINE_TESTS.md`  

---

## 1. Kết quả Tổng quan Thực tế

```text
======================== 364 tests collected ========================
===== 359 passed, 4 skipped, 1 xfailed, 0 failed in 803.55s (13:23) =====
======================== EXIT CODE: 0 (SUCCESS) =======================
```

---

## 2. Bảng Phân bố & Trọng tâm Kiểm thử của Từng Module

| File Test Suite | Số Test | Trạng thái | Nghiệp vụ Cốt lõi & Ràng buộc Bất biến (Invariants) được Bảo vệ |
|---|:---:|:---:|---|
| `test_admin_and_reception_flow.py` | 4 | 4 PASSED | Luồng tiếp đón, phối hợp Admin & Lễ tân tạo tài nguyên và gán ca |
| `test_admin_command_center.py` | 1 | 1 PASSED | Bàn điều hành chỉ huy trung tâm, số liệu thống kê thời gian thực |
| `test_admin_doctor_management.py` | 3 | 3 PASSED | Quản trị bác sĩ, ràng buộc chuyên khoa và liên kết tài khoản |
| `test_admin_openmrs_bahmni_packages.py` | 6 | 6 PASSED | Tương thích gói dịch vụ theo chuẩn OpenMRS & Bahmni |
| `test_adversarial_prescription_fsm.py` | 5 | 4 PASSED, 1 XFAIL | Tấn công kiểm thử FSM đơn thuốc (chặn nhảy cóc trạng thái bất hợp pháp) |
| `test_ai_byt_benchmarks.py` | 10 | 10 PASSED | Đánh giá Benchmark phân luồng triệu chứng theo hướng dẫn Bộ Y tế |
| `test_ai_red_flags.py` | 24 | 24 PASSED | Nhận diện dấu hiệu nguy hiểm (Red Flags), cảnh báo cấp cứu khẩn cấp |
| `test_api_smoke.py` | 4 | 4 PASSED | Kiểm tra khói toàn bộ các endpoint public và tài liệu OpenAPI |
| `test_appointment_booking.py` | 19 | 19 PASSED | Đặt lịch trực tuyến, giữ chỗ tạm thời (lock slot), xác thực bệnh nhân |
| `test_appointment_cancel.py` | 19 | 19 PASSED | Quy tắc hủy lịch hẹn, giải phóng slot khám, ghi nhận lý do hủy |
| `test_appointment_locking.py` | 4 | 4 SKIPPED | Concurrency locking ở tầng Redis/In-memory (được thay thế bằng DB Lock) |
| `test_appointment_reschedule.py` | 4 | 4 PASSED | Đổi lịch khám, hủy vé hàng đợi cũ nếu đã check-in |
| `test_appointment_rules.py` | 5 | 5 PASSED | Các ràng buộc thời gian (không đặt quá khứ, không quá số lượng/ca) |
| `test_appointment_slots.py` | 27 | 27 PASSED | Chia slot 15-30 phút theo ca làm việc, kiểm tra sức chứa phòng khám |
| `test_arrival_window_priority.py` | 1 | 1 PASSED | Cửa sổ đến sớm/đến muộn (Arrival window) và chính sách ưu tiên online |
| `test_auth_profile.py` | 17 | 17 PASSED | Đăng nhập JWT, băm mật khẩu BCrypt, OTP kích hoạt, hồ sơ cá nhân |
| `test_bahmni_queue_flow.py` | 5 | 5 PASSED | Luồng hàng đợi Bahmni/O3, bảo tồn timestamp, hủy vé khi đổi lịch |
| `test_challenger_m1_adversarial.py` | 19 | 19 PASSED | Kiểm thử đối kháng M1: Chặn bác sĩ hết hạn CCHN tạo lịch, khám bệnh |
| `test_challenger_m2_gateway_adversarial.py` | 20 | 20 PASSED | Kiểm thử đối kháng M2: Gateway timeout, Idempotency-Key trùng lặp |
| `test_clinic_time.py` | 4 | 4 PASSED | Chuẩn hóa múi giờ y tế `Asia/Ho_Chi_Minh` (UTC+7) |
| `test_clinical_skeleton.py` | 18 | 18 PASSED | Khung nghiệp vụ lâm sàng, sinh hiệu, chẩn đoán, dị ứng thuốc |
| `test_compliance_audit_trail.py` | 11 | 11 PASSED | Bảng ghi nhật ký truy cập dữ liệu sức khỏe bắt buộc theo NĐ 102/2025 |
| `test_compliance_credentialing.py` | 28 | 28 PASSED | Vòng đời CCHN bác sĩ và giấy phép cơ sở theo NĐ 96/2023 |
| `test_compliance_dashboard.py` | 14 | 14 PASSED | Dashboard giám sát tuân thủ dành cho Giám đốc chuyên môn |
| `test_compliance_dashboard_and_audit_api.py` | 2 | 2 PASSED | API truy vấn nhật ký kiểm toán và xuất báo cáo tuân thủ |
| `test_compliance_prescription_fsm.py` | 23 | 23 PASSED | 11 trạng thái FSM đơn thuốc, tính bất biến sau ký số TT 26/2025 |
| `test_emergency_leave_and_queue_rerouting.py` | 4 | 4 PASSED | Xử lý bác sĩ nghỉ đột xuất: điều chuyển hàng đợi, tái phân bổ STT |
| `test_encounter_completion_diagnosis_invariant.py` | 5 | 5 PASSED | Bắt buộc phải có đúng 1 chẩn đoán chính ICD-10 trước khi hoàn tất khám |
| `test_encounter_completion_queue_sync.py` | 6 | 6 PASSED | Đồng bộ trạng thái vé hàng đợi khi kết thúc ca khám (Đang khám -> Đã khám) |
| `test_flow_board_bahmni_o3.py` | 5 | 5 PASSED | Bảng luồng điều phối theo mô hình Bahmni O3 Flow Board |
| `test_medical_catalog.py` | 4 | 4 PASSED | Danh mục dịch vụ kỹ thuật theo Thông tư 22/2024/TT-BYT |
| `test_medical_record_immutability_and_amendment.py` | 4 | 4 PASSED | Tính bất biến hồ sơ bệnh án (EMR) và quy trình đính chính 4 mắt (Four-Eyes) |
| `test_noshow_waitlist.py` | 14 | 14 PASSED | Xử lý bệnh nhân không đến (No-show), danh sách chờ (Waitlist) FIFO |
| `test_prescription_flow.py` | 2 | 2 PASSED | Luồng kê đơn và kiểm tra tương tác thuốc |
| `test_queue_guard_a4_concurrency.py` | 4 | 4 PASSED | Chặn bác sĩ gọi bệnh nhân tiếp theo khi ca khám hiện tại chưa kết thúc |
| `test_reception_invariants_and_edge_cases.py` | 4 | 4 PASSED | Chặn check-in lịch tương lai, hạn mức slot ca chiều, không trùng số STT |
| `test_security.py` | 5 | 5 PASSED | Khử độc JWT token, mã hóa mật khẩu, sinh OTP an toàn |
| `test_shift_capacity_enforcement.py` | 2 | 2 PASSED | Chặn đặt khám và walk-in khi ca trực đã chạm ngưỡng tối đa |
| `test_shift_criteria_and_capacity.py` | 3 | 3 PASSED | Tiêu chí phân phòng: Bác sĩ phải đúng chuyên khoa buồng khám vật lý |
| `test_shift_room_allocation.py` | 4 | 4 PASSED | Cấp phát phòng khám cho ca trực, chặn gán trùng phòng trong cùng ca |
| `test_walk_in_full_clinical_lifecycle.py` | 1 | 1 PASSED | Toàn bộ vòng đời bệnh nhân vãng lai (Walk-in) từ tiếp đón đến kết thúc |

---

## 3. Các Ràng buộc Bất biến (Invariants) Tuyệt đối Phải Bảo Toàn

Trong toàn bộ quá trình khảo sát và phát triển tiếp theo, Senior Engineer cam kết bảo vệ 100% các Invariant sau:
1. **INVARIANT 1 (Separation of Concerns):** `LichHen` (Appointment) và `LuotKham` (Encounter) là 2 thực thể độc lập. Đặt lịch chưa sinh ra lượt khám hay hồ sơ y khoa.
2. **INVARIANT 2 (Queue Scoping):** Vé hàng đợi (`HangDoiKham`) chỉ được sinh ra tại thời điểm tiếp đón (Check-in). Số thứ tự (STT) độc lập theo từng phòng khám và từng ca trực (không bao giờ sinh số toàn viện vô nghĩa).
3. **INVARIANT 3 (Clinical Immutability):** Hồ sơ khám (`LuotKham`) sau khi chuyển sang trạng thái `da_ket_thuc` là **BẤT BIẾN (Read-only)**. Mọi sửa đổi phải thông qua Biên bản đính chính (`BienBanDinhChinh`) theo nguyên tắc 4 mắt (Four-Eyes Principle) quy định tại TT 13/2025/TT-BYT.
4. **INVARIANT 4 (Diagnosis Precondition):** Không thể kết thúc lượt khám nếu thiếu Chẩn đoán chính (`chan_doan_chinh`) hoặc mã ICD-10 bị để trống.
5. **INVARIANT 5 (Prescription State Machine):** Đơn thuốc sau khi Ký số (`SIGNED`) bị khóa toàn bộ danh mục thuốc. Không được sửa chữa trực tiếp mà phải thực hiện thủ tục Kê đơn thay thế (`SUPERSEDED`).
6. **INVARIANT 6 (Credentialing Guard):** Bác sĩ có CCHN bị hết hạn (`EXPIRED`) hoặc đình chỉ (`SUSPENDED`) bị hệ thống tự động chặn (HTTP 403) không cho nhận ca, không cho mở ca khám và không cho ký đơn thuốc theo NĐ 96/2023/NĐ-CP.
7. **INVARIANT 7 (No BHYT):** Không triển khai module thanh toán hoặc đẩy dữ liệu cổng quyết toán BHYT.
