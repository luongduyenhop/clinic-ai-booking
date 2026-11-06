import asyncio
from datetime import time, timedelta
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from app.core.config import settings
from app.core.exceptions import ConflictException
from app.models.appointment import (
    CaLamViecEnum,
    LichKham,
    LichLamViec,
    TrangThaiLichEnum,
    CANCELLED_STATUSES,
)
from app.services.appointment_service import clinic_now, appointment_service

APPOINTMENT_API = f"{settings.API_V1_STR}/appointments"


def _target_date():
    return (clinic_now() + timedelta(days=3)).date()


async def _add_morning_shift(data, bac_si, ngay):
    async with data.session_factory() as session:
        session.add(
            LichLamViec(
                bac_si_id=bac_si.id,
                ngay_lam_viec=ngay,
                ca_lam_viec=CaLamViecEnum.SANG.value,
                gio_bat_dau=time(7, 30),
                gio_ket_thuc=time(11, 30),
                gioi_han_ca_kham=10,
                han_muc_dat_truoc=8,
                han_muc_vang_lai=2,
                is_active=True,
            )
        )
        await session.commit()


async def _book(client, token, bac_si_id, ngay, gio):
    payload = {
        "bac_si_id": bac_si_id,
        "ngay_kham": ngay.isoformat(),
        "gio_kham": gio.isoformat(),
        "ly_do_kham": "Khám TS-APT-004",
    }
    return await client.post(APPOINTMENT_API, json=payload, headers=token)



@pytest.mark.asyncio
async def test_ts_apt_004_05_pessimistic_lock_prevents_overbooking(concurrent_api_client, committed_booking):
    data = committed_booking
    ngay = _target_date()
    slot_time = time(9, 0)
    await _add_morning_shift(data, data.bs_x, ngay)

    responses = await asyncio.gather(
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time),
        _book(concurrent_api_client, data.tokens["bn_b"], data.bs_x.id, ngay, slot_time),
    )

    status_codes = sorted(r.status_code for r in responses)
    assert status_codes == [201, 409], f"Kỳ vọng [201, 409] nhưng nhận được: {status_codes}"

    conflict_res = next(r for r in responses if r.status_code == 409)
    assert "giữ chỗ trước" in conflict_res.text or "Conflict" in conflict_res.text

    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.bac_si_id == data.bs_x.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == slot_time,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        count_active = (await session.execute(stmt)).scalar_one()
        assert count_active == 1, f"Kỳ vọng đúng 1 lịch hẹn được tạo, thực tế: {count_active}"


@pytest.mark.asyncio
async def test_ts_apt_004_05_transaction_rollback_after_flush_on_integrity_error(committed_booking):
    data = committed_booking
    ngay = _target_date()
    slot_time = time(8, 30)
    await _add_morning_shift(data, data.bs_x, ngay)

    async with data.session_factory() as session:
        session.add(
            LichKham(
                ma_lich_kham=f"LK-INIT-{data.suffix}",
                benh_nhan_id=data.bn_a.id,
                bac_si_id=data.bs_x.id,
                ngay_kham=ngay,
                gio_kham=slot_time,
                so_thu_tu=1,
                trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
            )
        )
        await session.commit()

    async with data.session_factory() as session:
        lich_step1 = LichKham(
            ma_lich_kham=f"LK-STEP1-{data.suffix}",
            benh_nhan_id=data.bn_b.id,
            bac_si_id=data.bs_x.id,
            ngay_kham=ngay,
            gio_kham=time(10, 0),
            so_thu_tu=2,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        )
        session.add(lich_step1)
        await session.flush()
        step1_id = lich_step1.id
        assert step1_id is not None, "Bước 1 flush phải sinh ID cho bản ghi tạm"

        lich_step2_conflict = LichKham(
            ma_lich_kham=f"LK-STEP2-{data.suffix}",
            benh_nhan_id=data.bn_b.id,
            bac_si_id=data.bs_x.id,
            ngay_kham=ngay,
            gio_kham=slot_time,
            so_thu_tu=3,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        )
        session.add(lich_step2_conflict)

        with pytest.raises(IntegrityError):
            await session.flush()

        await session.rollback()

    async with data.session_factory() as verify_session:
        stmt_verify_step1 = select(LichKham).where(LichKham.id == step1_id)
        persisted_step1 = (await verify_session.execute(stmt_verify_step1)).scalar_one_or_none()
        assert persisted_step1 is None, "Transaction Rollback thất bại: Bản ghi Bước 1 vẫn tồn tại trong CSDL!"

        stmt_verify_step2 = select(LichKham).where(LichKham.ma_lich_kham == f"LK-STEP2-{data.suffix}")
        persisted_step2 = (await verify_session.execute(stmt_verify_step2)).scalar_one_or_none()
        assert persisted_step2 is None, "Bản ghi Bước 2 không được phép xuất hiện trong CSDL!"

        stmt_init = select(LichKham).where(LichKham.ma_lich_kham == f"LK-INIT-{data.suffix}")
        persisted_init = (await verify_session.execute(stmt_init)).scalar_one_or_none()
        assert persisted_init is not None, "Bản ghi hợp lệ ban đầu phải được giữ nguyên"



