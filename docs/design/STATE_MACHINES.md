# THIẾT KẾ MÁY TRẠNG THÁI HỮU HẠN CỐT LÕI (STATE MACHINES SPECIFICATION)
## CÁC CHU TRÌNH SỐNG THỰC THỂ Y TẾ TRONG CLINIC-AI

**Thời điểm lập:** 12/10/2026  
**Tài liệu:** `docs/design/STATE_MACHINES.md`  

---

## 1. Máy Trạng thái Chỉ định Cận lâm sàng (`ChiDinhDichVu`)

```mermaid
stateDiagram-v2
    [*] --> cho_thanh_toan: Bác sĩ kê dịch vụ F7
    
    cho_thanh_toan --> da_thanh_toan: Thu ngân xác nhận thu tiền
    cho_thanh_toan --> da_huy: Bác sĩ / Bệnh nhân hủy chỉ định
    
    da_thanh_toan --> dang_thuc_hien: KTV tiếp nhận / Lấy mẫu bệnh phẩm
    da_thanh_toan --> da_hoan_tien: Bệnh nhân hủy dịch vụ có duyệt hoàn tiền
    
    dang_thuc_hien --> da_co_ket_qua: KTV nhập kết quả & upload file/ảnh
    
    da_co_ket_qua --> [*]: Bác sĩ lâm sàng đọc kết quả & kết luận
    da_huy --> [*]
    da_hoan_tien --> [*]
```

### Quy tắc Chuyển trạng thái & Bất biến:
1. **Chặn thực hiện khi chưa thanh toán:** Kỹ thuật viên CLS chỉ được chuyển trạng thái sang `dang_thuc_hien` khi trạng thái hiện tại là `da_thanh_toan` (trừ trường hợp ca cấp cứu khẩn cấp được phê duyệt).
2. **Khóa kết quả sau khi trả:** Khi đã ở `da_co_ket_qua`, KTV không được tự ý xóa hoặc thay đổi kết quả. Mọi đính chính phải lưu vết lịch sử người sửa và lý do.
3. **Điều kiện kết thúc ca khám:** Nếu lượt khám có bất kỳ chỉ định nào đang ở `cho_thanh_toan`, `da_thanh_toan` hoặc `dang_thuc_hien`, Bác sĩ không thể bấm **Hoàn thành khám** (Hệ thống trả lỗi HTTP 422: *"Vui lòng đợi kết quả CLS hoặc hủy các chỉ định chưa thực hiện"*).

---

## 2. Máy Trạng thái Hóa đơn Viện phí (`HoaDon`)

```mermaid
stateDiagram-v2
    [*] --> chua_thu: Khởi tạo hóa đơn từ đợt khám
    
    chua_thu --> da_thu: Thu ngân xác nhận đủ tiền (Tiền mặt/Chuyển khoản/POS)
    chua_thu --> da_huy: Hủy hóa đơn (do sai sót hoặc thay đổi chỉ định)
    
    da_thu --> da_hoan_tien: Hoàn tiền một phần hoặc toàn bộ (có biên bản)
    
    da_thu --> [*]: Khóa sổ ca trực
    da_huy --> [*]
    da_hoan_tien --> [*]
```

### Quy tắc Bất biến:
1. **Toán học thanh toán:** `thuc_thu = tong_tien - mien_giam`. Tuyệt đối không cho phép `thuc_thu < 0`.
2. **Liên kết đồng bộ:** Khi `HoaDon` chuyển sang `da_thu`, tất cả các `ChiDinhDichVu` liên kết tự động chuyển trạng thái từ `cho_thanh_toan` sang `da_thanh_toan`.

---

## 3. Máy Trạng thái Lượt khám Lâm sàng (`LuotKham`)

```mermaid
stateDiagram-v2
    [*] --> dang_kham: Bác sĩ bắt đầu ca khám (Encounter Start)
    
    dang_kham --> cho_ket_qua_cls: Bác sĩ kê CLS và bệnh nhân đi làm xét nghiệm
    cho_ket_qua_cls --> dang_kham: Đã có đủ kết quả CLS, bệnh nhân quay lại buồng khám
    
    dang_kham --> da_ket_thuc: Bác sĩ hoàn thành khám & chẩn đoán ICD-10
    
    da_ket_thuc --> [*]: Khóa cứng hồ sơ bệnh án (BẤT BIẾN)
```

### Ràng buộc Bất biến Cốt lõi:
1. `da_ket_thuc` là trạng thái **ĐÓNG BĂNG VĨNH VIỄN**. Mọi API ghi đè trực tiếp (`PUT /api/v1/clinical/encounters/:id`) đều bị chặn (HTTP 409 Conflict).
2. Sửa đổi sau khi đóng bắt buộc phải thông qua Biên bản đính chính `BienBanDinhChinh` theo nguyên tắc 4 mắt (Four-Eyes Principle) quy định tại Thông tư 13/2025/TT-BYT.
