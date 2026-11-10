Feature Specification: Phân hệ Quản trị viên (Admin Portal) – Clinic-AI
Feature Branch: 001-admin-portal-tclinic
Created: 2026-11-10
Status: Draft – cần review trước khi lập Plan
Input: Chuẩn hóa phân hệ Admin Portal của Clinic-AI, tham chiếu quy trình và thuật ngữ nghiệp vụ TClinic (demo.tclinic.io), khắc phục route lỗi, dữ liệu không nhất quán và phân định rõ trách nhiệm giữa Admin với các workspace nghiệp vụ.
1. Executive Summary & Objective
Admin Portal là phân hệ dành cho người có trách nhiệm quản trị hệ thống phòng khám. Phạm vi của Admin tập trung vào:
1. Dashboard, báo cáo tổng hợp và giám sát Audit Trail.
2. Quản lý danh mục y tế, bảng giá và cấu hình hệ thống.
3. Quản lý nhân sự, tài khoản, vai trò, quyền chi tiết và cấu hình lịch làm việc ở mức quản trị.
4. Theo dõi và quản trị cấu hình/tình trạng tích hợp đơn thuốc điện tử với hệ thống quốc gia.
5. Truy cập một số dữ liệu vận hành cần thiết phục vụ quản trị, theo nguyên tắc quyền tối thiểu.
6. Quản lý điều hướng, menu và cấu trúc truy cập của Admin Portal.
Admin Portal không phải workspace thực hiện nghiệp vụ chuyên môn hoặc vận hành tuyến đầu. Các nghiệp vụ tiếp đón, đặt lịch, khám bệnh, cận lâm sàng, kê đơn, thu ngân và hoàn tiền vẫn thuộc phạm vi toàn hệ thống Clinic-AI nhưng được thực hiện trong workspace và theo quyền của các vai trò tương ứng; chúng không được đưa thành chức năng thao tác trực tiếp của Admin chỉ vì dữ liệu của chúng xuất hiện trong báo cáo.

Mục tiêu kỹ thuật là bảo đảm các màn hình Admin sử dụng dữ liệu nghiệp vụ nhất quán từ cơ sở dữ liệu quan hệ PostgreSQL qua API; kho JSON he_thong_trang_thai_bff chỉ được giữ cho cấu hình giao diện động đã được xác nhận, không làm nguồn dữ liệu nghiệp vụ song song.

TClinic là nguồn tham chiếu về luồng nghiệp vụ, tên trường và cách tổ chức chức năng; không phải mục tiêu sao chép giao diện. Khi có khác biệt, quy định pháp luật chính thức và phạm vi đã được chủ dự án phê duyệt là căn cứ quyết định.
2. Scope & Out of Scope
2.1 In Scope – thuộc Admin Portal
- Dashboard và báo cáo tổng hợp phục vụ quản trị.
- Audit Trail và giám sát truy cập dữ liệu được bảo vệ.
- Danh mục chuyên khoa, phòng khám/buồng khám, dịch vụ, bảng giá, thuốc, ICD-10 và biểu mẫu/cấu hình liên quan.
- Quản lý tài khoản, hồ sơ nhân sự, thông tin chuyên môn và trạng thái chứng chỉ hành nghề trong phạm vi được phép.
- Quản lý vai trò (Role), quyền chi tiết (Permission), phân công quyền và thu hồi quyền.
- Quản lý toàn diện lịch làm việc cụ thể của bác sĩ: tạo, sửa, phân công bác sĩ vào ca/khung giờ/phòng khám và điều chỉnh lịch; phát hiện xung đột. Đây là lịch làm việc nhân sự, không phải lịch hẹn khám của bệnh nhân.
- Theo dõi trạng thái tích hợp, cấu hình kết nối và nhật ký đồng bộ đơn thuốc điện tử trong phạm vi được cấp quyền.
- Xem một số dữ liệu vận hành tối thiểu để giám sát và lập báo cáo.
- Kiểm kê, tinh gọn menu, route và component của riêng Admin Portal.
2.2 Out of Scope – không thuộc Admin Portal
Các chức năng dưới đây vẫn có thể thuộc sản phẩm Clinic-AI, nhưng không thuộc phạm vi thao tác của Admin Portal:
- Tiếp nhận bệnh nhân, đăng ký khám và xử lý hàng đợi tại quầy.
- Tạo/sửa lịch hẹn như một nghiệp vụ tiếp đón tuyến đầu.
- Khám lâm sàng, nhập chẩn đoán, kê đơn và ký hồ sơ bệnh án.
- Thực hiện xét nghiệm/cận lâm sàng, nhập hoặc ký kết quả.
- Lập hóa đơn, thu tiền, thanh toán VietQR, hoàn tiền và khóa sổ ca thu ngân.
- Thực hiện liệu trình điều trị hoặc khám sức khỏe đoàn.
- Giám định và quyết toán Bảo hiểm Y tế (BHYT) trong giai đoạn hiện tại.
Admin có thể xem số liệu tổng hợp hoặc metadata vận hành cần thiết theo quyền được cấp, nhưng không vì thế mà được thực hiện các nghiệp vụ trên.
2.3 Nguyên tắc tham chiếu
- Tham chiếu TClinic về quy trình, trường dữ liệu và trạng thái nghiệp vụ; không sao chép UI một cách máy móc.
- Không triển khai quyết toán BHYT trong phạm vi hiện tại.
- Các yêu cầu pháp lý về dữ liệu y tế, hồ sơ bệnh án và đơn thuốc phải được đối chiếu với văn bản chính thức còn hiệu lực trước khi triển khai.
- Không suy diễn API, giao thức hay cơ chế xác thực của hệ thống đơn thuốc quốc gia nếu chưa có tài liệu tích hợp chính thức.
3. Clarifications & Decisions
Session 2026-11-10
1. Kho JSON trung gian: Chuyển các màn hình Admin sử dụng dữ liệu nghiệp vụ sang API và bảng quan hệ PostgreSQL. Kho he_thong_trang_thai_bff chỉ lưu cấu hình giao diện động đã được xác định, ví dụ menu tùy biến và template in tùy biến. Không xóa dữ liệu JSON cũ trước khi kiểm kê, sao lưu, đối chiếu, di trú và kiểm thử.
2. Seed data: Cung cấp CLI độc lập scripts/seed_admin_demo.py, hỗ trợ --reset và --append. Script phải idempotent; --reset chỉ được chạy trên DB dev/test được xác định rõ; bảo toàn tài khoản người dùng hiện có; giữ toàn vẹn khóa ngoại; chỉ dùng dữ liệu tổng hợp giả lập; --append chống trùng lặp.
3. Tham chiếu TClinic: Áp dụng quy trình nghiệp vụ và ý nghĩa trường dữ liệu phù hợp; không sao chép giao diện; loại trừ quyết toán BHYT; yêu cầu pháp lý phải được kiểm chứng từ văn bản chính thức.
4. Dead routes và menu: Thực hiện audit toàn bộ menu; phân loại Giữ / Hợp nhất / Sửa / Xóa / Chuyển sang workspace khác / Hoãn. Chỉ khôi phục route được duyệt giữ; chỉ xóa code sau khi kiểm tra dependency và tác động.
5. Phạm vi Admin: Chọn mô hình Admin thuần quản trị. Tiếp nhận, thu ngân, khám lâm sàng và CLS thuộc workspace nghiệp vụ tương ứng, không thuộc Admin Portal.
6. Truy cập dữ liệu bệnh nhân: Admin được xem báo cáo và một số thông tin chi tiết cần thiết; không mặc định được xem toàn bộ hồ sơ bệnh án, chẩn đoán, nội dung đơn thuốc hoặc kết quả xét nghiệm.
7. Phân quyền: Chọn mô hình kết hợp Role và quyền chi tiết (Role-Based Access Control + Fine-Grained Permissions). Role cung cấp quyền mặc định; quyền chi tiết có thể được cấp/thu hồi riêng theo chính sách được phê duyệt.
8. Module hóa và kiểm soát xung đột PR:
   - Backend Admin được chia module theo nghiệp vụ quản trị: Dashboard/BI (admin_bi.py), Catalog (admin_catalog.py), Staff/RBAC/Scheduling (admin_staff.py), Integration (admin_integration.py) và Audit (admin_audit.py). Không tạo admin_cashier.py hoặc admin_clinical.py trong Admin Portal.
   - Frontend module hóa màn hình, sidebar và route registry theo phân hệ quản trị.
   - TV1 chịu trách nhiệm các tệp root/shared như root router, App.jsx và cấu hình điều hướng dùng chung.
   - Áp dụng CODEOWNERS và CI regression tests cho tệp quan trọng; xác minh test guard hiện có trong repository trước khi phụ thuộc vào nó.
   - Module hóa không loại bỏ hoàn toàn Git conflicts. Thành viên phải làm trên branch riêng từ develop mới nhất, chia PR nhỏ, review trước merge và rebase thường xuyên.
