# Feature Specification: Chuẩn hóa Giao diện Quản trị (Admin Portal), Tinh gọn UX & Tích hợp Liên thông Dữ liệu CSDL

**Feature Branch**: `002-standardize-admin-ui`

**Created**: 2026-11-11

**Status**: Draft (Speckit-Specify Baseline)

**Input**: User description: "tôi đang muốn chuẩn hoá lại giao diện admin cho tối giản và dễ dùng hơn, tôi muốn giao diện phải đáp ứng những điều kiện đầu tiên là những gì đã có rồi thì phải dropdown xuốn được dữ liệu, tiếp đó là dữ liệu phải liên thông, tôi nhập ở admin thì sẽ hiện ở các bên khác có liên quan. Tiếp đó giao diện phân việc giờ đang quá là rối rắm tôi muốn tham giao các giao diện phân lịch ở bên khác ví dụ như openmrs để thiết kế lại giao diện phân lịch cho tốt hơn dễ dùng hơn tối giản hơn. Tôi yêu cầu giao diện của trang admin sau khi được thết kế lại thì phải tối giản, dễ sử dụng, dễ nhận thấy, không bị sắp xếp bố cục lung tung các nút chức năng các biểu tượng không cần thiết, không có chức năng gì thì hay nút bấm vô dụng thì hãy giảm tải đi, còn các chức năng backend thì hoạt động tốt kết nối tối, dữ liệu được thông suốt và được ghi và lưu trứ lấy từ csdl không phải mock data"

---

## 1. Executive Summary & Mục tiêu

Mục tiêu của tính năng là tái cơ cấu và chuẩn hóa toàn diện giao diện Quản trị viên (Admin Portal) của hệ thống phòng khám Clinic-AI theo nguyên lý thiết kế y tế hiện đại (tham chiếu OpenMRS Provider & Shift Scheduling và Carbon/Ant Design Healthcare Pattern):

1. **Tối giản & Tinh gọn (Minimalist & Decluttered UX)**:
   - Loại bỏ triệt để các nút bấm trang trí vô dụng, các icon không mang ý nghĩa nghiệp vụ và các huy hiệu (badge) lòe loẹt gây rối mắt.
   - Sắp xếp bố cục theo phân cấp thị giác rõ ràng (Visual Hierarchy), tập trung vào dữ liệu và hành động cốt lõi của người quản trị.
2. **Dữ liệu Dropdown động từ CSDL thật (Real Relational Selects & Dynamic Dropdowns)**:
   - Tất cả các trường lựa chọn (Chuyên khoa, Buồng khám, Bác sĩ, Dịch vụ kỹ thuật, Thuốc kê đơn, Đơn vị tính, Vai trò RBAC) phải truy xuất trực tiếp từ các bảng quan hệ PostgreSQL qua API backend.
   - Tuyệt đối không sử dụng mock data tĩnh, danh sách hardcode trong mã nguồn frontend.
3. **Liên thông dữ liệu đa phân hệ tức thời (Cross-Portal Real-time Synchronization)**:
   - Dữ liệu thêm/sửa/xóa tại Admin Portal (ví dụ: tạo buồng khám mới, cập nhật giá dịch vụ, thêm bác sĩ, phân ca trực mới) phải lập tức có hiệu lực và hiển thị thông suốt trên các phân hệ liên quan: Cổng Lễ tân (`/reception`), Cổng Bác sĩ (`/doctor`), Cổng Đặt lịch Bệnh nhân (`/dat-lich`) và Cổng Nhân viên (`/staff`).
4. **Thiết kế lại Giao diện Phân lịch Bác sĩ theo chuẩn OpenMRS (Redesigned Doctor Shift Scheduling)**:
   - Tinh gọn ma trận ca trực theo tuần: Cột (Thứ 2 đến Chủ nhật), Hàng (Danh sách Bác sĩ nhóm theo Chuyên khoa).
   - Thao tác 1 chạm phân ca nhanh (Quick Shift Assignment), phát hiện và cảnh báo xung đột buồng khám / bác sĩ ngay tại ô lịch (Inline Conflict Warning).
   - Chỉ giữ lại các chức năng nghiệp vụ thiết yếu: Xếp ca trực, Kế thừa tuần trước, Sao chép tuần sau, và Xuất bảng lịch OpenXML (.xlsx).

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Dữ liệu Dropdown chuẩn hóa từ CSDL PostgreSQL (Priority: P1)

