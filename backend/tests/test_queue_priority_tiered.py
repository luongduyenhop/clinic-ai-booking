import pytest
from datetime import date, datetime, timedelta, timezone
from app.services.appointment_service import clinic_now
from sqlalchemy import select
from app.models.user import TaiKhoan
from app.models.appointment import (
    HangDoiKham,
    TrangThaiHangDoiEnum,
    LoaiHangDoiEnum,
)
from app.services.queue_service import queue_service


def tiered_priority_sort_key(ticket):
    """
    Hàm phân loại thứ tự ưu tiên chuẩn (Lát cắt C - Tiered Priority Policy):
    - Tier 1: Cấp cứu / Emergency (muc_do_uu_tien = 1) -> Tuyệt đối ưu tiên số 1
    - Tier 2: Đánh giá lâm sàng khẩn cấp / Hẹn đúng giờ (muc_do_uu_tien = 2)
    - Tier 3: Trả kết quả cận lâm sàng / RETURN_AFTER_RESULT (muc_do_uu_tien = 3)
    - Tier 4: Đối tượng chính sách / Đến sớm (muc_do_uu_tien = 4)
    - Tier 5: Vãng lai / Đến muộn (muc_do_uu_tien = 5)
    Tie-breaker trong cùng Tier: (so_thu_tu_kham, arrival_time)
    """
    arrival = ticket.get("arrival_time") if isinstance(ticket, dict) else ticket.thoi_gian_check_in
    tier = ticket.get("muc_do_uu_tien") if isinstance(ticket, dict) else ticket.muc_do_uu_tien
    stt = ticket.get("stt") if isinstance(ticket, dict) else ticket.so_thu_tu_kham
    return (tier, stt, arrival)


def test_tiered_priority_invariants():
    """
    Kiểm thử các bất biến nghiệp vụ hàng đợi (Invariants) theo Quyết định rà soát 25/10/2026:
    1. Cấp cứu (Tier 1) không bao giờ bị ca trả kết quả CLS (Tier 3) hay ca hẹn thường vượt qua.
    2. Ca trả kết quả CLS (Tier 3) luôn đứng trước ca vãng lai thông thường (Tier 5).
    3. Trong cùng một Tier, bệnh nhân đến trước (arrival_time) và STT nhỏ hơn được phục vụ trước.
    """
    now = datetime(2026, 10, 25, 8, 30, 0, tzinfo=timezone.utc)

    tickets = [
        # Ca 1: Vãng lai đến sớm từ 07:45 (Tier 5)
        {"id": "WALK_IN_1", "muc_do_uu_tien": 5, "stt": 10, "arrival_time": now - timedelta(minutes=45)},
        # Ca 2: Trả kết quả CLS đến lúc 08:15 (Tier 3)
        {"id": "CLS_RETURN", "muc_do_uu_tien": 3, "stt": 4, "arrival_time": now - timedelta(minutes=15)},
        # Ca 3: Cấp cứu đột xuất vừa tới lúc 08:29 (Tier 1)
        {"id": "EMERGENCY_CRITICAL", "muc_do_uu_tien": 1, "stt": 99, "arrival_time": now - timedelta(minutes=1)},
        # Ca 4: Khám đúng hẹn lúc 08:00 (Tier 2)
        {"id": "APPOINTMENT_ON_TIME_1", "muc_do_uu_tien": 2, "stt": 2, "arrival_time": now - timedelta(minutes=30)},
        # Ca 5: Khám đúng hẹn lúc 08:10 (Tier 2)
        {"id": "APPOINTMENT_ON_TIME_2", "muc_do_uu_tien": 2, "stt": 3, "arrival_time": now - timedelta(minutes=20)},
    ]

    sorted_list = sorted(tickets, key=tiered_priority_sort_key)
    ordered_ids = [t["id"] for t in sorted_list]

    # Khẳng định 1: Cấp cứu phải đứng vị trí ĐẦU TIÊN (vượt qua tất cả, dù đến muộn nhất lúc 08:29)
    assert ordered_ids[0] == "EMERGENCY_CRITICAL", "Lỗi an toàn: Cấp cứu phải luôn ở vị trí số 1!"

    # Khẳng định 2: Hẹn đúng giờ (Tier 2) xếp thứ 2 và 3, ca đến trước đứng trước
    assert ordered_ids[1] == "APPOINTMENT_ON_TIME_1"
    assert ordered_ids[2] == "APPOINTMENT_ON_TIME_2"

    # Khẳng định 3: Trả kết quả CLS (Tier 3) xếp thứ 4 (không vượt cấp cứu/đúng giờ, nhưng trước vãng lai)
    assert ordered_ids[3] == "CLS_RETURN"

    # Khẳng định 4: Vãng lai (Tier 5) xếp cuối cùng dù đến sớm nhất từ 07:45
    assert ordered_ids[4] == "WALK_IN_1"