9. Permission precedence: Explicit Deny (quyền bị từ chối/thu hồi riêng) ưu tiên hơn Explicit Allow; Explicit Allow ưu tiên hơn quyền được kế thừa từ Role; nếu không có quyền hiệu lực thì mặc định từ chối (Deny by default).
10. Quản lý lịch bác sĩ: Admin được tạo, sửa, phân công và điều chỉnh lịch làm việc cụ thể của bác sĩ, gồm ca, khung giờ và phòng khám; phải phát hiện xung đột nhân sự/phòng/thời gian. Lịch làm việc của bác sĩ không đồng nhất với lịch hẹn khám của bệnh nhân; Admin không mặc nhiên được thao tác lịch hẹn tiếp đón.
11. Dữ liệu liên hệ bệnh nhân: Admin có thể xem số điện thoại và địa chỉ khi có permission phù hợp và mục đích vận hành hợp lệ. Việc xem phải được audit. Điều này không cấp quyền xem bệnh án, chẩn đoán chi tiết, nội dung đơn thuốc, kết quả CLS hoặc tiền sử bệnh.
12. Tích hợp đơn thuốc điện tử: Trước mắt thiết kế kiến trúc, adapter/interface, cấu hình, giám sát trạng thái, nhật ký, xử lý lỗi và retry/idempotency ở mức có thể kiểm chứng. Chỉ kết nối API thật sau khi xác minh tài liệu chính thức, cơ chế xác thực và môi trường sandbox/production. Trước thời điểm đó chỉ dùng mock hoặc dữ liệu giả lập; không tự suy diễn endpoint/schema chính thức.
13. Audit Log retention: Thời gian lưu trữ phải cấu hình được. Chưa ấn định số năm cho đến khi đối chiếu quy định pháp luật áp dụng. Không cho người dùng thông thường sửa/xóa log; cần xác định chính sách archive/backup và xử lý khi ghi audit thất bại.
14. Role quản trị cao nhất: ADMIN là Role quản trị cao nhất hiện tại; không sử dụng SUPER_ADMIN. Không cấp hoặc thu hồi Role ADMIN qua giao diện/API nghiệp vụ thông thường của Admin Portal. Khởi tạo và thay đổi quyền ADMIN phải qua quy trình kỹ thuật backend/bootstrap có kiểm soát, có audit và bảo vệ không để mất Admin cuối cùng.
15. Phạm vi CorporateHealthPage.jsx trong Admin Portal: Admin chỉ được quản trị danh mục gói khám sức khỏe doanh nghiệp, hợp đồng khám đoàn, cấu hình dịch vụ và bảng giá liên quan, và xem báo cáo tổng hợp hoạt động khám đoàn khi được cấp quyền. Admin không được tiếp nhận người đến khám, thực hiện quy trình khám lâm sàng, lập hồ sơ bệnh án đoàn, nhập kết quả xét nghiệm hoặc thực hiện bất kỳ nghiệp vụ khám sức khỏe tuyến đầu nào trong Admin Portal. TreatmentCoursePage.jsx cần được audit code thực tế trước khi xác định trang này thuộc Admin Portal hay phải chuyển sang workspace nghiệp vụ khác; không tự quyết định chuyển workspace khi chưa có kết quả audit.
4. User Scenarios & Testing
US-01 – Dashboard, BI & Audit Management (Priority: P1)
Là quản trị viên được cấp quyền giám sát, tôi muốn xem dashboard và báo cáo tổng hợp về hoạt động phòng khám, đồng thời tra cứu Audit Trail, để theo dõi tình hình vận hành và phát hiện các hành vi bất thường.

Why this priority: Dashboard và audit là nền tảng giám sát, hỗ trợ quản trị mà không cần Admin trực tiếp thực hiện nghiệp vụ tuyến đầu.

Independent Test: Đăng nhập bằng tài khoản Admin có quyền báo cáo; mở dashboard và trang báo cáo; lọc theo khoảng thời gian; đối chiếu tổng hợp với dữ liệu nguồn được phép; truy vấn Audit Trail.

Acceptance Scenarios:
1. Given cơ sở dữ liệu không có lượt khám hoặc hóa đơn trong khoảng thời gian được chọn, When Admin mở dashboard, Then hệ thống hiển thị số liệu bằng 0 hoặc trạng thái không có dữ liệu, không hiển thị số liệu giả và không phát sinh lỗi giao diện.
2. Given có dữ liệu nguồn trong khoảng thời gian được chọn, When Admin xem báo cáo doanh thu hoặc số lượt khám, Then số liệu phải được tính từ nguồn dữ liệu có thẩm quyền, có quy tắc tính và khoảng thời gian rõ ràng.
3. Given Admin có quyền xuất báo cáo, When Admin yêu cầu xuất Excel, Then tệp xuất phải phản ánh đúng bộ lọc và dữ liệu người dùng được phép xem.
4. Given có hành động thuộc diện phải kiểm toán, When người có quyền tra cứu Audit Trail, Then hệ thống hiển thị tối thiểu thời điểm, actor/user ID, vai trò hoặc quyền hiệu lực, hành động, đối tượng bị tác động và kết quả; không ghi nội dung nhạy cảm không cần thiết vào log.
5. Given Admin không có quyền xem một loại báo cáo, When Admin gọi API tương ứng, Then Backend từ chối truy cập kể cả khi người dùng tự nhập URL hoặc gọi API trực tiếp.
US-02 – Medical Catalog & System Configuration (Priority: P1)
Là quản trị viên được giao quản lý danh mục, tôi muốn quản lý danh mục y tế, bảng giá và cấu hình biểu mẫu để các workspace nghiệp vụ sử dụng dữ liệu gốc nhất quán.

Why this priority: Danh mục và cấu hình là dữ liệu nền cho các quy trình tiếp đón, khám, CLS, kê đơn và thanh toán.

Independent Test: Tạo hoặc cập nhật một mục danh mục được phép; kiểm tra API và workspace tiêu thụ dữ liệu; kiểm tra bản ghi nghiệp vụ cũ vẫn giữ đúng thông tin lịch sử.

Acceptance Scenarios:
1. Given một dịch vụ đã có bảng giá hiệu lực, When Admin tạo phiên bản giá mới với ngày hiệu lực, Then các nghiệp vụ phát sinh sau thời điểm hiệu lực sử dụng giá mới và chứng từ đã phát hành giữ nguyên giá lịch sử.
2. Given Admin cập nhật cấu hình biểu mẫu in, When workspace nghiệp vụ tạo bản in tiếp theo, Then bản in sử dụng cấu hình mới theo phiên bản/hiệu lực đã được áp dụng.
3. Given mã ICD-10 đã tồn tại, When Admin tạo một mục trùng mã trong cùng bộ danh mục/phiên bản, Then hệ thống từ chối và trả lỗi xác định, ví dụ HTTP 409 nếu phù hợp với quy ước API hiện tại.
4. Given Admin không có quyền quản lý danh mục thuốc, When Admin gửi yêu cầu ghi dữ liệu thuốc qua API, Then hệ thống từ chối thao tác.
5. Given một danh mục đã được tham chiếu bởi dữ liệu nghiệp vụ, When Admin muốn ngừng sử dụng mục đó, Then hệ thống ưu tiên cơ chế ngừng hiệu lực/soft delete phù hợp, không phá vỡ dữ liệu lịch sử.
US-03 – Staff, RBAC & Scheduling Management (Priority: P1)
Là quản trị viên nhân sự/hệ thống, tôi muốn quản lý tài khoản, hồ sơ nhân sự, vai trò, quyền chi tiết và lịch làm việc cụ thể của bác sĩ để bảo đảm người dùng được cấp đúng quyền và nguồn lực được bố trí hợp lệ.

