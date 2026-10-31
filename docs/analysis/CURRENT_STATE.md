# BÁO CÁO KIỂM KÊ HIỆN TRẠNG TOÀN DIỆN NỀN TẢNG CLINIC-AI
## KIẾN TRÚC, CƠ SỞ DỮ LIỆU, API, GIAO DIỆN & TỔNG KHO CODE

**Thời điểm lập:** 12/10/2026  
**Vai trò:** Senior Software Architect & Backend Engineer  
**Tài liệu:** `docs/analysis/CURRENT_STATE.md`  

---

## 1. Tổng quan Kiến trúc Hệ thống Clinic-AI

Hệ thống Clinic-AI được tổ chức theo mô hình **Monorepo** chuẩn hóa, gồm hai thành phần cốt lõi:
1. **Backend:** FastAPI (Python 3.14), SQLAlchemy 2.0 (Async Engine), Pydantic v2, Alembic Migrations, thiết kế mô hình dữ liệu quan hệ kế thừa chuẩn OpenMRS / FHIR.
2. **Frontend:** React 19.2.8, Vite 8.3.0, Ant Design 6.6.5, Tailwind CSS v4, React Router DOM v7, Redux Toolkit, Phosphor Icons.

---

## 2. Bảng Kiểm kê Chi tiết Các Thành phần

### 2.1. Tầng Cơ sở Dữ liệu & Migrations (Database Layer)
Hệ thống quản lý schema qua **Alembic** với 3 phiên bản migration liên tục:
- `001_initial_schema.py`: Tạo các bảng nhân khẩu học, phòng ban, ca trực, lịch hẹn, hàng đợi, hồ sơ khám và đơn thuốc.
- `002_add_refresh_token_to_tai_khoan.py`: Mở rộng xác thực bảo mật đa phiên với refresh token.
- `003_compliance_layer.py`: Bổ sung tầng quản lý tuân thủ pháp lý y tế (CCHN bác sĩ, giấy phép cơ sở, nhật ký kiểm toán bất biến NĐ 102/2025, biên bản đính chính EMR TT 13/2025).

#### Danh mục 22 Bảng Dữ liệu Đang Hoạt động:
1. **Nhóm Quản trị Nhân sự & Địa điểm (Identity & Organization):**
   - `nguoi_dung`: Thông tin nhân khẩu học chung (Person Pattern).
   - `tai_khoan`: Quản lý tài khoản đăng nhập, mật khẩu băm BCrypt, vai trò (`admin`, `bac_si`, `le_tan`, `benh_nhan`), OTP.
   - `bac_si`: Thông tin bác sĩ, chuyên khoa, trình độ, trạng thái hành nghề.
   - `benh_nhan`: Mã định danh bệnh nhân (PID), nhóm máu, tiền sử dị ứng, số thẻ BHYT (chỉ dùng để định danh, không thanh toán).
   - `chuyen_khoa`: Danh mục chuyên khoa lâm sàng.
   - `phong_kham`: Buồng khám vật lý và phòng kỹ thuật (Locations).

2. **Nhóm Lịch trình & Điều phối Hàng đợi (Scheduling & Queue):**
   - `ca_lam_viec`: Định nghĩa khung giờ ca trực (Sáng: 07:30–11:30, Chiều: 13:30–17:30).
   - `lich_lam_viec`: Phân công bác sĩ trực tại buồng khám cụ thể theo ngày.
   - `lich_nghi`: Đăng ký nghỉ phép hoặc nghỉ đột xuất của bác sĩ.
   - `lich_hen`: Đặt lịch khám trực tuyến, trạng thái (`cho_xac_nhan`, `da_xac_nhan`, `da_checkin`, `da_huy`).
   - `hang_doi_kham`: Vé hàng đợi khám trong ngày (Queue Ticket), số thứ tự STT, ưu tiên, trạng thái (`cho_kham`, `dang_kham`, `tam_hoan`, `da_kham`, `bo_kham`).
   - `danh_sach_cho`: Danh sách chờ (Waitlist) dự phòng khi hết slot.

