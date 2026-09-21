import asyncio
from datetime import date, time, datetime, timedelta, timezone
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import ChuyenKhoa, NguoiDung, TaiKhoan, BenhNhan, BacSi, VaiTroEnum
from app.models.appointment import LichLamViec, LichKham, CaLamViecEnum, TrangThaiLichEnum
from app.models.medical import TuKhoaCapCuu, DichVu, KhaiNiem, LuotKham, ChanDoan, DonThuoc, ChiTietDonThuoc


async def seed_database():
    """Khởi tạo tập dữ liệu ban đầu cho toàn bộ 18 bảng CSDL PostgreSQL phòng khám theo chuẩn OpenMRS"""
    print("🌱 [SEEDING] Đang kết nối PostgreSQL và khởi tạo dữ liệu mẫu...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Kiểm tra nếu đã có dữ liệu thì không seed đè
        stmt_check = select(ChuyenKhoa)
        existing = (await session.execute(stmt_check)).first()
        if existing:
            print("⚠️ [SEEDING] CSDL đã có dữ liệu từ trước. Bỏ qua bước seed!")
            return

        # 2. Seed Danh mục Chuyên khoa (OpenMRS Department)
        chuyen_khoas = [
            ChuyenKhoa(ma_chuyen_khoa="KHOA_NOI", ten_chuyen_khoa="Nội tổng quát", mo_ta="Khám và điều trị các bệnh lý nội khoa tổng hợp", vi_tri_phong="Phòng 101 - Tầng 1"),
            ChuyenKhoa(ma_chuyen_khoa="KHOA_TIM_MACH", ten_chuyen_khoa="Tim mạch", mo_ta="Chuyên sâu bệnh lý tim, mạch máu và tăng huyết áp", vi_tri_phong="Phòng 201 - Tầng 2"),
            ChuyenKhoa(ma_chuyen_khoa="KHOA_TIEU_HOA", ten_chuyen_khoa="Tiêu hóa", mo_ta="Khám dạ dày, đại tràng, gan mật tụy", vi_tri_phong="Phòng 202 - Tầng 2"),
            ChuyenKhoa(ma_chuyen_khoa="KHOA_TMH", ten_chuyen_khoa="Tai - Mũi - Họng", mo_ta="Khám và điều trị các bệnh lý tai mũi họng và tiền đình", vi_tri_phong="Phòng 203 - Tầng 2"),
            ChuyenKhoa(ma_chuyen_khoa="KHOA_THAN_KINH", ten_chuyen_khoa="Thần kinh", mo_ta="Khám đau đầu mạn tính, mất ngủ, chóng mặt, đột quỵ", vi_tri_phong="Phòng 301 - Tầng 3"),
            ChuyenKhoa(ma_chuyen_khoa="KHOA_DA_LIEU", ten_chuyen_khoa="Da liễu", mo_ta="Điều trị dị ứng da, mẩn đỏ, mề đay, nấm da, mụn", vi_tri_phong="Phòng 302 - Tầng 3"),
            ChuyenKhoa(ma_chuyen_khoa="KHOA_HO_HAP", ten_chuyen_khoa="Hô hấp", mo_ta="Điều trị ho dai dẳng, hen phế quản, viêm phổi phế quản", vi_tri_phong="Phòng 303 - Tầng 3"),
            ChuyenKhoa(ma_chuyen_khoa="KHOA_XUONG_KHOP", ten_chuyen_khoa="Cơ xương khớp", mo_ta="Khám đau khớp gối, thoái hóa cột sống, loãng xương", vi_tri_phong="Phòng 401 - Tầng 4"),
        ]
        session.add_all(chuyen_khoas)
        await session.flush()

        # 3. Seed Từ khóa Cấp cứu Nguy hiểm (Red Flags Rules)
        tu_khoa_cap_cuu = [
            TuKhoaCapCuu(tu_khoa="đau ngực dữ dội", muc_do_nguy_hiem="rat_nguy_hiem", huong_dan_xu_tri="Nghi ngờ nhồi máu cơ tim cấp. Gọi ngay cấp cứu 115!"),
            TuKhoaCapCuu(tu_khoa="khó thở cấp", muc_do_nguy_hiem="rat_nguy_hiem", huong_dan_xu_tri="Suy hô hấp cấp tính. Hãy gọi 115 hoặc đưa đến phòng Cấp cứu ngay lập tức."),
            TuKhoaCapCuu(tu_khoa="ngất xỉu", muc_do_nguy_hiem="nguy_hiem", huong_dan_xu_tri="Mất ý thức đột ngột. Gọi cấp cứu 115 ngay lập tức!"),
            TuKhoaCapCuu(tu_khoa="co giật", muc_do_nguy_hiem="rat_nguy_hiem", huong_dan_xu_tri="Cơn co giật toàn thân. Cho bệnh nhân nằm nghiêng thông thoáng và gọi 115."),
            TuKhoaCapCuu(tu_khoa="liệt nửa người", muc_do_nguy_hiem="rat_nguy_hiem", huong_dan_xu_tri="Dấu hiệu đột quỵ não cấp (giờ vàng). Gọi 115 khẩn cấp!"),
            TuKhoaCapCuu(tu_khoa="nôn ra máu", muc_do_nguy_hiem="rat_nguy_hiem", huong_dan_xu_tri="Xuất huyết tiêu hóa cấp tính. Cần đến bệnh viện cấp cứu ngay!"),
        ]
        session.add_all(tu_khoa_cap_cuu)

        # 4. Seed Danh mục Dịch vụ Cận lâm sàng (OpenMRS Medical Service)
        dich_vus = [
            DichVu(ma_dich_vu="DV_XN_MAU", ten_dich_vu="Tổng phân tích tế bào máu ngoại vi (18 chỉ số)", don_gia=120000.00, don_vi_tinh="Lần"),
            DichVu(ma_dich_vu="DV_XQ_NGUC", ten_dich_vu="Chụp X-quang tim phổi thẳng kỹ thuật số (CR/DR)", don_gia=180000.00, don_vi_tinh="Lần"),
            DichVu(ma_dich_vu="DV_SA_BUNG", ten_dich_vu="Siêu âm ổ bụng tổng quát màu Doppler", don_gia=200000.00, don_vi_tinh="Lần"),
            DichVu(ma_dich_vu="DV_ECG", ten_dich_vu="Điện tâm đồ (ECG) 12 chuyển đạo", don_gia=100000.00, don_vi_tinh="Lần"),
            DichVu(ma_dich_vu="DV_NS_TMH", ten_dich_vu="Nội soi Tai - Mũi - Họng ống mềm", don_gia=250000.00, don_vi_tinh="Lần"),
        ]
        session.add_all(dich_vus)

        # 5. Seed Từ điển Khái niệm Y tế Chuẩn hóa ICD-10 (OpenMRS Concept Dictionary)
        khai_niems = [
            KhaiNiem(ma_khai_niem="I10", ten_khai_niem="Bệnh tăng huyết áp vô căn (nguyên phát)", loai_khai_niem="benh_icd10"),
            KhaiNiem(ma_khai_niem="K29", ten_khai_niem="Viêm dạ dày và tá tràng", loai_khai_niem="benh_icd10"),
            KhaiNiem(ma_khai_niem="H81", ten_khai_niem="Rối loạn chức năng tiền đình", loai_khai_niem="benh_icd10"),
            KhaiNiem(ma_khai_niem="J00", ten_khai_niem="Viêm mũi họng cấp (cảm thường)", loai_khai_niem="benh_icd10"),
            KhaiNiem(ma_khai_niem="M17", ten_khai_niem="Thoái hóa khớp gối", loai_khai_niem="benh_icd10"),
        ]
        session.add_all(khai_niems)

        # 6. Seed Tài khoản Quản trị viên (Admin)
        nd_admin = NguoiDung(
            ho_ten="Quản Trị Viên Hệ Thống",
            email="admin@clinic.com",
            so_dien_thoai="0988000001",
            ngay_sinh=date(1990, 1, 1),
            gioi_tinh="Nam"
        )
        session.add(nd_admin)
        await session.flush()

        tk_admin = TaiKhoan(
            nguoi_dung_id=nd_admin.id,
            email="admin@clinic.com",
            mat_khau_hash=hash_password("Admin@123456"),
            vai_tro=VaiTroEnum.ADMIN.value,
            is_active=True
        )
        session.add(tk_admin)

        # 7. Seed Bác sĩ chuyên khoa mẫu (OpenMRS Providers)
        bac_si_samples = [
            ("BS. CKI Nguyễn Văn An", "an.doctor@clinic.com", "0988000101", "BSCKI", chuyen_khoas[1].id, 8, "Chuyên sâu tăng huyết áp và bệnh mạch vành", 250000.00),
            ("ThS. BS Trần Thị Bích", "bich.doctor@clinic.com", "0988000102", "ThS.BS", chuyen_khoas[2].id, 10, "Chuyên điều trị dạ dày, đại tràng và trào ngược dạ dày thực quản", 200000.00),
            ("BS. Lê Hoàng Long", "long.doctor@clinic.com", "0988000103", "BS", chuyen_khoas[3].id, 6, "Nội soi TMH và điều trị hội chứng tiền đình", 200000.00),
            ("PGS.TS Phạm Đức Minh", "minh.doctor@clinic.com", "0988000104", "PGS.TS", chuyen_khoas[0].id, 20, "Trưởng khoa Nội tổng hợp - chuyên gia chẩn đoán bệnh lý mạn tính", 300000.00),
        ]

        created_doctors = []
        for name, email, phone, title, ck_id, exp_years, desc, price in bac_si_samples:
            nd = NguoiDung(ho_ten=name, email=email, so_dien_thoai=phone, ngay_sinh=date(1985, 5, 20), gioi_tinh="Nam")
            session.add(nd)
            await session.flush()

            tk = TaiKhoan(
                nguoi_dung_id=nd.id,
                email=email,
                mat_khau_hash=hash_password("Doctor@123456"),
                vai_tro=VaiTroEnum.BAC_SI.value,
                is_active=True
            )
            session.add(tk)

            bs = BacSi(
                nguoi_dung_id=nd.id,
                chuyen_khoa_id=ck_id,
                hoc_vi=title,
                chung_chi_hanh_nghe=f"CCHN-{phone}",
                nam_kinh_nghiem=exp_years,
                mo_ta_chuyen_sau=desc,
                gia_kham_mac_dinh=price,
                is_active=True
            )
            session.add(bs)
            await session.flush()
            created_doctors.append(bs)

        # 8. Seed Lịch làm việc 14 ngày cho các Bác sĩ (OpenMRS Appointment Blocks)
        today = date.today()
        for i in range(14):
            work_date = today + timedelta(days=i)
            for bs in created_doctors:
                # Ca sáng: 07:30 - 11:30 (8 slots 30p)
                session.add(
                    LichLamViec(
                        bac_si_id=bs.id,
                        ngay_lam_viec=work_date,
                        ca_lam_viec=CaLamViecEnum.SANG.value,
                        gio_bat_dau=time(7, 30),
                        gio_ket_thuc=time(11, 30),
                        gioi_han_ca_kham=8,
                        is_active=True
                    )
                )
                # Ca chiều: 13:30 - 17:00 (7 slots 30p)
                session.add(
                    LichLamViec(
                        bac_si_id=bs.id,
                        ngay_lam_viec=work_date,
                        ca_lam_viec=CaLamViecEnum.CHIEU.value,
                        gio_bat_dau=time(13, 30),
                        gio_ket_thuc=time(17, 0),
                        gioi_han_ca_kham=7,
                        is_active=True
                    )
                )

        # 9. Seed Bệnh nhân mẫu sẵn sàng test (OpenMRS Patient)
        nd_patient = NguoiDung(
            ho_ten="Nguyễn Thị Bệnh Nhân",
            email="patient@test.com",
            so_dien_thoai="0912345678",
            ngay_sinh=date(1998, 10, 15),
            gioi_tinh="Nữ",
            dia_chi="Cầu Giấy, Hà Nội"
        )
        session.add(nd_patient)
        await session.flush()

        tk_patient = TaiKhoan(
            nguoi_dung_id=nd_patient.id,
            email="patient@test.com",
            mat_khau_hash=hash_password("Patient@123456"),
            vai_tro=VaiTroEnum.BENH_NHAN.value,
            is_active=True
        )
        session.add(tk_patient)

        bn_profile = BenhNhan(
            nguoi_dung_id=nd_patient.id,
            ma_dinh_danh_y_te="BN-2026-0001",
            nhom_mau="O+",
            tien_su_benh="Viêm dạ dày nhẹ",
            di_ung_thuoc="Dị ứng Penicillin",
            diem_tin_nhiem=100,
            so_lan_no_show=0
        )
        session.add(bn_profile)
        await session.flush()

        # 10. Seed 1 Lịch khám & Phiên khám mẫu hoàn chỉnh (OpenMRS Encounter + Diagnosis + Prescription)
        lich_mau = LichKham(
            ma_lich_kham="LK-20260918-01001",
            benh_nhan_id=bn_profile.id,
            bac_si_id=created_doctors[0].id,
            ngay_kham=today - timedelta(days=2),
            gio_kham=time(8, 30),
            so_thu_tu=1,
            ly_do_kham="Hồi hộp, tức ngực trái khi gắng sức",
            trieu_chung_ban_dau="Thỉnh thoảng đau nhói ngực trái, hồi hộp",
            trang_thai=TrangThaiLichEnum.DA_KHAM.value,
            is_reconfirmed_24h=True
        )
        session.add(lich_mau)
        await session.flush()

        # Phiên khám thực tế (Encounter)
        luot_kham_mau = LuotKham(
            lich_kham_id=lich_mau.id,
            bac_si_id=created_doctors[0].id,
            benh_nhan_id=bn_profile.id,
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
            thoi_gian_khoa=datetime.now(timezone.utc) - timedelta(days=2, hours=2, minutes=30)
        )
        session.add(luot_kham_mau)
        await session.flush()

        # Chẩn đoán ICD-10 gắn vào phiên khám
        chan_doan_mau = ChanDoan(
            luot_kham_id=luot_kham_mau.id,
            khai_niem_id=khai_niems[0].id,
            ma_icd10="I10",
            ten_benh_chan_doan="Bệnh tăng huyết áp vô căn (nguyên phát)",
            loai_chan_doan="chinh"
        )
        session.add(chan_doan_mau)

        # Đơn thuốc mẫu kèm chi tiết
        don_thuoc_mau = DonThuoc(
            luot_kham_id=luot_kham_mau.id,
            bac_si_ke_don_id=created_doctors[0].id,
            ngay_ke_don=datetime.now(timezone.utc) - timedelta(days=2, hours=2, minutes=35),
            loi_dan_uong_thuoc="Uống thuốc đều đặn vào buổi sáng sau ăn no"
        )
        session.add(don_thuoc_mau)
        await session.flush()

        thuoc_1 = ChiTietDonThuoc(
            don_thuoc_id=don_thuoc_mau.id,
            ten_thuoc="Amlodipine 5mg",
            hoat_chat="Amlodipine besylate",
            ham_luong="5mg",
            don_vi_tinh="Viên",
            so_luong=14,
            cach_dung="Sáng 1 viên sau ăn",
            so_ngay_dung=14
        )
        session.add(thuoc_1)

        await session.commit()
        print("✅ [SEEDING COMPLETED] Đã khởi tạo thành công trọn vẹn 18 bảng CSDL chuẩn OpenMRS:")
        print("   - 8 Chuyên khoa + 6 Từ khóa Red Flags + 5 Dịch vụ + 5 Khái niệm ICD-10")
        print("   - 4 Bác sĩ chuyên khoa + Lịch trực 14 ngày (sáng/chiều)")
        print("   - 1 Ca khám mẫu + Đơn thuốc + Chẩn đoán ICD-10 (Read-only)")
        print("   - Tài khoản Admin:      admin@clinic.com   / Admin@123456")
        print("   - Tài khoản Bác sĩ:     an.doctor@clinic.com / Doctor@123456")
        print("   - Tài khoản Bệnh nhân:  patient@test.com   / Patient@123456")


if __name__ == "__main__":
    asyncio.run(seed_database())
