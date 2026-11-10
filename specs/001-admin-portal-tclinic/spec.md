Feature Specification: Phân hệ Quản trị viên (Admin Portal) – Clinic-AI
Feature Branch: 001-admin-portal-tclinic
Created: 2026-11-10
Status: Planning Baseline Approved — Implementation Not Yet Authorized (DoR 7/8 [x], DoR-5 duy trì [ ] có kiểm soát; đã phê duyệt PO-01..PO-04; ranh giới 8 OQs được thiết lập chặt chẽ)
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
- Toàn bộ chức năng Bảo hiểm Y tế (BHYT) dưới mọi hình thức (quản lý thẻ BHYT, thu thập/lưu trữ số thẻ, kiểm tra quyền lợi BHYT, quy trình khám bệnh BHYT, giám định, thanh toán, quyết toán hoặc hoàn trả viện phí BHYT). Việc người bệnh cá nhân sở hữu thẻ BHYT hoàn toàn nằm ngoài phạm vi hệ thống Clinic-AI.
Admin có thể xem số liệu tổng hợp hoặc metadata vận hành cần thiết theo quyền được cấp, nhưng không vì thế mà được thực hiện các nghiệp vụ trên.
2.3 Nguyên tắc tham chiếu
- Tham chiếu TClinic về quy trình, trường dữ liệu và trạng thái nghiệp vụ; không sao chép UI một cách máy móc.
- Tuyệt đối không triển khai chức năng BHYT dưới bất kỳ hình thức nào trong toàn bộ hệ thống Clinic-AI.
- Các yêu cầu pháp lý về dữ liệu y tế, hồ sơ bệnh án và đơn thuốc phải được đối chiếu với văn bản chính thức còn hiệu lực trước khi triển khai.
- Không suy diễn API, giao thức hay cơ chế xác thực của hệ thống đơn thuốc quốc gia nếu chưa có tài liệu tích hợp chính thức.
3. Clarifications & Decisions
Session 2026-11-10
1. Kho JSON trung gian: Chuyển các màn hình Admin sử dụng dữ liệu nghiệp vụ sang API và bảng quan hệ PostgreSQL. Kho he_thong_trang_thai_bff chỉ lưu cấu hình giao diện động đã được xác định, ví dụ menu tùy biến và template in tùy biến. Không xóa dữ liệu JSON cũ trước khi kiểm kê, sao lưu, đối chiếu, di trú và kiểm thử.
2. Seed data: Cung cấp CLI độc lập scripts/seed_admin_demo.py, hỗ trợ --reset và --append. Script phải idempotent; --reset chỉ được chạy trên DB dev/test được xác định rõ; bảo toàn tài khoản người dùng hiện có; giữ toàn vẹn khóa ngoại; chỉ dùng dữ liệu tổng hợp giả lập; --append chống trùng lặp.
3. Tham chiếu TClinic: Áp dụng quy trình nghiệp vụ và ý nghĩa trường dữ liệu phù hợp; không sao chép giao diện; loại trừ toàn bộ chức năng BHYT dưới mọi hình thức; yêu cầu pháp lý phải được kiểm chứng từ văn bản chính thức.
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
15. Phạm vi Khám đoàn (CorporateHealthPage.jsx) và Liệu trình điều trị (TreatmentCoursePage.jsx):
    - CorporateHealthPage.jsx: Admin chỉ quản trị danh mục gói khám sức khỏe doanh nghiệp, hợp đồng khám đoàn, cấu hình dịch vụ và bảng giá liên quan, và xem báo cáo tổng hợp hoạt động khám đoàn khi được cấp quyền; tuyệt đối không thực hiện tiếp nhận, khám lâm sàng, lập hồ sơ bệnh án hay nhập kết quả xét nghiệm đoàn.
    - TreatmentCoursePage.jsx (Quyết định Phương án A ngày 2026-11-10): Kết quả audit mã nguồn xác nhận trang hiện tại chứa các thao tác lâm sàng và tài chính tuyến đầu (chỉ định phác đồ, điểm danh ca tập, theo dõi bệnh án từng buổi và in biên lai viện phí). Phê duyệt Phương án A: tách hoàn toàn TreatmentCoursePage.jsx khỏi Admin Portal. Các route /admin/lieu-trinh và /admin/lieutrinh phải bị loại bỏ trong giai đoạn implementation. Các nghiệp vụ được phân định rõ ràng về đúng workspace:
      + Bác sĩ (Doctor Workspace): Chỉ định liệu trình, theo dõi và đánh giá đáp ứng lâm sàng.
      + Kỹ thuật viên / Điều dưỡng (Staff/PHCN Workspace): Lịch thực hiện và điểm danh / check-in buổi trị liệu.
      + Thu ngân (Cashier Workspace): Thu tiền và quản lý biên lai viện phí.
      + Quản trị viên (Admin Portal): Chỉ quản lý danh mục bài tập PHCN chuẩn, danh mục gói liệu trình mẫu (nếu được duyệt tích hợp vào Catalog) và xem báo cáo thống kê tổng hợp ẩn danh. Tuyệt đối không cho phép Admin xem danh sách bệnh nhân điều trị cá nhân, hồ sơ từng buổi, đánh giá lâm sàng hoặc thao tác check-in.
      + Tuyệt đối không chuyển nguyên trạng toàn bộ component TreatmentCoursePage.jsx hiện tại sang Staff Workspace vì component đang trộn lẫn nhiều vai trò và quyền hạn khác nhau; việc phân tách thành màn hình/component độc lập sẽ được thực hiện tại workspace tương ứng.
16. Phê duyệt User Stories & Acceptance Scenarios (Product Owner Approval - 2026-11-10):
    Chủ dự án (Product Owner) đã hoàn thành rà soát nghiệp vụ và chính thức phê duyệt toàn bộ 6 User Stories (US-01 đến US-06) cùng 35 Acceptance Scenarios tại Mục 4:
    - US-01 (Dashboard, BI & Audit Management - 5 scenarios): Phê duyệt có điều kiện — OQ-3 (Audit Retention & Fail Policy) và OQ-7 (Revenue Recognition Rules) tiếp tục giữ trạng thái mở chờ xác minh/quyết định riêng.
    - US-02 (Medical Catalog & System Configuration - 5 scenarios): Phê duyệt có điều kiện — OQ-8 (In-Flight Pricing Rules) tiếp tục giữ trạng thái mở chờ văn bản chính sách chuyển tiếp giá.
    - US-03 (Staff, RBAC & Work Schedule Administration - 9 scenarios): Phê duyệt có điều kiện — OQ-4 (CCHN & Legal Mapping), OQ-5 (Scheduling Rules & Labor Laws) và OQ-6 (Session & Token Invalidation latency threshold) tiếp tục giữ trạng thái mở.
    - US-04 (E-Prescription Integration & Monitoring - 5 scenarios): Phê duyệt có điều kiện — OQ-2 (Prescription Integration Sandbox & Adapter) tiếp tục giữ trạng thái mở chờ tài liệu/môi trường Cổng quốc gia.
    - US-05 (Protected Patient Data Access & Operation Supervision - 6 scenarios): Phê duyệt có điều kiện — OQ-1 (Patient Data Access Matrix) tiếp tục giữ trạng thái mở chờ ban hành quy chế bảo vệ dữ liệu nội bộ.
    - US-06 (Admin Portal Cleanup & Route Pruning - 5 scenarios): Phê duyệt theo Phương án A đã được thống nhất (tách hoàn toàn TreatmentCoursePage.jsx và loại bỏ route /admin/lieu-trinh, /admin/lieutrinh).
    *Nguyên tắc ghi nhận và ràng buộc tính toàn vẹn*:
    - Phê duyệt có điều kiện của Chủ dự án đối với User Stories và Acceptance Scenarios KHÔNG làm thay đổi hoặc đóng trước bất kỳ Open Question nào (OQ-1 đến OQ-8 tiếp tục duy trì trạng thái mở độc lập theo bảng §10.3).
    - Toàn bộ 35 scenarios tuân thủ nghiêm ngặt nguyên tắc Admin thuần quản trị; tuyệt đối không có bất kỳ nghiệp vụ tuyến đầu nào (tiếp nhận, khám, kê đơn, CLS, thu ngân) bị gán cho Admin Portal.
    - DoR-2 được chuyển sang [x] tương ứng với phê duyệt chính thức này.
    - DoR-3 được giải quyết thông qua Quyết định PO-01 đến PO-04 tại Mục 17 dưới đây.
    - DoR-5 duy trì [ ] do các quyết định OQ-1 đến OQ-8 (thời hạn retention cụ thể, tham số cảnh báo lịch mềm, chính sách chuyển tiếp giá) tiếp tục giữ trạng thái MỞ chờ PO phê duyệt văn bản và thẩm định pháp lý; việc phân định Owner và tiêu chí tại §10.3 là cấu trúc quản trị, không thay thế cho quyết định phê duyệt.
    - DoR-7 được chuyển sang [x] sau khi thiết lập đầy đủ Chuỗi truy vết hai chiều FR → US → AC → Task → Test tại Mục 5.9.