3. **Nhóm Khám chữa bệnh & Dịch vụ Y tế (Clinical & Order Catalog):**
   - `dich_vu_kham`: Bảng giá dịch vụ kỹ thuật, cận lâm sàng, công khám.
   - `khoa_kham`: Phân nhóm viện phí và chuyên khoa.
   - `luot_kham`: Phiên khám bệnh (Encounter), sinh hiệu, lý do khám, quá trình bệnh lý, chẩn đoán ICD-10, trạng thái (`dang_kham`, `cho_ket_qua_cls`, `da_ket_thuc`).
   - `chi_dinh_dich_vu`: Chỉ định xét nghiệm, X-quang, siêu âm, thủ thuật.
   - `ket_qua_xet_nghiem`: Kết quả cận lâm sàng, trị số, file hình ảnh đính kèm.
   - `don_thuoc`: Đơn thuốc điện tử, 11 trạng thái FSM, mã liên thông Cổng Quốc gia.
   - `chi_tiet_don_thuoc`: Danh mục từng loại thuốc trong đơn, liều dùng, cách dùng.

4. **Nhóm Tuân thủ Pháp lý & Kiểm toán Bất biến (Compliance & Legal Audit):**
   - `giay_phep_co_so`: Quản lý giấy phép hoạt động của phòng khám (NĐ 96/2023).
   - `lich_su_giay_phep_bac_si`: Lưu vết gia hạn/đình chỉ CCHN bác sĩ.
   - `nhat_ky_truy_cap_du_lieu_y_te`: Bảng ghi bất biến (Append-only) mọi hành vi xem, sửa, xuất dữ liệu bệnh nhân (NĐ 102/2025).
   - `bien_ban_dinh_chinh`: Biên bản sửa đổi hồ sơ bệnh án đã khóa (TT 13/2025).

---

### 2.2. Tầng Dịch vụ & Nghiệp vụ Backend (Service Layer)

| Tên Service | Kích thước | Chức năng nghiệp vụ chính | Đánh giá hiện trạng |
|---|:---:|---|---|
| `admin_service.py` | 100 KB | Quản trị chuyên khoa, phòng khám, phân bổ ca trực, báo cáo tổng hợp, quản lý dịch vụ kỹ thuật | Đầy đủ, hỗ trợ tốt quản trị phòng khám. |
| `appointment_service.py` | 63 KB | Thuật toán đặt lịch, chia slot động, quy tắc hủy/đổi lịch, danh sách chờ Waitlist | Chặt chẽ, xử lý xung đột lịch tốt. |
| `clinical_service.py` | 48 KB | Khởi tạo phiên khám, ghi nhận sinh hiệu, chẩn đoán ICD-10, chỉ định CLS, khóa hồ sơ EMR, đính chính Four-Eyes | Đầy đủ quy tắc bất biến hồ sơ bệnh án. |
| `queue_service.py` | 37 KB | Điều phối hàng đợi, gọi số tiếp theo, tạm hoãn, chuyển phòng, cân bằng tải bác sĩ | Logic hàng đợi mượt mà. |
| `prescription_fsm_service.py` | 17 KB | Máy trạng thái hữu hạn 11 bước cho đơn thuốc điện tử, khóa đơn khi ký, kê đơn thay thế | Tuân thủ Thông tư 26/2025/TT-BYT. |
| `credential_service.py` | 23 KB | Giám sát hạn CCHN, chặn 403 bác sĩ vi phạm, cảnh báo 90/60/30 ngày | Tuân thủ Nghị định 96/2023/NĐ-CP. |
| `national_gateway_service.py` | 14 KB | Mô phỏng liên thông Cổng Quốc gia, xử lý Idempotency-Key và Timeout | Đã xử lý phục hồi lỗi mạng. |
| `audit_trail_service.py` | 3 KB | Tự động ghi vết truy cập dữ liệu cá nhân y tế | Tuân thủ Nghị định 102/2025/NĐ-CP. |
| `compliance_dashboard_service.py` | 7 KB | Tổng hợp số liệu tuân thủ, xuất báo cáo thanh tra y tế | Hoạt động tốt. |
| `ai_service.py` | 16 KB | Mô hình AI phân luồng chuyên khoa dựa trên triệu chứng sơ bộ, nhận diện Red Flags | Không chẩn đoán thay bác sĩ, an toàn pháp lý. |
| `auth_service.py` | 14 KB | Đăng nhập, băm BCrypt, sinh JWT token, quản lý phiên và OTP | Bảo mật tốt. |

---

### 2.3. Tầng Giao diện Người dùng (Frontend - `fe-clinic-ai-booking`)

