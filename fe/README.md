# Quy chuẩn Giao diện & Câu chữ Clinic-AI (Frontend)

Tài liệu này khóa các quy tắc thiết kế và câu chữ sau đợt rà soát Design Lock. Tham khảo thêm hệ màu và density trong `src/theme/clinicTheme.js` và `src/index.css`.

## Quy tắc câu chữ trên giao diện (UI Copywriting)

1. **Viết hoa đúng chuẩn tiếng Việt:** Tiêu đề, nút bấm và nhãn chỉ viết hoa chữ cái đầu câu và tên riêng (ví dụ `"Đăng nhập nhân viên"`, không viết `"Đăng Nhập Ca Trực"`).
2. **Không nối tiêu đề bằng dấu `&`:** Dùng `"và"`, dấu phẩy, hoặc tách thành hai ý rõ ràng.
3. **Số đếm không có số `0` đứng trước:** Viết `5 khoa`, `4 bước`, `2 lượt`, `8 giờ`, `6 tháng` (chỉ giữ số `0` đứng đầu cho định dạng giờ/ngày cố định như `07:30`, `02/11/2026`).
4. **Ưu tiên tiếng Việt hoàn toàn:** Không dùng từ đệm tiếng Anh khi đã có chữ Việt tương đương (ví dụ `"Active"` → `"đang làm việc"`, `"BI"` → `"Tổng quan"`).
5. **Thông báo ngắn gọn, trung tính:** Toast và thông báo trạng thái không dùng dấu chấm than (`!`) và không chào hỏi dài dòng (ví dụ `"Đã đăng nhập"`).
6. **Thông báo lỗi thân thiện:** Không đưa nguyên văn `error.message` kỹ thuật (như `"Network Error"`, `"Request failed with status code 500"`) lên màn hình; giải thích ngắn gọn điều gì vừa xảy ra và người dùng cần làm gì tiếp theo qua `toFriendlyErrorMessage` (`src/utils/helpers/clientErrorHelper.js`).
7. **Tránh từ ngữ sáo rỗng:** Hạn chế dùng các cụm từ chung chung như `"khép kín"`, `"trọn vẹn"`, `"hợp nhất"`, `"thời gian thực"`.

## Kiểm thử tự động

Chạy trước khi commit hoặc mở PR:

```bash
npm --prefix fe run lint
npm --prefix fe test
npm --prefix fe run build
```
