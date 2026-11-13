import argparse
import asyncio
from pathlib import Path
import sys
from datetime import date, time
from decimal import Decimal
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select, delete, or_
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user import ChuyenKhoa, PhongKham, BacSi, NguoiDung, TaiKhoan, VaiTroEnum
from app.models.medical import DichVu
from app.models.appointment import LichLamViec, CaLamViecEnum
from app.core.security import hash_password
FORBIDDEN_ENVIRONMENTS = ("production", "prod", "staging", "live")
DEMO_DEPARTMENT_CODE = "DEMO_KHOA_NOI"
DEMO_DEPARTMENT_NAME = "Khoa Nội Tổng Quát (Demo)"
DEMO_ROOM_CODE = "DEMO_PHONG_101"
DEMO_ROOM_NAME = "Phòng Khám Nội 101 (Demo)"
DEMO_DOCTOR_EMAIL = "demo.doctor@clinic.com"
DEMO_DOCTOR_CODE = "DEMO_BS_001"
DEMO_DOCTOR_CCHN = "DEMO_CCHN_001"
DEMO_DOCTOR_NAME = "BS. Demo Nguyễn Văn A"
DEMO_DOCTOR_CCCD = "001080009999"
DEMO_DOCTOR_PHONE = "0988776655"
DEMO_SERVICE_CODE = "DEMO_DV_KHAM_NOI"
DEMO_SERVICE_NAME = "Khám Nội Tổng Quát (Demo)"
def validate_environment(target_env: str) -> None:
    normalized = target_env.strip().lower()
    if normalized in FORBIDDEN_ENVIRONMENTS:
        raise ValueError(f"Execution rejected: Cannot seed demo data on protected environment '{target_env}'")
async def purge_demo_entities(session) -> None:
    doc_stmt = select(BacSi.id).where(BacSi.chung_chi_hanh_nghe == DEMO_DOCTOR_CCHN)
    doc_res = await session.execute(doc_stmt)
    doc_id = doc_res.scalar_one_or_none()
    if doc_id:
        await session.execute(delete(LichLamViec).where(LichLamViec.bac_si_id == doc_id))
        await session.execute(delete(BacSi).where(BacSi.id == doc_id))
    await session.execute(delete(DichVu).where(DichVu.ma_dich_vu == DEMO_SERVICE_CODE))
    await session.execute(delete(PhongKham).where(PhongKham.ma_phong == DEMO_ROOM_CODE))
    dept_stmt = select(ChuyenKhoa.id).where(ChuyenKhoa.ma_chuyen_khoa == DEMO_DEPARTMENT_CODE)
    dept_res = await session.execute(dept_stmt)
    dept_id = dept_res.scalar_one_or_none()
    if dept_id:
        await session.execute(delete(ChuyenKhoa).where(ChuyenKhoa.id == dept_id))
    await session.commit()