17. Quyết định phê duyệt dữ liệu bệnh nhân và tài chính PO-01 đến PO-04 (Product Owner Approval - 2026-11-10):
    Chủ dự án (Product Owner) đã chính thức phê duyệt 4 quyết định nghiệp vụ (PO-01 đến PO-04) làm cơ sở chuẩn hóa dứt điểm Patient Data Access Matrix tại §5.4:
    - Quyết định PO-01 (Full Date of Birth): ADMIN chỉ được xem năm sinh thông qua `patient:read_basic`; ADMIN bị cấm xem ngày sinh đầy đủ (DD/MM/YYYY); không tạo permission `patient:read_full_dob` tại thời điểm này; không có ngoại lệ cấp quyền cho ADMIN; không tự động thay đổi quyền của DOCTOR, RECEPTIONIST hoặc các Role khác.
    - Quyết định PO-02 (CCCD/Passport): ADMIN bị cấm xem CCCD/Hộ chiếu nguyên văn; ADMIN có thể xem dữ liệu đã che một phần (masked format, ví dụ `001******890`) nếu có mục đích đối soát vận hành hợp lệ và được cấp permission riêng tường minh; không mặc định cấp quyền này cho ADMIN; không tự tạo permission hoặc tự gán quyền cho Role khác khi chưa được PO phê duyệt.
    - Quyết định PO-03 (BHYT - Loại trừ toàn bộ chức năng BHYT dưới mọi hình thức):
      + Clinic-AI tuyệt đối không triển khai chức năng Bảo hiểm Y tế (BHYT) dưới bất kỳ hình thức nào: không quản lý thẻ BHYT, không thu thập hoặc lưu trữ số thẻ BHYT của người bệnh, không kiểm tra điều kiện/quyền lợi BHYT, không triển khai quy trình khám bệnh BHYT, và không thực hiện thanh toán, quyết toán, giám định hoặc hoàn trả viện phí BHYT.
      + Tuyệt đối không tạo bất kỳ permission nào liên quan đến BHYT; Admin Portal không cung cấp chức năng quản lý hay truy cập dữ liệu BHYT; không đưa trường dữ liệu, API, model database, luồng nghiệp vụ hay giao diện BHYT vào phạm vi được phê duyệt.
      + Việc người bệnh cá nhân sở hữu thẻ BHYT hoàn toàn nằm ngoài phạm vi của hệ thống Clinic-AI.
      + Phân loại Nợ kỹ thuật kế thừa (Legacy Technical Debt): Các tham chiếu `bhyt` hiện hữu trong mã nguồn (mock data tại `PatientManagementPage.jsx`, fallback state `prev.bhyt` tại `ReceptionRegistrationPage.jsx`, `healthInsurance: bn.so_bhyt` tại `DoctorDashboardPage.jsx`, link Cổng Giám định BHYT tại `ComplianceAndAuditPage.jsx`, và trường mã kỹ thuật Bộ Y tế `DichVuKyThuat.ma_tu_dong_bhyt`) được xác định chính thức là Nợ kỹ thuật kế thừa, tuyệt đối không phải chức năng được phê duyệt; việc xóa bỏ/dọn dẹp các mã này sẽ được thực hiện trong gói task kỹ thuật chuyên biệt được phê duyệt riêng, không can thiệp trong tác vụ tài liệu này.
    - Quyết định PO-04 (Finance Transaction & Receipt Detail): Phê duyệt cho Role `ADMIN` được phép xem dữ liệu tài chính chi tiết phục vụ quản trị và giám sát hoạt động phòng khám qua các permission:
      + `finance:read_summary`: Allow (báo cáo tổng hợp).
      + `finance:read_transaction`: Allow (danh sách giao dịch thanh toán, mã giao dịch, thời điểm, phương thức, số tiền, trạng thái).
      + `finance:read_receipt_detail`: Allow (chi tiết hóa đơn/biên lai: mã hóa đơn, tên bệnh nhân/người nộp, danh mục dịch vụ khám chữa bệnh, số lượng, đơn giá, thành tiền, tổng tiền, miễn giảm, thực thu, thông tin đối soát; KHÔNG bao gồm danh sách thuốc vì Clinic-AI không bán thuốc).
      *Ràng buộc bắt buộc*:
      1. ADMIN có quyền đọc dữ liệu tài chính, không mặc định có quyền thu tiền, sửa giao dịch hoặc hoàn tiền.
      2. Mọi truy cập dữ liệu tài chính chi tiết bắt buộc phải được ghi Audit Trail.
      3. Quyền đọc chi tiết dịch vụ trên hóa đơn không đồng nghĩa với quyền xem bệnh án, chẩn đoán, triệu chứng, bệnh sử, ghi chú lâm sàng hoặc kết quả CLS.
      4. Tuyệt đối giữ nguyên Security Invariant: ADMIN không được truy cập `clinical:read_record` (Backend từ chối bằng HTTP 403 Forbidden).
      5. Quyền đọc tài chính của Admin Matrix không tự động gán cho CASHIER; quyền nghiệp vụ của CASHIER được quản lý độc lập tại Cashier Workspace; không thay đổi nghiệp vụ Cashier Workspace.
    *Đánh giá tác động đến DoR-3 & OQ-1*:
    - DoR-3 được đánh dấu [x] do toàn bộ 10 nhóm dữ liệu tại §5.4 đã được xác định quyền và chế độ truy cập rõ ràng theo phê duyệt của Chủ dự án, không còn mục nào treo trạng thái Chờ xác nhận.
    - OQ-1 tiếp tục giữ trạng thái mở độc lập (Chờ xác minh kỹ thuật & Tích hợp test API) do các cơ chế kỹ thuật thực thi (mở rộng schema audit log, backend permission guard trên billing/cashier) cần hoàn thiện trong giai đoạn Plan/Implementation.

18. Cấu trúc quản trị Open Questions OQ-2 đến OQ-8 và Chuỗi truy vết RTM (2026-11-10):
    Đội ngũ dự án và Chủ dự án đã thống nhất phân công Owner, phương án kỹ thuật và tiêu chí đóng cho toàn bộ các Open Questions còn lại:
    - OQ-2 (Prescription Integration): Áp dụng Adapter Pattern nội bộ (`MockNationalPrescriptionGatewayAdapter`) với FSM đồng bộ (`PENDING_SYNC` -> `SYNCING` -> `SYNCED` / `SYNC_FAILED` -> `RETRY_PENDING`) và `correlation_id` chống gửi trùng; bảo mật API key/chứng thư số qua biến môi trường; TV5 phụ trách (T038, T040).
    - OQ-3 (Audit Retention & Fail Policy): Thời hạn lưu trữ bắt buộc cấu hình được (configurable parameter) theo quyết định đã chốt (§3 mục 13); các con số cụ thể (như 10 năm cho dữ liệu y tế, 2 năm cho vận hành) chỉ là đề xuất kỹ thuật tham khảo, giữ trạng thái Chờ xác minh pháp lý & Phê duyệt của PO; cơ chế Fail-Closed cho thao tác nhạy cảm (dữ liệu bệnh nhân, tài chính, RBAC, lâm sàng) và Fail-Open cho báo cáo tổng hợp BI; TV4 phụ trách (T033, T035).
    - OQ-4 (TClinic & Multi-source Legal Mapping): Xác định TClinic là tham chiếu UX, đối chiếu nghiệp vụ đa nguồn với TT 32/2023/TT-BYT, Luật Khám bệnh, chữa bệnh 2023, NĐ 96/2023/NĐ-CP, Luật Giá 2023 và NĐ 13/2023/NĐ-CP; giữ nguyên trạng thái MỞ chờ thẩm định pháp lý; nguyên tắc CCHN `EXPIRED` và `SUSPENDED` là nguyên tắc nghiệp vụ đã phê duyệt với chi tiết pháp lý chờ OQ-4; trạng thái `REVOKED` là đề xuất kỹ thuật chưa phê duyệt; PO/BA phụ trách.
    - OQ-5 (Scheduling Rules): Yêu cầu phát hiện xung đột bác sĩ và buồng khám là yêu cầu đã phê duyệt (FR-035, Edge Case 8, US-03 AC-7); mã lỗi HTTP 409 là chi tiết triển khai API; chính sách xử lý cụ thể (chặn cứng vs cảnh báo) và các ngưỡng tham số minh họa (nghỉ giữa 2 ca < 8h, quá 48h/tuần, CCHN sắp hết hạn <= 30 ngày) giữ trạng thái MỞ chờ PO phê duyệt Quy chế điều phối ca trực; tách biệt lịch trực bác sĩ khỏi lịch hẹn bệnh nhân là Invariant đã duyệt (FR-035, US-03 AC-8); TV3 phụ trách (T025, T026, T028, T029).
    - OQ-6 (Session & Token Invalidation): Triển khai Token Versioning (`token_version`) kết hợp Invalidation Cache kiểm tra tức thì trên dependency `get_current_user`; cam kết độ trễ thu hồi quyền <= 500ms (p95 <= 50ms); TV3 phụ trách (T027, T030).
    - OQ-7 (Revenue Recognition Rules): Doanh thu KCB ghi nhận tại thời điểm hóa đơn chuyển sang PAID căn cứ theo mốc `paid_at`; tiền tạm ứng là nợ phải trả (chưa ghi nhận doanh thu); hoàn tiền ghi nhận giảm trừ doanh thu thuần; nguồn dữ liệu quan hệ có thẩm quyền là bảng `invoices` và `payments` trong PostgreSQL; PO / TV1 phụ trách (T012, T014).
    - OQ-8 (In-Flight Pricing Rules): Chứng từ lịch sử bất biến 100%; chỉ định dịch vụ dở dang áp dụng giá tại thời điểm bác sĩ ra y lệnh; lịch hẹn đặt trước áp dụng giá tại thời điểm check-in (trừ khi đã thanh toán trước); cập nhật giá tạo phiên bản mới kèm mốc hiệu lực, không xóa đè bản ghi cũ; PO / TV2 phụ trách (T018, T020, T021).
    - RTM (Requirements Traceability Matrix): Toàn bộ 46 Functional Requirements (FR-001 đến FR-046) đã được ánh xạ hai chiều tới User Stories, 35 Acceptance Scenarios, danh mục Task (T001..T048) và các file kiểm thử tự động tại Mục 5.9.
    - DoR-7 đạt chuẩn ở cấp độ tài liệu đặc tả (100% 46 FRs đã có chuỗi truy vết FR → US → AC → Task → Test trong Mục 5.9; phân định rõ: kiểm thử đang ở trạng thái PLANNED trong kế hoạch, chưa được implement hay execute trên runtime). DoR-5 duy trì [ ] do các quyết định OQ tiếp tục mở chờ PO phê duyệt văn bản; dự án ở trạng thái sẵn sàng về tài liệu và kiến trúc (Ready for Planning Review), không tuyên bố hoàn thành triển khai khi các giả định chưa được phê duyệt.

4. User Scenarios & Testing

> [!NOTE] Phê duyệt nghiệp vụ (Product Owner Approval - 2026-11-10)
> Toàn bộ 6 User Stories (US-01 đến US-06) và 35 Acceptance Scenarios dưới đây đã được Chủ dự án hoàn thành rà soát và chính thức phê duyệt ngày 2026-11-10 (phê duyệt có điều kiện gắn với các OQ mở tương ứng theo Quyết định 16 tại Mục 3). Toàn bộ 35 scenarios tuân thủ nghiêm ngặt nguyên tắc Admin thuần quản trị, bảo đảm không có bất kỳ nghiệp vụ tuyến đầu nào bị gán cho Admin Portal.
US-01 – Dashboard, BI & Audit Management (Priority: P1)
Là quản trị viên được cấp quyền giám sát, tôi muốn xem dashboard và báo cáo tổng hợp về hoạt động phòng khám, đồng thời tra cứu Audit Trail, để theo dõi tình hình vận hành và phát hiện các hành vi bất thường.

Why this priority: Dashboard và audit là nền tảng giám sát, hỗ trợ quản trị mà không cần Admin trực tiếp thực hiện nghiệp vụ tuyến đầu.

Independent Test: Đăng nhập bằng tài khoản Admin có quyền báo cáo; mở dashboard và trang báo cáo; lọc theo khoảng thời gian; đối chiếu tổng hợp với dữ liệu nguồn được phép; truy vấn Audit Trail.