Là một Quản trị viên phòng khám, tôi muốn khi mở bất kỳ biểu mẫu nào (Phân lịch ca trực, Quản lý buồng khám, Quản lý bác sĩ, Thêm dịch vụ khám) thì các ô chọn (dropdown/select) đều tự động hiển thị dữ liệu mới nhất được lưu trong cơ sở dữ liệu thật, để tôi không phải nhập tay hoặc bị lỗi dữ liệu không đồng nhất.

**Why this priority**: Đây là điều kiện nền tảng để đảm bảo tính toàn vẹn dữ liệu hệ thống HIS. Nếu dropdown dùng dữ liệu giả lập (mock data) hoặc hardcode tĩnh, toàn bộ thao tác phía sau sẽ gây lỗi khóa ngoại và phân ca sai người/sai phòng.

**Independent Test**: Có thể kiểm tra độc lập bằng cách thêm một buồng khám mới "P105 - Phòng Khám Tim Mạch" ở màn hình Danh mục Khoa phòng, sau đó sang màn hình Phân lịch ca trực mở dropdown Buồng khám: "P105" phải lập tức xuất hiện trong danh sách lựa chọn.

**Acceptance Scenarios**:
1. **Given** Quản trị viên đang ở màn hình Phân lịch trực (`/admin/phan-lich`), **When** bấm vào nút "Phân ca" hoặc bấm vào ô lịch trống, **Then** dropdown Bác sĩ hiển thị đầy đủ danh sách bác sĩ lấy từ bảng `bac_si` liên kết `nguoi_dung`, dropdown Buồng khám hiển thị danh sách phòng lấy từ bảng `phong_kham`, và dropdown Chuyên khoa lấy từ bảng `chuyen_khoa`.
2. **Given** Quản trị viên chọn một Chuyên khoa (ví dụ: Khoa Nội tổng quát), **When** bấm mở dropdown Buồng khám hoặc Bác sĩ, **Then** danh sách buồng khám và bác sĩ tự động lọc đúng theo chuyên khoa đó dựa trên dữ liệu CSDL.
3. **Given** Bác sĩ hoặc Buồng khám bị tắt trạng thái hoạt động (`is_active = false`), **When** mở dropdown tạo ca trực mới, **Then** hệ thống không hiển thị các bản ghi bị vô hiệu hóa để tránh phân công sai.

---

### User Story 2 - Liên thông Dữ liệu Đa Phân hệ Hai Chiều (Priority: P1)

Là một người dùng hệ thống (Admin, Lễ tân, Bác sĩ, Bệnh nhân), tôi muốn khi Admin thay đổi hoặc cập nhật bất kỳ dữ liệu nào (buồng khám, bác sĩ, lịch trực, giá dịch vụ), dữ liệu đó phải phản ánh lập tức tại các phân hệ chuyên môn tương ứng mà không cần phải can thiệp thủ công vào cơ sở dữ liệu.

**Why this priority**: Đảm bảo luồng vận hành phòng khám xuyên suốt, thông tin từ ban quản trị lập tức đến được bàn làm việc của nhân viên tiếp đón và người bệnh.

**Independent Test**: Admin xếp ca trực Sáng cho Bác sĩ Phạm Đức Minh tại Phòng 101 vào ngày mai -> Mở Cổng Đặt lịch Bệnh nhân (`/dat-lich`), chọn chuyên khoa Nội: xuất hiện ngay khung giờ hẹn của BS Minh; mở Cổng Lễ tân (`/reception/schedule`): ô lịch hiển thị ca trực tại Phòng 101.

