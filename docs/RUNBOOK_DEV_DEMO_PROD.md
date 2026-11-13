# HƯỚNG DẪN VẬN HÀNH MÔI TRƯỜNG DEV / DEMO / PRODUCTION
## HỆ THỐNG PHÒNG KHÁM CLINIC-AI

Tài liệu này hướng dẫn cách cấu hình và khởi chạy Clinic-AI trên các môi trường khác nhau sau khi đã áp dụng các tiêu chuẩn an toàn P0 (`ACT-P0-01` .. `ACT-P0-05`).

---

## 1. CÁC BIẾN MÔI TRƯỜNG BẮT BUỘC

Trước khi khởi động hệ thống, tạo tệp `.env` dựa trên `.env.example` với các thông số bắt buộc sau:

| Biến Môi Trường | Kiểu / Ràng Buộc | Ý Nghĩa / Giá Trị Khuyến Nghị |
| :--- | :--- | :--- |
| `SECRET_KEY` | `str` (tối thiểu 32 ký tự) | Khóa bí mật ký phát hành JWT Bearer Token. Bắt buộc phải có, hệ thống sẽ dừng (fail-closed) nếu thiếu hoặc ngắn hơn 32 ký tự. |
| `PAYMENT_WEBHOOK_SECRET` | `str` (tối thiểu 32 ký tự) | Khóa bí mật xác thực webhook thanh toán VietQR / PayOS. Bắt buộc tối thiểu 32 ký tự. |
| `ENVIRONMENT` | `development` / `staging` / `production` | Môi trường triển khai. Khi là `production`, cấm tuyệt đối mọi hoạt động nạp dữ liệu mẫu (`seed_data`) và khôi phục dữ liệu (`reset-demo`). |
| `ENABLE_DEMO_SEED` | `bool` (`true` / `false`) | Cờ cho phép nạp dữ liệu mẫu trên môi trường dev/staging. Mặc định `false`. Trên `production` luôn bị vô hiệu hóa bất kể cờ này là gì. |
| `ENABLE_OUTBOUND_NOTIFICATIONS` | `bool` (`true` / `false`) | Điều khiển việc gửi tin nhắn/email ngoại vi thực tế. Mặc định `false` (blackhole an toàn). Chỉ kích hoạt `true` khi kết nối hạ tầng thực tế. |
| `CLS_UPLOAD_DIR` | `str` đường dẫn thư mục | Thư mục lưu trữ tệp cận lâm sàng, mặc định `/app/uploads/cls` (được mount vào named volume `cls_uploads`). |

---

## 2. QUY TRÌNH KHỞI CHẠY MÔI TRƯỜNG DEVELOPMENT & DEMO SHOWCASE

### 2.1. Khởi động dịch vụ hạ tầng và backend
```bash
# Khởi chạy Database và Backend qua Docker Compose với cờ --env-file tường minh:
docker compose --env-file .env up -d db backend

# Trường hợp Dev Workflow cần mở cổng CSDL 5432 ra máy host để kết nối công cụ quản trị (DBeaver, psql):
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d db backend
# Hoặc khởi động tại thư mục backend:
cd backend && docker compose up -d db
```

Khi backend khởi động, hàm `lifespan` chỉ thực hiện kiểm tra kết nối CSDL (`SELECT 1`), **không tự động tạo bảng hay nạp dữ liệu ngầm**.

### 2.2. Nạp dữ liệu mẫu tổng hợp (Synthetic Demo Seed) có xác nhận kép
Chỉ thực hiện khi cần trình diễn (showcase) cho khách hàng trên môi trường local hoặc staging:

1. Đảm bảo file cấu hình truyền vào có `ENABLE_DEMO_SEED=true` và `ENVIRONMENT=development` (hoặc `staging`).
2. Chạy lệnh nạp dữ liệu với cờ xác nhận tường minh:
```bash
# Cách 1: Sử dụng script chuyên dụng
python -m backend.scripts.seed_demo --confirm-seed-demo

# Cách 2: Gọi trực tiếp seed_data
python backend/seed_data.py --confirm-seed-demo
```
*Lưu ý: Mọi fixture dữ liệu mẫu trong kho mã nguồn đều là dữ liệu tổng hợp (`is_synthetic: true`), không chứa thông tin danh tính công dân hay mật khẩu thực.*

### 2.3. Khởi động Frontend
```bash
cd fe
npm install
npm run dev
```

---

## 3. QUY TRÌNH TRIỂN KHAI PRODUCTION (KHÁCH HÀNG THỰC TẾ)