- Đã cấu hình theo phong cách nhận diện y tế chuẩn Medpro.vn kết hợp các luồng tác nghiệp từ tClinic.
- Chứa 5 Bàn làm việc (Workbenches) tương ứng 5 vai trò thực tế:
  1. `AdminPortal.jsx` / `WorkbenchManager`: Bàn Quản lý giám đốc phòng khám.
  2. `ReceptionDesk.jsx`: Bàn Lễ tân tiếp đón, hỗ trợ phím tắt F2, F5, F7, F8, F9.
  3. `DoctorPortal.jsx`: Bàn Bác sĩ lâm sàng, nhập bệnh án, kê đơn, ký số.
  4. `CashierPortal.jsx`: Bàn Thu ngân viện phí (cần hoàn thiện sâu hơn theo đối sánh tClinic).
  5. `ComplianceDashboard.jsx`: Bàn Giám sát tuân thủ y tế.
  6. `WaitingRoomTV.jsx`: Màn hình TV gọi số phòng chờ thời gian thực.

---

## 3. Các Khoảng trống & Hạn chế Cần Hoàn thiện Sau Đối chiếu

So sánh với các luồng nghiệp vụ thực tế ghi nhận từ `demo.tclinic.io`, Clinic-AI có những khoảng trống sau:

1. **Phân hệ Kỹ thuật viên Cận lâm sàng (CLS / PACS / LIS Workbench):**
   - *Hiện tại ở Clinic-AI:* Bác sĩ chỉ định qua `chi_dinh_dich_vu` và kết quả được nhập qua API tổng quát.
   - *Thực tế tClinic:* Có luồng riêng cho Kỹ thuật viên (Xét nghiệm, CĐHA, PT-TT): Danh sách chờ lấy mẫu, trạng thái đang thực hiện, đính kèm kết quả hình ảnh/chỉ số, ký xác nhận KTV trước khi trả về cho Bác sĩ lâm sàng.
2. **Phân hệ Thu ngân & Quản lý Thu chi Viện phí Chi tiết:**
   - *Hiện tại ở Clinic-AI:* Đã có bảng giá dịch vụ và trạng thái thanh toán cơ bản.
   - *Thực tế tClinic:* Có hóa đơn chi tiết từng khoản (công khám, thuốc, CLS), hỗ trợ phiếu thu tạm ứng, phiếu hoàn trả, tổng kết tiền mặt cuối ca trực (Khóa sổ thu ngân).
3. **Quản lý Danh mục Vật tư & Dược nâng cao (Inventory & Batches):**
   - *Hiện tại ở Clinic-AI:* Đã có danh mục thuốc và kê đơn.
   - *Thực tế tClinic:* Có số lô, hạn dùng (FEFO - First Expired, First Out) và cảnh báo tồn kho tối thiểu.
4. **Hồ sơ Khám chuyên khoa sâu & Đánh giá Thể lực:**
   - *Hiện tại ở Clinic-AI:* Đã có sinh hiệu chung và chẩn đoán ICD-10.
   - *Thực tế tClinic:* Có mẫu khám chuyên sâu theo từng cơ quan (Tuần hoàn, Hô hấp, Tiêu hóa, Thần kinh, Răng hàm mặt, Mắt) và phân loại thể lực theo Thông tư 32/2023/TT-BYT.

---

## 4. Đánh giá Rủi ro Hồi quy (Regression Risks)

- **Rủi ro 1:** Mở rộng bảng `luot_kham` hoặc `chi_dinh_dich_vu` làm ảnh hưởng đến 18 test lâm sàng và 5 test invariant chẩn đoán.
  - *Giải pháp:* Dùng quan hệ 1-1 mở rộng (`luot_kham_the_luc`, `ket_qua_cls_chi_tiet`) hoặc nullable fields với default hợp lệ.
- **Rủi ro 2:** Bổ sung bước thực hiện CLS làm gián đoạn luồng hoàn tất lượt khám (`test_walk_in_full_clinical_lifecycle.py`).
  - *Giải pháp:* Giữ điều kiện hoàn tất linh hoạt: Nếu ca khám không có chỉ định CLS thì cho phép hoàn tất ngay; nếu có chỉ định CLS thì phải có kết quả mới cho phép hoàn tất.
- **Rủi ro 3:** Cập nhật API làm sai lệch dữ liệu Seed của Frontend (`clinicSeed.json`).
  - *Giải pháp:* Đảm bảo DTO Response giữ nguyên các trường cũ, chỉ bổ sung trường mới.
