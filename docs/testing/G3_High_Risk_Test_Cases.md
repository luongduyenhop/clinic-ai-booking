# CLINIC-AI — HIGH-RISK DEEP-DIVE TEST SPECIFICATIONS (GATE G3)

**Tài liệu:** Đặc tả Kiểm thử Chuyên sâu cho 6 Khu vực Rủi ro Cao  
**Phiên bản:** v1.1 — Revised (Đã xử lý toàn bộ 3 điểm P0 và 4 điểm P1, đối chiếu 1-1 với Source Code & PostgreSQL Schema)  
**Căn cứ:** [`G1_Requirement_Baseline_and_RTM.md`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/G1_Requirement_Baseline_and_RTM.md) & [`G2_Test_Plan.md`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/G2_Test_Plan.md)  
**Mục tiêu:** Chứng minh tính đúng đắn của Transaction, Concurrency (`SELECT ... FOR UPDATE`), Rollback sau `flush()`, Khóa bất biến (Immutability) và Toàn vẹn dữ liệu PostgreSQL (`QO-02` & `QO-03`).

---

# 1. Khu vực Rủi ro Cao #1 — Đặt lịch Đồng thời, Giới hạn Ca khám & Rollback (`APT-003`, `APT-004`)

**Phụ trách thực thi:** Tùng | **Review chéo:** Hợp  

## 1.0. Đối chiếu Cơ chế Thực tế trong Source Code & Database (Giải quyết P0-1 & P0-2)