Why this priority: Quản lý tài khoản và quyền là nền tảng bảo mật; thông tin nhân sự và điều kiện hành nghề ảnh hưởng đến việc phân công chuyên môn.

Independent Test: Tạo/cập nhật tài khoản theo quyền; gán role; cấp/thu hồi permission; thử gọi API bằng tài khoản có và không có quyền; kiểm tra xung đột lịch và điều kiện CCHN nếu nghiệp vụ phân công yêu cầu.

Acceptance Scenarios:
1. Given tài khoản được gán một Role, When hệ thống tính quyền hiệu lực, Then tài khoản nhận các quyền mặc định của Role và các quyền chi tiết được cấp hợp lệ.
2. Given người quản trị có thẩm quyền thay đổi quyền, When người đó cấp hoặc thu hồi một permission, Then thay đổi được lưu, có hiệu lực theo chính sách phiên/token của hệ thống và được ghi Audit Trail.
3. Given người dùng không có permission cần thiết, When người dùng gọi API bị giới hạn, Then Backend trả HTTP 403 theo định dạng lỗi chuẩn.
4. Given bác sĩ có CCHN hết hạn hoặc bị đình chỉ, When Admin thực hiện phân công lịch làm việc có liên quan đến hoạt động hành nghề, Then hệ thống cảnh báo và từ chối phân công nếu quy tắc nghiệp vụ/pháp lý yêu cầu.
5. Given Admin tạo hoặc điều chỉnh lịch làm việc bác sĩ, When lịch có xung đột về bác sĩ, phòng khám hoặc khoảng thời gian, Then hệ thống phát hiện và từ chối lưu theo quy tắc đã cấu hình.
6. Given Admin điều chỉnh lịch làm việc của bác sĩ, When thay đổi được lưu, Then hệ thống không tự động thay đổi lịch hẹn khám của bệnh nhân; việc điều phối lịch hẹn vẫn thuộc workspace nghiệp vụ tương ứng.
7. Given một tài khoản bị khóa hoặc thu hồi quyền, When tài khoản tiếp tục sử dụng phiên cũ, Then hệ thống áp dụng chính sách vô hiệu hóa phiên/token đã được xác định và không cho tiếp tục truy cập trái quyền.
US-04 – National E-Prescription Integration Management (Priority: P1)
Là quản trị viên được cấp quyền tích hợp, tôi muốn quản lý cấu hình và theo dõi trạng thái đồng bộ đơn thuốc điện tử, để phát hiện lỗi tích hợp và hỗ trợ xử lý sự cố mà không can thiệp trái phép vào nội dung chuyên môn của đơn thuốc.

Why this priority: Tích hợp đơn thuốc điện tử có yêu cầu tuân thủ và cần khả năng giám sát, truy vết lỗi.

Independent Test: Dùng môi trường tích hợp thử nghiệm hoặc mock được phê duyệt; xem trạng thái đồng bộ, mã tham chiếu, thời điểm gửi, phản hồi và lỗi; xác nhận quyền Admin không cho phép sửa nội dung đơn thuốc đã ký.

Acceptance Scenarios:
1. Given một đơn thuốc đã đến trạng thái đủ điều kiện gửi theo quy trình hiện hành, When hệ thống thực hiện đồng bộ, Then Admin có quyền tích hợp có thể xem trạng thái và mã tham chiếu của lần gửi.
2. Given một lần đồng bộ thất bại, When Admin xem chi tiết lỗi, Then hệ thống hiển thị thông tin kỹ thuật cần thiết, đã loại bỏ bí mật và dữ liệu cá nhân không cần thiết.
3. Given Admin có quyền vận hành tích hợp nhưng không có quyền chuyên môn, When Admin truy cập bản ghi đơn thuốc, Then Admin chỉ xem metadata/trạng thái được phép và không thể sửa, ký hoặc thay đổi nội dung đơn.
4. Given thao tác gửi lại được cho phép theo chính sách tích hợp, When Admin thực hiện retry, Then hệ thống phải chống gửi trùng hoặc bảo đảm idempotency theo cơ chế tích hợp đã xác định.
5. Given thông tin xác thực hoặc endpoint tích hợp cần thay đổi, When Admin có quyền cấu hình thực hiện thay đổi, Then bí mật phải được lưu theo cơ chế quản lý secret phù hợp và mọi thay đổi phải được audit.
US-05 – Administrative Operational Data Access (Priority: P2)
Là quản trị viên được cấp quyền giám sát, tôi muốn xem một số thông tin vận hành cần thiết của bệnh nhân và lượt khám để đối chiếu báo cáo, hỗ trợ điều phối và kiểm tra hoạt động, nhưng không mặc định truy cập nội dung hồ sơ bệnh án.

Why this priority: Admin cần dữ liệu đủ để giám sát hoạt động, nhưng phải tuân thủ nguyên tắc quyền tối thiểu và bảo vệ dữ liệu sức khỏe.

Independent Test: Cấp quyền xem thông tin định danh/liên hệ/vận hành cho tài khoản thử nghiệm; xác nhận chỉ các trường được cấp quyền xuất hiện; kiểm tra audit khi xem số điện thoại/địa chỉ; thử truy cập API clinical record bằng tài khoản không có quyền và xác nhận bị từ chối.

Acceptance Scenarios:
1. Given Admin có patient:read_basic, When Admin xem thông tin bệnh nhân, Then chỉ các trường định danh được phê duyệt như mã bệnh nhân và họ tên được hiển thị.
2. Given Admin có patient:read_operational, When Admin xem thông tin vận hành, Then hệ thống chỉ hiển thị metadata cần thiết như mã lượt khám, thời điểm, trạng thái, chuyên khoa/phòng và thông tin điều phối được phép.
3. Given Admin có permission xem thông tin liên hệ và mục đích truy cập hợp lệ, When Admin xem số điện thoại hoặc địa chỉ bệnh nhân, Then hệ thống hiển thị đúng trường được cấp quyền và ghi Audit Trail gồm actor, thời điểm, đối tượng, hành động và kết quả.
4. Given Admin chỉ có quyền xem dữ liệu cơ bản/vận hành, When Admin mở hồ sơ bệnh án, chẩn đoán chi tiết, nội dung đơn thuốc hoặc kết quả CLS, Then hệ thống từ chối hoặc không cung cấp các trường đó.
5. Given Admin có quyền xem báo cáo tài chính tổng hợp nhưng không có quyền xem chi tiết giao dịch, When Admin mở báo cáo, Then hệ thống chỉ hiển thị dữ liệu tổng hợp đã được phép.
6. Given Admin truy cập dữ liệu bệnh nhân thuộc diện bảo vệ, When hệ thống xử lý yêu cầu, Then hành động phải được ghi Audit Trail với thông tin actor, thời điểm, đối tượng, hành động và kết quả; không ghi tràn lan nội dung bệnh án vào log.
US-06 – Admin Navigation & Access Management (Priority: P2)
Là quản trị viên, tôi muốn có menu và route Admin được tổ chức theo nhóm chức năng thực sự thuộc phạm vi quản trị, để tìm đúng chức năng và không gặp trang lỗi hoặc menu dẫn đến nghiệp vụ của vai trò khác.

Why this priority: Điều hướng nhất quán giúp giảm lỗi sử dụng và ngăn việc đưa nhầm nghiệp vụ tuyến đầu vào Admin Portal.

