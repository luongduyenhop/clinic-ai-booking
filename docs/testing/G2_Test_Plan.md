# CLINIC-AI — SOFTWARE TEST PLAN (GATE G2)

**Tài liệu:** Software Test Plan  
**Phiên bản:** v1.0 — Proposed Baseline (Ready for Review)  
**Giai đoạn:** G2 — Test Planning  
**Dự án:** Clinic-AI  
**Loại hệ thống:** Private Outpatient Clinic Management System  
**Phương pháp:** Hybrid Testing (Manual + API Automation + Browser E2E)  
**Công cụ:** Xray for Jira Cloud, Pytest (`pytest-asyncio`), Chrome DevTools E2E  
**Quy mô nhóm:** 5 thành viên (Hợp, Tùng, Hoàng, Trọng, An)  
**Căn cứ:** [`G1_Requirement_Baseline_and_RTM.md`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/G1_Requirement_Baseline_and_RTM.md) và [`ClinicAI_RTM.xlsx`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/ClinicAI_RTM.xlsx) (49 Requirements, 66 Test Cases — Gate G1: `PASS`)

---

# 1. Introduction

## 1.1. Purpose

Tài liệu này xác định chiến lược, phạm vi, phương pháp, nguồn lực, môi trường, lịch trình và tiêu chí thực hiện kiểm thử cho hệ thống Clinic-AI.

Mục tiêu là đánh giá chất lượng hệ thống trước khi nghiệm thu, đảm bảo các chức năng đáp ứng yêu cầu nghiệp vụ và các ràng buộc kỹ thuật đã được xác định trong Requirement Traceability Matrix (RTM).

Hoạt động kiểm thử tuân theo nguyên tắc **Evidence-Based Testing**: một Test Case chỉ được đánh dấu `PASS` khi có kết quả thực thi thực tế và bằng chứng phù hợp (API response, bản ghi Database PostgreSQL, ảnh chụp màn hình hoặc JUnit XML report).

## 1.2. System Overview

Clinic-AI là hệ thống quản lý phòng khám đa khoa tư nhân, hoạt động trong phạm vi khám ngoại trú.

Hệ thống hỗ trợ:
- Quản lý tài khoản và phân quyền người dùng theo 6 vai trò (`ADMIN`, `BAC_SI`, `LE_TAN`, `KY_THUAT_VIEN`, `THU_NGAN`, `BENH_NHAN`).
- Đặt lịch khám trực tuyến, danh sách chờ (Waitlist) và quản lý nghỉ phép bác sĩ.
- Tiếp đón bệnh nhân (Check-in lịch hẹn, Walk-in vãng lai, Tiếp nhận cấp cứu Red-Flag), cấp số và quản lý hàng đợi ưu tiên đa tầng.
- Quản lý lượt khám và hồ sơ bệnh án điện tử (EMR), khám chuyên khoa sâu 5 chuyên khoa, khóa bệnh án & biên bản đính chính (TT 32/2023).
- Chỉ định, thực hiện, cảnh báo trị số nguy kịch và ký duyệt kết quả cận lâm sàng (CLS).
- Kê đơn thuốc điện tử, cảnh báo dị ứng thuốc, ký số SHA-256 và liên thông Cổng Đơn thuốc Quốc gia (mô phỏng chuẩn Bộ Y tế).
- Quản lý hóa đơn, thanh toán đa phương thức (Tiền mặt, VietQR NAPAS 247, Thẻ POS), chống thu trùng, hoàn tiền và khóa sổ ca trực.
- AI gợi ý chuyên khoa dựa trên triệu chứng tự nhiên và cảnh báo cờ đỏ cấp cứu.
- Báo cáo vận hành, kiểm soát hiệu lực Chứng chỉ hành nghề (CCHN) và Nhật ký kiểm toán (Audit Log).

## 1.3. Testing Objectives

Các mục tiêu kiểm thử (liên kết với `QO-01` $\rightarrow$ `QO-06` tại Baseline G1):

1. **Functional Correctness (`QO-01`)**: Xác minh tính đúng đắn của chức năng theo Acceptance Criteria.
2. **Data Integrity (`QO-02` - Ưu tiên số 1)**: Đảm bảo tính toàn vẹn dữ liệu trong các nghiệp vụ quan trọng (không overbooking, không âm tiền, không thu tiền trùng, không sửa dữ liệu sau khi khóa).
3. **Security & RBAC (`QO-03` - Ưu tiên số 1)**: Xác minh phân quyền 6 vai trò, chặn bác sĩ hết hạn CCHN và ghi nhận đầy đủ Audit Log truy cập EMR.
4. **Reliability (`QO-04`)**: Kiểm tra xử lý lỗi, giao dịch đồng thời (`SELECT ... FOR UPDATE`) và rollback sạch khi gặp ngoại lệ.
5. **Performance (`QO-05`)**: Đánh giá hiệu năng phản hồi của các API trọng yếu dưới ngưỡng quy định.
6. **Usability (`QO-06`)**: Đánh giá tính phù hợp của giao diện và luồng thao tác theo từng vai trò.

---

# 2. Test Scope

## 2.1. In-Scope

Phạm vi kiểm thử bao gồm **12 module**, **49 Requirements** và **66 Test Cases** đã được xác định và khóa baseline trong [`ClinicAI_RTM.xlsx`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/ClinicAI_RTM.xlsx).

