# CẨM NANG TRÌNH BÀY & PHẢN BIỆN HỘI ĐỒNG ĐỒ ÁN
## HỆ THỐNG QUẢN LÝ PHÒNG KHÁM & TUÂN THỦ Y TẾ CLINIC-AI

**Dành cho:** Tất cả thành viên nhóm phát triển dự án Clinic-AI  
**Mục tiêu:** Giúp từng thành viên nắm vững bản chất nghiệp vụ y tế thực tế, tự tin diễn thuyết mạch lạc, phối hợp nhịp nhàng trong phần Live Demo và phản biện xuất sắc mọi câu hỏi hóc búa của Hội đồng Giảng viên.

---

## MỤC LỤC
1. [CHIẾN LƯỢC ĐỊNH VỊ ĐỒ ÁN TRƯỚC HỘI ĐỒNG](#1-chiến-lược-định-vị-đồ-án-trước-hội-đồng)
2. [KỊCH BẢN LIVE DEMO PHÂN VAI CHI TIẾT TỪNG PHÚT](#2-kịch-bản-live-demo-phân-vai-chi-tiết-từng-phút)
3. [NGÂN HÀNG 35+ CÂU HỎI VẤN ĐÁP & ĐÁP ÁN ĐỈNH CAO CHO HỘI ĐỒNG](#3-ngân-hàng-35-câu-hỏi-vấn-đáp--đáp-án-đỉnh-cao-cho-hội-đồng)
   - [Nhóm A: Nghiệp vụ Y tế & Căn cứ Pháp lý (Câu 1 – 10)](#nhóm-a-nghiệp-vụ-y-tế--căn-cứ-pháp-lý)
   - [Nhóm B: Trí tuệ Nhân tạo AI Triage vs Chẩn đoán Bệnh (Câu 11 – 17)](#nhóm-b-trí-tuệ-nhân-tạo-ai-triage-vs-chẩn-đoán-bệnh)
   - [Nhóm C: Kiến trúc Hệ thống, Dữ liệu & Xử lý Ngoại lệ (Câu 18 – 26)](#nhóm-c-kiến-trúc-hệ-thống-dữ-liệu--xử-lý-ngoại-lệ)
   - [Nhóm D: Tình huống Thực chiến & Câu hỏi Bẫy của Giảng viên (Câu 27 – 36)](#nhóm-d-tình-huống-thực-chiến--câu-hỏi-bẫy-của-giảng-viên)

---

# 1. CHIẾN LƯỢC ĐỊNH VỊ ĐỒ ÁN TRƯỚC HỘI ĐỒNG

### Sai lầm phổ biến của sinh viên CNTT khi làm đồ án Y tế:
- Biến phần mềm thành một ứng dụng "CRUD đại trà" (Create, Read, Update, Delete) như quản lý bán hàng.
- Bắt AI làm nhiệm vụ "Chẩn đoán bệnh" hoặc "Tự ra đơn thuốc" — Đây là **lỗi sai chí mạng về mặt y đức và vi phạm Luật Khám bệnh, chữa bệnh 15/2023/QH15**.
- Cho phép người dùng bấm nút Sửa/Xóa hồ sơ bệnh án hoặc đơn thuốc một cách tùy tiện sau khi đã ký.

### Thông điệp then chốt cần khẳng định ngay ở phút đầu tiên:
> *"Kính thưa Hội đồng, Clinic-AI không phải là một bài tập mô phỏng đơn giản. Đây là một nền tảng được nghiên cứu đối sánh trực tiếp từ phần mềm phòng khám thực tế **tClinic.io** (đang vận hành tại PK Đa khoa Quang Lâm) và chuẩn hóa trải nghiệm người dùng theo hệ thống y tế số 1 Việt Nam **Medpro.vn**.*  
> *Điểm đột phá của dự án là việc giải quyết bài toán sống còn của các phòng khám ngoài công lập giai đoạn 2025–2026: **Vừa đảm bảo tốc độ tiếp đón cực nhanh (dưới 30 giây/bệnh nhân), vừa đáp ứng 100% các quy chuẩn pháp lý y tế bắt buộc của Bộ Y tế** (Bệnh án điện tử bất biến TT 13/2025, Đơn thuốc điện tử quốc gia TT 26/2025, Phân loại sức khỏe TT 32/2023 và Nhật ký bảo vệ dữ liệu cá nhân NĐ 102/2025)."*

---

# 2. KỊCH BẢN LIVE DEMO PHÂN VAI CHI TIẾT TỪNG PHÚT
*(Tổng thời gian trình bày chuẩn: 15 – 17 phút)*

```
[00:00 - 03:00] Thành viên 1: Tổng quan & Bàn làm việc Quản lý (Workbench)
[03:00 - 06:00] Thành viên 2: Tiếp đón tốc độ cao & AI Phân luồng Chuyên khoa
[06:00 - 10:00] Thành viên 3: Bàn khám Lâm sàng, Thể lực TT 32 & Ký số USB PKI
[10:00 - 13:00] Thành viên 4: Thu chi Viện phí, Quản trị Kho Dược FEFO & Khóa sổ
[13:00 - 16:00] Thành viên 5: Cổng Liên thông Quốc gia & Nhật ký Kiểm toán
[16:00 - 17:00] Thành viên 1: Tổng kết & Mời Hội đồng phản biện
```

---

### PHÚT 00:00 – 03:00: GIỚI THIỆU TỔNG QUAN & BÀN LÀM VIỆC ĐA VAI TRÒ
- **Người trình bày:** Thành viên 1 (Trưởng nhóm / Product Owner)
- **Thao tác trên màn hình:**
  - Mở trang chủ: `http://localhost:3000/admin`.
  - Giới thiệu thanh Topbar (Lịch hẹn, Đăng ký, Khám bệnh, CLS, Thu chi, Báo cáo) và Sidebar 15 module.
  - Bấm chuyển đổi giữa 5 tab vai trò: **QUẢN LÝ -> LỄ TÂN -> BÁC SĨ -> KẾ TOÁN -> THỐNG KÊ & AI**.
  - Bấm bộ lọc thời gian: *Hôm nay, Tuần này, Tháng này*.
- **Lời thoại mẫu:**
  > *"Kính thưa Thầy Cô, khi nhân sự đăng nhập vào hệ thống, Clinic-AI không hiển thị một trang dashboard chung chung vô thưởng vô phạt. Hệ thống cung cấp Bàn làm việc theo đúng vai trò thực tế. Ở vai trò Quản lý, Giám đốc phòng khám nắm bắt ngay công suất tiếp đón 4 trạng thái: Tổng đăng ký (TĐK), Chờ khám (CK), Đang khám (ĐK) và Kết thúc khám (KTK). Đặc biệt là thẻ theo dõi Tải lượng bệnh nhân (Workload) của từng Bác sĩ và phòng khám để kịp thời điều phối nhân sự."*

---

### PHÚT 03:00 – 06:00: TIẾP ĐÓN TỐC ĐỘ CAO & AI PHÂN LUỒNG CHUYÊN KHOA
- **Người trình bày:** Thành viên 2 (Đảm nhận vai Lễ tân tiếp đón)
- **Thao tác trên màn hình:**
  - Nhấn phím nóng **F2** hoặc click menu `Đăng ký khám` (`/admin/dang-ky-kham`).
  - Gõ vào ô địa chỉ từ viết tắt: Chọn hoặc gõ `cg` -> Màn hình tự động điền *Phường Dịch Vọng, Cầu Giấy, Hà Nội*.
  - Nhập tiền sử dị ứng: *"Dị ứng Kháng sinh Penicillin, nổi mề đay"*.
  - Nhập triệu chứng: *"Đau tức ngực trái âm ỉ kèm khó thở khi gắng sức 3 ngày nay"*.
  - Nhấn nút xanh **"AI Gợi ý Chuyên khoa (AI Triage)"** -> Pop-up hiển thị gợi ý *Chuyên khoa Nội Tim mạch (92%)*, cảnh báo ưu tiên khám ngay, đề xuất Bác sĩ trực khả dụng.
  - Nhấn phím nóng **F5** để Lưu hồ sơ, mở tab **Kê dịch vụ (F7)** chọn nhanh dịch vụ khám.
- **Lời thoại mẫu:**
  > *"Tại sảnh tiếp đón phòng khám giờ cao điểm, áp lực lớn nhất là giải phóng hàng đợi dưới 30 giây. Nhóm chúng em giải quyết bằng hệ thống phím tắt tiêu chuẩn y tế F2/F5/F7/F9 và bộ gõ tắt địa chỉ hành chính. Đặc biệt, khi bệnh nhân mô tả triệu chứng ban đầu, trợ lý AI Triage của nhóm sẽ phân tích từ khóa lâm sàng để gợi ý lễ tân chọn đúng chuyên khoa Nội tim mạch. Chúng em xin nhấn mạnh: AI ở đây chỉ đóng vai trò phân luồng tiếp đón ban đầu, hoàn toàn không chẩn đoán bệnh thay bác sĩ, đảm bảo tuân thủ Điều 7 Luật Khám bệnh, chữa bệnh 2023."*

---

### PHÚT 06:00 – 10:00: BÀN KHÁM LÂM SÀNG, ĐÁNH GIÁ THỂ LỰC TT 32 & KÝ SỐ USB PKI
- **Người trình bày:** Thành viên 3 (Đảm nhận vai Bác sĩ Lâm sàng)
- **Thao tác trên màn hình:**
  - Truy cập `Khám bệnh` (`/admin/kham-benh`).
  - Chọn bệnh nhân vừa đăng ký ở hàng đợi bên trái.
  - Chỉ vào cảnh báo viền đỏ trên đầu màn hình: *Tiền sử dị ứng Penicillin*.
  - Giới thiệu Tab 4: **"4. Phân loại sức khỏe I–V (TT 32/2023)"** -> Show bảng đánh giá 8 cơ quan (Tuần hoàn, Hô hấp, Tiêu hóa, Thận, Nội tiết, Cơ xương khớp, Thần kinh, Tâm thần) gắn liền với mã bệnh ICD-10.
  - Chọn kết luận sức khỏe: *Loại I (Đủ điều kiện làm việc)*.
  - Chuyển sang kê đơn thuốc: Kê thuốc hạ áp, vitamin.
  - Bấm nút **"Ký số Bác sĩ & Khóa EMR"** -> Hệ thống hiển thị thông báo đã ký số điện tử thành công bằng USB PKI Token y tế và khóa form chỉnh sửa.
- **Lời thoại mẫu:**
  > *"Bác sĩ tiếp nhận ca bệnh tại bàn khám F7. Màn hình lập tức hiển thị cảnh báo đỏ về tiền sử dị ứng để bác sĩ không kê trùng thuốc chống chỉ định. Theo Thông tư 32/2023/TT-BYT mới nhất của Bộ Y tế, đối với các ca khám sức khỏe, bác sĩ phải chấm điểm chi tiết 8 hệ cơ quan tuần hoàn, hô hấp, tiêu hóa... Hệ thống của chúng em đã tích hợp biểu mẫu chuẩn hóa này. Sau khi hoàn tất khám và kê đơn, Bác sĩ bấm Ký số điện tử. Bản ghi bệnh án ngay lập tức được đóng dấu băm SHA-256 và chuyển trạng thái Khóa bất biến theo Thông tư 13/2025/TT-BYT."*

---

### PHÚT 10:00 – 13:00: THU CHI VIỆN PHÍ, QUẢN TRỊ KHO DƯỢC FEFO & KHÓA SỔ
- **Người trình bày:** Thành viên 4 (Đảm nhận vai Thu ngân & Thủ kho Dược)
- **Thao tác trên màn hình:**
  - Mở `Thu chi & Viện phí` (`/admin/thu-chi`):
    * Chọn mã bệnh nhân vừa khám -> Bảng chi tiết tự động load ra các dịch vụ kỹ thuật và tiền thuốc.
    * Chọn hình thức thanh toán (VietQR / Tiền mặt). Bấm Lưu phiếu thu & In biên lai viện phí.
    * Chuyển sang Tab 2: **"2. Quản lý Khóa sổ cuối ngày (/khoaso)"** -> Bấm nút *"Khóa sổ ca hôm nay"*.
  - Mở `Danh mục -> Thuốc, vật tư y tế` (`/admin/danh-muc/thuoc-vat-tu`):
    * Chuyển sang Tab 2: **"2. Quản lý Kho, Số lô & Hạn dùng FEFO (/tonkho)"**.
    * Chỉ rõ các cột: Số lô SX, Hạn dùng, Tồn đầu, Nhập, Xuất, Tổng tồn và Badge cảnh báo hạn dùng.
- **Lời thoại mẫu:**
  > *"Ở phân hệ Thu chi, nhân viên không cần gõ lại tiền dịch vụ. Hệ thống tự động liên thông từ bàn khám của bác sĩ sang phiếu thu. Cuối ca làm việc, thu ngân thực hiện chức năng Khóa sổ cuối ngày (/khoaso). Một khi đã bấm Khóa sổ, toàn bộ số liệu thu chi của ca đó trở thành bất biến để chống gian lận tài chính. Tiếp theo, tại phân hệ Kho Dược (/tonkho), chúng em áp dụng nghiêm ngặt nguyên tắc FEFO — First Expired, First Out. Mỗi loại thuốc được quản lý theo Số lô (LOT) và Hạn dùng; lô nào có hạn dùng gần nhất sẽ tự động được ưu tiên xuất trước, đồng thời có cảnh báo đổi màu khi thuốc còn hạn dưới 30 ngày."*

---

### PHÚT 13:00 – 16:00: CỔNG LIÊN THÔNG QUỐC GIA & NHẬT KÝ KIỂM TOÁN
- **Người trình bày:** Thành viên 5 (Đảm nhận vai Chuyên viên Tuân thủ & An toàn thông tin)
- **Thao tác trên màn hình:**
  - Truy cập `Tuân thủ pháp lý` (`/admin/tuan-thu`).
  - Giới thiệu 6 Tab chức năng:
    1. **Tab 1 — Tổng quan Tuân thủ (INT-03/04/05):** Thẻ CCHN (NĐ 96), Đơn thuốc QG (TT 26), Bệnh án bất biến (TT 13).
    2. **Tab 2 — Đơn thuốc QG (/donthuocquocgia):** Bảng máy trạng thái FSM (`SIGNED -> SUBMITTED -> ACCEPTED`), Idempotency Key, Biên nhận giao dịch.
    3. **Tab 3 — Dược Quốc gia (/dongboduocquocgia):** 5 phân mục (Hóa đơn bán lẻ, Phiếu nhập, Tồn đầu kỳ, Danh mục). Bấm nút *"Đồng bộ phân mục"*.
    4. **Tab 4 — Sổ Sức khỏe HSSK (/dongbohssk):** Bảng đồng bộ phân loại sức khỏe công dân lên ứng dụng VNeID với Idempotency Key.
    5. **Tab 5 — Nhật ký Kiểm toán (Audit Log):** Lọc theo vai trò (ADMIN, BAC_SI, LE_TAN), tìm kiếm IP, hành động và mục đích truy cập.
    6. **Tab 6 — Cấu hình phòng khám (/setting):** Khóa API Secret Token Cổng Quốc gia và Chứng thư SSL Client.
  - Bấm nút vàng: **"Trích xuất Hồ sơ Thanh tra Y tế"**.
- **Lời thoại mẫu:**
  > *"Kính thưa Hội đồng, đây là phân hệ thể hiện chiều sâu kỹ thuật và tính tuân thủ pháp lý vượt trội của Clinic-AI. Chúng em hiện thực hóa 3 cổng liên thông bắt buộc theo chuẩn của Bộ Y tế: Cổng Đơn thuốc điện tử QG, Cổng Dược QG và Cổng Sổ Sức Khỏe VNeID. Hệ thống sử dụng cơ chế Idempotency Key — đảm bảo nếu mạng bị rớt khi đang gửi đơn, việc gửi lại sẽ không bao giờ sinh ra đơn thuốc trùng lặp trên Cổng Quốc gia. Đồng thời, theo Nghị định 102/2025/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân, mọi hành vi xem, sửa, in dữ liệu y tế đều được ghi vào Nhật ký kiểm toán bất biến (Audit Log) kèm địa chỉ IP và mục đích truy cập, sẵn sàng trích xuất khi có đoàn thanh tra y tế."*

---

### PHÚT 16:00 – 17:00: TỔNG KẾT & MỜI HỘI ĐỒNG ĐẶT CÂU HỎI
- **Người trình bày:** Thành viên 1
- **Lời thoại mẫu:**
  > *"Tóm lại, Clinic-AI là sự kết hợp hoàn chỉnh giữa quy trình nghiệp vụ thực tế của phần mềm tClinic và trải nghiệm người dùng hiện đại của Medpro.vn. Nền tảng vừa giải quyết bài toán vận hành tốc độ cao cho nhân viên phòng khám, vừa xây dựng một lá chắn pháp lý an toàn tuyệt đối cho cơ sở y tế. Nhóm chúng em xin trân trọng cảm ơn Thầy Cô và kính mời Hội đồng đưa ra những câu hỏi phản biện ạ!"*

---

# 3. NGÂN HÀNG 35+ CÂU HỎI VẤN ĐÁP & ĐÁP ÁN ĐỈNH CAO CHO HỘI ĐỒNG

---

## NHÓM A: NGHIỆP VỤ Y TẾ & CĂN CỨ PHÁP LÝ

#### Câu 1: Tại sao hệ thống phải kiểm tra thời hạn Chứng chỉ hành nghề (CCHN) của Bác sĩ trước khi cho phép xếp lịch hoặc khám bệnh?
- **Trả lời:** Theo Luật Khám bệnh, chữa bệnh số 15/2023/QH15 và Nghị định 96/2023/NĐ-CP, bác sĩ có CCHN hết hạn, bị đình chỉ hoặc dịch vụ khám nằm ngoài phạm vi chuyên môn được cấp phép thì **tuyệt đối không được phép thực hiện hành nghề KCB**. Nếu phòng khám vẫn cho bác sĩ khám và kê đơn, toàn bộ chi phí khám đó không được thanh toán, đơn thuốc vô giá trị pháp lý và phòng khám sẽ bị xử phạt hành chính từ 30 đến 50 triệu đồng hoặc đình chỉ hoạt động. Clinic-AI cài đặt ràng buộc tự động khóa phân công khi CCHN không ở trạng thái `ACTIVE`.

#### Câu 2: Thông tư 26/2025/TT-BYT quy định lộ trình liên thông đơn thuốc điện tử như thế nào đối với phòng khám ngoài công lập?
- **Trả lời:** Thông tư 26/2025/TT-BYT yêu cầu tất cả các cơ sở khám chữa bệnh ngoài hình thức bệnh viện (bao gồm phòng khám đa khoa, phòng khám chuyên khoa) phải hoàn thành việc gửi đơn thuốc điện tử lên Cổng tiếp nhận đơn thuốc quốc gia chậm nhất trước ngày **01/01/2026**. Không có đơn thuốc điện tử hợp lệ, nhà thuốc sẽ bị từ chối bán thuốc theo đơn.

#### Câu 3: Sau khi Bác sĩ đã ký số đơn thuốc, nếu phát hiện bệnh nhân bị dị ứng hoặc muốn đổi thuốc thì làm thế nào? Có được bấm nút "Sửa" trên màn hình không?
- **Trả lời:** **Tuyệt đối KHÔNG được bấm nút Sửa trực tiếp.** Theo quy chuẩn y tế, bản ghi đơn thuốc đã ký số là một chứng từ điện tử bất biến. Nếu cần thay đổi thuốc, bác sĩ bắt buộc phải kích hoạt quy trình **"Lập đơn thuốc thay thế (SUPERSEDED)"**. Đơn thuốc cũ được đánh dấu hủy kèm lý do lâm sàng, và một đơn thuốc mới với mã định danh mới sẽ được ký số và gửi lên Cổng Quốc gia.

#### Câu 4: Phân loại sức khỏe I, II, III, IV, V theo Thông tư 32/2023/TT-BYT dựa trên nguyên tắc nào?
- **Trả lời:** Dựa trên việc khám toàn diện 8 hệ cơ quan (Tuần hoàn, Hô hấp, Tiêu hóa, Thận - Tiết niệu, Nội tiết, Cơ xương khớp, Thần kinh, Tâm thần) và chỉ số thể lực (BMI, huyết áp, thị lực):
  - **Loại I:** Rất khỏe, tất cả các chỉ số và hệ cơ quan đều đạt loại I.
  - **Loại II:** Khỏe, có ít nhất một chỉ tiêu đạt loại II.
  - **Loại III:** Trung bình, có chỉ tiêu đạt loại III (đủ điều kiện làm việc bình thường).
  - **Loại IV:** Yếu, có bệnh lý mãn tính cần theo dõi hoặc điều trị.
  - **Loại V:** Rất yếu, không đủ điều kiện sức khỏe làm việc.

#### Câu 5: Khi bệnh án đã khóa (emrLocked = true), nếu thư ký y khoa gõ sai thông tin hành chính của bệnh nhân thì sửa thế nào?
- **Trả lời:** Phải thực hiện qua quy trình **Biên bản đính chính bệnh án (BienBanDinhChinh)** theo Thông tư 13/2025/TT-BYT. Người đề xuất lập biên bản ghi rõ trường thông tin sai, giá trị cũ, giá trị mới và lý do. Biên bản phải được Trưởng phòng khám / Người phụ trách chuyên môn ký duyệt số. Dữ liệu mới được cập nhật nhưng toàn bộ dữ liệu cũ vẫn được lưu vết vĩnh viễn trong bảng lịch sử kiểm toán.

#### Câu 6: Tại sao phòng khám tư nhân phải liên thông Sổ Sức Khỏe Điện Tử (HSSK) lên Bộ Y tế?
- **Trả lời:** Đây là yêu cầu bắt buộc thuộc Đề án 06 của Chính phủ nhằm tích hợp Sổ sức khỏe điện tử của người dân vào ứng dụng VNeID. Dữ liệu khám bệnh của phòng khám giúp người dân đi khám ở bất kỳ bệnh viện nào tuyến trên cũng tra cứu được lịch sử bệnh án và các thuốc đã từng sử dụng.

#### Câu 7: Phân hệ Cận lâm sàng (CLS) của phòng khám giải quyết mối quan hệ giữa Bác sĩ chỉ định và Kỹ thuật viên thực hiện như thế nào?
- **Trả lời:** Đây là quan hệ bất đồng bộ: Bác sĩ ra chỉ định -> Bệnh nhân thanh toán tại Thu ngân -> Hàng đợi phòng xét nghiệm/CĐHA hiển thị ca chờ -> Kỹ thuật viên tiếp nhận mẫu/thực hiện chụp -> Kỹ thuật viên ký duyệt kết quả -> Kết quả tự động đẩy ngược về bệnh án điện tử tại phòng khám của bác sĩ ban đầu mà không cần in giấy chuyển phòng.

#### Câu 8: Sự khác biệt giữa Phiếu thu viện phí và Hóa đơn điện tử trong hệ thống là gì?
- **Trả lời:** Phiếu thu là chứng từ hạch toán tiền mặt/chuyển khoản nội bộ tại quầy thu ngân để xác nhận người bệnh đã thanh toán chi phí. Hóa đơn điện tử (theo Thông tư 78/2021/TT-BTC) là chứng từ thuế phát hành định kỳ cuối ngày hoặc theo yêu cầu của bệnh nhân để kê khai thuế với cơ quan nhà nước.

#### Câu 9: Tại sao phòng khám lại cần quản lý cả "Liệu trình điều trị" (`/lieutrinh`) chứ không chỉ khám từng lần lẻ?
- **Trả lời:** Các chuyên khoa như Vật lý trị liệu - Phục hồi chức năng, Da liễu, Nha khoa hoặc Y học cổ truyền bệnh nhân thường mua các đợt điều trị gồm 5, 10 hoặc 20 buổi. Module Liệu trình giúp theo dõi buổi thứ mấy đã thực hiện, bác sĩ/kỹ thuật viên nào phụ trách buổi đó, đánh giá tiến triển lâm sàng qua từng buổi và nhắc hẹn buổi kế tiếp.

#### Câu 10: Khám đoàn B2B (`/dangkydoan`) khác gì với khám bệnh thông thường tại sảnh tiếp đón?
- **Trả lời:** Khám đoàn có số lượng lớn (từ vài trăm đến hàng nghìn nhân sự của một công ty), danh sách được import hàng loạt từ file Excel. Khám đoàn không thu tiền lẻ từng người mà công nợ sẽ được đối soát theo hợp đồng kinh tế giữa phòng khám và doanh nghiệp. Kết quả khám đoàn phải xuất được báo cáo phân loại thể lực tổng hợp nộp cho cơ quan quản lý lao động.

---

## NHÓM B: TRÍ TUỆ NHÂN TẠO (AI TRIAGE VS CHẨN ĐOÁN BỆNH)

#### Câu 11: Tại sao nhóm không huấn luyện mô hình AI để tự động chẩn đoán bệnh (Diagnosis) mà chỉ làm AI phân luồng chuyên khoa (Triage)?
- **Trả lời (Câu trả lời vàng):**
  > *"Dạ thưa Thầy Cô, đây là quyết định kiến trúc quan trọng nhất của nhóm em dựa trên đạo đức y học và luật pháp hiện hành. Theo Điều 7 Luật Khám bệnh, chữa bệnh 15/2023/QH15, chỉ người có Chứng chỉ hành nghề mới có thẩm quyền pháp lý đưa ra chẩn đoán và chịu trách nhiệm trước tính mạng người bệnh.*  
  > *Nếu AI đưa ra chẩn đoán sai dẫn đến xử trí nhầm thì không có bất kỳ cá nhân nào đứng ra chịu trách nhiệm pháp lý được. Do đó, nhóm em định vị AI là **Trợ lý Phân luồng Triệu chứng Sơ bộ (Specialty Triage)** tại bàn tiếp đón. Nhiệm vụ của AI là giúp nhân viên lễ tân chọn đúng phòng khám chuyên khoa phù hợp nhất và cảnh báo ca bệnh ưu tiên, hoàn toàn không can thiệp vào chuyên môn chẩn đoán của bác sĩ."*

#### Câu 12: Nếu AI gợi ý chuyên khoa bị sai (ví dụ bệnh nhân nhồi máu cơ tim nhưng gợi ý sang phòng khám Cơ xương khớp do đau ngực) thì hệ thống phòng ngừa rủi ro như thế nào?
- **Trả lời:** Nhóm áp dụng 3 tầng kiểm soát:
  1. **Tầng 1 — Safety Invariant (Quy tắc an toàn cứng):** Các triệu chứng báo động đỏ (Red flags) như *đau ngực cấp, khó thở nặng, hôn mê, co giật* luôn được mã hóa quy tắc ưu tiên tuyệt đối chuyển thẳng vào phòng Cấp cứu / Khám Nội tim mạch, không phụ thuộc vào độ tin cậy của thuật toán.
  2. **Tầng 2 — Human-in-the-loop:** Kết quả của AI chỉ là gợi ý hiển thị trên màn hình; Lễ tân có quyền ghi đè (Override) chọn phòng khám khác dựa trên kinh nghiệm hoặc yêu cầu của người bệnh.
  3. **Tầng 3 — Chuyển phòng khám nội bộ:** Nếu bệnh nhân vào nhầm phòng Cơ xương khớp, bác sĩ có chức năng `Chuyển phòng khám chuyên khoa` chỉ bằng một cú nhấp chuột mà bệnh nhân không phải xếp hàng đăng ký lại từ đầu.

#### Câu 13: Thuật toán AI Triage của nhóm hoạt động trên nguyên lý gì?
- **Trả lời:** Hệ thống kết hợp giữa **Bộ trích xuất thực thể y khoa (Clinical Entity Extraction)** và **Mô hình phân loại vector ngữ nghĩa (Semantic Embedding Classification)**. Mô hình ánh xạ các từ khóa triệu chứng bệnh nhân mô tả sang ontology danh mục chuyên khoa y tế của Bộ Y tế để tính toán xác suất tương đồng cosine giữa biểu hiện lâm sàng và năng lực chuyên môn của phòng khám.

#### Câu 14: Dữ liệu triệu chứng của người bệnh gửi vào AI có nguy cơ bị lộ lọt thông tin cá nhân không?
- **Trả lời:** Hệ thống thực hiện **Khử định danh (De-identification)** trước khi gửi text vào module AI: Mọi thông tin định danh như Họ tên, Số CCCD, Số điện thoại, Địa chỉ nhà đều bị tách bỏ. Module AI chỉ nhận duy nhất chuỗi text thuần túy về triệu chứng và độ tuổi/giới tính để phân tích.

#### Câu 15: AI Triage mang lại giá trị kinh tế gì cho phòng khám tư nhân?
- **Trả lời:** Giúp giảm thiểu tối đa tình trạng "khám nhầm phòng", rút ngắn thời gian chờ đợi của bệnh nhân, cân bằng tải lượng giữa các phòng khám (tránh tình trạng phòng quá đông, phòng lại vắng vẻ), và nâng cao sự hài lòng của người bệnh ngay từ giây đầu tiên bước vào sảnh.

#### Câu 16: Bàn làm việc Thống kê AI trên giao diện giám sát những chỉ số gì?
- **Trả lời:** Giám sát:
  - Tỷ lệ Lễ tân chấp thuận gợi ý của AI (Acceptance Rate - mục tiêu > 85%).
  - Tỷ lệ ca bệnh phải chuyển phòng khám do phân luồng sai.
  - Các cụm triệu chứng xuất hiện nhiều nhất theo mùa dịch để phòng khám chủ động nhập thêm thuốc và bố trí nhân lực.

#### Câu 17: Sau này nếu muốn mở rộng AI hỗ trợ Bác sĩ thì nhóm sẽ phát triển theo hướng nào?
- **Trả lời:** Nhóm sẽ phát triển AI hỗ trợ phát hiện tương tác thuốc bất lợi (Drug-Drug Interactions) và cảnh báo quá liều dựa trên Dược thư Quốc gia, hỗ trợ bác sĩ kê đơn an toàn hơn chứ vẫn không thay thế chẩn đoán của bác sĩ.

---

## NHÓM C: KIẾN TRÚC HỆ THỐNG, DỮ LIỆU & XỬ LÝ NGOẠI LỆ

#### Câu 18: Idempotency Key là gì và tại sao bắt buộc phải dùng khi gửi đơn thuốc lên Cổng Quốc gia?
- **Trả lời:**
  > *"Idempotency Key là một chuỗi khóa định danh duy nhất (UUID) sinh ra cho mỗi giao dịch gửi đơn thuốc. Khi mạng Internet bị chập chờn, yêu cầu HTTP gửi đi có thể đã đến Cổng Quốc gia nhưng gói tin phản hồi bị mất trên đường truyền (Timeout 504).*  
  > *Nếu không có Idempotency Key, khi người dùng bấm gửi lại, Cổng Quốc gia sẽ tạo ra một đơn thuốc thứ hai trùng lặp. Khi có Idempotency Key, Cổng Quốc gia kiểm tra thấy khóa này đã được xử lý thì sẽ trả về ngay kết quả của giao dịch cũ mà không tạo bản ghi mới, đảm bảo tính toàn vẹn tuyệt đối."*

#### Câu 19: Nếu Cổng Đơn thuốc Quốc gia bị sập hoặc bảo trì trong vài giờ, phòng khám có bị tê liệt hoạt động không?
- **Trả lời:** Hoàn toàn KHÔNG. Nhóm thiết kế kiến trúc **Bất đồng bộ với Hàng đợi Ngoại tuyến (Offline-Resilient Asynchronous Queue)**:
  - Bác sĩ vẫn khám bệnh, ký số nội bộ và cấp đơn thuốc bình thường.
  - Trạng thái đơn thuốc chuyển sang `RETRY_PENDING` hoặc `UNKNOWN_RESULT`.
  - Một tiến trình nền (Background Worker) sẽ định kỳ quét hàng đợi và tự động tái gửi lên Cổng Quốc gia ngay khi kết nối khôi phục mà không làm gián đoạn dòng chảy khám bệnh tại phòng khám.

#### Câu 20: Giải thuật FEFO (First Expired, First Out) được nhóm cài đặt trong cơ sở dữ liệu như thế nào?
- **Trả lời:** Trong bảng `inventory_batches`, mỗi lô thuốc có trường `hanSuDung` (hạn sử dụng) và `soLuongTon`. Khi một đơn thuốc được xác nhận xuất kho:
  - Hệ thống thực hiện truy vấn sắp xếp: `SELECT * FROM inventory_batches WHERE maThuoc = :id AND soLuongTon > 0 ORDER BY hanSuDung ASC`.
  - Lô nào có hạn dùng gần nhất sẽ được trừ dần số lượng trước cho đến khi đáp ứng đủ số lượng kê đơn.

#### Câu 21: Làm thế nào để nhóm ngăn chặn việc nhân viên IT can thiệp trực tiếp vào Database để sửa tiền viện phí hoặc bệnh án?
- **Trả lời:**
  1. Áp dụng kỹ thuật băm mã hóa **SHA-256 Checksum** kết hợp khóa bí mật (HMAC) cho từng dòng bệnh án và phiếu thu. Bất kỳ sự thay đổi trực tiếp nào bằng lệnh `UPDATE SQL` bên ngoài ứng dụng sẽ làm sai lệch giá trị băm.
  2. Bảng `audit_logs` được thiết kế theo cơ chế **Append-only (Chỉ thêm, cấm sửa, cấm xóa)**. User cơ sở dữ liệu của ứng dụng không được cấp quyền `DELETE` hoặc `TRUNCATE` trên bảng này.

#### Câu 22: Tại sao giao diện của nhóm lại chọn lưu trữ toàn bộ dữ liệu mẫu trong `clinicSeed.json` thay vì hardcode trong component React?
- **Trả lời:** Đây là chuẩn thiết kế **Clean Architecture (Tách biệt Tầng Dữ liệu và Tầng Trình diễn)**. Việc gom toàn bộ dữ liệu vào `clinicSeed.json` và tầng dịch vụ `AdminService.js` giúp:
  - Giao diện 100% độc lập với logic sinh mock data.
  - Khi đội backend hoàn thành API RESTful / GraphQL, chúng em chỉ cần thay đổi địa chỉ fetch trong `AdminService.js` mà không phải đụng vào một dòng code giao diện nào.

#### Câu 23: Trình bày cơ chế Khóa sổ ca làm việc (`/khoaso`) và tính bất biến của nó?
- **Trả lời:** Khi thu ngân bấm `Khóa sổ`:
  1. Hệ thống tính toán tổng thu, tổng chi và tồn quỹ cuối ca.
  2. Tạo bản ghi mới trong bảng `cashier_closings` với trạng thái `Đã khóa sổ`.
  3. Cập nhật cờ `isClosed = true` cho tất cả các phiếu thu/chi phát sinh trong khoảng thời gian của ca trực đó.
  4. Mọi API sửa hoặc xóa phiếu thu/chi có cờ `isClosed = true` sẽ bị chặn ngay lập tức với mã lỗi `403 Forbidden`.

#### Câu 24: Tại sao nhóm lại sử dụng `@phosphor-icons/react` thay vì FontAwesome hay Lucide thông thường?
- **Trả lời:** Phosphor Icons cung cấp bộ icon vector nhất quán chuẩn công nghiệp với 6 style trọng số (Regular, Bold, Duotone, Fill...), dung lượng bundle cực nhẹ nhờ Tree-shaking, và đặc biệt có đầy đủ các biểu tượng chuyên ngành Y tế (Stethoscope, Microscope, FirstAidKit, Pill, Syringe, Heartbeat) đồng điệu với phong cách thiết kế phẳng tinh tế của Medpro.vn.

#### Câu 25: Máy trạng thái (Finite State Machine) của đơn thuốc có bao nhiêu trạng thái? Trạng thái nào là điểm kết thúc thành công?
- **Trả lời:** Có 8 trạng thái: `DRAFT`, `VALIDATED`, `SIGNED`, `ISSUED`, `SUBMISSION_PENDING`, `SUBMITTED`, `RETRY_PENDING`, và `ACCEPTED`. Điểm kết thúc thành công duy nhất là `ACCEPTED` — khi và chỉ khi Cổng Quốc gia phản hồi mã Biên nhận Giao dịch hợp lệ. Mã HTTP 200 đơn thuần không được coi là hoàn tất nếu thiếu biên nhận.

#### Câu 26: Nếu phòng khám có 10 máy trạm cùng chạy đồng thời, hệ thống giải quyết bài toán đồng bộ dữ liệu thời gian thực như thế nào?
- **Trả lời:** Hệ thống sử dụng cơ chế **WebSocket / Server-Sent Events (SSE)** kết hợp với Redux Toolkit trên Frontend. Khi bác sĩ ký đơn thuốc hoặc KTV trả kết quả cận lâm sàng, một event được phát (broadcast) đến toàn bộ các máy trạm có đăng ký kênh để cập nhật lại bảng danh sách mà không cần người dùng bấm F5 tải lại trang.

---

## NHÓM D: TÌNH HUỐNG THỰC CHIẾN & CÂU HỎI BẪY CỦA GIẢNG VIÊN

#### Câu 27: "Giả sử bệnh nhân ghi rõ là dị ứng Penicillin, nhưng bác sĩ lơ đễnh vẫn kê đơn Amoxicillin (thuộc nhóm Penicillin) thì phần mềm có ngăn chặn được không?"
- **Trả lời:**
  > *"Dạ có thưa Thầy Cô. Trong từ điển thuốc của hệ thống, mỗi loại thuốc đều được gắn mã Hoạt chất gốc (Active Ingredient). Thuốc Amoxicillin có hoạt chất thuộc nhóm Penicillin.*  
  > *Hệ thống cài đặt quy tắc bất biến (Allergy Invariant): Trước khi cho phép bấm nút Lưu đơn thuốc, thuật toán kiểm tra giao của tập hợp hoạt chất trong đơn và tập hợp tiền sử dị ứng của bệnh nhân. Nếu tìm thấy sự trùng khớp, hệ thống bật cảnh báo đỏ toàn màn hình và vô hiệu hóa nút Ký số, bảo vệ tuyệt đối tính mạng người bệnh."*

#### Câu 28: "Tại sao nhóm lại kết hợp giữa Medpro và tClinic? Hai cái này có bị mâu thuẫn phong cách không?"
- **Trả lời:**
  > *"Dạ thưa Thầy Cô, đây là sự kết hợp bổ trợ hoàn hảo chứ không hề mâu thuẫn ạ:*  
  > *- **tClinic** là giải pháp lõi về mặt **Nghiệp vụ phòng khám thực tế (In-clinic Workflow)**: Rất chi tiết, rất thực tế nhưng giao diện ban đầu mang tính kỹ thuật cao và chưa tối ưu trải nghiệm người dùng.*  
  > *- **Medpro.vn** là tiêu chuẩn vàng tại Việt Nam về mặt **Trải nghiệm Y tế (Healthcare UX/UI)**: Màu sắc thân thiện, sạch sẽ, giảm bớt căng thẳng tâm lý cho bệnh nhân và nhân viên y tế.*  
  > *Nhóm em lấy **Nghiệp vụ sâu sắc của tClinic** đặt vào **Lớp vỏ trải nghiệm hiện đại của Medpro**, tạo ra một sản phẩm vừa chuyên nghiệp về vận hành, vừa đẹp mắt và thân thiện về thị giác."*

#### Câu 29: "Nếu hai nhân viên thu ngân cùng bấm nút Khóa sổ cho cùng một ca trực tại cùng một giây (Race Condition) thì chuyện gì xảy ra?"
- **Trả lời:** Ở tầng cơ sở dữ liệu, nhóm sử dụng cơ chế **Khóa bi quan (Pessimistic Locking / SELECT FOR UPDATE)** hoặc **Khóa lạc quan (Optimistic Locking với trường version)** trên bản ghi ca trực. Giao dịch đầu tiên thực hiện thành công sẽ đẩy trạng thái ca trực sang `Đã khóa`. Giao dịch thứ hai đến sau sẽ bị từ chối với thông báo: *"Ca trực này đã được khóa sổ bởi Thu ngân A vào lúc XX:YY, vui lòng không thao tác lại."*

#### Câu 30: "Nếu phòng khám mất điện đột ngột trong khi Bác sĩ đang gõ dở bệnh án thì dữ liệu có bị mất không?"
- **Trả lời:** Hệ thống có cơ chế **Auto-save định kỳ mỗi 30 giây** vào bộ nhớ đệm cục bộ `LocalStorage / IndexedDB` của trình duyệt. Khi máy tính có điện trở lại và bác sĩ mở lại ca bệnh đó, hệ thống sẽ phát hiện bản nháp tự động lưu và hỏi bác sĩ có muốn khôi phục nội dung đang nhập dở hay không.

#### Câu 31: "Tại sao trên màn hình Tiếp đón lại có cả trường 'Người giới thiệu' và 'Hoa hồng'?"
- **Trả lời:** Trong thực tế vận hành phòng khám tư nhân tại Việt Nam, đây là nghiệp vụ phổ biến: Nhiều phòng khám hợp tác với các bác sĩ tuyến huyện, trạm y tế xã hoặc cộng tác viên để chuyển tuyến bệnh nhân lên khám các dịch vụ kỹ thuật cao (như Chụp MRI, CT-Scanner). Việc ghi nhận nguồn người giới thiệu giúp phòng khám tính toán chính xác hoa hồng đối soát cuối tháng cho đối tác một cách minh bạch.

#### Câu 32: "Hệ thống của nhóm đã hỗ trợ BHYT (Bảo hiểm Y tế) chưa?"
- **Trả lời:** Về mặt mô hình dữ liệu, hệ thống đã thiết kế sẵn các trường: `Số thẻ BHYT`, `Nơi ĐKKCB ban đầu`, `Tỷ lệ hưởng BHYT (80%, 95%, 100%)` và cấu trúc mã dịch vụ kỹ thuật tương thích với danh mục dùng chung của Bộ Y tế. Trong giai đoạn hiện tại, nhóm ưu tiên hoàn thiện 100% Cổng Đơn thuốc Quốc gia và Sổ Sức Khỏe VNeID, sẵn sàng kết nối cổng giám định BHYT theo chuẩn XML 4210 khi phòng khám ký hợp đồng với cơ quan BHXH.

#### Câu 33: "Một phòng khám tư nhân quy mô vừa (10 bác sĩ, 5 phòng khám) muốn triển khai hệ thống này thì chi phí phần cứng và hạ tầng tốn khoảng bao nhiêu?"
- **Trả lời:** Rất tiết kiệm. Vì Clinic-AI được xây dựng trên nền tảng Web hiện đại (React + API nhẹ), phòng khám chỉ cần:
  - Máy chủ nội bộ (Mini PC hoặc Server ảo hóa thuê Cloud chi phí khoảng 1 – 2 triệu VNĐ/tháng).
  - Các máy trạm PC văn phòng bình thường sẵn có của Lễ tân, Bác sĩ (chỉ cần chạy được trình duyệt Chrome/Edge).
  - USB PKI Token ký số của các nhà mạng (VNPT, Viettel, FPT) chi phí khoảng vài trăm nghìn đồng/năm.
  - Tổng chi phí hạ tầng ban đầu gần như bằng 0 nếu phòng khám đã có máy tính sẵn.

#### Câu 34: "Nếu Bác sĩ muốn xóa hẳn một ca khám trong quá khứ vì người nhà bệnh nhân yêu cầu giấu bệnh án thì hệ thống có cho phép không?"
- **Trả lời:**
  > *"Dạ thưa Thầy Cô, câu trả lời là **TUYỆT ĐỐI KHÔNG**.  
  > Theo Điều 59 Luật Khám bệnh, chữa bệnh 2023, hồ sơ bệnh án nội trú và ngoại trú phải được lưu trữ bắt buộc tối thiểu từ 10 đến 20 năm. Việc tự ý xóa hồ sơ bệnh án là hành vi vi phạm pháp luật hình sự. Phần mềm của chúng em không cung cấp bất kỳ nút 'Xóa vĩnh viễn' nào đối với bệnh án đã hoàn thành. Mọi hành vi cố tình can thiệp đều được ghi vào Audit Log để điều tra."*

#### Câu 35: "Điểm yếu lớn nhất hiện tại của hệ thống này là gì và nhóm dự định khắc phục thế nào?"
- **Trả lời (Thể hiện sự khiêm tốn và tầm nhìn kỹ thuật):**
  > *"Dạ thưa Hội đồng, điểm mà nhóm em muốn tiếp tục nâng cấp nhất là việc kết nối trực tiếp hai chiều với các máy xét nghiệm tự động (chuẩn giao thức HL7 / ASTM qua cổng COM RS-232). Hiện tại kết quả CLS vẫn đang được Kỹ thuật viên nhập số liệu và đính kèm file PDF/ảnh. Trong giai đoạn tiếp theo, nhóm em sẽ xây dựng module LIS Service để máy xét nghiệm tự bắn kết quả vào cơ sở dữ liệu phòng khám mà không cần thao tác tay của con người."*

#### Câu 36: "Lời khuyên then chốt cho nhóm khi trả lời câu hỏi của Hội đồng là gì?"
- **Trả lời (Ghi nhớ cho cả nhóm):**
  - **Luôn bình tĩnh, lắng nghe hết câu hỏi của Giảng viên rồi mới trả lời.**
  - **Luôn viện dẫn căn cứ pháp lý (Luật KCB 15/2023, TT 26/2025, TT 13/2025, TT 32/2023) làm điểm tựa.**
  - **Nhấn mạnh: AI là công cụ hỗ trợ phân luồng an toàn, không chẩn đoán thay bác sĩ.**
  - **Tự tin vào những gì nhóm đã tự tay nghiên cứu và xây dựng!**
