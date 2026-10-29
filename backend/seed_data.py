import asyncio
from datetime import date, datetime, time, timedelta, timezone
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.core.seed_5_departments import (
    DEPARTMENTS_DATA,
    ROOMS_DATA,
    DOCTORS_DATA,
    SPECIFIC_SERVICES,
)
from app.core.production_seed import (
    MASTER_ICD10,
    MASTER_DRUGS,
    MASTER_SERVICES,
)
from app.models.user import (
    ChuyenKhoa,
    PhongKham,
    NguoiDung,
    TaiKhoan,
    BenhNhan,
    BacSi,
    VaiTroEnum,
)
from app.models.appointment import (
    LichLamViec,
    LichKham,
    CaLamViecEnum,
    TrangThaiLichEnum,
)
from app.models.medical import (
    TuKhoaCapCuu,
    DichVu,
    KhaiNiem,
    LuotKham,
    ChanDoan,
    DonThuoc,
    ChiTietDonThuoc,
    Thuoc,
)


async def _execute_seeding(session):
    dept_map = {}
    for item in DEPARTMENTS_DATA:
        stmt = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == item["ma"])
        existing_ck = (await session.execute(stmt)).scalar_one_or_none()
        if existing_ck:
            existing_ck.ten_chuyen_khoa = item["ten"]
            existing_ck.mo_ta = item["mo_ta"]
            existing_ck.vi_tri_phong = item["vi_tri"]
            existing_ck.is_active = True
            dept_map[item["ma"]] = existing_ck.id
        else:
            new_ck = ChuyenKhoa(
                ma_chuyen_khoa=item["ma"],
                ten_chuyen_khoa=item["ten"],
                mo_ta=item["mo_ta"],
                vi_tri_phong=item["vi_tri"],
                is_active=True,
            )
            session.add(new_ck)
            await session.flush()
            dept_map[item["ma"]] = new_ck.id

    room_map = {}
    for item in ROOMS_DATA:
        stmt = select(PhongKham).where(PhongKham.ma_phong == item["ma"])
        existing_room = (await session.execute(stmt)).scalar_one_or_none()
        dept_id = dept_map.get(item["dept_ma"])
        if existing_room:
            existing_room.ten_phong = item["ten"]
            existing_room.chuyen_khoa_id = dept_id
            existing_room.tang = item["tang"]
            existing_room.loai_phong = item["loai"]
            existing_room.is_active = True
            room_map[item["ma"]] = existing_room.id
        else:
            new_room = PhongKham(
                ma_phong=item["ma"],
                ten_phong=item["ten"],
                chuyen_khoa_id=dept_id,
                tang=item["tang"],
                loai_phong=item["loai"],
                is_active=True,
            )
            session.add(new_room)
            await session.flush()
            room_map[item["ma"]] = new_room.id

    red_flags_data = [
        ("đau ngực dữ dội", "rat_nguy_hiem", "Nghi ngờ nhồi máu cơ tim cấp. Gọi ngay cấp cứu 115!"),
        ("khó thở cấp", "rat_nguy_hiem", "Suy hô hấp cấp tính. Hãy gọi 115 hoặc đưa đến phòng Cấp cứu ngay lập tức."),
        ("ngất xỉu", "nguy_hiem", "Mất ý thức đột ngột. Gọi cấp cứu 115 ngay lập tức!"),
        ("co giật", "rat_nguy_hiem", "Cơn co giật toàn thân. Cho bệnh nhân nằm nghiêng thông thoáng và gọi 115."),
        ("liệt nửa người", "rat_nguy_hiem", "Dấu hiệu đột quỵ não cấp (giờ vàng). Gọi 115 khẩn cấp!"),
        ("nôn ra máu", "rat_nguy_hiem", "Xuất huyết tiêu hóa cấp tính. Cần đến bệnh viện cấp cứu ngay!"),
    ]
    for keyword, severity, guide in red_flags_data:
        stmt = select(TuKhoaCapCuu).where(TuKhoaCapCuu.tu_khoa == keyword)
        existing_rf = (await session.execute(stmt)).scalar_one_or_none()
        if existing_rf:
            existing_rf.muc_do_nguy_hiem = severity
            existing_rf.huong_dan_xu_tri = guide
        else:
            session.add(
                TuKhoaCapCuu(
                    tu_khoa=keyword,
                    muc_do_nguy_hiem=severity,
                    huong_dan_xu_tri=guide,
                )
            )

    stmt_icd = select(KhaiNiem.ma_khai_niem)
    existing_icds = set((await session.execute(stmt_icd)).scalars().all())
    for code, name, concept_type in MASTER_ICD10:
        if code not in existing_icds:
            session.add(
                KhaiNiem(
                    ma_khai_niem=code,
                    ten_khai_niem=name,
                    loai_khai_niem=concept_type,
                    is_active=True,
                )
            )
            existing_icds.add(code)

    stmt_drugs = select(Thuoc.ma_thuoc_noi_bo)
    existing_drugs = set((await session.execute(stmt_drugs)).scalars().all())
    for code, name, act, strength, unit, route, _ in MASTER_DRUGS:
        if code not in existing_drugs:
            session.add(
                Thuoc(
                    ma_thuoc_noi_bo=code,
                    ten_thuoc=name,
                    hoat_chat=act,
                    ham_luong=strength,
                    don_vi_tinh=unit,
                    duong_dung=route,
                    trang_thai_danh_muc="DA_DUYET",
                    is_active=True,
                )
            )
            existing_drugs.add(code)

    stmt_all_services = select(DichVu)
    existing_services_list = (await session.execute(stmt_all_services)).scalars().all()
    service_map = {svc.ma_dich_vu: svc for svc in existing_services_list}

    for s in SPECIFIC_SERVICES:
        code = s["ma"]
        dept_id = dept_map.get(s["dept_ma"])
        if code in service_map:
            svc = service_map[code]
            svc.ten_dich_vu = s["ten"]
            svc.don_gia = s["gia"]
            svc.don_vi_tinh = s["dvt"]
            svc.chuyen_khoa_id = dept_id
            svc.is_active = True
        else:
            new_svc = DichVu(
                ma_dich_vu=code,
                ten_dich_vu=s["ten"],
                don_gia=s["gia"],
                don_vi_tinh=s["dvt"],
                chuyen_khoa_id=dept_id,
                is_active=True,
            )
            session.add(new_svc)
            service_map[code] = new_svc

    for code, name, price, unit, category in MASTER_SERVICES:
        room_id = room_map.get("LAB01") if category == "XN" else (room_map.get("CDHA01") if category in ["CDHA", "TDCN"] else None)
        if code in service_map:
            svc = service_map[code]
            svc.ten_dich_vu = name
            svc.don_gia = price
            svc.don_vi_tinh = unit
            svc.ma_nhom_byt = category
            svc.phong_thuc_hien_id = room_id
            svc.is_active = True
        else:
            new_svc = DichVu(
                ma_dich_vu=code,
                ten_dich_vu=name,
                don_gia=price,
                don_vi_tinh=unit,
                ma_nhom_byt=category,
                phong_thuc_hien_id=room_id,
                is_active=True,
            )
            session.add(new_svc)
            service_map[code] = new_svc

    await session.flush()

    system_staff = [
        ("Quản Trị Viên Hệ Thống", "admin@clinic.com", "0988000001", "Admin@123456", VaiTroEnum.ADMIN.value),
        ("BS.CKII Nguyễn Minh Hoàng (Admin)", "admin@clinic-ai.vn", "0988999001", "password123", VaiTroEnum.ADMIN.value),
        ("Điều Dưỡng Lê Tân", "letan@clinic.com", "0988000002", "LeTan@123456", VaiTroEnum.LE_TAN.value),
        ("Kỹ Thuật Viên Xét Nghiệm & CĐHA", "ktv@clinic.com", "0988000003", "Ktv@123456", VaiTroEnum.KY_THUAT_VIEN.value),
        ("Thu Ngân Viện Phí", "thungan@clinic.com", "0988000004", "ThuNgan@123456", VaiTroEnum.THU_NGAN.value),
    ]
    for name, email, phone, pwd, role in system_staff:
        stmt_user = select(NguoiDung).where(NguoiDung.email == email)
        user = (await session.execute(stmt_user)).scalar_one_or_none()
        if not user:
            user = NguoiDung(
                ho_ten=name,
                email=email,
                so_dien_thoai=phone,
                ngay_sinh=date(1990, 1, 1),
                gioi_tinh="Nam" if "Nguyễn" in name or "Lê" not in name else "Nữ",
            )
            session.add(user)
            await session.flush()

        stmt_account = select(TaiKhoan).where(TaiKhoan.email == email)
        account = (await session.execute(stmt_account)).scalar_one_or_none()
        if not account:
            account = TaiKhoan(
                nguoi_dung_id=user.id,
                email=email,
                mat_khau_hash=hash_password(pwd),
                vai_tro=role,
                is_active=True,
            )
            session.add(account)

    created_doctors = []
    for doc in DOCTORS_DATA:
        stmt_user = select(NguoiDung).where(NguoiDung.email == doc["email"])
        user = (await session.execute(stmt_user)).scalar_one_or_none()
        if not user:
            user = NguoiDung(
                ho_ten=doc["ho_ten"],
                email=doc["email"],
                so_dien_thoai=doc["sdt"],
                ngay_sinh=date(1982, 6, 15),
                gioi_tinh="Nam" if any(w in doc["ho_ten"] for w in ["Minh", "Hoàng", "Phương", "Long", "Huy"]) else "Nữ",
                dia_chi="Hà Nội",
            )
            session.add(user)
            await session.flush()

        stmt_account = select(TaiKhoan).where(TaiKhoan.email == doc["email"])
        account = (await session.execute(stmt_account)).scalar_one_or_none()
        if not account:
            account = TaiKhoan(
                nguoi_dung_id=user.id,
                email=doc["email"],
                mat_khau_hash=hash_password("Doctor@123456"),
                vai_tro=VaiTroEnum.BAC_SI.value,
                is_active=True,
            )
            session.add(account)

        dept_id = dept_map.get(doc["dept_ma"])
        room_id = room_map.get(doc["room_ma"])
        stmt_doctor = select(BacSi).where(BacSi.nguoi_dung_id == user.id)
        doctor = (await session.execute(stmt_doctor)).scalar_one_or_none()
        if doctor:
            doctor.chuyen_khoa_id = dept_id
            doctor.phong_kham_id = room_id
            doctor.hoc_vi = doc["hoc_vi"]
            doctor.nam_kinh_nghiem = doc["kinh_nghiem"]
            doctor.mo_ta_chuyen_sau = doc["mo_ta"]
            doctor.gia_kham_mac_dinh = doc["gia_kham"]
            doctor.is_active = True
        else:
            doctor = BacSi(
                nguoi_dung_id=user.id,
                chuyen_khoa_id=dept_id,
                phong_kham_id=room_id,
                hoc_vi=doc["hoc_vi"],
                chung_chi_hanh_nghe=f"CCHN-{doc['sdt']}",
                nam_kinh_nghiem=doc["kinh_nghiem"],
                mo_ta_chuyen_sau=doc["mo_ta"],
                gia_kham_mac_dinh=doc["gia_kham"],
                is_active=True,
            )
            session.add(doctor)
            await session.flush()
        created_doctors.append(doctor)

    today = date.today()
    for i in range(14):
        work_date = today + timedelta(days=i)
        for doctor in created_doctors:
            stmt_morning = select(LichLamViec).where(
                LichLamViec.bac_si_id == doctor.id,
                LichLamViec.ngay_lam_viec == work_date,
                LichLamViec.ca_lam_viec == CaLamViecEnum.SANG.value,
            )
            morning_shift = (await session.execute(stmt_morning)).scalar_one_or_none()
            if not morning_shift:
                session.add(
                    LichLamViec(
                        bac_si_id=doctor.id,
                        phong_kham_id=doctor.phong_kham_id,
                        ngay_lam_viec=work_date,
                        ca_lam_viec=CaLamViecEnum.SANG.value,
                        gio_bat_dau=time(7, 30),
                        gio_ket_thuc=time(11, 30),
                        gioi_han_ca_kham=8,
                        han_muc_dat_truoc=6,
                        han_muc_vang_lai=2,
                        is_active=True,
                    )
                )

            stmt_afternoon = select(LichLamViec).where(
                LichLamViec.bac_si_id == doctor.id,
                LichLamViec.ngay_lam_viec == work_date,
                LichLamViec.ca_lam_viec == CaLamViecEnum.CHIEU.value,
            )
            afternoon_shift = (await session.execute(stmt_afternoon)).scalar_one_or_none()
            if not afternoon_shift:
                session.add(
                    LichLamViec(
                        bac_si_id=doctor.id,
                        phong_kham_id=doctor.phong_kham_id,
                        ngay_lam_viec=work_date,
                        ca_lam_viec=CaLamViecEnum.CHIEU.value,
                        gio_bat_dau=time(13, 30),
                        gio_ket_thuc=time(17, 0),
                        gioi_han_ca_kham=7,
                        han_muc_dat_truoc=5,
                        han_muc_vang_lai=2,
                        is_active=True,
                    )
                )

    patient_email = "patient@test.com"
    stmt_pt_user = select(NguoiDung).where(NguoiDung.email == patient_email)
    patient_user = (await session.execute(stmt_pt_user)).scalar_one_or_none()
    if not patient_user:
        patient_user = NguoiDung(
            ho_ten="Nguyễn Thị Bệnh Nhân",
            email=patient_email,
            so_dien_thoai="0912345678",
            ngay_sinh=date(1998, 10, 15),
            gioi_tinh="Nữ",
            dia_chi="Cầu Giấy, Hà Nội",
        )
        session.add(patient_user)
        await session.flush()

    stmt_pt_account = select(TaiKhoan).where(TaiKhoan.email == patient_email)
    patient_account = (await session.execute(stmt_pt_account)).scalar_one_or_none()
    if not patient_account:
        patient_account = TaiKhoan(
            nguoi_dung_id=patient_user.id,
            email=patient_email,
            mat_khau_hash=hash_password("Patient@123456"),
            vai_tro=VaiTroEnum.BENH_NHAN.value,
            is_active=True,
        )
        session.add(patient_account)

    stmt_patient = select(BenhNhan).where(BenhNhan.nguoi_dung_id == patient_user.id)
    patient_profile = (await session.execute(stmt_patient)).scalar_one_or_none()
    if not patient_profile:
        patient_profile = BenhNhan(
            nguoi_dung_id=patient_user.id,
            ma_dinh_danh_y_te="BN-2026-0001",
            nhom_mau="O+",
            tien_su_benh="Viêm dạ dày nhẹ",
            di_ung_thuoc="Dị ứng Penicillin",
            diem_tin_nhiem=100,
            so_lan_no_show=0,
        )
        session.add(patient_profile)
        await session.flush()

    sample_appointment_code = "LK-20260918-01001"
    stmt_sample_app = select(LichKham).where(LichKham.ma_lich_kham == sample_appointment_code)
    sample_app = (await session.execute(stmt_sample_app)).scalar_one_or_none()
    if not sample_app and created_doctors:
        sample_app = LichKham(
            ma_lich_kham=sample_appointment_code,
            benh_nhan_id=patient_profile.id,
            bac_si_id=created_doctors[0].id,
            ngay_kham=today - timedelta(days=2),
            gio_kham=time(8, 30),
            so_thu_tu=1,
            ly_do_kham="Hồi hộp, tức ngực trái khi gắng sức",
            trieu_chung_ban_dau="Thỉnh thoảng đau nhói ngực trái, hồi hộp",
            trang_thai=TrangThaiLichEnum.DA_KHAM.value,
            is_reconfirmed_24h=True,
        )
        session.add(sample_app)
        await session.flush()

        encounter = LuotKham(
            lich_kham_id=sample_app.id,
            bac_si_id=created_doctors[0].id,
            benh_nhan_id=patient_profile.id,
            thoi_gian_bat_dau=datetime.now(timezone.utc) - timedelta(days=2, hours=3),
            thoi_gian_ket_thuc=datetime.now(timezone.utc) - timedelta(days=2, hours=2, minutes=30),
            ly_do_vao_kham="Đau nhói ngực trái, mệt khi leo cầu thang",
            benh_su="Bị khoảng 1 tuần nay, không sốt, không khó thở khi nghỉ",
            mach_lan_phut=78,
            nhiet_do_c=36.8,
            huyet_ap_tam_thu=135,
            huyet_ap_tam_truong=85,
            ket_luan_dieu_tri="Theo dõi tăng huyết áp độ 1, rối loạn thần kinh tim",
            loi_dan_bac_si="Hạn chế ăn mặn, tập thể dục nhẹ nhàng, tái khám sau 2 tuần",
            ngay_hen_tai_kham=today + timedelta(days=12),
            is_locked=True,
            thoi_gian_khoa=datetime.now(timezone.utc) - timedelta(days=2, hours=2, minutes=30),
        )
        session.add(encounter)
        await session.flush()

        stmt_concept = select(KhaiNiem).where(KhaiNiem.ma_khai_niem == "I10")
        concept = (await session.execute(stmt_concept)).scalar_one_or_none()
        if concept:
            session.add(
                ChanDoan(
                    luot_kham_id=encounter.id,
                    khai_niem_id=concept.id,
                    ma_icd10="I10",
                    ten_benh_chan_doan="Bệnh tăng huyết áp vô căn (nguyên phát)",
                    loai_chan_doan="chinh",
                )
            )

        prescription = DonThuoc(
            luot_kham_id=encounter.id,
            bac_si_ke_don_id=created_doctors[0].id,
            ngay_ke_don=datetime.now(timezone.utc) - timedelta(days=2, hours=2, minutes=35),
            loi_dan_uong_thuoc="Uống thuốc đều đặn vào buổi sáng sau ăn no",
        )
        session.add(prescription)
        await session.flush()

        session.add(
            ChiTietDonThuoc(
                don_thuoc_id=prescription.id,
                ten_thuoc="Amlodipine 5mg",
                hoat_chat="Amlodipine besylate",
                ham_luong="5mg",
                don_vi_tinh="Viên",
                so_luong=14,
                cach_dung="Sáng 1 viên sau ăn",
                so_ngay_dung=14,
            )
        )

    await session.flush()


async def seed_database(session=None):
    if session is not None:
        await _execute_seeding(session)
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db_sess:
        await _execute_seeding(db_sess)
        await db_sess.commit()


if __name__ == "__main__":
    asyncio.run(seed_database())