| Module | Prefix | Số Requirements | Số Test Cases | Phụ trách chính |
| :--- | :---: | :---: | :---: | :--- |
| Authentication | `AUTH` | 3 | 5 | Hợp |
| User, Permission & Compliance | `USER` | 3 | 5 | Hợp |
| Appointment | `APT` | 8 | 12 | Tùng |
| Reception | `REC` | 4 | 5 | Tùng |
| Queue Management | `QUE` | 3 | 3 | Tùng |
| Examination | `EXM` | 2 | 3 | Hoàng |
| Electronic Medical Record | `EMR` | 4 | 4 | Hoàng |
| Laboratory / Diagnostic | `LAB` | 5 | 6 | Trọng |
| Prescription | `RX` | 5 | 5 | Hợp |
| Billing & Payment | `BILL` | 7 | 13 | Hợp |
| Reporting | `RPT` | 1 | 1 | An |
| AI Specialty Recommendation | `AI` | 4 | 4 | An |
| **Tổng cộng** | | **49** | **66** | **5 thành viên** |

## 2.2. Out-of-Scope

Các nội dung không thuộc phạm vi kiểm thử MVP:
- Nghiệp vụ thanh quyết toán bảo hiểm y tế (BHYT).
- Khám sức khỏe định kỳ và khám đoàn theo hợp đồng công ty.
- Đồng bộ Sổ sức khỏe điện tử / VNeID.
- Xử lý hình ảnh hoặc quét camera QR CCCD bằng thị giác máy tính.

Các nội dung này không được tính vào Requirement Coverage của baseline G1.

---

# 3. Test Strategy

## 3.1. Overall Approach

Clinic-AI sử dụng **Hybrid Testing**, kết hợp ba phương pháp:

| Phương pháp | Mục tiêu | Công cụ |
| :--- | :--- | :--- |
| **Manual Testing** | Kiểm tra giao diện, luồng nghiệp vụ, phân quyền và các mẫu phiếu in (nhiệt 80mm, CLS A4/A5, VietQR) | Xray Cloud, Chrome Browser |
| **API Automation** | Kiểm tra API, validation, business rules, concurrency (`asyncio.gather`), database invariants và negative cases | Pytest, `httpx.AsyncClient`, SQLAlchemy |
| **E2E Testing** | Kiểm tra luồng nghiệp vụ xuyên suốt từ giao diện người dùng qua API xuống PostgreSQL | Chrome DevTools MCP E2E |

Việc lựa chọn phương pháp cho từng Test Case dựa trên cột `Test Type` trong RTM. Không bắt buộc mọi Test Case giao diện đều phải viết script automation, nhưng **100% các ca kiểm thử Concurrency, Khóa bất biến và Chống thu trùng bắt buộc phải có API Automation kiểm chứng xuống Database**.

## 3.2. Test Levels

### A. Functional Testing
Kiểm tra từng chức năng độc lập theo Acceptance Criteria: Đăng nhập/Đăng xuất, Đặt lịch khám, Tiếp nhận bệnh nhân, Tạo lượt khám, Nhập sinh hiệu & ICD-10, Kê đơn thuốc, Lập hóa đơn & Thanh toán.

### B. Integration Testing
Kiểm tra sự phối hợp dữ liệu giữa các module:
- `Reception` tiếp nhận $\rightarrow$ tự động khởi tạo đồng bộ `LuotKham` và `HangDoiKham` trong cùng 1 transaction.
- `Examination` tạo chỉ định CLS $\rightarrow$ đồng bộ tức thì sang hàng đợi KTV (`/doctor/can-lam-sang`).
- `Laboratory` duyệt kết quả CLS (`DA_DUYET`) $\rightarrow$ tự động gắn cờ Nguy kịch/Bất thường và đẩy ưu tiên lượt khám trên bàn Bác sĩ.
- `Billing` xác nhận thanh toán (`pay`) $\rightarrow$ tự động sinh `PhieuThuChi(THU)`, `GiaoDichThanhToan(THU_VIEN_PHI)` và chuyển các `ChiDinh` từ `da_chi_dinh` sang `da_thanh_toan`.
- `Prescription` ký số (`SIGNED` $\rightarrow$ `ISSUED`) $\rightarrow$ gửi liên thông Cổng Đơn thuốc Quốc gia nhận mã biên nhận `BYT-2026-xxxxxx`.

### C. System / End-to-End Testing
Kiểm tra luồng nghiệp vụ khép kín xuyên suốt hệ thống:
`Bệnh nhân khảo sát triệu chứng AI & Đặt lịch` $\rightarrow$ `Lễ tân tiếp nhận & Cấp số` $\rightarrow$ `Bác sĩ gọi số, khám lâm sàng & Chỉ định CLS` $\rightarrow$ `Thu ngân thu viện phí` $\rightarrow$ `KTV nhập kết quả & Duyệt CLS` $\rightarrow$ `Bác sĩ kết luận, kê đơn & Ký số` $\rightarrow$ `Thu ngân khóa sổ ca trực & Admin kiểm tra Audit Log`.

