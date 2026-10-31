import uuid
import pytest
from datetime import date, time, datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select

from app.models.user import VaiTroEnum, NguoiDung, TaiKhoan, BenhNhan, BacSi, ChuyenKhoa
from app.models.medical import KhoaSoCaTruc, PhieuThuChi
from app.models.appointment import (
    LichKham,
    HangDoiKham,
    TrangThaiLichEnum,
    TrangThaiHangDoiEnum,
    LoaiHangDoiEnum,
)
from app.services.queue_service import queue_service
from app.services.cashier_service import cashier_service
from app.core.exceptions import ConflictException, ForbiddenException


@pytest.mark.asyncio
async def test_fc01_nullable_doctor_and_time_specialty_booking(db_session):
    """
    FC-01: Kiểm tra LichKham hỗ trợ đặt khám theo Chuyên khoa:
    - bac_si_id = NULL
    - gio_kham = NULL
    - chuyen_khoa_id NOT NULL
    - ca_kham = 'sang'
    - Lưu thành công không bị ràng buộc NOT NULL cản trở
    - Hỗ trợ nhiều lịch cùng NULL mà không bị uq_active_doctor_slot conflict
    """
    suffix = uuid.uuid4().hex[:6]
    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-{suffix}",
        ten_chuyen_khoa=f"Chuyên khoa {suffix}",
        is_active=True
    )
    db_session.add(ck)
    await db_session.flush()

    nd_bn1 = NguoiDung(ho_ten="BN Chuyên Khoa 1", email=f"bn1.{suffix}@clinic.com", so_dien_thoai=f"0933{suffix[:6]}")
    nd_bn2 = NguoiDung(ho_ten="BN Chuyên Khoa 2", email=f"bn2.{suffix}@clinic.com", so_dien_thoai=f"0934{suffix[:6]}")
    db_session.add_all([nd_bn1, nd_bn2])
    await db_session.flush()

    bn1 = BenhNhan(nguoi_dung_id=nd_bn1.id, ma_dinh_danh_y_te=f"BN-{suffix}-01")
    bn2 = BenhNhan(nguoi_dung_id=nd_bn2.id, ma_dinh_danh_y_te=f"BN-{suffix}-02")
    db_session.add_all([bn1, bn2])
    await db_session.flush()

    today = date.today()

    lk1 = LichKham(
        ma_lich_kham=f"LK-{suffix}-01",
        benh_nhan_id=bn1.id,
        bac_si_id=None,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ngay_kham=today,
        gio_kham=None,
        thoi_luong_phut=30,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    lk2 = LichKham(
        ma_lich_kham=f"LK-{suffix}-02",
        benh_nhan_id=bn2.id,
        bac_si_id=None,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ngay_kham=today,
        gio_kham=None,
        thoi_luong_phut=30,
        so_thu_tu=2,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    db_session.add_all([lk1, lk2])
    await db_session.commit()

    res1 = (await db_session.execute(select(LichKham).where(LichKham.id == lk1.id))).scalar_one()
    assert res1.bac_si_id is None
    assert res1.gio_kham is None
    assert res1.chuyen_khoa_id == ck.id
    assert res1.ca_kham == "sang"


@pytest.mark.asyncio
async def test_fc02_queue_restore_ticket_timestamp_and_ordering(db_session):
    """
    FC-02: Kiểm tra restore_ticket cập nhật thoi_gian_xep_hang_lai:
    - Vé tạm hoãn khi được phục hồi có thoi_gian_xep_hang_lai = now()
    - Thuật toán sắp xếp coalesce(thoi_gian_xep_hang_lai, thoi_gian_check_in) đưa vé này về sau
    """
    now = datetime.now(timezone.utc)
    today = date.today()
    suffix = uuid.uuid4().hex[:6]

    nd_bs = NguoiDung(ho_ten="BS FC02", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0944{suffix[:6]}")
    nd_bn1 = NguoiDung(ho_ten="BN FC02 1", email=f"bn1.{suffix}@clinic.com", so_dien_thoai=f"0945{suffix[:6]}")
    nd_bn2 = NguoiDung(ho_ten="BN FC02 2", email=f"bn2.{suffix}@clinic.com", so_dien_thoai=f"0946{suffix[:6]}")
    db_session.add_all([nd_bs, nd_bn1, nd_bn2])
    await db_session.flush()

    bs = BacSi(nguoi_dung_id=nd_bs.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}")
    bn1 = BenhNhan(nguoi_dung_id=nd_bn1.id, ma_dinh_danh_y_te=f"BN-{suffix}-01")
    bn2 = BenhNhan(nguoi_dung_id=nd_bn2.id, ma_dinh_danh_y_te=f"BN-{suffix}-02")
    db_session.add_all([bs, bn1, bn2])
    await db_session.flush()

    tk_letan = TaiKhoan(nguoi_dung_id=nd_bs.id, email=f"lt.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    db_session.add(tk_letan)
    await db_session.flush()

    # Vé 1: check-in lúc 08:00 nhưng bị tạm hoãn
    t1_checkin = now - timedelta(minutes=30)
    t1 = HangDoiKham(
        benh_nhan_id=bn1.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.TAM_HOAN.value,
        thoi_gian_check_in=t1_checkin,
        so_lan_goi=3
    )
    # Vé 2: check-in lúc 08:15 đang chờ khám
    t2_checkin = now - timedelta(minutes=15)
    t2 = HangDoiKham(
        benh_nhan_id=bn2.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=2,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=4,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=t2_checkin,
        so_lan_goi=0
    )
    db_session.add_all([t1, t2])
    await db_session.commit()

    res = await queue_service.restore_ticket(t1.id, tk_letan, db_session)
    assert res.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value
    assert res.thoi_gian_xep_hang_lai is not None

    board = await queue_service.get_doctor_queue_board(bs.id, today, db_session)
    assert len(board.danh_sach_cho_kham) == 2
    assert board.danh_sach_cho_kham[0].id == t2.id
    assert board.danh_sach_cho_kham[1].id == t1.id


@pytest.mark.asyncio
async def test_fc03_close_ticket_and_leave_queue(db_session):
    """
    FC-03: Kiểm tra đóng vé hành chính DA_DONG_VE và bệnh nhân xin về BO_KHAM
    """
    now = datetime.now(timezone.utc)
    today = date.today()
    suffix = uuid.uuid4().hex[:6]

    nd_lt = NguoiDung(ho_ten="Lễ Tân FC03", email=f"lt.{suffix}@clinic.com", so_dien_thoai=f"0955{suffix[:6]}")
    nd_bn = NguoiDung(ho_ten="Bệnh Nhân FC03", email=f"bn.{suffix}@clinic.com", so_dien_thoai=f"0956{suffix[:6]}")
    nd_bs = NguoiDung(ho_ten="Bác Sĩ FC03", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0957{suffix[:6]}")
    db_session.add_all([nd_lt, nd_bn, nd_bs])
    await db_session.flush()

    bs = BacSi(nguoi_dung_id=nd_bs.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}")
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-{suffix}")
    db_session.add_all([bs, bn])
    await db_session.flush()

    tk_letan = TaiKhoan(nguoi_dung_id=nd_lt.id, email=f"lt.acc.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    tk_bn = TaiKhoan(nguoi_dung_id=nd_bn.id, email=f"bn.acc.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.BENH_NHAN.value)
    db_session.add_all([tk_letan, tk_bn])
    await db_session.flush()

    t1 = HangDoiKham(
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=10,
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        muc_do_uu_tien=5,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    t2 = HangDoiKham(
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=11,
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        muc_do_uu_tien=5,
        trang_thai=TrangThaiHangDoiEnum.DANG_KHAM.value,
        thoi_gian_check_in=now,
    )
    db_session.add_all([t1, t2])
    await db_session.commit()

    # 1. Đóng vé hành chính thành công
    resp_close = await queue_service.close_ticket(t1.id, "Bệnh nhân chuyển viện khẩn cấp", tk_letan, db_session)
    assert resp_close.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value
    assert "chuyển viện" in resp_close.ghi_chu_dieu_phoi

    # 2. Thử đóng vé đang khám -> Phải lỗi ConflictException
    with pytest.raises(ConflictException):
        await queue_service.close_ticket(t2.id, "Đóng nhầm", tk_letan, db_session)

    # 3. Bệnh nhân không được quyền tự đóng vé
    with pytest.raises(ForbiddenException):
        await queue_service.close_ticket(t1.id, "Hack", tk_bn, db_session)


@pytest.mark.asyncio
async def test_fc04_close_shift_creates_khoa_so_record(db_session):
    """
    FC-04: Kiểm tra close_shift tạo bản ghi KhoaSoCaTruc và tính chênh lệch tiền mặt
    """
    now = datetime.now(timezone.utc)
    suffix = uuid.uuid4().hex[:6]
    nd_cashier = NguoiDung(ho_ten="Thu Ngân FC04", email=f"cashier.{suffix}@clinic.com", so_dien_thoai=f"0966{suffix[:6]}")
    db_session.add(nd_cashier)
    await db_session.flush()

    p1 = PhieuThuChi(
        ma_phieu=f"PT-{suffix}-01",
        loai_phieu="THU",
        nguoi_giao_dich="Bệnh nhân 1",
        so_tien=Decimal("200000.00"),
        phuong_thuc="tien_mat",
        ly_do="Thu tiền khám bệnh",
        nhan_vien_id=nd_cashier.id,
        thoi_gian=now,
        trang_thai_khoa_so=False
    )
    p2 = PhieuThuChi(
        ma_phieu=f"PT-{suffix}-02",
        loai_phieu="THU",
        nguoi_giao_dich="Bệnh nhân 2",
        so_tien=Decimal("300000.00"),
        phuong_thuc="tien_mat",
        ly_do="Thu tiền cận lâm sàng",
        nhan_vien_id=nd_cashier.id,
        thoi_gian=now,
        trang_thai_khoa_so=False
    )
    p3 = PhieuThuChi(
        ma_phieu=f"PT-{suffix}-03",
        loai_phieu="THU",
        nguoi_giao_dich="Bệnh nhân 3",
        so_tien=Decimal("500000.00"),
        phuong_thuc="chuyen_khoan",
        ly_do="Thu tiền dịch vụ",
        nhan_vien_id=nd_cashier.id,
        thoi_gian=now,
        trang_thai_khoa_so=False
    )
    db_session.add_all([p1, p2, p3])
    await db_session.commit()

    cash_actual = Decimal("490000.00")
    res_close = await cashier_service.close_shift(
        thu_ngan_user_id=nd_cashier.id,
        ghi_chu="Bàn giao ca sáng, hụt 10k tiền lẻ",
        tien_mat_thuc_te=cash_actual,
        db=db_session
    )

    assert res_close.ok is True
    assert res_close.ma_khoa_so is not None
    assert res_close.tien_mat_thuc_te == cash_actual
    assert res_close.chenh_lech_tien_mat == Decimal("-10000.00")
    assert res_close.khoa_so_id is not None

    record = (await db_session.execute(
        select(KhoaSoCaTruc).where(KhoaSoCaTruc.id == res_close.khoa_so_id)
    )).scalar_one_or_none()
    assert record is not None
    assert record.tong_tien_mat_he_thong == Decimal("500000.00")
    assert record.tien_mat_thuc_te == Decimal("490000.00")
    assert record.chenh_lech_tien_mat == Decimal("-10000.00")
    assert record.tong_so_phieu_thu == 3
    assert record.trang_thai == "DA_KHOA_SO"
