# Triển khai bản demo trên VPS

Bản demo dùng cơ sở dữ liệu riêng và các tài khoản thử nghiệm. Chỉ nhập hồ sơ, ảnh và thông tin thanh toán giả. Dùng đường hầm SSH để kiểm thử trước. Chỉ bật truy cập HTTPS qua tên miền khi người vận hành đã kiểm tra xong và có danh sách IP được phép truy cập.

## 1. Chuẩn bị

Trên VPS Linux, cài Docker Engine, Docker Compose v2 và OpenSSL. Chuẩn bị thư mục chứa bản mã đã duyệt và quyền chạy Docker. Các lệnh dưới đây chạy từ thư mục gốc của dự án. Đặt `COMPOSE_PROJECT_NAME` riêng cho từng bản demo để tách container và ổ dữ liệu. Đổi `DEMO_PORT` nếu cổng 3000 đang được sử dụng.

Tạo tệp cấu hình lần đầu. Lệnh tạo bốn giá trị ngẫu nhiên riêng và giữ lại tệp hiện có nếu chạy lại.

```bash
(
  set -eC
  umask 077
  {
    grep -vE '^(POSTGRES_PASSWORD|SECRET_KEY|PAYMENT_WEBHOOK_SECRET|DEMO_PASSWORD)=' .env.demo.example
    for key in POSTGRES_PASSWORD SECRET_KEY PAYMENT_WEBHOOK_SECRET DEMO_PASSWORD; do
      value=$(openssl rand -hex 32)
      printf '%s=%s\n' "$key" "$value"
    done
  } > .env.demo
)
```

Giữ `.env.demo` với quyền `0600` và chia sẻ mật khẩu demo qua kênh riêng. Giữ nguyên mật khẩu PostgreSQL của ổ dữ liệu đã khởi tạo. Đổi giá trị trong tệp cấu hình không cập nhật mật khẩu của PostgreSQL đang chạy.

## 2. Khởi động và kiểm tra qua SSH

```bash
docker compose --env-file .env.demo config --quiet
docker compose --env-file .env.demo up -d --build --wait --wait-timeout 150
docker compose --env-file .env.demo ps -a
docker compose --env-file .env.demo logs --tail=50 bootstrap backend
curl --fail --silent --show-error http://127.0.0.1:3000/healthz
```

`bootstrap` tạo cấu trúc hiện tại trên PostgreSQL trống, ghi phiên bản Alembic, rồi nạp dữ liệu demo. Những lần sau chỉ chạy với DB đã được đánh dấu dành riêng cho demo. Khi hoàn tất, dịch vụ này có trạng thái `Exited (0)`. Backend đợi bước này thành công, Nginx đợi backend qua kiểm tra sức khỏe. Chỉ giao diện được ánh xạ lên máy chủ và chỉ lắng nghe ở `127.0.0.1`. Thay cổng 3000 trong lệnh kiểm tra nếu đã đổi `DEMO_PORT`.

Trên máy cá nhân, mở đường hầm rồi vào `http://127.0.0.1:3000` trong trình duyệt.

```bash
ssh -N -L 127.0.0.1:3000:127.0.0.1:3000 user@IP_VPS
```

Tất cả tài khoản dùng giá trị `DEMO_PASSWORD` từ tệp cấu hình.

| Vai trò | Email | Đường dẫn đăng nhập |
| --- | --- | --- |
| Quản trị viên | `admin.demo@clinic-ai.test` | `/staff/login` |
| Bác sĩ | `doctor.demo@clinic-ai.test` | `/staff/login` |
| Lễ tân | `letan.demo@clinic-ai.test` | `/staff/login` |
| Kỹ thuật viên | `ktv.demo@clinic-ai.test` | `/staff/login` |
| Thu ngân | `thungan.demo@clinic-ai.test` | `/staff/login` |
| Bệnh nhân | `patient01@clinic-ai.test` | `/login` |

1. Lễ tân mở Tiếp đón, tìm `LK-DEMO-TIEP-DON` và làm thủ tục cho bệnh nhân mẫu.
2. Bác sĩ mở Bàn khám, gọi số vừa tiếp đón, nhập sinh hiệu và chọn một chẩn đoán chính. Gửi chỉ định chụp X-quang hoặc siêu âm để thử cận lâm sàng.
3. Kỹ thuật viên mở nhóm Chẩn đoán hình ảnh, tiếp nhận chỉ định, tải ảnh giả, nhập mô tả và kết luận. Hoàn tất rồi duyệt để trả kết quả. Bác sĩ gọi lại bệnh nhân và hoàn tất ca khám.
4. Thu ngân mở trang Thu viện phí, chọn hóa đơn mẫu `HD-DEMO-CLS` hoặc lập hóa đơn cho ca vừa hoàn tất rồi ghi nhận tiền mặt thử nghiệm.

Đăng ký công khai, gửi email, VietQR, ký số và liên thông đơn thuốc được tắt trong bản demo. Đơn thuốc có thể lưu nháp. Kiểm tra cả sáu tài khoản vào đúng khu vực trước khi chia sẻ.

## 3. Chia sẻ qua tên miền HTTPS

Giữ nguyên ánh xạ `127.0.0.1` của Compose. Trỏ DNS của tên miền demo về VPS, mở TCP 80 và 443 cho reverse proxy (máy chủ nhận truy cập từ Internet), rồi giới hạn truy cập tại proxy. Ví dụ với Caddy chạy trực tiếp trên VPS và nhận kết nối từ người dùng.

```caddyfile
demo.example.com {
    @demo_users remote_ip 203.0.113.10/32 198.51.100.20/32
    handle @demo_users {
        reverse_proxy 127.0.0.1:3000
    }
    handle {
        respond "Forbidden" 403
    }
}
```

Thay tên miền, hai IP ví dụ và cổng theo cấu hình thực tế. Xác thực và tải lại cấu hình Caddy sau khi cập nhật.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Kiểm tra trình duyệt truy cập được qua HTTPS từ một IP trong danh sách và nhận HTTP 403 từ một IP bên ngoài. Các yêu cầu API đi cùng tên miền giao diện. Nếu người thử dùng IP thay đổi thường xuyên, dùng đường hầm SSH hoặc VPN thay cho ví dụ giới hạn IP trực tiếp.

## 4. Vận hành

- Kiểm tra trạng thái container và `/healthz` sau mỗi lần cập nhật. Khi bootstrap lỗi, xem log dịch vụ này và sửa nguyên nhân trước khi chạy lại `up`.
- Volume `postgres_data` giữ PostgreSQL và `cls_uploads` giữ tệp ảnh. Dùng `docker compose --env-file .env.demo stop` để dừng tạm thời và `docker compose --env-file .env.demo up -d` để chạy lại.
- Nếu cần giữ kết quả buổi demo, sao lưu cả DB và volume ảnh trong cùng khoảng dừng ghi trước khi cập nhật. Lưu bản sao cùng phiên bản mã và giữ tệp cấu hình riêng. Khi cập nhật có migration thất bại, kiểm tra phiên bản DB và khả năng tương thích trước khi chạy lại bản mã cũ.
