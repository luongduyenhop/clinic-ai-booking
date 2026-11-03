# CLINIC-AI – TESTING PROJECT (BASELINE & GATE G1 RTM)

**Phiên bản:** v1.0 (Đã đối chiếu Source Code & CSDL ERD v8.2)  
**Loại hệ thống:** Private Outpatient Clinic Management (Hệ thống Quản lý Phòng khám Đa khoa Tư nhân Ngoại trú)  
**Quy mô nhóm:** 5 thành viên  
**Công cụ quản lý kiểm thử:** Xray for Jira + Pytest + Chrome DevTools E2E  
**Mục tiêu kiểm thử:** Đánh giá chất lượng toàn diện trước nghiệm thu (Evidence-Based Testing)  

> **Nguyên tắc cốt lõi:** Không được đánh dấu một Test Case là `PASS` chỉ vì nhóm nghĩ rằng chức năng đó hoạt động đúng. Bắt buộc phải có kết quả thực thi thực tế (API response, bản ghi Database PostgreSQL, ảnh chụp màn hình hoặc JUnit XML report) làm bằng chứng tương ứng.

---

# 1. Thiết lập Baseline Kiểm thử Clinic-AI

## 1.1. Phạm vi nghiệp vụ đã thống nhất

### Trong phạm vi MVP (In-Scope)
- Phòng khám đa khoa tư nhân, khám ngoại trú.
- Không tham gia thanh quyết toán BHYT.
- Quản lý đặt lịch trực tuyến (theo bác sĩ / chuyên khoa), danh sách chờ (Waitlist), nghỉ phép bác sĩ.
- Quản lý tiếp đón (Check-in lịch hẹn, Walk-in vãng lai, Tiếp nhận cấp cứu Red-Flag), hàng đợi ưu tiên đa tầng và lượt khám.
- Hồ sơ bệnh án điện tử (EMR), sinh hiệu (tự tính BMI), khám chuyên khoa sâu (5 chuyên khoa), chẩn đoán ICD-10, khóa bệnh án & biên bản đính chính (TT 32/2023).
- Chỉ định cận lâm sàng (CLS), KTV tiếp nhận mẫu & nhập kết quả, tự động cảnh báo trị số nguy kịch, bác sĩ/KTV ký duyệt & khóa kết quả CLS.
- Kê đơn thuốc ngoại trú, cảnh báo dị ứng thuốc, ký số đơn thuốc (SHA-256) và mô phỏng liên thông Cổng Đơn thuốc Quốc gia.
- **Hóa đơn, thanh toán đa phương thức (Tiền mặt, Chuyển khoản VietQR NAPAS 247, Thẻ POS), chống thu trùng, hủy/hoàn tiền viện phí và khóa sổ ca trực thu ngân.**
- AI gợi ý chuyên khoa từ triệu chứng tự nhiên và phát hiện triệu chứng cờ đỏ (Red Flags).
- Kiểm soát Chứng chỉ hành nghề (CCHN), Nhật ký kiểm toán truy cập EMR (Audit Log) và Dashboard thống kê vận hành.

### Ngoài phạm vi MVP (Out-of-Scope)
- Nghiệp vụ thanh quyết toán BHYT.
- Khám sức khỏe định kỳ / khám đoàn hợp đồng công ty.
- Đồng bộ Sổ sức khỏe điện tử (VNeID).
- Xử lý hình ảnh / Quét camera QR CCCD bằng thị giác máy tính.

---

## 1.2. Sáu mục tiêu chất lượng (Quality Objectives)

| ID | Mục tiêu | Điều cần chứng minh | Mức ưu tiên |
| :--- | :--- | :--- | :---: |
| **QO-01** | Functional Correctness | Nghiệp vụ đặt lịch, tiếp đón, khám, CLS, đơn thuốc, thu ngân hoạt động đúng đặc tả | Cao |
| **QO-02** | Data Integrity | Dữ liệu không bị sai lệch, mất mát, âm tiền hoặc ghi trùng (Overbooking, Double Billing) | **Ưu tiên số 1** |
| **QO-03** | Security & RBAC | Phân quyền nghiêm ngặt theo 6 vai trò; chặn bác sĩ hết hạn CCHN; ghi Audit Log đầy đủ | **Ưu tiên số 1** |
| **QO-04** | Reliability | Hệ thống xử lý đúng các tình huống ngoại lệ, tranh chấp đồng thời (Concurrency) và Rollback sạch | Cao |
| **QO-05** | Performance | Thời gian phản hồi API đặt lịch, gọi số, thanh toán và AI gợi ý đáp ứng ngưỡng xác định | Trung bình |
| **QO-06** | Usability | Giao diện và luồng thao tác phù hợp với từng vai trò (Bệnh nhân, Lễ tân, Bác sĩ, KTV, Thu ngân, Admin) | Trung bình |

---

## 1.3. Sáu khu vực rủi ro cao (Risk-Based Testing Focus)