### D. Security Testing
Tập trung vào:
- Kiểm soát quyền theo 6 vai trò (`ProtectedRoute` ở Frontend và `require_roles` ở Backend).
- Chặn truy cập API trái phép (`HTTP 401 Unauthorized` khi thiếu token, `HTTP 403 Forbidden` khi sai vai trò).
- Kiểm soát hiệu lực Chứng chỉ hành nghề (`USER-003`): chặn bác sĩ có CCHN hết hạn/thu hồi thực hiện khám và ký số đơn thuốc.
- Tự động ghi nhận Nhật ký kiểm toán (`nhat_ky_truy_cap_y_te`) đối với mọi thao tác xem/sửa hồ sơ bệnh án.

### E. Concurrency and Data Integrity Testing
Tách biệt rõ với kiểm thử hiệu năng tải. Tập trung vào tính đúng đắn của khóa giao dịch (`Transaction Locking`) khi có các request tranh chấp cùng một tài nguyên tại cùng thời điểm (`asyncio.gather`):
- Hai hoặc 10 bệnh nhân cùng đặt 1 slot khi chỉ còn 1 chỗ trống (`APT-004` - kiểm tra khóa `SELECT ... FOR UPDATE` và `uq_active_doctor_slot`).
- Hai thu ngân bấm lập hóa đơn hoặc bấm thanh toán cùng lúc cho 1 lượt khám/hóa đơn (`BILL-004` - kiểm tra `with_for_update(nowait=True)` và `uq_hoa_don_luot_kham_hieu_luc`).
- Nhiều quầy lễ tân cấp số thứ tự đồng thời cho cùng 1 phòng khám (`QUE-001`).
- Transaction thất bại phải rollback sạch, không phát sinh bản ghi mồ côi.

### F. Performance Testing (Ngưỡng SLA & Phương pháp đo cụ thể)

| Nghiệp vụ / Endpoint | Ngưỡng SLA | Điểm bắt đầu – Kết thúc đo | Phạm vi bao gồm | Cỡ mẫu đo Benchmark |
| :--- | :---: | :--- | :--- | :--- |
| Đặt lịch khám (`POST /api/v1/appointments`) | **p95 < 500 ms** | Từ lúc Client (`httpx.AsyncClient`) gửi HTTP request đến khi nhận đủ HTTP response body | Toàn bộ thời gian xử lý FastAPI + truy vấn & commit PostgreSQL | 5 lượt warm-up + **50 lượt chạy hợp lệ** để tính phân vị thứ 95 (`p95`) |
| Gọi số hàng đợi (`POST /api/v1/reception/queue/call-next`) | **p95 < 300 ms** | Từ lúc gửi HTTP request đến khi nhận đủ HTTP response body | Thuật toán sắp xếp ưu tiên + cập nhật trạng thái PostgreSQL | 5 lượt warm-up + **50 lượt chạy hợp lệ** trên hàng đợi 50 bệnh nhân |
| Thanh toán viện phí (`POST /api/v1/cashier/invoices/{id}/pay`) | **p95 < 500 ms** | Từ lúc gửi HTTP request đến khi nhận đủ HTTP response body | Khóa dòng `FOR UPDATE` + sinh `PhieuThuChi`, `GiaoDichThanhToan` + commit DB | 5 lượt warm-up + **50 lượt chạy hợp lệ** trên 50 hóa đơn độc lập |
| AI Phân tích triệu chứng (`POST /api/v1/ai/analyze`) | **p95 < 3.000 ms** | Từ lúc gửi HTTP request đến khi nhận JSON gợi ý chuyên khoa | Bao gồm thời gian phân tích NLP nội bộ + cơ chế fallback/timeout bảo vệ khi gọi AI | 5 lượt warm-up + **30 mẫu câu triệu chứng** (ngắn, trung bình, dài tới 1500 ký tự) |

*Cấu hình phần cứng tham chiếu chạy Benchmark:* Môi trường Local Testbed tiêu chuẩn của nhóm (OS Windows 11 64-bit, CPU $\ge$ 8 vCPU/threads, RAM 16 GB, SSD NVMe, PostgreSQL 16 chạy local cùng máy để loại trừ độ trễ mạng WAN).

## 3.3. Risk-Based Testing

| Mức độ rủi ro | Phương pháp ưu tiên | Khu vực áp dụng |
| :--- | :--- | :--- |
| **Critical / High** | API Automation + Manual UI + Kiểm tra trực tiếp bảng DB | `USER`, `APT`, `REC`, `QUE`, `EXM`, `EMR`, `LAB`, `RX`, `BILL` |
| **High** | API Automation + Manual UI | `AUTH`, `AI` |
| **Medium / Low** | Functional Testing + Regression | `RPT`, giao diện tra cứu & in phiếu |

### 6 Nghiệp vụ Rủi ro cao bắt buộc kiểm thử sâu (Deep-Dive Verification)
1. **`APT-003` / `APT-004`**: Chống đặt lịch trùng và xử lý tranh chấp đồng thời (Overbooking prevention).
2. **`USER-001` / `USER-002` / `USER-003`**: Phân quyền RBAC, chặn CCHN hết hạn và Audit Log.
3. **`REC-003` / `QUE-001` / `QUE-003`**: Tính nhất quán lượt khám, chống trùng STT và thuật toán ưu tiên 5 bậc.
4. **`EXM-002` / `EMR-003`**: Điều kiện hoàn tất khám và khóa bất biến bệnh án (bắt buộc qua `BienBanDinhChinh`).
5. **`LAB-003` / `RX-002`**: Ký duyệt khóa kết quả CLS (`DA_DUYET`) và ký số đơn thuốc SHA-256 (`SIGNED`/`ISSUED`).
6. **`BILL-004` / `BILL-006` / `BILL-007`**: Chống lập/thu trùng hóa đơn, hoàn tiền có kiểm soát và khóa sổ ca trực (`KhoaSoCaTruc`).

