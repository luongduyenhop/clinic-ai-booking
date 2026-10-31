import asyncio
from datetime import time, timedelta
from sqlalchemy import func, select
from app.core.config import settings
from app.models.appointment import CaLamViecEnum, LichKham, LichLamViec, CANCELLED_STATUSES
from app.services.appointment_service import clinic_now

APPOINTMENT_API = f"{settings.API_V1_STR}/appointments"

# Kiểm thử khóa dòng SELECT ... FOR UPDATE khi đặt lịch (UC-B03) với các request chạy song song thật sự trên
# nhiều kết nối PostgreSQL. Fixture committed_booking/concurrent_api_client ở tests/conftest.py


def _ngay():
    return (clinic_now() + timedelta(days=3)).date()


async def _add_morning_shift(data, bac_si, ngay):
    async with data.session_factory() as session:
        session.add(LichLamViec(
            bac_si_id=bac_si.id, ngay_lam_viec=ngay, ca_lam_viec=CaLamViecEnum.SANG.value,
            gio_bat_dau=time(7, 30), gio_ket_thuc=time(11, 30)
        ))
        await session.commit()


async def _book(client, token, bac_si_id, ngay, gio):
    payload = {"bac_si_id": bac_si_id, "ngay_kham": ngay.isoformat(), "gio_kham": gio.isoformat()}
    return await client.post(APPOINTMENT_API, json=payload, headers=token)


async def _count_active(data, bac_si, ngay, gio):
    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.bac_si_id == bac_si.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == gio,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES)
        )
        return (await session.execute(stmt)).scalar_one()


async def test_booking_waits_for_shift_lock_then_sees_committed_booking(concurrent_api_client, committed_booking):
    """Trong lúc 1 giao dịch khác đang giữ khóa ca làm việc, request đặt lịch phải chờ; khi giao dịch đó
    commit lịch 09:00 thì request đọc lại dữ liệu mới và trả 409 thay vì đặt chồng"""
    data = committed_booking
    ngay = _ngay()
    await _add_morning_shift(data, data.bs_x, ngay)

    async with data.session_factory() as holder:
        await holder.execute(
            select(LichLamViec.id)
            .where(LichLamViec.bac_si_id == data.bs_x.id, LichLamViec.ngay_lam_viec == ngay)
            .with_for_update()
        )
        request = asyncio.create_task(_book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, time(9, 0)))

        done, _ = await asyncio.wait({request}, timeout=1)
        assert not done, "Request đặt lịch không chờ khóa dòng ca làm việc"

        holder.add(LichKham(
            ma_lich_kham=f"LK-LOCK-{data.suffix}", benh_nhan_id=data.bn_b.id, bac_si_id=data.bs_x.id,
            ngay_kham=ngay, gio_kham=time(9, 0), so_thu_tu=1
        ))
        await holder.commit()

    response = await asyncio.wait_for(request, timeout=10)

    assert response.status_code == 409, response.text
    assert await _count_active(data, data.bs_x, ngay, time(9, 0)) == 1


async def test_concurrent_bookings_for_same_slot_only_one_wins(concurrent_api_client, committed_booking):
    """2 bệnh nhân cùng bấm đặt slot 09:00 cùng lúc: đúng 1 người thành công, người còn lại nhận 409"""
    data = committed_booking
    ngay = _ngay()
    await _add_morning_shift(data, data.bs_x, ngay)

    responses = await asyncio.gather(
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, time(9, 0)),
        _book(concurrent_api_client, data.tokens["bn_b"], data.bs_x.id, ngay, time(9, 0)),
    )

    assert sorted(r.status_code for r in responses) == [201, 409], [r.text for r in responses]
    assert await _count_active(data, data.bs_x, ngay, time(9, 0)) == 1


async def test_concurrent_bookings_for_different_slots_get_distinct_numbers(concurrent_api_client, committed_booking):
    """Đặt song song 2 slot khác nhau của cùng bác sĩ: cả 2 thành công, số thứ tự và mã lịch không trùng
    (không có khóa thì 2 giao dịch cùng tính ra STT 1 và cùng 1 mã lịch -> lỗi 500)"""
    data = committed_booking
    ngay = _ngay()
    await _add_morning_shift(data, data.bs_x, ngay)

    responses = await asyncio.gather(
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, time(8, 0)),
        _book(concurrent_api_client, data.tokens["bn_b"], data.bs_x.id, ngay, time(8, 30)),
    )

    assert [r.status_code for r in responses] == [201, 201], [r.text for r in responses]
    created = [r.json()["data"] for r in responses]
    assert sorted(item["so_thu_tu"] for item in created) == [1, 2]
    assert len({item["ma_lich_kham"] for item in created}) == 2


async def test_same_patient_booking_two_doctors_at_once_only_one_wins(concurrent_api_client, committed_booking):
    """1 bệnh nhân gửi đồng thời 2 yêu cầu cùng giờ với 2 bác sĩ khác nhau: khóa dòng bệnh nhân chỉ cho 1 lịch"""
    data = committed_booking
    ngay = _ngay()
    await _add_morning_shift(data, data.bs_x, ngay)
    await _add_morning_shift(data, data.bs_y, ngay)

    responses = await asyncio.gather(
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, time(9, 0)),
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_y.id, ngay, time(9, 0)),
    )

    assert sorted(r.status_code for r in responses) == [201, 409], [r.text for r in responses]