Independent Test: Kiểm kê menu Admin; đối chiếu danh sách route được duyệt; kiểm tra route trực tiếp, refresh, deep link và quyền truy cập.

Acceptance Scenarios:
1. Given danh sách chức năng Admin đã được audit và phê duyệt, When người dùng mở sidebar, Then chỉ các chức năng thuộc phạm vi và được phép truy cập mới xuất hiện.
2. Given một route Admin hợp lệ có tab được chọn qua query parameter, When người dùng refresh hoặc chia sẻ URL, Then trang khôi phục đúng tab và trạng thái điều hướng.
3. Given một route thuộc workspace Lễ tân/Bác sĩ/KTV/Thu ngân, When Admin mở menu Admin, Then route đó không được hiển thị như một chức năng thao tác Admin.
4. Given một route/component bị đánh giá là không còn sử dụng, When đội dự án đề xuất xóa, Then dependency và tác động phải được kiểm tra trước khi xóa; các route dùng chung bởi workspace khác không bị xóa nhầm.
5. Functional Requirements
5.1 Unified Data Channel
- FR-001: Các màn hình Admin MUST đọc/ghi dữ liệu nghiệp vụ qua API và mô hình dữ liệu quan hệ PostgreSQL; không sử dụng he_thong_trang_thai_bff JSON làm nguồn dữ liệu nghiệp vụ song song.
- FR-002: he_thong_trang_thai_bff JSON MUST chỉ lưu cấu hình giao diện động được phê duyệt, ví dụ menu tùy biến và template in tùy biến.
- FR-003: Trước khi loại bỏ việc sử dụng dữ liệu nghiệp vụ trong JSON, đội dự án MUST kiểm kê, sao lưu, đối chiếu dữ liệu, lập kế hoạch migration và kiểm thử hồi quy. Không xóa dữ liệu cũ chỉ dựa trên việc đã chuyển code đọc/ghi.
- FR-004: Các API Admin MUST dùng SQLAlchemy Async và PostgreSQL theo kiến trúc hiện có; không tự ý thêm công nghệ hoặc dependency mới nếu chưa được chủ dự án phê duyệt.
5.2 Admin Scope Audit & Navigation
- FR-005: Hệ thống MUST kiểm kê toàn bộ mục menu và route Admin hiện có, bao gồm các mục trong clinicSeed.json, App.jsx và các cấu hình liên quan.
- FR-006: Mỗi mục được audit MUST được phân loại: Giữ, Hợp nhất, Sửa, Xóa, Chuyển sang workspace khác hoặc Hoãn; kèm lý do và tác động.
- FR-007: Chỉ route thuộc phạm vi Admin và đã được duyệt mới được hiển thị trong Admin navigation.
- FR-008: Route thuộc workspace tiếp đón, khám bệnh, CLS, thu ngân hoặc liệu trình MUST NOT được đưa vào Admin như chức năng thao tác tuyến đầu.
- FR-009: Việc xóa route/component MUST có kiểm tra dependency, kiểm tra workspace dùng chung và regression tests trước khi merge.
- FR-010: Các màn hình Admin sử dụng tab qua query parameter MUST đồng bộ hai chiều giữa URL và UI state khi chức năng đó được giữ lại.
5.3 Role-Based & Fine-Grained Authorization
- FR-011: Hệ thống MUST hỗ trợ phân quyền kết hợp Role và Permission chi tiết.
- FR-012: Role MUST xác định tập quyền mặc định; permission chi tiết MUST có thể được cấp hoặc thu hồi độc lập bởi tài khoản có thẩm quyền.
- FR-013: Hệ thống MUST tính quyền hiệu lực theo thứ tự: Explicit Deny > Explicit Allow > Role Grant > Default Deny; cùng một kết quả phải được áp dụng tại Backend API và các điểm kiểm soát liên quan.
- FR-014: Hệ thống MUST mặc định từ chối truy cập nếu tài khoản không có quyền cần thiết.
- FR-015: Hệ thống MUST tách quyền đọc khỏi quyền tạo, cập nhật, ký, xóa hoặc thực hiện hành động chuyên môn.
- FR-016: Ẩn menu/nút ở Frontend MUST NOT được xem là cơ chế bảo mật duy nhất; Backend MUST kiểm tra quyền trên từng API được bảo vệ.
- FR-017: Hệ thống MUST ghi Audit Trail đối với việc cấp, thu hồi, thay đổi Role/Permission và các hành động truy cập dữ liệu được bảo vệ.
- FR-018: ADMIN MUST là Role quản trị cao nhất hiện tại; hệ thống MUST NOT tạo hoặc sử dụng SUPER_ADMIN. Việc bootstrap/cấp/thu hồi Role ADMIN MUST thực hiện qua quy trình kỹ thuật backend có kiểm soát, không qua UI/API nghiệp vụ Admin Portal; phải audit và bảo vệ Admin cuối cùng.
5.4 Patient Operational Data Access
- FR-019: Admin MUST chỉ xem báo cáo tổng hợp và trường thông tin bệnh nhân/vận hành được cấp quyền rõ ràng.
- FR-020: Quyền xem thông tin định danh, thông tin liên hệ (số điện thoại/địa chỉ), thông tin vận hành, dữ liệu tài chính và metadata đồng bộ đơn thuốc MUST được kiểm soát riêng bằng permission phù hợp.
- FR-021: Admin không có quyền chuyên môn MUST NOT được xem hoặc sửa nội dung bệnh án, chẩn đoán chi tiết, nội dung đơn thuốc, kết quả CLS hoặc dữ liệu sức khỏe nhạy cảm ngoài phạm vi được phê duyệt.
- FR-022: API trả dữ liệu bệnh nhân MUST chỉ trả các trường được phép; không được dựa vào việc ẩn trường ở Frontend.
- FR-023: Audit log truy cập dữ liệu được bảo vệ MUST ghi actor, thời điểm, đối tượng, hành động và kết quả; hạn chế lưu nội dung sức khỏe hoặc bí mật không cần thiết.

**Bảng Ma trận Truy cập Dữ liệu Bệnh nhân (Patient Data-Access Matrix)**