| STT | Khu vực rủi ro cao | Rủi ro nghiệp vụ & kỹ thuật cần kiểm thử | Cơ chế bảo vệ trong Code & DB |
| :---: | :--- | :--- | :--- |
| **1** | **Đặt lịch khám (`APT`)** | Hai bệnh nhân đặt trùng cùng 1 slot khi chỉ còn 1 chỗ trống (Overbooking) | Khóa bi quan `SELECT ... FOR UPDATE`, Unique Index `uq_active_doctor_slot`, `Idempotency-Key` |
| **2** | **Tiếp đón & Hàng đợi (`REC`, `QUE`)** | Sai thứ tự ưu tiên giữa Cấp cứu / Có KQ CLS / Online đúng hẹn / Vãng lai; cấp trùng STT | Unique `(phong_kham_id, ngay_xep_hang, so_thu_tu)`, thuật toán phân luồng 5 bậc ưu tiên |
| **3** | **Lượt khám (`EXM`)** | Kết thúc lượt khám khi chưa có chẩn đoán chính ICD-10 hoặc còn chỉ định CLS đang làm dở | Guard điều kiện hoàn tất trong `clinical_service.complete_encounter` |
| **4** | **Hồ sơ bệnh án (`EMR`)** | Sửa trực tiếp dữ liệu bệnh án sau khi đã khóa (`is_locked=True`) | Chặn `PUT/PATCH` trực tiếp; bắt buộc tạo `BienBanDinhChinh` lưu JSON gốc và mới |
| **5** | **Đơn thuốc & Chỉ định CLS (`RX`, `LAB`)** | Công bố kết quả CLS chưa duyệt hoặc đơn thuốc chưa ký số; sửa kết quả CLS sau khi đã duyệt | FSM `DRAFT -> SIGNED -> ISSUED` (băm SHA-256) và `CHO_DUYET -> DA_DUYET` khóa bất biến |
| **6** | **Hóa đơn & Thanh toán (`BILL`)** | Lập 2 hóa đơn cho 1 ca khám, thu tiền trùng 2 lần, tính sai tổng tiền, sửa/hủy phiếu sau khóa sổ | Unique Index `uq_hoa_don_luot_kham_hieu_luc`, khóa `FOR UPDATE`, kiểm tra `so_tien_khach_tra >= thuc_thu`, `KhoaSoCaTruc` |

---

# 2. Giai đoạn 1 – Phân tích Yêu cầu và Xây dựng RTM (Gate G1)

## 2.1. Cấu trúc Requirement ID

| Prefix | Module | Phân công Thành viên phụ trách (5 thành viên) |
| :--- | :--- | :--- |
| **AUTH** | Authentication (Xác thực) | Thành viên 1 (Hợp) |
| **USER** | User, RBAC & Compliance (Phân quyền & Tuân thủ) | Thành viên 1 (Hợp) |
| **APT** | Appointment (Đặt lịch, Waitlist, Nghỉ phép) | Thành viên 2 (Tùng) |
| **REC** | Reception (Tiếp đón Check-in, Walk-in, Cấp cứu) | Thành viên 2 (Tùng) |
| **QUE** | Queue Management (Hàng đợi & Gọi số) | Thành viên 2 (Tùng) |
| **EXM** | Examination (Quản lý Lượt khám) | Thành viên 3 (Bác sĩ / EMR) |
| **EMR** | Electronic Medical Record (Bệnh án điện tử & Chuyên khoa) | Thành viên 3 (Bác sĩ / EMR) |
| **LAB** | Laboratory / Diagnostic (Cận lâm sàng XN & CĐHA) | Thành viên 4 (Trọng - CLS) |
| **RX** | Prescription (Đơn thuốc điện tử & Liên thông) | Thành viên 1 (Hợp) |
| **BILL** | Billing & Payment (Hóa đơn, Thanh toán, Hoàn tiền, Khóa sổ) | Thành viên 1 (Hợp) |
| **RPT** | Reporting & Analytics (Báo cáo & Thống kê vận hành) | Thành viên 5 (AI & Báo cáo) |
| **AI** | AI Specialty Recommendation (AI Phân luồng triệu chứng) | Thành viên 5 (AI & Báo cáo) |

---

## 2.2. Requirement Inventory Chính thức (49 Requirements)

### A. Authentication và Phân quyền (`AUTH`, `USER`)