async def seed_admin_demo(mode: str = "append", env: str = "development") -> dict:
    validate_environment(env)
    results = {
        "mode": mode,
        "environment": env,
        "departments_created": 0,
        "rooms_created": 0,
        "doctors_created": 0,
        "services_created": 0,
        "shifts_created": 0,
    }
    async with AsyncSessionLocal() as session:
        if mode == "reset":
            await purge_demo_entities(session)
        admin_stmt = select(TaiKhoan).where(TaiKhoan.email == "admin@clinic.com")
        existing_admin = (await session.execute(admin_stmt)).scalar_one_or_none()
        if not existing_admin:
            admin_user_stmt = select(NguoiDung).where(NguoiDung.email == "admin@clinic.com")
            admin_user = (await session.execute(admin_user_stmt)).scalar_one_or_none()
            if not admin_user:
                admin_user = NguoiDung(
                    ho_ten="Quản Trị Viên Hệ Thống",
                    email="admin@clinic.com",
                    so_dien_thoai="0988000001",
                    ngay_sinh=date(1990, 1, 1),
                    gioi_tinh="Nam",
                )
                session.add(admin_user)
                await session.flush()
            admin_account = TaiKhoan(
                nguoi_dung_id=admin_user.id,
                email="admin@clinic.com",
                mat_khau_hash=hash_password("Admin@123456"),
                vai_tro=VaiTroEnum.ADMIN.value,
                is_active=True,
            )
            session.add(admin_account)
            await session.flush()
        dept_stmt = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == DEMO_DEPARTMENT_CODE)
        dept = (await session.execute(dept_stmt)).scalar_one_or_none()
        if not dept:
            dept = ChuyenKhoa(
                ma_chuyen_khoa=DEMO_DEPARTMENT_CODE,
                ten_chuyen_khoa=DEMO_DEPARTMENT_NAME,
                mo_ta="Khoa phòng phục vụ dữ liệu demo quản trị",
                vi_tri_phong="Tầng 1",
                is_active=True,
            )
            session.add(dept)
            await session.flush()
            results["departments_created"] += 1
        room_stmt = select(PhongKham).where(PhongKham.ma_phong == DEMO_ROOM_CODE)
        room = (await session.execute(room_stmt)).scalar_one_or_none()
        if not room:
            room = PhongKham(
                ma_phong=DEMO_ROOM_CODE,
                ten_phong=DEMO_ROOM_NAME,
                chuyen_khoa_id=dept.id,
                tang="Tầng 1",
                loai_phong="kham_benh",
                is_active=True,
            )
            session.add(room)
            await session.flush()
            results["rooms_created"] += 1
        user_stmt = select(NguoiDung).where(
            or_(
                NguoiDung.email == DEMO_DOCTOR_EMAIL,
                NguoiDung.so_dien_thoai == DEMO_DOCTOR_PHONE,
                NguoiDung.cccd_so == DEMO_DOCTOR_CCCD,
            )
        )
        user = (await session.execute(user_stmt)).scalar_one_or_none()
        if not user:
            user = NguoiDung(
                ho_ten=DEMO_DOCTOR_NAME,
                email=DEMO_DOCTOR_EMAIL,
                so_dien_thoai=DEMO_DOCTOR_PHONE,
                cccd_so=DEMO_DOCTOR_CCCD,
                gioi_tinh="Nam",
                ngay_sinh=date(1980, 5, 10),
            )
            session.add(user)
            await session.flush()
        account_stmt = select(TaiKhoan).where(
            or_(
                TaiKhoan.email == DEMO_DOCTOR_EMAIL,
                TaiKhoan.nguoi_dung_id == user.id,
            )
        )
        account = (await session.execute(account_stmt)).scalar_one_or_none()
        if not account:
            account = TaiKhoan(
                nguoi_dung_id=user.id,
                email=DEMO_DOCTOR_EMAIL,
                mat_khau_hash=hash_password("Doctor@Demo2026"),
                vai_tro=VaiTroEnum.BAC_SI.value,
                is_active=True,
            )
            session.add(account)
            await session.flush()
        doc_stmt = select(BacSi).where(
            or_(
                BacSi.chung_chi_hanh_nghe == DEMO_DOCTOR_CCHN,
                BacSi.nguoi_dung_id == user.id,
            )
        )
        doctor = (await session.execute(doc_stmt)).scalar_one_or_none()
        if not doctor:
            doctor = BacSi(
                nguoi_dung_id=user.id,
                chuyen_khoa_id=dept.id,
                phong_kham_id=room.id,
                hoc_vi="Thạc sĩ",
                chung_chi_hanh_nghe=DEMO_DOCTOR_CCHN,
                nam_kinh_nghiem=10,
                gia_kham_mac_dinh=Decimal("250000.00"),
                is_active=True,
                trang_thai_giay_phep="ACTIVE",
            )
            session.add(doctor)
            await session.flush()
            results["doctors_created"] += 1
        service_stmt = select(DichVu).where(DichVu.ma_dich_vu == DEMO_SERVICE_CODE)
        service = (await session.execute(service_stmt)).scalar_one_or_none()
        if not service:
            service = DichVu(
                ma_dich_vu=DEMO_SERVICE_CODE,
                ten_dich_vu=DEMO_SERVICE_NAME,
                chuyen_khoa_id=dept.id,
                don_gia=Decimal("250000.00"),
                don_vi_tinh="Lượt",
                is_active=True,
            )
            session.add(service)
            await session.flush()
            results["services_created"] += 1
        if doctor and room:
            shift_date = date.today()
            shift_stmt = select(LichLamViec).where(
                LichLamViec.bac_si_id == doctor.id,
                LichLamViec.ngay_lam_viec == shift_date,
                LichLamViec.ca_lam_viec == CaLamViecEnum.SANG.value,
            )
            shift = (await session.execute(shift_stmt)).scalar_one_or_none()
            if not shift:
                shift = LichLamViec(
                    bac_si_id=doctor.id,
                    phong_kham_id=room.id,
                    ngay_lam_viec=shift_date,
                    ca_lam_viec=CaLamViecEnum.SANG.value,
                    gio_bat_dau=time(8, 0),
                    gio_ket_thuc=time(12, 0),
                    buoc_gio_hen_phut=30,
                    gioi_han_ca_kham=8,
                    han_muc_dat_truoc=6,
                    han_muc_vang_lai=2,
                    so_luot_toi_da_moi_khung=1,
                    is_active=True,
                )
                session.add(shift)
                await session.flush()
                results["shifts_created"] += 1
        await session.commit()
        return results
def main():
    parser = argparse.ArgumentParser(description="Seed Admin Demo Data CLI")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--append", action="store_true", help="Append demo data safely if missing")
    group.add_argument("--reset", action="store_true", help="Reset demo data safely")
    parser.add_argument("--env", type=str, default=settings.ENVIRONMENT, help="Target environment")
    args = parser.parse_args()
    mode = "reset" if args.reset else "append"
    try:
        results = asyncio.run(seed_admin_demo(mode=mode, env=args.env))
        print(f"Seed completed successfully: {results}")
    except Exception as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        sys.exit(1)
if __name__ == "__main__":
    main()
