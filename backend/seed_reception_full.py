import asyncio
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select, and_, delete
from sqlalchemy.orm import selectinload
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
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
    HangDoiKham,
    DanhSachCho,
    NghiPhepBacSi,
    LichDinhKyBacSi,
    CaLamViecEnum,
    TrangThaiLichEnum,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiWaitlistEnum,
    LoaiNghiPhepEnum,
    TrangThaiNghiPhepEnum,
)
from app.models.specialized import (
    GoiKham,
    GoiKhamDaMua,
    ChiTietGoiKhamDaMua,
)
from app.models.medical import DichVu


async def seed_reception_data():
    async with AsyncSessionLocal() as session:
        print("--> Bắt đầu nạp dữ liệu kiểm thử nghiệp vụ Lễ tân...")

        # 1. Lấy thông tin Chuyên khoa, Phòng khám, Bác sĩ đã có
        stmt_ck = select(ChuyenKhoa)
        chuyen_khoas = {ck.ma_chuyen_khoa: ck for ck in (await session.execute(stmt_ck)).scalars().all()}

        stmt_pk = select(PhongKham)
        phong_khams = {pk.ma_phong: pk for pk in (await session.execute(stmt_pk)).scalars().all()}

        stmt_bs = select(BacSi).options(selectinload(BacSi.nguoi_dung))
        bac_si_list = (await session.execute(stmt_bs)).scalars().all()
        bac_sis = {bs.nguoi_dung.ho_ten: bs for bs in bac_si_list if bs.nguoi_dung}

        # Map tên bác sĩ tiện dụng
        bs_minh = next((bs for name, bs in bac_sis.items() if "Phạm Đức Minh" in name), None)
        bs_hoang = next((bs for name, bs in bac_sis.items() if "Nguyễn Minh Hoàng" in name), None)
        bs_phuong = next((bs for name, bs in bac_sis.items() if "Đặng Hải Phương" in name), None)
        bs_long = next((bs for name, bs in bac_sis.items() if "Lê Hoàng Long" in name), None)
        bs_huy = next((bs for name, bs in bac_sis.items() if "Trần Quốc Huy" in name), None)
        bs_lan = next((bs for name, bs in bac_sis.items() if "Lê Ngọc Lan" in name), None)

        # Lấy tài khoản Lễ tân đang trực
        stmt_letan = select(TaiKhoan).where(TaiKhoan.vai_tro == VaiTroEnum.LE_TAN.value)
        le_tan_account = (await session.execute(stmt_letan)).scalars().first()
        le_tan_id = le_tan_account.id if le_tan_account else None

        stmt_admin = select(TaiKhoan).where(TaiKhoan.vai_tro == VaiTroEnum.ADMIN.value)
        admin_account = (await session.execute(stmt_admin)).scalars().first()
        admin_id = admin_account.id if admin_account else None

        # 2. Tạo danh sách 13 bệnh nhân mẫu với đa dạng kịch bản
        patients_raw = [
            {
                "email": "an.tran@example.com",
                "ho_ten": "Trần Văn An",
                "sdt": "0912000001",
                "gioi_tinh": "Nam",
                "ngay_sinh": date(1980, 5, 10),
                "cccd": "001080001234",
                "nhom_mau": "A+",
                "tien_su": "Viêm loét dạ dày tá tràng",
                "di_ung": "Dị ứng Penicillin (Phản ứng phát ban nặng)",
                "diem_tin_nhiem": 95,
                "so_lan_no_show": 0,
                "is_blocked": False,
            },
            {
                "email": "mai.le@example.com",
                "ho_ten": "Lê Thị Mai",
                "sdt": "0912000002",
                "gioi_tinh": "Nữ",
                "ngay_sinh": date(1992, 8, 20),
                "cccd": "001092005678",
                "nhom_mau": "B+",
                "tien_su": "Khỏe mạnh",
                "di_ung": "Không có",
                "diem_tin_nhiem": 30,
                "so_lan_no_show": 2,
                "is_blocked": True, # Test khóa đặt online do No-Show
            },
            {
                "email": "hung.pham@example.com",
                "ho_ten": "Phạm Văn Hùng (82 tuổi)",
                "sdt": "0912000003",
                "gioi_tinh": "Nam",
                "ngay_sinh": date(1944, 3, 12),
                "cccd": "001044009999",
                "nhom_mau": "O+",
                "tien_su": "Tăng huyết áp vô căn, Đái tháo đường type 2",
                "di_ung": "Không có",
                "diem_tin_nhiem": 100,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Ưu tiên người già
            },
            {
                "email": "tri.hoang@example.com",
                "ho_ten": "Hoàng Minh Trí",
                "sdt": "0912000004",
                "gioi_tinh": "Nam",
                "ngay_sinh": date(1988, 11, 5),
                "cccd": "001088001122",
                "nhom_mau": "AB+",
                "tien_su": "Thoát vị đĩa đệm L4-L5",
                "di_ung": "Dị ứng Aspirin",
                "diem_tin_nhiem": 90,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Chờ lâu >30p
            },
            {
                "email": "thao.vu@example.com",
                "ho_ten": "Vũ Thị Thảo",
                "sdt": "0912000005",
                "gioi_tinh": "Nữ",
                "ngay_sinh": date(1995, 2, 14),
                "cccd": "001095003344",
                "nhom_mau": "O+",
                "tien_su": "Đau nửa đầu Migraine",
                "di_ung": "Không có",
                "diem_tin_nhiem": 100,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Khách vãng lai
            },
            {
                "email": "kiet.dang@example.com",
                "ho_ten": "Đặng Tuấn Kiệt",
                "sdt": "0912000006",
                "gioi_tinh": "Nam",
                "ngay_sinh": date(1985, 7, 22),
                "cccd": "001085007788",
                "nhom_mau": "A+",
                "tien_su": "Viêm xoang sàng mạn tính",
                "di_ung": "Không có",
                "diem_tin_nhiem": 85,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Tạm hoãn -> Tiếp nhận lại
            },
            {
                "email": "huong.bui@example.com",
                "ho_ten": "Bùi Lan Hương",
                "sdt": "0912000007",
                "gioi_tinh": "Nữ",
                "ngay_sinh": date(1990, 12, 1),
                "cccd": "001090008899",
                "nhom_mau": "B+",
                "tien_su": "Viêm dạ dày Hp (+)",
                "di_ung": "Không có",
                "diem_tin_nhiem": 100,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Đang khám
            },
            {
                "email": "huy.ngo@example.com",
                "ho_ten": "Ngô Quang Huy",
                "sdt": "0912000008",
                "gioi_tinh": "Nam",
                "ngay_sinh": date(1993, 4, 18),
                "cccd": "001093001255",
                "nhom_mau": "O+",
                "tien_su": "Khỏe mạnh",
                "di_ung": "Không có",
                "diem_tin_nhiem": 95,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Đang khám ngoại khoa
            },
            {
                "email": "linh.do@example.com",
                "ho_ten": "Đỗ Mỹ Linh",
                "sdt": "0912000009",
                "gioi_tinh": "Nữ",
                "ngay_sinh": date(1997, 9, 25),
                "cccd": "001097004466",
                "nhom_mau": "AB+",
                "tien_su": "Viêm mũi dị ứng thời tiết",
                "di_ung": "Dị ứng phấn hoa",
                "diem_tin_nhiem": 80,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Bỏ về
            },
            {
                "email": "trong.duong@example.com",
                "ho_ten": "Dương Đình Trọng",
                "sdt": "0912000010",
                "gioi_tinh": "Nam",
                "ngay_sinh": date(2000, 1, 30),
                "cccd": "001200002233",
                "nhom_mau": "O+",
                "tien_su": "Chấn thương sụn chêm gối phải",
                "di_ung": "Không có",
                "diem_tin_nhiem": 100,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Waitlist
            },
            {
                "email": "chau.nguyen@example.com",
                "ho_ten": "Nguyễn Bảo Châu",
                "sdt": "0912000011",
                "gioi_tinh": "Nữ",
                "ngay_sinh": date(1989, 6, 15),
                "cccd": "001089006677",
                "nhom_mau": "A+",
                "tien_su": "Rối loạn tiền đình",
                "di_ung": "Không có",
                "diem_tin_nhiem": 100,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Sắp đến / Cân bằng tải theo khoa
            },
            {
                "email": "trang.trinh@example.com",
                "ho_ten": "Trịnh Thu Trang",
                "sdt": "0912000012",
                "gioi_tinh": "Nữ",
                "ngay_sinh": date(1991, 10, 10),
                "cccd": "001091008822",
                "nhom_mau": "B+",
                "tien_su": "Khỏe mạnh",
                "di_ung": "Không có",
                "diem_tin_nhiem": 90,
                "so_lan_no_show": 0,
                "is_blocked": False, # Test Chờ xác nhận
            },
            {
                "email": "duc.phan@example.com",
                "ho_ten": "Phan Văn Đức",
                "sdt": "0912000013",
                "gioi_tinh": "Nam",
                "ngay_sinh": date(1987, 12, 12),
                "cccd": "001087009911",
                "nhom_mau": "O+",
                "tien_su": "Gout mạn tính",
                "di_ung": "Không có",
                "diem_tin_nhiem": 50,
                "so_lan_no_show": 1,
                "is_blocked": False, # Test No-Show hôm nay
            },
        ]

        patient_map = {}
        for p in patients_raw:
            stmt_user = select(NguoiDung).where(NguoiDung.email == p["email"])
            user = (await session.execute(stmt_user)).scalar_one_or_none()
            if not user:
                user = NguoiDung(
                    ho_ten=p["ho_ten"],
                    email=p["email"],
                    so_dien_thoai=p["sdt"],
                    ngay_sinh=p["ngay_sinh"],
                    gioi_tinh=p["gioi_tinh"],
                    cccd_so=p["cccd"],
                    dia_chi="Hà Nội",
                )
                session.add(user)
                await session.flush()

            stmt_acc = select(TaiKhoan).where(TaiKhoan.email == p["email"])
            acc = (await session.execute(stmt_acc)).scalar_one_or_none()
            if not acc:
                acc = TaiKhoan(
                    nguoi_dung_id=user.id,
                    email=p["email"],
                    mat_khau_hash=hash_password("Patient@123456"),
                    vai_tro=VaiTroEnum.BENH_NHAN.value,
                    is_active=True,
                )
                session.add(acc)
                await session.flush()

            stmt_pt = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.id)
            patient = (await session.execute(stmt_pt)).scalar_one_or_none()
            if not patient:
                patient = BenhNhan(
                    nguoi_dung_id=user.id,
                    ma_dinh_danh_y_te=f"BN-{user.id:04d}",
                    nhom_mau=p["nhom_mau"],
                    tien_su_benh=p["tien_su"],
                    di_ung_thuoc=p["di_ung"],
                    diem_tin_nhiem=p["diem_tin_nhiem"],
                    so_lan_no_show=p["so_lan_no_show"],
                    is_blocked_booking=p["is_blocked"],
                )
                session.add(patient)
                await session.flush()
            else:
                # Cập nhật thông tin để test đúng kịch bản
                patient.nhom_mau = p["nhom_mau"]
                patient.tien_su_benh = p["tien_su"]
                patient.di_ung_thuoc = p["di_ung"]
                patient.diem_tin_nhiem = p["diem_tin_nhiem"]
                patient.so_lan_no_show = p["so_lan_no_show"]
                patient.is_blocked_booking = p["is_blocked"]

            patient_map[p["email"]] = patient

        await session.flush()
        print(f"--> Đã kiểm tra/tạo {len(patient_map)} hồ sơ bệnh nhân kiểm thử.")

        # 3. Gán Gói khám còn hạn cho Bệnh nhân Trần Văn An (an.tran@example.com)
        an_patient = patient_map.get("an.tran@example.com")
        if an_patient:
            stmt_pkg_exist = select(GoiKhamDaMua).where(GoiKhamDaMua.benh_nhan_id == an_patient.id)
            existing_pkg = (await session.execute(stmt_pkg_exist)).scalar_one_or_none()
            if not existing_pkg:
                stmt_pkg_master = select(GoiKham).where(GoiKham.id == 1)
                pkg_master = (await session.execute(stmt_pkg_master)).scalar_one_or_none()
                if pkg_master:
                    bought_pkg = GoiKhamDaMua(
                        ma_dang_ky="DKGK-202611-001",
                        benh_nhan_id=an_patient.id,
                        goi_kham_id=pkg_master.id,
                        ten_goi_snapshot=pkg_master.ten_goi,
                        don_gia_goi_snapshot=pkg_master.don_gia_niem_yet,
                        mien_giam=Decimal("0.00"),
                        so_tien_phai_thu=pkg_master.don_gia_niem_yet,
                        trang_thai="DANG_SU_DUNG",
                        ngay_dang_ky=date(2026, 10, 1),
                        han_su_dung=date(2027, 10, 1),
                        tong_so_dich_vu=3,
                        so_dich_vu_da_dung=1,
                        ghi_chu="Gói khám sức khỏe tổng quát gia đình",
                    )
                    session.add(bought_pkg)
                    await session.flush()

                    # Chi tiết gói khám
                    stmt_svc = select(DichVu).where(DichVu.ma_dich_vu.in_(["KHAM_NOI", "XN_TPTTM", "CDHA_SA_OB"]))
                    services = (await session.execute(stmt_svc)).scalars().all()
                    for svc in services:
                        session.add(
                            ChiTietGoiKhamDaMua(
                                goi_kham_da_mua_id=bought_pkg.id,
                                dich_vu_id=svc.id,
                                ma_dich_vu_snapshot=svc.ma_dich_vu,
                                ten_dich_vu_snapshot=svc.ten_dich_vu,
                                so_luong_duoc_huong=1,
                                don_gia_tham_chieu_snapshot=svc.don_gia,
                                so_luong_da_su_dung=1 if svc.ma_dich_vu == "KHAM_NOI" else 0,
                                thanh_tien=svc.don_gia,
                                trang_thai_muc="DA_DUNG" if svc.ma_dich_vu == "KHAM_NOI" else "CHUA_DUNG",
                            )
                        )
                    print("--> Đã kích hoạt Gói khám mẫu cho bệnh nhân Trần Văn An.")

        # Ngày mục tiêu kiểm thử: Hôm nay (2026-11-05)
        today = date(2026, 11, 5)
        vn_tz = timezone(timedelta(hours=7))

        # Lấy lịch làm việc hôm nay
        stmt_llv = select(LichLamViec).where(LichLamViec.ngay_lam_viec == today)
        llv_list = (await session.execute(stmt_llv)).scalars().all()
        llv_map = {(llv.bac_si_id, llv.ca_lam_viec): llv for llv in llv_list}

        # 4. DỌN SẠCH DỮ LIỆU CỦA NGÀY HÔM NAY (Đảm bảo reset 100% sạch sẽ)
        # 4.1 Xóa Hàng đợi khám hôm nay trước (tránh vướng FK với lịch khám)
        stmt_del_queue = select(HangDoiKham).where(HangDoiKham.ngay_kham == today)
        del_queues = (await session.execute(stmt_del_queue)).scalars().all()
        for dq in del_queues:
            await session.delete(dq)
        await session.flush()

        # 4.2 Xóa tất cả Lịch hẹn khám hôm nay
        test_appointment_codes = [
            "LK-20261105-0001",
            "LK-20261105-0002",
            "LK-20261105-0003",
            "LK-20261105-0004",
            "LK-20261105-0005",
            "LK-20261105-0006",
        ]
        stmt_del_apt = select(LichKham).where(LichKham.ngay_kham == today)
        del_apts = (await session.execute(stmt_del_apt)).scalars().all()
        for da in del_apts:
            await session.delete(da)
        await session.flush()

        appointments_data = [
            {
                "code": "LK-20261105-0001",
                "patient": patient_map["chau.nguyen@example.com"],
                "doctor": None, # Test đặt theo khoa, chưa có BS -> Cân bằng tải khi check-in
                "dept": chuyen_khoas.get("NGOAI"),
                "ca": "chieu",
                "time": time(15, 30),
                "duration": 30,
                "stt": 1,
                "reason": "Đau tức hạ sườn phải âm ỉ 3 ngày nay",
                "status": TrangThaiLichEnum.DA_XAC_NHAN.value,
                "reconfirmed": True,
            },
            {
                "code": "LK-20261105-0002",
                "patient": patient_map["an.tran@example.com"],
                "doctor": bs_minh,
                "dept": chuyen_khoas.get("NOI"),
                "ca": "chieu",
                "time": time(14, 30),
                "duration": 30,
                "stt": 2,
                "reason": "Tái khám định kỳ tăng huyết áp & dạ dày",
                "status": TrangThaiLichEnum.DA_XAC_NHAN.value,
                "reconfirmed": True,
            },
            {
                "code": "LK-20261105-0003",
                "patient": patient_map["tri.hoang@example.com"],
                "doctor": bs_lan,
                "dept": chuyen_khoas.get("MAT"),
                "ca": "chieu",
                "time": time(15, 0),
                "duration": 30,
                "stt": 3,
                "reason": "Mỏi mắt, nhìn mờ khi làm việc máy tính lâu",
                "status": TrangThaiLichEnum.DA_XAC_NHAN.value,
                "reconfirmed": True,
            },
            {
                "code": "LK-20261105-0004",
                "patient": patient_map["trang.trinh@example.com"],
                "doctor": bs_huy,
                "dept": chuyen_khoas.get("RHM"),
                "ca": "chieu",
                "time": time(16, 0),
                "duration": 30,
                "stt": 4,
                "reason": "Đau nhức răng số 8 hàm dưới bên trái",
                "status": TrangThaiLichEnum.CHO_XAC_NHAN.value,
                "reconfirmed": False,
            },
            {
                "code": "LK-20261105-0005",
                "patient": patient_map["duc.phan@example.com"],
                "doctor": bs_long,
                "dept": chuyen_khoas.get("TMH"),
                "ca": "sang",
                "time": time(9, 0),
                "duration": 30,
                "stt": 5,
                "reason": "Viêm họng hạt tái phát nuốt nghẹn",
                "status": TrangThaiLichEnum.NO_SHOW.value, # Test thống kê Vắng mặt
                "reconfirmed": True,
            },
            {
                "code": "LK-20261105-0006",
                "patient": patient_map["mai.le@example.com"],
                "doctor": bs_hoang,
                "dept": chuyen_khoas.get("NOI"),
                "ca": "chieu",
                "time": time(13, 30),
                "duration": 30,
                "stt": 6,
                "reason": "Khám sức khỏe tổng quát",
                "status": TrangThaiLichEnum.DA_HUY.value,
                "reconfirmed": False,
                "ly_do_huy": "Bệnh nhân có lịch công tác đột xuất",
            },
        ]

        created_appointments = {}
        for apt in appointments_data:
            doc_id = apt["doctor"].id if apt["doctor"] else None
            dept_id = apt["dept"].id if apt["dept"] else (apt["doctor"].chuyen_khoa_id if apt["doctor"] else None)
            llv = llv_map.get((doc_id, apt["ca"])) if doc_id else None

            new_apt = LichKham(
                ma_lich_kham=apt["code"],
                benh_nhan_id=apt["patient"].id,
                bac_si_id=doc_id,
                chuyen_khoa_id=dept_id,
                lich_lam_viec_id=llv.id if llv else None,
                ca_kham=apt["ca"],
                ngay_kham=today,
                gio_kham=apt["time"],
                thoi_luong_phut=apt["duration"],
                so_thu_tu=apt["stt"],
                ly_do_kham=apt["reason"],
                trieu_chung_ban_dau=apt["reason"],
                trang_thai=apt["status"],
                is_reconfirmed_24h=apt["reconfirmed"],
                ly_do_huy=apt.get("ly_do_huy"),
                nguoi_huy_vai_tro="benh_nhan" if apt.get("ly_do_huy") else None,
            )
            session.add(new_apt)
            created_appointments[apt["code"]] = new_apt

        await session.flush()
        print(f"--> Đã tạo {len(created_appointments)} lịch hẹn hôm nay (gồm Đã xác nhận, Chờ xác nhận, No-show, Đã hủy).")

        # 5. Nạp lại Hàng đợi khám (HangDoiKham) hôm nay
        queue_tickets = [
            # Ca sáng: Tạo 4 ca hoàn tất để vẽ biểu đồ Mật độ check-in theo giờ (07:30, 08:30, 09:30, 10:30)
            {
                "patient": patient_map["an.tran@example.com"],
                "doctor": bs_minh,
                "room": phong_khams.get("P101"),
                "ca": "sang",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.DA_KHAM.value,
                "check_in": datetime(2026, 11, 5, 7, 35, tzinfo=vn_tz),
                "goi": datetime(2026, 11, 5, 7, 40, tzinfo=vn_tz),
                "ket_thuc": datetime(2026, 11, 5, 8, 5, tzinfo=vn_tz),
                "so_lan_goi": 1,
            },
            {
                "patient": patient_map["mai.le@example.com"],
                "doctor": bs_hoang,
                "room": phong_khams.get("P102"),
                "ca": "sang",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.DA_KHAM.value,
                "check_in": datetime(2026, 11, 5, 8, 20, tzinfo=vn_tz),
                "goi": datetime(2026, 11, 5, 8, 25, tzinfo=vn_tz),
                "ket_thuc": datetime(2026, 11, 5, 8, 55, tzinfo=vn_tz),
                "so_lan_goi": 1,
            },
            {
                "patient": patient_map["thao.vu@example.com"],
                "doctor": bs_phuong,
                "room": phong_khams.get("P201"),
                "ca": "sang",
                "stt": 1,
                "loai": LoaiHangDoiEnum.VANG_LAI.value,
                "priority": 5,
                "status": TrangThaiHangDoiEnum.DA_KHAM.value,
                "check_in": datetime(2026, 11, 5, 9, 15, tzinfo=vn_tz),
                "goi": datetime(2026, 11, 5, 9, 20, tzinfo=vn_tz),
                "ket_thuc": datetime(2026, 11, 5, 9, 45, tzinfo=vn_tz),
                "so_lan_goi": 1,
            },
            {
                "patient": patient_map["kiet.dang@example.com"],
                "doctor": bs_long,
                "room": phong_khams.get("P202"),
                "ca": "sang",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.DA_KHAM.value,
                "check_in": datetime(2026, 11, 5, 10, 25, tzinfo=vn_tz),
                "goi": datetime(2026, 11, 5, 10, 30, tzinfo=vn_tz),
                "ket_thuc": datetime(2026, 11, 5, 11, 0, tzinfo=vn_tz),
                "so_lan_goi": 1,
            },

            # Ca chiều: Trực tiếp phục vụ màn hình Quản lý Hàng đợi & Dashboard hiện tại
            # 1. P101 - PGS.TS Phạm Đức Minh (Sẽ bị sự cố đột xuất để test Rebalance)
            {
                "patient": patient_map["tri.hoang@example.com"],
                "doctor": bs_minh,
                "room": phong_khams.get("P101"),
                "ca": "chieu",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.CHO_KHAM.value,
                # Check-in từ 13:10 -> Đã chờ > 45 phút -> Test cảnh báo Bệnh nhân chờ lâu (>30P)
                "check_in": datetime(2026, 11, 5, 13, 10, tzinfo=vn_tz),
                "so_lan_goi": 0,
            },
            {
                "patient": patient_map["thao.vu@example.com"],
                "doctor": bs_minh,
                "room": phong_khams.get("P101"),
                "ca": "chieu",
                "stt": 2,
                "loai": LoaiHangDoiEnum.VANG_LAI.value,
                "priority": 5,
                "status": TrangThaiHangDoiEnum.CHO_KHAM.value,
                "check_in": datetime(2026, 11, 5, 13, 35, tzinfo=vn_tz),
                "so_lan_goi": 0,
            },
            {
                "patient": patient_map["hung.pham@example.com"],
                "doctor": bs_minh,
                "room": phong_khams.get("P101"),
                "ca": "chieu",
                "stt": 3,
                "loai": "uu_tien",
                "priority": 1, # Ưu tiên người cao tuổi 82t / cấp cứu -> Lên đầu hàng
                "status": TrangThaiHangDoiEnum.CHO_KHAM.value,
                "check_in": datetime(2026, 11, 5, 13, 45, tzinfo=vn_tz),
                "so_lan_goi": 0,
            },

            # 2. P102 - BS. CKII Nguyễn Minh Hoàng
            {
                "patient": patient_map["huong.bui@example.com"],
                "doctor": bs_hoang,
                "room": phong_khams.get("P102"),
                "ca": "chieu",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.DANG_KHAM.value, # Test Bệnh nhân Đang khám
                "check_in": datetime(2026, 11, 5, 13, 20, tzinfo=vn_tz),
                "goi": datetime(2026, 11, 5, 13, 30, tzinfo=vn_tz),
                "so_lan_goi": 1,
            },
            {
                "patient": patient_map["chau.nguyen@example.com"],
                "doctor": bs_hoang,
                "room": phong_khams.get("P102"),
                "ca": "chieu",
                "stt": 2,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.CHO_KHAM.value,
                "check_in": datetime(2026, 11, 5, 13, 40, tzinfo=vn_tz),
                "so_lan_goi": 0,
            },

            # 3. P201 - ThS. BS Đặng Hải Phương
            {
                "patient": patient_map["huy.ngo@example.com"],
                "doctor": bs_phuong,
                "room": phong_khams.get("P201"),
                "ca": "chieu",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.DANG_KHAM.value,
                "check_in": datetime(2026, 11, 5, 13, 15, tzinfo=vn_tz),
                "goi": datetime(2026, 11, 5, 13, 25, tzinfo=vn_tz),
                "so_lan_goi": 1,
            },
            {
                "patient": patient_map["kiet.dang@example.com"],
                "doctor": bs_phuong,
                "room": phong_khams.get("P201"),
                "ca": "chieu",
                "stt": 2,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.TAM_HOAN.value, # Test Tạm hoãn gọi 3 lần
                "check_in": datetime(2026, 11, 5, 13, 25, tzinfo=vn_tz),
                "goi": datetime(2026, 11, 5, 13, 35, tzinfo=vn_tz),
                "so_lan_goi": 3,
                "ghi_chu": "Bệnh nhân vắng mặt sau 3 lần gọi loa phòng khám",
            },

            # 4. P202 - BS. CKI Lê Hoàng Long
            {
                "patient": patient_map["an.tran@example.com"],
                "doctor": bs_long,
                "room": phong_khams.get("P202"),
                "ca": "chieu",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.CHO_KHAM.value,
                "check_in": datetime(2026, 11, 5, 13, 45, tzinfo=vn_tz),
                "so_lan_goi": 0,
            },
            {
                "patient": patient_map["linh.do@example.com"],
                "doctor": bs_long,
                "room": phong_khams.get("P202"),
                "ca": "chieu",
                "stt": 2,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.BO_KHAM.value, # Test Bỏ về
                "check_in": datetime(2026, 11, 5, 13, 15, tzinfo=vn_tz),
                "so_lan_goi": 0,
                "ghi_chu": "Bệnh nhân có việc gia đình đột xuất xin hủy lượt khám",
            },

            # 5. P301 - BS. CKII Trần Quốc Huy
            {
                "patient": patient_map["trong.duong@example.com"],
                "doctor": bs_huy,
                "room": phong_khams.get("P301"),
                "ca": "chieu",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.DA_KHAM.value, # Test Hoàn tất khám ca chiều
                "check_in": datetime(2026, 11, 5, 13, 5, tzinfo=vn_tz),
                "goi": datetime(2026, 11, 5, 13, 10, tzinfo=vn_tz),
                "ket_thuc": datetime(2026, 11, 5, 13, 35, tzinfo=vn_tz),
                "so_lan_goi": 1,
            },

            # 6. P302 - ThS. BS Lê Ngọc Lan
            {
                "patient": patient_map["trang.trinh@example.com"],
                "doctor": bs_lan,
                "room": phong_khams.get("P302"),
                "ca": "chieu",
                "stt": 1,
                "loai": LoaiHangDoiEnum.DUNG_HEN.value,
                "priority": 2,
                "status": TrangThaiHangDoiEnum.CHO_KHAM.value,
                "check_in": datetime(2026, 11, 5, 13, 50, tzinfo=vn_tz),
                "so_lan_goi": 0,
            },
        ]

        for q in queue_tickets:
            doc = q["doctor"]
            room = q["room"]
            llv = llv_map.get((doc.id, q["ca"])) if doc else None

            ticket = HangDoiKham(
                benh_nhan_id=q["patient"].id,
                bac_si_id=doc.id,
                phong_kham_id=room.id if room else doc.phong_kham_id,
                lich_lam_viec_id=llv.id if llv else None,
                ngay_kham=today,
                ca_kham=q["ca"],
                so_thu_tu_kham=q["stt"],
                loai_hang_doi=q["loai"],
                muc_do_uu_tien=q["priority"],
                trang_thai=q["status"],
                thoi_gian_check_in=q["check_in"],
                thoi_gian_goi_kham=q.get("goi"),
                thoi_gian_bat_dau=q.get("goi"),
                thoi_gian_ket_thuc=q.get("ket_thuc"),
                so_lan_goi=q.get("so_lan_goi", 0),
                nguoi_tiep_nhan_id=le_tan_id,
                ghi_chu_dieu_phoi=q.get("ghi_chu"),
            )
            session.add(ticket)

        await session.flush()
        print(f"--> Đã nạp {len(queue_tickets)} vé hàng đợi vào các buồng khám.")

        # 6. Nạp Danh sách chờ Waitlist (danh_sach_cho)
        stmt_del_wl = select(DanhSachCho).where(DanhSachCho.ngay_mong_muon == today)
        del_wls = (await session.execute(stmt_del_wl)).scalars().all()
        for dw in del_wls:
            await session.delete(dw)
        await session.flush()

        waitlists = [
            DanhSachCho(
                benh_nhan_id=patient_map["trong.duong@example.com"].id,
                bac_si_id=bs_minh.id,
                phong_kham_id=phong_khams["P101"].id,
                ngay_mong_muon=today,
                ca_mong_muon="chieu",
                trieu_chung="Đau tức ngực trái khi gắng sức, xin đăng ký chờ ca chiều BS Minh",
                thu_tu_uu_tien=1,
                trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value,
            ),
            DanhSachCho(
                benh_nhan_id=patient_map["trang.trinh@example.com"].id,
                bac_si_id=bs_long.id,
                phong_kham_id=phong_khams["P202"].id,
                ngay_mong_muon=today,
                ca_mong_muon="chieu",
                trieu_chung="Ù tai kèm chóng mặt, muốn vào khám khi có bệnh nhân hủy",
                thu_tu_uu_tien=2,
                trang_thai=TrangThaiWaitlistEnum.DA_THONG_BAO.value,
                thoi_gian_thong_bao=datetime(2026, 11, 5, 13, 30, tzinfo=vn_tz),
                thoi_gian_het_han_giu_slot=datetime(2026, 11, 5, 13, 45, tzinfo=vn_tz),
            ),
        ]
        for wl in waitlists:
            session.add(wl)

        await session.flush()
        print(f"--> Đã tạo {len(waitlists)} bản ghi Danh sách chờ (Waitlist).")

        # 7. Nạp Sự cố Bác sĩ nghỉ đột xuất (nghi_phep_bac_si)
        stmt_del_np = select(NghiPhepBacSi).where(
            NghiPhepBacSi.tu_ngay <= today,
            NghiPhepBacSi.den_ngay >= today,
        )
        del_nps = (await session.execute(stmt_del_np)).scalars().all()
        for dn in del_nps:
            await session.delete(dn)
        await session.flush()

        incident = NghiPhepBacSi(
            bac_si_id=bs_minh.id,
            phong_kham_id=phong_khams["P101"].id,
            loai_nghi=LoaiNghiPhepEnum.NGHI_DOT_XUAT.value,
            tu_ngay=today,
            den_ngay=today,
            ca_lam_viec="chieu",
            ly_do="Hội chẩn ca phẫu thuật cấp cứu tuyến trung ương đột xuất",
            trang_thai=TrangThaiNghiPhepEnum.DA_DUYET.value,
            nguoi_duyet_id=admin_id,
            thoi_gian_duyet=datetime(2026, 11, 5, 13, 0, tzinfo=vn_tz),
            ghi_chu_duyet="Đã phê duyệt ca nghỉ đột xuất. Yêu cầu Lễ tân điều phối bệnh nhân sang BS Nguyễn Minh Hoàng.",
            so_ca_anh_huong=1,
            so_lich_anh_huong=3,
        )
        session.add(incident)
        await session.flush()
        print("--> Đã tạo sự cố Bác sĩ PGS.TS Phạm Đức Minh nghỉ đột xuất ca chiều.")

        # 8. Nạp Lịch trực định kỳ theo tuần (lich_dinh_ky_bac_si)
        stmt_del_tmpl = select(LichDinhKyBacSi)
        del_tmpls = (await session.execute(stmt_del_tmpl)).scalars().all()
        for dt in del_tmpls:
            await session.delete(dt)
        await session.flush()

        doctors_list = [bs_minh, bs_hoang, bs_phuong, bs_long, bs_huy, bs_lan]
        template_records = []
        for doc in doctors_list:
            if not doc:
                continue
            for day in range(2, 8):  # Thứ Hai (2) đến Thứ Bảy (7)
                # Ca sáng
                template_records.append(
                    LichDinhKyBacSi(
                        bac_si_id=doc.id,
                        phong_kham_id=doc.phong_kham_id,
                        thu_trong_tuan=day,
                        ca_lam_viec="sang",
                        gio_bat_dau=time(7, 30),
                        gio_ket_thuc=time(11, 30),
                        thoi_luong_slot_phut=30,
                        gioi_han_ca_kham=8,
                        han_muc_dat_truoc=6,
                        han_muc_vang_lai=2,
                        is_active=True,
                    )
                )
                # Ca chiều
                template_records.append(
                    LichDinhKyBacSi(
                        bac_si_id=doc.id,
                        phong_kham_id=doc.phong_kham_id,
                        thu_trong_tuan=day,
                        ca_lam_viec="chieu",
                        gio_bat_dau=time(13, 30),
                        gio_ket_thuc=time(17, 0),
                        thoi_luong_slot_phut=30,
                        gioi_han_ca_kham=7,
                        han_muc_dat_truoc=5,
                        han_muc_vang_lai=2,
                        is_active=True,
                    )
                )

        for tr in template_records:
            session.add(tr)

        await session.flush()
        print(f"--> Đã nạp {len(template_records)} ca trực định kỳ mẫu theo tuần (Khuôn mẫu).")

        # Commit toàn bộ transaction
        await session.commit()
        print("==> HOÀN TẤT NẠP DỮ LIỆU TEST NGHIỆP VỤ LỄ TÂN THÀNH CÔNG! <==")


if __name__ == "__main__":
    asyncio.run(seed_reception_data())
