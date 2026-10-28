# QUY ĐỊNH ĐÓNG GÓP VÀ QUẢN LÝ DỰ ÁN (TEAM WORKING AGREEMENT)
**Dự án:** Clinic-AI (Hệ thống Hỗ trợ Khám chữa bệnh & Quản lý Phòng khám Thông minh)  
**Mã dự án Jira:** `PJ2026`  
**Học phần:** Project 1 (IT1.241.3)  
**Giảng viên hướng dẫn:** ThS. Nguyễn Đức Dư  

---

## 1. QUY TẮC ĐẶT TÊN NHÁNH (GIT BRANCHING STRATEGY)

Mọi thành viên làm việc trên nhánh riêng rẽ, tuyệt đối **không commit trực tiếp lên nhánh `main`**. Mọi thay đổi phải thông qua Pull Request.

### Cú pháp chuẩn:
```text
feature/PJ2026-<Mã_Task>-<tên-ngắn-gọn>
fix/PJ2026-<Mã_Bug>-<tên-ngắn-gọn>
test/PJ2026-<Mã_Task>-<tên-ngắn-gọn>
```

### Ví dụ:
- Tính năng mới: `feature/PJ2026-15-cashier-invoice-management`
- Sửa lỗi hệ thống: `fix/PJ2026-89-cls-pdf-export-timeout`
- Kiểm thử tự động: `test/PJ2026-92-doctor-emr-pytest-suite`

---

## 2. BẢO VỆ NHÁNH `main` BẰNG THIẾT LẬP KỸ THUẬT (GITHUB BRANCH PROTECTION)

Nhánh `main` được bảo vệ bằng cấu hình Ruleset / Branch Protection trên GitHub với các điều kiện kỹ thuật bắt buộc:
1. **Require a pull request before merging:** Chặn hoàn toàn việc push trực tiếp vào `main`.
2. **Require approvals:** Bắt buộc tối thiểu **1 lượt duyệt (Approval)** từ thành viên độc lập khác. Tác giả PR tuyệt đối không được tự approve code của chính mình.
3. **Require approval of the most recent reviewable push:** Yêu cầu thay đổi mới nhất có thể review phải được một người khác với người thực hiện push phê duyệt. Tác giả bổ sung commit sau khi được approve không thể mặc nhiên dùng lại approval trước đó để merge.
4. **Require status checks to pass before merging:** Bắt buộc các bài kiểm tra CI phải đạt tích xanh (Pass) trước khi nút Merge được mở khóa:
   - `Backend Linting & Automated Testing` (Tên status check từ job `backend-quality-and-test` trong `.github/workflows/ci.yml`)
   - `Frontend Linting & Build Verification` (Tên status check từ job `frontend-quality-and-build` trong `.github/workflows/ci.yml`)
   *(Lưu ý: Sau khi CI chạy lần đầu, vào cấu hình Ruleset để chọn chính xác tên status check hiển thị trong danh mục của GitHub).*
5. **Do not allow force pushes & deletions:** Cấm tuyệt đối `git push --force` và cấm xóa nhánh `main`.
6. **Merge Strategy thống nhất:** Chọn **Squash and merge** để gộp các commit lẻ thành 1 commit duy nhất trên `main`, giữ lịch sử dự án tường minh.

---

## 3. QUY CHUẨN COMMIT MESSAGE (CONVENTIONAL COMMITS + JIRA KEYS)

Mỗi commit phải chứa mã ticket Jira để hệ thống tự động ghi nhận vào Jira Issue Development Panel.

### Cú pháp chuẩn:
```text
<loại>(<module>): PJ2026-<Số> <mô tả ngắn gọn hành động>
```

### Bảng phân loại commit:
- `feat`: Phát triển tính năng mới
- `fix`: Sửa lỗi hệ thống
- `test`: Viết hoặc bổ sung bài kiểm thử tự động
- `refactor`: Tái cấu trúc mã nguồn, tối ưu hóa
- `docs`: Cập nhật tài liệu, hướng dẫn, sơ đồ

