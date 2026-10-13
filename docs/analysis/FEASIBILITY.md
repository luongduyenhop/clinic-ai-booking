# BÁO CÁO TÍNH KHẢ THI & ĐÁNH GIÁ MÔI TRƯỜNG KHẢO SÁT
## DỰ ÁN CLINIC-AI & HỆ THỐNG THAM CHIẾU TCLINIC.IO

**Thời điểm lập:** 12/10/2026  
**Vai trò:** Senior Software Architect, Backend Engineer & QA Engineer  
**Tài liệu:** `docs/analysis/FEASIBILITY.md`  

---

## 1. Mục tiêu và Phạm vi Đánh giá

Nhiệm vụ là nghiên cứu các luồng nghiệp vụ có thể quan sát được từ trang web phòng khám thực tế **tClinic** (`https://demo.tclinic.io`) bằng tài khoản demo được cấp phép (`phongkham5` / `admin@123`), từ đó đối chiếu, hoàn thiện kiến trúc Backend, Database và API của hệ thống **Clinic-AI** (`tailieu/clinic-ai`).

Báo cáo này đánh giá:
1. Tính khả thi kỹ thuật và pháp lý của phương pháp khảo sát có bằng chứng.
2. Năng lực và tính sẵn sàng của bộ công cụ: **Chrome DevTools MCP**, **REA** (`rea-agents`), **Git**, **Python pytest suite**, **Vite/React frontend**.
3. Các giới hạn ranh giới giữa việc quan sát hành vi hệ thống và việc thiết kế hệ thống độc lập cho Clinic-AI.

---

## 2. Báo cáo Hiện trạng Công cụ & Môi trường

| Công cụ / Nguồn lực | Trạng thái xác minh | Bằng chứng kiểm tra thực tế | Đánh giá tính khả thi |
|---|:---:|---|---|
| **Git Repository Clinic-AI** | **SẴN SÀNG** | Nhánh `feature/monorepo-full-stack-openmrs`, cấu trúc monorepo gồm `backend/` (FastAPI) và `fe-clinic-ai-booking/` (Vite/React). | Đầy đủ điều kiện phát triển và kiểm thử hồi quy. |
| **Backend Virtualenv & Test Runner** | **SẴN SÀNG** | Python 3.14.0, Pytest 9.1.1, AnyIO, AsyncIO. Đã chạy thực tế: **359 passed, 4 skipped, 1 xfailed, 0 failed** trên tổng số 364 test. | Test suite tự động rất vững chắc, bao phủ từ Core Booking, Queue, Clinical đến Compliance Layer. |
| **Chrome DevTools MCP** | **SẴN SÀNG** | MCP Server `chrome-devtools-mcp` đang kết nối trực tiếp với Chrome, nhận diện Page 3: `tClinic - giải pháp phòng khám` (`https://demo.tclinic.io/`). Đã gọi thành công `list_pages`, `evaluate_script`, `take_snapshot`, `list_network_requests`. | Công cụ chính để quan sát thụ động DOM, mạng XHR/Fetch, form và validation. |
| **Tài khoản Demo tClinic** | **ĐÃ ĐĂNG NHẬP** | Session đang hoạt động tại Phòng khám Đa khoa Quang Lâm, xác thực qua Cookie JWT (`token`, `refreshToken`). Lấy được API `/api/nhanvien/me`, `/api/setting`, `/api/dashboard/*`. | Hoạt động bình thường, đầy đủ quyền quản lý/lâm sàng/tiếp đón. |
| **REA CLI (`rea-agents`)** | **SẴN SÀNG** | `rea-agents@6.4.0` (Node.js CLI & MCP) đã được kiểm tra qua `npx -y rea-agents --help`. Sở hữu các lệnh `inspect-web-page`, `observe-web-session`, `inspect-web-network-capture`. | Hỗ trợ phân tích luồng sự kiện DOM và đối sánh logic khi cần. |
| **Frontend Clinic-AI** | **ĐANG CHẠY** | React 19.2.8, Ant Design 6.6.5, Tailwind CSS v4, đang phục vụ tại `http://localhost:3000`. | Sẵn sàng tiếp nhận các endpoint backend mới. |

---

## 3. Khả thi & Giới hạn Kỹ thuật của Phương pháp Khảo sát

### 3.1. Những gì CÓ THỂ quan sát và kiểm chứng được từ tClinic:
1. **Luồng thao tác người dùng (User Workflows):**
   - Tiếp đón & Đăng ký bệnh nhân (`/dangky`), phân phòng khám, cấp số thứ tự, gán loại đối tượng (Khám thường, Ưu tiên).
   - Bàn khám lâm sàng của Bác sĩ (`/khambenh`), nhập sinh hiệu, chẩn đoán ICD-10, kê dịch vụ kỹ thuật.
   - Chỉ định Cận lâm sàng (`/kedichvu/canlamsang`), trả kết quả X-quang/Siêu âm/Xét nghiệm máu.
   - Kê đơn thuốc (`/donthuoc`), liên kết mã hoạt chất, đường dùng, liều lượng và cảnh báo tương tác.
   - Thu ngân & Viện phí (`/thutien`, `/hoadon`), thanh toán từng phần hoặc toàn bộ.