| Requirement ID | Yêu cầu nghiệp vụ | Tiêu chí nghiệm thu (Acceptance Criteria) | Ưu tiên | Rủi ro | API / Code thực tế |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **AUTH-001** | Người dùng đăng nhập bằng thông tin hợp lệ | Trả về HTTP 200, cấp `access_token`, `refresh_token` và đúng `vai_tro` | High | Medium | `POST /api/v1/auth/login` |
| **AUTH-002** | Từ chối đăng nhập khi thông tin không hợp lệ | Sai mật khẩu, tài khoản không tồn tại hoặc bị khóa trả về HTTP 401/403 | High | Medium | `POST /api/v1/auth/login` |
| **AUTH-003** | Người dùng đăng xuất và kết thúc phiên làm việc | Thu hồi `refresh_token_hash` trong DB và xóa trạng thái phiên trên trình duyệt | Medium | Low | `POST /api/v1/auth/logout` |
| **USER-001** | Phân quyền theo 6 vai trò: `ADMIN`, `BAC_SI`, `LE_TAN`, `KY_THUAT_VIEN`, `THU_NGAN`, `BENH_NHAN` | `ProtectedRoute` trên UI và `require_roles` trên Backend kiểm soát đúng phân hệ | Critical | High | `app/core/dependencies.py` |
| **USER-002** | API phải từ chối truy cập khi người dùng không đủ quyền | Mọi request vượt quyền (VD: Bệnh nhân gọi API thu ngân/duyệt CLS) bị chặn HTTP 403 | Critical | High | `require_roles` trên các routers |
| **USER-003** | Kiểm soát hiệu lực CCHN bác sĩ & Ghi nhật ký kiểm toán truy cập EMR | Bác sĩ hết hạn/thu hồi CCHN bị chặn khám & kê đơn; mọi lượt xem EMR ghi vào `nhat_ky_truy_cap_y_te` | Critical | High | `credential_service.py`, `audit_trail_service.py` |

### B. Appointment – Đặt lịch khám (`APT`)

| Requirement ID | Yêu cầu nghiệp vụ | Tiêu chí nghiệm thu (Acceptance Criteria) | Ưu tiên | Rủi ro | API / Code thực tế |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **APT-001** | Bệnh nhân xem thông tin lịch khám khả dụng | Chỉ trả về các ca làm việc `is_active=True`, bác sĩ không nghỉ phép và còn chỗ trống | High | Medium | `GET /api/v1/appointments/slots` |
| **APT-002** | Bệnh nhân đặt lịch khám theo bác sĩ hoặc chuyên khoa | Sinh bản ghi `lich_kham` mã `LK-YYYYMMDD-xxxxx`, hỗ trợ `Idempotency-Key` chống gửi đúp | Critical | High | `POST /api/v1/appointments` |
| **APT-003** | Hệ thống không cho phép đặt trùng lịch vượt quá khả năng tiếp nhận | Ràng buộc `uq_active_doctor_slot` và `uq_active_patient_slot` từ chối HTTP 409 khi hết chỗ | Critical | High | `appointment_service.py`, Migration `014` |
| **APT-004** | Hệ thống xử lý hai yêu cầu đặt lịch đồng thời (Concurrency) | Khóa bi quan `SELECT FOR UPDATE` đảm bảo đúng 1 request 201 Created, request còn lại 409 Conflict | Critical | High | `appointment_service.py` |
| **APT-005** | Bệnh nhân xem thông tin và trạng thái lịch đã đặt | Hiển thị chính xác danh sách và trạng thái lịch hẹn của bệnh nhân trên Cổng bệnh nhân | Medium | Low | `GET /api/v1/appointments/my` |
| **APT-006** | Hệ thống xử lý hủy lịch theo quy tắc nghiệp vụ | Chuyển sang `da_huy`, lưu `thoi_gian_huy`, `ly_do_huy`, `nguoi_huy_id` và giải phóng slot | High | Medium | `POST /api/v1/appointments/{id}/cancel` |
| **APT-007** | Đăng ký Danh sách chờ (Waitlist) khi kín lịch & tự động giữ slot khi có lịch hủy | Lưu `danh_sach_cho`; khi có người hủy lịch cùng ca, tự động giữ slot ưu tiên cho người đứng đầu | High | Medium | `/api/v1/appointments/waitlist` |
| **APT-008** | Quản lý Nghỉ phép bác sĩ & đánh giá lịch hẹn bị ảnh hưởng | Lưu `nghi_phep_bac_si`; khi duyệt nghỉ phép tự động khóa ca trực và liệt kê các lịch hẹn bị ảnh hưởng | High | Medium | `/api/v1/admin/doctor-leaves` |

### C. Reception và Queue Management (`REC`, `QUE`)

