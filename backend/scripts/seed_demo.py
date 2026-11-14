import asyncio
import os
from datetime import date, datetime, time, timedelta, timezone
from sqlalchemy import delete, or_, select, text
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.security import hash_password, verify_password
from app.models.appointment import CaLamViecEnum, HangDoiKham, LichKham, LichLamViec
from app.models.medical import (
    ChiDinh,
    ChiTietHoaDon,
    GiaoDichThanhToan,
    HoaDon,
    KetQuaCLS,
    LuotKham,
    PhieuKetQuaCLS,
    PhieuThuChi,
)
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from scripts.run_migrations import DEPLOYMENT_LOCK, require_demo_database
from scripts.seed_one_week_realistic import seed_one_week_realistic
from seed_data import seed_catalogs

DEMO_ACCOUNTS = (
    ("admin.demo", "Quản trị viên [DEMO]", VaiTroEnum.ADMIN),
    ("doctor.demo", "Bác sĩ Nội tổng quát [DEMO]", VaiTroEnum.BAC_SI),
    ("letan.demo", "Lễ tân [DEMO]", VaiTroEnum.LE_TAN),
    ("ktv.demo", "Kỹ thuật viên [DEMO]", VaiTroEnum.KY_THUAT_VIEN),
    ("thungan.demo", "Thu ngân [DEMO]", VaiTroEnum.THU_NGAN),
    ("patient01", "Bệnh nhân mẫu 01 [DEMO]", VaiTroEnum.BENH_NHAN),
)


async def seed_accounts(session, password):
    people = {}
    for index, (name, full_name, role) in enumerate(DEMO_ACCOUNTS, start=1):
        email = f"{name}@clinic-ai.test"
        person = await session.scalar(select(NguoiDung).where(NguoiDung.email == email))
        if person is None:
            person = NguoiDung(
                ho_ten=full_name,
                email=email,
                so_dien_thoai=f"00000000{index:02d}",
                ngay_sinh=date(1990, 1, 1),
                gioi_tinh="Khác",
                dia_chi="Dữ liệu tổng hợp dùng để trình diễn",
            )
            session.add(person)
            await session.flush()
        account = await session.scalar(select(TaiKhoan).where(TaiKhoan.email == email))
        if account is None:
            session.add(TaiKhoan(
                nguoi_dung_id=person.id,
                email=email,
                mat_khau_hash=hash_password(password),
                vai_tro=role.value,
                is_active=True,
            ))
        elif account.nguoi_dung_id != person.id or account.vai_tro != role.value:
            raise RuntimeError(f"Unexpected role or profile for demo account {email}")
        elif not verify_password(password, account.mat_khau_hash):
            account.mat_khau_hash = hash_password(password)
            account.refresh_token_hash = None
            account.refresh_token_expired_at = None
        people[role] = person
    await session.flush()
    return people


async def seed_doctor_schedule(session, doctor, today):
    existing_shifts = set((await session.execute(
        select(LichLamViec.ngay_lam_viec, LichLamViec.ca_lam_viec).where(
            LichLamViec.bac_si_id == doctor.id,
            LichLamViec.ngay_lam_viec >= today,
        )
    )).all())
    shifts = (
        (CaLamViecEnum.SANG.value, time(7, 30), time(11, 30)),
        (CaLamViecEnum.CHIEU.value, time(13, 30), time(17)),
    )
    for day_offset in range(14):
        work_date = today + timedelta(days=day_offset)
        for shift, start, end in shifts:
            if (work_date, shift) not in existing_shifts:
                session.add(LichLamViec(
                    bac_si_id=doctor.id,
                    phong_kham_id=doctor.phong_kham_id,
                    ngay_lam_viec=work_date,
                    ca_lam_viec=shift,
                    gio_bat_dau=start,
                    gio_ket_thuc=end,
                    gioi_han_ca_kham=8,
                    han_muc_dat_truoc=6,
                    han_muc_vang_lai=2,
                    is_active=True,
                ))


