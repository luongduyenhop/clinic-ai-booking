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


# ==============================================================================
# Scenario: TS-APT-004-05
# Requirement: APT-004
# Component: appointment_service.py (with_for_update, transaction rollback)
# ==============================================================================

@pytest.mark.asyncio
async def test_ts_apt_004_05_pessimistic_lock_prevents_overbooking(concurrent_api_client, committed_booking):
    """
    TS-APT-004-05 Step 1:
    Khóa bi quan SELECT FOR UPDATE tuần tự hóa 2 yêu cầu đặt cùng slot:
    - Đúng 1 request thành công 201 Created.
    - Request còn lại nhận 409 Conflict.
    - Không xảy ra overbooking (chỉ có duy nhất 1 lịch hẹn tồn tại trong CSDL).
    """
    data = committed_booking
    ngay = _target_date()
    slot_time = time(9, 0)
    await _add_morning_shift(data, data.bs_x, ngay)

    # 2 bệnh nhân gửi yêu cầu đặt lịch cùng slot 09:00 đồng thời
    responses = await asyncio.gather(
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time),
        _book(concurrent_api_client, data.tokens["bn_b"], data.bs_x.id, ngay, slot_time),
    )

    status_codes = sorted(r.status_code for r in responses)
    assert status_codes == [201, 409], f"Kỳ vọng [201, 409] nhưng nhận được: {status_codes}"

    conflict_res = next(r for r in responses if r.status_code == 409)
    assert "giữ chỗ trước" in conflict_res.text or "Conflict" in conflict_res.text

    # Kiểm chứng trong CSDL: Chỉ có duy nhất 1 lịch hẹn còn hiệu lực, không overbooking
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
    """
    TS-APT-004-05 Step 2:
    Kiểm chứng Transaction Rollback thực sự sau khi đã db.add() và await db.flush() ở bước 1
    nhưng bước 2 gặp IntegrityError:
    - Dữ liệu ở bước 1 không bị ghi sót lại vào CSDL sau khi rollback.
    """
    data = committed_booking
    ngay = _target_date()
    slot_time = time(8, 30)
    await _add_morning_shift(data, data.bs_x, ngay)

    # Đã có 1 lịch hẹn tồn tại ở slot 08:30
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

    # Thực thi một transaction mới:
    # Bước 1: db.add() và await db.flush() đối tượng tạm
    # Bước 2: Cố tình insert bản ghi vi phạm Unique Partial Index uq_active_doctor_slot -> IntegrityError
    async with data.session_factory() as session:
        lich_step1 = LichKham(
            ma_lich_kham=f"LK-STEP1-{data.suffix}",
            benh_nhan_id=data.bn_b.id,
            bac_si_id=data.bs_x.id,
            ngay_kham=ngay,
            gio_kham=time(10, 0),  # Slot khác chưa ai đặt
            so_thu_tu=2,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        )
        session.add(lich_step1)
        await session.flush()
        step1_id = lich_step1.id
        assert step1_id is not None, "Bước 1 flush phải sinh ID cho bản ghi tạm"

        # Bước 2: Thêm bản ghi trùng giờ 08:30 vi phạm uq_active_doctor_slot
        lich_step2_conflict = LichKham(
            ma_lich_kham=f"LK-STEP2-{data.suffix}",
            benh_nhan_id=data.bn_b.id,
            bac_si_id=data.bs_x.id,
            ngay_kham=ngay,
            gio_kham=slot_time,  # Trùng với LK-INIT đã commit trước đó
            so_thu_tu=3,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        )
        session.add(lich_step2_conflict)

        # Xảy ra IntegrityError và kích hoạt Transaction Rollback
        with pytest.raises(IntegrityError):
            await session.flush()

        await session.rollback()

    # Kiểm chứng sau Rollback:
    # Bản ghi lich_step1 đã db.add() và await db.flush() ở Bước 1 HOÀN TOÀN BIẾN MẤT khỏi CSDL
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


# ==============================================================================
# Scenario: TS-APT-004-04
# Requirement: APT-004
# Action: Xử lý an toàn khi client gửi lại request sau timeout (Idempotency)
# Component: appointment_service.py (with_for_update)
# Expected Result: Khóa bi quan SELECT FOR UPDATE đảm bảo đúng 1 request 201 Created,
# request còn lại 409 Conflict, không overbooking
# ==============================================================================