Qua đối chiếu trực tiếp [`014_reception_schema_sprint1.py`](file:///d:/dowload/tailieu/clinic-ai/backend/alembic/versions/014_reception_schema_sprint1.py#L46-L60) và [`appointment_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/appointment_service.py#L186-L364), hệ thống kiểm soát giới hạn đặt lịch ở **2 tầng độc lập** (không trộn lẫn giữa Slot 30 phút và Ca làm việc):

1. **Tầng 1 — Sức chứa của 1 Khung giờ 30 phút (`gio_kham`) là ĐÚNG 1 BỆNH NHÂN (1-1)**:
   - Mỗi ca làm việc (`LichLamViec`) được chia thành các slot 30 phút (`08:00`, `08:30`, `09:00`...).
   - Tại một mốc `(bac_si_id, ngay_kham, gio_kham)` cụ thể, **chỉ có tối đa 01 lịch hẹn đang hoạt động**.
   - Cơ chế bảo vệ kép:
     - **Khóa dòng bi quan cấp ứng dụng**: Khóa dòng ca làm việc `SELECT ... FROM lich_lam_viec WHERE bac_si_id = :id AND ngay_lam_viec = :date AND is_active = true ORDER BY id FOR UPDATE` (`appointment_service.py` dòng 191) để tuần tự hóa mọi request đặt lịch của cùng bác sĩ trong ngày.
     - **Ràng buộc Unique Partial Index cấp CSDL** (`014_reception_schema_sprint1.py` dòng 47–60):
       ```sql
       CREATE UNIQUE INDEX uq_active_doctor_slot
       ON lich_kham (bac_si_id, ngay_kham, gio_kham)
       WHERE trang_thai IN ('da_tiep_nhan', 'da_xac_nhan', 'dang_kham')
         AND bac_si_id IS NOT NULL
         AND gio_kham IS NOT NULL;

       CREATE UNIQUE INDEX uq_active_patient_slot
       ON lich_kham (benh_nhan_id, ngay_kham, gio_kham)
       WHERE trang_thai IN ('da_tiep_nhan', 'da_xac_nhan', 'dang_kham')
         AND gio_kham IS NOT NULL;
       ```

2. **Tầng 2 — Sức chứa tối đa của cả Ca làm việc (`LichLamViec.gioi_han_ca_kham = N`)**:
   - Một ca làm việc (ví dụ Ca sáng `08:00 - 12:00` có 8 mốc giờ 30 phút) có cấu hình `gioi_han_ca_kham = 5` (tối đa 5 bệnh nhân được đặt trong toàn bộ ca sáng đó).
   - Cơ chế bảo vệ (`appointment_service.py` dòng 291–318): Sau khi giữ khóa `FOR UPDATE` trên `LichLamViec`, hệ thống đếm tổng số `LichKham` active trong khoảng `[gio_bat_dau, gio_ket_thuc)`. Nếu `booked_in_shift >= active_shift.gioi_han_ca_kham`, hệ thống từ chối `HTTP 409 Conflict` ngay cả khi mốc giờ 30 phút mà bệnh nhân chọn vẫn đang trống.

---

## 1.1. `TC-APT-004-01` — Hai bệnh nhân đặt đồng thời vào 2 khung giờ trống khác nhau khi Ca làm việc chỉ còn đúng 1 suất cuối cùng (`gioi_han_ca_kham = 5`)
- **Requirement ID:** `APT-004` | **Scenario ID:** `TS-APT-004-01` | **Priority:** `Critical`
- **Mục tiêu:** Kiểm chứng cơ chế khóa `LichLamViec ... FOR UPDATE` và đếm `booked_in_shift` khi tổng số chỗ của cả ca khám chỉ còn 1 suất.
- **Preconditions & DB Pre-state:**
  - Bác sĩ `bac_si_id = 3` có ca làm việc sáng ngày `D` (`08:00 - 12:00`, gồm 8 slot 30 phút), cấu hình giới hạn ca `gioi_han_ca_kham = 5`.
  - Trong bảng `lich_kham`, ca sáng ngày `D` của bác sĩ `3` đã có **4 lịch hẹn active** tại các khung giờ `08:00`, `08:30`, `09:00`, `09:30` (còn **đúng 1 suất trống** cho cả ca sáng).
  - Hai khung giờ `10:00` và `10:30` đều đang hiển thị `available`.
  - Hai tài khoản bệnh nhân hợp lệ: `TEST_ACC_PAT_01` (`benh_nhan_id = 101`) và `TEST_ACC_PAT_02` (`benh_nhan_id = 102`).
- **Action (Test Steps):**
  1. `TEST_ACC_PAT_01` gửi `POST /api/v1/appointments` đặt vào mốc `gio_kham = "10:00"`.
  2. Đồng thời (`asyncio.gather`), `TEST_ACC_PAT_02` gửi `POST /api/v1/appointments` đặt vào mốc `gio_kham = "10:30"` của cùng bác sĩ `3` trong ngày `D`.
- **Expected API Response:**
  - Nhờ khóa bi quan `with_for_update()` trên `LichLamViec`, 2 giao dịch được tuần tự hóa:
    - Đúng **01 request** nhận `HTTP 201 Created` (lấy suất thứ 5 của ca sáng).
    - Đúng **01 request** nhận `HTTP 409 Conflict` với thông báo: `"Ca khám này của Bác sĩ đã đạt giới hạn tiếp nhận tối đa (5 người bệnh). Vui lòng chọn ca khám khác!"`.
- **PostgreSQL Verification SQL Query:**
  ```sql
  SELECT COUNT(*) AS active_shift_bookings
  FROM lich_kham
  WHERE bac_si_id = 3
    AND ngay_kham = :target_date
    AND gio_kham >= '08:00:00' AND gio_kham < '12:00:00'
    AND trang_thai IN ('da_xac_nhan', 'da_tiep_nhan', 'dang_kham');
  ```
- **DB Post-state:** `active_shift_bookings = 5` (tuyệt đối không vượt quá `gioi_han_ca_kham = 5`).
- **Tập trạng thái chiếm chỗ (`ACTIVE_BOOKING`) thống nhất:** Theo `OCCUPYING_SLOT_STATUSES` trong `models/appointment.py` (dòng 27–31) — `da_xac_nhan`, `da_tiep_nhan`, `dang_kham`. Cùng một tập này được dùng cho Unique Partial Index, kiểm tra slot và đếm sức chứa ca. `cho_xac_nhan` và `da_kham` **không** chiếm chỗ. *Câu hỏi nghiệp vụ chờ phê duyệt: ca đã `da_kham` có được giải phóng sức chứa ca không? (xem `DEF-G3-05`).*

---

## 1.2. `TC-APT-004-02` & `TC-APT-004-03` — 10 requests đồng thời tranh chấp cùng 1 Khung giờ 30 phút (`gio_kham = 09:00`, sức chứa slot = 1)
- **Requirement ID:** `APT-004` | **Scenario ID:** `TS-APT-004-02`, `TS-APT-004-03` | **Priority:** `Critical`
- **Mục tiêu:** Kiểm chứng chống đặt trùng lịch bác sĩ trên cùng một mốc giờ 30 phút (sức chứa của mỗi mốc `(bac_si_id, ngay_kham, gio_kham)` là **1 bệnh nhân**).
- **Preconditions & DB Pre-state:**
  - Bác sĩ `bac_si_id = 3`, ngày `D`, mốc giờ `gio_kham = "09:00"` đang hoàn toàn trống (`0` bản ghi active tại `09:00`); `gioi_han_ca_kham = 20`.
  - 10 tài khoản bệnh nhân độc lập (`TEST_ACC_PAT_01` .. `TEST_ACC_PAT_10`).
- **Action (Test Steps):**
  1. Thực thi đồng thời 10 requests `POST /api/v1/appointments` cùng đặt vào `(bac_si_id = 3, ngay_kham = D, gio_kham = "09:00")` bằng `asyncio.gather`.
- **Expected API Response:**
  - Vì mỗi mốc giờ 30 phút của một bác sĩ chỉ nhận **tối đa 01 bệnh nhân**:
    - Đúng **01 request** trả về `HTTP 201 Created` (`trang_thai = "da_xac_nhan"`).
    - Đúng **09 requests** trả về `HTTP 409 Conflict` (`"Rất tiếc! Khung giờ này vừa được người bệnh khác giữ chỗ trước."`).
- **PostgreSQL Verification SQL Query:**
  ```sql
  SELECT COUNT(*) AS slot_count, MIN(ma_lich_kham) AS booked_code
  FROM lich_kham
  WHERE bac_si_id = 3
    AND ngay_kham = :target_date
    AND gio_kham = '09:00:00'
    AND trang_thai IN ('da_tiep_nhan', 'da_xac_nhan', 'dang_kham');
  ```
- **DB Post-state:** `slot_count = 1` (bảo vệ bởi khóa `LichLamViec FOR UPDATE` và chốt chặn cuối là Unique Partial Index `uq_active_doctor_slot`).

---

## 1.3. `TC-APT-004-04` & `TC-APT-004-05` — Kiểm chứng Transaction Rollback thực sự sau khi đã `db.add()` / `db.flush()` dữ liệu (Giải quyết P0-3)
- **Requirement ID:** `APT-004`, `REC-003` | **Scenario ID:** `TS-APT-004-05` | **Priority:** `Critical`
- **Mục tiêu:** Chứng minh rằng khi một transaction đã thực hiện ghi tạm (`db.add` và `await db.flush()`, đã sinh ID trong phiên giao dịch PostgreSQL) nhưng bước kế tiếp trong cùng transaction gặp lỗi ràng buộc CSDL (`IntegrityError` hoặc ngoại lệ nghiệp vụ), toàn bộ dữ liệu đã `flush` ở bước 1 phải được **Rollback sạch 100%**, không để lại bản ghi mồ côi (orphan record).
- **Preconditions & DB Pre-state:**
  - Kiểm tra trên luồng tạo kép **`LichKham` (Bước 1: `db.add` + `await db.flush()`) $\rightarrow$ `HangDoiKham` (Bước 2: `db.add` + `await db.commit()`)** tại `queue_service.check_in_walk_in` (dòng 467–500) hoặc luồng **`HoaDon` (`await db.flush()`) $\rightarrow$ `ChiTietHoaDon`** tại `cashier_service.create_invoice_for_encounter` (dòng 198–216).
  - Ghi nhận tổng số bản ghi hiện tại trước khi chạy:
    `SELECT COUNT(*) FROM lich_kham WHERE benh_nhan_id = :bn_id AND ngay_kham = :today` = `N_before`.
- **Action (Test Steps):**
  1. Mở phiên giao dịch thực thi luồng tiếp nhận Walk-in / tạo hóa đơn.
  2. Đợi bước 1 thực thi xong `db.add(lich_tai_cho)` và `await db.flush()` (lúc này `lich_tai_cho.id` đã được cấp bởi sequence PostgreSQL).
  3. Kích hoạt lỗi ở bước 2 ngay trước/trong khi `commit()` (ví dụ: cố tình gây lỗi `IntegrityError` ở bảng con `hang_doi_kham` / `chi_tiet_hoa_don` hoặc vi phạm `uq_active_patient_slot` tại thời điểm `commit`).
- **Expected Behavior & PostgreSQL Verification SQL Query:**
  - Khối `except` gọi `await db.rollback()` và ném ngoại lệ chuẩn (`409 Conflict` / `AppException`).
  - Truy vấn kiểm chứng trên một kết nối DB độc lập sau khi request kết thúc:
    ```sql
    SELECT COUNT(*) AS count_after
    FROM lich_kham
    WHERE benh_nhan_id = :bn_id AND ngay_kham = :today;
    ```
- **DB Post-state:** `count_after == N_before` (bản ghi `lich_tai_cho` đã `flush` ở bước 1 bị hủy bỏ hoàn toàn, không tồn tại trong bảng `lich_kham`).

---

# 2. Khu vực Rủi ro Cao #2 — Tiếp đón, Chống Trùng STT & Hàng đợi Đủ 5 Mức Ưu tiên (`REC-003`, `QUE-001`, `QUE-003`)

**Phụ trách thực thi:** Tùng | **Review chéo:** Hoàng  

## 2.1. Đối chiếu 5 Mức Ưu tiên Hàng đợi Thực tế trong `queue_service.py` (Giải quyết P1-4)

Theo [`queue_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/queue_service.py#L274-L305) (dòng 274–305 và 510–564), cột `HangDoiKham.muc_do_uu_tien` có **đúng 5 mức từ `1` đến `5`**:

| Mức ưu tiên (`muc_do_uu_tien`) | Ký hiệu | Loại hàng đợi (`loai_hang_doi`) | Điều kiện gán trong Code (`queue_service.py`) |
| :---: | :---: | :--- | :--- |
| **`1`** | **B1** | Cấp cứu / Ưu tiên đặc biệt | Tiếp nhận cấp cứu Red-Flag (`REC-004`) hoặc có `ly_do_uu_tien` (Người cao tuổi, Trẻ em < 6 tuổi, Phụ nữ mang thai, Khuyết tật) |
| **`2`** | **B2** | Đặt lịch Đúng hẹn (`dung_hen`) | Bệnh nhân có lịch hẹn trước, check-in trong khung cửa sổ `[-30 phút, +15 phút]` so với `gio_kham` |
| **`3`** | **B3** | Trả kết quả CLS (`tra_ket_qua_cls`) | Bệnh nhân đã khám lâm sàng, đi làm CLS và vừa có kết quả CLS được duyệt quay lại phòng khám |
| **`4`** | **B4** | Đặt lịch Đến sớm (`den_som`) | Bệnh nhân có lịch hẹn trước nhưng check-in **sớm hơn 30 phút** (`diff_minutes > 30`) so với `gio_kham` |
| **`5`** | **B5** | Vãng lai (`vang_lai`) / Đến muộn (`den_muon`) | Bệnh nhân đi khám trực tiếp không hẹn trước, hoặc có lịch hẹn nhưng đến **muộn quá 15 phút** (`diff_minutes < -15`) |

*Quy tắc sắp xếp khi gọi số (`call_next_patient` - dòng 559–563):*
```sql
ORDER BY
  muc_do_uu_tien ASC,
  COALESCE(thoi_gian_xep_hang_lai, thoi_gian_check_in) ASC,
  so_thu_tu_kham ASC
```

## 2.2. `TC-QUE-003-01` — Kiểm chứng đầy đủ thứ tự gọi số `B1 -> B2 -> B3 -> B4 -> B5` và Tie-breaking cùng mức ưu tiên
- **Requirement ID:** `QUE-003` | **Scenario ID:** `TS-QUE-003-01` | **Priority:** `Critical`
- **Preconditions & DB Pre-state:**
  - Tại buồng khám của bác sĩ `bac_si_id = 1` trong ngày hôm nay, khởi tạo **6 phiếu `HangDoiKham`** ở trạng thái `cho_kham` theo thứ tự thời gian check-in ngược (người ưu tiên thấp đến trước, người ưu tiên cao đến sau):
    1. `Ticket_B5_Late`: Đến muộn > 15p (`muc_do_uu_tien = 5`, check-in `08:00`, `so_thu_tu_kham = 1`).
    2. `Ticket_B5_Walkin`: Vãng lai (`muc_do_uu_tien = 5`, check-in `08:02`, `so_thu_tu_kham = 2`).
    3. `Ticket_B4_Early`: Đặt lịch nhưng đến sớm > 30p (`muc_do_uu_tien = 4`, check-in `08:05`, `so_thu_tu_kham = 3`).
    4. `Ticket_B3_CLS`: Vừa có kết quả xét nghiệm CLS quay lại (`muc_do_uu_tien = 3`, check-in/xếp hàng lại `08:10`, `so_thu_tu_kham = 4`).
    5. `Ticket_B2_OnTime`: Đặt lịch đúng giờ hẹn (`muc_do_uu_tien = 2`, check-in `08:12`, `so_thu_tu_kham = 5`).
    6. `Ticket_B1_Emergency`: Cấp cứu / Người cao tuổi (`muc_do_uu_tien = 1`, check-in `08:15`, `so_thu_tu_kham = 6`).
- **Action (Test Steps):**
  - Bác sĩ lần lượt gọi `POST /api/v1/reception/queue/call-next` (và hoàn tất/tạm hoãn ca vừa gọi để giải phóng Guard A4 `dang_kham`) tổng cộng **6 lần liên tiếp**.
- **Expected API Response & DB Post-state:**
  - Thứ tự các vé được gọi vào khám (`trang_thai` chuyển sang `dang_kham`) bắt buộc chính xác là:
    1. Lần gọi 1: **`Ticket_B1_Emergency`** (`muc_do_uu_tien = 1`)
    2. Lần gọi 2: **`Ticket_B2_OnTime`** (`muc_do_uu_tien = 2`)
    3. Lần gọi 3: **`Ticket_B3_CLS`** (`muc_do_uu_tien = 3`)
    4. Lần gọi 4: **`Ticket_B4_Early`** (`muc_do_uu_tien = 4`)
    5. Lần gọi 5: **`Ticket_B5_Late`** (`muc_do_uu_tien = 5`, cùng mức 5 với `Ticket_B5_Walkin` nhưng có `thoi_gian_check_in = 08:00 < 08:02` và `so_thu_tu_kham = 1 < 2`)
    6. Lần gọi 6: **`Ticket_B5_Walkin`** (`muc_do_uu_tien = 5`, check-in `08:02`)
  - *Kiểm chứng Guard A4 (Chống khám đè)*: Nếu bác sĩ đang có `Ticket_B1_Emergency` ở trạng thái `dang_kham` mà bấm `call-next` ngay khi chưa hoàn tất/tạm hoãn ca đó $\rightarrow$ Backend từ chối `HTTP 409 Conflict` (`"Bác sĩ hiện đang có một ca khám chưa hoàn tất..."`).

---

# 3. Khu vực Rủi ro Cao #3 & #4 — Điều kiện Hoàn tất Khám & Khóa Bất biến Bệnh án (`EXM-002`, `EMR-003`)

**Phụ trách thực thi:** Hoàng | **Review chéo:** Trọng  

## 3.1. `TC-EXM-002-02` — Chặn hoàn tất lượt khám khi chưa có Chẩn đoán ICD-10 chính hoặc còn Chỉ định CLS dở dang
- **Requirement ID:** `EXM-002` | **Priority:** `Critical`
- **DB Pre-state:** Lượt khám `luot_kham_id = E` đang ở trạng thái `dang_kham`, có 1 bản ghi `chi_dinh` đang ở trạng thái `dang_thuc_hien` (chưa có kết quả duyệt).
- **Action & Expected Result:**
  - Gọi `POST /api/v1/clinical/encounters/{E}/complete` $\rightarrow$ Bị chặn với `HTTP 400/409`, `luot_kham.trang_thai` giữ nguyên `dang_kham` và `is_locked = False`.

## 3.2. `TC-EMR-003-01` — Khóa bất biến EMR (`is_locked = True`) & Bắt buộc qua Biên bản đính chính (`BienBanDinhChinh`)
- **Requirement ID:** `EMR-003` | **Priority:** `Critical`
- **DB Pre-state:** Lượt khám `luot_kham_id = E` đã hoàn tất (`trang_thai = 'hoan_thanh'`, `is_locked = True`).
- **Action & Verification:**
  1. Gọi `PUT /api/v1/clinical/workspace-state` sửa trực tiếp `ket_luan` của `luot_kham_id = E` $\rightarrow$ Bị chặn `HTTP 403/409`.
  2. Gọi `POST /api/v1/clinical/encounters/{E}/amendments` kèm `ly_do_dinh_chinh` $\rightarrow$ `HTTP 201 Created`, kiểm tra bảng `bien_ban_dinh_chinh` có bản ghi lưu đầy đủ dữ liệu cũ và mới.

---

# 4. Khu vực Rủi ro Cao #5 — Ký duyệt CLS & FSM Đơn thuốc Điện tử Băm Toàn vẹn SHA-256 (`LAB-003`, `RX-002`, `RX-003`, `USER-003`)

**Phụ trách thực thi:** Trọng (`LAB`) & Hợp (`RX`, `USER`) | **Review chéo:** An & Tùng  

## 4.1. Làm rõ Bản chất Kỹ thuật của Ký xác nhận Đơn thuốc & Máy trạng thái FSM (Giải quyết P1-7)

Qua đối chiếu [`prescription_fsm_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/prescription_fsm_service.py#L33-L155):
1. **Bản chất kỹ thuật của SHA-256 trong hệ thống**:
   - Phương thức `compute_prescription_hash(prescription_id, items)` (dòng 74–80) tính **mã băm toàn vẹn dữ liệu SHA-256 (`du_lieu_don_thuoc_hash`)** trên chuỗi JSON chuẩn hóa (`sort_keys=True`) của toàn bộ danh mục thuốc, liều lượng và cách dùng tại thời điểm bác sĩ ký xác nhận, kết hợp lưu thông tin xác thực người ký (`nguoi_ky_id`, `chu_ky_so`, `ngay_ky`).
   - Đây là cơ chế **Ký xác nhận điện tử nội bộ kèm khóa mã băm toàn vẹn SHA-256 (Data Integrity Hash)** để phát hiện và ngăn chặn mọi sự thay đổi trái phép sau khi ký, **không phải chữ ký số mật mã khóa công khai (PKI/RSA phần cứng)**.
2. **Máy trạng thái hữu hạn (FSM) gồm các bước tách biệt rõ ràng**:
   - `DRAFT` (Bản nháp mới tạo, cho phép sửa/xóa thuốc).
   - `DRAFT` $\xrightarrow{\text{validate\_prescription}}$ **`VALIDATED`** (Đã thẩm định chuyên môn; nếu sửa lại thuốc sẽ tự động lùi về `DRAFT` tại dòng 398).
   - `VALIDATED` $\xrightarrow{\text{sign\_prescription\_db}}$ **`SIGNED`** (Kiểm tra CCHN bác sĩ còn hiệu lực $\rightarrow$ Lưu `chu_ky_so`, `nguoi_ky_id`, `ngay_ky` và mã băm SHA-256 `du_lieu_don_thuoc_hash` $\rightarrow$ Kích hoạt khóa bất biến `assert_immutable`).
   - `SIGNED` $\xrightarrow{\text{issue\_prescription\_db}}$ **`ISSUED`** (Ban hành chính thức đơn thuốc ra bên ngoài / cho bệnh nhân và đủ điều kiện chuyển sang `SUBMISSION_PENDING -> SUBMITTED` lên Cổng Đơn thuốc Quốc gia).

## 4.2. `TC-RX-002-01` & `TC-RX-003-01` — Kiểm thử tuần tự FSM `DRAFT -> VALIDATED -> SIGNED -> ISSUED`, Khóa bất biến & Hủy thay thế (`SUPERSEDED`)
- **Requirement ID:** `RX-002`, `RX-003` | **Priority:** `Critical`
- **Action & Expected Results:**
  1. Đơn thuốc mới tạo ở `DRAFT`: Gọi thẳng API `sign` khi chưa `validate` $\rightarrow$ Bị chặn `HTTP 409 Conflict` (`"Đơn thuốc phải ở trạng thái 'VALIDATED' trước khi ký số!"` - dòng 135).
  2. Gọi `validate` $\rightarrow$ Trạng thái chuyển sang `VALIDATED`.
  3. Gọi `sign` bởi bác sĩ có CCHN hợp lệ $\rightarrow$ Trạng thái chuyển sang **`SIGNED`**, cột `du_lieu_don_thuoc_hash` có chuỗi hex SHA-256 64 ký tự (`LENGTH(du_lieu_don_thuoc_hash) = 64`), `nguoi_ky_id` và `ngay_ky` khác `NULL`.
  4. Gọi `PUT` sửa đơn thuốc đang ở `SIGNED` $\rightarrow$ Bị `assert_immutable` chặn với `HTTP 409 Conflict` (`"Nội dung thuốc và liều lượng đã ký là BẤT BIẾN, không được phép chỉnh sửa trực tiếp!"`).
  5. Gọi `issue` $\rightarrow$ Trạng thái chuyển từ `SIGNED` sang **`ISSUED`**.
  6. Gọi `supersede` kèm `ly_do` ($\ge 5$ ký tự) và danh sách thuốc mới $\rightarrow$ Đơn cũ chuyển sang `SUPERSEDED` (giữ nguyên mã băm cũ và gắn `superseded_by_id = new_rx.id`), đơn mới được tạo ở trạng thái `DRAFT` với `thay_the_cho_don_id = old_rx.id`.

## 4.3. `TC-LAB-003-01` & `TC-LAB-003-02` — Ký duyệt CLS (`DA_DUYET`) và Chặn sửa kết quả sau duyệt
- **Requirement ID:** `LAB-003` | **Priority:** `Critical`
- **Action & Expected Results:**
  1. KTV nhập kết quả xét nghiệm (`Glucose = 19.5 mmol/L`) $\rightarrow$ Trạng thái `cho_duyet`, tự động gắn cờ `NGUY_KICH` / `BAT_THUONG`.
  2. Gọi `POST /api/v1/subclinical/orders/{id}/approve` $\rightarrow$ Trạng thái chuyển sang `DA_DUYET`.
  3. Gọi lại `POST /api/v1/subclinical/orders/{id}/lab-results` để sửa trị số trên phiếu đã `DA_DUYET` $\rightarrow$ Bị chặn `HTTP 409 Conflict`.

---

# 5. Khu vực Rủi ro Cao #6 — Hóa đơn, Chống Thu Trùng, Hoàn Tiền Lũy Kế & Ranh giới Khóa Sổ Ca Trực (`BILL-004`, `BILL-006`, `BILL-007`)

**Phụ trách thực thi:** Hợp | **Review chéo:** An  

## 5.1. `TC-BILL-004-01` & `TC-BILL-004-02` — Chặn lập 2 hóa đơn hiệu lực & Chặn thu tiền trùng (Concurrency)
- **Requirement ID:** `BILL-004` | **Priority:** `Critical`
- **Action & Verification:**
  1. **`TC-BILL-004-01`**: Gửi 2 requests `POST /api/v1/cashier/invoices` cho cùng `luot_kham_id` $\rightarrow$ 1 request `201 Created`, 1 request `409 Conflict` (bảo vệ bởi `_ensure_not_billed` và Unique Partial Index `uq_hoa_don_luot_kham_hieu_luc`).
  2. **`TC-BILL-004-02`**: Hai thu ngân gửi đồng thời (`asyncio.gather`) 2 requests `POST /api/v1/cashier/invoices/{id}/pay` cho cùng 1 hóa đơn `chua_thu` (`350.000 đ`) $\rightarrow$ Nhờ khóa `SELECT ... FROM hoa_don WHERE id = :id FOR UPDATE` (dòng 229 `cashier_service.py`), đúng 1 request `200 OK`, 1 request `409 Conflict`.
  3. **SQL Verification:**
     ```sql
     SELECT
       (SELECT COUNT(*) FROM phieu_thu_chi WHERE hoa_don_id = :invoice_id AND loai_phieu = 'THU') AS so_phieu_thu,
       (SELECT COUNT(*) FROM giao_dich_thanh_toan WHERE hoa_don_id = :invoice_id AND trang_thai = 'THANH_CONG') AS so_giao_dich;
     ```
     Kết quả bắt buộc: `so_phieu_thu = 1` và `so_giao_dich = 1`.

---

## 5.2. `TC-BILL-007-02` & `TC-BILL-007-03` — Hoàn tiền một phần hợp lệ (007-02) tách riêng khỏi chặn hoàn tiền lũy kế / phiếu đã khóa sổ (007-03) (Giải quyết P0-3)
- **Requirement ID:** `BILL-007` | **Scenario ID:** `TS-BILL-007-02` | **Priority:** `Critical`
- **Mục tiêu:** Chứng minh hệ thống không chỉ chặn 1 lần hoàn vượt `thuc_thu`, mà còn phải kiểm soát **tổng số tiền hoàn lũy kế qua nhiều lần hoàn một phần** không bao giờ vượt quá `HoaDon.thuc_thu`, đồng thời đồng bộ cả 3 bảng `hoa_don`, `phieu_thu_chi` và `giao_dich_thanh_toan`.
- **Preconditions & DB Pre-state:**
  - Hóa đơn `invoice_id = H` đã thanh toán (`trang_thai = 'da_thu'`), có `tong_tien = 350000`, `mien_giam = 0`, **`thuc_thu = 350000`**.
- **Action (Test Steps):**
  1. **Lần hoàn 1 (Hợp lệ)**: Gọi `POST /api/v1/cashier/refund` với `{"invoice_id": H, "so_tien_hoan": 200000, "phuong_thuc": "tien_mat", "ly_do": "Hoan phi dich vu CLS khong thuc hien"}`.
  2. **Lần hoàn 2 (Vượt lũy kế: `200.000 + 200.000 = 400.000 > 350.000`)**: Gọi tiếp `POST /api/v1/cashier/refund` trên cùng `invoice_id = H` với `{"invoice_id": H, "so_tien_hoan": 200000, "phuong_thuc": "tien_mat", "ly_do": "Hoan tiep lan 2"}`.
  3. **Lần hoàn 3 (Hoàn nốt phần còn lại hợp lệ: `150.000`)**: Gọi `POST /api/v1/cashier/refund` với `{"invoice_id": H, "so_tien_hoan": 150000, "phuong_thuc": "tien_mat", "ly_do": "Hoan not phan con lai"}`.
- **Expected API Response:**
  - **Bước 1**: `HTTP 200 OK` $\rightarrow$ `HoaDon.trang_thai = "hoan_tien_mot_phan"`, sinh 1 phiếu chi `PhieuThuChi(loai_phieu='CHI', so_tien=200000)` và `GiaoDichThanhToan(loai_giao_dich='HOAN_TIEN', so_tien=200000)`.
  - **Bước 2**: Bắt buộc bị từ chối **`HTTP 400 Bad Request`** (vì số tiền còn lại có thể hoàn chỉ là `350.000 - 200.000 = 150.000 đ`). Không được sinh thêm bản ghi `PhieuThuChi(CHI)` hay `GiaoDichThanhToan`.
  - **Bước 3**: `HTTP 200 OK` $\rightarrow$ Tổng hoàn lũy kế đạt `350.000 / 350.000`, `HoaDon.trang_thai` chuyển sang **`"da_hoan_tien"`** (Terminal state cho hoàn tiền — mọi yêu cầu hoàn thêm sau đó đều bị từ chối).
- **PostgreSQL Verification SQL Query:**
  ```sql
  SELECT
    hd.thuc_thu,
    hd.trang_thai,
    COALESCE((SELECT SUM(so_tien) FROM phieu_thu_chi WHERE hoa_don_id = hd.id AND loai_phieu = 'CHI'), 0) AS tong_phieu_chi_hoan,
    COALESCE((SELECT SUM(so_tien) FROM giao_dich_thanh_toan WHERE hoa_don_id = hd.id AND loai_giao_dich = 'HOAN_TIEN' AND trang_thai = 'THANH_CONG'), 0) AS tong_gd_hoan
  FROM hoa_don hd
  WHERE hd.id = :invoice_id;
  ```
- **DB Post-state Invariant:**
  - Sau Bước 2: `tong_phieu_chi_hoan = 200000`, `tong_gd_hoan = 200000`, `trang_thai = 'hoan_tien_mot_phan'`.
  - Sau Bước 3: `tong_phieu_chi_hoan = 350000 <= hd.thuc_thu`, `tong_gd_hoan = 350000`, `trang_thai = 'da_hoan_tien'`.

---

## 5.3. `TC-BILL-006-01` & `TC-BILL-006-02` — Kiểm chứng Ranh giới Khóa sổ Ca cũ, Cô lập Doanh thu Ca mới & Chặn Hoàn tiền Phiếu đã Khóa sổ (Giải quyết P1-6)
- **Requirement ID:** `BILL-006` | **Scenario ID:** `TS-BILL-006-01`, `TS-BILL-006-02` | **Priority:** `Critical`
- **Đối chiếu cơ chế thực tế trong `cashier_service.py` (dòng 403–497):**
  - Hệ thống quản lý ranh giới ca trực của thu ngân thông qua cờ `PhieuThuChi.trang_thai_khoa_so` (`Boolean`) và bảng chốt ca `KhoaSoCaTruc`.
  - Mọi phiếu thu/chi phát sinh khi thu ngân đang làm việc có `trang_thai_khoa_so = False`.
  - Khi gọi `POST /api/v1/cashier/close-shift`, hệ thống khóa (`FOR UPDATE`) toàn bộ các bản ghi `PhieuThuChi` có `nhan_vien_id = thu_ngan_id AND trang_thai_khoa_so = False`, cập nhật chúng sang `trang_thai_khoa_so = True` và ghi bản ghi tổng kết vào bảng `khoa_so_ca_truc` (`ma_khoa_so = "KS-..."`, `trang_thai = "DA_KHOA_SO"`).
  - Khi phát sinh giao dịch mới **sau thời điểm khóa sổ**, bản ghi `PhieuThuChi` mới được khởi tạo với `trang_thai_khoa_so = False` (thuộc về ca làm việc tiếp theo).
- **Action (Test Steps chứng minh cô lập Ca cũ và Ca mới):**
  1. **Trong Ca 1**: Thu ngân `TEST_ACC_CASHIER_01` thu tiền Hóa đơn `H1` (`300.000 đ` tiền mặt) và Hóa đơn `H2` (`200.000 đ` chuyển khoản).
  2. **Chốt khóa sổ Ca 1**: Gọi `POST /api/v1/cashier/close-shift` với `{"tien_mat_thuc_te": 300000, "ghi_chu": "Khoa so Ca 1"}` $\rightarrow$ Sinh bản ghi `KhoaSoCaTruc` mã `KS_CA_1` (`tong_tien_mat_he_thong = 300000`, `tong_chuyen_khoan_he_thong = 200000`, `tong_so_phieu_thu = 2`).
  3. **Kiểm tra chặn sửa/hoàn tiền Hóa đơn thuộc Ca 1 đã khóa sổ**: Gọi `POST /api/v1/cashier/refund` đối với Hóa đơn `H1` (có phiếu thu gốc đã `trang_thai_khoa_so = True`) $\rightarrow$ Hệ thống phải kiểm tra và chặn hoàn tiền trực tiếp trên phiếu thu đã khóa sổ (`HTTP 409 Conflict`).
  4. **Phát sinh giao dịch ở Ca 2 (Sau khi khóa Ca 1)**: Thu ngân tiếp tục thu tiền Hóa đơn mới `H3` (`150.000 đ` tiền mặt).
  5. **Kiểm tra `shift-summary` của Ca 2**: Gọi `GET /api/v1/cashier/shift-summary`.
- **Expected API Response & PostgreSQL Verification SQL Query:**
  - Ở Bước 5, `GET /api/v1/cashier/shift-summary` phải trả về chính xác dữ liệu của **riêng Ca 2**: `so_phieu_thu = 1`, `tong_tien_mat = 150000`, `tong_chuyen_khoan = 0`, `tong_doanh_thu = 150000` (chứng minh `500.000 đ` của Ca 1 đã được đóng băng trong `KS_CA_1` và hoàn toàn tách biệt với Ca 2).
  ```sql
  SELECT
    (SELECT COUNT(*) FROM phieu_thu_chi WHERE nhan_vien_id = :cashier_id AND trang_thai_khoa_so = TRUE) AS locked_slips_ca1,
    (SELECT COUNT(*) FROM phieu_thu_chi WHERE nhan_vien_id = :cashier_id AND trang_thai_khoa_so = FALSE) AS open_slips_ca2,
    (SELECT SUM(so_tien) FROM phieu_thu_chi WHERE nhan_vien_id = :cashier_id AND trang_thai_khoa_so = FALSE AND loai_phieu = 'THU') AS revenue_ca2;
  ```
- **DB Post-state:** `locked_slips_ca1 = 2`, `open_slips_ca2 = 1`, `revenue_ca2 = 150000`.

---

# 6. Bảng Xác nhận Đối chiếu Code/DB Thực tế & Phân công Cross-Review (Gate G3 Sign-off Checklist)

| Khu vực Rủi ro Cao | Điểm P0 / P1 của QA Lead | Đối chiếu Code / DB Thực tế | Người viết đặc tả | Người Cross-Review |
| :--- | :--- | :--- | :---: | :---: |
| **1. `APT-003` / `APT-004`** | **P0-1, P0-2, P0-3**: Tách rõ sức chứa Slot 30p (=1, `uq_active_doctor_slot`) với sức chứa Ca (`gioi_han_ca_kham = 5`, khóa `LichLamViec FOR UPDATE`); bổ sung test Rollback sau `await db.flush()` | Đã đối chiếu `014_reception_schema_sprint1.py` & `appointment_service.py` | Tùng | Hợp |
| **2. `QUE-001` / `QUE-003`** | **P1-4**: Đầy đủ 5 mức ưu tiên `B1 (1: Cấp cứu/Ưu tiên)` $\rightarrow$ `B2 (2: Đúng hẹn)` $\rightarrow$ `B3 (3: KQ CLS)` $\rightarrow$ `B4 (4: Đến sớm >30p)` $\rightarrow$ `B5 (5: Vãng lai/Muộn >15p)` + Tie-break theo `thoi_gian_check_in` & `so_thu_tu_kham` | Đã đối chiếu `queue_service.py` (dòng 274–305, 559–563) | Tùng | Hoàng |
| **3 & 4. `EXM-002` / `EMR-003`** | Guard chặn hoàn tất khám khi thiếu ICD-10 / còn CLS; khóa `is_locked = True` & `BienBanDinhChinh` | Đã đối chiếu `clinical_service.py` | Hoàng | Trọng |
| **5. `LAB-003` / `RX-002`** | **P1-7**: Chuẩn hóa thuật ngữ *"Ký xác nhận điện tử & khóa mã băm toàn vẹn SHA-256 (`du_lieu_don_thuoc_hash`)"*; làm rõ FSM 3 bước `DRAFT -> VALIDATED -> SIGNED -> ISSUED` | Đã đối chiếu `prescription_fsm_service.py` (dòng 33–155) | Trọng & Hợp | An |
| **6. `BILL-004` / `006` / `007`** | **P1-5, P1-6**: `TC-BILL-007-02` (hoàn một phần hợp lệ) và `TC-BILL-007-03` (chặn hoàn lũy kế / phiếu khóa sổ) là hai Test Case độc lập, đồng bộ G3–CSV–RTM | `cashier_service.refund_invoice` **chưa** cộng dồn phiếu chi và **chưa** kiểm tra khóa sổ → xem `DEF-G3-02`; `TC-BILL-007-03` và `TC-BILL-006-02` phải FAIL trước khi sửa | Hợp | An |

---
**Document End — Clinic-AI High-Risk Test Specifications v1.1 – Revised (Gate G3)**
