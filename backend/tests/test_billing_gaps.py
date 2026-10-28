import uuid
from decimal import Decimal
import pytest
from datetime import date, time, datetime, timezone, timedelta
from sqlalchemy import select

from app.models.user import VaiTroEnum, NguoiDung, TaiKhoan, BenhNhan, BacSi, ChuyenKhoa
from app.models.medical import HoaDon, ChiTietHoaDon, PhieuThuChi, LuotKham
from app.models.specialized import DangKyGoiKham, GoiDichVu
from app.models.appointment import LichKham, TrangThaiLichEnum
from app.schemas.cashier import RefundInvoiceRequest
from app.services.cashier_service import cashier_service
from app.services.queue_service import queue_service
from app.services.appointment_service import appointment_service
from app.core.exceptions import BadRequestException, ForbiddenException


@pytest.mark.asyncio
async def test_fc16_refund_invoice_full_and_partial(db_session):
    """
    FC-16: Hoàn tiền viện phí (toàn phần & một phần), sinh phiếu chi và cập nhật trạng thái hóa đơn
    """
    suffix = uuid.uuid4().hex[:6]
    now_utc = datetime.now(timezone.utc)

    # 1. Thu ngân & Bệnh nhân
    nd_cashier = NguoiDung(ho_ten="Thu Ngan Test", email=f"tn.{suffix}@clinic.com", so_dien_thoai=f"0911{suffix}")
    nd_patient = NguoiDung(ho_ten="BN Hoan Tien", email=f"bnht.{suffix}@clinic.com", so_dien_thoai=f"0912{suffix}")
    db_session.add_all([nd_cashier, nd_patient])
    await db_session.flush()

    bn = BenhNhan(nguoi_dung_id=nd_patient.id, ma_dinh_danh_y_te=f"BN-HT-{suffix}")
    db_session.add(bn)
    await db_session.flush()

    # Tạo bác sĩ & chuyên khoa
    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK-HT-{suffix}", ten_chuyen_khoa=f"Khoa {suffix}")
    db_session.add(ck)
    await db_session.flush()
    nd_bs = NguoiDung(ho_ten=f"BS {suffix}", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0913{suffix}")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}")
    db_session.add(bs)
    await db_session.flush()

    # Tạo lịch hẹn gắn với lượt khám
    apt = LichKham(
        ma_lich_kham=f"APT-HT-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ngay_kham=now_utc.date(),
        ca_kham="sang",
        trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value,
    )
    db_session.add(apt)
    await db_session.flush()

    encounter = LuotKham(
        lich_kham_id=apt.id,
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        thoi_gian_bat_dau=now_utc,
    )
    db_session.add(encounter)
    await db_session.flush()

    # 2. Hóa đơn 1: 500,000đ (đã thu) -> Hoàn một phần 200,000đ
    inv1 = HoaDon(
        ma_hoa_don=f"HD1-{suffix}",
        luot_kham_id=encounter.id,
        benh_nhan_id=bn.id,
        thu_ngan_id=nd_cashier.id,
        tong_tien=Decimal("500000.00"),
        mien_giam=Decimal("0.00"),
        thuc_thu=Decimal("500000.00"),
        phuong_thuc_thanh_toan="tien_mat",
        trang_thai="da_thu",
        ngay_thanh_toan=now_utc,
    )
    # Hóa đơn 2: 300,000đ (đã thu) -> Hoàn 100% 300,000đ
    inv2 = HoaDon(
        ma_hoa_don=f"HD2-{suffix}",
        luot_kham_id=encounter.id,
        benh_nhan_id=bn.id,
        thu_ngan_id=nd_cashier.id,
        tong_tien=Decimal("300000.00"),
        mien_giam=Decimal("0.00"),
        thuc_thu=Decimal("300000.00"),
        phuong_thuc_thanh_toan="tien_mat",
        trang_thai="da_thu",
        ngay_thanh_toan=now_utc,
    )
    # Hóa đơn 3: chưa thu -> Không được hoàn tiền
    inv3 = HoaDon(
        ma_hoa_don=f"HD3-{suffix}",
        luot_kham_id=encounter.id,
        benh_nhan_id=bn.id,
        thu_ngan_id=nd_cashier.id,
        tong_tien=Decimal("200000.00"),
        mien_giam=Decimal("0.00"),
        thuc_thu=Decimal("200000.00"),
        trang_thai="chua_thu",
    )
    db_session.add_all([inv1, inv2, inv3])
    await db_session.flush()

    # 3. Test hoàn 1 phần inv1
    req1 = RefundInvoiceRequest(
        invoice_id=inv1.id,
        so_tien_hoan=Decimal("200000.00"),
        ly_do="Bệnh nhân hủy bớt 1 dịch vụ nội soi",
        phuong_thuc="tien_mat",
    )
    res1 = await cashier_service.refund_invoice(req1, nd_cashier.id, db_session)
    assert res1.so_tien_hoan == Decimal("200000.00")
    assert res1.trang_thai_hoa_don_moi == "hoan_tien_mot_phan"

    # Verify phiếu chi sinh ra trong DB
    stmt_pc1 = select(PhieuThuChi).where(PhieuThuChi.id == res1.phieu_chi_id)
    pc1 = (await db_session.execute(stmt_pc1)).scalar_one()
    assert pc1.loai_phieu == "CHI"
    assert pc1.so_tien == Decimal("200000.00")
    assert pc1.hoa_don_id == inv1.id

    # 4. Test hoàn toàn bộ inv2
    req2 = RefundInvoiceRequest(
        invoice_id=inv2.id,
        so_tien_hoan=None,  # 100%
        ly_do="Bệnh nhân có việc gia đình đột xuất xin hủy buổi khám",
        phuong_thuc="tien_mat",
    )
    res2 = await cashier_service.refund_invoice(req2, nd_cashier.id, db_session)
    assert res2.so_tien_hoan == Decimal("300000.00")
    assert res2.trang_thai_hoa_don_moi == "da_hoan_tien"

    # 5. Test chặn hoàn tiền trên hóa đơn chưa thu inv3
    req3 = RefundInvoiceRequest(
        invoice_id=inv3.id,
        so_tien_hoan=Decimal("100000.00"),
        ly_do="Thử hoàn tiền hóa đơn chưa thu",
    )
    with pytest.raises(BadRequestException):
        await cashier_service.refund_invoice(req3, nd_cashier.id, db_session)