Acceptance Scenarios:
1. Given cơ sở dữ liệu không có lượt khám hoặc hóa đơn trong khoảng thời gian được chọn, When Admin mở dashboard, Then hệ thống hiển thị số liệu bằng 0 hoặc trạng thái không có dữ liệu, không hiển thị số liệu giả và không phát sinh lỗi giao diện.
2. Given có dữ liệu nguồn trong khoảng thời gian được chọn, When Admin xem báo cáo doanh thu hoặc số lượt khám, Then số liệu phải được tính từ nguồn dữ liệu quan hệ có thẩm quyền (PostgreSQL), áp dụng đúng bộ lọc thời gian và tuân thủ định nghĩa chỉ số cũng như quy tắc tính toán đã được Chủ dự án phê duyệt (các vấn đề về thời điểm ghi nhận doanh thu, tạm ứng, hoàn tiền, doanh thu gộp và doanh thu thuần tuân thủ theo quyết định nghiệp vụ tại OQ-7, không tự ý áp đặt công thức khi chưa có phê chuẩn).
3. Given Admin có quyền xuất báo cáo, When Admin yêu cầu xuất Excel, Then tệp xuất phải phản ánh đúng bộ lọc và dữ liệu người dùng được phép xem.
4. Given có hành động thuộc diện phải kiểm toán, When người có quyền tra cứu Audit Trail, Then hệ thống hiển thị tối thiểu thời điểm, actor/user ID, vai trò hoặc quyền hiệu lực, hành động, đối tượng bị tác động và kết quả; không ghi nội dung nhạy cảm không cần thiết vào log; thời hạn lưu trữ log và chính sách xử lý khi ghi log thất bại tuân thủ kết quả xác minh tại OQ-3, không tự ấn định giá trị tùy ý.
5. Given Admin không có quyền xem một loại báo cáo, When Admin gọi API tương ứng, Then Backend từ chối truy cập kể cả khi người dùng tự nhập URL hoặc gọi API trực tiếp.
US-02 – Medical Catalog & System Configuration (Priority: P1)
Là quản trị viên được giao quản lý danh mục, tôi muốn quản lý danh mục y tế, bảng giá và cấu hình biểu mẫu để các workspace nghiệp vụ sử dụng dữ liệu gốc nhất quán.

Why this priority: Danh mục và cấu hình là dữ liệu nền cho các quy trình tiếp đón, khám, CLS, kê đơn và thanh toán.

Independent Test: Tạo hoặc cập nhật một mục danh mục được phép; kiểm tra API và workspace tiêu thụ dữ liệu; kiểm tra bản ghi nghiệp vụ cũ vẫn giữ đúng thông tin lịch sử.

Acceptance Scenarios:
1. Given một dịch vụ đã có bảng giá hiệu lực, When Admin tạo phiên bản giá mới với mốc thời gian hiệu lực xác định (effective date/time), Then hệ thống áp dụng giá mới theo quy tắc hiệu lực được phê duyệt; mọi chứng từ và hóa đơn đã phát hành trước đó phải giữ nguyên giá trị lịch sử không bị thay đổi (bảo đảm tính bất biến của dữ liệu tài chính lịch sử); quy tắc áp giá đối với các chỉ định dịch vụ, lịch hẹn hoặc giao dịch dở dang phát sinh trước thời điểm hiệu lực nhưng hoàn tất sau thời điểm hiệu lực tuân thủ chính sách được xác nhận (ghi nhận tại OQ-8, không tự ý suy diễn quy tắc khi chưa có quyết định chính thức).
2. Given Admin cập nhật cấu hình biểu mẫu in, When workspace nghiệp vụ tạo bản in tiếp theo, Then bản in sử dụng cấu hình mới theo phiên bản/hiệu lực đã được áp dụng; các bản in hoặc chứng từ đã xuất và lưu trữ trước thời điểm thay đổi giữ nguyên nội dung lịch sử.
3. Given mã ICD-10 đã tồn tại, When Admin tạo một mục trùng mã trong cùng bộ danh mục/phiên bản, Then hệ thống từ chối và trả lỗi xác định, ví dụ HTTP 409 nếu phù hợp với quy ước API hiện tại.
4. Given Admin không có quyền quản lý danh mục thuốc, When Admin gửi yêu cầu ghi dữ liệu thuốc qua API, Then hệ thống từ chối thao tác.
5. Given một danh mục đã được tham chiếu bởi dữ liệu nghiệp vụ, When Admin muốn ngừng sử dụng mục đó, Then hệ thống ưu tiên cơ chế ngừng hiệu lực/soft delete phù hợp, không phá vỡ dữ liệu lịch sử.
US-03 – Staff, RBAC & Scheduling Management (Priority: P1)
Là quản trị viên nhân sự/hệ thống, tôi muốn quản lý tài khoản, hồ sơ nhân sự, vai trò, quyền chi tiết và lịch làm việc cụ thể của bác sĩ để bảo đảm người dùng được cấp đúng quyền và nguồn lực được bố trí hợp lệ.

Why this priority: Quản lý tài khoản và quyền là nền tảng bảo mật; thông tin nhân sự và điều kiện hành nghề ảnh hưởng đến việc phân công chuyên môn.

Independent Test: Tạo/cập nhật tài khoản theo quyền; gán role; cấp/thu hồi permission; kiểm tra xác nhận không thể gán hoặc thu hồi Role ADMIN qua giao diện người dùng hoặc API nghiệp vụ Admin Portal; thử gọi API bằng tài khoản có và không có quyền; thử cấp Explicit Allow cho ADMIN trên quyền clinical để xác nhận Backend vẫn chặn cứng; kiểm tra xung đột lịch và điều kiện CCHN theo quy tắc đã xác minh.

Acceptance Scenarios:
1. Given tài khoản được gán một Role và các permission chi tiết, When hệ thống tính quyền hiệu lực, Then hệ thống áp dụng nghiêm ngặt thứ tự ưu tiên quyền đã xác nhận: Explicit Deny > Explicit Allow > Role Grant > Default Deny; tài khoản nhận các quyền mặc định của Role và các quyền chi tiết được cấp hợp lệ sau khi giải quyết xung đột theo thứ tự trên.
2. Given tài khoản có Role ADMIN, When có yêu cầu truy cập hồ sơ lâm sàng cá nhân (clinical:read_record) kể cả trường hợp có cấu hình cấp Explicit Allow trái phép, Then hệ thống thực thi security invariant ở tầng Backend từ chối truy cập bằng HTTP 403 Forbidden; lệnh cấm này là bất biến và không thể bị vượt qua (bypass) bởi bất kỳ quy tắc cấp quyền nào.
3. Given người quản trị có thẩm quyền thay đổi quyền, When người đó cấp hoặc thu hồi một permission thông thường, Then thay đổi được lưu, có hiệu lực theo chính sách phiên/token của hệ thống và được ghi Audit Trail.
4. Given quản trị viên thao tác trên giao diện hoặc API nghiệp vụ Admin Portal, When cố gắng gán hoặc thu hồi Role ADMIN cho bất kỳ tài khoản nào, Then hệ thống từ chối thao tác; việc bootstrap hoặc thay đổi Role ADMIN chỉ được thực hiện qua quy trình kỹ thuật backend có kiểm soát, ghi nhận Audit Trail và có cơ chế bảo vệ không để mất tài khoản Admin cuối cùng.
5. Given người dùng không có permission cần thiết, When người dùng gọi API bị giới hạn, Then Backend trả HTTP 403 theo định dạng lỗi chuẩn.
6. Given bác sĩ có trạng thái CCHN thuộc diện cần kiểm soát (như hết hạn hoặc bị đình chỉ), When Admin thực hiện phân công lịch làm việc có liên quan đến hoạt động hành nghề khám chữa bệnh, Then hệ thống áp dụng cơ chế cảnh báo hoặc từ chối phân công dựa trên quy tắc pháp lý và danh mục điều kiện hành nghề đã được xác minh và phê duyệt chính thức (theo OQ-4); không tự áp đặt điều kiện từ chối cứng khi chưa có quy tắc được phê chuẩn.
7. Given Admin tạo hoặc điều chỉnh lịch làm việc của bác sĩ, When phát sinh xung đột về phân công bác sĩ (bác sĩ bị trùng ca/khung giờ) hoặc xung đột về buồng khám (buồng khám bị xếp trùng ca/khung giờ trong cùng khoảng thời gian), Then hệ thống phát hiện xung đột và xử lý theo quy tắc điều phối lịch được cấu hình (phân định rõ yêu cầu phát hiện xung đột đã được phê duyệt theo FR-035 khỏi chính sách chặn cứng hoặc cảnh báo mềm đang chờ PO phê duyệt tại OQ-5).
8. Given Admin điều chỉnh lịch làm việc của bác sĩ, When thay đổi được lưu, Then hệ thống không tự động thay đổi lịch hẹn khám của bệnh nhân; việc điều phối lịch hẹn vẫn thuộc workspace nghiệp vụ tương ứng.
9. Given một tài khoản bị khóa hoặc vừa bị thu hồi quyền, When tài khoản đó gửi request tiếp theo, Then hệ thống không cho phép thực hiện hành động vượt quá quyền hạn hiệu lực mới; cơ chế kỹ thuật và ngưỡng độ trễ vô hiệu hóa phiên/token được ghi nhận tại OQ-6, tiêu chí kiểm thử về thời gian sẽ được hoàn thiện sau khi Chủ dự án phê duyệt ngưỡng.
US-04 – National E-Prescription Integration Management (Priority: P1)
Là quản trị viên được cấp quyền tích hợp, tôi muốn quản lý cấu hình và theo dõi trạng thái đồng bộ đơn thuốc điện tử, để phát hiện lỗi tích hợp và hỗ trợ xử lý sự cố mà không can thiệp trái phép vào nội dung chuyên môn của đơn thuốc.

Why this priority: Tích hợp đơn thuốc điện tử có yêu cầu tuân thủ và cần khả năng giám sát, truy vết lỗi.

Independent Test: Dùng adapter/mock được phê duyệt trên môi trường kiểm thử; không kết nối hoặc suy diễn API/schema thật của Cổng đơn thuốc quốc gia khi chưa có tài liệu kỹ thuật và chứng thư số chính thức (theo OQ-2); xem trạng thái đồng bộ, mã tham chiếu, thời điểm gửi, phản hồi và lỗi; xác nhận quyền Admin không cho phép sửa nội dung đơn thuốc đã ký.

