from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.appointment import HangDoiKham, LichKham
from app.models.medical import (
    BienBanDinhChinh,
    ChiDinh,
    ChiTietHoaDon,
    GiaoDichThanhToan,
    HoaDon,
    LuotKham,
    PhieuThuChi,
)
from app.services.admin_service import admin_service
from app.services.queue_service import queue_service
from scripts.seed_one_week_realistic import seed_week_and_today_cases


async def _create_sqlite_session_factory():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False)


async def _snapshot_counts(session) -> dict[str, int]:
    models = {
        "lich_kham": LichKham,
        "hang_doi_kham": HangDoiKham,
        "luot_kham": LuotKham,
        "chi_dinh": ChiDinh,
        "hoa_don": HoaDon,
        "chi_tiet_hoa_don": ChiTietHoaDon,
        "giao_dich_thanh_toan": GiaoDichThanhToan,
        "phieu_thu_chi": PhieuThuChi,
        "bien_ban_dinh_chinh": BienBanDinhChinh,
    }
    counts: dict[str, int] = {}
    for key, model in models.items():
        counts[key] = int(await session.scalar(select(func.count()).select_from(model)) or 0)
    return counts


@pytest.mark.asyncio
async def test_seed_one_week_is_idempotent_same_day():
    engine, session_factory = await _create_sqlite_session_factory()
    day1_first_run = datetime(2026, 11, 20, 3, 0, tzinfo=timezone.utc)
    day1_second_run = datetime(2026, 11, 20, 4, 0, tzinfo=timezone.utc)
    try:
        async with session_factory() as session:
            async with session.begin():
                seeded_day = await seed_week_and_today_cases(
                    session,
                    "Demo@12345678",
                    now_override=day1_first_run,
                )
            assert seeded_day == date(2026, 11, 20)
            first_counts = await _snapshot_counts(session)

        async with session_factory() as session:
            async with session.begin():
                seeded_day_again = await seed_week_and_today_cases(
                    session,
                    "Demo@12345678",
                    now_override=day1_second_run,
                )
            assert seeded_day_again == date(2026, 11, 20)
            second_counts = await _snapshot_counts(session)
            assert second_counts == first_counts

            sepay_inv = await session.scalar(
                select(HoaDon).where(HoaDon.ma_hoa_don == "HD-TODAY-SEPAY-001")
            )
            assert sepay_inv is not None
            assert sepay_inv.trang_thai == "chua_thu"
            assert Decimal(str(sepay_inv.thuc_thu)) == Decimal("0")
            sepay_items = list(
                (await session.scalars(select(ChiTietHoaDon).where(ChiTietHoaDon.hoa_don_id == sepay_inv.id))).all()
            )
            assert len(sepay_items) == 1
            sepay_receipts = list(
                (await session.scalars(select(PhieuThuChi).where(PhieuThuChi.hoa_don_id == sepay_inv.id))).all()
            )
            assert sepay_receipts == []
            sepay_txns = list(
                (
                    await session.scalars(
                        select(GiaoDichThanhToan).where(GiaoDichThanhToan.hoa_don_id == sepay_inv.id)
                    )
                ).all()
            )
            assert sepay_txns == []

            paid_invoices = list(
                (await session.scalars(select(HoaDon).where(HoaDon.trang_thai == "da_thu"))).all()
            )
            assert len(paid_invoices) == 21
            for paid_inv in paid_invoices:
                pt_count = await session.scalar(
                    select(func.count()).select_from(PhieuThuChi).where(PhieuThuChi.hoa_don_id == paid_inv.id)
                )
                txn_count = await session.scalar(
                    select(func.count())
                    .select_from(GiaoDichThanhToan)
                    .where(GiaoDichThanhToan.hoa_don_id == paid_inv.id)
                )
                assert int(pt_count or 0) == 1
                assert int(txn_count or 0) == 1

            lab_encounter = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == "KCB-TODAY-LAB"))
            assert lab_encounter is not None
            lab_orders = list(
                (await session.scalars(select(ChiDinh).where(ChiDinh.luot_kham_id == lab_encounter.id))).all()
            )
            assert len(lab_orders) == 2
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_seed_one_week_rolls_today_cases_forward_on_new_day():
    engine, session_factory = await _create_sqlite_session_factory()
    day1_now = datetime(2026, 11, 20, 3, 0, tzinfo=timezone.utc)
    day2_now = datetime(2026, 11, 21, 3, 0, tzinfo=timezone.utc)
    try:
        async with session_factory() as session:
            async with session.begin():
                await seed_week_and_today_cases(session, "Demo@12345678", now_override=day1_now)

        async with session_factory() as session:
            async with session.begin():
                sepay_inv = await session.scalar(
                    select(HoaDon).where(HoaDon.ma_hoa_don == "HD-TODAY-SEPAY-001")
                )
                assert sepay_inv is not None
                sepay_inv.trang_thai = "da_thu"
                sepay_inv.thuc_thu = sepay_inv.so_tien_phai_thu
                sepay_inv.ngay_thanh_toan = day1_now
                session.add(
                    PhieuThuChi(
                        ma_phieu="PT-HD-TODAY-SEPAY-001",
                        loai_phieu="THU",
                        hoa_don_id=sepay_inv.id,
                        nguoi_giao_dich="Bệnh nhân thử nghiệm",
                        so_tien=sepay_inv.so_tien_phai_thu,
                        phuong_thuc="chuyen_khoan",
                        ly_do="Thu thử nghiệm trước khi sang ngày mới",
                        nhan_vien_id=sepay_inv.nguoi_lap_id,
                        thoi_gian=day1_now,
                        trang_thai_khoa_so=False,
                    )
                )
                session.add(
                    GiaoDichThanhToan(
                        ma_giao_dich="GD-DIRTY-SEPAY-001",
                        hoa_don_id=sepay_inv.id,
                        loai_giao_dich="THANH_TOAN",
                        so_tien=sepay_inv.so_tien_phai_thu,
                        phuong_thuc="CHUYEN_KHOAN",
                        nguon_tao_giao_dich="CONG_SEPAY",
                        thoi_gian_giao_dich=day1_now,
                        thoi_gian_xac_nhan=day1_now,
                        trang_thai="THANH_CONG",
                    )
                )

                lab_encounter = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == "KCB-TODAY-LAB"))
                assert lab_encounter is not None
                existing_order = await session.scalar(
                    select(ChiDinh).where(ChiDinh.luot_kham_id == lab_encounter.id)
                )
                assert existing_order is not None
                session.add(
                    ChiDinh(
                        luot_kham_id=lab_encounter.id,
                        dich_vu_id=existing_order.dich_vu_id,
                        bac_si_chi_dinh_id=existing_order.bac_si_chi_dinh_id,
                        phong_thuc_hien_id=existing_order.phong_thuc_hien_id,
                        don_gia_tai_thoi_diem=existing_order.don_gia_tai_thoi_diem,
                        thanh_tien=existing_order.thanh_tien,
                        trang_thai="cho_thuc_hien",
                    )
                )

                curr_encounter = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == "KCB-TODAY-001"))
                assert curr_encounter is not None
                curr_encounter.is_locked = True
                curr_encounter.thoi_gian_khoa = day1_now + timedelta(minutes=20)

        async with session_factory() as session:
            async with session.begin():
                rolled_day = await seed_week_and_today_cases(
                    session,
                    "Demo@12345678",
                    now_override=day2_now,
                )
            assert rolled_day == date(2026, 11, 21)

            today_appts = list(
                (
                    await session.scalars(
                        select(LichKham).where(LichKham.ma_lich_kham.like("LK-TODAY-%")).order_by(LichKham.id.asc())
                    )
                ).all()
            )
            assert len(today_appts) == 5
            assert all(appt.ngay_kham == date(2026, 11, 21) for appt in today_appts)

            today_appt_ids = [appt.id for appt in today_appts]
            today_queues = list(
                (await session.scalars(select(HangDoiKham).where(HangDoiKham.lich_kham_id.in_(today_appt_ids)))).all()
            )
            assert len(today_queues) == 5
            assert all(ticket.ngay_kham == date(2026, 11, 21) for ticket in today_queues)

            for kcb_code in ("KCB-TODAY-001", "KCB-TODAY-LAB", "KCB-TODAY-CASHIER"):
                enc = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == kcb_code))
                assert enc is not None
                assert enc.created_at is not None
                assert enc.created_at.date() == date(2026, 11, 21)
                if kcb_code in ("KCB-TODAY-001", "KCB-TODAY-LAB"):
                    assert enc.is_locked is False
                else:
                    assert enc.is_locked is True

            lab_enc = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == "KCB-TODAY-LAB"))
            assert lab_enc is not None
            lab_orders = list(
                (
                    await session.scalars(
                        select(ChiDinh).where(ChiDinh.luot_kham_id == lab_enc.id).order_by(ChiDinh.id.asc())
                    )
                ).all()
            )
            assert len(lab_orders) == 2
            assert [order.trang_thai for order in lab_orders] == ["cho_thuc_hien", "cho_duyet"]

            rolled_inv = await session.scalar(
                select(HoaDon).where(HoaDon.ma_hoa_don == "HD-TODAY-SEPAY-001")
            )
            assert rolled_inv is not None
            assert rolled_inv.trang_thai == "chua_thu"
            assert Decimal(str(rolled_inv.thuc_thu)) == Decimal("0")
            assert rolled_inv.ngay_thanh_toan is None
            assert rolled_inv.created_at is not None
            assert rolled_inv.created_at.date() == date(2026, 11, 21)
            rolled_items = list(
                (await session.scalars(select(ChiTietHoaDon).where(ChiTietHoaDon.hoa_don_id == rolled_inv.id))).all()
            )
            assert len(rolled_items) == 1
            rolled_receipts = list(
                (await session.scalars(select(PhieuThuChi).where(PhieuThuChi.hoa_don_id == rolled_inv.id))).all()
            )
            assert rolled_receipts == []
            rolled_txns = list(
                (
                    await session.scalars(
                        select(GiaoDichThanhToan).where(GiaoDichThanhToan.hoa_don_id == rolled_inv.id)
                    )
                ).all()
            )
            assert rolled_txns == []

            yesterday_appts = list(
                (
                    await session.scalars(
                        select(LichKham).where(LichKham.ma_lich_kham.like("LK-20261120-%"))
                    )
                ).all()
            )
            assert len(yesterday_appts) == 3

            amend_count = await session.scalar(
                select(func.count())
                .select_from(BienBanDinhChinh)
                .where(BienBanDinhChinh.ly_do_ma == "BO_SUNG_KET_QUA_CLS")
            )
            assert int(amend_count or 0) == 1
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_seed_one_week_populates_admin_and_both_reception_shifts():
    engine, session_factory = await _create_sqlite_session_factory()
    day1_now = datetime(2026, 11, 20, 3, 0, tzinfo=timezone.utc)
    day2_now = datetime(2026, 11, 21, 14, 45, tzinfo=timezone.utc)
    try:
        async with session_factory() as session:
            async with session.begin():
                await seed_week_and_today_cases(session, "Demo@12345678", now_override=day1_now)

        async with session_factory() as session:
            async with session.begin():
                rolled_day = await seed_week_and_today_cases(
                    session,
                    "Demo@12345678",
                    now_override=day2_now,
                )
            assert rolled_day == date(2026, 11, 21)

            admin_stats = await admin_service.get_dashboard_stats(date(2026, 11, 21), session)
            assert admin_stats.tong_lich_hen_hom_nay == 5
            assert admin_stats.so_ca_cho_kham == 3
            assert admin_stats.so_ca_dang_kham == 1
            assert admin_stats.so_ca_hoan_tat_kham == 1
            assert admin_stats.tong_doanh_thu_trong_ngay > 0

            sang_dash = await queue_service.get_shift_dashboard(
                query_date=date(2026, 11, 21),
                ca_kham="sang",
                db=session,
            )
            assert sang_dash.tong_hen_truoc == 3
            assert sang_dash.da_check_in == 3
            assert sang_dash.dang_cho_kham == 2
            assert sang_dash.dang_kham == 1

            chieu_dash = await queue_service.get_shift_dashboard(
                query_date=date(2026, 11, 21),
                ca_kham="chieu",
                db=session,
            )
            assert chieu_dash.tong_hen_truoc == 2
            assert chieu_dash.da_check_in == 2
            assert chieu_dash.dang_cho_kham == 1
            assert chieu_dash.da_kham == 1
    finally:
        await engine.dispose()