@pytest.mark.asyncio
async def test_ts_apt_004_04_client_retry_after_timeout_idempotency(concurrent_api_client, committed_booking):
    data = committed_booking
    ngay = _target_date()
    slot_time = time(11, 0)
    await _add_morning_shift(data, data.bs_x, ngay)

    res1 = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time)
    assert res1.status_code == 201, f"Kỳ vọng 201 Created, nhận: {res1.status_code} - {res1.text}"
    app_data1 = res1.json()["data"]
    app_id1 = app_data1["id"]

    res2 = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time)
    assert res2.status_code == 409, f"Kỳ vọng 409 Conflict cho retry request, nhận: {res2.status_code} - {res2.text}"
    assert "Bạn đã có một lịch hẹn khám khác trong khung giờ này" in res2.text or "Conflict" in res2.text

    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.benh_nhan_id == data.bn_a.id,
            LichKham.bac_si_id == data.bs_x.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == slot_time,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        count_appointments = (await session.execute(stmt)).scalar_one()
        assert count_appointments == 1, f"Kỳ vọng đúng 1 lịch hẹn, thực tế: {count_appointments}"

        stmt_lich = select(LichKham).where(
            LichKham.benh_nhan_id == data.bn_a.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == slot_time,
        )
        persisted_lich = (await session.execute(stmt_lich)).scalar_one()
        assert persisted_lich.id == app_id1


@pytest.mark.asyncio
async def test_ts_apt_004_04_concurrent_timeout_retry_same_patient_only_one_wins(concurrent_api_client, committed_booking):
    data = committed_booking
    ngay = _target_date()
    slot_time = time(7, 30)
    await _add_morning_shift(data, data.bs_x, ngay)

    responses = await asyncio.gather(
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time),
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time),
    )

    status_codes = sorted(r.status_code for r in responses)
    assert status_codes == [201, 409], f"Kỳ vọng [201, 409], nhận được: {status_codes}"

    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.benh_nhan_id == data.bn_a.id,
            LichKham.bac_si_id == data.bs_x.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == slot_time,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        count_appointments = (await session.execute(stmt)).scalar_one()
        assert count_appointments == 1



@pytest.mark.asyncio
async def test_ts_apt_004_uq_active_doctor_slot_returns_409_not_500(concurrent_api_client, committed_booking):
    data = committed_booking
    ngay = _target_date()
    slot_time = time(8, 0)
    await _add_morning_shift(data, data.bs_x, ngay)

    res1 = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time)
    assert res1.status_code == 201

    res2 = await _book(concurrent_api_client, data.tokens["bn_b"], data.bs_x.id, ngay, slot_time)
    assert res2.status_code == 409, f"Kỳ vọng 409, nhận được: {res2.status_code} - {res2.text}"
    assert "giữ chỗ trước" in res2.text or "Conflict" in res2.text


@pytest.mark.asyncio
async def test_ts_apt_004_uq_active_patient_slot_returns_409_not_500(concurrent_api_client, committed_booking):
    data = committed_booking
    ngay = _target_date()
    slot_time = time(9, 30)
    await _add_morning_shift(data, data.bs_x, ngay)
    await _add_morning_shift(data, data.bs_y, ngay)

    res_x = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time)
    assert res_x.status_code == 201

    res_y = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_y.id, ngay, slot_time)
    assert res_y.status_code == 409, f"Kỳ vọng 409, nhận được: {res_y.status_code} - {res_y.text}"
    assert "Bạn đã có một lịch hẹn khám khác trong khung giờ này" in res_y.text

    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.benh_nhan_id == data.bn_a.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == slot_time,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        count_patient_slots = (await session.execute(stmt)).scalar_one()
        assert count_patient_slots == 1



