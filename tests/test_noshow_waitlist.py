import pytest
from datetime import datetime, timedelta, time
from app.models.appointment import TrangThaiLichEnum, TrangThaiWaitlistEnum, CaLamViecEnum, DanhSachCho
from app.services.appointment_service import clinic_now



from app.schemas.appointment import (
    WaitlistCreateRequest,
    NoShowMarkResponse,
)



def test_waitlist_create_request_schema():
    """Kiểm tra schema đăng ký danh sách chờ hợp lệ"""
    req = WaitlistCreateRequest(
        bac_si_id=1,
        ngay_mong_muon=clinic_now().date(),
        ca_mong_muon="sang",
        trieu_chung="Cần khám sớm"
    )
    assert req.bac_si_id == 1
    assert req.ca_mong_muon == "sang"


def test_noshow_warning_threshold_rule():
    """Kiểm tra quy tắc cảnh báo vi phạm khi số lần No-show >= 3"""
    res_under = NoShowMarkResponse(
        appointment_id=1,
        ma_lich_kham="LK-TEST",
        trang_thai="no_show",
        benh_nhan_id=10,
        so_lan_no_show=2,
        canh_bao_khoa_tai_khoan=False
    )
    assert res_under.canh_bao_khoa_tai_khoan is False

    res_over = NoShowMarkResponse(
        appointment_id=1,
        ma_lich_kham="LK-TEST",
        trang_thai="no_show",
        benh_nhan_id=10,
        so_lan_no_show=3,
        canh_bao_khoa_tai_khoan=True
    )
    assert res_over.canh_bao_khoa_tai_khoan is True
    assert res_over.so_lan_no_show >= 3


def test_waitlist_enum_statuses():
    """Kiểm tra các trạng thái hợp lệ của hàng đợi thông minh Waitlist"""
    assert TrangThaiWaitlistEnum.DANG_CHO.value == "dang_cho"
    assert TrangThaiWaitlistEnum.DA_THONG_BAO.value == "da_thong_bao"
    assert TrangThaiWaitlistEnum.DA_NHAN_SLOT.value == "da_nhan_slot"


@pytest.mark.asyncio

async def test_confirm_appointment_24h_success(api_client, booking):
    """Bệnh nhân xác nhận lịch hẹn trước 24h thành công (Reconfirmation Flow)"""
    token_patient = booking.tokens["bn_a"]
    future_time = clinic_now() + timedelta(hours=10)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, future_time)

    response = await api_client.post(
        f"/api/v1/appointments/{lich.id}/confirm",
        headers=token_patient
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["appointment_id"] == lich.id
    assert data["is_reconfirmed_24h"] is True
    assert data["trang_thai"] == TrangThaiLichEnum.DA_XAC_NHAN.value


@pytest.mark.asyncio
async def test_confirm_appointment_forbidden_for_other_patient(api_client, booking):
    """Bệnh nhân khác không có quyền xác nhận lịch hẹn của người khác (403 Forbidden)"""
    token_other = booking.tokens["bn_b"]
    future_time = clinic_now() + timedelta(hours=10)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, future_time)

    response = await api_client.post(
        f"/api/v1/appointments/{lich.id}/confirm",
        headers=token_other
    )
    assert response.status_code == 403
    assert "không có quyền xác nhận" in response.json()["message"]


@pytest.mark.asyncio
async def test_confirm_appointment_conflict_if_already_confirmed(api_client, booking):
    """Xác nhận lại một lịch hẹn đã được xác nhận trước đó sẽ báo lỗi 409 Conflict"""
    token_patient = booking.tokens["bn_a"]
    future_time = clinic_now() + timedelta(hours=10)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, future_time)

    # Lần 1: Thành công
    res1 = await api_client.post(f"/api/v1/appointments/{lich.id}/confirm", headers=token_patient)
    assert res1.status_code == 200

    # Lần 2: Xung đột
    res2 = await api_client.post(f"/api/v1/appointments/{lich.id}/confirm", headers=token_patient)
    assert res2.status_code == 409
    assert "đã được xác nhận trước đó" in res2.json()["message"]


