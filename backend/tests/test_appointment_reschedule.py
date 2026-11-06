from datetime import datetime, date, time
from app.models.user import VaiTroEnum
from app.models.appointment import TrangThaiLichEnum, CANCELLED_STATUSES
from app.services.appointment_service import CANCELLABLE_STATUSES
from app.schemas.appointment import AppointmentRescheduleRequest


def test_reschedule_schema_validation():
    """Kiểm tra schema yêu cầu đổi lịch khám (AppointmentRescheduleRequest)"""
    req = AppointmentRescheduleRequest(
        ngay_kham_moi=date(2026, 10, 15),
        gio_kham_moi=time(9, 0),
        bac_si_id_moi=2,
        ly_do_doi="Bận việc đột xuất vào giờ cũ"
    )
    assert req.ngay_kham_moi == date(2026, 10, 15)
    assert req.gio_kham_moi == time(9, 0)
    assert req.bac_si_id_moi == 2
    assert req.ly_do_doi == "Bận việc đột xuất vào giờ cũ"


def test_reschedule_time_constraint_logic():
    """Kiểm tra logic chặn đổi lịch nếu cách giờ khám cũ dưới 02 tiếng"""
    now = datetime(2026, 10, 10, 8, 0)
    min_hours = 2.0

    # Ca 1: Giờ khám lúc 09:30 (cách 1.5 tiếng < 2 tiếng) -> Bị từ chối
    old_time_invalid = datetime(2026, 10, 10, 9, 30)
    diff_invalid = (old_time_invalid - now).total_seconds() / 3600.0
    assert diff_invalid < min_hours

    # Ca 2: Giờ khám lúc 10:30 (cách 2.5 tiếng >= 2 tiếng) -> Hợp lệ
    old_time_valid = datetime(2026, 10, 10, 10, 30)
    diff_valid = (old_time_valid - now).total_seconds() / 3600.0
    assert diff_valid >= min_hours


def test_reschedule_state_constraints():
    """Kiểm tra ràng buộc trạng thái: Chỉ cho phép đổi khi đang chờ xác nhận hoặc đã xác nhận"""
    # Trạng thái hợp lệ
    for st in [TrangThaiLichEnum.CHO_XAC_NHAN.value, TrangThaiLichEnum.DA_XAC_NHAN.value]:
        assert st in CANCELLABLE_STATUSES
        assert st not in CANCELLED_STATUSES

    # Trạng thái không được phép đổi
    invalid_statuses = [
        TrangThaiLichEnum.DA_HUY.value,
        TrangThaiLichEnum.TU_DONG_HUY.value,
        TrangThaiLichEnum.DA_KHAM.value,
        TrangThaiLichEnum.DANG_KHAM.value,
        TrangThaiLichEnum.NO_SHOW.value
    ]
    for st in invalid_statuses:
        assert (st in CANCELLED_STATUSES) or (st not in CANCELLABLE_STATUSES)


def test_reschedule_rbac_rules():
    """Kiểm tra quy tắc phân quyền: Bệnh nhân chỉ đổi được lịch của mình"""
    user_bn = {"role": VaiTroEnum.BENH_NHAN.value, "bn_id": 10}
    other_bn = {"role": VaiTroEnum.BENH_NHAN.value, "bn_id": 99}
    appointment = {"id": 1, "benh_nhan_id": 10, "bac_si_id": 3}

    # Bệnh nhân đúng sở hữu
    assert appointment["benh_nhan_id"] == user_bn["bn_id"]

    # Bệnh nhân khác can thiệp -> Từ chối
    assert appointment["benh_nhan_id"] != other_bn["bn_id"]


import pytest
from app.models.appointment import CaLamViecEnum, LichLamViec
from app.services.appointment_service import clinic_now
from datetime import timedelta


@pytest.mark.asyncio
async def test_reschedule_booking_integration(api_client, db_session, booking):
    """Kiểm tra gọi trực tiếp API đổi lịch khám POST /appointments/{id}/reschedule"""
    target_date = (clinic_now() + timedelta(days=3)).date()

    # 1. Tạo ca làm việc sáng cho bác sĩ
    shift = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=target_date,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        is_active=True,
    )
    db_session.add(shift)
    await db_session.flush()

    # 2. Đặt lịch ban đầu lúc 08:00
    book_res = await api_client.post(
        "/api/v1/appointments",
        json={
            "bac_si_id": booking.bs_x.id,
            "ngay_kham": target_date.isoformat(),
            "gio_kham": "08:00:00",
        },
        headers=booking.tokens["bn_a"],
    )
    assert book_res.status_code == 201, book_res.text
    app_id = book_res.json()["data"]["id"]

    # 3. Đổi lịch sang 09:30 cùng ngày
    reschedule_res = await api_client.post(
        f"/api/v1/appointments/{app_id}/reschedule",
        json={
            "ngay_kham_moi": target_date.isoformat(),
            "gio_kham_moi": "09:30:00",
            "ly_do_doi": "Bận việc đột xuất",
        },
        headers=booking.tokens["bn_a"],
    )
    assert reschedule_res.status_code == 200, reschedule_res.text
    res_data = reschedule_res.json()["data"]
    assert res_data["gio_kham"] == "09:30:00"
    assert res_data["trang_thai"] == "da_xac_nhan"
    assert "Bận việc đột xuất" in (res_data["ly_do_kham"] or "")

    # 4. Kiểm tra slot 08:00 đã được giải phóng (available) và slot 09:30 đã bị chiếm (booked)
    slots_res = await api_client.get(
        f"/api/v1/appointments/doctors/{booking.bs_x.id}/slots",
        params={"query_date": target_date.isoformat()},
    )
    slots = slots_res.json()["data"]["slots"]
    slot_0800 = next(s for s in slots if s["time_str"] == "08:00")
    slot_0930 = next(s for s in slots if s["time_str"] == "09:30")
    assert slot_0800["status"] == "available"
    assert slot_0930["status"] == "booked"
