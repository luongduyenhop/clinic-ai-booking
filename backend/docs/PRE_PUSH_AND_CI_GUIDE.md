# HƯỚNG DẪN KIỂM THỬ TRƯỚC KHI PUSH & QUY TRÌNH CI (GITHUB ACTIONS)
## Dành cho Toàn bộ Lập trình viên Nhóm 2 (Hợp, Tùng, An, Hoàng, Trọng)

---

## 1. TẠI SAO KHÔNG CẦN CHỤP ẢNH MÀ VẪN ĐẢM BẢO CODE CHUẨN?

Thay vì chụp ảnh màn hình thủ công gây mất thời gian và rườm rà, các dự án phần mềm hiện đại áp dụng quy trình **Automated Testing + Continuous Integration (CI)**:

* **Ở máy bạn (Local):** Bạn chỉ cần gõ đúng **1 dòng lệnh test** trước khi push. Mất đúng 2 giây để máy tự kiểm tra toàn bộ.
* **Trên GitHub (Cloud CI):** Máy chủ GitHub Actions sẽ tự động kéo code về, dựng CSDL PostgreSQL ảo và chạy lại toàn bộ bài kiểm tra.
  * Nếu đạt: Hiện **tích xanh (All checks have passed)** ✔️ $\rightarrow$ Nhóm trưởng bấm nút Merge.
  * Nếu hỏng: Hiện **dấu gạch chéo đỏ (Checks failed)** ❌ $\rightarrow$ GitHub tự động **khóa nút Merge**, bảo vệ nhánh chính không bao giờ bị lỗi.

```
[Máy của bạn] ──(pytest tests/)──> [git push] ──> [GitHub Actions CI] ──> [Tự động Verify & Merge]
```

---

## 2. QUY TRÌNH 2 BƯỚC CỦA THÀNH VIÊN TRƯỚC KHI PUSH CODE

Trước khi bạn gõ `git push origin feature/...`, hãy mở Terminal tại thư mục `backend/` và thực hiện:

### Bước 1: Chạy kiểm tra lỗi cú pháp (Syntax Check)
```bash
python -m py_compile app/main.py
```
*(Nếu terminal không báo lỗi gì tức là toàn bộ mã nguồn không bị lỗi thụt đầu dòng, không thiếu dấu hai chấm).*

### Bước 2: Chạy bộ kiểm thử tự động (Automated Tests)
```bash
pytest tests/ -v
```

**Màn hình mong đợi:**
```text
tests/test_security.py::test_password_hashing PASSED          [ 25%]
tests/test_security.py::test_otp_generation PASSED            [ 50%]
tests/test_security.py::test_jwt_token_encode_decode PASSED   [ 75%]
tests/test_ai_red_flags.py::test_vietnamese_normalization PASSED [100%]
============================== 10 passed in 1.45s ==============================
```
Khi thấy dòng **`PASSED` màu xanh lá cây**, bạn hoàn toàn yên tâm thực hiện:
```bash
git add .
git commit -m "feat: Xong API đặt lịch khám và kiểm tra slot trống"
git push origin feature/ten-nhanh-cua-ban
```

---

## 3. GITHUB ACTIONS CI SẼ LÀM GÌ TỰ ĐỘNG?

Dự án đã được cấu hình file `.github/workflows/ci.yml`. Mỗi khi bạn tạo **Pull Request (PR)** để gộp code vào `develop` hoặc `main`, GitHub sẽ tự động:

1. Dựng một máy chủ ảo Ubuntu sạch sẽ.
2. Khởi động một container **PostgreSQL 15** độc lập để thử nghiệm.
3. Cài đặt toàn bộ thư viện trong `requirements.txt`.
4. Dùng công cụ **Ruff** kiểm tra định dạng code xem có vi phạm tiêu chuẩn không.
5. Chạy toàn bộ các file trong thư mục `tests/`.
6. Nếu bất kỳ test case nào bị fail, GitHub sẽ chỉ rõ đích danh: **Ai làm hỏng, ở file nào, dòng số bao nhiêu**.
