# HƯỚNG DẪN VÁ LỖ HỔNG BẢO MẬT RBAC, IDOR, RACE CONDITION & SỬA LỖI ASYNC ORM MISSINGGREENLET

Tài liệu này ghi lại chi tiết các điểm đã sửa chữa để vượt qua vòng kiểm duyệt kỹ thuật & bảo mật của **Hội Đồng AI (GitHub Copilot & Google Gemini Pro)** cho **PR #43** và **PR #48**, bao gồm cả **3 Điểm Thống Nhất Bắt Buộc Sửa (Blocking Action Items)**.

---

## 📌 Tổng Quan Các Lỗi Được Khắc Phục

| STT | Vị Trí / Endpoint | Loại Lỗi | Nguy Cơ & Nguyên Nhân | Giải Pháp Khắc Phục Chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `POST /cashier/refund` | **Thiếu RBAC** | Mọi tài khoản (kể cả bệnh nhân, bác sĩ) đều có thể kích hoạt hoàn tiền | Dùng Dependency `Depends(require_roles([VaiTroEnum.LE_TAN, VaiTroEnum.THU_NGAN, VaiTroEnum.ADMIN]))` |
| **2** | `GET /reception/patients/{id}/packages` & `/history-summary` | **Lỗ hổng IDOR** | Bệnh nhân xem được hồ sơ & gói dịch vụ của người khác khi đổi ID trên URL | Bệnh nhân chỉ xem chính mình; Nhân viên y tế được tra cứu tất cả |
| **3** | `GET /reception/appointments`, `/flow-board`, `/dashboard/*`, `/resources/*` | **Thiếu RBAC** | Bệnh nhân có thể xem toàn bộ lịch hẹn, buồng khám, nhân sự và luồng tiếp đón nội bộ | Giới hạn quyền cho nhân viên phòng khám (`LE_TAN`, `ADMIN`, `BAC_SI`, `THU_NGAN`) |
| **4** | `GET /reception/queue/{doctor_id}` | **Thiếu Auth & RBAC** | Thiếu dependency xác thực người dùng | Bổ sung `current_user = Depends(get_current_user)` và chặn role ngoài y tế |
| **5** | `app/services/queue_service.py` (`call_next_patient`, `postpone_ticket`, `restore_ticket`, `check_in_patient`) | **Async ORM MissingGreenlet** | Sau `await db.commit()` trong SQLAlchemy 2.0 Async, ORM entity bị detach/expire, gọi `_to_ticket_response` truy cập lazy relation gây crash runtime | Dùng `await self._get_ticket_with_relations(ticket_id, db)` nạp eager-loading đầy đủ |
| **6** | `app/services/cashier_service.py` | **Missing Import** | Thiếu `BadRequestException` khi chặn hoàn tiền hóa đơn chưa thu | Bổ sung import `BadRequestException` từ `app.core.exceptions` |
| **7** | `app/services/queue_service.py` (`check_in_walk_in`) | **Lỗi Logic Phân Bổ (Critical)** | Khi `bac_si_id=None`, không kiểm tra kỹ `chuyen_khoa_id` trước khi gọi load balancing gây ra `ConflictException` mập mờ | Kiểm tra `if not payload.chuyen_khoa_id: raise BadRequestException(...)` và kiểm tra sự tồn tại của `ChuyenKhoa` ngay đầu hàm |
| **8** | `app/services/incident_service.py` (`rebalance_queue`) | **Lỗ hổng Bảo mật Multi-Tenancy** | Lễ tân buồng này có thể can thiệp điều phối bệnh nhân thuộc buồng/phòng khám khác | Kiểm tra `phong_kham_id` của bác sĩ vắng mặt so với `phong_kham_id` của `current_user` (nếu không phải ADMIN) |
| **9** | `app/services/queue_service.py` (`check_in_walk_in`) | **Race Condition Concurrency** | Nhiều lễ tân check-in cùng lúc cho 1 bác sĩ sẽ sinh trùng `so_thu_tu_kham` và `ma_lich_kham` | Bọc truy vấn bác sĩ với `select(BacSi).where(...).with_for_update()` |

---

## 🛠️ Chi Tiết Code Đã Sửa (Code Diff)

### 1. `app/routers/cashier.py`

