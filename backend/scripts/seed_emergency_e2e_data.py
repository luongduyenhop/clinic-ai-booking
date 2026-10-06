import asyncio
import datetime
from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import NguoiDung, TaiKhoan, BacSi, ChuyenKhoa, VaiTroEnum, BenhNhan
from app.models.appointment import (
    LichLamViec, HangDoiKham, LichKham,
    TrangThaiHangDoiEnum, TrangThaiLichEnum, LoaiHangDoiEnum
)
from app.models.medical import LuotKham

async def seed():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding E2E test data for Emergency Leave & Queue Re-routing...")
        today = datetime.date(2026, 10, 5)

        # 1. Ensure Specialty KHOA_TIM_MACH exists
        stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == "KHOA_TIM_MACH")
        ck_timmach = (await db.execute(stmt_ck)).scalar_one_or_none()
        if not ck_timmach:
            stmt_ck_id2 = select(ChuyenKhoa).where(ChuyenKhoa.id == 2)
            ck_timmach = (await db.execute(stmt_ck_id2)).scalar_one_or_none()

        print(f"Chuyên khoa Tim mạch ID: {ck_timmach.id}")

        # 2. Doctor A (ID = 1)
        stmt_bs_a = select(BacSi).where(BacSi.id == 1)
        bs_a = (await db.execute(stmt_bs_a)).scalar_one()
        print(f"Doctor A: {bs_a.id}")

        # 3. Doctor B (Substitute Doctor in Tim mạch)
        stmt_user_b = select(TaiKhoan).where(TaiKhoan.email == "bao.doctor@clinic.com")
        tk_b = (await db.execute(stmt_user_b)).scalar_one_or_none()
        if not tk_b:
            nd_b = NguoiDung(
                ho_ten="BS. CKI Vũ Đình Bảo",
                email="bao.doctor@clinic.com",
                so_dien_thoai="0988776655",
                gioi_tinh="Nam",
                cccd_so="001085000099"
            )
            db.add(nd_b)
            await db.flush()

            tk_b = TaiKhoan(
                nguoi_dung_id=nd_b.id,
                email="bao.doctor@clinic.com",
                mat_khau_hash=get_password_hash("Doctor@123456"),
                vai_tro=VaiTroEnum.BAC_SI.value,
                is_active=True
            )
            db.add(tk_b)
            await db.flush()

            bs_b = BacSi(
                nguoi_dung_id=nd_b.id,
                chuyen_khoa_id=ck_timmach.id,
                hoc_vi="BS.CKI",
                chung_chi_hanh_nghe="CCHN-TIMMACH-002",
                nam_kinh_nghiem=8,
                gia_kham_mac_dinh=350000,
                is_active=True
            )
            db.add(bs_b)
            await db.flush()
        else:
            stmt_bs_b = select(BacSi).where(BacSi.nguoi_dung_id == tk_b.nguoi_dung_id)
            bs_b = (await db.execute(stmt_bs_b)).scalar_one()

        print(f"Doctor B (Substitute): ID {bs_b.id}")

        # 4. Ensure Shifts on today for Doctor A and Doctor B
        # Shift A (Doctor A)
        stmt_shift_a = select(LichLamViec).where(
            LichLamViec.bac_si_id == bs_a.id,
            LichLamViec.ngay_lam_viec == today,
            LichLamViec.ca_lam_viec == "sang"
        )
        shift_a = (await db.execute(stmt_shift_a)).scalar_one_or_none()
        if not shift_a:
            shift_a = LichLamViec(
                bac_si_id=bs_a.id,
                ngay_lam_viec=today,
                ca_lam_viec="sang",
                gio_bat_dau=datetime.time(7, 30),
                gio_ket_thuc=datetime.time(11, 30),
                gioi_han_ca_kham=20,
                is_active=True
            )
            db.add(shift_a)
            await db.flush()
        else:
            shift_a.is_active = True
            shift_a.ghi_chu_nghi = None
            shift_a.gioi_han_ca_kham = 20

        # Shift B (Doctor B)
        stmt_shift_b = select(LichLamViec).where(
            LichLamViec.bac_si_id == bs_b.id,
            LichLamViec.ngay_lam_viec == today,
            LichLamViec.ca_lam_viec == "sang"
        )
        shift_b = (await db.execute(stmt_shift_b)).scalar_one_or_none()
        if not shift_b:
            shift_b = LichLamViec(
                bac_si_id=bs_b.id,
                ngay_lam_viec=today,
                ca_lam_viec="sang",
                gio_bat_dau=datetime.time(7, 30),
                gio_ket_thuc=datetime.time(11, 30),
                gioi_han_ca_kham=25,
                is_active=True
            )
            db.add(shift_b)
            await db.flush()
        else:
            shift_b.is_active = True
            shift_b.ghi_chu_nghi = None
            shift_b.gioi_han_ca_kham = 25

        # Shift D (for Step 2.3 Postpone & Cancel test): Doctor 4 (PGS.TS Phạm Đức Minh)
        stmt_shift_d = select(LichLamViec).where(
            LichLamViec.bac_si_id == 4,
            LichLamViec.ngay_lam_viec == today,
            LichLamViec.ca_lam_viec == "sang"
        )
        shift_d = (await db.execute(stmt_shift_d)).scalar_one_or_none()
        if shift_d:
            shift_d.is_active = True
            shift_d.ghi_chu_nghi = None
            shift_d.gioi_han_ca_kham = 20

        await db.commit()

        # 5. Clean previous queue tickets & appointments on today for bs_a and bs_b
        await db.execute(delete(HangDoiKham).where(
            HangDoiKham.bac_si_id.in_([bs_a.id, bs_b.id, 4]),
            HangDoiKham.ngay_kham == today
        ))
        await db.commit()

        # 6. Create Patients
        patient_names = [
            ("Trần Văn An", "001200000001", "0999000001"),
            ("Lê Thị Bình", "001200000002", "0999000002"),
            ("Phạm Quốc Cường", "001200000003", "0999000003"),
            ("Hoàng Minh Đức", "001200000004", "0999000004"),
            ("Nguyễn Thu Hà", "001200000005", "0999000005"),
            ("Vũ Hải Yến", "001200000006", "0999000006"),
            ("Đặng Tiến Dũng", "001200000007", "0999000007"),
            ("Bùi Thanh Hương", "001200000008", "0999000008"),
            ("Đỗ Hoàng Nam", "001200000009", "0999000009"),
        ]

        patients = []
        for name, cccd, phone in patient_names:
            stmt_p = select(NguoiDung).where(NguoiDung.cccd_so == cccd)
            nd_p = (await db.execute(stmt_p)).scalar_one_or_none()
            if not nd_p:
                nd_p = NguoiDung(
                    ho_ten=name,
                    cccd_so=cccd,
                    so_dien_thoai=phone,
                    gioi_tinh="Nam" if "Văn" in name or "Quốc" in name or "Minh" in name or "Tiến" in name else "Nữ",
                    ngay_sinh=datetime.date(1990, 1, 1),
                )
                db.add(nd_p)
                await db.flush()

                bn = BenhNhan(
                    nguoi_dung_id=nd_p.id,
                    ma_dinh_danh_y_te=f"BN-{cccd[-4:]}",
                )
                db.add(bn)
                await db.flush()
                patients.append(bn)
            else:
                stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == nd_p.id)
                bn = (await db.execute(stmt_bn)).scalar_one()
                patients.append(bn)

        await db.commit()

        # 7. Populate Shift A (Doctor A)
        # N1: 3 tickets CHO_KHAM (STT 1, 2, 3)
        for idx in range(3):
            hd = HangDoiKham(
                bac_si_id=bs_a.id,
                benh_nhan_id=patients[idx].id,
                ngay_kham=today,
                ca_kham="sang",
                so_thu_tu_kham=idx + 1,
                trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
                loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
                thoi_gian_check_in=datetime.datetime(2026, 10, 5, 7, 30 + idx * 5),
            )
            db.add(hd)

        # N2: 1 ticket DANG_KHAM (STT 4) + LuotKham
        lk4 = LichKham(
            ma_lich_kham="LK-20261005-0004",
            benh_nhan_id=patients[3].id,
            bac_si_id=bs_a.id,
            ngay_kham=today,
            gio_kham=datetime.time(8, 0),
            so_thu_tu=4,
            trang_thai=TrangThaiLichEnum.DANG_KHAM.value,
            ly_do_kham="Tức ngực, hồi hộp, khó thở khi gắng sức"
        )
        db.add(lk4)
        await db.flush()

        hd4 = HangDoiKham(
            bac_si_id=bs_a.id,
            benh_nhan_id=patients[3].id,
            lich_kham_id=lk4.id,
            ngay_kham=today,
            ca_kham="sang",
            so_thu_tu_kham=4,
            trang_thai=TrangThaiHangDoiEnum.DANG_KHAM.value,
            loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
            thoi_gian_check_in=datetime.datetime(2026, 10, 5, 7, 50),
        )
        db.add(hd4)
        await db.flush()

        luot4 = LuotKham(
            lich_kham_id=lk4.id,
            benh_nhan_id=patients[3].id,
            bac_si_id=bs_a.id,
            is_locked=False,
            thoi_gian_bat_dau=datetime.datetime(2026, 10, 5, 8, 5, tzinfo=datetime.timezone.utc),
            ly_do_vao_kham="Tức ngực, hồi hộp, khó thở khi gắng sức"
        )
        db.add(luot4)

        # N3: 2 appointments (chưa check-in)
        lk5 = LichKham(
            ma_lich_kham="LK-20261005-0005",
            benh_nhan_id=patients[4].id,
            bac_si_id=bs_a.id,
            ngay_kham=today,
            gio_kham=datetime.time(9, 30),
            so_thu_tu=5,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
            ly_do_kham="Khám định kỳ huyết áp"
        )
        db.add(lk5)

        lk6 = LichKham(
            ma_lich_kham="LK-20261005-0006",
            benh_nhan_id=patients[5].id,
            bac_si_id=bs_a.id,
            ngay_kham=today,
            gio_kham=datetime.time(10, 0),
            so_thu_tu=6,
            trang_thai=TrangThaiLichEnum.CHO_XAC_NHAN.value,
            ly_do_kham="Tái khám sau dùng thuốc"
        )
        db.add(lk6)

        # 8. Populate Shift B (Doctor B)
        # 1 ticket CHO_KHAM (STT 1)
        hdb1 = HangDoiKham(
            bac_si_id=bs_b.id,
            benh_nhan_id=patients[6].id,
            ngay_kham=today,
            ca_kham="sang",
            so_thu_tu_kham=1,
            trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
            loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
            thoi_gian_check_in=datetime.datetime(2026, 10, 5, 7, 20),
        )
        db.add(hdb1)

        # 9. Populate Shift D (Doctor 4 - for Step 2.3 Postpone & Cancel test)
        hdd1 = HangDoiKham(
            bac_si_id=4,
            benh_nhan_id=patients[7].id,
            ngay_kham=today,
            ca_kham="sang",
            so_thu_tu_kham=1,
            trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
            loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
            thoi_gian_check_in=datetime.datetime(2026, 10, 5, 7, 45),
        )
        db.add(hdd1)

        lkd2 = LichKham(
            ma_lich_kham="LK-20261005-0007",
            benh_nhan_id=patients[8].id,
            bac_si_id=4,
            ngay_kham=today,
            gio_kham=datetime.time(9, 0),
            so_thu_tu=1,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
            ly_do_kham="Đau dạ dày thượng vị"
        )
        db.add(lkd2)

        await db.commit()
        print("✅ Seed data successfully created!")
        print(f"Shift A (BS An): ID={shift_a.id}, N1=3, N2=1, N3=2")
        print(f"Shift B (BS Bảo): ID={shift_b.id}, STT Max=1")
        print(f"Shift D (BS Minh): ID={shift_d.id if shift_d else 'N/A'}")

if __name__ == "__main__":
    asyncio.run(seed())