@pytest.mark.asyncio
async def test_fc17_patient_packages_and_history_summary(db_session):
    """
    FC-17: Tra cứu gói khám bệnh nhân đã mua và tóm tắt lịch sử khám phục vụ tiếp đón tại quầy
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    nd_patient = NguoiDung(ho_ten=f"Nguyen Van Goi {suffix}", email=f"bngoi.{suffix}@clinic.com", so_dien_thoai=f"0914{suffix}")
    db_session.add(nd_patient)
    await db_session.flush()

    bn = BenhNhan(
        nguoi_dung_id=nd_patient.id,
        ma_dinh_danh_y_te=f"BN-PKG-{suffix}",
        so_lan_no_show=1,
        is_blocked_booking=False,
    )
    db_session.add(bn)
    await db_session.flush()

    # Tạo gói dịch vụ
    goi = GoiDichVu(
        ma_goi=f"GOI-VIP-{suffix}",
        ten_goi=f"Gói Khám VIP Toàn Diện {suffix}",
        don_gia_niem_yet=Decimal("2500000.00"),
        don_gia_khuyen_mai=Decimal("2000000.00"),
        is_active=True,
    )
    db_session.add(goi)
    await db_session.flush()

    # Đăng ký gói khám cho bệnh nhân
    reg_pkg = DangKyGoiKham(
        ma_dang_ky=f"DK-{suffix}",
        benh_nhan_id=bn.id,
        goi_dich_vu_id=goi.id,
        ngay_dang_ky=today - timedelta(days=30),
        han_su_dung=today + timedelta(days=335),
        tong_so_dich_vu=10,
        so_dich_vu_da_dung=3,
        trang_thai="DANG_SU_DUNG",
    )
    db_session.add(reg_pkg)

    # Tạo lịch sử khám trước đây
    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK17-{suffix}", ten_chuyen_khoa=f"Nội tổng quát {suffix}")
    db_session.add(ck)
    await db_session.flush()
    nd_bs = NguoiDung(ho_ten=f"BS K17 {suffix}", email=f"bs17.{suffix}@clinic.com", so_dien_thoai=f"0915{suffix}")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN17-{suffix}")
    db_session.add(bs)
    await db_session.flush()

    past_apt = LichKham(
        ma_lich_kham=f"APT17-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ngay_kham=today - timedelta(days=15),
        gio_kham=time(8, 30),
        ly_do_kham="Đau dạ dày mạn tính",
        trang_thai=TrangThaiLichEnum.DA_KHAM.value,
    )
    db_session.add(past_apt)
    await db_session.flush()

    # 1. Test get_patient_packages
    packages = await queue_service.get_patient_packages(bn.id, db_session)
    assert len(packages) == 1
    pkg_item = packages[0]
    assert pkg_item.ma_dang_ky == f"DK-{suffix}"
    assert pkg_item.so_dich_vu_da_dung == 3
    assert pkg_item.so_dich_vu_con_lai == 7
    assert pkg_item.is_con_han is True

    # 2. Test get_patient_history_summary
    summary = await queue_service.get_patient_history_summary(bn.id, db_session)
    assert summary.benh_nhan_id == bn.id
    assert summary.so_lan_no_show == 1
    assert summary.is_blocked_booking is False
    assert summary.so_lan_kham == 1
    assert len(summary.lich_su_kham_gan_day) >= 1
    assert summary.lich_su_kham_gan_day[0].chan_doan == "Đau dạ dày mạn tính"
    assert len(summary.goi_kham_hien_co) == 1


@pytest.mark.asyncio
async def test_fc18_no_show_end_of_shift_and_role_access(db_session):
    """
    FC-18: Quét xử lý no-show cuối ca, tự động khóa bệnh nhân khi đủ 3 lần vi phạm và phân quyền lễ tân
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    # Tạo Lễ tân user
    nd_rec = NguoiDung(ho_ten="Le Tan FC18", email=f"rec18.{suffix}@clinic.com", so_dien_thoai=f"0916{suffix}")
    db_session.add(nd_rec)
    await db_session.flush()
    receptionist_user = TaiKhoan(
        nguoi_dung_id=nd_rec.id,
        email=f"rec18.{suffix}@clinic.com",
        mat_khau_hash="hash",
        vai_tro=VaiTroEnum.LE_TAN.value,
        is_active=True,
    )
    db_session.add(receptionist_user)
    await db_session.flush()

    # Bệnh nhân A: đã có 2 lần no-show -> sau ca này là lần 3 -> sẽ bị khóa
    nd_bnA = NguoiDung(ho_ten=f"BN NoShow 3 Lan {suffix}", email=f"bnsA.{suffix}@clinic.com", so_dien_thoai=f"0917{suffix}")
    # Bệnh nhân B: mới no-show lần đầu
    nd_bnB = NguoiDung(ho_ten=f"BN NoShow 1 Lan {suffix}", email=f"bnsB.{suffix}@clinic.com", so_dien_thoai=f"0918{suffix}")
    db_session.add_all([nd_bnA, nd_bnB])
    await db_session.flush()

    bnA = BenhNhan(nguoi_dung_id=nd_bnA.id, ma_dinh_danh_y_te=f"BN-NS-A-{suffix}", so_lan_no_show=2, is_blocked_booking=False)
    bnB = BenhNhan(nguoi_dung_id=nd_bnB.id, ma_dinh_danh_y_te=f"BN-NS-B-{suffix}", so_lan_no_show=0, is_blocked_booking=False)
    db_session.add_all([bnA, bnB])
    await db_session.flush()

    # Bác sĩ
    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK18-{suffix}", ten_chuyen_khoa=f"Khoa {suffix}")
    db_session.add(ck)
    await db_session.flush()
    nd_bs = NguoiDung(ho_ten=f"BS 18 {suffix}", email=f"bs18.{suffix}@clinic.com", so_dien_thoai=f"0919{suffix}")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN18-{suffix}")
    db_session.add(bs)
    await db_session.flush()

    # 2 lịch hẹn trong ca sáng hôm nay chưa check-in (vẫn DA_XAC_NHAN)
    aptA = LichKham(
        ma_lich_kham=f"APT-NSA-{suffix}",
        benh_nhan_id=bnA.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ngay_kham=today,
        gio_kham=time(9, 0),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    aptB = LichKham(
        ma_lich_kham=f"APT-NSB-{suffix}",
        benh_nhan_id=bnB.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ngay_kham=today,
        gio_kham=time(10, 0),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add_all([aptA, aptB])
    await db_session.flush()

    # 1. Lễ tân quét no-show cuối ca sáng
    no_show_res = await queue_service.process_no_shows_end_of_shift(
        query_date=today,
        ca_kham="sang",
        current_user=receptionist_user,
        db=db_session,
    )
    assert no_show_res.tong_so_no_show >= 2
    assert aptA.ma_lich_kham in no_show_res.danh_sach_ma_lich
    assert aptB.ma_lich_kham in no_show_res.danh_sach_ma_lich

    # Verify Database
    await db_session.refresh(aptA)
    assert aptA.trang_thai == TrangThaiLichEnum.NO_SHOW.value

    await db_session.refresh(bnA)
    assert bnA.so_lan_no_show == 3
    assert bnA.is_blocked_booking is True  # Đã bị khóa tự động!

    await db_session.refresh(bnB)
    assert bnB.so_lan_no_show == 1
    assert bnB.is_blocked_booking is False  # Chưa đủ 3 lần, chưa bị khóa

    # 2. Kiểm tra role LE_TAN có quyền kích hoạt auto_process_unconfirmed_and_waitlist
    auto_res = await appointment_service.auto_process_unconfirmed_and_waitlist(db_session, hours_threshold=2.0)
    assert auto_res is not None