> [!NOTE]
> `require_roles` trong `app.core.dependencies` bản chất là một factory trả về dependency `role_checker(current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan`. Do đó, khi inject vào endpoint chỉ cần truyền `current_user: TaiKhoan = Depends(require_roles([...]))` chứ không lồng 2 hàm trong cùng 1 `Depends`.

```python
# Bổ sung import:
from app.core.dependencies import get_current_user, require_roles
from app.models.user import TaiKhoan, VaiTroEnum

# Áp dụng require_roles trực tiếp qua Depends:
@router.post(
    "/refund",
    response_model=ResponseEnvelope[RefundInvoiceResponse],
    summary="Hoàn tiền viện phí và lập phiếu chi trả lại bệnh nhân (FC-16)"
)
async def refund_invoice(
    payload: RefundInvoiceRequest,
    current_user: TaiKhoan = Depends(require_roles([
        VaiTroEnum.LE_TAN,
        VaiTroEnum.THU_NGAN,
        VaiTroEnum.ADMIN,
    ])),
    db: AsyncSession = Depends(get_db)
):
    result = await cashier_service.refund_invoice(
        payload=payload,
        thu_ngan_user_id=current_user.nguoi_dung_id,
        db=db
    )
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Hoàn tiền thành công {result.so_tien_hoan:,.0f}đ cho hóa đơn {result.ma_hoa_don}"
    )
```

---

### 2. `app/routers/reception.py`

#### A. Định nghĩa hằng số nhóm vai trò:
```python
RECEPTION_STAFF_ROLES = (
    VaiTroEnum.LE_TAN.value,
    VaiTroEnum.ADMIN.value,
    VaiTroEnum.BAC_SI.value,
    VaiTroEnum.THU_NGAN.value,
)

RECEPTION_ADMIN_ROLES = (
    VaiTroEnum.LE_TAN.value,
    VaiTroEnum.ADMIN.value,
)

QUEUE_VIEW_ROLES = (
    VaiTroEnum.LE_TAN.value,
    VaiTroEnum.ADMIN.value,
    VaiTroEnum.BAC_SI.value,
    VaiTroEnum.THU_NGAN.value,
    VaiTroEnum.KY_THUAT_VIEN.value,
)
```

#### B. Chống IDOR cho hồ sơ bệnh nhân:
```python
async def _verify_patient_history_and_package_access(
    benh_nhan_id: int,
    current_user: TaiKhoan,
    db: AsyncSession
) -> None:
    staff_roles = {
        VaiTroEnum.LE_TAN.value,
        VaiTroEnum.THU_NGAN.value,
        VaiTroEnum.ADMIN.value,
        VaiTroEnum.BAC_SI.value,
        VaiTroEnum.KY_THUAT_VIEN.value,
    }
    if current_user.vai_tro in staff_roles:
        return

    if current_user.vai_tro == VaiTroEnum.BENH_NHAN.value:
        stmt = select(BenhNhan.id).where(BenhNhan.nguoi_dung_id == current_user.nguoi_dung_id)
        own_bn_id = (await db.execute(stmt)).scalar_one_or_none()
        if own_bn_id != benh_nhan_id:
            raise ForbiddenException("Bạn không có quyền truy cập hồ sơ của bệnh nhân khác!")
        return

    raise ForbiddenException("Bạn không có quyền truy cập thông tin bệnh nhân!")
```
Gọi hàm này trong:
- `GET /patients/{benh_nhan_id}/packages`
- `GET /patients/{benh_nhan_id}/history-summary`

#### C. Chặn quyền truy cập các endpoint Dashboard & Điều phối tại quầy:
- `GET /search-appointments`, `GET /appointments`: Giới hạn cho `RECEPTION_STAFF_ROLES`.
- `GET /queue/{doctor_id}`: Bổ sung `current_user = Depends(get_current_user)` và chặn role ngoài `QUEUE_VIEW_ROLES`.
- `GET /flow-board`, `GET /dashboard/*`, `GET /resources/*`: Giới hạn cho `RECEPTION_STAFF_ROLES`.
- `GET /incidents/doctor-absences`, `POST /incidents/rebalance-queue`, `POST /process-no-shows`: Giới hạn cho `RECEPTION_ADMIN_ROLES`.

---

### 3. `app/services/queue_service.py` (MissingGreenlet & Concurrency)

