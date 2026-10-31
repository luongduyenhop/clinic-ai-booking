import asyncio
from datetime import date, datetime, time, timedelta, timezone
from sqlalchemy import select, text, delete, func
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import ChuyenKhoa, NguoiDung, TaiKhoan, BenhNhan, BacSi, PhongKham, VaiTroEnum
from app.models.appointment import (
    LichLamViec, LichKham, CaLamViecEnum, TrangThaiLichEnum,
    HangDoiKham, TrangThaiHangDoiEnum, LoaiHangDoiEnum
)
from app.models.medical import DichVu, LuotKham, ChanDoan, DonThuoc, ChiTietDonThuoc, Thuoc, KhaiNiem


DEPARTMENTS_DATA = [
    {
        "ma": "KHOA_NOI",
        "ten": "Khoa Nội tổng quát",
        "mo_ta": "Khám và điều trị các bệnh lý nội khoa tổng hợp, tim mạch, tiêu hóa, hô hấp, đái tháo đường, tăng huyết áp",
        "vi_tri": "Phòng 101, 102 - Tầng 1",
    },
    {
        "ma": "KHOA_NGOAI",
        "ten": "Khoa Ngoại",
        "mo_ta": "Khám ngoại khoa, tiểu phẫu, xử lý vết thương phần mềm, trích rạch áp xe, u bã đậu, cắt chỉ",
        "vi_tri": "Phòng 201 - Tầng 2",
    },
    {
        "ma": "KHOA_TMH",
        "ten": "Khoa Tai Mũi Họng",
        "mo_ta": "Khám và nội soi tai mũi họng, hút rửa xoang, điều trị viêm họng, viêm amidan, viêm tai giữa, tiền đình",
        "vi_tri": "Phòng 202 - Tầng 2",
    },
    {
        "ma": "KHOA_RANG",
        "ten": "Khoa Răng",
        "mo_ta": "Nha khoa tổng quát, khám răng, lấy cao răng, hàn răng sâu, nhổ răng số 8, điều trị tủy, viêm nướu",
        "vi_tri": "Phòng 301 - Tầng 3",
    },
    {
        "ma": "KHOA_MAT",
        "ten": "Khoa Mắt",
        "mo_ta": "Khám thị lực, đo khúc xạ tự động, soi đáy mắt, điều trị đau mắt đỏ, dị vật mắt, tật khúc xạ",
        "vi_tri": "Phòng 302 - Tầng 3",
    },
]

ROOMS_DATA = [
    {"ma": "P101", "ten": "Phòng Khám Nội Tổng Quát 1", "dept_ma": "KHOA_NOI", "tang": "Tầng 1", "loai": "kham_benh"},
    {"ma": "P102", "ten": "Phòng Khám Nội Tổng Quát 2", "dept_ma": "KHOA_NOI", "tang": "Tầng 1", "loai": "kham_benh"},
    {"ma": "P201", "ten": "Phòng Khám Ngoại & Tiểu Phẫu", "dept_ma": "KHOA_NGOAI", "tang": "Tầng 2", "loai": "kham_benh"},
    {"ma": "P202", "ten": "Phòng Khám Tai Mũi Họng & Nội Soi", "dept_ma": "KHOA_TMH", "tang": "Tầng 2", "loai": "kham_benh"},
    {"ma": "P301", "ten": "Phòng Khám Răng & Nha Khoa", "dept_ma": "KHOA_RANG", "tang": "Tầng 3", "loai": "kham_benh"},
    {"ma": "P302", "ten": "Phòng Khám Mắt & Đo Khúc Xạ", "dept_ma": "KHOA_MAT", "tang": "Tầng 3", "loai": "kham_benh"},
    {"ma": "LAB01", "ten": "Phòng Xét Nghiệm Trung Tâm", "dept_ma": None, "tang": "Tầng 1", "loai": "xet_nghiem"},
    {"ma": "CDHA01", "ten": "Phòng Chẩn Đoán Hình Ảnh (X-Quang / Siêu Âm)", "dept_ma": None, "tang": "Tầng 1", "loai": "chan_doan_hinh_anh"},
]