**Acceptance Scenarios**:
1. **Given** Admin thêm ca trực cho bác sĩ tại `/admin/phan-lich`, **When** lưu thành công vào PostgreSQL, **Then** Cổng Bệnh nhân (`/dat-lich`) tự động tải được slot khám khả dụng của bác sĩ đó qua API `/api/v1/appointments/available-slots`.
2. **Given** Admin phê duyệt đơn nghỉ phép của bác sĩ tại `/admin/nghi-phep`, **When** trạng thái chuyển sang ĐÃ DUYỆT, **Then** ca trực tương ứng bị khóa, Cổng Lễ tân (`/reception/schedule`) hiện cảnh báo bác sĩ nghỉ đột xuất, và Cổng Bệnh nhân không cho phép đặt vào các khung giờ đó.
3. **Given** Admin cập nhật giá dịch vụ hoặc danh mục buồng khám tại `/admin/danh-muc/...`, **When** lưu thành công, **Then** Cổng Lễ tân - Thu ngân (`/reception/cashier`) cập nhật ngay bảng giá niêm yết trong bảng kê viện phí.

---

### User Story 3 - Tái thiết kế Giao diện Phân lịch Bác sĩ Tối giản theo chuẩn OpenMRS (Priority: P2)

Là một Quản trị viên, tôi muốn giao diện Phân lịch trực được thiết kế lại tối giản, rõ ràng, trực quan theo chuẩn OpenMRS Provider Management, để tôi có thể dễ dàng bao quát lịch trực tuần của toàn viện, phân công nhanh và xử lý xung đột trong vài giây mà không bị rối mắt bởi quá nhiều nút bấm vô dụng.

**Why this priority**: Giao diện phân lịch hiện tại bị người dùng phản hồi là quá rườm rà, nhồi nhét nhiều badge, nhiều nút chức năng phụ và modal phức tạp khiến thao tác mất thời gian.

**Independent Test**: Kiểm tra bằng việc thực hiện phân công ca trực cho 5 bác sĩ trong 1 tuần: người dùng chỉ cần thao tác trực tiếp trên lưới tuần với số lần click giảm ít nhất 50%, giao diện hiển thị gọn gàng, không có icon thừa.

**Acceptance Scenarios**:
1. **Given** Quản trị viên mở `/admin/phan-lich`, **Then** giao diện hiển thị bảng điều khiển tuần tinh gọn:
   - Bộ chọn khoảng thời gian tuần (Thứ 2 đến Chủ nhật) kèm nút điều hướng Tuần trước / Tuần này / Tuần sau.
   - Bộ lọc tìm kiếm nhanh: Tìm bác sĩ (text input), lọc theo Chuyên khoa (select), checkbox "Chỉ xem ca có xung đột".
   - 3 nút hành động chính: "Phân ca mới", "Sao chép tuần sau", "Xuất Excel". Loại bỏ hoàn toàn các nút bấm trang trí hoặc vô dụng.
2. **Given** Quản trị viên bấm vào ô ca trực trên ma trận, **When** mở cửa sổ phân công (Quick Assign Drawer/Modal), **Then** giao diện chỉ chứa đúng 4 trường thông tin: Bác sĩ, Buồng khám, Ca trực (Sáng/Chiều), Số slot khám.
3. **Given** Hệ thống phát hiện bác sĩ bị trùng giờ khám hoặc buồng khám bị 2 bác sĩ cùng sử dụng, **When** hiển thị trên ma trận, **Then** ô lịch đổi sang viền cảnh báo nổi bật kèm tooltip giải thích ngắn gọn, không che khuất các thông tin khác.

---

### User Story 4 - Tinh giản & Dọn dẹp Toàn bộ Bố cục Admin Portal (Priority: P3)

Là một Quản trị viên phòng khám, tôi muốn thanh menu Sidebar, Header và các trang quản trị được dọn dẹp sạch sẽ, bố cục gọn gàng, các nút bấm đều có chức năng thực tế và phản hồi chính xác, không còn nút bấm "chết" hay giao diện thừa thãi.

**Why this priority**: Nâng cao trải nghiệm người dùng chuyên nghiệp (UX), giảm tải nhận thức (Cognitive load), đảm bảo tiêu chuẩn sản phẩm y tế sẵn sàng triển khai thực tế.

