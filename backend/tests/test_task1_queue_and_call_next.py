import pytest
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select

from app.core.config import settings
from app.models.appointment import (
    CaLamViecEnum,
    HangDoiKham,
    LichKham,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import ChuyenKhoa


def _get_clinic_now():
    clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
    return datetime.now(clinic_tz)


async def _dam_bao_chuyen_khoa(db_session, ma_ck="KHOA_NOI", ten_ck="Khoa Nội", vi_tri_phong="Phòng 102 - Tầng 1"):
    stmt = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == ma_ck)
    ck = (await db_session.execute(stmt)).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(
            ma_chuyen_khoa=ma_ck,
            ten_chuyen_khoa=ten_ck,
            vi_tri_phong=vi_tri_phong,
            is_active=True,
        )
        db_session.add(ck)
        await db_session.flush()
    return ck


@pytest.mark.asyncio
async def test_task1_check_in_arrival_window_calculation_with_timezone(api_client, booking, db_session):
    """
    Task 1 AC1 (PJ2026-136):
    Kiểm tra phân loại khung giờ đến (Arrival Window Logic) tính toán theo actual ngay_kham & timezone:
    - Đến sớm >= 30p: Xếp loại den_som, mức ưu tiên 4.
    - Đến đúng hẹn (-15p < diff < 30p): Xếp loại dung_hen, mức ưu tiên 2.
    - Đến muộn <= -15p: Xếp loại den_muon, mức ưu tiên 5.
    """
    token_admin = booking.tokens["admin"]
    now_clinic = _get_clinic_now()
    today = now_clinic.date()

    # 1. Hẹn sau 45 phút -> Đến sớm >= 30p
    gio_som = (now_clinic + timedelta(minutes=45)).time().replace(microsecond=0)
    lich_som = LichKham(
        ma_lich_kham=f"LK-TASK1-EARLY-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=gio_som,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    # 2. Hẹn sau 10 phút -> Đến đúng hẹn
    gio_dung = (now_clinic + timedelta(minutes=10)).time().replace(microsecond=0)
    lich_dung = LichKham(
        ma_lich_kham=f"LK-TASK1-ONTIME-{booking.suffix}",
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=gio_dung,
        so_thu_tu=2,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    # 3. Hẹn trước 20 phút -> Đến muộn <= -15p
    gio_muon = (now_clinic - timedelta(minutes=20)).time().replace(microsecond=0)
    lich_muon = LichKham(
        ma_lich_kham=f"LK-TASK1-LATE-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_y.id,
        ngay_kham=today,
        gio_kham=gio_muon,
        so_thu_tu=3,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    db_session.add_all([lich_som, lich_dung, lich_muon])
    await db_session.commit()

    # Check-in ca đến sớm
    res_som = await api_client.post(
        "/api/v1/reception/check-in",
        json={"lich_kham_id": lich_som.id},
        headers=token_admin,
    )
    assert res_som.status_code == 201
    ticket_som = res_som.json()["data"]
    assert ticket_som["loai_hang_doi"] == LoaiHangDoiEnum.DEN_SOM.value
    assert ticket_som["muc_do_uu_tien"] == 4

    # Check-in ca đúng hẹn
    res_dung = await api_client.post(
        "/api/v1/reception/check-in",
        json={"lich_kham_id": lich_dung.id},
        headers=token_admin,
    )
    assert res_dung.status_code == 201
    ticket_dung = res_dung.json()["data"]
    assert ticket_dung["loai_hang_doi"] == LoaiHangDoiEnum.DUNG_HEN.value
    assert ticket_dung["muc_do_uu_tien"] == 2

    # Check-in ca đến muộn
    res_muon = await api_client.post(
        "/api/v1/reception/check-in",
        json={"lich_kham_id": lich_muon.id},
        headers=token_admin,
    )
    assert res_muon.status_code == 201
    ticket_muon = res_muon.json()["data"]
    assert ticket_muon["loai_hang_doi"] == LoaiHangDoiEnum.DEN_MUON.value
    assert ticket_muon["muc_do_uu_tien"] == 5


@pytest.mark.asyncio
async def test_task1_call_next_patient_prioritizes_higher_tier_and_updates_status(api_client, booking, db_session):
    """
    Task 1 AC2 (PJ2026-136):
    Bác sĩ bấm 'Mời khám' (/api/v1/clinical/queue/call-next):
    - Tự động gọi ca có mức ưu tiên cao nhất đang chờ (ưu tiên 2 trước ưu tiên 4).
    - Cập nhật trạng thái vé sang dang_kham, ghi nhận thoi_gian_goi_kham và số lần gọi.
    - Cập nhật trạng thái lịch hẹn tương ứng sang dang_kham.
    - Cung cấp dữ liệu phục vụ loa phát thanh (số thứ tự, tên phòng khám).
    """
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session, vi_tri_phong="Phòng 102 - Tầng 1")
    booking.bs_x.chuyen_khoa_id = ck.id
    await db_session.flush()

    today = date.today()
    now = datetime.now(timezone.utc)

    # Tạo lịch hẹn cho ca đúng giờ
    lich_ontime = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # 1. Vé A: Đến sớm (ưu tiên 4, STT 1, tạo trước)
    hd_early = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.DEN_SOM.value,
        muc_do_uu_tien=4,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now - timedelta(minutes=15),
    )

    # 2. Vé B: Đúng hẹn (ưu tiên 2, STT 2, tạo sau)
    hd_ontime = HangDoiKham(
        lich_kham_id=lich_ontime.id,
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )

    db_session.add_all([hd_early, hd_ontime])
    await db_session.commit()

    # Bác sĩ bấm Mời khám
    res_call = await api_client.post(
        "/api/v1/clinical/queue/call-next",
        headers=token_bs,
    )
    assert res_call.status_code == 200
    data = res_call.json()["data"]

    # Xác nhận: Vé đúng hẹn (ưu tiên 2) được gọi TRƯỚC vé đến sớm (ưu tiên 4)
    called_ticket = data["ticket"]
    assert called_ticket["id"] == hd_ontime.id
    assert called_ticket["so_thu_tu_kham"] == 2
    assert called_ticket["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value
    assert called_ticket["so_lan_goi"] == 1
    assert called_ticket["phong_kham"] == "Phòng 102 - Tầng 1"
    assert data["so_nguoi_con_lai"] == 1
    assert "Đã gọi thành công" in data["message"]

    # Kiểm tra CSDL: trạng thái vé và lịch hẹn đã đổi sang dang_kham
    ticket_db = (
        await db_session.execute(select(HangDoiKham).where(HangDoiKham.id == hd_ontime.id))
    ).scalar_one()
    assert ticket_db.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value
    assert ticket_db.thoi_gian_goi_kham is not None
    assert ticket_db.thoi_gian_bat_dau is not None

    lich_db = (
        await db_session.execute(select(LichKham).where(LichKham.id == lich_ontime.id))
    ).scalar_one()
    assert lich_db.trang_thai == TrangThaiLichEnum.DANG_KHAM.value


@pytest.mark.asyncio
async def test_task1_guard_a4_concurrency_conflict(api_client, booking, db_session):
    """
    Task 1 AC3: Guard A4 (Concurrency & Khám đè):
    Bác sĩ chỉ được phép khám đúng 1 bệnh nhân tại 1 thời điểm.
    Nếu đang có ca dang_kham, bấm gọi tiếp phải bị chặn với HTTP 409 Conflict.
    """
    token_bs = booking.tokens["bs_x"]
    today = date.today()
    now = datetime.now(timezone.utc)

    hd1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    hd2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    db_session.add_all([hd1, hd2])
    await db_session.commit()

    # Lần 1: Bác sĩ gọi thành công vé 1
    res1 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res1.status_code == 200
    assert res1.json()["data"]["ticket"]["so_thu_tu_kham"] == 1

    # Lần 2: Bác sĩ bấm gọi tiếp khi ca 1 chưa hoàn tất hoặc tạm hoãn -> 409 Conflict
    res2 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res2.status_code == 409
    assert "chưa hoàn tất" in res2.json()["message"]


@pytest.mark.asyncio
async def test_task1_postpone_ticket_and_resume_calling(api_client, booking, db_session):
    """
    Task 1 AC4: Tạm hoãn ca khám (/api/v1/clinical/queue/{ticket_id}/postpone):
    Khi gọi loa nhiều lần không vào, bác sĩ tạm hoãn ca hiện tại.
    Sau khi tạm hoãn, trạng thái DANG_KHAM được giải phóng và bác sĩ gọi được ca tiếp theo.
    """
    token_bs = booking.tokens["bs_x"]
    today = date.today()
    now = datetime.now(timezone.utc)

    hd1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    hd2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    db_session.add_all([hd1, hd2])
    await db_session.commit()

    # Bác sĩ gọi vé 1
    res1 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    ticket1_id = res1.json()["data"]["ticket"]["id"]

    # Bác sĩ tạm hoãn vé 1 (do gọi loa không vào)
    res_postpone = await api_client.post(
        f"/api/v1/clinical/queue/{ticket1_id}/postpone",
        headers=token_bs,
    )
    assert res_postpone.status_code == 200
    assert res_postpone.json()["data"]["trang_thai"] == TrangThaiHangDoiEnum.TAM_HOAN.value

    # Kiểm tra trong CSDL vé 1 đã chuyển sang tam_hoan
    t1_db = (
        await db_session.execute(select(HangDoiKham).where(HangDoiKham.id == ticket1_id))
    ).scalar_one()
    assert t1_db.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value

    # Bác sĩ tiếp tục gọi ca tiếp theo thành công (không bị Guard A4 chặn nữa)
    res2 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res2.status_code == 200
    assert res2.json()["data"]["ticket"]["so_thu_tu_kham"] == 2


@pytest.mark.asyncio
async def test_task1_doctor_queue_board_and_empty_queue_handling(api_client, booking, db_session):
    """
    Task 1 AC5 & AC6:
    - Tra cứu bảng hàng đợi phòng khám theo thời gian thực (/api/v1/reception/queue/{doctor_id}).
    - Xử lý khi hàng đợi hết bệnh nhân chờ: call-next trả về thông báo êm dịu, không crash.
    """
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session, vi_tri_phong="Phòng 102 - Tầng 1")
    booking.bs_x.chuyen_khoa_id = ck.id
    await db_session.flush()

    today = date.today()
    now = datetime.now(timezone.utc)

    # 1. Tạo 1 vé đang chờ và 1 vé tạm hoãn
    hd_cho = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    hd_hoan = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.TAM_HOAN.value,
        thoi_gian_check_in=now,
    )
    db_session.add_all([hd_cho, hd_hoan])
    await db_session.commit()

    # Tra cứu bảng hàng đợi của bác sĩ
    res_board = await api_client.get(f"/api/v1/reception/queue/{booking.bs_x.id}")
    assert res_board.status_code == 200
    board_data = res_board.json()["data"]
    assert board_data["phong_kham"] == "Phòng 102 - Tầng 1"
    assert board_data["so_nguoi_dang_cho"] == 1
    assert len(board_data["danh_sach_cho_kham"]) == 1
    assert len(board_data["danh_sach_tam_hoan"]) == 1
    assert board_data["benh_nhan_dang_kham"] is None

    # Bác sĩ gọi người đang chờ duy nhất
    res_call = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res_call.status_code == 200
    assert res_call.json()["data"]["ticket"]["id"] == hd_cho.id

    # Hoàn thành hoặc chuyển trạng thái để hàng đợi CHO_KHAM hoàn toàn rỗng
    hd_cho_db = (
        await db_session.execute(select(HangDoiKham).where(HangDoiKham.id == hd_cho.id))
    ).scalar_one()
    hd_cho_db.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
    await db_session.commit()

    # Bác sĩ gọi tiếp khi hàng đợi rỗng -> Trả về thông báo không còn bệnh nhân chờ
    res_empty = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res_empty.status_code == 200
    empty_data = res_empty.json()["data"]
    assert empty_data["ticket"] is None
    assert empty_data["so_nguoi_con_lai"] == 0
    assert "không còn bệnh nhân" in empty_data["message"]