| Nhóm dữ liệu | Trường dữ liệu cụ thể | Hình thức truy cập của Admin | Permission tương ứng | Role hệ thống được phép (Chức danh tham khảo) | Mục đích vận hành hợp lệ | Yêu cầu Audit Trail | Trạng thái phê duyệt |
|---|---|---|---|---|---|:---:|:---:|
| **Định danh cơ bản** | Mã bệnh nhân, họ tên | Xem trực tiếp danh sách / chi tiết hành chính | `patient:read_basic` | `ADMIN` (khi được cấp quyền), `RECEPTIONIST`, `RECEPTION_SUPERVISOR`, `DOCTOR` | Tìm kiếm hành chính, điều phối hoạt động chung phòng khám | Ghi log truy cập hệ thống chuẩn | Đã thống nhất |
| **Nhân khẩu – Năm sinh** | Năm sinh, giới tính | Xem trực tiếp danh sách / chi tiết | `patient:read_basic` | `ADMIN` (khi được cấp quyền), `RECEPTIONIST`, `RECEPTION_SUPERVISOR`, `DOCTOR` | Phân loại độ tuổi tổng quát, đối chiếu nhân khẩu học | Ghi log truy cập hệ thống chuẩn | Đã thống nhất |
| **Nhân khẩu – Ngày sinh đầy đủ** | Ngày, tháng, năm sinh đầy đủ (DD/MM/YYYY) | Chờ chủ dự án xác nhận (không mặc định đi kèm `patient:read_basic`) | Chờ chủ dự án xác nhận | `DOCTOR`, `RECEPTIONIST` (đối chiếu hồ sơ); `ADMIN`: Chờ xác nhận | `Chờ chủ dự án xác nhận` | Ghi log truy cập hệ thống chuẩn | **Chờ chủ dự án xác nhận** |
| **Liên hệ nhạy cảm** | Số điện thoại, địa chỉ cư trú | Xem trực tiếp có điều kiện (tuyệt đối không mặc định cấp cho mọi Admin) | `patient:read_contact` | `ADMIN` (khi được chỉ định riêng), `RECEPTIONIST`, `RECEPTION_SUPERVISOR` | Xử lý khiếu nại, liên hệ điều phối lịch bất thường | **Bắt buộc**: ghi actor, timestamp, patient ID, lý do | Đã thống nhất nguyên tắc; chờ duyệt quy chế cấp |
| **Định danh mức cao** | Số CCCD/Hộ chiếu | Chờ chủ dự án xác nhận | Chờ chủ dự án xác nhận | `Chờ chủ dự án xác nhận` | `Chờ chủ dự án xác nhận` | Bắt buộc (nếu được phép) | **Chờ chủ dự án xác nhận** |
| **Số thẻ BHYT (Đặc thù)** | Số thẻ BHYT (nếu có trong dữ liệu lịch sử) | Không thuộc phạm vi Admin Portal (Clinic-AI hiện không thanh toán BHYT) | Chờ chủ dự án xác nhận | `Chờ chủ dự án xác nhận` | Cần xác minh tính cần thiết nghiệp vụ và pháp lý; không xóa trường nếu đang tồn tại khi chưa audit tác động | Bắt buộc (nếu phát sinh truy cập) | **Chờ chủ dự án xác nhận / Cần audit** |
| **Vận hành lượt khám** | Mã lượt khám, ngày khám, trạng thái (chờ/đang khám/hoàn tất), khoa/buồng khám | Xem trực tiếp | `patient:read_operational` | `ADMIN`, `RECEPTIONIST`, `RECEPTION_SUPERVISOR`, `DOCTOR` | Giám sát lưu lượng phòng khám, điều phối tiến độ | Ghi log truy cập hệ thống chuẩn | Đã thống nhất |
| **Tài chính – Báo cáo tổng hợp** | Doanh thu theo ca/ngày/tháng, doanh thu theo chuyên khoa, doanh thu theo nhóm dịch vụ (không chứa định danh cá nhân) | Xem trực tiếp trên Dashboard BI và màn hình báo cáo tổng hợp | `finance:read_summary` | `ADMIN` (khi được cấp quyền báo cáo tài chính; chức danh Kế toán trưởng chỉ mang tính tham khảo) | Báo cáo tài chính quản trị, theo dõi doanh thu | Ghi log truy cập báo cáo tài chính | Đã thống nhất |
| **Tài chính – Giao dịch cá nhân** | Mã giao dịch, thời điểm thanh toán, phương thức (tiền mặt/VietQR), số tiền, trạng thái giao dịch | Không suy diễn quyền từ `finance:read_summary`; `ADMIN`: Chờ chủ dự án xác nhận | `finance:read_transaction` (Chờ xác nhận) | `CASHIER`; `ADMIN`: Chờ xác nhận | Đối soát luồng tiền ca trực, kiểm toán sai lệch | **Bắt buộc**: ghi actor, timestamp, mã giao dịch | **Chờ chủ dự án xác nhận** |
| **Tài chính – Biên lai & Thông tin cá nhân** | Tên người nộp, số tài khoản/ngân hàng người chuyển (VietQR log), chi tiết biên lai gắn định danh bệnh nhân | Chờ chủ dự án xác nhận (bảo vệ quyền riêng tư tài chính cá nhân) | `finance:read_receipt_detail` (Chờ xác nhận) | `CASHIER` (lập/in biên lai); `ADMIN`: Chờ xác nhận | Cung cấp chứng từ thanh toán theo yêu cầu bệnh nhân | **Bắt buộc** (nếu được cấp quyền) | **Chờ chủ dự án xác nhận** |
| **Lâm sàng – Hồ sơ cá nhân** | Chẩn đoán ICD chi tiết, triệu chứng, tiền sử bệnh, nội dung đơn thuốc, chỉ định & kết quả CLS từng cá nhân | **CẤM / Tuyệt đối không được phép** (Admin thuần quản trị không có thẩm quyền lâm sàng; không mở rộng quyền clinical cho `ADMIN`) | Permission lâm sàng riêng `clinical:read_record` (chỉ dành riêng Bác sĩ) | `DOCTOR` (Bác sĩ được phân công điều trị/hội chẩn; chức danh Trưởng khoa chỉ mang tính tham khảo) | Khám bệnh, chữa bệnh chuyên môn | Bắt buộc theo NĐ 102/2025/NĐ-CP & Luật Khám bệnh, chữa bệnh | Đã thống nhất (Cấm Admin) |
| **Lâm sàng – Thống kê tổng hợp** | Cơ cấu bệnh tật (tần suất ICD), số lượng chỉ định CLS, tỷ lệ sử dụng nhóm thuốc (dữ liệu ẩn danh) | Xem trực tiếp dưới dạng báo cáo thống kê tổng hợp với điều kiện ẩn danh hoàn toàn | `clinical:read_aggregate` (Chờ chủ dự án xác nhận phạm vi) | `ADMIN` (giám sát vận hành), `DOCTOR` | Lập kế hoạch vật tư/dược phẩm, đánh giá mô hình bệnh | Ghi log truy cập báo cáo quản trị | Đã thống nhất nguyên tắc ẩn danh; danh mục báo cáo, ngưỡng tổng hợp & chống tái định danh: **Chờ chủ dự án xác nhận** |

**Nguyên tắc thực thi ma trận**:
- **Chuẩn hóa Role hệ thống vs Chức danh tham khảo**:
  - Hệ thống chỉ áp dụng danh sách Role đã được phê duyệt: `ADMIN`, `DOCTOR`, `RECEPTIONIST`, `RECEPTION_SUPERVISOR`, `TECHNICIAN`, `CASHIER`, `PATIENT`. Tuyệt đối không tự tạo Role mới (ví dụ `ACCOUNTANT`).
  - Các chức danh chuyên môn hoặc quản lý công việc (như Kế toán trưởng, Bác sĩ trưởng khoa, Trưởng phòng khám) chỉ là chức danh công việc nội bộ tham khảo trong thực tế tổ chức phòng khám, không phải Role hệ thống; mọi quyền hạn truy cập phải được cấp phát thông qua Permission cụ thể gắn với Role hệ thống.
  - Các quyền chưa xác định người/vai trò sở hữu giữ trạng thái `Chờ xác nhận`.
- **Trường số thẻ BHYT**:
  - Clinic-AI là hệ thống phòng khám tư nhân hiện không tham gia thanh toán BHYT (đã chốt Out of Scope). Do đó, không mặc định đưa chức năng quản lý số thẻ BHYT vào phạm vi thao tác của Admin Portal.
  - Trường này được ghi nhận là cần xác minh tính cần thiết về mặt nghiệp vụ và pháp lý trước khi triển khai. Tuyệt đối không tự ý xóa trường này trong cơ sở dữ liệu hoặc mã nguồn nếu nó đang tồn tại, cho đến khi có báo cáo audit tác động toàn hệ thống.
- **Bảo vệ toàn diện dữ liệu lâm sàng cá nhân tại Backend**:
  - Tuyệt đối cấm Role `ADMIN` truy cập hồ sơ lâm sàng cá nhân của từng bệnh nhân; không mở rộng quyền clinical cho `ADMIN` dưới bất kỳ hình thức nào.
  - Yêu cầu kiểm soát an toàn phải được thực thi ở tầng Backend, không chỉ dừng lại ở việc ẩn nút hoặc ẩn trường tại Frontend. Rào chắn bảo vệ này bắt buộc áp dụng nhất quán trên toàn bộ các kênh và thành phần thuộc phạm vi đặc tả: Backend API routes, service queries, câu lệnh truy vấn dữ liệu Dashboard, chức năng Export báo cáo (Excel/CSV), bộ nhớ đệm (cache), và các endpoint dữ liệu dùng chung (shared routes). Tuyệt đối không để lộ dữ liệu lâm sàng cá nhân qua response payload ngay cả khi người dùng gọi API trực tiếp.