### Ví dụ chuẩn:
```bash
git commit -m "feat(cashier): PJ2026-15 them man hinh thanh toan hoa don"
git commit -m "fix(cls): PJ2026-89 xu ly loi khong the upload file sieu am"
git commit -m "test(doctor): PJ2026-92 bo sung test case ke don thuoc"
```

---

## 4. QUY TRÌNH PULL REQUEST (PR) VÀ CODE REVIEW

### 4.1. Tiêu đề và Mô tả Pull Request
- **Tiêu đề PR:** Viết theo cú pháp commit:  
  `feat(cashier): PJ2026-15 Quản lý hóa đơn và thanh toán viện phí`
- **Mô tả PR (Description):**
  - Sử dụng cú pháp liên kết trung tính: `Issue: PJ2026-15` hoặc `Ref: PJ2026-15`.  
    *(Lưu ý: Không dùng từ khóa `Resolves` hay `Closes` ở bước này để tránh việc GitHub tự động chuyển trạng thái ticket sang Done trước khi qua giai đoạn kiểm thử QA).*
  - Tóm tắt các thay đổi logic và API endpoint mới.
  - Kết quả kiểm thử (Ảnh chụp UI với Frontend, kết quả Pytest với Backend).

### 4.2. Phân công Review chéo và Cơ chế Merge
- **Ma trận review chéo:**
  - **Tùng ↔ Hoàng:** Review chéo module Thu ngân và Bác sĩ khám bệnh.
  - **Trọng ↔ An:** Review chéo module Tiếp đón và Cận lâm sàng.
- **Quyền thực hiện Squash and Merge:**
  - Đối với PR tính năng độc lập: Sau khi đạt 1 Approval độc lập và toàn bộ CI status checks đạt Pass, tác giả hoặc reviewer đều có quyền bấm **Squash and merge**.
  - Đối với PR cốt lõi (Kiến trúc tổng thể, Alembic Migration phức tạp, Security/Auth, AI Engine): Bắt buộc Trưởng nhóm (**Hợp**) thẩm định và bấm Merge.

### 4.3. Xử lý khi có lỗi hoặc cần đóng PR
- **Khi có lỗi trong code review:** Reviewer chọn **Request changes** kèm ghi chú cụ thể. Tác giả sửa trực tiếp trên nhánh local, commit và push lên lại. Tuyệt đối không đóng PR vì lỗi code.
- **Khi nào được phép đóng (Close) PR:** Chỉ đóng PR khi tính năng bị hủy bỏ, tạo nhầm nhánh hoặc mở trùng lặp. Phải ghi rõ lý do khi đóng.

---

## 5. ĐỒNG BỘ TRẠNG THÁI JIRA VỚI QUY TRÌNH QA

Quy trình trạng thái chuẩn của từng ticket trên bảng Jira:

```text
[To Do] ──> [In Progress] ──> [In Review] ──> [Testing / QA] ──> [Done]
```

1. **To Do:** Task nằm trong Sprint Backlog, có đầy đủ tiêu chí chấp nhận (Acceptance Criteria).
2. **In Progress:** Thành viên tạo nhánh `feature/PJ2026-XX...` và bắt đầu code (kích hoạt bởi Jira Automation khi nhận diện issue key từ branch).
3. **In Review:** Pull Request được mở trên GitHub, CI Pipeline đang chạy và chờ đồng đội review.
4. **Testing / QA:** Pull Request đã được Merge vào nhánh chính (`main`). Task chuyển sang môi trường tích hợp để chạy kiểm thử liên thông (E2E) và kiểm thử hồi quy.
5. **Done:** Chỉ được chuyển sang Done khi thỏa mãn toàn bộ **Definition of Done (DoD)** ở Mục 7.

**Nguyên tắc chuyển trạng thái quan trọng:**  
Jira Automation **không được tự động chuyển ticket sang `Done`** chỉ dựa trên sự kiện Pull Request được merge. Việc chuyển sang `Done` chỉ được thực hiện sau khi kiểm thử QA xác nhận thành công và các tiêu chí DoD đã được đáp ứng trọn vẹn.

---

## 6. TIÊU CHUẨN KIỂM THỬ VÀ RANH GIỚI AN TOÀN AI

