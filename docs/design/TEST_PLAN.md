# KẾ HOẠCH KIỂM THỬ TOÀN DIỆN (TEST PLAN)
## ĐẢM BẢO CHẤT LƯỢNG VÀ BẢO VỆ INVARIANTS CHO CLINIC-AI EXTENSIONS

**Thời điểm lập:** 12/10/2026  
**Tài liệu:** `docs/design/TEST_PLAN.md`  
**Test Suite hiện hữu:** 359 tests passed, 4 skipped, 1 xfailed (0 failed)  
**Mục tiêu:** 100% Pass hồi quy + 100% Pass các test suite mới cho Thu ngân, Cận lâm sàng và Khám thể lực  

---

## 1. Chiến lược Kiểm thử (Testing Strategy)

Hệ thống Clinic-AI áp dụng mô hình Kim tự tháp kiểm thử (Test Pyramid):
1. **Unit & Invariant Tests (Tầng Service):** Kiểm tra tính toán viện phí, ràng buộc số học, kiểm tra điều kiện chuyển đổi trạng thái FSM (State Transitions) cho Hóa đơn và Chỉ định CLS.
2. **Integration & API Tests (Tầng Router & DB):** Kiểm tra các endpoint RESTful với database thật / in-memory, xác thực token JWT, kiểm tra phân quyền vai trò (Role-Based Access Control).
3. **Concurrency & Race Conditions Tests:** Kiểm tra trường hợp hai thu ngân cùng thanh toán một hóa đơn hoặc hai kỹ thuật viên cùng nhận một chỉ định CLS (sử dụng SELECT FOR UPDATE / transaction locks).
4. **Regression Safety (Kiểm thử Hồi quy):** Chạy lại toàn bộ 359 baseline tests để chứng minh các thay đổi không phá vỡ bất kỳ luồng hoạt động cũ nào.

---

## 2. Ma trận Test Suites Mới Cần Triển Khai

| STT | File Test | Số lượng Test dự kiến | Phạm vi Kiểm thử |
|---|---|---|---|
| 1 | `tests/test_cashier_and_invoicing.py` | 8 - 10 tests | - Tạo hóa đơn từ lượt khám (tự động gom công khám + CLS + thuốc)<br>- Thanh toán tiền mặt, chuyển khoản, POS<br>- Không cho phép thanh toán 2 lần trên cùng hóa đơn<br>- Hủy hóa đơn (chỉ khi chưa thu hoặc có lý do hợp lệ)<br>- Báo cáo tổng kết ca trực và đóng sổ ca thu ngân |
| 2 | `tests/test_subclinical_technician_flow.py` | 8 - 10 tests | - Lấy danh sách hàng đợi theo phòng kỹ thuật<br>- Chuyển trạng thái sang `dang_thuc_hien`<br>- Nhập kết quả xét nghiệm / chẩn đoán hình ảnh kèm kết luận<br>- Bác sĩ chỉ xem và kết luận khi CLS đã hoàn thành<br>- Chặn hoàn tất ca khám khi còn chỉ định CLS dở dang |
| 3 | `tests/test_physical_exam_tt32.py` | 4 - 6 tests | - Ghi nhận chỉ số thể lực (BMI, Mắt, RHM, TMH, Tuần hoàn...)<br>- Tự động tính toán BMI từ chiều cao và cân nặng<br>- Phân loại thể lực từ Loại I đến Loại V theo quy chuẩn TT 32/2023 |
| 4 | `tests/test_concurrency_cashier_and_cls.py` | 3 - 4 tests | - Kiểm tra idempotency khi gọi thanh toán đồng thời<br>- Kiểm tra tranh chấp nhận mẫu xét nghiệm |

---

## 3. Danh mục Ràng buộc Bất biến (Invariants) Cần Kiểm Tra

1. **Số tiền thực thu không âm:**
   $$\text{thuc\_thu} = \max(0, \text{tong\_tien} - \text{mien\_giam})$$
2. **Tính toán chi tiết hóa đơn (Sum of Lines):**
   $$\text{tong\_tien} = \sum (\text{so\_luong}_i \times \text{don\_gia}_i)$$
3. **FSM Hóa đơn không hồi tố:**
   - Trạng thái `da_thu` không thể quay lại `chua_thu`.
   - Trạng thái `da_huy` là trạng thái kết thúc (Terminal State).
4. **CLS Guard khi Hoàn tất Khám (Encounter Completion Guard):**
   - Không thể kết thúc lượt khám (`HOAN_THANH`) nếu tồn tại chỉ định CLS ở trạng thái `cho_thanh_toan` hoặc `dang_thuc_hien`. Bác sĩ phải chờ kết quả hoặc chủ động bấm Hủy chỉ định.
5. **Khám Thể lực 1-1 với Lượt khám:**
   - Mỗi lượt khám chỉ có tối đa 1 bản ghi `luot_kham_the_luc`. Ghi đè hoặc cập nhật phải giữ nguyên ID liên kết.

---

## 4. Quy trình Thực thi và Tiêu chí Đạt (Pass Criteria)

1. **Tiêu chuẩn Hoàn thành:**
   - Lệnh `pytest` thực thi thành công 100% không có lỗi đỏ (0 failed).
   - Tối thiểu 380+ tests passed (359 tests cũ + 25+ tests mới).
   - Không có regression warnings hoặc deprecation errors nghiêm trọng.