| Requirement ID | Yêu cầu nghiệp vụ | Tiêu chí nghiệm thu (Acceptance Criteria) | Ưu tiên | Rủi ro | API / Code thực tế |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **REC-001** | Lễ tân tiếp nhận bệnh nhân đã đặt lịch trước | Kiểm tra lịch hẹn hợp lệ, phân loại đúng giờ/sớm/trễ và chuyển trạng thái sang `da_tiep_nhan` | Critical | High | `POST /api/v1/reception/check-in` |
| **REC-002** | Lễ tân tiếp nhận bệnh nhân đến trực tiếp (Walk-in) | Tra cứu SĐT hoặc tạo mới `BenhNhan` (chặn trùng SĐT), kiểm tra hạn mức vãng lai và cấp số | High | Medium | `POST /api/v1/reception/walk-in` |
| **REC-003** | Hệ thống tạo lượt khám phù hợp với bệnh nhân được tiếp nhận | Khởi tạo đồng bộ `luot_kham` và `hang_doi_kham` trong cùng một giao dịch CSDL (atomic transaction) | Critical | High | `reception.py` |
| **REC-004** | Lễ tân tiếp nhận phân luồng cấp cứu (Red-Flag / RC-06) | Tạo lượt khám cấp cứu với mức ưu tiên cao nhất, đẩy thẳng lên đầu hàng đợi buồng khám | Critical | High | `POST /api/v1/reception/emergency` |
| **QUE-001** | Hệ thống cấp số thứ tự khám duy nhất cho bệnh nhân | Ràng buộc Unique `(phong_kham_id, ngay_xep_hang, so_thu_tu)` chống trùng STT, in phiếu nhiệt 80mm | Critical | High | `queue_service.py` |
| **QUE-002** | Hệ thống quản lý trạng thái hàng đợi | Chuyển trạng thái chuẩn (`CHO_KHAM`, `DANG_GOI`, `DANG_KHAM`, `CHO_CLS`, `CO_KET_QUA_CLS`, `VANG_MAT`, `HOAN_TAT`) | Critical | High | `/api/v1/reception/queue/*` |
| **QUE-003** | Bệnh nhân đặt lịch online đúng giờ và BN có KQ CLS được ưu tiên hơn BN offline đang chờ | Sắp xếp hàng đợi theo 5 bậc: Cấp cứu > Có KQ CLS > Đặt lịch đúng giờ > Đến sớm/muộn > Vãng lai (kèm chống đói) | Critical | High | `queue_service.py` |

### D. Examination và EMR (`EXM`, `EMR`)

| Requirement ID | Yêu cầu nghiệp vụ | Tiêu chí nghiệm thu (Acceptance Criteria) | Ưu tiên | Rủi ro | API / Code thực tế |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **EXM-001** | Bác sĩ xem được danh sách bệnh nhân chờ khám | Hiển thị danh sách chờ khám, chờ CLS, có kết quả CLS theo thứ tự ưu tiên tại buồng khám | High | Medium | `GET /api/v1/clinical/queue` |
| **EXM-002** | Bác sĩ bắt đầu và kết thúc lượt khám theo quy trình | Chặn hoàn tất khám nếu chưa nhập chẩn đoán chính ICD-10 hoặc còn chỉ định CLS đang thực hiện dở dang | Critical | High | `clinical_service.py` |
| **EMR-001** | Bác sĩ ghi nhận sinh hiệu, thông tin khám và chẩn đoán ICD-10 | Tự động tính BMI từ chiều cao/cân nặng, lưu `luot_kham_the_luc` và bắt buộc có chẩn đoán chính `ma_icd10` | Critical | High | `PUT /api/v1/clinical/workspace-state` |
| **EMR-002** | Hệ thống lưu lịch sử hồ sơ khám | Lưu bền vững và tra cứu chính xác lịch sử các lần khám, chẩn đoán, đơn thuốc, kết quả CLS | Critical | High | `GET /api/v1/clinical/encounters/{id}` |
| **EMR-003** | Hồ sơ đã khóa không được sửa trực tiếp, thay đổi phải qua nghiệp vụ đính chính | Sau khi khóa bệnh án (`is_locked=True`), chặn sửa trực tiếp; bắt buộc tạo `BienBanDinhChinh` lưu bản gốc & mới | Critical | High | `POST /api/v1/clinical/encounters/{id}/amendments` |
| **EMR-004** | Khám chuyên khoa sâu (Nội, Ngoại, Mắt, TMH, RHM) & Phân loại sức khỏe | Lưu dữ liệu vào 5 bảng chuyên khoa tương ứng và tự động phân loại sức khỏe (`LOAI_1`..`LOAI_3`) | High | Medium | `PUT /api/v1/clinical/encounters/{id}/specialty/{dept}` |

### E. Laboratory và Prescription (`LAB`, `RX`)