---

# 4. Test Environment

## 4.1. Environment Components

| Thành phần | Vai trò | Cấu hình chi tiết trong dự án |
| :--- | :--- | :--- |
| **Frontend** | Giao diện Bệnh nhân & Nhân viên | React 18 + Vite 5 + TailwindCSS (`http://127.0.0.1:5173`) |
| **Backend** | REST API & Business Logic | FastAPI + SQLAlchemy 2.0 Async + Python 3.14 (`http://127.0.0.1:8000`) |
| **Database** | Lưu trữ dữ liệu & Ràng buộc toàn vẹn | PostgreSQL 16 (`clinic_ai_db`, Alembic head: `015_drop_don_thuoc_luot_kham_id_key`) |
| **Browser** | Kiểm thử giao diện & E2E | Google Chrome (Chromium Headless/Live qua Chrome DevTools MCP) |
| **API Testing** | Kiểm thử tự động API & Concurrency | Pytest + `pytest-asyncio` + `httpx` (xuất báo cáo `--junitxml=xray_junit_report.xml`) |
| **Test Management** | Quản lý Yêu cầu, Test Case, Execution & Bug | Xray Cloud for Jira |

## 4.2. Environment Requirements

Trước khi bắt đầu thực thi Gate G5:
- Frontend (`5173`) và Backend (`8000`) khởi động ổn định, không có lỗi migration.
- Database PostgreSQL đã chạy `alembic upgrade head` (đạt revision `015`).
- Dữ liệu mẫu chuẩn hóa đã được nạp qua script khởi tạo dữ liệu kiểm thử.
- Các bài kiểm thử tự động (`pytest`) sử dụng dữ liệu cô lập theo từng kịch bản để không làm bẩn dữ liệu chung.

## 4.3. Confirmed Environment Information (Baseline)

| Thông tin | Giá trị Baseline khi bắt đầu kiểm thử |
| :--- | :--- |
| **Test Environment URL (FE / BE)** | FE: `http://127.0.0.1:5173` \| BE API Docs: `http://127.0.0.1:8000/docs` |
| **Initial Code Commit Baseline** | Nhánh `develop` — Commit `8a42575` |
| **Initial Database Schema Version** | PostgreSQL 16 — Alembic Revision `015_drop_don_thuoc_luot_kham_id_key (head)` |
| **Python / Pytest Runtime** | Python `3.14.0` (`backend/.venv`) + Pytest `8.x` |
| **Test Execution Window** | Giai đoạn G4 – G6 (Tháng 11/2026) |

## 4.4. Quy tắc Quản lý Thay đổi Môi trường & Source Code trong G5 (Configuration & Change Control)

Để tránh việc tổng hợp kết quả kiểm thử từ các phiên bản phần mềm khác nhau vào cùng một báo cáo nghiệm thu, nhóm áp dụng quy tắc bắt buộc sau:
1. **Ghi nhận Commit Hash theo từng đợt chạy (`Test Execution`)**: Mọi đợt chạy trên Xray phải ghi rõ `Commit Hash` hiện tại trong phần mô tả `Test Execution`. Nếu có bản vá lỗi (Bug Fix) làm thay đổi code trong G5, phải ghi nhận `New Commit Hash`.
2. **Kiểm soát thay đổi Database Migration**: Nếu quá trình sửa lỗi phát sinh migration mới (ví dụ lên revision `016`), phải cập nhật lại thông tin Schema Version và chạy lại bài kiểm tra toàn vẹn dữ liệu.
3. **Bắt buộc Chạy lại (Re-execution & Regression) khi đổi Code**:
   - Bất kỳ Test Case nào đã `PASS` ở commit cũ nhưng nằm trong module có file source code bị sửa đổi ở commit mới đều **không được giữ nguyên kết quả cũ** mà phải chạy lại (Regression Test) trên commit cuối cùng trước khi chốt Gate G5.
   - Báo cáo nghiệm thu cuối cùng (Gate G6) chỉ tính kết quả hợp lệ được xác nhận trên **Final Release Candidate Commit**.

---

# 5. Test Data Strategy

## 5.1. Test Accounts & Access Control Rules

Chuẩn bị bộ tài khoản thử nghiệm đại diện cho 6 vai trò trong hệ thống (không sử dụng dữ liệu bệnh nhân thật và không công khai mật khẩu trong tài liệu báo cáo):