Acceptance Scenarios:
1. Given một đơn thuốc đã đến trạng thái đủ điều kiện gửi theo quy trình hiện hành, When hệ thống thực hiện đồng bộ, Then Admin có quyền tích hợp có thể xem trạng thái và mã tham chiếu của lần gửi.
2. Given một lần đồng bộ thất bại, When Admin xem chi tiết lỗi, Then hệ thống hiển thị thông tin kỹ thuật cần thiết, đã loại bỏ bí mật và dữ liệu cá nhân không cần thiết.
3. Given Admin có quyền vận hành tích hợp nhưng không có quyền chuyên môn, When Admin truy cập bản ghi đơn thuốc, Then Admin chỉ xem metadata/trạng thái được phép và không thể sửa, ký hoặc thay đổi nội dung đơn.
4. Given một đơn thuốc có trạng thái đồng bộ chưa thành công và thỏa mãn chính sách gửi lại được phê duyệt, When Admin có quyền chủ động yêu cầu retry trên giao diện quản trị, Then thao tác gửi lại chỉ được phép khi trạng thái đơn hợp lệ và phải áp dụng cơ chế bảo đảm tính lũy nghiệm (idempotency) phù hợp với khả năng của adapter và hệ thống tiếp nhận; trường hợp chưa xác định được kết quả của lần gửi trước, hệ thống không cho phép retry ngay mà phải có cơ chế đối soát trạng thái bằng mã tương quan duy nhất (correlation ID) hoặc cơ chế xác minh phù hợp (cơ chế retry tự động của hệ thống là quyết định kỹ thuật riêng ngoài phạm vi US này, không tự động kích hoạt khi chưa được phê duyệt).
5. Given Admin có quyền cấu hình tích hợp, When truy cập hoặc cập nhật cấu hình kết nối, Then hệ thống chỉ cho phép lựa chọn và cấu hình trong danh mục tham số và endpoint đã được phê duyệt (không cho phép nhập endpoint tùy ý ngoài danh mục); thông tin bí mật (secret/API key/chứng thư số) tuyệt đối không được hiển thị nguyên văn trên giao diện/log mà phải lưu trong cơ chế quản lý secret bảo mật, và mọi thay đổi cấu hình bắt buộc phải được ghi Audit Trail.
US-05 – Administrative Operational Data Access (Priority: P2)
Là quản trị viên được cấp quyền giám sát, tôi muốn xem một số thông tin vận hành cần thiết của bệnh nhân và lượt khám để đối chiếu báo cáo, hỗ trợ điều phối và kiểm tra hoạt động, nhưng không mặc định truy cập nội dung hồ sơ bệnh án.

Why this priority: Admin cần dữ liệu đủ để giám sát hoạt động, nhưng phải tuân thủ nguyên tắc quyền tối thiểu và bảo vệ dữ liệu sức khỏe.

Independent Test: Cấp quyền xem thông tin định danh/liên hệ/vận hành cho tài khoản thử nghiệm; xác nhận chỉ các trường được cấp quyền xuất hiện; kiểm tra audit và yêu cầu ghi lý do khi xem số điện thoại/địa chỉ; thử truy cập API clinical record bằng tài khoản Admin và xác nhận bị từ chối bằng HTTP 403.

Acceptance Scenarios:
1. Given Admin có permission patient:read_basic, When Admin xem thông tin bệnh nhân, Then chỉ các trường định danh được phê duyệt như mã bệnh nhân, họ tên và năm sinh được hiển thị (ngày sinh đầy đủ không mặc định đi kèm).
2. Given Admin có permission patient:read_operational, When Admin xem thông tin vận hành, Then hệ thống chỉ hiển thị metadata cần thiết như mã lượt khám, thời điểm, trạng thái, chuyên khoa/buồng khám và thông tin điều phối được phép.
3. Given Admin được cấp riêng permission patient:read_contact (tuyệt đối không đi kèm mặc định với vai trò Admin thông thường), When Admin yêu cầu xem số điện thoại hoặc địa chỉ cư trú của bệnh nhân cho mục đích vận hành hợp lệ (như xử lý khiếu nại, liên hệ điều phối lịch bất thường), Then hệ thống bắt buộc yêu cầu ghi nhận lý do truy cập cụ thể và ghi nhận đầy đủ vào Audit Trail (actor ID, thời điểm, patient ID, lý do truy cập, hành động và kết quả).
4. Given tài khoản có Role ADMIN, When gọi API hoặc mở giao diện có chứa hồ sơ bệnh án, chẩn đoán chi tiết, triệu chứng, tiền sử bệnh, nội dung đơn thuốc hoặc chỉ định/kết quả CLS cá nhân, Then Backend bắt buộc từ chối truy cập bằng HTTP 403 Forbidden theo security invariant đã xác định; Role ADMIN tuyệt đối không thể truy cập dữ liệu lâm sàng cá nhân trong bất kỳ tình huống nào.
5. Given Admin có permission xem báo cáo tài chính tổng hợp (finance:read_summary), When Admin xem báo cáo tài chính, Then hệ thống chỉ hiển thị các chỉ số và dữ liệu tổng hợp thuộc phạm vi báo cáo được duyệt; quyền này độc lập hoàn toàn với quyền xem giao dịch chi tiết (finance:read_transaction) và thông tin biên lai/chứng từ chi tiết (finance:read_receipt_detail); hai permission chi tiết này chưa được gán cố định cho Role nào trong ma trận Admin và tiếp tục chờ Chủ dự án phê chuẩn; việc chưa gán các quyền này trong Admin Data Access Matrix không đồng nghĩa loại bỏ hay làm thay đổi các nghiệp vụ thu tiền, lập biên lai hoặc in biên lai vốn thuộc workspace nghiệp vụ của Thu ngân (US này không mở rộng sang triển khai hay thay đổi workspace Thu ngân).
6. Given Admin truy cập dữ liệu bệnh nhân thuộc diện bảo vệ, When hệ thống xử lý yêu cầu, Then hành động phải được ghi Audit Trail với thông tin actor, thời điểm, đối tượng, hành động và kết quả; không ghi tràn lan nội dung bệnh án vào log.
US-06 – Admin Navigation & Access Management (Priority: P2)
Là quản trị viên, tôi muốn có menu và route Admin được tổ chức theo nhóm chức năng thực sự thuộc phạm vi quản trị, để tìm đúng chức năng và không gặp trang lỗi hoặc menu dẫn đến nghiệp vụ của vai trò khác.

Why this priority: Điều hướng nhất quán giúp giảm lỗi sử dụng và ngăn việc đưa nhầm nghiệp vụ tuyến đầu vào Admin Portal.

Independent Test: Kiểm kê menu Admin; đối chiếu danh sách route được duyệt; kiểm tra route trực tiếp, refresh, deep link và quyền truy cập; thử truy cập trái quyền qua URL trực tiếp và API để xác nhận bị chặn.

