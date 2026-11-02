# CLINIC-AI — G3 DEFECT & REVISION LOG

**Phiên bản:** v1.0 | **Áp dụng cho:** G3 v1.1 → v1.2 | **Baseline code:** `develop` @ `8a42575`, Alembic `015`  
**Nguyên tắc:** Mỗi mục có Requirement, Test Case, người phụ trách, loại (Doc / Code / Decision) và tiêu chí đóng. Mục loại `Decision` chỉ nhóm/giảng viên được quyết, AI không tự quyết.

## 1. Tổng quan

| ID | Mức | Loại | Requirement | Test Case | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: |
| DEF-G3-01 | P0 | **Decision** | `QUE-003` | `TC-QUE-003-01` | Open – chờ quyết định |
| DEF-G3-02 | P0 | **Code** (Critical) | `BILL-006`, `BILL-007` | `TC-BILL-007-03`, `TC-BILL-006-02` | Open – xác nhận bằng code |
| DEF-G3-03 | P0 | Doc | `BILL-007` | `TC-BILL-007-03` | **Closed** (đã tách TC, đồng bộ G3–CSV–RTM) |
| DEF-G3-04 | P1 | Doc + Decision | `APT-003/004` | `TC-APT-004-01` | Partially closed |
| DEF-G3-05 | P1 | Decision | `APT-004` | `TC-APT-004-01` | Open |
| DEF-G3-06 | P1 | Doc | `APT-004`, `REC-003` | `TC-APT-004-05` | Open |
| DEF-G3-07 | P1 | Code + Decision | `QUE-003` | `TC-QUE-003-02` (mới) | Open – chặn bởi DEF-G3-01 |
| DEF-G3-08 | P1 | Doc | `RX-002`, `RX-003` | `TC-RX-002-01`, `TC-RX-003-01` | Open |
| DEF-G3-09 | P1 | Doc | Toàn bộ | CSV, RTM | **Closed** |

## 2. Chi tiết từng mục

