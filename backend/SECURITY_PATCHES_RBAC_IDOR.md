# HƯỚNG DẪN VÁ LỖ HỔNG BẢO MẬT RBAC, IDOR & SỬA LỖI ASYNC ORM MISSINGGREENLET

Tài liệu này ghi lại chi tiết các điểm đã sửa chữa để vượt qua vòng kiểm duyệt kỹ thuật & bảo mật của **Hội Đồng AI (GitHub Copilot & Google Gemini Pro)** cho **PR #43** và **PR #48**.

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
- `GET /search-appointments`:
  ```python
  if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
      raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền tìm kiếm lịch hẹn tại quầy tiếp đón!")
  ```
- `GET /queue/{doctor_id}`:
  ```python
  async def get_doctor_queue(
      doctor_id: int,
      query_date: Optional[date] = Query(None),
      current_user: TaiKhoan = Depends(get_current_user),
      db: AsyncSession = Depends(get_db)
  ):
      if current_user.vai_tro not in QUEUE_VIEW_ROLES:
          raise ForbiddenException("Bạn không có quyền xem thông tin hàng đợi phòng khám!")
  ```
- `GET /flow-board`:
  ```python
  if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
      raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền xem Patient Flow Board!")
  ```
- `GET /dashboard/shift-summary`:
  ```python
  if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
      raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền xem Dashboard ca trực tiếp đón!")
  ```
- `GET /dashboard/room-status`:
  ```python
  if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
      raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền xem trạng thái buồng khám!")
  ```
- `GET /resources/roster`, `/resources/rooms`, `/resources/roster-template`:
  ```python
  if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
      raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền tra cứu tài nguyên ca trực!")
  ```
- `GET /incidents/doctor-absences`, `POST /incidents/rebalance-queue`, `POST /process-no-shows`:
  ```python
  if current_user.vai_tro not in RECEPTION_ADMIN_ROLES:
      raise ForbiddenException("Chỉ Lễ tân hoặc Quản trị viên mới có quyền thao tác chức năng này!")
  ```

---

### 3. `app/services/queue_service.py` (Khắc phục MissingGreenlet)

Thay vì gọi `self._to_ticket_response(entity)` sau khi thực hiện `await db.commit()` (lúc này quan hệ `benh_nhan`, `bac_si` đã bị detach), nạp lại ticket bằng query eager-loading:

```python
# Tại call_next_patient:
ticket_id_called = candidate.id
ticket_stt_called = candidate.so_thu_tu_kham
await db.commit()

# Nạp lại kèm eager loading đầy đủ
ticket_response = await self._get_ticket_with_relations(ticket_id_called, db)
return CallNextResponse(
    message=f"Đã gọi thành công bệnh nhân STT #{ticket_stt_called} vào phòng khám!",
    ticket=ticket_response,
    so_nguoi_con_lai=remaining,
)

# Tại postpone_ticket:
ticket_id_postponed = ticket.id
await db.commit()
return await self._get_ticket_with_relations(ticket_id_postponed, db)

# Tại restore_ticket:
ticket_id_restored = ticket.id
await db.commit()
return await self._get_ticket_with_relations(ticket_id_restored, db)

# Tại check_in_patient (nhánh idempotent):
if existing_ticket:
    return await self._get_ticket_with_relations(existing_ticket.id, db)
```

---

### 4. `app/services/cashier_service.py`

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

## 🧪 Lệnh Chạy Kiểm Thử Tự Động

Chạy qua Docker container:
```bash
docker run --rm -v "${PWD}:/app" clinic-ai-booking-backend pytest tests/test_pr43_security_patches.py tests/test_billing_gaps.py tests/test_reception_sprint1.py tests/test_incident_and_dashboard.py tests/test_load_balancing.py
```

Kiểm tra định dạng & cú pháp linter:
```bash
docker run --rm -v "${PWD}:/app" clinic-ai-booking-backend ruff check app/routers/cashier.py app/routers/reception.py app/services/queue_service.py app/services/cashier_service.py tests/test_pr43_security_patches.py
```