@pytest.mark.asyncio
async def test_ts_apt_004_04_client_retry_after_timeout_idempotency(concurrent_api_client, committed_booking):
    """
    TS-APT-004-04:
    Khi cùng 1 client gửi request 1 rồi bị timeout mạng và retry gửi lại request 2
    với cùng thông tin (cùng bệnh nhân, cùng bác sĩ, cùng ngày và khung giờ):
    - Request 1: Đạt 201 Created.
    - Request 2 (retry sau timeout): Bị phát hiện trùng lịch, trả về 409 Conflict.
    - Khóa bi quan và ràng buộc đảm bảo không overbooking, không bị tạo 2 vé lặp cho cùng 1 bệnh nhân.
    """
    data = committed_booking
    ngay = _target_date()
    slot_time = time(11, 0)
    await _add_morning_shift(data, data.bs_x, ngay)

    # 1. Request ban đầu từ Bệnh nhân A
    res1 = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time)
    assert res1.status_code == 201, f"Kỳ vọng 201 Created, nhận: {res1.status_code} - {res1.text}"
    app_data1 = res1.json()["data"]
    app_id1 = app_data1["id"]

    # 2. Client retry sau timeout: Gửi lại request y hệt với token của chính Bệnh nhân A
    res2 = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time)
    assert res2.status_code == 409, f"Kỳ vọng 409 Conflict cho retry request, nhận: {res2.status_code} - {res2.text}"
    assert "Bạn đã có một lịch hẹn khám khác trong khung giờ này" in res2.text or "Conflict" in res2.text

    # 3. Kiểm chứng trong CSDL: Chỉ tồn tại duy nhất 1 bản ghi của Bệnh nhân A
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
    """
    TS-APT-004-04 (Concurrent timeout race):
    Khi request 1 bị lag/treo và request 2 retry đến cùng lúc (chạy song song):
    Khóa bi quan trên bệnh nhân (with_for_update of BenhNhan) và ca làm việc (with_for_update of LichLamViec)
    đảm bảo đúng 1 request 201 Created và request còn lại 409 Conflict, không overbooking.
    """
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

    # CSDL chỉ có duy nhất 1 lịch hẹn
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


# ==============================================================================
# Kiểm tra chốt chặn Unique Partial Index uq_active_doctor_slot và uq_active_patient_slot
# trả về 409 thay vì 500
# ==============================================================================

@pytest.mark.asyncio
async def test_ts_apt_004_uq_active_doctor_slot_returns_409_not_500(concurrent_api_client, committed_booking):
    """
    Kiểm tra chốt chặn Unique Partial Index uq_active_doctor_slot:
    Khi 2 request cùng slot của cùng bác sĩ chạy đua, chốt chặn CSDL đảm bảo:
    - Trả về 409 Conflict (không bao giờ văng 500 Internal Server Error)
    - Thông báo rõ ràng slot đã được giữ chỗ trước.
    """
    data = committed_booking
    ngay = _target_date()
    slot_time = time(8, 0)
    await _add_morning_shift(data, data.bs_x, ngay)

    # BN A đặt trước thành công
    res1 = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time)
    assert res1.status_code == 201

    # BN B đặt cùng slot -> Hệ thống chặn và trả về 409 thay vì 500
    res2 = await _book(concurrent_api_client, data.tokens["bn_b"], data.bs_x.id, ngay, slot_time)
    assert res2.status_code == 409, f"Kỳ vọng 409, nhận được: {res2.status_code} - {res2.text}"
    assert "giữ chỗ trước" in res2.text or "Conflict" in res2.text


@pytest.mark.asyncio
async def test_ts_apt_004_uq_active_patient_slot_returns_409_not_500(concurrent_api_client, committed_booking):
    """
    Kiểm tra chốt chặn Unique Partial Index uq_active_patient_slot:
    Khi 1 bệnh nhân đặt 2 lịch hẹn trùng giờ với 2 bác sĩ khác nhau (BS X và BS Y):
    - Request thứ nhất: 201 Created.
    - Request thứ hai: Chốt chặn phát hiện bệnh nhân đã có lịch khác cùng giờ -> 409 Conflict (thay vì 500).
    - CSDL chỉ lưu 1 lịch duy nhất.
    """
    data = committed_booking
    ngay = _target_date()
    slot_time = time(9, 30)
    await _add_morning_shift(data, data.bs_x, ngay)
    await _add_morning_shift(data, data.bs_y, ngay)

    # BN A đặt BS X thành công
    res_x = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_time)
    assert res_x.status_code == 201

    # BN A tiếp tục đặt BS Y ở cùng khung giờ 09:30 -> Chặn 409 thay vì 500
    res_y = await _book(concurrent_api_client, data.tokens["bn_a"], data.bs_y.id, ngay, slot_time)
    assert res_y.status_code == 409, f"Kỳ vọng 409, nhận được: {res_y.status_code} - {res_y.text}"
    assert "Bạn đã có một lịch hẹn khám khác trong khung giờ này" in res_y.text

    # Kiểm chứng CSDL: BN A chỉ có đúng 1 lịch tại 09:30
    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.benh_nhan_id == data.bn_a.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == slot_time,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        count_patient_slots = (await session.execute(stmt)).scalar_one()
        assert count_patient_slots == 1


# ==============================================================================
# 10 requests đồng thời đặt vào cùng 1 mốc giờ 30 phút
# (sức chứa 1 slot = 1 bệnh nhân, bảo vệ bởi uq_active_doctor_slot)
# ==============================================================================