Acceptance Scenarios:
1. Given danh sách chức năng Admin đã được audit và phê duyệt, When người dùng mở sidebar, Then chỉ các chức năng thuộc phạm vi và được phép truy cập mới xuất hiện.
2. Given một route Admin hợp lệ có tab được chọn qua query parameter, When người dùng refresh hoặc chia sẻ URL, Then trang khôi phục đúng tab và trạng thái điều hướng.
3. Given một route thuộc workspace Lễ tân/Bác sĩ/KTV/Thu ngân, When Admin mở menu Admin, Then route đó không được hiển thị như một chức năng thao tác Admin.
4. Given người dùng không có quyền quản trị hoặc thiếu permission tương ứng, When cố tình truy cập route Admin qua nhập URL trực tiếp, mở deep link, refresh trang hoặc gọi trực tiếp API Backend, Then hệ thống từ chối truy cập (điều hướng về trang thông báo lỗi/đăng nhập ở Frontend và trả HTTP 401/403 ở Backend API), không hiển thị dữ liệu hoặc giao diện quản trị.
5. Given các route lâm sàng/tuyến đầu như /admin/lieu-trinh và /admin/lieutrinh bị loại bỏ khỏi Admin Portal theo Phương án A, When thực hiện dọn dẹp navigation và routing Admin, Then các route này bị loại bỏ hoàn toàn và không còn truy cập được như chức năng Admin; đồng thời các chức năng liên quan tại workspace nghiệp vụ khác vẫn hoạt động bình thường theo đúng quyền được cấp; các dependency và luồng dữ liệu dùng chung không bị xóa hoặc thay đổi ngoài phạm vi; và hệ thống phải có kiểm thử hồi quy (regression test) xác nhận các consumer đã xác định (bao gồm AppointmentManagementPage) không bị ảnh hưởng.
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
- FR-008: Route thuộc workspace tiếp đón, khám bệnh, CLS, thu ngân hoặc liệu trình điều trị MUST NOT được đưa vào Admin như chức năng thao tác tuyến đầu. Các route /admin/lieu-trinh và /admin/lieutrinh MUST bị loại bỏ khỏi Admin Portal trong giai đoạn implementation; component TreatmentCoursePage.jsx không thuộc quyền sở hữu của phân hệ Admin.
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
| **Nhân khẩu – Ngày sinh đầy đủ** | Ngày, tháng, năm sinh đầy đủ (DD/MM/YYYY) | **CẤM TUYỆT ĐỐI** (ADMIN chỉ xem năm sinh qua `patient:read_basic`, cấm xem ngày sinh đầy đủ; không có ngoại lệ - PO-01) | Không tạo permission cho Admin tại thời điểm này (PO-01) | `DOCTOR`, `RECEPTIONIST` (đối chiếu hồ sơ KCB); `ADMIN`: **CẤM** | Nghiệp vụ chuyên môn tiếp đón và khám bệnh của Lễ tân và Bác sĩ | Ghi log truy cập hệ thống chuẩn | **Đã phê duyệt (PO-01: Cấm Admin)** |
| **Liên hệ nhạy cảm** | Số điện thoại, địa chỉ cư trú | Xem trực tiếp có điều kiện (tuyệt đối không mặc định cấp cho mọi Admin) | `patient:read_contact` | `ADMIN` (khi được chỉ định riêng), `RECEPTIONIST`, `RECEPTION_SUPERVISOR` | Xử lý khiếu nại, liên hệ điều phối lịch bất thường | **Bắt buộc**: ghi actor, timestamp, patient ID, lý do | Đã thống nhất nguyên tắc; chờ duyệt quy chế cấp |
| **Định danh mức cao** | Số CCCD/Hộ chiếu | **CẤM xem giá trị nguyên văn**. Chỉ được xem dữ liệu đã che (Masked format, ví dụ `001******890`) khi có mục đích đối soát vận hành hợp lệ (PO-02) | Permission riêng được cấp tường minh (không cấp mặc định - PO-02) | `RECEPTIONIST`, `RECEPTION_SUPERVISOR` (tiếp đón tại quầy); `ADMIN`: Chỉ xem masked khi được cấp quyền riêng | Đối soát định danh hành chính khi có khiếu nại hoặc kiểm toán xác thực | **Bắt buộc**: ghi actor, timestamp, patient ID, lý do, kết quả | **Đã phê duyệt (PO-02: Cấm raw value; Masked có điều kiện)** |
| **Bảo hiểm Y tế (BHYT - Toàn bộ chức năng)** | Số thẻ BHYT, thông tin thẻ, quyền lợi, quy trình khám, viện phí hoặc giám định BHYT | **TUYỆT ĐỐI LOẠI TRỪ KHỎI PHẠM VI (Out of Scope)**: Clinic-AI không quản lý, không thu thập/lưu trữ số thẻ, không xác thực quyền lợi, không triển khai khám/thanh toán/giám định/quyết toán BHYT dưới mọi hình thức (PO-03) | Không tạo bất kỳ permission nào liên quan đến BHYT | Tuyệt đối không cấp cho `ADMIN` hoặc bất kỳ Role nào trong Admin Portal | Nằm ngoài phạm vi nghiệp vụ hệ thống Clinic-AI (việc cá nhân người bệnh có thẻ BHYT không thuộc phạm vi xử lý của phần mềm) | Không áp dụng (không có tính năng); log cảnh báo nếu phát sinh truy cập trái phép | **Đã phê duyệt (PO-03: Loại trừ hoàn toàn BHYT dưới mọi hình thức; các tham chiếu code cũ là Nợ kỹ thuật kế thừa)** |
| **Vận hành lượt khám** | Mã lượt khám, ngày khám, trạng thái (chờ/đang khám/hoàn tất), khoa/buồng khám | Xem trực tiếp | `patient:read_operational` | `ADMIN`, `RECEPTIONIST`, `RECEPTION_SUPERVISOR`, `DOCTOR` | Giám sát lưu lượng phòng khám, điều phối tiến độ | Ghi log truy cập hệ thống chuẩn | Đã thống nhất |
| **Tài chính – Báo cáo tổng hợp** | Doanh thu theo ca/ngày/tháng, doanh thu theo chuyên khoa, doanh thu theo nhóm dịch vụ (không chứa định danh cá nhân) | Xem trực tiếp trên Dashboard BI và màn hình báo cáo tổng hợp | `finance:read_summary` | `ADMIN` (khi được cấp quyền báo cáo tài chính; chức danh Kế toán trưởng chỉ mang tính tham khảo) | Báo cáo tài chính quản trị, theo dõi doanh thu | Ghi log truy cập báo cáo tài chính | Đã thống nhất |
| **Tài chính – Giao dịch cá nhân** | Mã giao dịch, mã hóa đơn, thời điểm thanh toán, phương thức (tiền mặt/VietQR), số tiền, trạng thái giao dịch, thông tin đối soát | **Xem trực tiếp** phục vụ quản trị và đối soát luồng tiền (PO-04). Không mặc định có quyền thu tiền, sửa giao dịch hoặc hoàn tiền | `finance:read_transaction` (PO-04) | `ADMIN` (Allow theo PO-04); `CASHIER` quản lý độc lập tại Cashier Workspace | Đối soát luồng tiền ca trực, kiểm toán sai lệch số dư, xử lý giao dịch treo | **Bắt buộc**: ghi actor, timestamp, mã giao dịch, action, result | **Đã phê duyệt (PO-04: ADMIN Allow)** |
| **Tài chính – Biên lai & Chứng từ cá nhân** | Tên bệnh nhân/người nộp, chi tiết hóa đơn: mã hóa đơn, danh mục dịch vụ KCB, số lượng, đơn giá, thành tiền, tổng tiền, miễn giảm, thực thu, thời gian thanh toán. **KHÔNG bao gồm danh sách thuốc** (PO-04) | **Xem trực tiếp** chi tiết chứng từ viện phí (PO-04). Không có quyền thu tiền/hoàn tiền; không mở quyền truy cập hồ sơ lâm sàng (giữ Invariant cấm `clinical:read_record`) | `finance:read_receipt_detail` (PO-04) | `ADMIN` (Allow theo PO-04); `CASHIER` quản lý độc lập tại Cashier Workspace | Giám sát biên lai viện phí, giải quyết khiếu nại thanh toán của bệnh nhân | **Bắt buộc**: ghi actor, timestamp, mã hóa đơn, action, result | **Đã phê duyệt (PO-04: ADMIN Allow - chỉ dịch vụ KCB, không gồm thuốc)** |
| **Lâm sàng – Hồ sơ cá nhân** | Chẩn đoán ICD chi tiết, triệu chứng, tiền sử bệnh, nội dung đơn thuốc, chỉ định & kết quả CLS từng cá nhân | **CẤM / Tuyệt đối không được phép** (Admin thuần quản trị không có thẩm quyền lâm sàng; không mở rộng quyền clinical cho `ADMIN`) | Permission lâm sàng riêng `clinical:read_record` (chỉ dành riêng Bác sĩ) | `DOCTOR` (Bác sĩ được phân công điều trị/hội chẩn; chức danh Trưởng khoa chỉ mang tính tham khảo) | Khám bệnh, chữa bệnh chuyên môn | Bắt buộc ghi nhận truy cập theo chính sách bảo vệ dữ liệu và quy định pháp luật áp dụng (căn cứ pháp lý, phạm vi và thời hạn lưu trữ tiếp tục xác minh tại OQ-3/OQ-4) | Đã thống nhất (Cấm Admin) |
| **Lâm sàng – Thống kê tổng hợp** | Cơ cấu bệnh tật (tần suất ICD), số lượng chỉ định CLS, tỷ lệ sử dụng nhóm thuốc (dữ liệu ẩn danh) | Xem trực tiếp dưới dạng báo cáo thống kê tổng hợp với điều kiện ẩn danh hoàn toàn | `clinical:read_aggregate` (Chờ chủ dự án xác nhận phạm vi) | `ADMIN` (giám sát vận hành), `DOCTOR` | Lập kế hoạch vật tư/dược phẩm, đánh giá mô hình bệnh | Ghi log truy cập báo cáo quản trị | Đã thống nhất nguyên tắc ẩn danh; danh mục báo cáo, ngưỡng tổng hợp & chống tái định danh: **Chờ chủ dự án xác nhận** |

**Nguyên tắc thực thi ma trận**:
- **Chuẩn hóa Role hệ thống vs Chức danh tham khảo**:
  - Hệ thống chỉ áp dụng danh sách Role đã được phê duyệt: `ADMIN`, `DOCTOR`, `RECEPTIONIST`, `RECEPTION_SUPERVISOR`, `TECHNICIAN`, `CASHIER`, `PATIENT`. Tuyệt đối không tự tạo Role mới (ví dụ `ACCOUNTANT`).
  - Các chức danh chuyên môn hoặc quản lý công việc (như Kế toán trưởng, Bác sĩ trưởng khoa, Trưởng phòng khám) chỉ là chức danh công việc nội bộ tham khảo trong thực tế tổ chức phòng khám, không phải Role hệ thống; mọi quyền hạn truy cập phải được cấp phát thông qua Permission cụ thể gắn với Role hệ thống.
  - Các quyền chưa xác định người/vai trò sở hữu giữ trạng thái `Chờ xác nhận`.
- **Loại trừ toàn diện chức năng Bảo hiểm Y tế (BHYT - Quyết định PO-03)**:
  - Clinic-AI tuyệt đối không triển khai chức năng BHYT dưới bất kỳ hình thức nào: không quản lý thẻ BHYT, không thu thập hay lưu trữ số thẻ BHYT của người bệnh, không kiểm tra quyền lợi BHYT, không triển khai quy trình khám chữa bệnh BHYT, và không thực hiện thanh toán, quyết toán, giám định hoặc hoàn trả viện phí BHYT.
  - Việc người bệnh cá nhân sở hữu thẻ BHYT hoàn toàn nằm ngoài phạm vi hệ thống Clinic-AI; Admin Portal tuyệt đối không cung cấp giao diện, API, model dữ liệu, quyền hạn hay chức năng thao tác liên quan đến BHYT; không đưa trường dữ liệu, API, model database, luồng nghiệp vụ hay giao diện BHYT vào phạm vi được phê duyệt.
  - Phân loại Nợ kỹ thuật (Legacy Technical Debt): Kết quả audit toàn bộ hệ thống xác nhận database quan hệ mục tiêu không có cột lưu số thẻ BHYT bệnh nhân. Các tham chiếu `bhyt` hiện diện trong mã nguồn (mock data tại `PatientManagementPage.jsx`, fallback code `prev.bhyt` tại `ReceptionRegistrationPage.jsx`, `healthInsurance: bn.so_bhyt` tại `DoctorDashboardPage.jsx`, hyperlink Cổng Giám định BHYT tại `ComplianceAndAuditPage.jsx`, và trường mã danh mục kỹ thuật `DichVuKyThuat.ma_tu_dong_bhyt`) được phân loại chính thức là Nợ kỹ thuật kế thừa, không phải chức năng được phê duyệt; việc dọn dẹp các mã này được chuyển giao thành gói task kỹ thuật riêng, không làm thay đổi mã nguồn trong tác vụ tài liệu hiện tại.
- **Ngày sinh đầy đủ & CCCD/Hộ chiếu (PO-01 & PO-02)**:
  - Role `ADMIN` bị CẤM xem ngày sinh đầy đủ (DD/MM/YYYY) trong mọi trường hợp; chỉ xem năm sinh qua `patient:read_basic` (PO-01).
  - Role `ADMIN` bị CẤM xem số CCCD/Hộ chiếu nguyên văn; chỉ được xem dữ liệu đã che (masked format) khi có mục đích đối soát vận hành hợp lệ và được cấp permission riêng tường minh (PO-02).
- **Phân quyền Dữ liệu Tài chính chi tiết (PO-04)**:
  - Phê duyệt cho Role `ADMIN` được phép xem dữ liệu tài chính chi tiết phục vụ quản trị và giám sát hoạt động phòng khám qua các permission: `finance:read_summary` (báo cáo tổng hợp), `finance:read_transaction` (danh sách giao dịch), `finance:read_receipt_detail` (chi tiết hóa đơn dịch vụ).
  - Giới hạn: Clinic-AI không bán thuốc, không hiển thị danh sách thuốc trên hóa đơn đối với Admin; ADMIN có quyền đọc, không mặc định có quyền thu tiền, sửa giao dịch hoặc hoàn tiền; truy cập tài chính chi tiết bắt buộc phải được ghi Audit Trail.
  - Quyền đọc chi tiết dịch vụ trên hóa đơn tuyệt đối không đồng nghĩa với quyền xem bệnh án, chẩn đoán, triệu chứng, bệnh sử, ghi chú lâm sàng hoặc kết quả CLS.
  - Quyền đọc tài chính của Admin Matrix không tự động gán cho CASHIER; quyền nghiệp vụ của CASHIER được quản lý độc lập tại Cashier Workspace; không thay đổi nghiệp vụ Cashier Workspace.
- **Bảo vệ toàn diện dữ liệu lâm sàng cá nhân tại Backend (Security Invariant)**:
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

5.9 Requirements Traceability Matrix (Chuỗi truy vết hai chiều FR → US → AC → Task → Test)