DOCTORS_DATA = [
    {
        "ho_ten": "PGS.TS Phạm Đức Minh",
        "email": "minh.doctor@clinic.com",
        "sdt": "0988000104",
        "hoc_vi": "PGS.TS",
        "dept_ma": "KHOA_NOI",
        "room_ma": "P101",
        "kinh_nghiem": 20,
        "mo_ta": "Trưởng khoa Nội tổng hợp - Chuyên gia chẩn đoán bệnh lý mạn tính, đái tháo đường & tim mạch",
        "gia_kham": 250000.0,
    },
    {
        "ho_ten": "BS. CKII Nguyễn Minh Hoàng",
        "email": "hoang.doctor@clinic.com",
        "sdt": "0988000105",
        "hoc_vi": "BS.CKII",
        "dept_ma": "KHOA_NOI",
        "room_ma": "P102",
        "kinh_nghiem": 16,
        "mo_ta": "Chuyên khoa Nội tổng quát & Tiêu hóa, tầm soát sức khỏe định kỳ",
        "gia_kham": 200000.0,
    },
    {
        "ho_ten": "ThS. BS Đặng Hải Phương",
        "email": "phuong.doctor@clinic.com",
        "sdt": "0988000106",
        "hoc_vi": "ThS.BS",
        "dept_ma": "KHOA_NGOAI",
        "room_ma": "P201",
        "kinh_nghiem": 14,
        "mo_ta": "Bác sĩ Ngoại khoa tổng quát, chuyên tiểu phẫu bã đậu, áp xe và xử lý vết thương phần mềm",
        "gia_kham": 200000.0,
    },
    {
        "ho_ten": "BS. CKI Lê Hoàng Long",
        "email": "long.doctor@clinic.com",
        "sdt": "0988000103",
        "hoc_vi": "BS.CKI",
        "dept_ma": "KHOA_TMH",
        "room_ma": "P202",
        "kinh_nghiem": 10,
        "mo_ta": "Nội soi Tai Mũi Họng ống mềm, điều trị viêm mũi xoang và hội chứng tiền đình",
        "gia_kham": 200000.0,
    },
    {
        "ho_ten": "BS. CKII Trần Quốc Huy",
        "email": "huy.doctor@clinic.com",
        "sdt": "0988000107",
        "hoc_vi": "BS.CKII",
        "dept_ma": "KHOA_RANG",
        "room_ma": "P301",
        "kinh_nghiem": 18,
        "mo_ta": "Chuyên sâu Nha khoa tổng quát, nhổ răng khôn không đau, điều trị tủy và phục hình thẩm mỹ",
        "gia_kham": 180000.0,
    },
    {
        "ho_ten": "ThS. BS Lê Ngọc Lan",
        "email": "lan.doctor@clinic.com",
        "sdt": "0988000108",
        "hoc_vi": "ThS.BS",
        "dept_ma": "KHOA_MAT",
        "room_ma": "P302",
        "kinh_nghiem": 12,
        "mo_ta": "Chuyên khoa Mắt, khám và điều trị tật khúc xạ học đường, bệnh lý kết mạc và đáy mắt",
        "gia_kham": 180000.0,
    },
]

SPECIFIC_SERVICES = [
    {"ma": "DV_KHAM_NOI", "ten": "Khám Nội tổng quát & Tư vấn sức khỏe", "dept_ma": "KHOA_NOI", "gia": 150000.0, "dvt": "Lượt"},
    {"ma": "DV_KHAM_NGOAI", "ten": "Khám chuyên khoa Ngoại", "dept_ma": "KHOA_NGOAI", "gia": 200000.0, "dvt": "Lượt"},
    {"ma": "DV_TIEU_PHAU", "ten": "Tiểu phẫu cắt u bã đậu / trích rạch áp xe", "dept_ma": "KHOA_NGOAI", "gia": 350000.0, "dvt": "Lần"},
    {"ma": "DV_CAT_CHI", "ten": "Cắt chỉ và rửa băng vết thương", "dept_ma": "KHOA_NGOAI", "gia": 50000.0, "dvt": "Lần"},
    {"ma": "DV_KHAM_TMH", "ten": "Khám & Nội soi Tai Mũi Họng ống mềm", "dept_ma": "KHOA_TMH", "gia": 220000.0, "dvt": "Lượt"},
    {"ma": "DV_HUT_MUI", "ten": "Hút rửa mũi xoang áp lực âm", "dept_ma": "KHOA_TMH", "gia": 100000.0, "dvt": "Lần"},
    {"ma": "DV_KHAM_RANG", "ten": "Khám Răng miệng tổng quát & Nha chu", "dept_ma": "KHOA_RANG", "gia": 180000.0, "dvt": "Lượt"},
    {"ma": "DV_LAY_CAO_RANG", "ten": "Lấy cao răng & đánh bóng 2 hàm siêu âm", "dept_ma": "KHOA_RANG", "gia": 200000.0, "dvt": "Lần"},
    {"ma": "DV_TRAM_RANG", "ten": "Trám răng thẩm mỹ Composite", "dept_ma": "KHOA_RANG", "gia": 250000.0, "dvt": "Răng"},
    {"ma": "DV_NHO_RANG_8", "ten": "Nhổ răng số 8 tiểu phẫu (răng khôn)", "dept_ma": "KHOA_RANG", "gia": 800000.0, "dvt": "Răng"},
    {"ma": "DV_KHAM_MAT", "ten": "Khám Mắt & Đo thị lực tự động", "dept_ma": "KHOA_MAT", "gia": 160000.0, "dvt": "Lượt"},
    {"ma": "DV_SOI_DAY_MAT", "ten": "Soi đáy mắt trực tiếp tầm soát tổn thương", "dept_ma": "KHOA_MAT", "gia": 120000.0, "dvt": "Lần"},
    {"ma": "DV_BOM_LE_DAO", "ten": "Bơm thông rửa lệ đạo", "dept_ma": "KHOA_MAT", "gia": 150000.0, "dvt": "Lần"},
]

