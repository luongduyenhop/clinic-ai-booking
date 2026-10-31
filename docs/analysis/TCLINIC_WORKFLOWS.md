# QUY TRÌNH NGHIỆP VỤ THỰC TẾ TCLINIC (WORKFLOWS SPECIFICATION)
## CÁC LUỒNG TÁC NGHIỆP ĐIỀU HÀNH PHÒNG KHÁM NGOẠI TRÚ

**Thời điểm lập:** 12/10/2026  
**Tài liệu:** `docs/analysis/TCLINIC_WORKFLOWS.md`  

---

## 1. Luồng 1: Tiếp đón & Điều phối Hàng đợi (Reception & Queueing)

```mermaid
sequenceDiagram
    autonumber
    actor BN as Bệnh nhân
    actor LT as Lễ tân (Quầy tiếp đón)
    participant SYS as Hệ thống Clinic-AI
    participant DB as Database PostgreSQL
    participant TV as Màn hình TV Phòng chờ

    BN->>LT: Đến quầy (Xuất trình CCCD / SĐT / Mã hẹn Medpro)
    LT->>SYS: Bấm F8 tra cứu lịch sử cũ (hoặc F2 tạo mới)
    SYS->>DB: Query bảng nguoi_dung & benh_nhan (<300ms)
    DB-->>SYS: Trả về hồ sơ bệnh nhân
    LT->>SYS: Chọn Chuyên khoa / Bác sĩ khám (có AI Triage hỗ trợ gợi ý)
    LT->>SYS: Bấm F5 Lưu đăng ký
    SYS->>DB: Sinh makcb (YYMMDDxxxx), tạo HangDoiKham (STT)
    SYS->>TV: Push WebSocket cập nhật số thứ tự phòng chờ
    SYS->>LT: In phiếu khám F9 trao cho Bệnh nhân
    LT->>BN: Hướng dẫn bệnh nhân tới cửa phòng khám chỉ định
```

- **Quy tắc bất biến:**
  - `makcb` sinh tự động theo mẫu `YYMMDD` + 4 số tăng dần trong ngày.
  - Cờ `uutien` (người già >75t, phụ nữ mang thai, trẻ em <6t) được ưu tiên xếp vào nhóm gọi số trước.

---

## 2. Luồng 2: Khám lâm sàng & Chỉ định Cận lâm sàng (Clinical & Subclinical Order)

```mermaid
sequenceDiagram
    autonumber
    actor BS as Bác sĩ Lâm sàng
    actor BN as Bệnh nhân
    actor TN as Thu ngân Viện phí
    actor KTV as Kỹ thuật viên CLS
    participant SYS as Hệ thống Clinic-AI

    BS->>SYS: Bấm gọi số tiếp theo (Call Next Ticket)
    SYS->>BN: Loa / Màn hình phòng khám hiển thị số vào phòng
    BS->>SYS: Khởi tạo LuotKham (Encounter)
    BS->>SYS: Nhập Sinh hiệu (Mạch, Nhiệt, Huyết áp, Nhịp thở, SpO2, Cân nặng -> BMI)
    BS->>SYS: Nhập Chẩn đoán sơ bộ & Kê dịch vụ CLS (F7)
    SYS->>SYS: Tạo ChiDinhDichVu (Trạng thái: cho_thanh_toan)
    BS->>BN: Hướng dẫn sang quầy Thu ngân đóng viện phí CLS
    BN->>TN: Thanh toán tiền dịch vụ kỹ thuật
    TN->>SYS: Xác nhận thanh toán HoaDon
    SYS->>SYS: Chuyển ChiDinhDichVu sang da_thanh_toan
    SYS->>KTV: Xuất hiện trong Danh sách chờ thực hiện tại phòng CLS
```

---

## 3. Luồng 3: Thực hiện CLS & Trả kết quả (Subclinical Execution & Result Return)

```mermaid
sequenceDiagram
    autonumber
    actor KTV as Kỹ thuật viên CLS
    actor BS as Bác sĩ Lâm sàng
    participant SYS as Hệ thống Clinic-AI
    participant PACS as Lưu trữ Hình ảnh / File

    KTV->>SYS: Mở Bàn làm việc CLS, chọn ca bệnh
    KTV->>SYS: Cập nhật trạng thái: dang_thuc_hien (Lấy mẫu / Chụp X-quang)
    KTV->>PACS: Upload file hình ảnh kết quả / Nhập chỉ số xét nghiệm
    KTV->>SYS: Bấm Lưu & Trả kết quả (da_co_ket_qua)
    SYS->>BS: Thông báo thời gian thực về Bàn khám lâm sàng: Đã có kết quả CLS
    BS->>SYS: Mở xem kết quả hình ảnh và chỉ số
    BS->>SYS: Chọn đúng 1 Bệnh chính (BC) mã ICD-10 và bệnh kèm theo
```

---

## 4. Luồng 4: Kê đơn thuốc, Ký số & Khóa hồ sơ Bệnh án EMR (Prescription & Locking)

```mermaid
sequenceDiagram
    autonumber
    actor BS as Bác sĩ Lâm sàng
    participant SYS as Hệ thống Clinic-AI
    participant QG as Cổng Đơn thuốc Quốc gia
    participant DB as Database PostgreSQL

    BS->>SYS: Kê đơn thuốc (hoặc nạp Đơn mẫu), chia liều Sáng/Trưa/Chiều/Tối, Lời dặn
    BS->>SYS: Ký số USB PKI / Khóa đơn thuốc
    SYS->>SYS: FSM DonThuoc chuyển sang SIGNED (Khóa cứng danh mục thuốc)
    SYS->>QG: Đồng bộ liên thông Cổng Quốc gia với Idempotency Key
    BS->>SYS: Bấm Hoàn thành khám (save)
    SYS->>SYS: Kiểm tra Invariants (Có đủ 1 bệnh chính ICD-10, các chỉ định CLS đã xong hoặc hủy)
    SYS->>DB: LuotKham chuyển sang da_ket_thuc (BẤT BIẾN / Read-only)
    SYS->>DB: HangDoiKham chuyển sang da_kham
```

---

## 5. Luồng 5: Thu ngân Viện phí & Khóa sổ Ca trực (Cashier Billing & Shift Closing)

```mermaid
sequenceDiagram
    autonumber
    actor TN as Thu ngân / Kế toán
    actor QL as Quản lý Phòng khám (Admin)
    participant SYS as Hệ thống Clinic-AI
    participant QR as Dịch vụ VietQR

    TN->>SYS: Mở Bàn Thu ngân (/thutien), tra cứu Mã KCB
    SYS->>SYS: Tự động gom các khoản chưa thu (Công khám, Thuốc, Cận lâm sàng)
    TN->>SYS: Chọn hình thức thanh toán (Tiền mặt / Chuyển khoản / Cà thẻ POS)
    opt Chuyển khoản
        SYS->>QR: Sinh mã VietQR động có kèm Số tiền & Mã KCB
        TN->>SYS: Kiểm tra tiền vào tài khoản
    end
    TN->>SYS: Bấm Lưu F5 & In biên lai F9
    SYS->>SYS: Ghi nhận HoaDon (da_thu), cập nhật trạng thái thanh toán dịch vụ
    Note over TN,SYS: Cuối ca làm việc
    TN->>SYS: Mở Báo cáo thu ngân theo ca (/api/v1/cashier/shift-summary)
    TN->>SYS: Bấm Khóa sổ ca trực (Close Shift)
    SYS->>QL: Gửi bảng tổng kết doanh thu phân theo hình thức thu để đối soát
```
