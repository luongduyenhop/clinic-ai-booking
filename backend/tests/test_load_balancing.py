import uuid
import pytest
from datetime import date, time, datetime, timezone, timedelta
from sqlalchemy import select

from app.models.user import VaiTroEnum, NguoiDung, TaiKhoan, BenhNhan, BacSi, ChuyenKhoa
from app.models.appointment import (
    LichKham,
    LichLamViec,
    NghiPhepBacSi,
    HangDoiKham,
    TrangThaiLichEnum,
    TrangThaiHangDoiEnum,
    TrangThaiNghiPhepEnum,
    LoaiHangDoiEnum,
    LyDoUuTienEnum,
)
from app.schemas.queue import CheckInRequest, WalkInCheckInRequest
from app.schemas.appointment import AppointmentCreateRequest
from app.services.load_balancing_service import load_balancing_service
from app.services.queue_service import queue_service
from app.services.appointment_service import appointment_service
from app.core.exceptions import ConflictException, ForbiddenException, BadRequestException


@pytest.mark.asyncio
async def test_fc05_load_balancing_selects_lowest_load_and_filters_leave(db_session):
    """
    FC-05: Thuật toán Load Balancing chọn bác sĩ có tải thấp nhất và loại bỏ bác sĩ nghỉ phép
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-{suffix}",
        ten_chuyen_khoa=f"Khoa Ngoại {suffix}",
        is_active=True
    )
    db_session.add(ck)
    await db_session.flush()

    # Bác sĩ 1
    nd_bs1 = NguoiDung(ho_ten="BS 1", email=f"bs1.{suffix}@clinic.com", so_dien_thoai=f"0971{suffix[:6]}")
    # Bác sĩ 2
    nd_bs2 = NguoiDung(ho_ten="BS 2", email=f"bs2.{suffix}@clinic.com", so_dien_thoai=f"0972{suffix[:6]}")
    db_session.add_all([nd_bs1, nd_bs2])
    await db_session.flush()

    bs1 = BacSi(nguoi_dung_id=nd_bs1.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN1-{suffix}", is_active=True)
    bs2 = BacSi(nguoi_dung_id=nd_bs2.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN2-{suffix}", is_active=True)
    db_session.add_all([bs1, bs2])
    await db_session.flush()

    # Ca trực sáng cho cả 2 bác sĩ
    shift1 = LichLamViec(
        bac_si_id=bs1.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=10,
        is_active=True
    )
    shift2 = LichLamViec(
        bac_si_id=bs2.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=10,
        is_active=True
    )
    db_session.add_all([shift1, shift2])
    await db_session.flush()

    # Tạo 1 bệnh nhân mẫu
    nd_bn = NguoiDung(ho_ten="BN Test", email=f"bn.{suffix}@clinic.com", so_dien_thoai=f"0973{suffix[:6]}")
    db_session.add(nd_bn)
    await db_session.flush()
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-{suffix}")
    db_session.add(bn)
    await db_session.flush()

    # BS1 đang có 1 bệnh nhân chờ khám
    ticket_bs1 = HangDoiKham(
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        ngay_kham=today,
        ca_kham="sang",
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc),
    )
    db_session.add(ticket_bs1)
    await db_session.commit()

    # Case 1: Cân bằng tải phải chọn BS2 vì BS2 có 0 bệnh nhân chờ (BS1 có 1)
    chosen_bs_id = await load_balancing_service.assign_optimal_doctor(ck.id, "sang", today, db_session)
    assert chosen_bs_id == bs2.id

    # Case 2: BS2 có đơn nghỉ phép đột xuất đã duyệt -> Phải chọn BS1
    leave_bs2 = NghiPhepBacSi(
        bac_si_id=bs2.id,
        tu_ngay=today,
        den_ngay=today,
        ca_lam_viec="sang",
        ly_do="Bận việc gia đình đột xuất",
        trang_thai=TrangThaiNghiPhepEnum.DA_DUYET.value
    )
    db_session.add(leave_bs2)
    await db_session.commit()

    chosen_after_leave = await load_balancing_service.assign_optimal_doctor(ck.id, "sang", today, db_session)
    assert chosen_after_leave == bs1.id


@pytest.mark.asyncio
async def test_fc06_check_in_appointment_branch_b_without_doctor(db_session):
    """
    FC-06: Check-in lịch hẹn nhánh B (Lịch đặt theo chuyên khoa, bac_si_id = NULL)
    -> Hệ thống tự động phân bổ bác sĩ rảnh và gán vào hàng đợi
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-{suffix}",
        ten_chuyen_khoa=f"Khoa Tai Mũi Họng {suffix}",
        is_active=True
    )
    db_session.add(ck)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten="BS TMH", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0974{suffix[:6]}")
    nd_bn = NguoiDung(ho_ten="BN TMH", email=f"bn.{suffix}@clinic.com", so_dien_thoai=f"0975{suffix[:6]}")
    nd_lt = NguoiDung(ho_ten="Lễ Tân TMH", email=f"lt.{suffix}@clinic.com", so_dien_thoai=f"0976{suffix[:6]}")
    db_session.add_all([nd_bs, nd_bn, nd_lt])
    await db_session.flush()

    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}", is_active=True)
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-{suffix}")
    db_session.add_all([bs, bn])
    await db_session.flush()

    tk_lt = TaiKhoan(nguoi_dung_id=nd_lt.id, email=f"lt.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    db_session.add(tk_lt)
    await db_session.flush()

    shift = LichLamViec(
        bac_si_id=bs.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=10,
        is_active=True
    )
    db_session.add(shift)
    await db_session.flush()

    # Lịch hẹn online: chưa chọn bác sĩ, chưa có giờ khám
    lk = LichKham(
        ma_lich_kham=f"LK-BRANCH-B-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=None,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ngay_kham=today,
        gio_kham=None,
        thoi_luong_phut=30,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    db_session.add(lk)
    await db_session.commit()

    # Lễ tân check-in
    res = await queue_service.check_in_patient(
        payload=CheckInRequest(lich_kham_id=lk.id),
        receptionist_user=tk_lt,
        db=db_session
    )
    assert res.bac_si_id == bs.id
    assert res.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value
    assert res.so_thu_tu_kham == 1

    # Kiểm tra lịch khám đã được cập nhật bác sĩ
    updated_lk = (await db_session.execute(select(LichKham).where(LichKham.id == lk.id))).scalar_one()
    assert updated_lk.bac_si_id == bs.id
    assert updated_lk.trang_thai == TrangThaiLichEnum.DA_TIEP_NHAN.value


@pytest.mark.asyncio
async def test_fc07_walk_in_auto_assign_and_quota_enforcement(db_session):
    """
    FC-07: Khám vãng lai tự động phân bổ bác sĩ theo chuyên khoa
    và kiểm tra hạn mức vãng lai (han_muc_vang_lai)
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-{suffix}",
        ten_chuyen_khoa=f"Khoa Da Liễu {suffix}",
        is_active=True
    )
    db_session.add(ck)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten="BS Da Liễu", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0977{suffix[:6]}")
    nd_bn1 = NguoiDung(ho_ten="BN Vãng Lai 1", email=f"bn1.{suffix}@clinic.com", so_dien_thoai=f"0978{suffix[:6]}")
    nd_bn2 = NguoiDung(ho_ten="BN Vãng Lai 2", email=f"bn2.{suffix}@clinic.com", so_dien_thoai=f"0979{suffix[:6]}")
    nd_lt = NguoiDung(ho_ten="Lễ Tân DL", email=f"lt.{suffix}@clinic.com", so_dien_thoai=f"0980{suffix[:6]}")
    db_session.add_all([nd_bs, nd_bn1, nd_bn2, nd_lt])
    await db_session.flush()

    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}", is_active=True)
    bn1 = BenhNhan(nguoi_dung_id=nd_bn1.id, ma_dinh_danh_y_te=f"BN-{suffix}-01")
    bn2 = BenhNhan(nguoi_dung_id=nd_bn2.id, ma_dinh_danh_y_te=f"BN-{suffix}-02")
    db_session.add_all([bs, bn1, bn2])
    await db_session.flush()

    tk_lt = TaiKhoan(nguoi_dung_id=nd_lt.id, email=f"lt.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    db_session.add(tk_lt)
    await db_session.flush()

    # Ca trực chỉ cho phép tối đa 1 vãng lai (han_muc_vang_lai = 1)
    shift = LichLamViec(
        bac_si_id=bs.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=10,
        han_muc_vang_lai=1,
        is_active=True
    )
    db_session.add(shift)
    await db_session.commit()

    # Bệnh nhân 1 vào vãng lai không chọn bác sĩ -> Auto-assign BS thành công
    res1 = await queue_service.check_in_walk_in(
        payload=WalkInCheckInRequest(
            benh_nhan_id=bn1.id,
            bac_si_id=None,
            chuyen_khoa_id=ck.id,
            ca_kham="sang",
            ly_do_kham="Ngứa da dị ứng"
        ),
        receptionist_user=tk_lt,
        db=db_session
    )
    assert res1.bac_si_id == bs.id
    assert res1.so_thu_tu_kham == 1

    # Bệnh nhân 2 vào vãng lai tiếp -> Bị từ chối do chạm hạn mức han_muc_vang_lai = 1
    with pytest.raises(ConflictException) as exc_info:
        await queue_service.check_in_walk_in(
            payload=WalkInCheckInRequest(
                benh_nhan_id=bn2.id,
                bac_si_id=None,
                chuyen_khoa_id=ck.id,
                ca_kham="sang",
                ly_do_kham="Nổi mề đay"
            ),
            receptionist_user=tk_lt,
            db=db_session
        )
    assert "chỉ tiêu vãng lai" in str(exc_info.value.message)


@pytest.mark.asyncio
async def test_fc08_special_priority_sets_priority_1(db_session):
    """
    FC-08: Check-in với lý do ưu tiên đặc biệt (người già >=80, phụ nữ mang thai)
    được cấp muc_do_uu_tien = 1
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK-{suffix}", ten_chuyen_khoa=f"Khoa Tim Mạch {suffix}", is_active=True)
    db_session.add(ck)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten="BS TM", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0981{suffix[:6]}")
    nd_bn = NguoiDung(ho_ten="BN Cụ Bà 85t", email=f"bn.{suffix}@clinic.com", so_dien_thoai=f"0982{suffix[:6]}")
    nd_lt = NguoiDung(ho_ten="Lễ Tân", email=f"lt.{suffix}@clinic.com", so_dien_thoai=f"0983{suffix[:6]}")
    db_session.add_all([nd_bs, nd_bn, nd_lt])
    await db_session.flush()

    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}", is_active=True)
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-{suffix}")
    db_session.add_all([bs, bn])
    await db_session.flush()

    tk_lt = TaiKhoan(nguoi_dung_id=nd_lt.id, email=f"lt.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    db_session.add(tk_lt)
    await db_session.flush()

    shift = LichLamViec(
        bac_si_id=bs.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        is_active=True
    )
    db_session.add(shift)
    await db_session.commit()

    # Tiếp đón vãng lai ưu tiên người già
    res = await queue_service.check_in_walk_in(
        payload=WalkInCheckInRequest(
            benh_nhan_id=bn.id,
            bac_si_id=bs.id,
            ca_kham="sang",
            ly_do_kham="Khó thở nhẹ",
            ly_do_uu_tien=LyDoUuTienEnum.NGUOI_GIA
        ),
        receptionist_user=tk_lt,
        db=db_session
    )
    assert res.muc_do_uu_tien == 1
    assert "nguoi_gia" in res.ghi_chu_dieu_phoi


@pytest.mark.asyncio
async def test_fc09_receptionist_overrides_blocked_booking(db_session):
    """
    FC-09: Bệnh nhân bị khóa đặt lịch trực tuyến (is_blocked_booking = True):
    - Tự đặt -> Bị chặn 403 Forbidden
    - Lễ tân bảo lãnh đặt lịch hộ -> Thành công, cờ is_blocked_booking KHÔNG bị reset
    """
    suffix = uuid.uuid4().hex[:6]
    tomorrow = date.today() + timedelta(days=1)

    nd_bs = NguoiDung(ho_ten="BS FC09", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0984{suffix[:6]}")
    nd_bn = NguoiDung(ho_ten="BN Bị Khóa", email=f"bn.{suffix}@clinic.com", so_dien_thoai=f"0985{suffix[:6]}")
    nd_lt = NguoiDung(ho_ten="Lễ Tân FC09", email=f"lt.{suffix}@clinic.com", so_dien_thoai=f"0986{suffix[:6]}")
    db_session.add_all([nd_bs, nd_bn, nd_lt])
    await db_session.flush()

    bs = BacSi(nguoi_dung_id=nd_bs.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}", is_active=True)
    # Bệnh nhân bị khóa do vắng mặt nhiều lần
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-{suffix}", is_blocked_booking=True)
    db_session.add_all([bs, bn])
    await db_session.flush()

    tk_bn = TaiKhoan(nguoi_dung_id=nd_bn.id, email=f"bn.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.BENH_NHAN.value)
    tk_lt = TaiKhoan(nguoi_dung_id=nd_lt.id, email=f"lt.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    db_session.add_all([tk_bn, tk_lt])
    await db_session.flush()

    shift = LichLamViec(
        bac_si_id=bs.id,
        ngay_lam_viec=tomorrow,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        is_active=True
    )
    db_session.add(shift)
    await db_session.commit()

    # 1. Bệnh nhân tự đặt lịch online -> Phải bị từ chối ForbiddenException
    with pytest.raises(ForbiddenException) as exc_info:
        await appointment_service.create_booking(
            payload=AppointmentCreateRequest(
                bac_si_id=bs.id,
                ngay_kham=tomorrow,
                gio_kham=time(8, 0),
                ly_do_kham="Tự đặt qua web"
            ),
            user=tk_bn,
            db=db_session
        )
    assert "tạm khóa đặt lịch trực tuyến" in str(exc_info.value.message)

    # 2. Lễ tân đặt lịch hộ cho bệnh nhân này (override) -> Thành công
    res_lt = await appointment_service.create_booking(
        payload=AppointmentCreateRequest(
            benh_nhan_id=bn.id,
            bac_si_id=bs.id,
            ngay_kham=tomorrow,
            gio_kham=time(8, 0),
            ly_do_kham="Lễ tân đặt hộ qua hotline"
        ),
        user=tk_lt,
        db=db_session
    )
    assert res_lt.id is not None
    assert res_lt.trang_thai == TrangThaiLichEnum.DA_XAC_NHAN.value

    # 3. Cờ is_blocked_booking của bệnh nhân vẫn giữ nguyên là True
    await db_session.refresh(bn)
    assert bn.is_blocked_booking is True