Bảng ma trận truy vết dưới đây thiết lập liên kết hai chiều đầy đủ giữa toàn bộ 46 Functional Requirements (FR-001 đến FR-046), 6 User Stories (US-01 đến US-06), 35 Acceptance Scenarios (AC), danh mục Task triển khai (T001 đến T048 trong `tasks.md`) và các bộ kiểm thử tự động tương ứng:

| FR ID | Tên Yêu cầu Chức năng / Kỹ thuật | User Story | Acceptance Scenario (AC) | Task Triển khai (`tasks.md`) | Bộ Kiểm thử Tự động (Automated Test) |
|---|---|:---:|:---:|:---:|---|
| **FR-001** | Đọc/ghi dữ liệu nghiệp vụ qua PostgreSQL quan hệ, loại bỏ BFF JSON song song | US-01, US-02, US-03 | US-01.2, US-02.1 | T014, T020, T028 | `backend/tests/test_admin_bi.py`, `backend/tests/test_admin_catalog.py` |
| **FR-002** | he_thong_trang_thai_bff JSON chỉ lưu cấu hình giao diện động (menu, template) | US-01, US-06 | US-01.1, US-06.1 | T017, T022 | `fe/tests/prRegressionGuard.test.mjs` |
| **FR-003** | Kiểm kê, sao lưu, đối chiếu trước khi ngắt JSON nghiệp vụ | US-01, US-06 | US-06.2 | T017, T043 | `fe/tests/prRegressionGuard.test.mjs` |
| **FR-004** | API Admin dùng FastAPI và SQLAlchemy Async chuẩn kiến trúc | US-01..US-05 | US-01.2, US-03.5 | T004, T005, T006, T007, T008, T009, T010 | `backend/tests/test_admin_*.py` |
| **FR-005** | Kiểm kê toàn bộ mục menu và route Admin hiện có | US-06 | US-06.1, US-06.2 | T011, T017, T043 | `fe/tests/prRegressionGuard.test.mjs` |
| **FR-006** | Phân loại audit menu: Giữ, Hợp nhất, Sửa, Xóa, Chuyển | US-06 | US-06.1, US-06.4 | T017, T043 | `fe/tests/prRegressionGuard.test.mjs` |
| **FR-007** | Chỉ route thuộc Admin được phê duyệt mới hiển thị trên navigation | US-06 | US-06.3 | T011, T016, T041 | `fe/tests/prRegressionGuard.test.mjs` |
| **FR-008** | Loại bỏ route lâm sàng /admin/lieu-trinh khỏi Admin theo Phương án A | US-06 | US-06.1, US-06.5 | T017, T043 | `fe/tests/prRegressionGuard.test.mjs` |
| **FR-009** | Kiểm tra dependency và kiểm thử hồi quy trước khi xóa route | US-06 | US-06.2, US-06.5 | T011, T043, T046 | `fe/tests/prRegressionGuard.test.mjs` |
| **FR-010** | Đồng bộ hai chiều query param `?tab=` giữa URL và UI state | US-02 | US-02.5 | T024 | `fe/tests/prRegressionGuard.test.mjs` |
| **FR-011** | Mô hình phân quyền kết hợp Role và Permission chi tiết | US-03 | US-03.1, US-03.3 | T030, T031 | `backend/tests/test_admin_staff.py` |
| **FR-012** | Role xác định tập quyền mặc định, permission cấp/thu hồi độc lập | US-03 | US-03.2 | T030, T031 | `backend/tests/test_admin_staff.py` |
| **FR-013** | Thứ tự ưu tiên quyền: Explicit Deny > Explicit Allow > Role Grant > Default Deny | US-03 | US-03.3 | T030 | `backend/tests/test_admin_staff.py` |
| **FR-014** | Mặc định từ chối truy cập (Default Deny) nếu không có quyền | US-03 | US-03.4 | T027, T030 | `backend/tests/test_admin_staff.py` |
| **FR-015** | Tách biệt quyền đọc khỏi quyền tạo, sửa, xóa, ký chuyên môn | US-03, US-05 | US-03.1, US-05.4 | T030 | `backend/tests/test_admin_staff.py` |
| **FR-016** | Kiểm tra quyền bắt buộc tại Backend API, không dựa vào ẩn UI | US-03 | US-03.5 | T027, T030 | `backend/tests/test_admin_staff.py` |
| **FR-017** | Ghi Audit Trail đối với mọi thao tác thay đổi Role/Permission | US-01, US-03 | US-01.4, US-03.7 | T035, T036 | `backend/tests/test_admin_audit.py` |
| **FR-018** | ADMIN là Role cao nhất; cấm SUPER_ADMIN; không cấp qua UI; bảo vệ Admin cuối cùng | US-03 | US-03.8 | T028, T030 | `backend/tests/test_admin_staff.py` |
| **FR-019** | Admin chỉ xem báo cáo tổng hợp và trường thông tin được cấp quyền | US-05 | US-05.1 | T030, T035 | `backend/tests/test_admin_audit.py` |
| **FR-020** | Phân quyền độc lập: định danh, liên hệ, vận hành, tài chính | US-05 | US-05.2, US-05.3, US-05.4 | T030 | `backend/tests/test_admin_staff.py` |
| **FR-021** | Security Invariant: CẤM Admin truy cập hồ sơ lâm sàng cá nhân (HTTP 403) | US-05 | US-05.5 | T030 | `backend/tests/test_admin_staff.py` |
| **FR-022** | API trả dữ liệu bệnh nhân chỉ trả trường được phép (Backend payload filtering) | US-05 | US-05.2, US-05.5 | T030 | `backend/tests/test_admin_staff.py` |
| **FR-023** | Audit log truy cập nhạy cảm ghi actor, ts, entity, action, result | US-01, US-05 | US-01.4, US-05.6 | T035 | `backend/tests/test_admin_audit.py` |
| **FR-024** | Nguồn dữ liệu có thẩm quyền cho Dashboard BI & định nghĩa chỉ số | US-01 | US-01.2 | T012, T014 | `backend/tests/test_admin_bi.py` |
| **FR-025** | Xử lý an toàn Empty State (hiển thị số 0 rõ ràng, không sập khi DB rỗng) | US-01 | US-01.1 | T012, T015 | `backend/tests/test_admin_bi.py` |
| **FR-026** | Xuất Excel áp dụng cùng bộ lọc, quyền truy cập và công thức tính | US-01 | US-01.3 | T014 | `backend/tests/test_admin_bi.py` |
| **FR-027** | Audit Trail tra cứu theo thời gian, actor, loại hành động, đối tượng | US-01 | US-01.4 | T033, T035, T036 | `backend/tests/test_admin_audit.py` |
| **FR-028** | Audit log append-only & thời hạn lưu trữ cấu hình được (thời hạn cụ thể Chờ xác minh pháp lý) | US-01 | US-01.4 | T033, T035 | `backend/tests/test_admin_audit.py` |
| **FR-029** | Quản lý danh mục chuyên khoa, buồng khám, dịch vụ, bảng giá, thuốc, ICD-10 | US-02 | US-02.1 | T018, T020, T022 | `backend/tests/test_admin_catalog.py` |
| **FR-030** | Bảng giá hỗ trợ mốc hiệu lực; bảo toàn bất biến giá lịch sử chứng từ | US-02 | US-02.1, US-02.2 | T018, T021 | `backend/tests/test_admin_catalog.py` |
| **FR-031** | Mã danh mục duy nhất trong phạm vi bộ danh mục; trả HTTP 409 khi trùng | US-02 | US-02.3 | T019, T020 | `backend/tests/test_admin_catalog.py` |
| **FR-032** | Danh mục đã được tham chiếu không bị xóa vật lý (ngừng hiệu lực) | US-02 | US-02.4 | T018, T020 | `backend/tests/test_admin_catalog.py` |
| **FR-033** | Quản lý hồ sơ nhân sự, tài khoản và trạng thái hoạt động | US-03 | US-03.1 | T028 | `backend/tests/test_admin_staff.py` |
| **FR-034** | Quản lý trạng thái CCHN; chặn phân công ca trực khi hết hạn/đình chỉ | US-03 | US-03.6 | T025, T028 | `backend/tests/test_admin_staff.py` |
| **FR-035** | Phân công ca trực bác sĩ; phát hiện xung đột bác sĩ/buồng/giờ | US-03 | US-03.7, US-03.8 | T026, T029 | `backend/tests/test_admin_staff.py` (PLANNED) |
| **FR-036** | Adapter Pattern / mock interface cho đồng bộ đơn thuốc quốc gia | US-04 | US-04.1 | T038, T040 | `backend/tests/test_admin_integration.py` |
| **FR-036a** | Admin xem cấu hình không nhạy cảm, trạng thái đồng bộ, mã tham chiếu, lỗi | US-04 | US-04.2 | T038, T040 | `backend/tests/test_admin_integration.py` |
| **FR-037** | Admin không có quyền chuyên môn CẤM sửa hoặc ký đơn thuốc | US-04 | US-04.3 | T040 | `backend/tests/test_admin_integration.py` |
| **FR-038** | Retry đồng bộ có cơ chế idempotency / correlation_id chống gửi trùng | US-04 | US-04.4 | T040 | `backend/tests/test_admin_integration.py` |
| **FR-039** | Bí mật tích hợp không hiển thị trên UI/log; audit cấu hình tích hợp | US-04 | US-04.5 | T040 | `backend/tests/test_admin_integration.py` |
| **FR-040** | Cung cấp CLI script `scripts/seed_admin_demo.py` với cờ `--reset` và `--append` | Foundation | Setup/Infra | T002 | `backend/tests/test_seed_admin_demo.py` |
| **FR-041** | Seed script bảo đảm tính lũy nghiệm (idempotent) | Foundation | Setup/Infra | T002, T003 | `backend/tests/test_seed_admin_demo.py` |
| **FR-042** | Cờ `--reset` chỉ hoạt động trên dev/test, chặn đứng production | Foundation | Setup/Infra | T002, T034 | `backend/tests/test_seed_admin_demo.py` |
| **FR-043** | Seed script bảo toàn tài khoản người dùng hiện có | Foundation | Setup/Infra | T002, T003 | `backend/tests/test_seed_admin_demo.py` |
| **FR-044** | Seed data bảo đảm tính toàn vẹn khóa ngoại | Foundation | Setup/Infra | T002, T037 | `backend/tests/test_seed_admin_demo.py` |
| **FR-045** | Dữ liệu seed bệnh nhân và y tế là dữ liệu giả lập tổng hợp | Foundation | Setup/Infra | T002, T037 | `backend/tests/test_seed_admin_demo.py` |
| **FR-046** | Cờ `--append` kiểm tra định danh duy nhất để tránh tạo bản ghi trùng | Foundation | Setup/Infra | T002, T003 | `backend/tests/test_seed_admin_demo.py` |

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
- Clinic-AI là hệ thống phòng khám tư nhân ngoại trú, tuyệt đối không triển khai chức năng Bảo hiểm Y tế (BHYT) dưới mọi hình thức (không quản lý thẻ, không lưu số thẻ, không khám BHYT, không thanh toán/quyết toán/giám định BHYT). Việc người bệnh cá nhân có thẻ BHYT hoàn toàn nằm ngoài phạm vi phần mềm.
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