@pytest.mark.asyncio
async def test_mark_no_show_by_doctor_increases_penalty(api_client, booking, db_session):
    """Bác sĩ phụ trách đánh dấu No-show cho bệnh nhân vắng mặt và tăng số lần phạt"""
    token_doctor = booking.tokens["bs_x"]
    # Giờ khám đã tới hoặc đã qua
    past_time = clinic_now() - timedelta(minutes=10)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, past_time)

    response = await api_client.post(
        f"/api/v1/appointments/{lich.id}/no-show",
        json={"ghi_chu": "Bệnh nhân không có mặt tại phòng khám"},
        headers=token_doctor
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["trang_thai"] == TrangThaiLichEnum.NO_SHOW.value
    assert data["so_lan_no_show"] >= 1


@pytest.mark.asyncio
async def test_mark_no_show_forbidden_for_patient(api_client, booking):
    """Bệnh nhân không được tự ý gọi API đánh dấu No-show (403 Forbidden)"""
    token_patient = booking.tokens["bn_a"]
    past_time = clinic_now() - timedelta(minutes=10)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, past_time)

    response = await api_client.post(
        f"/api/v1/appointments/{lich.id}/no-show",
        headers=token_patient
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_waitlist_registration_fifo_and_query(api_client, booking):
    """Kiểm tra bệnh nhân đăng ký Waitlist, thứ tự ưu tiên tăng dần (FIFO) và tra cứu danh sách chờ"""
    token_a = booking.tokens["bn_a"]
    token_b = booking.tokens["bn_b"]
    target_date = (clinic_now() + timedelta(days=2)).date()

    payload_a = {
        "bac_si_id": booking.bs_x.id,
        "ngay_mong_muon": str(target_date),
        "ca_mong_muon": "sang",
        "trieu_chung": "Khám tim mạch"
    }
    res_a = await api_client.post("/api/v1/appointments/waitlist", json=payload_a, headers=token_a)
    assert res_a.status_code == 201
    data_a = res_a.json()["data"]
    assert data_a["thu_tu_uu_tien"] == 1
    assert data_a["trang_thai"] == TrangThaiWaitlistEnum.DANG_CHO.value

    # Bệnh nhân B đăng ký sau -> Thứ tự ưu tiên là 2
    payload_b = {
        "bac_si_id": booking.bs_x.id,
        "ngay_mong_muon": str(target_date),
        "ca_mong_muon": "sang",
        "trieu_chung": "Đau ngực"
    }
    res_b = await api_client.post("/api/v1/appointments/waitlist", json=payload_b, headers=token_b)
    assert res_b.status_code == 201
    data_b = res_b.json()["data"]
    assert data_b["thu_tu_uu_tien"] == 2

    # Bệnh nhân A đăng ký trùng ca lần nữa -> Bị chặn 409
    res_dup = await api_client.post("/api/v1/appointments/waitlist", json=payload_a, headers=token_a)
    assert res_dup.status_code == 409

    # Bệnh nhân A tra cứu danh sách chờ của mình
    res_my_waitlist = await api_client.get("/api/v1/appointments/my-waitlist", headers=token_a)
    assert res_my_waitlist.status_code == 200
    my_list = res_my_waitlist.json()["data"]
    assert len(my_list) >= 1
    assert my_list[0]["bac_si_id"] == booking.bs_x.id


@pytest.mark.asyncio
async def test_cancellation_promotes_waitlist_candidate(api_client, booking, db_session):
    """Khi một lịch khám bị hủy, ứng viên đầu tiên trong Waitlist tự động được đôn lên giữ slot 30 phút"""
    target_date = (clinic_now() + timedelta(days=3)).date()
    target_time = time(9, 0)
    target_dt = datetime.combine(target_date, target_time)

    # 1. Bệnh nhân A có lịch khám còn hiệu lực
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, target_dt)

    # 2. Bệnh nhân B xếp hàng chờ cùng Bác sĩ + Ngày + Ca sáng
    waitlist_entry = DanhSachCho(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_mong_muon=target_date,
        ca_mong_muon=CaLamViecEnum.SANG.value,
        trieu_chung="Cần khám gấp",
        thu_tu_uu_tien=1,
        trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value
    )
    db_session.add(waitlist_entry)
    await db_session.flush()

    # 3. Bệnh nhân A hủy lịch khám
    token_a = booking.tokens["bn_a"]
    res_cancel = await api_client.post(
        f"/api/v1/appointments/{lich.id}/cancel",
        json={"ly_do_huy": "Bận việc đột xuất không thể đến khám"},
        headers=token_a
    )
    assert res_cancel.status_code == 200

    # 4. Kiểm tra người trong waitlist tự động được chuyển sang 'da_thong_bao' và có slot_duoc_cap_id
    await db_session.refresh(waitlist_entry)
    assert waitlist_entry.trang_thai == TrangThaiWaitlistEnum.DA_THONG_BAO.value
    assert waitlist_entry.slot_duoc_cap_id == lich.id
    assert waitlist_entry.thoi_gian_het_han_giu_slot is not None

    # 5. Bệnh nhân B bấm xác nhận nhận slot khám (Waitlist Acceptance Flow)
    token_b = booking.tokens["bn_b"]
    res_accept = await api_client.post(
        f"/api/v1/appointments/waitlist/{waitlist_entry.id}/accept",
        headers=token_b
    )
    assert res_accept.status_code == 200
    acc_data = res_accept.json()["data"]
    assert acc_data["trang_thai"] == TrangThaiLichEnum.DA_XAC_NHAN.value
    assert acc_data["benh_nhan"]["id"] == booking.bn_b.id

    # 6. Kiểm tra trạng thái waitlist chuyển sang 'da_nhan_slot'
    await db_session.refresh(waitlist_entry)
    assert waitlist_entry.trang_thai == TrangThaiWaitlistEnum.DA_NHAN_SLOT.value


@pytest.mark.asyncio
async def test_auto_process_unconfirmed_appointments(api_client, booking, db_session):
    """Kiểm tra endpoint tự động quét và hủy các lịch khám chưa xác nhận trước 2 tiếng"""
    token_admin = booking.tokens["admin"]
    # Lịch khám cách hiện tại 1 tiếng và chưa xác nhận 24h
    near_time = clinic_now() + timedelta(hours=1)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, near_time)
    assert lich.is_reconfirmed_24h is False

    response = await api_client.post(
        "/api/v1/appointments/process-unconfirmed?hours_threshold=2.0",
        headers=token_admin
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["so_lich_tu_dong_huy"] >= 1
    assert lich.ma_lich_kham in data["danh_sach_ma_lich_huy"]

    await db_session.refresh(lich)
    assert lich.trang_thai == TrangThaiLichEnum.TU_DONG_HUY.value


@pytest.mark.asyncio
async def test_auto_process_unconfirmed_forbidden_for_non_admin(api_client, booking):
    """Bệnh nhân hoặc người dùng không phải Admin không được phép kích hoạt tự hủy lịch hẹn (403 Forbidden)"""
    token_patient = booking.tokens["bn_a"]
    response = await api_client.post(
        "/api/v1/appointments/process-unconfirmed?hours_threshold=2.0",
        headers=token_patient
    )
    assert response.status_code == 403
    assert "Chỉ Quản trị viên" in response.json()["message"]

