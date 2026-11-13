"""Initialize synthetic data on a dedicated, migrated demo PostgreSQL database."""
import asyncio
import os
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select, text

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.security import hash_password, verify_password
from app.models.appointment import CaLamViecEnum, LichKham, LichLamViec, TrangThaiLichEnum
from app.models.medical import ChanDoan, ChiDinh, ChiTietHoaDon, HoaDon, KhaiNiem, LuotKham
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from scripts.run_migrations import DEPLOYMENT_LOCK, require_demo_database
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


async def seed_clinic_scenarios(session, people, departments, rooms, services):
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

    patient_person = people[VaiTroEnum.BENH_NHAN]
    patient = await session.scalar(select(BenhNhan).where(BenhNhan.nguoi_dung_id == patient_person.id))
    if patient is None:
        patient = BenhNhan(nguoi_dung_id=patient_person.id, ma_dinh_danh_y_te="BN-DEMO-001", nhom_mau="O+")
        session.add(patient)
        await session.flush()

    scheduled = await session.scalar(select(LichKham).where(LichKham.ma_lich_kham == "LK-DEMO-TIEP-DON"))
    if scheduled is None:
        session.add(LichKham(
            ma_lich_kham="LK-DEMO-TIEP-DON",
            benh_nhan_id=patient.id,
            bac_si_id=doctor.id,
            chuyen_khoa_id=doctor.chuyen_khoa_id,
            ngay_kham=today,
            gio_kham=time(8, 30),
            ca_kham=CaLamViecEnum.SANG.value,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
            ly_do_kham="Lượt hẹn mẫu để tiếp đón và đưa vào hàng chờ",
        ))

    case = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == "KCB-DEMO-CLS"))
    if case is not None:
        return

    case = LuotKham(
        ma_kcb="KCB-DEMO-CLS",
        benh_nhan_id=patient.id,
        bac_si_id=doctor.id,
        thoi_gian_bat_dau=now,
        ly_do_vao_kham="Hồ sơ mẫu để trình diễn cận lâm sàng và thu ngân",
    )
    session.add(case)
    await session.flush()
    diagnosis = await session.scalar(select(KhaiNiem).where(KhaiNiem.ma_khai_niem == "I10"))
    session.add(ChanDoan(
        luot_kham_id=case.id,
        khai_niem_id=diagnosis.id,
        ma_icd10=diagnosis.ma_khai_niem,
        ten_benh_chan_doan=diagnosis.ten_khai_niem,
        loai_chan_doan="chinh",
    ))

    lab_service = next(service for service in services.values() if service.ma_nhom_byt == "XN")
    order = ChiDinh(
        luot_kham_id=case.id,
        dich_vu_id=lab_service.id,
        bac_si_chi_dinh_id=doctor.id,
        phong_thuc_hien_id=lab_service.phong_thuc_hien_id,
        don_gia_tai_thoi_diem=lab_service.don_gia,
        thanh_tien=lab_service.don_gia,
    )
    invoice = HoaDon(
        ma_hoa_don="HD-DEMO-CLS",
        luot_kham_id=case.id,
        benh_nhan_id=patient.id,
        tong_tien=lab_service.don_gia,
        so_tien_phai_thu=lab_service.don_gia,
        thuc_thu=0,
    )
    session.add_all((order, invoice))
    await session.flush()
    session.add(ChiTietHoaDon(
        hoa_don_id=invoice.id,
        loai_muc="can_lam_sang",
        muc_tham_chieu_id=order.id,
        chi_dinh_id=order.id,
        ten_khoan_thu=lab_service.ten_dich_vu,
        don_gia=lab_service.don_gia,
        thanh_tien=lab_service.don_gia,
    ))


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
            departments, rooms, services = await seed_catalogs(session)
            people = await seed_accounts(session, password)
            await seed_clinic_scenarios(session, people, departments, rooms, services)
    finally:
        await engine.dispose()


def main():
    asyncio.run(seed_demo())
    print("Synthetic demo data is ready.")


if __name__ == "__main__":
    main()
