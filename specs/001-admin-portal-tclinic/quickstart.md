# Developer Quickstart: Phân hệ Quản trị viên (Admin Portal)

**Feature**: `001-admin-portal-tclinic` | **Date**: 2026-11-10

---

## 1. Môi trường Phát triển & Yêu cầu Tiên quyết

1. **Backend**:
   - Python 3.11+
   - Thư mục ảo: `clinic-ai/backend/.venv`
   - Cơ sở dữ liệu: PostgreSQL (chạy local hoặc Docker)
2. **Frontend**:
   - Node.js 18+
   - Thư mục: `clinic-ai/fe`

---

## 2. Khởi tạo Dữ liệu Mẫu An toàn (Seed Data)

Khi bắt đầu hoặc sau khi reset database, chạy script CLI độc lập:

```powershell
cd clinic-ai/backend
.venv\Scripts\python.exe scripts/seed_admin_demo.py --reset
```

> [!NOTE]
> Cờ `--reset` chỉ hoạt động trên môi trường `dev`/`test` và bảo tồn nguyên vẹn toàn bộ tài khoản đăng nhập hiện có trong bảng `nguoi_dung`.

Nếu chỉ muốn bổ sung dữ liệu mà không xóa dữ liệu cũ:
```powershell
.venv\Scripts\python.exe scripts/seed_admin_demo.py --append
```

---

## 3. Khởi động Ứng dụng Kiểm thử

### 3.1 Khởi động Backend
```powershell
cd clinic-ai/backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
Tài liệu Swagger API: `http://localhost:8000/docs`

### 3.2 Khởi động Frontend
```powershell
cd clinic-ai/fe
npm run dev
```
Truy cập: `http://localhost:5173/admin` với tài khoản `admin@clinic.com`

---

## 4. Chạy Kiểm thử Hồi quy Tự động (Regression Tests)

Trước khi commit và mở PR, mỗi thành viên bắt buộc phải chạy bộ test kiểm tra:

### 4.1 Kiểm thử Frontend
```powershell
cd clinic-ai/fe
npm test
node tests/prRegressionGuard.test.mjs
```

### 4.2 Kiểm thử Backend
```powershell
cd clinic-ai/backend
.venv\Scripts\pytest.exe tests/
```

---

## 5. Quy trình Mở Pull Request (Chống Xung đột Code)

1. Tạo nhánh riêng từ `origin/develop`:
   ```bash
   git fetch origin
   git checkout -b feature/admin-wp01-bi-dashboard origin/develop
   ```
2. Giữ phạm vi PR nhỏ, tập trung đúng vào tệp được phân quyền theo CODEOWNERS.
3. Trước khi mở PR, luôn rebase:
   ```bash
   git fetch origin
   git rebase origin/develop
   ```
4. Tuyệt đối không chèn comment trong mã nguồn (`#`, `//`, `/* */`) và không viết docstring.