| Open Question | Phân loại quyết định | Nội dung cần làm rõ / Đầu ra cần có | Người phụ trách | Phạm vi pháp lý & Ràng buộc đối chiếu | Phương pháp xác minh & Nội dung còn thiếu | Trạng thái xác minh | Tiêu chí chấp nhận để đóng |
|---|:---:|---|:---:|---|---|:---:|---|
| **OQ-1: Patient Data Access** | Phối hợp (Nghiệp vụ & Kỹ thuật) | Data Access Matrix chi tiết cho từng trường, permission và audit policy đối với dữ liệu người bệnh | PO (Nghiệp vụ: Đã phê duyệt PO-01..PO-04) / TV4 (Kỹ thuật: Schema Audit & API Guard) | Quyết định PO-01..PO-04; Quy chế bảo vệ dữ liệu nội bộ; Nghị định 13/2023/NĐ-CP; Nghị định 102/2025/NĐ-CP | Nghiệp vụ ma trận đã được PO phê duyệt toàn bộ (PO-01..PO-04). Về kỹ thuật: mở rộng schema audit log (thêm purpose, result), gắn permission guard cho API `/billing` và `/cashier` tại Backend, và tích hợp test suite bảo mật API trong CI. | **PARTIALLY UNBLOCKED** (Quy tắc nghiệp vụ đã duyệt theo PO-01..PO-04; ranh giới kỹ thuật mở rộng schema audit và guard API tài chính chờ thực thi theo Task T030, T035, T036) | Tích hợp đầy đủ rào chắn Backend API cho `finance:read_*` và `patient:read_contact`; bổ sung trường audit log; và toàn bộ test suite bảo mật API pass trong CI. |
| **OQ-2: Prescription Integration** | Phối hợp (Kỹ thuật & Pháp lý) | Integration adapter, schema mock và FSM đồng bộ đơn thuốc quốc gia | TV5 (Tech Lead / Integration Lead) | Thông tư 27/2021/TT-BYT & TT 04/2022/TT-BYT; tài liệu kỹ thuật Cổng đơn thuốc quốc gia | Áp dụng Adapter Pattern nội bộ (`MockNationalPrescriptionGatewayAdapter`); xây dựng FSM đồng bộ (`PENDING_SYNC` -> `SYNCING` -> `SYNCED` / `SYNC_FAILED` -> `RETRY_PENDING`) với cơ chế `correlation_id` (UUIDv4) chống gửi trùng; bảo mật API key/chứng thư số qua biến môi trường; chỉ chuyển sang API thật khi có chứng thư số và tài liệu kỹ thuật chính thức. | **PARTIALLY UNBLOCKED** (Mock Adapter và FSM nội bộ triển khai theo Task T038, T040; kết nối Cổng đơn thuốc quốc gia thật tiếp tục BLOCKED chờ chứng thư số và tài liệu chính thức) | FSM chuyển trạng thái chính xác; cơ chế retry idempotent không sinh bản ghi trùng; pass test suite `test_admin_integration.py`. |
| **OQ-3: Audit Retention & Fail Policy** | Phối hợp (Pháp lý & Kỹ thuật) | Chính sách retention cụ thể và cơ chế xử lý khi ghi audit lỗi (fail-safe) | TV4 (Security Lead / Compliance Lead) | Nghị định 102/2025/NĐ-CP; Nghị định 13/2023/NĐ-CP; Luật Khám bệnh, chữa bệnh 2023 | Thời hạn lưu trữ bắt buộc cấu hình được (configurable parameter) theo quyết định đã chốt (§3 mục 13); các con số cụ thể (10 năm y tế / 2 năm vận hành) là đề xuất kỹ thuật tham khảo, giữ trạng thái Chờ xác minh pháp lý & Phê duyệt của PO. Cơ chế Fail Policy: Fail-Closed cho thao tác nhạy cảm (dữ liệu bệnh nhân, tài chính, RBAC, lâm sàng) rollback và trả HTTP 500 `AUDIT_LOG_FAILURE`; Fail-Open cho báo cáo tổng hợp BI ghi log hệ thống không ngắt luồng UI. | **PARTIALLY UNBLOCKED** (Cơ chế cấu hình linh hoạt và Fail-safe triển khai theo Task T033, T035; việc ấn định số năm lưu trữ cụ thể tiếp tục BLOCKED/PENDING chờ văn bản PO và xác minh pháp lý) | Retention policy cấu hình được qua cấu hình hệ thống; cơ chế Fail-Closed và Fail-Open được kiểm thử tự động độc lập qua `test_admin_audit.py`; thời hạn cụ thể được PO phê chuẩn bằng văn bản. |
| **OQ-4: TClinic & Multi-source Legal Mapping** | Phối hợp (Pháp lý & Nghiệp vụ) | Bảng đối chiếu nghiệp vụ tham chiếu TClinic với các văn bản pháp lý chuyên ngành y tế | PO / BA Lead | Thông tư 32/2023/TT-BYT; Luật Khám bệnh, chữa bệnh 2023; Nghị định 96/2023/NĐ-CP; Luật Giá 2023; Nghị định 13/2023/NĐ-CP | Xác định TClinic là mô hình tham chiếu UX, không phải nguồn pháp lý tối thượng. Xây dựng bảng đối chiếu đa nguồn: TT 32 & Luật KCB cho danh mục buồng khám, chuyên khoa, CCHN; Luật Giá cho bảng giá niêm yết; NĐ 13 cho bảo vệ dữ liệu cá nhân; quy chế nội bộ điều chỉnh quy trình vận hành. | **PARTIALLY UNBLOCKED** (Nguyên tắc CCHN `EXPIRED`/`SUSPENDED` đã duyệt triển khai theo T025, T028; trạng thái `REVOKED` và chi tiết thẩm định pháp lý tiếp tục BLOCKED/PENDING chờ văn bản chính thức) | Bảng đối chiếu hoàn tất cho toàn bộ các trường danh mục; được chủ dự án phê duyệt; không phụ thuộc đơn lẻ vào TClinic. |
| **OQ-5: Scheduling Rules** | Nghiệp vụ (Business) | Scheduling Rules Document (quy tắc ca, thời gian nghỉ, xung đột phòng/bác sĩ) | TV3 (BA & Workflow Lead) | Quy chế phân ca trực phòng khám và Bộ luật Lao động (thời giờ làm việc, thời giờ nghỉ ngơi) | Bảo toàn các yêu cầu đã duyệt: phát hiện xung đột bác sĩ và buồng khám (FR-035, AC-7) và tách biệt lịch trực nhân sự khỏi lịch hẹn (AC-8). Bảo toàn các quyết định chưa phê duyệt: chính sách chặn cứng (Hard Block - từ chối lưu) vs cảnh báo mềm (Soft Warning - cho phép lưu kèm cảnh báo); mã lỗi HTTP 409 là chi tiết triển khai API áp dụng khi cấu hình chặn cứng, không tự động áp dụng cho mọi xung đột; các tham số nghỉ < 8h, tuần > 48h, CCHN <= 30 ngày là đề xuất tham khảo. | **PARTIALLY UNBLOCKED** (Phát hiện xung đột triển khai theo T026, T029; chính sách quyết định từ chối lưu HTTP 409 vs cho phép lưu kèm cảnh báo tiếp tục BLOCKED/PENDING chờ PO ban hành Quy chế ca trực) | Ban hành Quy chế phân ca trực nội bộ bằng văn bản được PO phê chuẩn; bộ test `test_admin_staff.py` kiểm thử đầy đủ kịch bản chặn cứng 409 và các cảnh báo mềm tương ứng. |
| **OQ-6: Session & Token Invalidation** | Kỹ thuật (Technical) | Cơ chế vô hiệu hóa session/token tức thì khi khóa tài khoản hoặc thu hồi quyền và ngưỡng độ trễ chấp nhận được | TV3 (Tech Lead / Backend Lead) | Kiến trúc JWT hiện tại của FastAPI và yêu cầu kiểm soát truy cập thời gian thực | Triển khai Token Versioning (`token_version` gắn trên bảng `User`) kết hợp Invalidation Cache kiểm tra per-request tại dependency `get_current_user`. Khi khóa tài khoản hoặc thu hồi quyền, tăng `token_version` lập tức. Ngưỡng độ trễ vô hiệu hóa cam kết $p95 \le 50$ms, tối đa $\le 500$ms trên toàn hệ thống. | **PARTIALLY UNBLOCKED** (Cơ chế Token Versioning triển khai theo T027, T030; chỉ số cam kết độ trễ <= 500ms PENDING số liệu benchmark đo lường thực tế) | Request tiếp theo từ tài khoản bị khóa bị từ chối bằng HTTP 401/403 ngay lập tức; có automated test xác minh độ trễ. |
| **OQ-7: Revenue Recognition Rules** | Nghiệp vụ (Business) | Định nghĩa chỉ số doanh thu, thời điểm ghi nhận, xử lý tạm ứng, hoàn tiền, doanh thu gộp và doanh thu thuần | PO / TV1 (Finance & BI Lead) | Quy chế quản lý tài chính nội bộ phòng khám và chuẩn mực kế toán doanh thu y tế | Doanh thu KCB ghi nhận tại thời điểm hóa đơn chuyển sang trạng thái `PAID` căn cứ theo mốc `paid_at`. Nguồn dữ liệu quan hệ có thẩm quyền là bảng `invoices` và `payments` trong PostgreSQL. Tạm ứng là nợ phải trả (chưa ghi nhận doanh thu). Hoàn tiền ghi nhận giảm trừ doanh thu thuần. Doanh thu gộp = tổng dịch vụ; Doanh thu thuần = Doanh thu gộp - Giảm trừ/hoàn tiền. | **PARTIALLY UNBLOCKED** (Nguyên tắc `paid_at` và tạm ứng/hoàn tiền triển khai theo T012, T014; các ca biên kế toán phức tạp tiếp tục PENDING hướng dẫn chi tiết) | Công thức doanh thu được chuẩn hóa nhất quán trên API `/api/admin/bi/dashboard-stats` và test suite xác minh đúng các trường hợp tạm ứng, hoàn tiền. |
| **OQ-8: In-Flight Pricing Rules** | Nghiệp vụ (Business) | Quy tắc áp dụng giá cho lịch hẹn, chỉ định dịch vụ và giao dịch dở dang khi bảng giá mới có hiệu lực | PO / TV2 (Catalog & Pricing Lead) | Quy chế quản lý bảng giá và quy trình điều phối dịch vụ phòng khám | Chứng từ lịch sử đã phát hành giữ nguyên đơn giá lịch sử bất biến. Y lệnh/chỉ định CLS dở dang áp dụng giá tại thời điểm bác sĩ ban hành chỉ định. Lịch hẹn khám đặt trước áp dụng giá tại thời điểm tiếp đón check-in (trừ khi đã thanh toán trước). Cập nhật giá dịch vụ tạo bản ghi phiên bản mới kèm ngày hiệu lực, không xóa hoặc ghi đè bản ghi cũ. | **PARTIALLY UNBLOCKED** (Tính bất biến của lịch sử giá và schema versioning triển khai theo T018, T020, T021; quy chế áp dụng giá chuyển tiếp cho y lệnh dở dang tiếp tục PENDING văn bản PO) | Tính bất biến của bảng giá và quy tắc snapshot giá được kiểm thử qua `test_admin_catalog.py`. |
10.4 Nợ kỹ thuật (Technical Debt) ghi nhận từ Audit mã nguồn Treatment Course & BFF
Ghi nhận các phát hiện kỹ thuật tồn tại trong mã nguồn hiện hữu để theo dõi và xử lý đúng lộ trình, không tự ý sửa đổi ngoài phạm vi Admin Portal:
1. Kê đơn liệu trình: Nút "Kê đơn liệu trình mới" tại TreatmentCoursePage.jsx chỉ là toast mock (`AppToast.info`), chưa có form chỉ định phác đồ hay liên kết với y lệnh của Bác sĩ.
2. In biên lai viện phí: Nút "In biên lai" tại TreatmentCoursePage.jsx chỉ là toast mock (`AppToast.success`), chưa kết nối với module thanh toán / biên lai của Thu ngân.
3. Check-in điểm danh qua BFF: Thao tác điểm danh buổi tập đang cập nhật ghi đè toàn bộ collection `treatmentCourses` qua action Redux `updateClinicCollectionAsync` đẩy lên bảng `he_thong_trang_thai_bff` thay vì gọi API quan hệ chuyên biệt.
4. Logic gán mặc định tại Backend: `bff_admin_service.py` (dòng 1353-1355) đang tự động gán bệnh nhân đầu tiên (`first_bn`) và bác sĩ đầu tiên (`first_bs`) cho mọi bản ghi liệu trình được đồng bộ từ BFF vào PostgreSQL (`LieuTrinhDieuTri`), tiềm ẩn rủi ro sai lệch dữ liệu người bệnh.
5. Chia sẻ route chưa phân quyền (/staff/treatment-courses): Route này hiện dùng chung component monolithic TreatmentCoursePage.jsx mà chưa có cơ chế phân tách quyền hạn theo vai trò (Bác sĩ vs KTV vs Thu ngân).
6. Phụ thuộc dữ liệu của AppointmentManagementPage.jsx: Màn hình `AppointmentManagementPage.jsx` (dòng 42, 260, 265) đang tham chiếu dữ liệu `clinicData?.treatmentCourses` từ BFF Redux state để liên kết lịch hẹn với thông tin liệu trình điều trị và gọi `updateClinicCollectionAsync` với `collectionKey: 'treatmentCourses'`. Khi thực hiện dọn dẹp route `/admin/lieu-trinh` và `/admin/lieutrinh` trong Admin Portal, TUYỆT ĐỐI KHÔNG xóa collection `treatmentCourses` trong BFF/seed data, không xóa backend model `LieuTrinhDieuTri`, và không xóa các BFF sync handler tương ứng trong backend để bảo vệ và tránh gây lỗi hồi quy cho luồng quản trị lịch hẹn.
7. Tham chiếu BHYT kế thừa (Legacy BHYT Technical Debt): Theo Quyết định PO-03, Clinic-AI loại trừ toàn diện chức năng BHYT dưới mọi hình thức. Tuy nhiên mã nguồn hiện hữu còn tồn tại các tham chiếu kế thừa cần đưa vào backlog dọn dẹp kỹ thuật:
   - Frontend mock data (`PatientManagementPage.jsx` dòng 197, 206, 215, 236, 245, 254): Chứa dữ liệu giả lập `bhyt` của các thành viên gia đình.
   - Frontend fallback state (`ReceptionRegistrationPage.jsx` dòng 116): Kiểm tra nháp `prev.bhyt`.
   - Frontend workstation mapping (`DoctorDashboardPage.jsx` dòng 98): Kiểm tra trường `bn.so_bhyt || bn.healthInsurance`.
   - Frontend external UI link (`ComplianceAndAuditPage.jsx` dòng 530-541): Thẻ liên kết ngoài đến "Cổng Giám định BHYT Quốc gia".
   - Backend catalog model & schemas (`medical.py` dòng 70, `admin.py` dòng 177, 191, 210, `admin_catalog_service.py`): Cột `ma_tu_dong_bhyt` trên `DichVuKyThuat` là mã chuẩn hóa kỹ thuật Bộ Y tế (không chứa dữ liệu bệnh nhân), cần rà soát trong đợt chuẩn hóa catalog TT32.
   Toàn bộ các mục trên là Nợ kỹ thuật kế thừa, không làm thay đổi trạng thái loại trừ hoàn toàn của PO-03; không xóa hoặc sửa trong tác vụ tài liệu hiện tại mà xử lý theo backlog kỹ thuật chuyên biệt.