2. **Hợp đồng Dữ liệu Mạng (API Contract):**
   - Toàn bộ các request `POST`, `PUT`, `GET` mà Single Page App của tClinic gửi lên máy chủ `/api/*`.
   - Cấu trúc Payload, Query Params, HTTP Response Status (200, 400, 422, 500) và cấu trúc JSON trả về.
3. **Quy tắc Nghiệp vụ Phía Client & Server (Business Invariants):**
   - Trường nào là bắt buộc (Validation rules).
   - Điều kiện hoàn tất khám (Encounter completion invariants).
   - Các cảnh báo trùng lịch, trùng phòng, sai chuyên khoa.

### 3.2. Những gì KHÔNG ĐƯỢC PHÉP suy diễn từ tClinic:
1. **Kiến trúc Cơ sở dữ liệu Nội bộ:**
   - Qua khảo sát Network Payload của tClinic, các ID có định dạng chuỗi Hex 24 ký tự (ví dụ `6aa11e1bbbcf39001b81d1ab`), query parameters có cú pháp MongoDB Query Operators (ví dụ `%24or%5Bbenh_tuanhoan%5D=true`, `fields=_id%20mabenh`). Điều này chứng minh backend gốc của tClinic nhiều khả năng sử dụng **NoSQL/MongoDB**.
   - Ngược lại, **Clinic-AI sử dụng kiến trúc chuẩn y tế quốc tế OpenMRS / PostgreSQL**, dựa trên mô hình quan hệ chặt chẽ (Relational Integrity, Foreign Keys, Check Constraints, ACID Transactions, Append-only Audit Table).
   - **Nguyên tắc:** Tuyệt đối không bê nguyên mô hình Document NoSQL của tClinic vào PostgreSQL của Clinic-AI. Mọi dữ liệu phải được chuẩn hóa quan hệ (3NF) phù hợp với OpenMRS Data Model.
2. **Logic xử lý backend private:**
   - Các transaction boundary, xử lý race condition concurrency (ví dụ 2 bệnh nhân cùng check-in 1 lúc tranh số thứ tự) là logic nội bộ server của tClinic không lộ ra frontend.
   - Clinic-AI phải tự thiết kế cơ chế bảo vệ concurrency (Row-level Locking `SELECT FOR UPDATE`, Redis/Database Sequence, Unique Constraints).
3. **Chính sách BHYT:**
   - tClinic có module thanh toán và đẩy cổng BHYT.
   - Baseline của Clinic-AI đã chốt: **Chỉ phục vụ khám ngoại trú tư nhân, thanh toán viện phí trực tiếp, KHÔNG thực hiện quyết toán BHYT**.

---

## 4. Danh sách Trở ngại Tiềm ẩn & Phương án Xử lý

| Trở ngại tiềm ẩn | Rủi ro | Phương án xử lý của Senior Engineer |
|---|---|---|
| **Dữ liệu demo trên tClinic bị reset hoặc tài khoản hết hạn** | Mất nguồn tham chiếu trực tiếp | Xuất snapshot dữ liệu và lưu vết Network Capture HAR/JSON trong `docs/analysis/evidence/`. |
| **Sự khác biệt giữa NoSQL (tClinic) và RDBMS PostgreSQL (Clinic-AI)** | Schema lỏng lẻo, mất ràng buộc toàn vẹn | Sử dụng kỹ thuật Data Modeling chuyển đổi: Biến các mảng nhúng (embedded arrays) thành quan hệ 1-N hoặc Many-to-Many có bảng trung gian. |
| **Phá vỡ tính tương thích ngược với Frontend và AI Module hiện tại của Clinic-AI** | Gây lỗi giao diện `fe-clinic-ai-booking` hoặc hỏng luồng AI Triage | Thiết kế tầng Adapter / DTO tương thích: Giữ nguyên các router và trường mà Frontend/AI đang dùng, chỉ mở rộng thêm các trường nghiệp vụ mới. |
| **Hồi quy 359 unit/integration test hiện có** | Gãy các invariant đã được kiểm chứng | Chạy pytest hồi quy sau mỗi thay đổi nhỏ; áp dụng nguyên tắc kiểm thử TDD (Test-Driven Development). |

---

## 5. Kết luận Tính Khả thi

Phương án sử dụng **Chrome DevTools MCP** và **REA** để khảo sát có bằng chứng hệ thống **tClinic**, kết hợp với việc bảo tồn và phát triển tiếp nền tảng **Clinic-AI** trên nền **PostgreSQL/FastAPI/React** là **HOÀN TOÀN KHẢ THI (100% FEASIBLE)**. Môi trường kiểm thử và công cụ đã được xác minh hoạt động ổn định.
