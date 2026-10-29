# HƯỚNG DẪN VÁ LỖ HỔNG BẢO MẬT RBAC & IDOR (DÀNH CHO CÁC NHÁNH KHÁC)

Tài liệu này ghi lại chi tiết các điểm đã sửa chữa để vượt qua vòng kiểm duyệt bảo mật của **Hội Đồng AI (GitHub Copilot & Google Gemini Pro)** theo phản hồi trên **PR #43**.

---

## 📌 Tổng Quan Các Lỗ Hổng Được Khắc Phục

| STT | Endpoint | Lỗ Hổng | Tác Động / Rủi Ro | Phân Quyền Đúng |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `POST /api/v1/cashier/refund` | **Thiếu RBAC** | Mọi người dùng đã đăng nhập (kể cả bệnh nhân, bác sĩ) đều có thể kích hoạt hoàn tiền viện phí | `LE_TAN`, `THU_NGAN`, `ADMIN` |
| **2** | `GET /api/v1/reception/appointments` | **Thiếu RBAC** | Bệnh nhân thông thường có thể xem danh sách toàn bộ lịch hẹn trong ca (lộ SĐT, Họ tên BN khác) | `LE_TAN`, `ADMIN`, `BAC_SI`, `THU_NGAN` |
| **3** | `GET /api/v1/reception/patients/{id}/packages` | **Lỗ hổng IDOR** | Bệnh nhân A có thể xem danh sách gói khám của Bệnh nhân B bằng cách đổi `benh_nhan_id` trên URL | Bệnh nhân chỉ xem của chính mình; Nhân viên (`LE_TAN`, `ADMIN`, `BAC_SI`, `THU_NGAN`, `KY_THUAT_VIEN`) được xem tất cả |
| **4** | `GET /api/v1/reception/patients/{id}/history-summary` | **Lỗ hổng IDOR** | Bệnh nhân A có thể xem tóm tắt lịch sử khám, chẩn đoán, cảnh báo no-show của Bệnh nhân B | Bệnh nhân chỉ xem của chính mình; Nhân viên y tế được xem tất cả |

---

## 🛠️ Chi Tiết Các Chỗ Đã Sửa (Code Diff Cụ Thể)

### 1. File `app/routers/cashier.py`

#### A. Import thêm `ForbiddenException` và `VaiTroEnum`:
```python
# Trước khi sửa:
from app.models.user import TaiKhoan

# Sau khi sửa:
from app.core.exceptions import ForbiddenException
from app.models.user import TaiKhoan, VaiTroEnum
```

#### B. Thêm kiểm tra quyền tại endpoint `refund_invoice`:
```python
# Vị trí: @router.post("/refund")
async def refund_invoice(
    payload: RefundInvoiceRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # >>> THÊM KIỂM TRA RBAC DƯỚI ĐÂY <<<
    if current_user.vai_tro not in (
        VaiTroEnum.LE_TAN.value,
        VaiTroEnum.THU_NGAN.value,
        VaiTroEnum.ADMIN.value,
    ):
        raise ForbiddenException("Chỉ Thu ngân, Lễ tân hoặc Quản trị viên mới có quyền thực hiện hoàn tiền viện phí!")

    result = await cashier_service.refund_invoice(
        payload=payload,
        thu_ngan_user_id=current_user.nguoi_dung_id,
        db=db
    )
    return ResponseEnvelope.success_response(...)
```

---

### 2. File `app/routers/reception.py`

#### A. Import thêm `select`, `ForbiddenException`, `BenhNhan`, `VaiTroEnum`:
```python
# Trước khi sửa:
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan

# Sau khi sửa:
from app.core.database import get_db
from app.core.dependencies import get_current_user
from sqlalchemy import select
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import BenhNhan, TaiKhoan, VaiTroEnum
```

#### B. Chặn truy cập trái phép tại `GET /appointments`:
```python
# Vị trí: @router.get("/appointments")
async def get_reception_appointments(
    query_date: Optional[date] = Query(None, description="Lọc theo ngày khám"),
    ca_kham: Optional[str] = Query(None, description="Lọc theo ca khám: sang hoặc chieu"),
    bac_si_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái lịch"),
    search: Optional[str] = Query(None, description="Từ khóa: tên bệnh nhân, SĐT, mã hẹn"),
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(20, ge=1, le=100, description="Kích thước trang"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # >>> THÊM KIỂM TRA RBAC DƯỚI ĐÂY <<<
    if current_user.vai_tro not in (
        VaiTroEnum.LE_TAN.value,
        VaiTroEnum.ADMIN.value,
        VaiTroEnum.BAC_SI.value,
        VaiTroEnum.THU_NGAN.value,
    ):
        raise ForbiddenException("Chỉ Lễ tân, Bác sĩ, Thu ngân hoặc Quản trị viên mới có quyền tra cứu danh sách lịch hẹn tại quầy!")

    result = await queue_service.get_reception_appointments(...)
```