**Independent Test**: Rà soát toàn bộ các trang Admin (`Dashboard`, `Danh mục`, `Nhân sự`, `Phân lịch`, `Tuân thủ`): kiểm tra 100% nút bấm đều kích hoạt một action API hoặc modal có ý nghĩa, không có nút bấm vô dụng.

**Acceptance Scenarios**:
1. **Given** Quản trị viên duyệt qua thanh menu Sidebar, **Then** danh mục được nhóm thành 4 khối chức năng logic rõ ràng, nhãn ngắn gọn, không có menu con trống hoặc trùng lặp.
2. **Given** Quản trị viên thao tác trên bảng biểu, **Then** bảng dữ liệu sử dụng bảng màu dịu mắt (Clean Slate/Teal), các nút hành động (Sửa, Xóa, Phân công) nằm gọn trong cột Thao tác cuối dòng.

---

## 3. Edge Cases & Xử lý biên

- **Bác sĩ hết hạn Chứng chỉ hành nghề (CCHN)**: Khi Admin phân lịch cho bác sĩ có CCHN hết hạn (`trang_thai_cchn !== 'ACTIVE'`), hệ thống hiển thị cảnh báo đỏ và chặn không cho tạo ca trực theo quy định Luật Khám bệnh, chữa bệnh 2023.
- **Xung đột phân ca đồng thời**: Nếu 2 quản trị viên cùng xếp 2 bác sĩ vào 1 buồng khám trong cùng 1 ca, backend trả về lỗi xung đột `409 Conflict` kèm thông báo buồng khám đã có người đăng ký, frontend hiển thị thông báo lỗi thân thiện.
- **Mất kết nối mạng / Server tạm thời không phản hồi**: Frontend hiển thị thông báo lỗi kết nối kèm nút "Thử lại", tuyệt đối không tự động sinh dữ liệu giả lập (mock fallback) gây nhầm lẫn là đã lưu thành công.
- **Buồng khám hoặc Bác sĩ có lịch trực nhưng bị chuyển sang Inactive**: Các ca trực trong quá khứ vẫn giữ nguyên tên và mã buồng khám để phục vụ đối soát, nhưng các ca trực tương lai sẽ được hệ thống gắn nhãn cảnh báo cần điều phối lại.

---

## 4. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống BẮT BUỘC nạp 100% danh mục chọn (Chuyên khoa, Khoa phòng, Buồng khám, Bác sĩ, Dịch vụ, Thuốc) từ cơ sở dữ liệu quan hệ PostgreSQL thông qua API backend, không sử dụng mảng tĩnh trong FE.
- **FR-002**: Khi một bản ghi danh mục được thêm mới hoặc chỉnh sửa tại Admin Portal, API backend BẮT BUỘC cập nhật ngay vào PostgreSQL và trả dữ liệu mới nhất cho các truy vấn kế tiếp.
- **FR-003**: Cổng Đặt lịch Bệnh nhân (`/dat-lich`) BẮT BUỘC chỉ hiển thị các ca trực và slot khám được lập bởi Admin trong bảng `lich_lam_viec`.
- **FR-004**: Cổng Lễ tân (`/reception`) BẮT BUỘC hiển thị đúng lịch trực bác sĩ và buồng khám đã phân công từ Admin, tự động nhận diện bác sĩ nghỉ phép để điều chuyển hàng đợi.
- **FR-005**: Giao diện Phân lịch bác sĩ BẮT BUỘC cung cấp chế độ xem ma trận tuần trực quan: Thứ 2 đến Chủ nhật, phân biệt rõ ràng Ca Sáng và Ca Chiều.
- **FR-006**: Hệ thống BẮT BUỘC phát hiện tự động 2 loại xung đột: (a) Bác sĩ bị xếp trùng ca trong cùng một ngày/giờ; (b) Buồng khám bị xếp trùng cho nhiều bác sĩ trong cùng một ca.
- **FR-007**: Màn hình phân lịch BẮT BUỘC cung cấp tính năng "Sao chép tuần sau" và "Kế thừa tuần trước" để giảm thiểu thời gian nhập liệu định kỳ.
- **FR-008**: Mọi nút bấm trên giao diện Admin BẮT BUỘC phải liên kết với một hành động nghiệp vụ thực tế; LOẠI BỎ toàn bộ các nút bấm giả lập, các nút placeholder không có logic xử lý.
- **FR-009**: Hệ thống BẮT BUỘC hỗ trợ xuất báo cáo lịch trực tuần ra định dạng bảng tính OpenXML (.xlsx) chuẩn phòng khám.
- **FR-010**: Bảng màu và thiết kế giao diện BẮT BUỘC tuân thủ tiêu chuẩn Minimalist Healthcare: nền sáng `#F4F8FB`, điểm nhấn thương hiệu `#003553` và `#00B5F1`, tương phản rõ ràng, khoảng đệm chuẩn, không lạm dụng icon trang trí.
- **FR-011**: Tuyệt đối TUÂN THỦ quy tắc KHÔNG COMMENT TRONG CODE trong toàn bộ mã nguồn viết mới hoặc chỉnh sửa.
- **FR-012**: Toàn bộ các bài kiểm thử hồi quy (Regression Test Guard) BẮT BUỘC phải đạt tỷ lệ 100% Passed trước khi bàn giao.