11. Work Packages – đề xuất phân rã, chưa phải cam kết triển khai
Không phân công gói công việc theo cách khiến Admin phải sở hữu workspace của các vai trò nghiệp vụ.
1. WP-01 – Admin Foundation, Navigation & Data Audit: kiểm kê menu/route, rà soát và phân loại chi tiết nhóm menu courses (loại bỏ 3 menu lâm sàng: Liệu trình, Hóa đơn, Lịch; đánh giá chuyển giao danh mục và báo cáo), xác định nguồn dữ liệu, migration strategy, dashboard foundation.
2. WP-02 – Medical Catalog & Configuration: danh mục y tế, bảng giá, thuốc, ICD-10, biểu mẫu; đánh giá tiếp nhận Danh mục bài tập và Danh mục gói liệu trình mẫu vào phạm vi CatalogManagementPage.jsx hiện tại (không tạo module danh mục mới ngoài phạm vi).
3. WP-03 – Staff, RBAC & Scheduling Administration: tài khoản, nhân sự, Role/Permission, cấu hình lịch làm việc.
4. WP-04 – Reports, Audit & Operational Data Access: dashboard, báo cáo, Audit Trail, data-access matrix.
5. WP-05 – E-Prescription Integration & Corporate Health: tách thành 2 PR độc lập: PR-06A (Backend Mock FSM tích hợp đơn thuốc quốc gia) và PR-06B (Frontend Khám đoàn & loại bỏ các route /admin/lieu-trinh và /admin/lieutrinh khỏi Admin Portal theo Phương án A; bảo đảm Admin không truy cập component lâm sàng; không sở hữu component lâm sàng hay xây dựng workspace/API cho Bác sĩ, KTV, Thu ngân).
Các workspace tiếp đón, khám, CLS và thu ngân được kiểm thử hồi quy để bảo đảm không bị ảnh hưởng bởi thay đổi Admin; chúng không trở thành gói chức năng Admin.
12. Definition of Ready for Planning
Chỉ chuyển sang /speckit-plan khi các điều kiện dưới đây được đáp ứng (Hiện tại: 7/8 tiêu chí ĐẠT [x], DoR-5 duy trì trạng thái MỞ [ ] có kiểm soát — Status: Planning Baseline Approved — Implementation Not Yet Authorized):
- [x] Phạm vi Admin thuần quản trị được thống nhất trong toàn bộ tài liệu (đã làm rõ phạm vi CorporateHealthPage.jsx; đã audit mã nguồn TreatmentCoursePage.jsx và phê duyệt Phương án A tách hoàn toàn khỏi Admin Portal, loại bỏ các route /admin/lieu-trinh và /admin/lieutrinh; không dùng điều kiện này để khẳng định các workspace nghiệp vụ tuyến đầu khác như Bác sĩ, KTV, Thu ngân đã hoàn thành).
- [x] Sáu User Stories và 35 Acceptance Scenarios được review, không còn nghiệp vụ tuyến đầu gán cho Admin (Chủ dự án đã phê duyệt chính thức ngày 2026-11-10; phê duyệt có điều kiện gắn với các OQ-1..OQ-8 tiếp tục giữ mở độc lập; không có nghiệp vụ tuyến đầu nào bị gán cho Admin Portal).
- [x] Data-access matrix chi tiết cho từng trường dữ liệu bệnh nhân, permission, mục đích và audit được hoàn tất (Chủ dự án đã phê duyệt đầy đủ 4 quyết định PO-01 đến PO-04 ngày 2026-11-10; toàn bộ ma trận §5.4 đã có phân định quyền rõ ràng; các yêu cầu kỹ thuật còn lại về mở rộng schema Audit và API guards được chuyển giao làm đầu vào bắt buộc cho giai đoạn Plan).
- [x] Ma trận Role/Permission và quy tắc ưu tiên grant/revoke được xác nhận ở mức nghiệp vụ: Explicit Deny > Explicit Allow > Role Grant > Default Deny; ADMIN là Role cao nhất, không cấp qua UI.
- [ ] Các Open Questions còn lại có owner, cách xác minh và tiêu chí chấp nhận; không đánh dấu hoàn tất chỉ vì đã chuyển sang Plan (đã phân công Owner TV1..TV5 và PO tại §10.3; giữ [ ] do các quyết định nghiệp vụ cụ thể về thời hạn retention, tham số cảnh báo lịch mềm và chính sách giá chuyển tiếp đang Chờ PO phê duyệt văn bản và xác minh pháp lý).
- [x] Yêu cầu pháp lý/tích hợp chưa có bằng chứng được đánh dấu cần xác minh, không coi là sự thật đã kiểm chứng (áp dụng adapter/mock và cờ xác minh).
- [x] Functional Requirements có ID duy nhất và truy vết được tới User Story/Acceptance Scenario (Đạt chuẩn ở cấp độ Tài liệu Đặc tả: 100% 46 FRs đã có chuỗi truy vết logic FR → US → AC → Task → Test trong Mục 5.9; phân định rõ: các bộ kiểm thử backend và các ca test frontend mới đang ở trạng thái PLANNED trong kế hoạch, chưa được implement hay execute trên runtime).
- [x] Success Criteria có thể kiểm thử và không dùng coverage/pass-rate đơn lẻ làm thước đo chất lượng (10 tiêu chí SC-001 đến SC-010 kiểm thử độc lập).