#### A. Khắc phục MissingGreenlet:
Thay vì gọi `self._to_ticket_response(entity)` sau khi thực hiện `await db.commit()` (lúc này quan hệ `benh_nhan`, `bac_si` đã bị detach), nạp lại ticket bằng query eager-loading:
```python
# Tại call_next_patient, postpone_ticket, restore_ticket, check_in_patient (idempotent):
ticket_response = await self._get_ticket_with_relations(ticket_id, db)
```

#### B. Validation Chuyên Khoa Phân Bổ & Khóa Dòng Chống Race Condition trong `check_in_walk_in`:
```python
    async def check_in_walk_in(
        self,
        payload: WalkInCheckInRequest,
        receptionist_user: TaiKhoan,
        db: AsyncSession,
    ) -> QueueTicketResponse:
        if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng tiếp nhận bệnh nhân vãng lai chỉ dành cho Lễ tân hoặc Admin!")

        # 1. Validation Logic Phân bổ Bác sĩ (Critical):
        # Bắt buộc phải có bác sĩ tiếp nhận HOẶC chuyên khoa để auto-assign
        if payload.bac_si_id is None and not payload.chuyen_khoa_id:
            raise BadRequestException("Vui lòng chọn bác sĩ tiếp nhận hoặc chuyên khoa để phân bổ tự động!")

        # Kiểm tra chuyên khoa hợp lệ nếu được chỉ định
        if payload.chuyen_khoa_id:
            stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
            ck = (await db.execute(stmt_ck)).scalar_one_or_none()
            if not ck:
                raise NotFoundException(f"Chuyên khoa ID {payload.chuyen_khoa_id} không tồn tại trên hệ thống!")

        # ... (kiểm tra bệnh nhân) ...

        # FC-07: Auto-assign nếu bac_si_id is None
        if payload.bac_si_id is None:
            from app.services.load_balancing_service import load_balancing_service
            effective_doctor_id = await load_balancing_service.assign_optimal_doctor(
                chuyen_khoa_id=payload.chuyen_khoa_id,
                ca_kham=payload.ca_kham,
                ngay_kham=today,
                db=db
            )
        else:
            effective_doctor_id = payload.bac_si_id

        # Khóa dòng BacSi bằng SELECT ... FOR UPDATE để triệt tiêu race condition concurrency khi nhiều lễ tân check-in cùng lúc
        stmt_bs = select(BacSi).where(BacSi.id == effective_doctor_id).with_for_update()
        bs = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bs:
            raise NotFoundException("Không tìm thấy thông tin bác sĩ tiếp nhận!")
```

---

### 4. `app/services/incident_service.py` (Multi-Tenancy Check)

Thêm logic kiểm tra phòng khám trong `rebalance_queue`:
```python
        # Multi-tenancy check: Kiểm tra phong_kham_id của bác sĩ vắng mặt so với phong_kham_id của người dùng hiện tại
        target_phong_kham_id = leave.phong_kham_id or absent_bs.phong_kham_id
        user_phong_kham_id = getattr(current_user, "phong_kham_id", None)
        if current_user.vai_tro != VaiTroEnum.ADMIN.value and user_phong_kham_id is not None:
            if target_phong_kham_id != user_phong_kham_id:
                raise ForbiddenException("Bạn không có quyền điều phối hàng đợi của phòng khám này!")
```

---

### 5. `app/services/cashier_service.py`

Import thêm `BadRequestException`:
```python
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
)
```

---

### 6. `app/services/load_balancing_service.py`

Sửa toán tử so sánh boolean trong SQLAlchemy 2.0 (`E712`):
```python
# Thay vì == True:
BacSi.is_active.is_(True),
LichLamViec.is_active.is_(True),
```

---

## 🧪 Lệnh Chạy Kiểm Thử Tự Động

Chạy toàn bộ test suites bảo mật & điều phối qua Docker container:
```bash
docker run --rm -v "${PWD}:/app" clinic-ai-booking-backend pytest tests/test_pr43_security_patches.py tests/test_billing_gaps.py tests/test_reception_sprint1.py tests/test_incident_and_dashboard.py tests/test_load_balancing.py tests/test_bahmni_queue_flow.py
```

Kiểm tra định dạng & cú pháp linter:
```bash
docker run --rm -v "${PWD}:/app" clinic-ai-booking-backend ruff check app/routers/cashier.py app/routers/reception.py app/services/queue_service.py app/services/incident_service.py tests/test_pr43_security_patches.py
```