@pytest.mark.asyncio
async def test_ts_apt_004_10_concurrent_requests_pessimistic_lock_only_one_wins(concurrent_api_client, committed_booking):
    from app.core.security import create_access_token
    from app.models.user import NguoiDung, BenhNhan, TaiKhoan, VaiTroEnum

    data = committed_booking
    ngay = _target_date()
    slot_time = time(10, 0)
    await _add_morning_shift(data, data.bs_x, ngay)

    tokens_10_patients = []
    async with data.session_factory() as session:
        for i in range(10):
            nd = NguoiDung(
                ho_ten=f"Bệnh Nhân Đua Top {i} {data.suffix}",
                email=f"bndua_{i}.{data.suffix}@test.local",
                so_dien_thoai=f"091100{i:04d}",
            )
            session.add(nd)
            await session.flush()

            tk = TaiKhoan(
                nguoi_dung_id=nd.id,
                email=nd.email,
                mat_khau_hash="hash",
                vai_tro=VaiTroEnum.BENH_NHAN.value,
                is_active=True,
            )
            session.add(tk)
            await session.flush()

            bn = BenhNhan(
                nguoi_dung_id=nd.id,
                ma_dinh_danh_y_te=f"BN-RACE-{i:02d}-{data.suffix}",
            )
            session.add(bn)
            await session.flush()

            jwt_tok = create_access_token(subject=tk.id, role=VaiTroEnum.BENH_NHAN.value)
            tokens_10_patients.append({"Authorization": f"Bearer {jwt_tok}"})

        await session.commit()

    tasks = [
        _book(concurrent_api_client, tok, data.bs_x.id, ngay, slot_time)
        for tok in tokens_10_patients
    ]
    responses = await asyncio.gather(*tasks)

    status_codes = [r.status_code for r in responses]
    assert status_codes.count(201) == 1, f"Kỳ vọng đúng 1 request 201 Created, thực tế: {status_codes}"
    assert status_codes.count(409) == 9, f"Kỳ vọng đúng 9 request 409 Conflict, thực tế: {status_codes}"

    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.bac_si_id == data.bs_x.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == slot_time,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        count_active = (await session.execute(stmt)).scalar_one()
        assert count_active == 1, f"Kỳ vọng đúng 1 lịch hẹn không overbooking, thực tế: {count_active}"



@pytest.mark.asyncio
async def test_ts_apt_004_shift_capacity_limit_concurrent_different_slots_only_one_wins(concurrent_api_client, committed_booking):
    from app.core.security import create_access_token
    from app.models.user import NguoiDung, BenhNhan, TaiKhoan, VaiTroEnum

    data = committed_booking
    ngay = _target_date()

    async with data.session_factory() as session:
        shift = LichLamViec(
            bac_si_id=data.bs_x.id,
            ngay_lam_viec=ngay,
            ca_lam_viec=CaLamViecEnum.SANG.value,
            gio_bat_dau=time(7, 30),
            gio_ket_thuc=time(11, 30),
            gioi_han_ca_kham=5,
            han_muc_dat_truoc=5,
            han_muc_vang_lai=0,
            is_active=True,
        )
        session.add(shift)

        for idx, slot_h in enumerate([time(7, 30), time(8, 0), time(8, 30), time(9, 0)]):
            nd = NguoiDung(ho_ten=f"BN Seed {idx} {data.suffix}", email=f"bn_seed_{idx}.{data.suffix}@test.local")
            session.add(nd)
            await session.flush()
            bn = BenhNhan(nguoi_dung_id=nd.id, ma_dinh_danh_y_te=f"BN-SEED-{idx}-{data.suffix}")
            session.add(bn)
            await session.flush()
            session.add(
                LichKham(
                    ma_lich_kham=f"LK-CAP-{idx}-{data.suffix}",
                    benh_nhan_id=bn.id,
                    bac_si_id=data.bs_x.id,
                    ngay_kham=ngay,
                    gio_kham=slot_h,
                    so_thu_tu=idx + 1,
                    trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
                )
            )

        await session.commit()

    slot_a = time(9, 30)
    slot_b = time(10, 0)

    responses = await asyncio.gather(
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_a),
        _book(concurrent_api_client, data.tokens["bn_b"], data.bs_x.id, ngay, slot_b),
    )

    status_codes = sorted(r.status_code for r in responses)
    assert status_codes == [201, 409], f"Kỳ vọng [201, 409] nhưng nhận được: {status_codes}"

    conflict_res = next(r for r in responses if r.status_code == 409)
    assert "đạt giới hạn tiếp nhận tối đa" in conflict_res.text or "Conflict" in conflict_res.text

    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.bac_si_id == data.bs_x.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham >= time(7, 30),
            LichKham.gio_kham < time(11, 30),
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        total_in_shift = (await session.execute(stmt)).scalar_one()
        assert total_in_shift == 5, f"Kỳ vọng đúng 5 lịch hẹn trong ca, thực tế bị vượt mức: {total_in_shift}"