### 6.1. Ma trận công cụ kiểm thử theo ngăn xếp công nghệ
| Thành phần | Ngăn xếp công nghệ | Công cụ kiểm thử & Yêu cầu |
| :--- | :--- | :--- |
| **Backend API** | FastAPI / SQLAlchemy | **Pytest** chạy trên môi trường PostgreSQL Docker. Kiểm tra mã HTTP, logic nghiệp vụ, ràng buộc khóa ngoại và tính toàn vẹn dữ liệu. |
| **Frontend UI** | React / Vite / TypeScript | `npm run build` thành công, kiểm tra kiểu dữ liệu nghiêm ngặt (Zero TS errors), không lỗi lint. |
| **Cơ sở dữ liệu** | PostgreSQL / Alembic | **Kiểm thử migration hai chiều:**<br>1. Chạy `alembic upgrade head` trên cơ sở dữ liệu sạch.<br>2. Kiểm thử nâng cấp từ phiên bản schema liền trước với dữ liệu mẫu hiện có.<br>3. Kiểm tra tính toàn vẹn ràng buộc khóa ngoại và khả năng rollback (`alembic downgrade -1`) khi thiết kế migration có cấu trúc phức tạp. |
| **Toàn hệ thống** | Tích hợp liên thông | Kiểm thử luồng nghiệp vụ hoàn chỉnh: Tiếp đón ➔ Khám bệnh ➔ Cận lâm sàng ➔ Thu ngân ➔ Xuất hóa đơn. |

### 6.2. Quy tắc kiểm thử AI Engine và Ranh giới an toàn lâm sàng
1. **Bắt buộc dùng Mock trong Unit Test và CI:** 
   - Kiểm thử logic prompt, bóc tách JSON và cơ chế dự phòng (fallback) hoàn toàn bằng dữ liệu giả lập (mock responses).
   - Tuyệt đối không gọi trực tiếp Gemini API trên pipeline CI để tránh lỗi mạng ngẫu nhiên, cạn kiệt quota và chi phí API.
2. **Các kịch bản kiểm thử AI bắt buộc:**
   - Gemini phản hồi JSON bị lỗi cú pháp hoặc thiếu trường dữ liệu.
   - Gọi API bị timeout, lỗi xác thực khóa mạng hoặc vượt hạn mức (rate limit).
   - Phản hồi trả về chuỗi rỗng hoặc vượt độ dài cho phép.
   - Cơ chế Fallback kích hoạt chính xác để trả về luồng an toàn mặc định mà không làm sập ứng dụng.
3. **Ranh giới an toàn dữ liệu y tế:**
   - Module AI trong Clinic-AI chỉ đóng vai trò trợ lý sơ bộ: Gợi ý chuyên khoa khám và tóm tắt triệu chứng ban đầu.
   - Tuyệt đối không để phản hồi của AI tự động tạo chẩn đoán y khoa chính thức, phác đồ điều trị, hoặc kê đơn thuốc khi chưa có sự xác nhận trực tiếp từ Bác sĩ.

### 6.3. Quy định xử lý bài kiểm thử
- Mọi bài kiểm thử bắt buộc trong CI phải đạt trạng thái Pass 100%.
- Không được bỏ qua, vô hiệu hóa hoặc xóa bài kiểm thử chỉ nhằm làm cho CI đạt Pass.
- Trường hợp cần skip test vì lý do kỹ thuật chính đáng (môi trường phụ thuộc chưa sẵn sàng hoặc lỗi đã được ghi nhận riêng) phải có giải thích rõ ràng, có ticket Jira theo dõi, có người chịu trách nhiệm và được Reviewer chấp thuận.
- Các bài kiểm thử liên quan đến bảo mật, tính toàn vẹn dữ liệu viện phí và nghiệp vụ cốt lõi không được phép bỏ qua để merge.

---

## 7. ĐỊNH NGHĨA HOÀN THÀNH (DEFINITION OF DONE - DoD)

