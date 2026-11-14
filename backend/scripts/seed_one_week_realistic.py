import asyncio
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from sqlalchemy import delete, select, text, update
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.security import hash_password
from app.core.seed_5_departments import DEPARTMENTS_DATA, ROOMS_DATA, DOCTORS_DATA
from app.models.appointment import (
    CaLamViecEnum,
    HangDoiKham,
    LichKham,
    LichLamViec,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.bff_store import HeThongTrangThaiBff
from app.models.medical import (
    AmendmentEntityType,
    AmendmentStatus,
    BienBanDinhChinh,
    ChanDoan,
    ChiDinh,
    ChiTietDonThuoc,
    ChiTietHoaDon,
    DichVu,
    DonThuoc,
    GiaoDichThanhToan,
    HoaDon,
    KhaiNiem,
    LuotKham,
    PhieuThuChi,
    Thuoc,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, PhongKham, TaiKhoan, VaiTroEnum
from scripts.run_migrations import DEPLOYMENT_LOCK, require_demo_database
from seed_data import seed_catalogs
CORE_STAFF = [
    ("admin.demo", "Quản trị viên [DEMO]", VaiTroEnum.ADMIN, "0000000001"),
    ("doctor.demo", "Bác sĩ Nội tổng quát [DEMO]", VaiTroEnum.BAC_SI, "0000000002"),
    ("letan.demo", "Lễ tân [DEMO]", VaiTroEnum.LE_TAN, "0000000003"),
    ("ktv.demo", "Kỹ thuật viên [DEMO]", VaiTroEnum.KY_THUAT_VIEN, "0000000004"),
    ("thungan.demo", "Thu ngân [DEMO]", VaiTroEnum.THU_NGAN, "0000000005"),
    ("patient01", "Bệnh nhân mẫu 01 [DEMO]", VaiTroEnum.BENH_NHAN, "0000000006"),
]
ADDITIONAL_DOCTORS = [
    ("hoang.doctor", "BS.CKII Nguyễn Minh Hoàng", "KHOA_NOI", "P102", "0988000102", "hoang.doctor@clinic-ai.test", 200000.0),
    ("phuong.doctor", "ThS.BS Trần Mai Phương", "KHOA_NGOAI", "P201", "0988000103", "phuong.doctor@clinic-ai.test", 180000.0),
    ("minh.doctor", "BS.CKI Lê Hoàng Long", "KHOA_TMH", "P202", "0988000104", "minh.doctor@clinic-ai.test", 170000.0),
    ("dung.doctor", "BS. Vũ Anh Dũng", "KHOA_RANG", "P301", "0988000105", "dung.doctor@clinic-ai.test", 150000.0),
    ("thao.doctor", "BS.CKI Đỗ Thanh Thảo", "KHOA_MAT", "P302", "0988000106", "thao.doctor@clinic-ai.test", 160000.0),
]
SAMPLE_PATIENTS_DATA = [
    ("Nguyễn Văn An", "0912001001", date(1985, 3, 12), "Nam", "Số 12 Chùa Bộc, Đống Đa, Hà Nội", "BN-2026-0001", "O+"),
    ("Trần Thị Bích", "0912001002", date(1992, 7, 24), "Nữ", "Số 45 Nguyễn Trãi, Thanh Xuân, Hà Nội", "BN-2026-0002", "A+"),
    ("Lê Hoàng Cường", "0912001003", date(1978, 11, 5), "Nam", "Số 88 Cầu Giấy, Cầu Giấy, Hà Nội", "BN-2026-0003", "B+"),
    ("Phạm Minh Dung", "0912001004", date(1965, 9, 18), "Nữ", "Số 23 Kim Mã, Ba Đình, Hà Nội", "BN-2026-0004", "AB+"),
    ("Hoàng Quốc Em", "0912001005", date(2001, 1, 30), "Nam", "Số 56 Giải Phóng, Hai Bà Trưng, Hà Nội", "BN-2026-0005", "O+"),
    ("Vũ Thị Giang", "0912001006", date(1995, 4, 15), "Nữ", "Số 102 Hoàng Mai, Hà Nội", "BN-2026-0006", "A+"),
    ("Đỗ Văn Hùng", "0912001007", date(1970, 8, 22), "Nam", "Số 15 Lê Văn Lương, Thanh Xuân, Hà Nội", "BN-2026-0007", "O-"),
    ("Bùi Thị Hương", "0912001008", date(1988, 12, 10), "Nữ", "Số 67 Trần Duy Hưng, Cầu Giấy, Hà Nội", "BN-2026-0008", "B+"),
    ("Đinh Trọng Kiên", "0912001009", date(1990, 5, 8), "Nam", "Số 34 Tây Sơn, Đống Đa, Hà Nội", "BN-2026-0009", "A+"),
    ("Ngô Thị Lan", "0912001010", date(1958, 2, 14), "Nữ", "Số 89 Bạch Mai, Hai Bà Trưng, Hà Nội", "BN-2026-0010", "O+"),
    ("Dương Quốc Mạnh", "0912001011", date(2003, 6, 20), "Nam", "Số 120 Láng Hạ, Đống Đa, Hà Nội", "BN-2026-0011", "AB+"),
    ("Lý Thị Mai", "0912001012", date(1982, 10, 3), "Nữ", "Số 78 Xã Đàn, Đống Đa, Hà Nội", "BN-2026-0012", "A-"),
    ("Đoàn Văn Nam", "0912001013", date(1975, 4, 17), "Nam", "Số 95 Trường Chinh, Thanh Xuân, Hà Nội", "BN-2026-0013", "O+"),
    ("Mai Thị Oanh", "0912001014", date(1998, 9, 27), "Nữ", "Số 144 Xuân Thủy, Cầu Giấy, Hà Nội", "BN-2026-0014", "B+"),
    ("Hồ Văn Phúc", "0912001015", date(1968, 12, 1), "Nam", "Số 205 Định Công, Hoàng Mai, Hà Nội", "BN-2026-0015", "O+"),
    ("Trịnh Thị Quyên", "0912001016", date(1993, 3, 8), "Nữ", "Số 52 Phạm Ngọc Thạch, Đống Đa, Hà Nội", "BN-2026-0016", "A+"),
    ("Cao Văn Sơn", "0912001017", date(1980, 7, 19), "Nam", "Số 11 Nguyễn Chí Thanh, Ba Đình, Hà Nội", "BN-2026-0017", "B-"),
    ("Lương Thị Thảo", "0912001018", date(2005, 11, 23), "Nữ", "Số 80 Thái Hà, Đống Đa, Hà Nội", "BN-2026-0018", "O+"),
    ("Tạ Văn Uy", "0912001019", date(1972, 8, 14), "Nam", "Số 33 Khâm Thiên, Đống Đa, Hà Nội", "BN-2026-0019", "A+"),
    ("Võ Thị Xuân", "0912001020", date(1960, 5, 29), "Nữ", "Số 66 Đại Cồ Việt, Hai Bà Trưng, Hà Nội", "BN-2026-0020", "AB+"),
    ("Phan Văn Yên", "0912001021", date(1987, 1, 16), "Nam", "Số 19 Huỳnh Thúc Kháng, Đống Đa, Hà Nội", "BN-2026-0021", "O+"),
    ("Đỗ Kim Chi", "0912001022", date(1996, 10, 11), "Nữ", "Số 40 Tôn Đức Thắng, Đống Đa, Hà Nội", "BN-2026-0022", "B+"),
    ("Trương Hoàng Đạt", "0912001023", date(1983, 4, 4), "Nam", "Số 71 Kim Mã, Ba Đình, Hà Nội", "BN-2026-0023", "O+"),
    ("Lê Hồng Gấm", "0912001024", date(1991, 12, 15), "Nữ", "Số 112 Nguyễn Lương Bằng, Đống Đa, Hà Nội", "BN-2026-0024", "A+"),
    ("Bùi Quang Khải", "0912001025", date(1979, 6, 28), "Nam", "Số 85 Nguyễn Thái Học, Ba Đình, Hà Nội", "BN-2026-0025", "O+"),
]
async def seed_all_doctors_and_staff(session, password, dept_map, room_map):
    people = {}
    for name, full_name, role, phone in CORE_STAFF:
        email = f"{name}@clinic-ai.test"
        person = await session.scalar(select(NguoiDung).where(NguoiDung.email == email))
        if person is None:
            person = NguoiDung(
                ho_ten=full_name,
                email=email,
                so_dien_thoai=phone,
                ngay_sinh=date(1988, 5, 10),
                gioi_tinh="Nam" if "Nguyễn" in full_name or "Hoàng" in full_name or role != VaiTroEnum.LE_TAN else "Nữ",
                dia_chi="Hà Nội",
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
        else:
            account.mat_khau_hash = hash_password(password)
        people[role] = person
    await session.flush()
    doctor_entities = []
    doctor_person = people[VaiTroEnum.BAC_SI]
    primary_doc = await session.scalar(select(BacSi).where(BacSi.nguoi_dung_id == doctor_person.id))
    if primary_doc is None:
        primary_doc = BacSi(
            nguoi_dung_id=doctor_person.id,
            chuyen_khoa_id=dept_map["KHOA_NOI"],
            phong_kham_id=room_map["P101"],
            hoc_vi="BS.CKI",
            chung_chi_hanh_nghe="CCHN-DEMO-001",
            ngay_cap=date(2020, 1, 1),
            ngay_het_han=date(2030, 1, 1),
            gia_kham_mac_dinh=150000.0,
            is_active=True,
        )
        session.add(primary_doc)
        await session.flush()
    doctor_entities.append(primary_doc)
    for prefix, full_name, dept_code, room_code, phone, email, fee in ADDITIONAL_DOCTORS:
        person = await session.scalar(select(NguoiDung).where(NguoiDung.email == email))
        if person is None:
            person = NguoiDung(
                ho_ten=full_name,
                email=email,
                so_dien_thoai=phone,
                ngay_sinh=date(1980, 8, 15),
                gioi_tinh="Nữ" if "Phương" in full_name or "Thảo" in full_name else "Nam",
                dia_chi="Hà Nội",
            )
            session.add(person)
            await session.flush()
        account = await session.scalar(select(TaiKhoan).where(TaiKhoan.email == email))
        if account is None:
            session.add(TaiKhoan(
                nguoi_dung_id=person.id,
                email=email,
                mat_khau_hash=hash_password(password),
                vai_tro=VaiTroEnum.BAC_SI.value,
                is_active=True,
            ))
        else:
            account.mat_khau_hash = hash_password(password)
        await session.flush()
        doc = await session.scalar(select(BacSi).where(BacSi.nguoi_dung_id == person.id))
        if doc is None:
            dept_obj = dept_map.get(dept_code)
            room_obj = room_map.get(room_code)
            doc = BacSi(
                nguoi_dung_id=person.id,
                chuyen_khoa_id=dept_obj if dept_obj else dept_map["KHOA_NOI"],
                phong_kham_id=room_obj if room_obj else room_map["P101"],
                hoc_vi="ThS.BS" if "ThS" in full_name else "BS.CKII" if "CKII" in full_name else "BS.CKI",
                chung_chi_hanh_nghe=f"CCHN-{prefix.upper()}-99",
                ngay_cap=date(2018, 5, 20),
                ngay_het_han=date(2028, 5, 20),
                gia_kham_mac_dinh=fee,
                is_active=True,
            )
            session.add(doc)
            await session.flush()
        doctor_entities.append(doc)
    return people, doctor_entities
async def seed_shifts_for_all_doctors(session, doctor_entities, today):
    shifts = [
        (CaLamViecEnum.SANG.value, time(7, 30), time(11, 30)),
        (CaLamViecEnum.CHIEU.value, time(13, 30), time(17, 0)),
    ]
    for doc in doctor_entities:
        existing = set((await session.execute(
            select(LichLamViec.ngay_lam_viec, LichLamViec.ca_lam_viec).where(
                LichLamViec.bac_si_id == doc.id,
                LichLamViec.ngay_lam_viec >= today - timedelta(days=7),
            )
        )).all())
        for day_offset in range(-7, 15):
            work_date = today + timedelta(days=day_offset)
            for shift_name, start_t, end_t in shifts:
                if (work_date, shift_name) not in existing:
                    session.add(LichLamViec(
                        bac_si_id=doc.id,
                        phong_kham_id=doc.phong_kham_id,
                        ngay_lam_viec=work_date,
                        ca_lam_viec=shift_name,
                        gio_bat_dau=start_t,
                        gio_ket_thuc=end_t,
                        gioi_han_ca_kham=10,
                        han_muc_dat_truoc=8,
                        han_muc_vang_lai=2,
                        is_active=True,
                    ))
    await session.flush()
async def seed_patients(session):
    patient_entities = []
    for full_name, phone, dob, gender, address, code, blood in SAMPLE_PATIENTS_DATA:
        person = await session.scalar(select(NguoiDung).where(NguoiDung.so_dien_thoai == phone))
        if person is None:
            email = f"patient_{phone}@clinic-ai.test"
            person = NguoiDung(
                ho_ten=full_name,
                email=email,
                so_dien_thoai=phone,
                ngay_sinh=dob,
                gioi_tinh=gender,
                dia_chi=address,
            )
            session.add(person)
            await session.flush()
        patient = await session.scalar(select(BenhNhan).where(BenhNhan.nguoi_dung_id == person.id))
        if patient is None:
            patient = BenhNhan(
                nguoi_dung_id=person.id,
                ma_dinh_danh_y_te=code,
                nhom_mau=blood,
                diem_tin_nhiem=100,
                so_lan_no_show=0,
            )
            session.add(patient)
            await session.flush()
        patient_entities.append(patient)
    return patient_entities
def _is_legacy_random_seed_code(code: str, prefix: str) -> bool:
    m = re.match(rf"^{prefix}-20\d{{6}}-(\d{{4}})$", str(code or "").strip())
    return bool(m and int(m.group(1)) >= 100)


def _canonical_voucher_code(val) -> str:
    s = str(val or "").strip().upper()
    while s.startswith("HD-"):
        s = s[3:]
    return s


async def _cleanup_duplicate_seed_invoices(session):
    await session.execute(
        update(HoaDon).where(HoaDon.trang_thai == "da_thanh_toan").values(trang_thai="da_thu")
    )

    all_invoices = (await session.scalars(select(HoaDon).order_by(HoaDon.id.asc()))).all()
    legacy_hd_ids = []
    legacy_hd_codes = []
    seen_lk_groups = set()
    for inv in all_invoices:
        ma = str(inv.ma_hoa_don or "").strip()
        is_legacy_hd = _is_legacy_random_seed_code(ma, "HD")
        is_dup_seed_lk = False
        if re.match(r"^HD-20\d{6}-\d{4}$", ma) and inv.luot_kham_id:
            if inv.luot_kham_id in seen_lk_groups:
                is_dup_seed_lk = True
            else:
                seen_lk_groups.add(inv.luot_kham_id)
        if is_legacy_hd or is_dup_seed_lk:
            legacy_hd_ids.append(inv.id)
            legacy_hd_codes.append(ma)

    if legacy_hd_ids:
        await session.execute(
            delete(PhieuThuChi).where(
                (PhieuThuChi.hoa_don_id.in_(legacy_hd_ids))
                | (PhieuThuChi.ma_phieu.in_(legacy_hd_codes))
            )
        )
        await session.execute(delete(GiaoDichThanhToan).where(GiaoDichThanhToan.hoa_don_id.in_(legacy_hd_ids)))
        await session.execute(delete(ChiTietHoaDon).where(ChiTietHoaDon.hoa_don_id.in_(legacy_hd_ids)))
        await session.execute(delete(HoaDon).where(HoaDon.id.in_(legacy_hd_ids)))
        await session.flush()

    all_encounters = (await session.scalars(select(LuotKham).where(LuotKham.ma_kcb.like("KCB-20%")))).all()
    legacy_kcb_ids = [
        lk.id for lk in all_encounters if _is_legacy_random_seed_code(lk.ma_kcb, "KCB")
    ]
    if legacy_kcb_ids:
        referenced_kcb_ids = set(
            (await session.scalars(select(HoaDon.luot_kham_id).where(HoaDon.luot_kham_id.in_(legacy_kcb_ids)))).all()
        )
        safe_kcb_ids = [kid for kid in legacy_kcb_ids if kid not in referenced_kcb_ids]
        if safe_kcb_ids:
            await session.execute(delete(BienBanDinhChinh).where(BienBanDinhChinh.luot_kham_id.in_(safe_kcb_ids)))
            rx_ids = list((await session.scalars(select(DonThuoc.id).where(DonThuoc.luot_kham_id.in_(safe_kcb_ids)))).all())
            if rx_ids:
                await session.execute(delete(ChiTietDonThuoc).where(ChiTietDonThuoc.don_thuoc_id.in_(rx_ids)))
                await session.execute(delete(DonThuoc).where(DonThuoc.id.in_(rx_ids)))
            cd_ids = list((await session.scalars(select(ChiDinh.id).where(ChiDinh.luot_kham_id.in_(safe_kcb_ids)))).all())
            if cd_ids:
                await session.execute(delete(ChiDinh).where(ChiDinh.id.in_(cd_ids)))
            await session.execute(delete(ChanDoan).where(ChanDoan.luot_kham_id.in_(safe_kcb_ids)))
            await session.execute(delete(LuotKham).where(LuotKham.id.in_(safe_kcb_ids)))
            await session.flush()

    all_appts = (await session.scalars(select(LichKham).where(LichKham.ma_lich_kham.like("LK-20%")))).all()
    legacy_lk_ids = [
        lk.id for lk in all_appts if _is_legacy_random_seed_code(lk.ma_lich_kham, "LK")
    ]
    if legacy_lk_ids:
        referenced_lk_ids = set(
            (await session.scalars(select(LuotKham.lich_kham_id).where(LuotKham.lich_kham_id.in_(legacy_lk_ids)))).all()
        )
        safe_lk_ids = [aid for aid in legacy_lk_ids if aid not in referenced_lk_ids]
        if safe_lk_ids:
            await session.execute(delete(HangDoiKham).where(HangDoiKham.lich_kham_id.in_(safe_lk_ids)))
            await session.execute(delete(LichKham).where(LichKham.id.in_(safe_lk_ids)))
            await session.flush()

    bff_vouchers = await session.scalar(
        select(HeThongTrangThaiBff).where(HeThongTrangThaiBff.collection_key == "vouchers")
    )
    if bff_vouchers and isinstance(bff_vouchers.data_json, list):
        cleaned_bff = []
        seen_norms = set()
        for item in bff_vouchers.data_json:
            if not isinstance(item, dict):
                continue
            code = str(item.get("maPhieu") or item.get("id") or "").strip()
            if _is_legacy_random_seed_code(code, "HD"):
                continue
            norm = _canonical_voucher_code(code)
            if norm and norm != "DỰ KIẾN LẬP HÓA ĐƠN":
                if norm in seen_norms:
                    continue
                seen_norms.add(norm)
            cleaned_bff.append(item)
        bff_vouchers.data_json = cleaned_bff
        await session.flush()


async def seed_one_week_realistic():
    password = os.environ.get("DEMO_PASSWORD", "Demo@12345678")
    async with AsyncSessionLocal.begin() as session:
        await session.execute(text("SET LOCAL lock_timeout = '60s'"))
        await session.execute(text("SELECT pg_advisory_xact_lock(:lock)"), {"lock": DEPLOYMENT_LOCK})
        connection = await session.connection()
        await connection.run_sync(require_demo_database)
        await _cleanup_duplicate_seed_invoices(session)
        dept_map, room_map, service_map = await seed_catalogs(session)
        people, doctor_entities = await seed_all_doctors_and_staff(session, password, dept_map, room_map)
        now = datetime.now(timezone.utc)
        today = now.astimezone(timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))).date()
        await seed_shifts_for_all_doctors(session, doctor_entities, today)
        patient_entities = await seed_patients(session)
        icd_list = (await session.scalars(select(KhaiNiem).limit(20))).all()
        icd_lookup = {item.ma_khai_niem: item for item in icd_list}
        drug_list = (await session.scalars(select(Thuoc).where(Thuoc.is_active.is_(True)).limit(15))).all()
        services_list = list(service_map.values())
        lab_services = [s for s in services_list if s.ma_nhom_byt in ("XN", "CDHA")]
        general_lab = lab_services[0] if lab_services else services_list[0]
        general_xray = lab_services[1] if len(lab_services) > 1 else general_lab
        primary_doc = doctor_entities[0]
        cashier_person = people[VaiTroEnum.THU_NGAN]
        tech_person = people[VaiTroEnum.KY_THUAT_VIEN]
        clinical_templates = [
            ("I10", "Tăng huyết áp vô căn (nguyên phát)", "Tái khám định kỳ theo dõi huyết áp", 135, 85, 78, 36.6, 68.0, 168.0),
            ("E11", "Đái tháo đường không phụ thuộc insulin (Type 2)", "Khát nước nhiều, sụt cân nhẹ, mệt mỏi", 120, 80, 74, 36.5, 62.0, 162.0),
            ("K21.9", "Bệnh trào ngược dạ dày - thực quản (GERD)", "Ợ chua, nóng rát vùng thượng vị sau ăn", 118, 76, 80, 36.7, 58.0, 160.0),
            ("J00", "Viêm mũi họng cấp", "Sổ mũi nghẹt mũi 3 ngày nay, hắt hơi nhiều", 110, 70, 82, 37.2, 54.0, 158.0),
            ("M54.5", "Đau thắt lưng cơ năng", "Đau mỏi vùng thắt lưng sau mang vác nặng", 125, 82, 72, 36.5, 72.0, 172.0),
            ("K29.7", "Viêm dạ dày không đặc hiệu", "Đau âm ỉ thượng vị lúc đói, đầy hơi khó tiêu", 115, 75, 76, 36.6, 60.0, 165.0),
            ("J20.9", "Viêm phế quản cấp", "Ho có đờm trắng đục, không khó thở, sốt nhẹ", 120, 78, 86, 37.4, 65.0, 168.0),
        ]
        for day_offset in range(-7, 0):
            target_date = today + timedelta(days=day_offset)
            daily_patients_count = 3
            for idx in range(daily_patients_count):
                patient = patient_entities[(abs(day_offset) * 3 + idx) % len(patient_entities)]
                doctor = doctor_entities[idx % len(doctor_entities)]
                template = clinical_templates[(day_offset + idx) % len(clinical_templates)]
                icd_code, icd_name, reason, bp_sys, bp_dia, pulse, temp, weight, height = template
                appt_code = f"LK-{target_date.strftime('%Y%m%d')}-{idx + 1:04d}"
                appt = await session.scalar(select(LichKham).where(LichKham.ma_lich_kham == appt_code))
                if appt is None:
                    appt = LichKham(
                        ma_lich_kham=appt_code,
                        benh_nhan_id=patient.id,
                        bac_si_id=doctor.id,
                        chuyen_khoa_id=doctor.chuyen_khoa_id,
                        ngay_kham=target_date,
                        gio_kham=time(8 + idx, 15),
                        ca_kham=CaLamViecEnum.SANG.value,
                        trang_thai=TrangThaiLichEnum.DA_KHAM.value,
                        so_thu_tu=idx + 1,
                        ly_do_kham=reason,
                        trieu_chung_ban_dau=reason,
                        is_reconfirmed_24h=True,
                    )
                    session.add(appt)
                    await session.flush()
                queue_ticket = await session.scalar(select(HangDoiKham).where(HangDoiKham.lich_kham_id == appt.id))
                if queue_ticket is None:
                    checkin_dt = datetime.combine(target_date, time(8, 0), tzinfo=timezone.utc) + timedelta(minutes=idx * 20)
                    start_dt = checkin_dt + timedelta(minutes=15)
                    end_dt = start_dt + timedelta(minutes=25)
                    queue_ticket = HangDoiKham(
                        lich_kham_id=appt.id,
                        benh_nhan_id=patient.id,
                        bac_si_id=doctor.id,
                        phong_kham_id=doctor.phong_kham_id,
                        ngay_kham=target_date,
                        ca_kham=CaLamViecEnum.SANG.value,
                        so_thu_tu_kham=idx + 1,
                        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
                        muc_do_uu_tien=2,
                        trang_thai=TrangThaiHangDoiEnum.DA_KHAM.value,
                        thoi_gian_check_in=checkin_dt,
                        thoi_gian_bat_dau=start_dt,
                        thoi_gian_ket_thuc=end_dt,
                        so_lan_goi=1,
                    )
                    session.add(queue_ticket)
                    await session.flush()
                kcb_code = f"KCB-{target_date.strftime('%Y%m%d')}-{idx + 1:04d}"
                encounter = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == kcb_code))
                if encounter is None:
                    start_dt = datetime.combine(target_date, time(8, 15), tzinfo=timezone.utc) + timedelta(minutes=idx * 25)
                    end_dt = start_dt + timedelta(minutes=25)
                    encounter = LuotKham(
                        ma_kcb=kcb_code,
                        lich_kham_id=appt.id,
                        hang_doi_kham_id=queue_ticket.id,
                        benh_nhan_id=patient.id,
                        bac_si_id=doctor.id,
                        loai_kham="KHAM_MOI",
                        thoi_gian_bat_dau=start_dt,
                        thoi_gian_ket_thuc=end_dt,
                        ly_do_vao_kham=reason,
                        trieu_chung=reason,
                        kham_lam_sang_bo_phan="Tim đều rõ, T1 T2 bình thường. Phổi trong, không rales. Bụng mềm không chướng.",
                        mach_lan_phut=pulse,
                        huyet_ap_tam_thu=bp_sys,
                        huyet_ap_tam_truong=bp_dia,
                        nhiet_do_c=Decimal(str(temp)),
                        can_nang_kg=Decimal(str(weight)),
                        chieu_cao_cm=Decimal(str(height)),
                        spo2=Decimal("98.0"),
                        bmi=round(Decimal(str(weight)) / ((Decimal(str(height)) / 100) ** 2), 1),
                        ket_luan_dieu_tri=f"Chẩn đoán xác định: {icd_name}. Kê đơn điều trị ngoại trú và dặn tái khám sau 7 ngày.",
                        is_locked=True,
                        thoi_gian_khoa=end_dt,
                    )
                    session.add(encounter)
                    await session.flush()
                icd_item = icd_lookup.get(icd_code)
                existing_diag = await session.scalar(select(ChanDoan).where(ChanDoan.luot_kham_id == encounter.id))
                if existing_diag is None:
                    session.add(ChanDoan(
                        luot_kham_id=encounter.id,
                        khai_niem_id=icd_item.id if icd_item else None,
                        ma_icd10=icd_code,
                        ten_benh_chan_doan=icd_name,
                        loai_chan_doan="chinh",
                    ))
                chosen_service = general_lab if idx % 2 == 0 else general_xray
                existing_order = await session.scalar(select(ChiDinh).where(ChiDinh.luot_kham_id == encounter.id))
                if existing_order is None:
                    order = ChiDinh(
                        luot_kham_id=encounter.id,
                        dich_vu_id=chosen_service.id,
                        bac_si_chi_dinh_id=doctor.id,
                        phong_thuc_hien_id=chosen_service.phong_thuc_hien_id,
                        ky_thuat_vien_id=tech_person.id,
                        don_gia_tai_thoi_diem=chosen_service.don_gia,
                        thanh_tien=chosen_service.don_gia,
                        trang_thai="hoan_thanh",
                        thoi_gian_tra_ket_qua=start_dt + timedelta(minutes=18),
                        ket_qua_chi_tiet="Chỉ số sinh hóa máu trong giới hạn bình thường. Không phát hiện bất thường cấp tính.",
                        ket_qua_phan_loai="BINH_THUONG",
                    )
                    session.add(order)
                    await session.flush()
                if drug_list:
                    existing_rx = await session.scalar(select(DonThuoc).where(DonThuoc.luot_kham_id == encounter.id))
                    if existing_rx is None:
                        rx = DonThuoc(
                            ma_don_thuoc=f"DT-{target_date.strftime('%Y%m%d')}-{encounter.id:04d}",
                            luot_kham_id=encounter.id,
                            bac_si_ke_don_id=doctor.id,
                            ngay_ke_don=end_dt,
                            so_ngay_dung=7,
                            trang_thai="COMPLETED",
                            loi_dan_uong_thuoc="Uống thuốc đều đặn sau bữa ăn, hạn chế thức khuya và kiêng rượu bia.",
                        )
                        session.add(rx)
                        await session.flush()
                        d1 = drug_list[idx % len(drug_list)]
                        d2 = drug_list[(idx + 1) % len(drug_list)]
                        session.add(ChiTietDonThuoc(
                            don_thuoc_id=rx.id,
                            thuoc_id=d1.id,
                            ten_thuoc=d1.ten_thuoc,
                            don_vi_tinh=d1.don_vi_tinh,
                            so_luong=14,
                            cach_dung="Uống 1 viên sau ăn sáng và 1 viên sau ăn tối",
                            so_ngay_dung=7,
                        ))
                        session.add(ChiTietDonThuoc(
                            don_thuoc_id=rx.id,
                            thuoc_id=d2.id,
                            ten_thuoc=d2.ten_thuoc,
                            don_vi_tinh=d2.don_vi_tinh,
                            so_luong=7,
                            cach_dung="Uống 1 viên sau ăn sáng",
                            so_ngay_dung=7,
                        ))
                inv_code = f"HD-{target_date.strftime('%Y%m%d')}-{idx + 1:04d}"
                existing_inv = await session.scalar(
                    select(HoaDon).where((HoaDon.ma_hoa_don == inv_code) | (HoaDon.luot_kham_id == encounter.id))
                )
                if existing_inv is None:
                    consult_fee = Decimal(str(doctor.gia_kham_mac_dinh))
                    service_fee = Decimal(str(chosen_service.don_gia))
                    total_amount = consult_fee + service_fee
                    inv = HoaDon(
                        ma_hoa_don=inv_code,
                        luot_kham_id=encounter.id,
                        benh_nhan_id=patient.id,
                        tong_tien=total_amount,
                        so_tien_phai_thu=total_amount,
                        thuc_thu=total_amount,
                        trang_thai="da_thu",
                        nguoi_lap_id=cashier_person.id,
                        thu_ngan_id=cashier_person.id,
                        ngay_thanh_toan=end_dt,
                        phuong_thuc_thanh_toan="chuyen_khoan" if idx % 2 == 0 else "tien_mat",
                    )
                    session.add(inv)
                    await session.flush()
                    session.add(ChiTietHoaDon(
                        hoa_don_id=inv.id,
                        loai_muc="kham_benh",
                        ten_khoan_thu=f"Phí khám chuyên khoa - {doctor.hoc_vi}",
                        don_gia=consult_fee,
                        thanh_tien=consult_fee,
                    ))
                    session.add(ChiTietHoaDon(
                        hoa_don_id=inv.id,
                        loai_muc="can_lam_sang",
                        ten_khoan_thu=chosen_service.ten_dich_vu,
                        don_gia=service_fee,
                        thanh_tien=service_fee,
                    ))
                    session.add(GiaoDichThanhToan(
                        ma_giao_dich=f"GD-{target_date.strftime('%Y%m%d')}-{inv.id:04d}",
                        hoa_don_id=inv.id,
                        loai_giao_dich="THANH_TOAN",
                        so_tien=total_amount,
                        phuong_thuc="CHUYEN_KHOAN" if idx % 2 == 0 else "TIEN_MAT",
                        nguon_tao_giao_dich="CONG_SEPAY" if idx % 2 == 0 else "QUAY_THU_NGAN",
                        nguoi_thu_id=cashier_person.id,
                        thoi_gian_giao_dich=end_dt,
                        thoi_gian_xac_nhan=end_dt,
                        trang_thai="THANH_CONG",
                    ))
        yesterday_encounter = await session.scalar(
            select(LuotKham).order_by(LuotKham.id.desc()).limit(1)
        )
        if yesterday_encounter:
            existing_amend = await session.scalar(
                select(BienBanDinhChinh).where(BienBanDinhChinh.luot_kham_id == yesterday_encounter.id)
            )
            if existing_amend is None:
                session.add(BienBanDinhChinh(
                    luot_kham_id=yesterday_encounter.id,
                    thuc_the_loai=AmendmentEntityType.CHAN_DOAN.value,
                    thuc_the_id=yesterday_encounter.id,
                    ly_do_ma="BO_SUNG_KET_QUA_CLS",
                    ly_do_text="Bệnh nhân có kết quả siêu âm bổ sung sỏi túi mật 5mm, đính chính chẩn đoán từ K29 sang K80",
                    noi_dung_cu_json={"ma_icd10": "K29.7", "ten_benh": "Viêm dạ dày không đặc hiệu"},
                    noi_dung_moi_json={"ma_icd10": "K80.2", "ten_benh": "Sỏi túi mật không có viêm túi mật"},
                    muc_do_nghiem_trong="TRUNG_BINH",
                    requested_by_id=primary_doc.nguoi_dung_id,
                    trang_thai=AmendmentStatus.CHO_PHE_DUYET.value,
                    ghi_chu="Kính trình Lãnh đạo phòng khám phê duyệt đính chính hồ sơ bệnh án điện tử.",
                ))
        today_cases = [
            ("patient_p101_curr", "Lê Văn Tiến", "0912009001", primary_doc, "DANG_KHAM", "Đau ngực trái từng cơn, hồi hộp trống ngực"),
            ("patient_p101_waiting", "Nguyễn Hải Đăng", "0912009002", primary_doc, "CHO_KHAM", "Kiểm tra sức khỏe tổng quát định kỳ"),
            ("patient_lab_wait", "Trần Thu Hà", "0912009003", doctor_entities[1], "CHO_KHAM", "Tầm soát tiểu đường và mỡ máu"),
            ("patient_cashier_wait", "Đỗ Minh Tuấn", "0912009004", doctor_entities[2], "DA_KHAM", "Viêm họng hạt cấp tính"),
            ("patient_queue_05", "Phạm Quỳnh Chi", "0912009005", doctor_entities[3], "CHO_KHAM", "Đau nhức răng hàm số 8 hàm dưới"),
        ]
        stt_today = 1
        for code_key, full_name, phone, doctor, q_status, reason in today_cases:
            person = await session.scalar(select(NguoiDung).where(NguoiDung.so_dien_thoai == phone))
            if person is None:
                person = NguoiDung(
                    ho_ten=full_name,
                    email=f"{code_key}@clinic-ai.test",
                    so_dien_thoai=phone,
                    ngay_sinh=date(1991, 4, 15),
                    gioi_tinh="Nữ" if "Hà" in full_name or "Chi" in full_name else "Nam",
                    dia_chi="Hà Nội",
                )
                session.add(person)
                await session.flush()
            patient = await session.scalar(select(BenhNhan).where(BenhNhan.nguoi_dung_id == person.id))
            if patient is None:
                patient = BenhNhan(
                    nguoi_dung_id=person.id,
                    ma_dinh_danh_y_te=f"BN-TODAY-{stt_today:03d}",
                    nhom_mau="O+",
                    diem_tin_nhiem=100,
                )
                session.add(patient)
                await session.flush()
            appt_code = f"LK-TODAY-{stt_today:03d}"
            appt = await session.scalar(select(LichKham).where(LichKham.ma_lich_kham == appt_code))
            if appt is None:
                appt = LichKham(
                    ma_lich_kham=appt_code,
                    benh_nhan_id=patient.id,
                    bac_si_id=doctor.id,
                    chuyen_khoa_id=doctor.chuyen_khoa_id,
                    ngay_kham=today,
                    gio_kham=time(8 + stt_today, 0),
                    ca_kham=CaLamViecEnum.SANG.value,
                    trang_thai=TrangThaiLichEnum.DANG_KHAM.value if q_status == "DANG_KHAM" else TrangThaiLichEnum.DA_XAC_NHAN.value,
                    so_thu_tu=stt_today,
                    ly_do_kham=reason,
                    trieu_chung_ban_dau=reason,
                    is_reconfirmed_24h=True,
                )
                session.add(appt)
                await session.flush()
            queue_ticket = await session.scalar(select(HangDoiKham).where(HangDoiKham.lich_kham_id == appt.id))
            if queue_ticket is None:
                queue_ticket = HangDoiKham(
                    lich_kham_id=appt.id,
                    benh_nhan_id=patient.id,
                    bac_si_id=doctor.id,
                    phong_kham_id=doctor.phong_kham_id,
                    ngay_kham=today,
                    ca_kham=CaLamViecEnum.SANG.value,
                    so_thu_tu_kham=stt_today,
                    loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
                    muc_do_uu_tien=1 if stt_today == 1 else 2,
                    trang_thai=getattr(TrangThaiHangDoiEnum, q_status).value,
                    thoi_gian_check_in=now - timedelta(minutes=40 - stt_today * 5),
                    thoi_gian_bat_dau=now - timedelta(minutes=10) if q_status == "DANG_KHAM" else None,
                    so_lan_goi=1 if q_status == "DANG_KHAM" else 0,
                    ghi_chu_dieu_phoi=reason,
                )
                session.add(queue_ticket)
                await session.flush()
            if q_status == "DANG_KHAM":
                kcb_code = f"KCB-TODAY-{stt_today:03d}"
                encounter = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == kcb_code))
                if encounter is None:
                    encounter = LuotKham(
                        ma_kcb=kcb_code,
                        lich_kham_id=appt.id,
                        hang_doi_kham_id=queue_ticket.id,
                        benh_nhan_id=patient.id,
                        bac_si_id=doctor.id,
                        thoi_gian_bat_dau=now - timedelta(minutes=15),
                        ly_do_vao_kham=reason,
                        trieu_chung=reason,
                        mach_lan_phut=80,
                        huyet_ap_tam_thu=130,
                        huyet_ap_tam_truong=85,
                        nhiet_do_c=Decimal("36.7"),
                        can_nang_kg=Decimal("64.5"),
                        chieu_cao_cm=Decimal("165.0"),
                        spo2=Decimal("98.0"),
                        bmi=Decimal("23.7"),
                        is_locked=False,
                    )
                    session.add(encounter)
                    await session.flush()
            if code_key == "patient_lab_wait":
                kcb_code = "KCB-TODAY-LAB"
                encounter = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == kcb_code))
                if encounter is None:
                    encounter = LuotKham(
                        ma_kcb=kcb_code,
                        lich_kham_id=appt.id,
                        hang_doi_kham_id=queue_ticket.id,
                        benh_nhan_id=patient.id,
                        bac_si_id=doctor.id,
                        thoi_gian_bat_dau=now - timedelta(minutes=30),
                        ly_do_vao_kham=reason,
                        trieu_chung=reason,
                        is_locked=False,
                    )
                    session.add(encounter)
                    await session.flush()
                order1 = ChiDinh(
                    luot_kham_id=encounter.id,
                    dich_vu_id=general_lab.id,
                    bac_si_chi_dinh_id=doctor.id,
                    phong_thuc_hien_id=general_lab.phong_thuc_hien_id,
                    don_gia_tai_thoi_diem=general_lab.don_gia,
                    thanh_tien=general_lab.don_gia,
                    trang_thai="cho_thuc_hien",
                )
                order2 = ChiDinh(
                    luot_kham_id=encounter.id,
                    dich_vu_id=general_xray.id,
                    bac_si_chi_dinh_id=doctor.id,
                    phong_thuc_hien_id=general_xray.phong_thuc_hien_id,
                    don_gia_tai_thoi_diem=general_xray.don_gia,
                    thanh_tien=general_xray.don_gia,
                    trang_thai="cho_duyet",
                    ky_thuat_vien_id=tech_person.id,
                    tep_dinh_kem_url="https://res.cloudinary.com/wnxp3aok/image/upload/v1731518000/demo_chest_xray.jpg",
                    file_dinh_kem_urls=["https://res.cloudinary.com/wnxp3aok/image/upload/v1731518000/demo_chest_xray.jpg"],
                    ket_qua_chi_tiet="Hình ảnh bóng tim trong giới hạn bình thường. Hai phế trường sáng đều, không thấy tổn thương thâm nhiễm khu trú.",
                    ket_qua_phan_loai="BINH_THUONG",
                )
                session.add_all([order1, order2])
                await session.flush()
            if code_key == "patient_cashier_wait":
                kcb_code = "KCB-TODAY-CASHIER"
                encounter = await session.scalar(select(LuotKham).where(LuotKham.ma_kcb == kcb_code))
                if encounter is None:
                    encounter = LuotKham(
                        ma_kcb=kcb_code,
                        lich_kham_id=appt.id,
                        hang_doi_kham_id=queue_ticket.id,
                        benh_nhan_id=patient.id,
                        bac_si_id=doctor.id,
                        thoi_gian_bat_dau=now - timedelta(minutes=45),
                        thoi_gian_ket_thuc=now - timedelta(minutes=10),
                        ly_do_vao_kham=reason,
                        trieu_chung=reason,
                        is_locked=True,
                    )
                    session.add(encounter)
                    await session.flush()
                inv_code = "HD-TODAY-SEPAY-001"
                existing_inv = await session.scalar(select(HoaDon).where(HoaDon.ma_hoa_don == inv_code))
                if existing_inv is None:
                    consult_fee = Decimal(str(doctor.gia_kham_mac_dinh))
                    inv = HoaDon(
                        ma_hoa_don=inv_code,
                        luot_kham_id=encounter.id,
                        benh_nhan_id=patient.id,
                        tong_tien=consult_fee,
                        so_tien_phai_thu=consult_fee,
                        thuc_thu=0,
                        trang_thai="chua_thu",
                        nguoi_lap_id=cashier_person.id,
                        phuong_thuc_thanh_toan="chuyen_khoan",
                    )
                    session.add(inv)
                    await session.flush()
                    session.add(ChiTietHoaDon(
                        hoa_don_id=inv.id,
                        loai_muc="kham_benh",
                        ten_khoan_thu=f"Phí khám chuyên khoa - {doctor.hoc_vi}",
                        don_gia=consult_fee,
                        thanh_tien=consult_fee,
                    ))
            stt_today += 1
        await session.commit()
def main():
    asyncio.run(seed_one_week_realistic())
    print("Full one-week realistic clinic data seeded successfully.")
if __name__ == "__main__":
    main()