SAMPLE_PATIENTS = [
    {"ho_ten": "Trần Văn Bình", "sdt": "0912111001", "ngay_sinh": date(1985, 3, 10), "gioi_tinh": "Nam", "dia_chi": "Đống Đa, Hà Nội", "ma": "BN-2026-0011", "ly_do": "Đau rát họng, nuốt vướng 3 ngày nay", "dept_ma": "KHOA_TMH"},
    {"ho_ten": "Lê Thị Mai", "sdt": "0912111002", "ngay_sinh": date(1992, 7, 22), "gioi_tinh": "Nữ", "dia_chi": "Cầu Giấy, Hà Nội", "ma": "BN-2026-0012", "ly_do": "Đau nhức răng hàm dưới bên phải khi ăn", "dept_ma": "KHOA_RANG"},
    {"ho_ten": "Nguyễn Hoàng Nam", "sdt": "0912111003", "ngay_sinh": date(1978, 11, 5), "gioi_tinh": "Nam", "dia_chi": "Thanh Xuân, Hà Nội", "ma": "BN-2026-0013", "ly_do": "Mắt phải đỏ cộm, chảy nước mắt", "dept_ma": "KHOA_MAT"},
    {"ho_ten": "Vũ Thu Trang", "sdt": "0912111004", "ngay_sinh": date(1995, 4, 18), "gioi_tinh": "Nữ", "dia_chi": "Ba Đình, Hà Nội", "ma": "BN-2026-0014", "ly_do": "Té xe trầy xước phần mềm cẳng chân cần rửa & khâu", "dept_ma": "KHOA_NGOAI"},
    {"ho_ten": "Đặng Quốc Tuấn", "sdt": "0912111005", "ngay_sinh": date(1965, 8, 30), "gioi_tinh": "Nam", "dia_chi": "Hai Bà Trưng, Hà Nội", "ma": "BN-2026-0015", "ly_do": "Khám định kỳ huyết áp, mệt mỏi khi vận động", "dept_ma": "KHOA_NOI"},
    {"ho_ten": "Hoàng Thị Hạnh", "sdt": "0912111006", "ngay_sinh": date(1989, 12, 14), "gioi_tinh": "Nữ", "dia_chi": "Tây Hồ, Hà Nội", "ma": "BN-2026-0016", "ly_do": "Ù tai trái kèm chóng mặt nhẹ", "dept_ma": "KHOA_TMH"},
    {"ho_ten": "Phạm Văn Đức", "sdt": "0912111007", "ngay_sinh": date(2000, 2, 8), "gioi_tinh": "Nam", "dia_chi": "Hà Đông, Hà Nội", "ma": "BN-2026-0017", "ly_do": "Mọc răng khôn hàm dưới sưng đau góc hàm", "dept_ma": "KHOA_RANG"},
    {"ho_ten": "Nguyễn Bích Ngọc", "sdt": "0912111008", "ngay_sinh": date(1997, 9, 25), "gioi_tinh": "Nữ", "dia_chi": "Hoàng Mai, Hà Nội", "ma": "BN-2026-0018", "ly_do": "Nhìn mờ khi làm việc máy tính, đo tật khúc xạ", "dept_ma": "KHOA_MAT"},
]