- **Ngưỡng chống tái định danh (Anti-re-identification)**:
  - Mọi dữ liệu lâm sàng tổng hợp phục vụ quản trị phải được ẩn danh hoàn toàn (de-identified), không cho phép kết hợp các thuộc tính để suy ngược ra danh tính người bệnh.
  - Các ví dụ lý thuyết (như $k$-anonymity với $k \ge 5$) chỉ mang tính chất minh họa khái niệm kỹ thuật, tuyệt đối không phải là chính sách đã được phê duyệt và không được biến thành giá trị mặc định trong code, API contract hay Acceptance Criteria. Ngưỡng số lượng cụ thể và phương pháp ẩn danh bắt buộc phải chờ chủ dự án phê chuẩn bằng văn bản.
- **Tuân thủ mô hình RBAC và thứ tự ưu tiên quyền**:
  - Quyền hiệu lực được tính toán nghiêm ngặt theo thứ tự: `Explicit Deny > Explicit Allow > Role Grant > Default Deny`.
  - Không tự cấp thêm bất kỳ quyền mặc định nào cho Role `ADMIN`. Mọi quyền truy cập dữ liệu nhạy cảm (SĐT, địa chỉ, chi tiết giao dịch tài chính) nếu không được cấp tường minh thì mặc định bị từ chối (`Default Deny`).
- **Backend Enforced**: API Backend phải trực tiếp kiểm tra permission trên từng endpoint và từ chối truy cập trái phép bằng HTTP 403 Forbidden; tuyệt đối không dùng việc ẩn trường ở Frontend hoặc trả giá trị rỗng/`null` để thay thế cho kiểm tra quyền tại tầng dịch vụ/API.
- **Các nội dung đánh dấu `Chờ chủ dự án xác nhận`**: Tuyệt đối không tự ý cấu hình giá trị mặc định trong mã nguồn hay cơ sở dữ liệu khi chưa có văn bản phê chuẩn chính thức từ chủ dự án.

5.5 Dashboard, Reports & Audit
- FR-024: Dashboard và báo cáo MUST lấy dữ liệu từ nguồn dữ liệu có thẩm quyền, áp dụng bộ lọc thời gian rõ ràng và công bố định nghĩa các chỉ số chính.
- FR-025: Trạng thái không có dữ liệu MUST được biểu diễn bằng danh sách rỗng, số 0 hoặc empty state phù hợp; không phát sinh lỗi do undefined/`null` không được xử lý.
- FR-026: Xuất Excel MUST áp dụng cùng bộ lọc, quyền truy cập và quy tắc tính toán như màn hình báo cáo tương ứng.
- FR-027: Audit Trail MUST có khả năng tra cứu theo thời gian, actor, loại hành động và đối tượng trong phạm vi quyền.
- FR-028: Audit Trail MUST bảo đảm tính toàn vẹn; người dùng thông thường không được sửa/xóa log đã ghi. Thời hạn lưu trữ MUST cấu hình được; số năm cụ thể, archive/backup và quyền truy cập log phải được xác định sau khi đối chiếu quy định pháp luật áp dụng.
5.6 Medical Catalog & Configuration
- FR-029: Admin có quyền phù hợp MUST quản lý danh mục chuyên khoa, phòng khám/buồng khám, dịch vụ, bảng giá, thuốc, ICD-10 và cấu hình biểu mẫu.
- FR-030: Bảng giá MUST hỗ trợ thời điểm hiệu lực; chứng từ đã phát hành MUST giữ nguyên giá trị lịch sử.
- FR-031: Mã danh mục có ràng buộc duy nhất trong phạm vi bộ danh mục/phiên bản tương ứng; API MUST trả lỗi nhất quán khi phát hiện trùng.
- FR-032: Danh mục đã được dữ liệu nghiệp vụ tham chiếu MUST không bị xóa vật lý nếu việc xóa làm mất tính toàn vẹn lịch sử; cần cơ chế ngừng hiệu lực hoặc thay thế phù hợp.
5.7 Staff, Scheduling & Integration Administration
- FR-033: Admin có quyền MUST quản lý tài khoản và hồ sơ nhân sự trong phạm vi được phân công.
- FR-034: Hệ thống MUST lưu thông tin trạng thái CCHN và áp dụng quy tắc kiểm tra khi phân công hoạt động có yêu cầu điều kiện hành nghề.
- FR-035: Admin có quyền MUST được tạo, sửa, phân công và điều chỉnh lịch làm việc cụ thể của bác sĩ, gồm ca, khung giờ và phòng khám. Hệ thống MUST kiểm tra xung đột bác sĩ/phòng/thời gian. Lịch làm việc MUST được phân biệt với lịch hẹn khám bệnh nhân; FR này MUST NOT cho phép Admin thực hiện nghiệp vụ tiếp đón hoặc tự động thay đổi lịch hẹn.
- FR-036: Giai đoạn đầu MUST cung cấp thiết kế adapter/interface, cấu hình, giám sát trạng thái, nhật ký đồng bộ và xử lý lỗi; chỉ kết nối API thật sau khi tài liệu chính thức, cơ chế xác thực và môi trường tích hợp được xác minh. Trước đó chỉ dùng mock/dữ liệu giả lập.
- FR-036a: Admin có quyền tích hợp MUST xem cấu hình không nhạy cảm, trạng thái đồng bộ, mã tham chiếu, thời điểm gửi và thông tin lỗi đã được lọc.
- FR-037: Admin không có quyền chuyên môn MUST NOT sửa hoặc ký nội dung đơn thuốc.
- FR-038: Thao tác retry đồng bộ MUST có cơ chế chống gửi trùng/idempotency phù hợp với tài liệu tích hợp được xác nhận.
- FR-039: Bí mật tích hợp MUST không hiển thị trong giao diện hoặc log; thay đổi cấu hình tích hợp phải được audit.
5.8 Development & Test Data Requirements
Các yêu cầu seed dưới đây phục vụ phát triển/kiểm thử, không phải chức năng nghiệp vụ hiển thị cho người dùng Admin Portal.
- FR-040: Hệ thống MUST cung cấp scripts/seed_admin_demo.py với hai chế độ --reset và --append.
- FR-041: Seed script MUST idempotent.
- FR-042: --reset MUST chỉ hoạt động khi môi trường và database đích được xác định rõ là dev/test; MUST chặn production và môi trường không xác định.
- FR-043: Seed script MUST bảo toàn tài khoản người dùng hiện có theo quyết định đã chốt.
- FR-044: Seed data MUST bảo đảm toàn vẹn khóa ngoại.
- FR-045: Dữ liệu bệnh nhân, bệnh án và số điện thoại trong seed MUST là dữ liệu giả lập tổng hợp, không phải dữ liệu cá nhân thật.
- FR-046: --append MUST kiểm tra định danh duy nhất để tránh tạo bản ghi trùng.
6. Key Entities & State Management
6.1 Các thực thể liên quan
Danh sách dưới đây là tập thực thể nghiệp vụ có liên quan đến Admin Portal; không có nghĩa Admin trực tiếp thao tác tất cả các thực thể.
- Tài khoản và phân quyền: NguoiDung, VaiTro, Permission (nếu mô hình hiện tại hỗ trợ hoặc được phê duyệt bổ sung).
- Nhân sự: BacSi, ChuyenKhoa, PhongKham, thông tin CCHN và lịch làm việc.
- Danh mục: DichVuKham, BangGiaDichVu, DanhMucThuoc, BenhICD10.
- Dữ liệu vận hành được phép tổng hợp/tra cứu: LichHen, LuotKham, ChiDinhCLS, DonThuoc.
- Tài chính phục vụ báo cáo: HoaDon, ChiTietHoaDon, GiaoDichThanhToan.
- Kiểm toán: NhatKyTruyCapDuLieuYTe hoặc mô hình Audit Log tương ứng với kiến trúc hiện tại.
- Tích hợp: bản ghi đồng bộ, mã tham chiếu, trạng thái và lỗi tích hợp (tên entity/table cần xác định trong Plan sau khi audit code).
6.2 State Machines
Các FSM dưới đây mô tả trạng thái nghiệp vụ toàn hệ thống để Admin báo cáo/giám sát khi được cấp quyền; chúng không trao cho Admin quyền thực hiện các chuyển trạng thái chuyên môn.