| Mã tài khoản kiểm thử | Vai trò (`VaiTroEnum`) | Trạng thái tài khoản | Mục đích kiểm thử chính |
| :--- | :--- | :--- | :--- |
| `TEST_ACC_ADMIN_01` | `ADMIN` | Đang hoạt động | Quản trị danh mục, Dashboard vận hành, Tuân thủ CCHN & Audit Log |
| `TEST_ACC_DOC_NOI_01` | `BAC_SI` (Chuyên khoa Nội) | Đang hoạt động, CCHN còn hạn | Bàn khám lâm sàng, EMR, Chuyên khoa sâu, Chỉ định CLS, Kê đơn & Ký số |
| `TEST_ACC_DOC_TMH_01` | `BAC_SI` (Chuyên khoa TMH) | Đang hoạt động, CCHN còn hạn | Kiểm tra lịch hẹn chuyên khoa Tai - Mũi - Họng & Khám chuyên khoa |
| `TEST_ACC_DOC_EXPIRED` | `BAC_SI` | CCHN hết hạn / bị thu hồi | Kiểm thử âm (`USER-003`): xác minh hệ thống chặn khám và chặn ký số đơn thuốc |
| `TEST_ACC_REC_01` | `LE_TAN` | Đang hoạt động | Tiếp nhận Check-in, Walk-in nhanh, Cấp cứu Red-Flag, Điều phối hàng đợi |
| `TEST_ACC_TECH_01` | `KY_THUAT_VIEN` | Đang hoạt động | Tiếp nhận mẫu, nhập trị số xét nghiệm, cảnh báo nguy kịch, Duyệt & In phiếu CLS |
| `TEST_ACC_CASHIER_01` | `THU_NGAN` | Đang hoạt động | Xem trước hóa đơn, Lập hóa đơn, Thu tiền (Tiền mặt/VietQR/POS), Hoàn tiền, Khóa sổ |
| `TEST_ACC_CASHIER_02` | `THU_NGAN` | Đang hoạt động | Phối hợp cùng `TEST_ACC_CASHIER_01` kiểm thử tranh chấp thu tiền đồng thời (`BILL-004`) |
| `TEST_ACC_PAT_01..10` | `BENH_NHAN` | Đang hoạt động | Khảo sát triệu chứng AI, Đặt lịch trực tuyến, Kiểm thử 10 request đặt lịch đồng thời (`APT-004`) |
| `TEST_ACC_INACTIVE` | Nhân viên / Bệnh nhân | Bị khóa (`is_active=False`) | Kiểm thử âm (`AUTH-002`): xác minh hệ thống từ chối đăng nhập |

*Quy tắc bảo mật dữ liệu kiểm thử:*
- Thông tin đăng nhập chi tiết (email, mật khẩu seed local) chỉ được lưu trong script khởi tạo môi trường cục bộ (`seed_data.py` / tệp `.env.test` nội bộ của nhóm), **tuyệt đối không đưa mật khẩu vào báo cáo công khai và không dùng mật khẩu thật của cá nhân**.

## 5.2. Business Test Data

| Nhóm dữ liệu | Các trạng thái dữ liệu kiểm thử bắt buộc |
| :--- | :--- |
| **Bệnh nhân** | Bệnh nhân mới (Walk-in), bệnh nhân cũ có tiền sử dị ứng (`Dị ứng NSAID`, `Dị ứng Penicillin`), bệnh nhân trùng SĐT |
| **Lịch khám (`LichKham`)** | Slot còn nhiều chỗ, slot chỉ còn đúng 1 chỗ trống (`APT-004`), slot đã kín chỗ (đăng ký `Waitlist`), ca khám có bác sĩ xin nghỉ phép |
| **Hàng đợi (`HangDoiKham`)** | 5 mức ưu tiên: Cấp cứu (`B1`) > Có KQ CLS (`B2`) > Đặt lịch đúng giờ (`B3`) > Đến sớm/muộn (`B4`) > Vãng lai (`B5`) |
| **Bệnh án (`LuotKham`)** | Đang khám (`dang_kham`), Chờ CLS (`cho_cls`), Đã hoàn tất & Khóa (`hoan_thanh`, `is_locked=True`), Có biên bản đính chính (`BienBanDinhChinh`) |
| **Cận lâm sàng (`ChiDinh`)** | `da_chi_dinh` $\rightarrow$ `da_thanh_toan` $\rightarrow$ `dang_thuc_hien` $\rightarrow$ `cho_duyet` $\rightarrow$ `DA_DUYET` (kèm trị số bình thường và trị số nguy kịch `Glucose = 19.5 mmol/L`) |
| **Đơn thuốc (`DonThuoc`)** | `DRAFT` $\rightarrow$ `SIGNED` (có mã băm SHA-256) $\rightarrow$ `ISSUED` $\rightarrow$ `SUPERSEDED` (khi hủy kê lại) & Liên thông `BYT-2026-xxxxxx` |
| **Hóa đơn (`HoaDon`)** | `chua_thu`, `da_thu` (`tien_mat`, `chuyen_khoan`, `the_pos`), `da_huy`, `hoan_tien_mot_phan`, `da_hoan_tien`, và `KhoaSoCaTruc(DA_KHOA_SO)` |

## 5.3. Data Integrity Verification
Sau mỗi lượt chạy kiểm thử, phải đối chiếu trực tiếp xuống PostgreSQL:
- Không có ca làm việc nào có số lịch hẹn active vượt quá `han_muc_dat_truoc`.
- Không có 2 phiếu hàng đợi trùng `(phong_kham_id, ngay_xep_hang, so_thu_tu)`.
- Không có lượt khám nào có nhiều hơn 1 hóa đơn ở trạng thái `chua_thu` hoặc `da_thu`.
- Tổng tiền trên `HoaDon` luôn bằng tổng `thanh_tien` của các dòng `ChiTietHoaDon`, và `thuc_thu = max(0, tong_tien - mien_giam)`.