| Requirement ID | Yêu cầu nghiệp vụ | Tiêu chí nghiệm thu (Acceptance Criteria) | Ưu tiên | Rủi ro | API / Code thực tế |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **LAB-001** | Bác sĩ tạo chỉ định dịch vụ cận lâm sàng | Tạo bản ghi `chi_dinh` trạng thái `da_chi_dinh` / `CHO_THUC_HIEN`, đồng bộ sang danh sách KTV | High | High | `POST /api/v1/clinical/encounters/{id}/orders` |
| **LAB-002** | Nhân viên kỹ thuật ghi nhận kết quả và thông tin thực hiện | Chuyển `CHO_THUC_HIEN -> dang_thuc_hien -> cho_duyet`, lưu trị số xét nghiệm chi tiết và ảnh CĐHA | High | High | `POST /api/v1/subclinical/orders/{id}/lab-results` |
| **LAB-003** | Kết quả CLS chỉ được công bố và khóa bất biến sau khi duyệt | Sau khi gọi `approve`, phiếu chuyển sang `DA_DUYET`, công bố cho bác sĩ và chặn mọi thao tác sửa kết quả | Critical | High | `POST /api/v1/subclinical/orders/{id}/approve` |
| **LAB-004** | Tự động đối chiếu ngưỡng tham chiếu & gắn cờ Nguy kịch / Bất thường | Tự động gắn cờ `Cao ▲` / `Thấp ▼` / `NGUY_KICH` và đẩy ưu tiên lượt khám trên bàn bác sĩ | Critical | High | `cls_lab_result_service.py` |
| **LAB-005** | Xuất và in phiếu kết quả CLS chuẩn Bộ Y Tế khổ A4/A5 | Hiển thị đầy đủ hành chính, bảng trị số, cờ cảnh báo, kết luận và chữ ký người duyệt | Medium | Low | `GET /api/v1/subclinical/orders/{id}/report` |
| **RX-001** | Bác sĩ lập đơn thuốc theo lượt khám | Tạo `don_thuoc` (`DRAFT`) và `chi_tiet_don_thuoc`, hỗ trợ nạp phác đồ mẫu và tính tự động tổng số lượng | Critical | High | `POST /api/v1/clinical/encounters/{id}/prescriptions` |
| **RX-002** | Đơn thuốc chỉ được công bố sau khi bác sĩ ký số | Chuyển `DRAFT -> SIGNED -> ISSUED`, sinh mã băm SHA-256 `du_lieu_don_thuoc_hash` và khóa bất biến | Critical | High | `prescription_fsm_service.py` |
| **RX-003** | Hệ thống lưu lịch sử thay đổi và hủy thay thế đơn thuốc (`SUPERSEDED`) | Không xóa/ghi đè đơn đã ký; khi kê lại phải chuyển đơn cũ sang `SUPERSEDED` và liên kết đơn mới | High | High | `POST /api/v1/clinical/prescriptions/{id}/supersede` |
| **RX-004** | Cảnh báo dị ứng thuốc & Sao chép đơn thuốc cũ | Hiển thị cảnh báo đỏ khi hoạt chất trùng tiền sử dị ứng của bệnh nhân; hỗ trợ sao chép đơn cũ an toàn | Critical | High | `clinical_service.py` |
| **RX-005** | Liên thông Cổng Đơn thuốc Quốc gia (Mô phỏng chuẩn Bộ Y Tế) | Chỉ gửi đơn đã ký số, sinh mã biên nhận `BYT-2026-xxxxxx` và lưu `lich_su_dong_bo_don_thuoc` | High | High | `national_gateway_service.py` |

### F. Billing và Payment – Hóa đơn, Thanh toán & Khóa sổ (`BILL`)

| Requirement ID | Yêu cầu nghiệp vụ | Tiêu chí nghiệm thu (Acceptance Criteria) | Ưu tiên | Rủi ro | API / Code thực tế |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **BILL-001** | Hệ thống tổng hợp các khoản phí hợp lệ vào hóa đơn | Tự động gom công khám, chỉ định CLS (chưa hủy) và đơn thuốc vào `HoaDon`, tính đúng `thuc_thu = max(0, tong_tien - mien_giam)` | Critical | High | `POST /api/v1/cashier/invoices` (`cashier_service.py`) |
| **BILL-002** | Thu ngân xem trước hóa đơn dự kiến trước khi xác nhận | API `invoice-preview` chỉ đọc (không ghi DB), hiển thị chi tiết từng dòng `cac_khoan_thu`, đơn giá, thành tiền | High | High | `GET /api/v1/cashier/encounters/{id}/invoice-preview` |
| **BILL-003** | Hệ thống hỗ trợ các phương thức thanh toán được triển khai | Hỗ trợ Tiền mặt (`tien_mat`), Chuyển khoản VietQR NAPAS 247 (`chuyen_khoan`), Thẻ POS (`the_pos`); kiểm tra `so_tien_khach_tra >= thuc_thu`; chuyển `ChiDinh` sang `da_thanh_toan` | Critical | High | `POST /api/v1/cashier/invoices/{id}/pay` |
| **BILL-004** | Hệ thống không cho phép lập hóa đơn trùng và không ghi nhận thanh toán trùng | Unique Partial Index `uq_hoa_don_luot_kham_hieu_luc` + khóa dòng `SELECT FOR UPDATE` từ chối HTTP 409 khi lập/thu tiền 2 lần | Critical | High | `cashier_service.py`, Migration `013` |
| **BILL-005** | Hệ thống lưu lịch sử giao dịch thanh toán và tổng kết ca | Lưu đồng bộ `PhieuThuChi(THU)` và `GiaoDichThanhToan(THU_VIEN_PHI)`; tổng kết chính xác tiền mặt/chuyển khoản/POS trong ca | High | High | `GET /api/v1/cashier/shift-summary` |
| **BILL-006** | Hệ thống quản lý trạng thái khóa sổ ca trực theo quy trình | Chốt `PhieuThuChi.trang_thai_khoa_so = True`, tính `chenh_lech_tien_mat = tien_mat_thuc_te - tong_tien_mat_he_thong` và tạo bản ghi `KhoaSoCaTruc(DA_KHOA_SO)` | Critical | High | `POST /api/v1/cashier/close-shift` |
| **BILL-007** | Hệ thống xử lý Hủy hóa đơn chưa thu và Hoàn tiền viện phí (FC-16) | Chặn hủy trực tiếp hóa đơn `da_thu` (HTTP 409); hoàn tiền kiểm tra `0 < so_tien_hoan <= thuc_thu`, sinh phiếu chi `PC-xxx` (`PhieuThuChi(CHI)`) và cập nhật `da_hoan_tien` / `hoan_tien_mot_phan` | High | High | `POST /api/v1/cashier/invoices/{id}/cancel`, `POST /api/v1/cashier/refund` |