---

### Key Entities

- **ChuyenKhoa**: Đại diện cho chuyên khoa y tế (Nội, Ngoại, Tai Mũi Họng, Răng Hàm Mặt, Mắt...). Khóa chính `id`, mã `ma`, tên `ten`.
- **PhongKham**: Buồng khám vật lý và phòng kỹ thuật. Khóa chính `id`, mã phòng `ma_phong`, tên phòng `ten_phong`, liên kết ngoại `chuyen_khoa_id`.
- **BacSi**: Hồ sơ bác sĩ chuyên môn. Khóa chính `id`, liên kết ngoại `nguoi_dung_id`, `chuyen_khoa_id`, `phong_kham_id`, số chứng chỉ CCHN, trạng thái hành nghề.
- **LichLamViec (Shift)**: Ca làm việc của bác sĩ. Khóa chính `id`, `bac_si_id`, `phong_kham_id`, `ngay_lam_viec`, `ca_lam_viec` (SANG/CHIEU), `gio_bat_dau`, `gio_ket_thuc`, `so_luong_kham_toi_da`, `slot_online`, `slot_offline`.
- **NghiPhep**: Đơn xin nghỉ phép và điều phối ca trực. Khóa chính `id`, `bac_si_id`, `tu_ngay`, `den_ngay`, `ca_nghi`, `trang_thai` (CHO_DUYET, DA_DUYET, TU_CHOI).

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các dropdown chọn chuyên khoa, buồng khám, bác sĩ, dịch vụ tại Admin Portal nạp dữ liệu động từ PostgreSQL API.
- **SC-002**: 0 trường hợp sử dụng mock data tĩnh cho dữ liệu danh mục y tế trong luồng vận hành chính.
- **SC-003**: Dữ liệu tạo mới từ Admin hiển thị đồng bộ trên Cổng Lễ tân và Cổng Đặt lịch bệnh nhân trong thời gian thực (độ trễ API < 500ms).
- **SC-004**: Giảm ít nhất 40% số lượng nút bấm không cần thiết và thành phần thị giác thừa trên màn hình Phân lịch trực.
- **SC-005**: Thời gian thao tác xếp ca cho 1 bác sĩ trong tuần giảm từ > 1 phút xuống dưới 15 giây.
- **SC-006**: 100% các bài test tự động FE (71/71) và BE (67/67) đều vượt qua.

---

## 6. Assumptions

- Phòng khám hoạt động định kỳ theo 2 ca chính: Ca Sáng (07:30 - 11:30) và Ca Chiều (13:30 - 17:00).
- Hệ thống PostgreSQL 15 và FastAPI Backend đã có sẵn các bảng quan hệ và endpoints chuẩn cho `shifts`, `rooms`, `doctors`, `departments`.
- Người dùng quản trị thao tác trên trình duyệt màn hình máy tính để bàn (Desktop / Laptop) với độ phân giải tối thiểu 1280x720.