async def seed_clinic_5_departments():
    """Chuẩn hóa dữ liệu toàn diện: 5 chuyên khoa chuẩn, buồng khám, bác sĩ thật, ca trực, dịch vụ và hàng đợi"""
    print("🚀 [SEED 5 KHOA] Bắt đầu chuẩn hóa dữ liệu CSDL...")

    async with AsyncSessionLocal() as session:
        # 1. Chuẩn hóa 5 Chuyên khoa
        print("📌 1. Cập nhật 5 chuyên khoa chuẩn...")
        valid_mas = [d["ma"] for d in DEPARTMENTS_DATA]
        stmt_old = select(ChuyenKhoa).where(~ChuyenKhoa.ma_chuyen_khoa.in_(valid_mas))
        old_depts = (await session.execute(stmt_old)).scalars().all()
        for od in old_depts:
            od.is_active = False
        await session.flush()

        dept_map = {}
        for d in DEPARTMENTS_DATA:
            stmt = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == d["ma"])
            existing_ck = (await session.execute(stmt)).scalar_one_or_none()
            if existing_ck:
                existing_ck.ten_chuyen_khoa = d["ten"]
                existing_ck.mo_ta = d["mo_ta"]
                existing_ck.vi_tri_phong = d["vi_tri"]
                existing_ck.is_active = True
                dept_map[d["ma"]] = existing_ck
            else:
                new_ck = ChuyenKhoa(
                    ma_chuyen_khoa=d["ma"],
                    ten_chuyen_khoa=d["ten"],
                    mo_ta=d["mo_ta"],
                    vi_tri_phong=d["vi_tri"],
                    is_active=True,
                )
                session.add(new_ck)
                await session.flush()
                dept_map[d["ma"]] = new_ck

        # 2. Chuẩn hóa Buồng khám (phong_kham)
        print("📌 2. Cập nhật danh mục buồng khám...")
        room_map = {}
        for r in ROOMS_DATA:
            stmt = select(PhongKham).where(PhongKham.ma_phong == r["ma"])
            existing_room = (await session.execute(stmt)).scalar_one_or_none()
            dept_id = dept_map[r["dept_ma"]].id if r["dept_ma"] else None
            if existing_room:
                existing_room.ten_phong = r["ten"]
                existing_room.chuyen_khoa_id = dept_id
                existing_room.tang = r["tang"]
                existing_room.loai_phong = r["loai"]
                existing_room.is_active = True
                room_map[r["ma"]] = existing_room
            else:
                new_room = PhongKham(
                    ma_phong=r["ma"],
                    ten_phong=r["ten"],
                    chuyen_khoa_id=dept_id,
                    tang=r["tang"],
                    loai_phong=r["loai"],
                    is_active=True,
                )
                session.add(new_room)
                await session.flush()
                room_map[r["ma"]] = new_room

        # 3. Chuẩn hóa Đội ngũ Bác sĩ cho cả 5 khoa
        print("📌 3. Cập nhật tài khoản & hồ sơ bác sĩ cho 5 chuyên khoa...")
        doctor_objs = []
        for doc in DOCTORS_DATA:
            stmt_nd = select(NguoiDung).where(NguoiDung.email == doc["email"])
            nd = (await session.execute(stmt_nd)).scalar_one_or_none()
            if not nd:
                nd = NguoiDung(
                    ho_ten=doc["ho_ten"],
                    email=doc["email"],
                    so_dien_thoai=doc["sdt"],
                    ngay_sinh=date(1982, 6, 15),
                    gioi_tinh="Nam" if any(w in doc["ho_ten"] for w in ["Minh", "Hoàng", "Phương", "Long", "Huy"]) else "Nữ",
                    dia_chi="Hà Nội",
                )
                session.add(nd)
                await session.flush()

            stmt_tk = select(TaiKhoan).where(TaiKhoan.nguoi_dung_id == nd.id)
            tk = (await session.execute(stmt_tk)).scalar_one_or_none()
            if not tk:
                tk = TaiKhoan(
                    nguoi_dung_id=nd.id,
                    email=doc["email"],
                    mat_khau_hash=hash_password("Doctor@123456"),
                    vai_tro=VaiTroEnum.BAC_SI.value,
                    is_active=True,
                )
                session.add(tk)
                await session.flush()

            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == nd.id)
            bs = (await session.execute(stmt_bs)).scalar_one_or_none()
            dept_id = dept_map[doc["dept_ma"]].id
            room_id = room_map[doc["room_ma"]].id if doc["room_ma"] in room_map else None

            if bs:
                bs.chuyen_khoa_id = dept_id
                bs.phong_kham_id = room_id
                bs.hoc_vi = doc["hoc_vi"]
                bs.nam_kinh_nghiem = doc["kinh_nghiem"]
                bs.mo_ta_chuyen_sau = doc["mo_ta"]
                bs.gia_kham_mac_dinh = doc["gia_kham"]
                bs.is_active = True
            else:
                bs = BacSi(
                    nguoi_dung_id=nd.id,
                    chuyen_khoa_id=dept_id,
                    phong_kham_id=room_id,
                    hoc_vi=doc["hoc_vi"],
                    chung_chi_hanh_nghe=f"CCHN-{doc['sdt']}",
                    nam_kinh_nghiem=doc["kinh_nghiem"],
                    mo_ta_chuyen_sau=doc["mo_ta"],
                    gia_kham_mac_dinh=doc["gia_kham"],
                    is_active=True,
                )
                session.add(bs)
                await session.flush()

            doctor_objs.append((bs, doc))

        # 4. Chuẩn hóa Ca làm việc (lich_lam_viec) trong 14 ngày
        print("📌 4. Khởi tạo ca trực cho các bác sĩ trong 14 ngày...")
        today = date.today()
        for i in range(14):
            work_date = today + timedelta(days=i)
            for bs, doc in doctor_objs:
                stmt_s = select(LichLamViec).where(
                    LichLamViec.bac_si_id == bs.id,
                    LichLamViec.ngay_lam_viec == work_date,
                    LichLamViec.ca_lam_viec == CaLamViecEnum.SANG.value
                )
                if not (await session.execute(stmt_s)).scalar_one_or_none():
                    session.add(
                        LichLamViec(
                            bac_si_id=bs.id,
                            phong_kham_id=bs.phong_kham_id,
                            ngay_lam_viec=work_date,
                            ca_lam_viec=CaLamViecEnum.SANG.value,
                            gio_bat_dau=time(7, 30),
                            gio_ket_thuc=time(11, 30),
                            gioi_han_ca_kham=15,
                            is_active=True,
                        )
                    )

                stmt_c = select(LichLamViec).where(
                    LichLamViec.bac_si_id == bs.id,
                    LichLamViec.ngay_lam_viec == work_date,
                    LichLamViec.ca_lam_viec == CaLamViecEnum.CHIEU.value
                )
                if not (await session.execute(stmt_c)).scalar_one_or_none():
                    session.add(
                        LichLamViec(
                            bac_si_id=bs.id,
                            phong_kham_id=bs.phong_kham_id,
                            ngay_lam_viec=work_date,
                            ca_lam_viec=CaLamViecEnum.CHIEU.value,
                            gio_bat_dau=time(13, 30),
                            gio_ket_thuc=time(17, 0),
                            gioi_han_ca_kham=12,
                            is_active=True,
                        )
                    )
        await session.flush()

        # 5. Dịch vụ kỹ thuật & Khám theo 5 chuyên khoa
        print("📌 5. Cập nhật dịch vụ chuyên khoa vào danh mục CSDL...")
        for s in SPECIFIC_SERVICES:
            stmt_dv = select(DichVu).where(DichVu.ma_dich_vu == s["ma"])
            existing_dv = (await session.execute(stmt_dv)).scalar_one_or_none()
            ck_id = dept_map[s["dept_ma"]].id
            if existing_dv:
                existing_dv.ten_dich_vu = s["ten"]
                existing_dv.don_gia = s["gia"]
                existing_dv.don_vi_tinh = s["dvt"]
                existing_dv.chuyen_khoa_id = ck_id
                existing_dv.is_active = True
            else:
                new_dv = DichVu(
                    ma_dich_vu=s["ma"],
                    ten_dich_vu=s["ten"],
                    don_gia=s["gia"],
                    don_vi_tinh=s["dvt"],
                    chuyen_khoa_id=ck_id,
                    is_active=True,
                )
                session.add(new_dv)
        await session.flush()

        # 6. Seed Bệnh nhân & Hàng đợi hôm nay (Queue Tickets)
        print("📌 6. Khởi tạo dữ liệu tiếp đón & hàng đợi thực tế hôm nay...")
        stt_counter = 1
        queue_statuses = [
            TrangThaiHangDoiEnum.DANG_KHAM.value,
            TrangThaiHangDoiEnum.CHO_KHAM.value,
            TrangThaiHangDoiEnum.CHO_KHAM.value,
            TrangThaiHangDoiEnum.DA_KHAM.value,
            TrangThaiHangDoiEnum.CHO_KHAM.value,
            TrangThaiHangDoiEnum.DANG_KHAM.value,
            TrangThaiHangDoiEnum.CHO_KHAM.value,
            TrangThaiHangDoiEnum.DA_KHAM.value,
        ]

        stmt_lt = select(TaiKhoan).where(TaiKhoan.email == "letan@clinic.com")
        tk_letan = (await session.execute(stmt_lt)).scalar_one_or_none()
        letan_id = tk_letan.id if tk_letan else None

        for idx, p in enumerate(SAMPLE_PATIENTS):
            stmt_p = select(NguoiDung).where(NguoiDung.so_dien_thoai == p["sdt"])
            nd_p = (await session.execute(stmt_p)).scalar_one_or_none()
            if not nd_p:
                nd_p = NguoiDung(
                    ho_ten=p["ho_ten"],
                    email=f"patient_{p['sdt']}@example.com",
                    so_dien_thoai=p["sdt"],
                    ngay_sinh=p["ngay_sinh"],
                    gioi_tinh=p["gioi_tinh"],
                    dia_chi=p["dia_chi"],
                )
                session.add(nd_p)
                await session.flush()

            stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == nd_p.id)
            bn = (await session.execute(stmt_bn)).scalar_one_or_none()
            if not bn:
                bn = BenhNhan(
                    nguoi_dung_id=nd_p.id,
                    ma_dinh_danh_y_te=p["ma"],
                    nhom_mau="O+",
                    diem_tin_nhiem=100,
                    so_lan_no_show=0,
                )
                session.add(bn)
                await session.flush()

            target_ck_id = dept_map[p["dept_ma"]].id
            doc_target = next((bs for bs, d in doctor_objs if bs.chuyen_khoa_id == target_ck_id), doctor_objs[0][0])
            room_target_id = doc_target.phong_kham_id

            stmt_lk = select(LichKham).where(
                LichKham.benh_nhan_id == bn.id,
                LichKham.ngay_kham == today
            )
            lk = (await session.execute(stmt_lk)).scalar_one_or_none()
            if not lk:
                lk = LichKham(
                    ma_lich_kham=f"LK-{today.strftime('%Y%m%d')}-{stt_counter:04d}",
                    benh_nhan_id=bn.id,
                    bac_si_id=doc_target.id,
                    ngay_kham=today,
                    gio_kham=time(8 + (idx // 2), 30 if (idx % 2 == 1) else 0),
                    so_thu_tu=stt_counter,
                    ly_do_kham=p["ly_do"],
                    trieu_chung_ban_dau=p["ly_do"],
                    trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
                    is_reconfirmed_24h=True,
                )
                session.add(lk)
                await session.flush()

            stmt_hd = select(HangDoiKham).where(
                HangDoiKham.benh_nhan_id == bn.id,
                HangDoiKham.ngay_kham == today
            )
            hd = (await session.execute(stmt_hd)).scalar_one_or_none()
            q_status = queue_statuses[idx % len(queue_statuses)]
            if not hd:
                hd = HangDoiKham(
                    benh_nhan_id=bn.id,
                    bac_si_id=doc_target.id,
                    phong_kham_id=room_target_id,
                    lich_kham_id=lk.id,
                    ngay_kham=today,
                    ca_kham=CaLamViecEnum.SANG.value,
                    so_thu_tu_kham=stt_counter,
                    loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
                    muc_do_uu_tien=1 if idx == 0 else 2,
                    trang_thai=q_status,
                    nguoi_tiep_nhan_id=letan_id,
                    thoi_gian_check_in=datetime.now(timezone.utc) - timedelta(minutes=60 - (idx * 5)),
                    ghi_chu_dieu_phoi=p["ly_do"],
                )
                session.add(hd)
            else:
                hd.trang_thai = q_status
                hd.phong_kham_id = room_target_id
                hd.bac_si_id = doc_target.id

            stt_counter += 1

        await session.commit()
        print("✅ [SEED 5 KHOA HOÀN TẤT] CSDL đã sẵn sàng với 5 chuyên khoa, 8 buồng khám, 6 bác sĩ và hàng đợi thực tế!")


if __name__ == "__main__":
    asyncio.run(seed_clinic_5_departments())