### G. Reporting & AI Specialty Recommendation (`RPT`, `AI`)

| Requirement ID | Yêu cầu nghiệp vụ | Tiêu chí nghiệm thu (Acceptance Criteria) | Ưu tiên | Rủi ro | API / Code thực tế |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **RPT-001** | Báo cáo thống kê vận hành, doanh thu, hiệu suất bác sĩ và công suất phòng | Trả về số liệu thống kê khớp với dữ liệu thực tế trong `luot_kham`, `lich_kham`, `hoa_don` | Medium | Low | `GET /api/v1/admin/analytics/*` |
| **AI-001** | Người dùng nhập triệu chứng để nhận gợi ý chuyên khoa | Hỗ trợ nhập mô tả triệu chứng tiếng Việt tự nhiên và phân tích trong thời gian < 3 giây | High | High | `POST /api/v1/ai/analyze` |
| **AI-002** | Hệ thống trả về kết quả gợi ý theo định dạng quy định & cảnh báo cờ đỏ | Trả về JSON gồm chuyên khoa gợi ý, độ tin cậy (%), danh sách bệnh khả năng và cờ cấp cứu `is_emergency` | High | Medium | `ai_service.py` |
| **AI-003** | Hệ thống xử lý đầu vào rỗng hoặc không hợp lệ | Từ chối an toàn (HTTP 400/422) khi chuỗi triệu chứng rỗng, quá ngắn hoặc vượt quá 1500 ký tự | High | Medium | `ai_service.py`, `SymptomSurveyPage.jsx` |
| **AI-004** | Kết quả AI không được coi là chẩn đoán y khoa thay thế bác sĩ | Hiển thị tuyên bố miễn trừ trách nhiệm bắt buộc trên UI bệnh nhân và cho phép bác sĩ đánh giá gợi ý AI (`DanhGiaAi`) | Critical | High | `SymptomSurveyPage.jsx`, `clinical.py` |

---

## 2.3. Đặc tả RTM Chi tiết cho các Nghiệp vụ Rủi ro Cao (Đặt lịch & Thanh toán)

### 2.3.1. Nghiệp vụ Đặt lịch đồng thời (`APT-004`)
- **Requirement ID:** `APT-004`
- **Tên:** Xử lý đặt lịch đồng thời (Concurrency Control).
- **Mô tả:** Hệ thống phải đảm bảo tính nhất quán khi nhiều bệnh nhân cùng gửi yêu cầu đặt lịch cho một tài nguyên (bác sĩ / khung giờ) có số lượng khả dụng giới hạn.
- **Business Risk:** Overbooking – hai bệnh nhân cùng nhận một lịch đã hết chỗ.
- **Priority:** `Critical` | **Risk:** `High`

| Scenario ID | Tình huống kiểm thử | Test Case ID | Kết quả kỳ vọng (API & Database) |
| :--- | :--- | :--- | :--- |
| `TS-APT-004-01` | Hai người đặt cùng lịch khi khung giờ chỉ còn đúng 1 chỗ trống | `TC-APT-004-01` | 1 request `201 Created`, 1 request `409 Conflict`; DB không vượt `han_muc_dat_truoc` |
| `TS-APT-004-02` | Nhiều request (10 requests) đồng thời đặt lịch vào cùng slot | `TC-APT-004-02` | Số lượng lịch thành công không vượt quá số chỗ trống còn lại của ca khám |
| `TS-APT-004-03` | Hai request đặt trùng một bác sĩ ở cùng thời điểm (`uq_active_doctor_slot`) | `TC-APT-004-03` | Đúng 1 bản ghi active được lưu trong bảng `lich_kham`, request thứ hai bị từ chối `409` |
| `TS-APT-004-04` | Client gửi lại request đặt lịch sau timeout với cùng `Idempotency-Key` | `TC-APT-004-04` | Hệ thống trả lại kết quả của lần đặt trước, không tạo bản ghi `lich_kham` thứ hai |
| `TS-APT-004-05` | Kiểm tra dữ liệu sau khi transaction đặt lịch thất bại | `TC-APT-004-05` | Transaction rollback sạch, không phát sinh dữ liệu rác (orphan record) trong DB |

---