---

# 6. Test Deliverables (Phân tách Cấu trúc Chuẩn 66 TC & Đặc tả Chuyên sâu 6 Vùng Rủi ro Cao)

| Deliverable | Phạm vi & Mức độ chi tiết | Đường dẫn / Công cụ lưu trữ |
| :--- | :--- | :--- |
| **1. Requirement Inventory & RTM (G1)** | 49 Requirements, 66 Test Cases, Coverage Summary (3 Sheets) | [`docs/testing/ClinicAI_RTM.xlsx`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/ClinicAI_RTM.xlsx) & [`G1_Requirement_Baseline_and_RTM.md`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/G1_Requirement_Baseline_and_RTM.md) |
| **2. Software Test Plan (G2)** | Tài liệu kế hoạch kiểm thử 13 mục | [`docs/testing/G2_Test_Plan.md`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/G2_Test_Plan.md) |
| **3. Standard Test Cases Repository (G3 - Toàn bộ 66 Test Cases)** | **Cả 66 Test Cases** đều có đầy đủ cấu trúc tối thiểu bắt buộc: `Preconditions`, `Action (Steps)`, `Test Data`, `Expected Result` để import lên Xray | [`docs/testing/ClinicAI_Xray_Test_Cases_Import.csv`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/ClinicAI_Xray_Test_Cases_Import.csv) & Xray Test Repository |
| **4. High-Risk Deep-Dive Spec (G3 - Riêng 6 Vùng Rủi ro Cao)** | Đặc tả kỹ thuật chuyên sâu cho **6 vùng rủi ro cao** (`APT-004`, `QUE-003`, `EXM-002`, `EMR-003`, `LAB-003`/`RX-002`, `BILL-004`/`006`/`007`): bao gồm `DB Pre-state`, `API Payload`, `Verification SQL Query`, `DB Post-state` và `Rollback Condition` | [`docs/testing/G3_High_Risk_Test_Cases.md`](file:///d:/dowload/tailieu/clinic-ai/docs/testing/G3_High_Risk_Test_Cases.md) |
| **5. Automation Test Suite & XML (G5)** | Bộ test tự động Pytest và file kết quả JUnit XML nạp lên Xray | `backend/tests/` & `docs/testing/xray_junit_report.xml` |
| **6. Execution Evidence Pack (G5)** | Bộ ảnh chụp trình duyệt thực tế, log API response & kết quả truy vấn DB | Jira / Xray Test Execution Attachments |
| **7. Defect Log & Retest Report (G5)** | Danh sách các lỗi phát hiện, commit sửa lỗi và kết quả Retest | Jira Bug Issues & `docs/testing/G5_Defect_and_Execution_Report.md` |
| **8. Test Summary Report (G6)** | Báo cáo tổng kết chất lượng và kết luận nghiệm thu | `docs/testing/G6_Test_Summary_Report.md` |

---

# 7. Roles and Responsibilities

| Thành viên | Vai trò trong nhóm | Module phụ trách kiểm thử | Số Req | Số TC | Trách nhiệm thực thi & Review chéo (Cross-Review) |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Hợp** | **QA Coordinator / Team Lead** | `AUTH`, `USER`, `RX`, `BILL` | 18 | 28 | Thực thi kiểm thử Auth, RBAC, Đơn thuốc, Thu ngân; điều phối chung và tổng hợp RTM / Xray Test Plan. *(Review chéo cho Tùng)* |
| **Tùng** | **QA / Dev Member** | `APT`, `REC`, `QUE` | 15 | 20 | Thực thi kiểm thử Đặt lịch, Concurrency `APT-004`, Tiếp đón & Hàng đợi ưu tiên. *(Review chéo cho Hoàng)* |
| **Hoàng** | **QA / Dev Member** | `EXM`, `EMR` | 6 | 7 | Thực thi kiểm thử Lượt khám, Sinh hiệu BMI, Chuyên khoa sâu, Khóa EMR & Đính chính. *(Review chéo cho Trọng)* |
| **Trọng** | **QA / Dev Member** | `LAB` | 5 | 6 | Thực thi kiểm thử Chỉ định CLS, Nhập kết quả XN/CĐHA, Cờ nguy kịch & Ký duyệt CLS. *(Review chéo cho An)* |
| **An** | **QA / Dev Member** | `RPT`, `AI` | 5 | 5 | Thực thi kiểm thử AI Phân luồng triệu chứng, Cờ đỏ cấp cứu, Disclaimer & Báo cáo Dashboard. *(Review chéo cho Hợp)* |

---

# 8. Test Schedule

| Giai đoạn (Gate) | Công việc trọng tâm | Sản phẩm nghiệm thu (Gate Output) | Trạng thái |
| :---: | :--- | :--- | :---: |
| **Gate G1** | Phân tích yêu cầu, đối chiếu code, chốt 49 Requirements & lập RTM 3 sheets | `G1_Requirement_Baseline_and_RTM.md`, `ClinicAI_RTM.xlsx` | **PASS** |
| **Gate G2** | Lập Kế hoạch kiểm thử (Test Plan v1.0), xử lý 6 điểm review & ký duyệt | `G2_Test_Plan.md` | **REVIEW (Ready for Sign-off)** |
| **Gate G3** | Chuẩn hóa 66 Test Cases trên Xray + Đặc tả sâu 6 vùng rủi ro cao (`APT-004`, `BILL-004`...) | `ClinicAI_Xray_Test_Cases_Import.csv`, `G3_High_Risk_Test_Cases.md` | **NEXT** |
| **Gate G4** | Kiểm tra sẵn sàng môi trường PostgreSQL (Migration `015`) & Test Data 6 vai trò | Biên bản sẵn sàng môi trường & Test Data | TODO |
| **Gate G5** | Thực thi toàn bộ 66 Test Cases (Manual + Pytest), ghi nhận Bug, Fix, Retest & Regression | `xray_junit_report.xml`, 100% TC có Evidence trên Xray | TODO |
| **Gate G6** | Đánh giá Exit Criteria, xuất Báo cáo Tổng kết Kiểm thử & Nghiệm thu | `G6_Test_Summary_Report.md` | TODO |

---

# 9. Entry, Suspension, Resumption and Exit Criteria

## 9.1. Entry Criteria (Điều kiện bắt đầu thực thi G5)
1. Baseline RTM (49 Requirements, 66 Test Cases) đã đạt `PASS` tại Gate G1.
2. Tài liệu Test Plan v1.0 này được phê duyệt (`Approved`) tại Gate G2.
3. **Toàn bộ 66 Test Cases** có đầy đủ cấu trúc tối thiểu (`Preconditions`, `Action`, `Test Data`, `Expected Result`), và **6 vùng rủi ro cao** có thêm đặc tả chuyên sâu (`DB Pre-state`, `Verification SQL Query`, `DB Post-state`, `Rollback`) đã được review chéo tại Gate G3.
4. Môi trường Backend (`8000`), Frontend (`5173`) và PostgreSQL (Migration `015`) hoạt động ổn định, đã xác nhận `Commit Hash` đầu vào tại Gate G4.

## 9.2. Exit Criteria (Điều kiện kết thúc G5 và chuyển sang G6)
1. **100% Test Cases (66/66)** trong phạm vi đã có trạng thái thực thi thực tế kèm bằng chứng (`Evidence`) trên commit cuối cùng.
2. **100% Test Cases có mức ưu tiên `Critical`** phải đạt trạng thái `Passed` sau khi Retest.
3. Không còn bất kỳ lỗi `Blocker` hoặc `Critical` nào ở trạng thái chưa đóng, trừ khi có văn bản chấp thuận rủi ro.
4. Các lỗi phát hiện trong quá trình kiểm thử đều được log thành Issue `Bug` trên Jira/Xray, có liên kết với Test Case và có bằng chứng Retest + Regression Test thành công trên commit sửa lỗi.
5. Bảng `Coverage Summary` trong `ClinicAI_RTM.xlsx` và báo cáo Xray được cập nhật đồng bộ.

## 9.3. Suspension and Resumption Criteria (Tiêu chí Tạm dừng và Tiếp tục kiểm thử)
- **Điều kiện Tạm dừng (Suspension Criteria)**:
  - Môi trường Backend hoặc Database PostgreSQL gặp lỗi không thể kết nối hoặc lỗi migration làm hỏng cấu trúc bảng.
  - Phát hiện lỗi `Blocker` ở luồng cốt lõi (ví dụ: hỏng chức năng Đăng nhập JWT `AUTH-001` hoặc lỗi Tiếp nhận tạo lượt khám `REC-003`) khiến các phân hệ phía sau bị chặn (`Blocked`).
- **Điều kiện Tiếp tục (Resumption Criteria)**:
  - Lỗi `Blocker` hoặc sự cố môi trường đã được khắc phục, ghi nhận `Commit Hash` mới và vượt qua bài kiểm tra Smoke Test nhanh.

---

# 10. Defect Management (Chuẩn hóa theo Jira Cloud Workflow)

## 10.1. Defect Workflow & Ánh xạ Trạng thái Jira Thực tế

Để đồng bộ 100% giữa quy trình kiểm thử QA và cấu hình thực tế của board **Jira Cloud** dự án Clinic-AI, trạng thái của Issue loại `Bug` được ánh xạ như sau:

| Bước quy trình QA | Trạng thái trên Jira Cloud (`Status`) | Nhãn kiểm soát (`Labels` / `Resolution`) | Quy tắc chuyển trạng thái |
| :--- | :---: | :--- | :--- |
| **1. Mở lỗi mới (`Open`)** | **`To Do`** (hoặc `Open`) | `defect`, `g5-execution` | Tester phát hiện lỗi từ Xray Test Execution, tạo Bug kèm Evidence và gán cho Developer phụ trách module |
| **2. Đang sửa lỗi (`In Progress`)** | **`In Progress`** | `fixing` | Developer nhận xử lý lỗi trên nhánh code |
| **3. Đã sửa – Chờ kiểm thử lại (`Fixed / Ready for Retest`)** | **`In Review`** (hoặc `Testing` / `Ready for QA`) | `fixed-pending-retest` + ghi rõ `Fix Commit Hash` | Developer đã merge code sửa lỗi, cập nhật môi trường test và chuyển cho Tester kiểm thử lại |
| **4a. Kiểm thử lại Đạt (`Closed`)** | **`Done`** (hoặc `Closed`) | `verified`, `Resolution: Done` | Tester chạy lại Test Case trên Xray đạt `PASS`, đính kèm Evidence mới và đóng Bug |
| **4b. Kiểm thử lại Thất bại (`Reopened`)** | Chuyển ngược về **`In Progress`** | Gắn nhãn **`reopened`** | Tester ghi rõ kết quả Retest vẫn lỗi, đính kèm log mới và trả về `In Progress` cho Developer |

## 10.2. Defect Severity

| Severity | Mô tả & Ví dụ điển hình trong Clinic-AI |
| :--- | :--- |
| **Blocker** | Hệ thống crash, lỗi migration DB không chạy được, hoặc hỏng đăng nhập/tiếp nhận làm tê liệt toàn bộ luồng sau |
| **Critical** | Đặt trùng lịch vượt định mức (`APT-004`), thu tiền trùng 2 lần (`BILL-004`), sửa được bệnh án đã khóa (`EMR-003`), lộ API không phân quyền (`USER-002`) |
| **Major** | Chức năng hoạt động sai ở một số trường hợp biên nhưng có hướng xử lý tạm (workaround) |
| **Minor** | Lỗi căn lề giao diện, thông báo toast chưa mượt, không ảnh hưởng dữ liệu và nghiệp vụ |

## 10.3. Defect Report Required Fields
Mỗi Bug trên Jira bắt buộc có: `Summary`, `Environment (Commit Hash + DB Revision)`, `Steps to Reproduce`, `Expected Result`, `Actual Result`, `Severity`, `Priority`, `Related Requirement ID`, `Related Test Case ID`, `Evidence (Screenshot / Log)`, `Reproducibility`.

---

# 11. Risks and Mitigation

| Rủi ro (Risk) | Ảnh hưởng | Biện pháp giảm thiểu (Mitigation) |
| :--- | :--- | :--- |
| Môi trường DB bị lệch trạng thái giữa các lần test | Kết quả kiểm thử không nhất quán | Chạy script seed chuẩn hóa và dùng dữ liệu cô lập cho Pytest |
| Lỗi tranh chấp đồng thời (`APT-004`, `BILL-004`) không thể bấm tay bằng chuột | Bỏ sót lỗi Race Condition | Dùng script Pytest bắn đồng thời các request bằng `asyncio.gather` và kiểm tra trực tiếp bảng PostgreSQL |
| Sửa code trong G5 làm hỏng chức năng đã PASS trước đó | Báo cáo sai lệch giữa các commit | Áp dụng quy tắc Mục 4.4: ghi nhận Commit Hash mới và chạy Regression Test cho module bị ảnh hưởng |
| Thành viên tự test module do chính mình code | Tâm lý chủ quan, dễ bỏ sót lỗi | Áp dụng ma trận **Cross-Review** bắt buộc ở Mục 7 |
| Đánh dấu `PASS` cảm tính không có minh chứng | Không đạt tiêu chí nghiệm thu của QA Lead / Giảng viên | Kiểm tra bắt buộc cột `Evidence` trong `ClinicAI_RTM.xlsx` và Xray trước khi đóng Gate G5 |

---

# 12. Reporting and Metrics

1. **Requirement Design Coverage**: $\frac{\text{Số Requirements có ít nhất 1 Test Case}}{\text{Tổng số Requirements (49)}} \times 100\% = \mathbf{100\%}$.
2. **Test Execution Progress**: $\frac{\text{Số Test Cases đã thực thi}}{\text{Tổng số Test Cases (66)}} \times 100\%$.
3. **Test Pass Rate**: $\frac{\text{Số Test Runs PASS có Evidence}}{\text{Tổng số Test Runs (PASS + FAIL)}} \times 100\%$.
4. **Critical Requirement Execution & Pass Rate**: Theo dõi riêng tỷ lệ thực thi và tỷ lệ đạt của 28 Requirements có mức ưu tiên `Critical`.
5. **Defect Density / Distribution**: Thống kê số lượng lỗi theo từng Module và theo mức độ `Severity`.

*(Lưu ý: Tuyệt đối không đồng nhất Design Coverage 100% với Execution Progress hay Pass Rate).*

---

# 13. Approval and Sign-off (Gate G2)

| Vai trò | Họ tên / Đại diện | Trạng thái |
| :--- | :--- | :---: |
| **QA Coordinator** | Hợp (Thành viên 1) | Pending Sign-off |
| **Đại diện nhóm phát triển** | Tùng (Thành viên 2) | Pending Sign-off |
| **Các thành viên kiểm thử** | Hợp, Tùng, Hoàng, Trọng, An | Pending Sign-off |
| **Cố vấn QA / Giảng viên nghiệm thu** | QA / Testing Lead | **Pending Approval (Gate G2)** |

**Approval Criteria:** Tài liệu Test Plan này đang ở trạng thái `v1.0 — Proposed Baseline (Ready for Review)` và chỉ chuyển sang `Approved Baseline` sau khi các thành viên và Người nghiệm thu xác nhận.

---
**Document End — Clinic-AI Test Plan v1.0**


