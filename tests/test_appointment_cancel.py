from datetime import datetime, time, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from app.core.config import settings
from app.main import app
from app.models.appointment import LichLamViec, TrangThaiLichEnum
from app.models.user import VaiTroEnum
from app.services.appointment_service import clinic_now

client = TestClient(app)
APPOINTMENT_API = f"{settings.API_V1_STR}/appointments"
LY_DO_HOP_LE = {"ly_do_huy": "Bận công tác đột xuất"}


# ------------------------------------------------------------------------------
# 1. Kiểm thử không cần CSDL
# ------------------------------------------------------------------------------

def test_clinic_now_uses_clinic_timezone_not_server_timezone():
    """Giờ phòng khám = UTC + 7, kể cả khi server/Docker chạy giờ UTC"""
    expected = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS)
    assert abs(clinic_now() - expected) < timedelta(seconds=5)


def test_cancel_without_token_returns_401():
    """Chưa đăng nhập thì không được hủy lịch"""
    response = client.post(f"{APPOINTMENT_API}/1/cancel", json=LY_DO_HOP_LE)
    assert response.status_code == 401
    assert response.json()["success"] is False


# ------------------------------------------------------------------------------
# 2. Kiểm thử tích hợp trên PostgreSQL thật (fixture db_session/api_client/booking ở tests/conftest.py)
# ------------------------------------------------------------------------------

async def _cancel(api_client, lich_id, token, body=None):
    return await api_client.post(f"{APPOINTMENT_API}/{lich_id}/cancel", json=body or LY_DO_HOP_LE, headers=token)


async def test_patient_cancels_own_appointment(api_client, db_session, booking):
    """Bệnh nhân hủy lịch của mình trước > 2 tiếng: lưu đủ lý do, thời điểm và vai trò người hủy"""
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, clinic_now() + timedelta(days=3))

    response = await _cancel(api_client, lich.id, booking.tokens["bn_a"], {"ly_do_huy": "  Bận công tác đột xuất  "})

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["appointment_id"] == lich.id
    assert data["trang_thai"] == TrangThaiLichEnum.DA_HUY.value
    assert data["ly_do_huy"] == "Bận công tác đột xuất"
    assert data["nguoi_huy_vai_tro"] == VaiTroEnum.BENH_NHAN.value

    await db_session.refresh(lich)
    assert lich.trang_thai == TrangThaiLichEnum.DA_HUY.value
    assert lich.ly_do_huy == "Bận công tác đột xuất"
    assert lich.thoi_gian_huy is not None


@pytest.mark.parametrize(
    "minutes_ahead, expected_status",
    [
        (2 * 60 + 5, 200),  # Còn 2 tiếng 5 phút -> được hủy
        (2 * 60 - 5, 400),  # Còn 1 tiếng 55 phút -> vi phạm quy định 2 tiếng
        (30, 400),
    ],
)
async def test_patient_two_hour_rule_uses_clinic_time(api_client, db_session, booking, minutes_ahead, expected_status):
    """Mốc 2 tiếng tính theo giờ phòng khám (UTC+7), không theo giờ server (CI/Docker chạy UTC)"""
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, clinic_now() + timedelta(minutes=minutes_ahead))

    response = await _cancel(api_client, lich.id, booking.tokens["bn_a"])

    assert response.status_code == expected_status, response.text
    await db_session.refresh(lich)
    expected_state = TrangThaiLichEnum.DA_HUY.value if expected_status == 200 else TrangThaiLichEnum.CHO_XAC_NHAN.value
    assert lich.trang_thai == expected_state


async def test_patient_cannot_cancel_or_probe_other_patients_appointment(api_client, booking):
    """Hủy lịch của người khác bị chặn 403 - kể cả khi lịch đó đã hủy (không lộ trạng thái qua mã 409)"""
    lich_con_hieu_luc = await booking.tao_lich(booking.bn_b, booking.bs_x, clinic_now() + timedelta(days=3))
    lich_da_huy = await booking.tao_lich(
        booking.bn_b, booking.bs_x, clinic_now() + timedelta(days=4), TrangThaiLichEnum.DA_HUY.value
    )

    for lich in (lich_con_hieu_luc, lich_da_huy):
        response = await _cancel(api_client, lich.id, booking.tokens["bn_a"])
        assert response.status_code == 403, response.text