### DEF-G3-01 — Thứ tự ưu tiên hàng đợi lệch giữa RTM/G2 và code/G3 (P0, Decision)
- **Sự kiện (đã kiểm chứng trong [`queue_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/queue_service.py#L274-L305)):** code gán Đúng hẹn = mức 2, KQ CLS = mức 3. RTM `QUE-003` và G2 ghi *Cấp cứu > Có KQ CLS > Đúng giờ > Đến sớm/muộn > Vãng lai*.
- **Phát hiện thêm:** tìm `aging`/`starvation` trong `queue_service.py` cho kết quả **0**; `ORDER BY` chỉ gồm `muc_do_uu_tien`, `COALESCE(thoi_gian_xep_hang_lai, thoi_gian_check_in)`, `so_thu_tu_kham`. Tức là "aging chống đói" trong Acceptance Criteria **chưa tồn tại trong code**, và mức "Đến muộn" trong code là mức 5 (ngang vãng lai), khác RTM ("Đến sớm/muộn" ngang nhau).
- **Việc cần quyết (Product Owner / giảng viên):**
  1. Thứ tự đúng: (A) theo RTM — CLS trước đúng hẹn; hay (B) theo code — đúng hẹn trước CLS?
  2. Đến muộn xếp mức nào?
  3. Aging: giữ trong yêu cầu (cần ngưỡng phút) hay bỏ khỏi Acceptance Criteria?
- **Người phụ trách:** Tùng (đề xuất), Hợp (chốt với giảng viên).
- **Tiêu chí đóng:** biên bản quyết định → cập nhật `QUE-003` (RTM, G2, CSV, G3) **hoặc** sửa code; sau đó `TC-QUE-003-01` chạy theo thứ tự đã duyệt.
- *Trạng thái RTM tạm thời:* `TC-QUE-003-01` đang ghi `Passed` dựa trên phiên live cũ; **khuyến nghị hạ về `Ready`** cho tới khi DEF-G3-01 đóng.

### DEF-G3-02 — `refund_invoice` thiếu hoàn lũy kế và chặn phiếu khóa sổ (P0, Code, Critical)
- **Bằng chứng đọc code ([`cashier_service.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/services/cashier_service.py#L499-L560)):** chỉ kiểm tra `so_tien_hoan > invoice.thuc_thu` cho **từng lần gọi**; không `SUM` các `PhieuThuChi(CHI)` đã có; không đọc `trang_thai_khoa_so` của phiếu thu gốc. Ngoài ra trạng thái `da_hoan_tien` không nằm trong danh sách cho phép (`da_thu`, `hoan_tien_mot_phan`) nên lần hoàn thứ hai sau hoàn toàn phần bị chặn, nhưng hoàn một phần lặp lại thì vượt được `thuc_thu`.
- **Chưa phải bug đã xác nhận bằng chạy:** đây là kết luận từ đọc code. Bug chỉ được ghi chính thức khi test fail.
- **Quy trình bắt buộc:**
  1. QA (An review, Hợp viết) viết `TC-BILL-007-03` và `TC-BILL-006-02` trước, chạy ở commit `8a42575` → kỳ vọng **FAIL**; lưu evidence.
  2. Developer (Hợp) sửa `refund_invoice`: cộng dồn phiếu CHI theo `hoa_don_id`, chặn khi tổng hoàn mới > `thuc_thu`, chặn khi phiếu thu gốc đã khóa sổ.
  3. Chạy lại hai test → **PASS**, kèm regression `BILL-003/004/005/007`.
- **Tiêu chí đóng:** hai TC PASS ở commit sửa lỗi, Jira Bug Severity Critical liên kết `BILL-007`, `BILL-006`.
- **Lưu ý ghi nhận trạng thái:** `BILL-006`, `BILL-007` hiện **chưa** được coi là đạt.

### DEF-G3-03 — Thiếu `TC-BILL-007-03` trong CSV/RTM (P0, Doc) — Closed
- Đã chọn **phương án A**: `TC-BILL-007-02` = hoàn một phần hợp lệ; `TC-BILL-007-03` = chặn hoàn lũy kế vượt thực thu và chặn phiếu khóa sổ. Cập nhật G3 (mục 5.2, bảng 6), RTM, CSV.
- Hệ quả: tổng **66 Test Cases** (BILL: 13), đã đồng bộ G2. Cập nhật nội dung chi tiết `TC-BILL-007-03` trong G3 mục 5.2 nên chuyển hai lần hoàn sang `007-02` (200k) và `007-03` (200k lần hai + phiếu khóa sổ) khi chạy G5.

### DEF-G3-04 — Tập trạng thái active không thống nhất (P1, Doc + Decision)
- **Sự kiện:** `OCCUPYING_SLOT_STATUSES` = `da_xac_nhan`, `da_tiep_nhan`, `dang_kham` ([`appointment.py`](file:///d:/dowload/tailieu/clinic-ai/backend/app/models/appointment.py#L27-L31)); cả unique index, kiểm tra slot và đếm sức chứa ca đều dùng tập này. Truy vấn trong G3 v1.1 (thêm `cho_xac_nhan`, `da_kham`) **sai so với code** → đã sửa trong G3 mục 1.1.
- **Còn lại:** xem DEF-G3-05.

### DEF-G3-05 — Ca đã `da_kham` có giải phóng sức chứa ca? (P1, Decision)
- Với tập hiện tại, lịch `da_kham` không còn tính vào `gioi_han_ca_kham` → bác sĩ có thể nhận nhiều hơn giới hạn trong một ca khi người đầu đã khám xong. Cần quyết định nghiệp vụ: giới hạn tính theo *lượt đặt trong ca* hay *người đang chiếm chỗ*.
- **Tiêu chí đóng:** quy tắc được phê duyệt; thêm TC biên (ca đã khám đủ giới hạn rồi đặt thêm) nếu giữ "tính theo lượt đặt".
- **Phụ trách:** Tùng.

### DEF-G3-06 — Test rollback chưa tái lập được (P1, Doc)
- Cần chốt **một luồng**: `LichKham → HangDoiKham` (walk-in). Cách tạo lỗi có thể tái lập: trước `commit`, chèn một `HangDoiKham` có `(bac_si_id, ngay_kham, ca_kham, so_thu_tu_kham)` vi phạm ràng buộc, hoặc patch hàm thứ hai trong test để raise. Cần ghi rõ constraint kích hoạt.
- Kiểm tra sau rollback: `lich_kham`, `hang_doi_kham` (cha + con) đều không có bản ghi từ transaction đó; session mới `SELECT 1` chạy bình thường (không kẹt `aborted`).
- **Phụ trách:** Tùng; **review:** Hợp. **Đóng khi:** G3 v1.2 có SQL pre/post cho cả hai bảng.

### DEF-G3-07 — Aging chưa có đặc tả và chưa có code (P1, Code + Decision)
- Phụ thuộc DEF-G3-01. Không tự đặt ngưỡng. Nếu giữ aging: cần ngưỡng phút đã duyệt, cơ chế (tăng mức hay trọng số), `TC-QUE-003-02` (BN mức 5 chờ quá ngưỡng được gọi trước BN mức thấp hơn mới đến). Nếu bỏ: sửa Acceptance Criteria `QUE-003` trong RTM/G2.

### DEF-G3-08 — Kiểm tra hash SHA-256 chưa đủ (P1, Doc)
- Bổ sung vào `TC-RX-002-01`/`TC-RX-003-01`: (1) tính lại hash bằng đúng `compute_prescription_hash(id, items)` (payload `"{id}:" + json.dumps(sorted(items by ten_thuoc), sort_keys=True)`) rồi so với DB; (2) sửa thuốc sau ký → 409; (3) hash đơn cũ không đổi sau `SUPERSEDED`. Lưu ý code hash chỉ gồm `ten_thuoc, ham_luong, so_luong, don_vi_tinh, cach_dung` — không gồm `so_ngay_dung`, `hoat_chat`, `ghi_chu`: **thay đổi các trường này sẽ không làm đổi hash** → cần ghi nhận như một rủi ro toàn vẹn, quyết định có mở rộng payload hay không.
- **Phụ trách:** Hợp.

### DEF-G3-09 — Chuẩn hóa CSV/RTM (P1, Doc) — Closed
- `Test Type`: `Generic` → `API Automation`; `Manual / Automated` → `Manual + API Automation`; giữ `Manual`.
- Coverage Summary tách **Execution Progress** (`(Passed+Failed)/Tổng`) và **Pass Rate** (`Passed/(Passed+Failed)`); không còn dùng Passed/Tổng làm pass rate.

## 3. Việc cần rà soát trạng thái `Passed` (38 TC)

38 `Passed` hiện lấy từ phiên chạy live trước đây, **chưa gắn commit hash theo từng TC**. Trước G5 cần: ghi `Commit` và `DB revision` vào Evidence, hoặc chạy lại. Đặc biệt kiểm tra lại các TC thuộc `BILL`, `QUE-003`, `RX-002` vì liên quan DEF-G3-01/02/08. Với `TC-BILL-004-01` (đang `Passed` theo Migration 013) cần thêm bằng chứng concurrency nếu muốn chứng minh "chống thu trùng" theo G2 mục 3.1.

## 4. Review chéo (Cross-review) — kết quả thực tế

| Người viết | Người review | Kết quả review | Ngày |
| :--- | :--- | :--- | :---: |
| Tùng (APT/QUE) | Hợp | **Chưa thực hiện** | — |
| Hoàng (EXM/EMR) | Trọng | **Chưa thực hiện** | — |
| Hợp (RX/BILL) | An | **Chưa thực hiện** | — |

Gate G3 chỉ PASS khi bảng này có kết quả thật (Approved / Changes requested) và ngày.

## 5. Thứ tự xử lý

1. Quyết định `DEF-G3-01` (và 05, 07) — nhóm + giảng viên.
2. Viết `TC-BILL-007-03`, `TC-BILL-006-02` → chạy để thấy FAIL → sửa `refund_invoice` → chạy lại (`DEF-G3-02`).
3. Hoàn thiện `DEF-G3-06`, `DEF-G3-08` trong G3 v1.2.
4. Review chéo → Gate G3.