Lượt khám (LuotKham) – trạng thái hiện được đề xuất trong spec gốc:

CHO_KHAM → DANG_KHAM → CHO_KET_QUA_CLS (nếu có chỉ định) → HOAN_THANH hoặc HUY.

Invariant đề xuất: không chuyển sang HOAN_THANH nếu thiếu chẩn đoán chính theo quy tắc nghiệp vụ đã được xác nhận.

Hóa đơn (HoaDon) – trạng thái hiện được đề xuất trong spec gốc:

CHO_THANH_TOAN → DA_THANH_TOAN → DA_KHOA_SO; hoàn tiền được quản lý theo quy trình riêng và không nên giả định DA_HOAN_TIEN là trạng thái duy nhất cho mọi trường hợp hoàn một phần/toàn phần.

Invariant đề xuất: chứng từ đã phát hành/thanh toán không được sửa trực tiếp các dòng lịch sử; điều chỉnh phải qua nghiệp vụ điều chỉnh/hoàn tiền có dấu vết.

Đồng bộ đơn thuốc:

Cần đối chiếu FSM hiện có trong Clinic-AI và tài liệu giao tiếp chính thức trước khi chốt trạng thái, retry, idempotency và xử lý lỗi. Không tự đặt trạng thái tích hợp như một giao thức đã được xác nhận.
7. Non-Functional & Quality Requirements
- Performance: Các truy vấn danh mục thông dụng phải đáp ứng mục tiêu thời gian đã đo trên môi trường kiểm thử có cấu hình và dữ liệu được mô tả. Mục tiêu ban đầu: dưới 1.5 giây cho truy vấn danh mục 1,000 bản ghi; cần xác định đây là thời gian API hay thời gian render toàn trang.
- Security: API Admin phải xác thực người dùng và kiểm tra quyền hiệu lực theo Role + Permission. Không chỉ dựa vào việc ẩn UI; ADMIN là Role quản trị cao nhất và không tồn tại SUPER_ADMIN. Quyền cấp/thu hồi ADMIN chỉ qua quy trình kỹ thuật backend được kiểm soát.
- Privacy: Chỉ thu thập, trả về và ghi log dữ liệu bệnh nhân tối thiểu cần thiết cho mục đích được cấp quyền.
- Auditability: Các hành động nhạy cảm và thay đổi quyền phải có log đủ để truy vết; chính sách lưu giữ và quyền truy cập log cần được xác định.
- Maintainability: Code phải tuân thủ cấu trúc và quy ước hiện có, dễ đọc, có kiểm thử. Mã nguồn phải tự giải thích thông qua tên hàm, tên biến và cấu trúc rõ ràng; nghiêm cấm tuyệt đối comment (`#`, `//`, `/* */`) và docstring (`"""..."""`, `/** */`) trong mọi tệp mã nguồn theo Constitution Principle III.
- Testing: Mỗi thay đổi có kiểm thử phù hợp (unit/integration cho Backend; test component/integration cho Frontend theo công cụ hiện có). CI phải pass các kiểm thử bắt buộc. Coverage mục tiêu sẽ được xác định dựa trên rủi ro và baseline, không dùng tỷ lệ pass 100% làm đại diện duy nhất cho chất lượng.
- Compatibility: Không tự ý thay đổi stack, framework hoặc thêm dependency ngoài quyết định kiến trúc đã được phê duyệt.
8. Edge Cases & Failure Handling
1. Database rỗng: Dashboard, bảng và biểu đồ phải hiển thị empty state/0; không dùng mock data để che giấu dữ liệu trống.
2. API lỗi hoặc timeout: Hiển thị trạng thái lỗi có thể thử lại; không hiển thị dữ liệu cũ như thể là dữ liệu mới nếu không đánh dấu rõ.
3. Token hết hạn hoặc quyền vừa bị thu hồi: API phải từ chối theo chính sách xác thực; UI yêu cầu đăng nhập lại hoặc tải lại quyền hiệu lực.
4. Truy cập route trực tiếp: Không thể vượt qua kiểm soát quyền bằng cách nhập URL hoặc gọi API trực tiếp.
5. Hai Admin cùng sửa danh mục: Phải có quy tắc phát hiện cập nhật xung đột hoặc optimistic locking nếu phù hợp với mô hình hiện tại.
6. Giá mới có hiệu lực: Không làm thay đổi giá lịch sử của hóa đơn/chứng từ đã phát hành.
7. Danh mục đang được tham chiếu: Không xóa vật lý gây lỗi khóa ngoại hoặc làm mất dữ liệu lịch sử.
8. Lịch làm việc trùng: Phát hiện xung đột theo nhân sự, phòng và khoảng thời gian được cấu hình.
9. CCHN hết hạn/đình chỉ: Không cho phân công hoạt động yêu cầu điều kiện hành nghề nếu quy tắc pháp lý/nghiệp vụ đã xác nhận áp dụng.
10. Tích hợp đơn thuốc gián đoạn: Giữ trạng thái gửi rõ ràng, lưu mã tương quan/lỗi cần thiết, tránh retry tạo bản ghi gửi trùng.
11. Export báo cáo: Áp dụng lại quyền truy cập và bộ lọc; không xuất các trường bị ẩn trên UI nhưng vẫn có trong API.
12. Seed --reset nhầm môi trường: Chặn trước khi thực hiện bất kỳ thao tác phá hủy nào; yêu cầu xác nhận môi trường/DB đích.
13. Xóa route/component: Kiểm tra import, lazy route, menu, test và workspace dùng chung trước khi xóa.
14. Audit log lỗi ghi: Cần xác định chính sách fail-closed/fail-open cho từng loại hành động nhạy cảm; không âm thầm bỏ qua audit đối với thao tác bắt buộc ghi log.
15. Quyền ADMIN cuối cùng: Không được để quy trình bootstrap/thay đổi Role làm mất tài khoản ADMIN cuối cùng có khả năng quản trị.
9. Success Criteria
Các tiêu chí nghiệm thu phải đo được và gắn với phạm vi Admin Portal:
- SC-001: 100% mục menu/route Admin đã được kiểm kê và có quyết định Giữ / Hợp nhất / Sửa / Xóa / Chuyển workspace / Hoãn.
- SC-002: Không còn route Admin được duyệt giữ nhưng dẫn đến trang lỗi hoặc trang không có chức năng; route ngoài phạm vi không xuất hiện như chức năng thao tác Admin.
- SC-003: Các màn hình Admin thuộc phạm vi không còn đọc/ghi dữ liệu nghiệp vụ từ he_thong_trang_thai_bff JSON sau khi migration được xác minh.
- SC-004: Các API được bảo vệ từ chối truy cập khi thiếu quyền; kiểm thử phải bao gồm gọi API trực tiếp, không chỉ kiểm tra ẩn menu.
- SC-005: Tài khoản Admin chỉ xem được các trường dữ liệu bệnh nhân tương ứng với permission đã cấp; không thể truy cập nội dung bệnh án khi thiếu quyền.
- SC-006: Các thay đổi Role/Permission và truy cập dữ liệu được bảo vệ tạo Audit Trail theo chính sách.
- SC-007: Dashboard và báo cáo xử lý đúng cả trường hợp có dữ liệu và không có dữ liệu; kết quả được đối chiếu với nguồn dữ liệu.
- SC-008: Các kiểm thử bắt buộc trong CI pass; các lỗi/ngoại lệ được ghi nhận rõ, không che giấu bằng mock hoặc xfail không có lý do.
- SC-009: Seed script đáp ứng các rào chắn an toàn và được kiểm thử trên DB dev/test riêng.
- SC-010: Các chức năng tiếp đón, khám, CLS và thu ngân tiếp tục khả dụng trong workspace nghiệp vụ tương ứng sau khi tinh gọn Admin Portal.
10. Assumptions, Dependencies & Open Questions
10.1 Assumptions
- Clinic-AI là hệ thống phòng khám tư nhân ngoại trú, không triển khai quyết toán BHYT trong phạm vi hiện tại.
- PostgreSQL là nguồn dữ liệu quan hệ mục tiêu cho dữ liệu nghiệp vụ.
- Backend hiện tại sử dụng FastAPI và SQLAlchemy Async; Frontend hiện tại sử dụng React/Vite. Plan phải xác minh phiên bản và cấu hình thực tế từ repository trước khi đề xuất thay đổi.
- Các workspace nghiệp vụ của Lễ tân, Bác sĩ, KTV và Thu ngân tiếp tục tồn tại ngoài Admin Portal.
- TClinic chỉ là tham chiếu nghiệp vụ, không phải nguồn pháp lý.
10.2 Dependencies
- Mô hình User/Role hiện tại và cơ chế JWT.
- Các API và SQLAlchemy models hiện có.
- Cơ chế migration Alembic.
- Dữ liệu hiện tại trong he_thong_trang_thai_bff và PostgreSQL.
- Tài liệu chính thức về tích hợp đơn thuốc điện tử.
- Quy định pháp luật hiện hành liên quan đến dữ liệu sức khỏe, hồ sơ bệnh án, đơn thuốc và lưu trữ nhật ký.
10.3 Open Questions – cần giải quyết trước hoặc trong Plan