### 2.3.2. Nghiệp vụ Hóa đơn, Thanh toán, Hoàn tiền & Khóa sổ (`BILL-001` $\rightarrow$ `BILL-007`)
- **Requirement IDs:** `BILL-001`, `BILL-002`, `BILL-003`, `BILL-004`, `BILL-005`, `BILL-006`, `BILL-007`
- **Tên:** Quản lý Chu trình Thu ngân, Thanh toán Đa phương thức, Chống thu trùng và Khóa sổ Ca trực.
- **Mô tả:** Hệ thống phải tính toán chính xác viện phí từ lượt khám (công khám + CLS + thuốc), ngăn chặn tuyệt đối việc lập hóa đơn trùng hoặc thu tiền 2 lần trên cùng một hóa đơn, đồng bộ trạng thái thanh toán sang cận lâm sàng, kiểm soát hoàn tiền và khóa sổ ca trực cuối ngày.
- **Business Risk:** Thất thoát tài chính, thu tiền bệnh nhân 2 lần (Double Charging), lệch quỹ tiền mặt cuối ca, hoặc KTV thực hiện cận lâm sàng khi chưa đóng tiền.
- **Priority:** `Critical` | **Risk:** `High`

| Scenario ID |Req ID | Tình huống kiểm thử (Test Scenario) | Test Case ID | Kết quả kỳ vọng (API Response & Database Invariants) |
| :--- | :---: | :--- | :--- | :--- |
| `TS-BILL-001-01` | `BILL-001` | Tự động gom công khám, chỉ định CLS và đơn thuốc hợp lệ vào hóa đơn mới | `TC-BILL-001-01` | `POST /api/v1/cashier/invoices` trả về `201 Created`; sinh `HoaDon(trang_thai='chua_thu')` và các dòng `ChiTietHoaDon` khớp chính xác tổng tiền |
| `TS-BILL-001-02` | `BILL-001` | Kiểm tra bất biến số học khi áp dụng miễn giảm và loại trừ dịch vụ CLS đã hủy | `TC-BILL-001-02` | Đảm bảo `thuc_thu = max(0, tong_tien - mien_giam) >= 0`; các `ChiDinh` có `trang_thai='da_huy'` không bị đưa vào hóa đơn |
| `TS-BILL-002-01` | `BILL-002` | Thu ngân xem trước hóa đơn dự kiến trước khi lập hóa đơn chính thức | `TC-BILL-002-01` | `GET /api/v1/cashier/encounters/{id}/invoice-preview` trả về `200 OK` đầy đủ các khoản thu dự kiến, **không tạo bản ghi mới** trong bảng `hoa_don` |
| `TS-BILL-003-01` | `BILL-003` | Thanh toán thành công bằng Tiền mặt (`tien_mat`) hoặc VietQR (`chuyen_khoan`) / POS (`the_pos`) | `TC-BILL-003-01` | `POST /api/v1/cashier/invoices/{id}/pay` trả về `200 OK`; `HoaDon.trang_thai='da_thu'`, sinh `PhieuThuChi(loai_phieu='THU')`, `GiaoDichThanhToan(trang_thai='THANH_CONG')`, và tự động đổi `ChiDinh.trang_thai` sang `'da_thanh_toan'` |
| `TS-BILL-003-02` | `BILL-003` | Từ chối thanh toán khi số tiền khách đưa nhỏ hơn số tiền thực thu (`so_tien_khach_tra < thuc_thu`) | `TC-BILL-003-02` | API trả về `422 Unprocessable Entity`; trạng thái hóa đơn giữ nguyên `'chua_thu'`, không sinh `PhieuThuChi` |
| `TS-BILL-004-01` | `BILL-004` | Chặn lập 2 hóa đơn hiệu lực (`chua_thu`/`da_thu`) cho cùng 1 lượt khám | `TC-BILL-004-01` | Request thứ hai gọi `POST /api/v1/cashier/invoices` bị chặn bởi `_ensure_not_billed` và Unique Index `uq_hoa_don_luot_kham_hieu_luc`, trả về `409 Conflict` |
| `TS-BILL-004-02` | `BILL-004` | Hai thu ngân bấm nút Thanh toán đồng thời trên cùng một hóa đơn (Race Condition) | `TC-BILL-004-02` | Nhờ khóa bi quan `with_for_update()`, đúng 1 request trả về `200 OK`, request còn lại nhận `409 Conflict` ("Hóa đơn đã được thanh toán trước đó"); DB chỉ có đúng 1 `PhieuThuChi(THU)` |
| `TS-BILL-005-01` | `BILL-005` | Đối soát lịch sử giao dịch và báo cáo tổng kết doanh thu ca trực theo phương thức | `TC-BILL-005-01` | `GET /api/v1/cashier/shift-summary` cộng đúng `tong_tien_mat`, `tong_chuyen_khoan`, `tong_the_pos` từ các `PhieuThuChi(trang_thai_khoa_so=False)` |
| `TS-BILL-006-01` | `BILL-006` | Thực hiện khóa sổ ca trực cuối ngày và đối chiếu tiền mặt thực tế tại két | `TC-BILL-006-01` | `POST /api/v1/cashier/close-shift` tạo bản ghi `KhoaSoCaTruc(trang_thai='DA_KHOA_SO')`, tính đúng `chenh_lech_tien_mat = tien_mat_thuc_te - tong_tien_mat_he_thong` và khóa toàn bộ `PhieuThuChi.trang_thai_khoa_so = True` |
| `TS-BILL-006-02` | `BILL-006` | Kiểm tra sau khi khóa sổ ca trực, các phiếu thu cũ không bị cộng dồn sang ca mới | `TC-BILL-006-02` | Gọi lại `GET /api/v1/cashier/shift-summary` ngay sau khi `close-shift` trả về `so_phieu_thu = 0` và `tong_doanh_thu = 0` cho ca trực mới |
| `TS-BILL-007-01` | `BILL-007` | Hủy hóa đơn khi chưa thu tiền (`chua_thu`) và chặn hủy trực tiếp hóa đơn đã thu (`da_thu`) | `TC-BILL-007-01` | Hóa đơn `chua_thu` chuyển sang `da_huy` kèm lý do; nếu hóa đơn đang ở trạng thái `da_thu` thì `POST .../cancel` bị chặn với `409 Conflict` |
| `TS-BILL-007-02` | `BILL-007` | Hoàn tiền viện phí một phần hoặc toàn phần (`POST /api/v1/cashier/refund`) và chặn hoàn vượt mức | `TC-BILL-007-02` | Sinh `PhieuThuChi(loai_phieu='CHI', ma_phieu='PC-...')`, cập nhật hóa đơn sang `da_hoan_tien` hoặc `hoan_tien_mot_phan`; nếu `so_tien_hoan > thuc_thu` thì từ chối `400 Bad Request` |