async def cleanup_synthetic_demo_cases(session):
    case_ids = list((await session.execute(
        select(LuotKham.id).where(LuotKham.ma_kcb == "KCB-DEMO-CLS")
    )).scalars().all())
    appt_ids = list((await session.execute(
        select(LichKham.id).where(LichKham.ma_lich_kham == "LK-DEMO-TIEP-DON")
    )).scalars().all())
    inv_filters = [HoaDon.ma_hoa_don == "HD-DEMO-CLS"]
    if case_ids:
        inv_filters.append(HoaDon.luot_kham_id.in_(case_ids))
    invoice_ids = list((await session.execute(
        select(HoaDon.id).where(or_(*inv_filters))
    )).scalars().all())
    if invoice_ids:
        await session.execute(delete(ChiTietHoaDon).where(ChiTietHoaDon.hoa_don_id.in_(invoice_ids)))
        await session.execute(delete(GiaoDichThanhToan).where(GiaoDichThanhToan.hoa_don_id.in_(invoice_ids)))
        await session.execute(delete(PhieuThuChi).where(PhieuThuChi.hoa_don_id.in_(invoice_ids)))
        await session.execute(delete(HoaDon).where(HoaDon.id.in_(invoice_ids)))
    if case_ids:
        order_ids = list((await session.execute(
            select(ChiDinh.id).where(ChiDinh.luot_kham_id.in_(case_ids))
        )).scalars().all())
        if order_ids:
            await session.execute(delete(ChiTietHoaDon).where(ChiTietHoaDon.chi_dinh_id.in_(order_ids)))
            await session.execute(delete(PhieuKetQuaCLS).where(PhieuKetQuaCLS.chi_dinh_id.in_(order_ids)))
            await session.execute(delete(KetQuaCLS).where(KetQuaCLS.chi_dinh_id.in_(order_ids)))
            await session.execute(delete(ChiDinh).where(ChiDinh.id.in_(order_ids)))
        await session.execute(delete(LuotKham).where(LuotKham.id.in_(case_ids)))
    if appt_ids:
        await session.execute(delete(HangDoiKham).where(HangDoiKham.lich_kham_id.in_(appt_ids)))
        await session.execute(delete(LichKham).where(LichKham.id.in_(appt_ids)))
    demo_patient = await session.scalar(select(BenhNhan).where(BenhNhan.ma_dinh_danh_y_te == "BN-DEMO-001"))
    if demo_patient is not None:
        has_lk = await session.scalar(select(LuotKham.id).where(LuotKham.benh_nhan_id == demo_patient.id))
        has_appt = await session.scalar(select(LichKham.id).where(LichKham.benh_nhan_id == demo_patient.id))
        has_inv = await session.scalar(select(HoaDon.id).where(HoaDon.benh_nhan_id == demo_patient.id))
        if has_lk is None and has_appt is None and has_inv is None:
            await session.execute(delete(BenhNhan).where(BenhNhan.id == demo_patient.id))


async def seed_clinic_scenarios(session, people, departments, rooms):
    now = datetime.now(timezone.utc)
    today = now.astimezone(timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))).date()
    doctor_person = people[VaiTroEnum.BAC_SI]
    doctor = await session.scalar(select(BacSi).where(BacSi.nguoi_dung_id == doctor_person.id))
    if doctor is None:
        doctor = BacSi(
            nguoi_dung_id=doctor_person.id,
            chuyen_khoa_id=departments["KHOA_NOI"],
            phong_kham_id=rooms["P101"],
            hoc_vi="BS",
            chung_chi_hanh_nghe="DEMO-CCHN-001",
            ngay_cap=today - timedelta(days=30),
            ngay_het_han=today + timedelta(days=365),
            gia_kham_mac_dinh=150000,
        )
        session.add(doctor)
        await session.flush()
    await seed_doctor_schedule(session, doctor, today)
    await cleanup_synthetic_demo_cases(session)


async def seed_demo():
    if not settings.is_demo or not settings.ENABLE_DEMO_SEED:
        raise RuntimeError("Demo data requires ENVIRONMENT=demo and ENABLE_DEMO_SEED=true")
    password = os.environ.get("DEMO_PASSWORD", "")
    if not 12 <= len(password.encode("utf-8")) <= 72:
        raise RuntimeError("DEMO_PASSWORD must contain 12 to 72 UTF-8 bytes")
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Demo data requires the dedicated PostgreSQL database")
    try:
        async with AsyncSessionLocal.begin() as session:
            await session.execute(text("SET LOCAL lock_timeout = '60s'"))
            await session.execute(text("SELECT pg_advisory_xact_lock(:lock)"), {"lock": DEPLOYMENT_LOCK})
            connection = await session.connection()
            await connection.run_sync(require_demo_database)
            departments, rooms, _services = await seed_catalogs(session)
            people = await seed_accounts(session, password)
            await seed_clinic_scenarios(session, people, departments, rooms)
        await seed_one_week_realistic()
    finally:
        await engine.dispose()


def main():
    asyncio.run(seed_demo())
    print("Synthetic demo data is ready.")


if __name__ == "__main__":
    main()