@pytest.mark.asyncio
async def test_ts_apt_004_10_concurrent_requests_pessimistic_lock_only_one_wins(concurrent_api_client, committed_booking):
    """
    10 requests đồng thời đặt vào cùng 1 mốc giờ 30 phút
    (sức chứa 1 slot = 1 bệnh nhân, bảo vệ bởi uq_active_doctor_slot):
    - Khóa bi quan SELECT FOR UPDATE đảm bảo đúng 1 request 201 Created.
    - 9 requests còn lại nhận 409 Conflict.
    - Hoàn toàn không bị overbooking (chỉ có duy nhất 1 lịch hẹn trong CSDL).
    """
    from app.core.security import create_access_token
    from app.models.user import NguoiDung, BenhNhan, TaiKhoan, VaiTroEnum

    data = committed_booking
    ngay = _target_date()
    slot_time = time(10, 0)
    await _add_morning_shift(data, data.bs_x, ngay)

    # Khởi tạo 10 bệnh nhân độc lập với 10 access token riêng biệt
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

    # Bắn đồng thời 10 request đặt cùng 1 slot 10:00 của Bác sĩ X
    tasks = [
        _book(concurrent_api_client, tok, data.bs_x.id, ngay, slot_time)
        for tok in tokens_10_patients
    ]
    responses = await asyncio.gather(*tasks)

    # Kiểm chứng đúng 1 request 201 Created và 9 request 409 Conflict
    status_codes = [r.status_code for r in responses]
    assert status_codes.count(201) == 1, f"Kỳ vọng đúng 1 request 201 Created, thực tế: {status_codes}"
    assert status_codes.count(409) == 9, f"Kỳ vọng đúng 9 request 409 Conflict, thực tế: {status_codes}"

    # Kiểm chứng CSDL PostgreSQL thật: Chỉ có duy nhất 1 lịch hẹn tại slot 10:00
    async with data.session_factory() as session:
        stmt = select(func.count(LichKham.id)).where(
            LichKham.bac_si_id == data.bs_x.id,
            LichKham.ngay_kham == ngay,
            LichKham.gio_kham == slot_time,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES),
        )
        count_active = (await session.execute(stmt)).scalar_one()
        assert count_active == 1, f"Kỳ vọng đúng 1 lịch hẹn không overbooking, thực tế: {count_active}"


# ==============================================================================
# Hai người đặt đồng thời vào 2 mốc giờ trống khác nhau khi cả Ca khám
# (gioi_han_ca_kham = 5) chỉ còn đúng 1 suất cuối cùng
# ==============================================================================

@pytest.mark.asyncio
async def test_ts_apt_004_shift_capacity_limit_concurrent_different_slots_only_one_wins(concurrent_api_client, committed_booking):
    """
    Hai người đặt đồng thời vào 2 mốc giờ trống khác nhau khi cả Ca khám
    (gioi_han_ca_kham = 5) chỉ còn đúng 1 suất cuối cùng:
    - Khóa bi quan SELECT FOR UPDATE đảm bảo đúng 1 request 201 Created.
    - Request còn lại nhận 409 Conflict (báo ca khám đã đạt giới hạn tối đa).
    - CSDL chỉ ghi nhận đúng 5 lịch trong ca, không thể overbooking lên 6.
    """
    from app.core.security import create_access_token
    from app.models.user import NguoiDung, BenhNhan, TaiKhoan, VaiTroEnum

    data = committed_booking
    ngay = _target_date()

    # 1. Tạo ca làm việc có giới hạn đúng 5 người bệnh (gioi_han_ca_kham = 5)
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

        # 2. Tạo sẵn 4 lịch hẹn chiếm 4 slot đầu (07:30, 08:00, 08:30, 09:00)
        # Ca khám còn lại đúng 1 suất trong khi còn nhiều slot trống (09:30, 10:00, 10:30, 11:00)
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

    # 3. Hai bệnh nhân khác nhau (BN A và BN B) đặt đồng thời vào 2 mốc giờ TRỐNG KHÁC NHAU:
    # BN A đặt vào slot 09:30
    # BN B đặt vào slot 10:00
    slot_a = time(9, 30)
    slot_b = time(10, 0)

    responses = await asyncio.gather(
        _book(concurrent_api_client, data.tokens["bn_a"], data.bs_x.id, ngay, slot_a),
        _book(concurrent_api_client, data.tokens["bn_b"], data.bs_x.id, ngay, slot_b),
    )

    # 4. Kiểm chứng kết quả phản hồi HTTP
    status_codes = sorted(r.status_code for r in responses)
    assert status_codes == [201, 409], f"Kỳ vọng [201, 409] nhưng nhận được: {status_codes}"

    conflict_res = next(r for r in responses if r.status_code == 409)
    assert "đạt giới hạn tiếp nhận tối đa" in conflict_res.text or "Conflict" in conflict_res.text

    # 5. Kiểm chứng CSDL: Tổng số lịch hẹn trong toàn ca đúng bằng 5, tuyệt đối không bị overbooking thành 6
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


