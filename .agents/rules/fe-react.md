---
trigger: always_on
---

AGENT WORKFLOW
BƯỚC 1 ĐỌC NGỮ CẢNH: Khi nhận bất kỳ yêu cầu phát triển hoặc sửa đổi nào, phải đọc AGENTS.md, ARCHITECTURE.md, package.json và các file liên quan trước khi thực hiện
BƯỚC 2 HIỂU YÊU CẦU: Xác định chính xác người dùng muốn phát triển gì, sửa gì, mục tiêu là gì và phạm vi thay đổi là gì
BƯỚC 3 KIỂM TRA CODE HIỆN TẠI: Tìm kiếm component, hook, service, API, Redux slice, selector, utility, route và logic tương tự đã tồn tại trước khi tạo mới
BƯỚC 4 KHÔNG ĐƯỢC ĐOÁN: Không được tự đoán business rule, API contract, response structure, UI behavior, state behavior, authentication, authorization hoặc cách xử lý lỗi khi thông tin chưa rõ
BƯỚC 5 HỎI KHI CÓ NGHI VẤN: Nếu có bất kỳ điểm nào chưa rõ hoặc có nhiều cách triển khai hợp lý, phải dừng lại và hỏi người dùng
BƯỚC 6 KHÔNG CODE KHI CÒN CÂU HỎI: Khi còn requirement chưa rõ hoặc chưa đủ thông tin để triển khai chính xác thì tuyệt đối không được bắt đầu code
BƯỚC 7 PHÂN TÍCH KIẾN TRÚC: Xác định tính năng hoặc thay đổi thuộc layer nào, ảnh hưởng đến component, state, Redux, API, router, authentication, UI hoặc module nào
BƯỚC 8 KIỂM TRA TÍNH NHẤT QUÁN: Phải tuân thủ kiến trúc, convention, cách đặt tên, cấu trúc thư mục và cách tổ chức code đang có trong project
BƯỚC 9 LẬP KẾ HOẠCH: Trước khi code phải đưa ra implementation plan gồm mục tiêu, file cần tạo, file cần sửa, trách nhiệm của từng file, luồng dữ liệu, state flow, API flow, xử lý loading, error, empty state, edge cases và testing
BƯỚC 10 GIẢI THÍCH: Giải thích ngắn gọn lý do chọn cách triển khai và ảnh hưởng của thay đổi đối với kiến trúc hiện tại
BƯỚC 11 CHỜ XÁC NHẬN: Sau khi đưa plan phải chờ người dùng xác nhận, chưa có xác nhận thì không được sửa code
BƯỚC 12 BẮT ĐẦU CODE: Chỉ sau khi người dùng xác nhận mới triển khai theo đúng plan đã thống nhất
BƯỚC 13 GIỮ ĐÚNG PHẠM VI: Chỉ sửa hoặc tạo những phần cần thiết cho yêu cầu đã xác nhận, không tự ý refactor, đổi tên, đổi kiến trúc hoặc sửa các phần không liên quan
BƯỚC 14 ƯU TIÊN CODE HIỆN CÓ: Luôn reuse và mở rộng abstraction hiện tại khi phù hợp, không tạo code trùng lặp
BƯỚC 15 KHÔNG TẠO DEPENDENCY TÙY TIỆN: Không tự ý cài package mới, nếu cần package mới phải giải thích lý do và hỏi xác nhận trước
BƯỚC 16 COMPONENT RESPONSIBILITY: Component React chủ yếu xử lý rendering, presentation, composition và user interaction, không đưa business logic phức tạp hoặc logic dùng chung vào JSX
BƯỚC 17 API RESPONSIBILITY: Không gọi API trực tiếp trong component nếu project đã có API layer hoặc service phù hợp
BƯỚC 18 STATE RESPONSIBILITY: Chỉ đưa state vào Redux khi dữ liệu cần dùng chung hoặc thuộc application state, state chỉ phục vụ một component hoặc một phạm vi nhỏ nên ưu tiên local state
BƯỚC 19 REDUX RESPONSIBILITY: Redux Toolkit dùng cho global state và shared state, không nhét mọi state của UI vào Redux và không đưa business logic không phù hợp vào slice
BƯỚC 20 FORM RESPONSIBILITY: Với form phải tuân thủ cách project đang sử dụng Formik và Yup, không tự tạo một cơ chế validation khác nếu không có lý do rõ ràng
BƯỚC 21 UI RESPONSIBILITY: Ưu tiên Ant Design và Tailwind CSS 4 theo convention hiện tại của project, không tự ý đưa thêm UI library khác
BƯỚC 22 ROUTING RESPONSIBILITY: Khi thay đổi route phải kiểm tra route configuration, navigation, protected route và các nơi đang sử dụng route đó
BƯỚC 23 AUTHENTICATION: Không tự suy đoán cách lưu token, refresh token, current user, permission hoặc logout flow, phải đọc code hiện tại và hỏi người dùng khi behavior chưa rõ
BƯỚC 24 SIGNALR: Khi làm realtime phải kiểm tra abstraction và connection management hiện tại trước khi tạo connection hoặc event handler mới
BƯỚC 25 JAVASCRIPT: Project sử dụng JavaScript, không tự chuyển code sang TypeScript, không tạo file TypeScript và không thêm TypeScript chỉ để giải quyết một vấn đề
BƯỚC 26 TÍNH NHẤT QUÁN: Code mới phải có style, naming, folder structure và pattern nhất quán với code hiện tại
BƯỚC 27 KHÔNG WORKAROUND BỪA BÃI: Khi sửa bug phải tìm nguyên nhân gốc trước, không dùng workaround để che giấu lỗi hoặc tạo thêm technical debt
BƯỚC 28 XUNG ĐỘT KIẾN TRÚC: Nếu yêu cầu không thể triển khai đúng kiến trúc hiện tại thì phải dừng, giải thích vấn đề và đề xuất thay đổi trước khi code
BƯỚC 29 THAY ĐỔI KIẾN TRÚC: Mọi thay đổi lớn liên quan đến folder structure, state management, API architecture, routing architecture, dependency strategy hoặc convention phải được người dùng xác nhận trước
BƯỚC 30 KHÔNG SỬA LAN MAN: Nếu phát hiện vấn đề khác không liên quan đến task thì không tự ý sửa, chỉ báo lại cho người dùng
BƯỚC 31 SELF REVIEW: Sau khi code xong phải tự review như một senior React developer và kiểm tra architecture, responsibility, duplicated logic, unnecessary complexity, state ownership, API usage và security
BƯỚC 32 KIỂM TRA REACT: Kiểm tra hooks, dependencies, rendering, state flow, event handling và các thay đổi có thể gây re-render không cần thiết
BƯỚC 33 KIỂM TRA REDUX: Kiểm tra slice, reducer, action, selector và state ownership có đúng với kiến trúc hay không
BƯỚC 34 KIỂM TRA API: Kiểm tra request, response handling, error handling, loading handling và việc sử dụng API abstraction có đúng pattern hay không
BƯỚC 35 KIỂM TRA UI: Khi phù hợp phải kiểm tra loading state, error state, empty state, validation state và responsive behavior
BƯỚC 36 KIỂM TRA CODE: Sau khi hoàn thành phải chạy các kiểm tra phù hợp như lint, test và build
BƯỚC 37 TRUNG THỰC KHI TEST: Không được nói đã test, build hoặc kiểm tra nếu thực tế chưa chạy
BƯỚC 38 XỬ LÝ LỖI: Nếu lint, test hoặc build thất bại phải báo rõ lỗi, nguyên nhân, phần đã sửa và phần còn chưa giải quyết
BƯỚC 39 BÁO CÁO CUỐI: Sau khi hoàn thành phải báo đã làm gì, file nào thay đổi, kiến trúc bị ảnh hưởng ở đâu, kết quả kiểm tra và các vấn đề còn tồn tại
BƯỚC 40 QUY TẮC ƯU TIÊN: Độ chính xác của requirement và tính đúng đắn của kiến trúc quan trọng hơn tốc độ hoàn thành task
BƯỚC 41 QUY TẮC DỪNG: Khi không chắc chắn thì dừng và hỏi, không được tự suy diễn để tiếp tục
BƯỚC 42 MỤC TIÊU: Không chỉ làm cho chức năng chạy được mà phải đảm bảo code đúng kiến trúc, đúng responsibility, dễ bảo trì, không trùng lặp và phù hợp với toàn bộ project