---

# 3. Đánh giá Tiêu chí Nghiệm thu Gate G1 (Requirement Analysis)

| Tiêu chí | Điều kiện PASS | Trạng thái hiện tại | Minh chứng / Ghi chú |
| :---: | :--- | :---: | :--- |
| **G1.1** | Xác định đầy đủ module trong phạm vi MVP | **ĐẠT (PASS)** | Đầy đủ 12 module (`AUTH`, `USER`, `APT`, `REC`, `QUE`, `EXM`, `EMR`, `LAB`, `RX`, `BILL`, `RPT`, `AI`) |
| **G1.2** | Mỗi yêu cầu có Requirement ID duy nhất | **ĐẠT (PASS)** | 49 Requirement IDs duy nhất từ `AUTH-001` đến `AI-004` |
| **G1.3** | Mỗi yêu cầu có mô tả và tiêu chí nghiệm thu | **ĐẠT (PASS)** | Đã đặc tả rõ Acceptance Criteria ở cả tầng UI, API và Database |
| **G1.4** | Có Priority và Risk | **ĐẠT (PASS)** | 100% yêu cầu được gán Priority (`Critical`/`High`/`Medium`) và Risk (`High`/`Medium`/`Low`) |
| **G1.5** | Không đưa nghiệp vụ ngoài phạm vi vào RTM | **ĐẠT (PASS)** | Đã loại bỏ BHYT, khám đoàn, VNeID và quét ảnh QR CCCD |
| **G1.6** | Các yêu cầu được đối chiếu với đặc tả/code | **ĐẠT (PASS)** | Đã ánh xạ 1-1 với các file router/service thực tế trong `backend/app/` |
| **G1.7** | Có xác nhận của nhóm về baseline yêu cầu | **ĐẠT (PASS)** | Xác nhận theo 3 câu hỏi khóa RTM ở Mục 4 dưới đây |

---

# 4. Xác nhận 3 Điểm Khóa Baseline RTM (Gate G1 Sign-off)

1. **Danh sách module và yêu cầu ở trên có phản ánh đúng phạm vi Clinic-AI hiện tại không?**
   - **Quyết định:** **Cần chỉnh sửa một số yêu cầu (Đã hoàn tất chỉnh sửa trong bản v1.0 này).**
   - Giữ nguyên 12 prefix module, chuẩn hóa chi tiết kỹ thuật cho phân hệ Thanh toán (`BILL-001`..`BILL-007`), Hàng đợi ưu tiên (`QUE-003`), Ký số đơn thuốc (`RX-002`) và loại bỏ hoàn toàn các tính năng xử lý ảnh ngoài phạm vi.
2. **Có nghiệp vụ nào cần bổ sung không?**
   - **Quyết định:** **Có, cần bổ sung (Đã bổ sung đầy đủ vào 49 Requirements).**
   - Đã bổ sung yêu cầu cho prefix `RPT` (`RPT-001`) bị khuyết trong bản nháp đầu tiên, đồng thời bổ sung đầy đủ kịch bản kiểm thử cho **Hóa đơn, Thanh toán, Chống thu trùng, Hoàn tiền và Khóa sổ (`BILL-001` $\rightarrow$ `BILL-007`)** cùng các tính năng nhóm đã code hoàn chỉnh (`USER-003`, `APT-007`, `APT-008`, `REC-004`, `EMR-004`, `LAB-004`, `LAB-005`, `RX-004`, `RX-005`).
3. **Căn cứ để đối chiếu implementation:**
   - **Quyết định:** **Cả hai** (Tài liệu đặc tả Clinic-AI v8.2 mới nhất + Source code và API hiện tại trên nhánh `develop`).