#### C. Thêm hàm Helper kiểm tra IDOR:
Đặt ngay phía trên section FC-17:
```python
async def _verify_patient_history_and_package_access(
    benh_nhan_id: int,
    current_user: TaiKhoan,
    db: AsyncSession
) -> None:
    """Ngăn chặn lỗ hổng IDOR: Cho phép nhân viên y tế tra cứu, bệnh nhân chỉ được xem hồ sơ của chính mình."""
    staff_roles = {
        VaiTroEnum.LE_TAN.value,
        VaiTroEnum.THU_NGAN.value,
        VaiTroEnum.ADMIN.value,
        VaiTroEnum.BAC_SI.value,
        VaiTroEnum.KY_THUAT_VIEN.value,
    }
    # Nhân viên nghiệp vụ y tế -> cho phép tra cứu
    if current_user.vai_tro in staff_roles:
        return

    # Người dùng là Bệnh nhân -> Bắt buộc ID người bệnh phải khớp với tài khoản
    if current_user.vai_tro == VaiTroEnum.BENH_NHAN.value:
        stmt = select(BenhNhan.id).where(BenhNhan.nguoi_dung_id == current_user.nguoi_dung_id)
        own_bn_id = (await db.execute(stmt)).scalar_one_or_none()
        if own_bn_id != benh_nhan_id:
            raise ForbiddenException("Bạn không có quyền truy cập hồ sơ của bệnh nhân khác!")
        return

    raise ForbiddenException("Bạn không có quyền truy cập thông tin bệnh nhân!")
```

#### D. Gọi Helper IDOR trong 2 Endpoint FC-17:
```python
# 1. Endpoint tra cứu gói khám:
@router.get("/patients/{benh_nhan_id}/packages", ...)
async def get_patient_packages(
    benh_nhan_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # >>> GỌI XÁC THỰC QUYỀN SỞ HỮU <<<
    await _verify_patient_history_and_package_access(benh_nhan_id, current_user, db)
    result = await queue_service.get_patient_packages(benh_nhan_id, db)
    ...

# 2. Endpoint tra cứu tóm tắt lịch sử khám:
@router.get("/patients/{benh_nhan_id}/history-summary", ...)
async def get_patient_history_summary(
    benh_nhan_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # >>> GỌI XÁC THỰC QUYỀN SỞ HỮU <<<
    await _verify_patient_history_and_package_access(benh_nhan_id, current_user, db)
    result = await queue_service.get_patient_history_summary(benh_nhan_id, db)
    ...
```

---

## 🧪 Bộ Test Tự Động Xác Nhận (Regression & Security Test)

File test: `tests/test_pr43_security_patches.py`

Khi chuyển nhánh mới, bạn có thể copy file `tests/test_pr43_security_patches.py` sang nhánh đó và chạy lệnh:
```bash
pytest tests/test_pr43_security_patches.py
```
hoặc chạy qua Docker:
```bash
docker run --rm -v "${PWD}:/app" clinic-ai-booking-backend pytest tests/test_pr43_security_patches.py
```

Các ca kiểm thử bao gồm:
1. `test_post_cashier_refund_rbac_denies_patient_and_doctor`: Kiểm tra 403 khi Bệnh nhân hoặc Bác sĩ gọi `/cashier/refund`.
2. `test_post_cashier_refund_rbac_allows_authorized_roles`: Kiểm tra Thu ngân, Lễ tân, Admin được phép gọi hoàn tiền.
3. `test_get_reception_appointments_rbac_denies_patient`: Kiểm tra 403 khi Bệnh nhân gọi `/reception/appointments`.
4. `test_get_reception_appointments_rbac_allows_staff`: Kiểm tra Lễ tân, Bác sĩ, Admin tra cứu danh sách lịch hẹn thành công (200 OK).
5. `test_idor_protection_patient_packages`: Kiểm tra Bệnh nhân A xem gói của Bệnh nhân B bị chặn 403; Bệnh nhân A xem của mình và Lễ tân xem đều được 200 OK.
6. `test_idor_protection_patient_history_summary`: Kiểm tra Bệnh nhân A xem tóm tắt lịch sử của Bệnh nhân B bị chặn 403; Bệnh nhân A xem của mình và Bác sĩ/Admin xem đều được 200 OK.