Một User Story / Task chỉ được chuyển sang **Done** khi đáp ứng đủ 6 tiêu chuẩn:
1. Mã nguồn tuân thủ Clean Code: Tên biến và hàm tự giải thích logic nghiệp vụ; loại bỏ hoàn toàn mã chết và comment thừa thãi.
2. Vượt qua 100% các bài kiểm thử tự động bắt buộc trong CI (Backend Pytest, Frontend Build).
3. Đạt tối thiểu 1 Approval độc lập và được Squash and Merge vào nhánh `main`.
4. Không gây xung đột (conflict) hoặc làm đổ vỡ các bài kiểm thử hồi quy của hệ thống.
5. Được kiểm thử xác nhận thành công trên môi trường tích hợp (giai đoạn Testing / QA).
6. Trạng thái ticket trên Jira được chuyển sang Done bởi QA hoặc người phụ trách sau khi nghiệm thu.

---

## 8. QUY TRÌNH XỬ LÝ BUG SAU KHI MERGE (TESTING PHASE)

Khi mã nguồn đã vào `main` nhưng phát hiện lỗi trong quá trình kiểm thử QA:
1. **Xử lý Ticket tính năng ban đầu:**
   - Nếu phát hiện lỗi khiến tính năng chưa đạt DoD, ticket tính năng ban đầu tiếp tục giữ ở trạng thái `Testing / QA` (không được chuyển sang `Done`).
2. **Tạo Ticket Bug mới trên Jira và liên kết chuẩn xác:**
   - Issue Type: **Bug** (chấm tròn đỏ).
   - Điền đầy đủ: Steps to reproduce, Expected result, Actual result, ảnh chụp lỗi.
   - Gán (Assignee) cho thành viên phụ trách module tương ứng.
   - **Xác định đúng chiều liên kết (Issue Linking):**
     - Từ màn hình User Story: chọn `is blocked by` ➔ trỏ đến mã Bug (Ví dụ: `PJ2026-15 is blocked by PJ2026-89`).
     - Hoặc từ màn hình Bug: chọn `blocks` ➔ trỏ đến mã User Story (Ví dụ: `PJ2026-89 blocks PJ2026-15`).
     - Tuyệt đối kiểm tra kỹ cả 2 đầu ticket để tránh tạo liên kết ngược chiều.
3. **Quy trình sửa lỗi:**
   - Tạo nhánh sửa lỗi riêng: `fix/PJ2026-<Mã_Bug>-<tên-lỗi>`
   - Mở Pull Request mới với tiêu đề `fix(...)` trỏ vào `main`.
   - Review -> CI Pass -> Merge -> Chạy lại kiểm thử xác nhận.
4. **Nghiệm thu hoàn tất:**
   - Chuyển ticket Bug sang **Done**.
   - Sau khi kiểm thử toàn diện xác nhận tính năng hoạt động ổn định, ticket tính năng ban đầu mới chính thức được chuyển sang **Done**.

---

## 9. VẬN HÀNH SCRUM THỰC DỤNG CHO NHÓM 5 NGƯỜI

Để tối ưu hiệu quả và giá trị chuyển giao:
- **Sprint Goal theo giá trị nghiệp vụ:** Mỗi Sprint tập trung vào một kết quả nghiệp vụ cụ thể thay vì đếm số lượng task lẻ.  
  *Ví dụ:* "Hoàn thiện liên thông luồng Tiếp đón, Khám bệnh và Kê đơn ngoại trú, bảo đảm hồ sơ bệnh nhân và đơn thuốc được xử lý chính xác, đồng bộ qua cơ sở dữ liệu và vượt qua các bài kiểm thử bắt buộc."
- **Daily Standup (5-10 phút):** Trao đổi nhanh đầu ngày qua Zalo hoặc gặp trực tiếp theo 3 câu hỏi:
  1. Hôm qua đã hoàn thành gì?
  2. Hôm nay sẽ làm gì?
  3. Đang gặp khó khăn hoặc bị block ở đâu cần đồng đội giải quyết?
- **Sprint Review (20–30 phút cuối Sprint):** Demo trực tiếp các luồng nghiệp vụ đã hoàn thành trên hệ thống, nghiệm thu tính năng theo Acceptance Criteria và ghi nhận phản hồi.
- **Sprint Retrospective (20–30 phút ngay sau Review):** Đánh giá cách phối hợp làm việc của nhóm (What went well, what went wrong) và chọn ra đúng **1–2 hành động cải tiến cụ thể** để áp dụng ngay vào Sprint kế tiếp.

---