@pytest.mark.parametrize(
    "trang_thai",
    [
        TrangThaiLichEnum.DA_HUY.value,
        TrangThaiLichEnum.TU_DONG_HUY.value,
        TrangThaiLichEnum.DA_TIEP_NHAN.value,
        TrangThaiLichEnum.DANG_KHAM.value,
        TrangThaiLichEnum.DA_KHAM.value,
        TrangThaiLichEnum.NO_SHOW.value,
    ],
)
async def test_non_cancellable_statuses_return_409(api_client, db_session, booking, trang_thai):
    """Chỉ lịch 'chờ xác nhận' / 'đã xác nhận' mới hủy được; trạng thái khác giữ nguyên"""
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, clinic_now() + timedelta(days=3), trang_thai)

    response = await _cancel(api_client, lich.id, booking.tokens["bn_a"])

    assert response.status_code == 409, response.text
    await db_session.refresh(lich)
    assert lich.trang_thai == trang_thai


async def test_confirmed_appointment_can_be_cancelled(api_client, booking):
    """Lịch đã xác nhận 24h vẫn được hủy nếu còn đủ thời gian"""
    lich = await booking.tao_lich(
        booking.bn_a, booking.bs_x, clinic_now() + timedelta(days=1), TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    response = await _cancel(api_client, lich.id, booking.tokens["bn_a"])
    assert response.status_code == 200, response.text


async def test_cancel_unknown_appointment_returns_404(api_client, booking):
    response = await _cancel(api_client, 987654321, booking.tokens["bn_a"])
    assert response.status_code == 404


async def test_doctor_can_cancel_own_appointment_close_to_time(api_client, booking):
    """Bác sĩ hủy lịch mình phụ trách được cả khi còn < 2 tiếng; lịch của bác sĩ khác thì không"""
    lich_cua_x = await booking.tao_lich(booking.bn_a, booking.bs_x, clinic_now() + timedelta(minutes=30))
    lich_cua_y = await booking.tao_lich(booking.bn_a, booking.bs_y, clinic_now() + timedelta(days=3))

    response = await _cancel(api_client, lich_cua_x.id, booking.tokens["bs_x"])
    assert response.status_code == 200, response.text
    assert response.json()["data"]["nguoi_huy_vai_tro"] == VaiTroEnum.BAC_SI.value

    response = await _cancel(api_client, lich_cua_y.id, booking.tokens["bs_x"])
    assert response.status_code == 403


async def test_nobody_can_cancel_after_appointment_time(api_client, db_session, booking):
    """Đã tới/qua giờ khám thì kể cả Admin cũng không hủy được (phải xử lý theo luồng no-show)"""
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, clinic_now() - timedelta(hours=1))

    response = await _cancel(api_client, lich.id, booking.tokens["admin"])

    assert response.status_code == 409, response.text
    await db_session.refresh(lich)
    assert lich.trang_thai == TrangThaiLichEnum.CHO_XAC_NHAN.value


async def test_blank_reason_returns_422(api_client, booking):
    """Lý do hủy toàn khoảng trắng bị chặn dù đủ 5 ký tự"""
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, clinic_now() + timedelta(days=3))
    response = await _cancel(api_client, lich.id, booking.tokens["bn_a"], {"ly_do_huy": "        "})
    assert response.status_code == 422


async def test_cancel_releases_slot_for_other_patients(api_client, db_session, booking):
    """Sau khi hủy, khung giờ trở lại trạng thái 'available' trên API tra cứu slot (UC-B02)"""
    ngay_kham = (clinic_now() + timedelta(days=3)).date()
    db_session.add(LichLamViec(
        bac_si_id=booking.bs_x.id, ngay_lam_viec=ngay_kham, gio_bat_dau=time(7, 30), gio_ket_thuc=time(11, 30)
    ))
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.combine(ngay_kham, time(9, 0)))

    async def slot_0900_status():
        response = await api_client.get(
            f"{APPOINTMENT_API}/doctors/{booking.bs_x.id}/slots", params={"query_date": ngay_kham.isoformat()}
        )
        assert response.status_code == 200, response.text
        return next(slot["status"] for slot in response.json()["data"]["slots"] if slot["time_str"] == "09:00")

    assert await slot_0900_status() == "booked"
    response = await _cancel(api_client, lich.id, booking.tokens["bn_a"])
    assert response.status_code == 200, response.text
    assert await slot_0900_status() == "available"