@pytest.mark.asyncio
async def test_emergency_never_superseded_by_cls_return_db(booking, db_session):
    """
    Tích hợp DB: Bác sĩ bấm call_next_patient luôn lấy ca Cấp cứu (Tier 1)
    trước ca quay lại sau CLS (Tier 3).
    """
    today = clinic_now().date()
    now = datetime.now(timezone.utc)
    bs = booking.bs_x

    stmt_tk = select(TaiKhoan).where(TaiKhoan.nguoi_dung_id == bs.nguoi_dung_id)
    doctor_user = (await db_session.execute(stmt_tk)).scalar_one()

    # Dọn dẹp ca đang khám nếu có
    stmt_active = select(HangDoiKham).where(
        HangDoiKham.bac_si_id == bs.id,
        HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value
    )
    actives = (await db_session.execute(stmt_active)).scalars().all()
    for a in actives:
        a.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
    await db_session.commit()

    # Tạo ca quay lại sau CLS (Tier 3) đến trước 30 phút
    ticket_cls = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=1,
        loai_hang_doi="tai_kham_cls",
        muc_do_uu_tien=3,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now - timedelta(minutes=30),
        so_lan_goi=0,
    )

    # Tạo ca Cấp cứu (Tier 1) đến sau
    ticket_emergency = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=2,
        loai_hang_doi="cap_cuu",
        muc_do_uu_tien=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
        so_lan_goi=0,
    )

    db_session.add_all([ticket_cls, ticket_emergency])
    await db_session.commit()

    call_res = await queue_service.call_next_patient(doctor_user, db_session)
    assert call_res.ticket is not None
    assert call_res.ticket.muc_do_uu_tien == 1
    assert call_res.ticket.id == ticket_emergency.id


@pytest.mark.asyncio
async def test_cls_return_prioritized_over_routine_walkin_db(booking, db_session):
    """
    Tích hợp DB: Bác sĩ bấm call_next_patient ưu tiên gọi ca quay lại sau CLS (Tier 3)
    trước ca vãng lai thông thường (Tier 5).
    """
    today = clinic_now().date()
    now = datetime.now(timezone.utc)
    bs = booking.bs_x

    stmt_tk = select(TaiKhoan).where(TaiKhoan.nguoi_dung_id == bs.nguoi_dung_id)
    doctor_user = (await db_session.execute(stmt_tk)).scalar_one()

    stmt_active = select(HangDoiKham).where(
        HangDoiKham.bac_si_id == bs.id,
        HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value
    )
    actives = (await db_session.execute(stmt_active)).scalars().all()
    for a in actives:
        a.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
    await db_session.commit()

    # Vãng lai (Tier 5) đến trước 20 phút
    ticket_walkin = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=10,
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        muc_do_uu_tien=5,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now - timedelta(minutes=20),
        so_lan_goi=0,
    )

    # Quay lại sau CLS (Tier 3) vừa có kết quả
    ticket_cls = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=11,
        loai_hang_doi="tai_kham_cls",
        muc_do_uu_tien=3,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
        so_lan_goi=0,
    )

    db_session.add_all([ticket_walkin, ticket_cls])
    await db_session.commit()

    call_res = await queue_service.call_next_patient(doctor_user, db_session)
    assert call_res.ticket is not None
    assert call_res.ticket.muc_do_uu_tien == 3
    assert call_res.ticket.id == ticket_cls.id


@pytest.mark.asyncio
async def test_same_tier_arrival_time_tie_breaker_db(booking, db_session):
    """
    Tích hợp DB: Trong cùng Tier 2 (khám đúng hẹn), ca đến trước (arrival time)
    được gọi trước.
    """
    today = clinic_now().date()
    now = datetime.now(timezone.utc)
    bs = booking.bs_x

    stmt_tk = select(TaiKhoan).where(TaiKhoan.nguoi_dung_id == bs.nguoi_dung_id)
    doctor_user = (await db_session.execute(stmt_tk)).scalar_one()

    stmt_active = select(HangDoiKham).where(
        HangDoiKham.bac_si_id == bs.id,
        HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value
    )
    actives = (await db_session.execute(stmt_active)).scalars().all()
    for a in actives:
        a.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
    await db_session.commit()

    # Người 1 đến trước lúc -10 phút
    ticket_early = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=20,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now - timedelta(minutes=10),
        so_lan_goi=0,
    )

    # Người 2 đến sau lúc -2 phút
    ticket_later = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=21,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now - timedelta(minutes=2),
        so_lan_goi=0,
    )

    db_session.add_all([ticket_early, ticket_later])
    await db_session.commit()

    call_res = await queue_service.call_next_patient(doctor_user, db_session)
    assert call_res.ticket is not None
    assert call_res.ticket.id == ticket_early.id