### 3.1. Thiết lập tệp cấu hình môi trường sản xuất (.env.production)
Tại thư mục gốc của dự án, thiết lập tệp `.env.production` (không commit lên Git):
```env
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=<chuoi_ngau_nhien_64_ky_tu_tao_boi_openssl_rand_hex_32>
PAYMENT_WEBHOOK_SECRET=<chuoi_ngau_nhien_64_ky_tu_bao_mat>
ENABLE_DEMO_SEED=false
ENABLE_OUTBOUND_NOTIFICATIONS=true
DATABASE_URL=postgresql+asyncpg://<prod_user>:<prod_password>@db:5432/<prod_db>
CLS_UPLOAD_DIR=/app/uploads/cls
```

### 3.2. Lệnh khởi chạy Production Container qua Docker Compose
Sử dụng cờ `--env-file` chỉ định đường dẫn tệp cấu hình production tuyệt đối hoặc tương đối:
```bash
docker compose --env-file .env.production up -d
```

> **Cơ chế nạp cấu hình Container**: Docker Compose sẽ đọc trực tiếp các giá trị từ tệp chỉ định qua `--env-file` và đẩy vào biến môi trường của container backend thông qua khai báo `environment:` trong `docker-compose.yml`:
> - `ENVIRONMENT=${ENVIRONMENT:-development}`
> - `BACKEND_CORS_ORIGINS=${BACKEND_CORS_ORIGINS:-http://localhost:3000,http://127.0.0.1:3000}`
> - `ENABLE_DEMO_SEED=${ENABLE_DEMO_SEED:-false}`
> - `ENABLE_OUTBOUND_NOTIFICATIONS=${ENABLE_OUTBOUND_NOTIFICATIONS:-false}`
> - `DEBUG=${DEBUG:-False}`
> 
> Nhờ đó, ứng dụng backend trong container nhận ngay `ENVIRONMENT=production` mà không phụ thuộc vào bind-mount tệp `.env` cục bộ.

### 3.3. Cơ chế bảo vệ dữ liệu sản xuất đã kích hoạt
1. **Khóa nạp dữ liệu demo**: Lệnh seed và endpoint `POST /api/v1/admin/reset-demo` bị chặn cứng ở mức máy chủ (trả về lỗi HTTP 403 Forbidden hoặc ném ngoại lệ dừng tiến trình).
2. **Không ghi ngầm khi tải dữ liệu**: Endpoint `GET /api/v1/admin/bootstrap` là thao tác hoàn toàn chỉ đọc (read-only projection), không ghi dữ liệu fixture vào bảng quan hệ.
3. **Frontend sạch 100%**: Bản build khách hàng (`fe/dist`) không chứa tài khoản hardcoded, mật khẩu thô, token giả hay nút bấm đăng nhập nhanh 1-click. Mọi người dùng phải xác thực bằng tài khoản hợp lệ do phòng khám cấp.
4. **Bảo toàn tệp cận lâm sàng**: Dữ liệu ảnh siêu âm, X-quang được lưu trong persistent volume `cls_uploads`, không bị mất khi khởi động lại hoặc nâng cấp container backend.
5. **Đóng cổng CSDL trên host**: Container PostgreSQL trong production `docker-compose.yml` không map cổng 5432 ra host bên ngoài, chỉ trao đổi trong mạng nội bộ `clinic_network`.
6. **Siết chặt CORS**: Chỉ cho phép các domain được khai báo trong `BACKEND_CORS_ORIGINS`, cấm hoàn toàn ký tự đại diện `*` khi dùng credentials.
7. **Container Healthcheck chuẩn hóa**: Dịch vụ backend tự động kiểm tra định kỳ `/health` phản ánh trực tiếp kết nối CSDL thực tế, trả về HTTP 503 khi CSDL mất kết nối để Docker đánh dấu container unhealthy.

---

## 4. BỘ KIỂM THỬ XÁC MINH SỰ SẴN SÀNG

Trước khi bàn giao hoặc đưa hệ thống vào vận hành, thực thi các kiểm thử kiểm chứng:

```bash
# 1. Kiểm thử sẵn sàng sản xuất (P0/P1 Readiness, Security, API Smoke)
cd backend
pytest tests/test_p0_readiness.py tests/test_p1_readiness.py tests/test_security.py tests/test_api_smoke.py tests/test_admin_system_configuration_hop2.py -v

# 2. Kiểm thử Frontend (72 unit tests)
cd ../fe
node --test tests/*.test.mjs

# 3. Đóng gói Frontend Production Bundle & kiểm tra sạch PII/Secret
npm run build
```