| Open Question | Nội dung cần làm rõ / Đầu ra cần có | Người phụ trách | Phạm vi pháp lý & Điều khoản cần đối chiếu | Trạng thái xác minh | Tiêu chí nghiệm thu để đóng (Acceptance Criteria) |
|---|---|:---:|---|:---:|---|
| **OQ-1: Patient Data Access** | Data Access Matrix chi tiết cho từng trường, permission và audit policy | Chờ xác nhận | Quy chế bảo vệ dữ liệu nội bộ phòng khám | Chờ xác nhận | Bảng ma trận tại §5.4 được chủ dự án phê duyệt toàn bộ các mục còn mở và tích hợp vào test bảo mật API. |
| **OQ-2: Prescription Integration** | Integration adapter, schema mock và FSM đồng bộ được xác minh | Chờ xác nhận | Thông tư 27/2021/TT-BYT & TT 04/2022/TT-BYT (kê đơn thuốc điện tử); tài liệu kỹ thuật Cổng đơn thuốc quốc gia | Chờ xác minh | Chỉ dùng adapter/mock, không gọi endpoint ngoài khi chưa có chứng thư số và tài liệu kỹ thuật chính thức được phê duyệt. |
| **OQ-3: Audit Retention & Fail Policy** | Chính sách retention cụ thể và cơ chế xử lý khi ghi audit lỗi (fail-safe) | Chờ xác nhận | Nghị định 102/2025/NĐ-CP (nhật ký hệ thống thông tin y tế); Nghị định 13/2023/NĐ-CP (bảo vệ dữ liệu cá nhân); Luật Khám bệnh, chữa bệnh 2023 (thời hạn lưu trữ bệnh án) | Chờ xác minh | Xác định điều khoản cụ thể điều chỉnh thời hạn lưu trữ log cho phòng khám tư nhân; không ấn định số năm lưu trữ và không áp dụng fail-closed đồng loạt khi chưa đánh giá rủi ro từng loại thao tác; chính sách được chủ dự án phê duyệt. |
| **OQ-4: TClinic & Multi-source Legal Mapping** | Bảng đối chiếu nghiệp vụ tham chiếu TClinic với các văn bản pháp lý chuyên ngành y tế | Chờ xác nhận | Thông tư 32/2023/TT-BYT (quy chuẩn danh mục kỹ thuật, biểu mẫu); Luật Khám bệnh, chữa bệnh 2023 (điều kiện CCHN, phạm vi hành nghề); các quy định y tế hiện hành khác | Chờ xác minh | Không kết luận một văn bản bao quát toàn bộ yêu cầu pháp lý; lập bảng đối chiếu cụ thể từng trường danh mục (buồng khám, chuyên khoa, CCHN, dịch vụ) viện dẫn điều khoản văn bản áp dụng; được chủ dự án phê duyệt. |
| **OQ-5: Scheduling Rules** | Scheduling Rules Document (quy tắc ca, thời gian nghỉ, xung đột phòng/bác sĩ) | Chờ xác nhận | Quy chế phân ca trực và Bộ luật Lao động (thời giờ làm việc, thời giờ nghỉ ngơi) | Chờ xác nhận | Xác định đầy đủ các loại xung đột và quy tắc nghiệp vụ điều phối lịch bằng văn bản; có test suite xác minh độc lập. |
11. Work Packages – đề xuất phân rã, chưa phải cam kết triển khai
Không phân công gói công việc theo cách khiến Admin phải sở hữu workspace của các vai trò nghiệp vụ.
1. WP-01 – Admin Foundation, Navigation & Data Audit: kiểm kê menu/route, xác định nguồn dữ liệu, migration strategy, dashboard foundation.
2. WP-02 – Medical Catalog & Configuration: danh mục y tế, bảng giá, thuốc, ICD-10, biểu mẫu.
3. WP-03 – Staff, RBAC & Scheduling Administration: tài khoản, nhân sự, Role/Permission, cấu hình lịch làm việc.
4. WP-04 – Reports, Audit & Operational Data Access: dashboard, báo cáo, Audit Trail, data-access matrix.
5. WP-05 – E-Prescription Integration Administration: cấu hình, giám sát, trạng thái đồng bộ và xử lý lỗi tích hợp.
Các workspace tiếp đón, khám, CLS và thu ngân được kiểm thử hồi quy để bảo đảm không bị ảnh hưởng bởi thay đổi Admin; chúng không trở thành gói chức năng Admin.
12. Definition of Ready for Planning
Chỉ chuyển sang /speckit-plan khi các điều kiện dưới đây được đáp ứng. Các mục còn [ ] là việc chưa hoàn tất, không được tự động đánh dấu hoàn thành:
- [ ] Phạm vi Admin thuần quản trị được thống nhất trong toàn bộ tài liệu (đã làm rõ phạm vi CorporateHealthPage.jsx; giữ [ ] chờ audit code thực tế TreatmentCoursePage.jsx).
- [ ] Sáu User Stories và Acceptance Scenarios được review, không còn nghiệp vụ tuyến đầu gán cho Admin (giữ [ ] chờ chủ dự án review và phê duyệt chính thức).
- [ ] Data-access matrix chi tiết cho từng trường dữ liệu bệnh nhân, permission, mục đích và audit được hoàn tất (đã chuẩn hóa ma trận chi tiết tại §5.4; giữ [ ] chờ chủ dự án phê duyệt các mục Chờ xác nhận).
- [x] Ma trận Role/Permission và quy tắc ưu tiên grant/revoke được xác nhận ở mức nghiệp vụ: Explicit Deny > Explicit Allow > Role Grant > Default Deny; ADMIN là Role cao nhất, không cấp qua UI.
- [ ] Các Open Questions còn lại có owner, cách xác minh và tiêu chí chấp nhận; không đánh dấu hoàn tất chỉ vì đã chuyển sang Plan (đã lập bảng quản trị tại §10.3; giữ [ ] do Owner đang ở trạng thái Chờ xác nhận và các nội dung pháp lý đang Chờ xác minh).
- [x] Yêu cầu pháp lý/tích hợp chưa có bằng chứng được đánh dấu cần xác minh, không coi là sự thật đã kiểm chứng (áp dụng adapter/mock và cờ xác minh).
- [ ] Functional Requirements có ID duy nhất và truy vết được tới User Story/Acceptance Scenario (giữ [ ] chờ kiểm tra traceability thực tế theo chuỗi FR → US → AC → Task → Test).
- [x] Success Criteria có thể kiểm thử và không dùng coverage/pass-rate đơn lẻ làm thước đo chất lượng (10 tiêu chí SC-001 đến SC-010 kiểm thử độc lập).