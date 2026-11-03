import pytest
import uuid
from datetime import date, time, timedelta
from app.services.appointment_service import clinic_now
from app.models.user import VaiTroEnum, NguoiDung, TaiKhoan, BenhNhan, BacSi
from app.models.appointment import (
    DanhSachCho,
    TrangThaiWaitlistEnum,
    LichLamViec,
    CaLamViecEnum,
    HangDoiKham,
    TrangThaiHangDoiEnum,
    LoaiHangDoiEnum,
)
from app.services.queue_service import queue_service
from app.core.exceptions import BadRequestException, ConflictException


@pytest.mark.asyncio
async def test_waitlist_checkin_guards_and_priority_tier(db_session):
    """
    KIỂM THỬ CÁC CHỐT CHẶN AN TOÀN VÀ ĐỘ ƯU TIÊN KHI TIẾP NHẬN TỪ WAITLIST:
    1. Chốt chặn ngày: Không được check-in cho waitlist của ngày khác.
    2. Chốt chặn trạng thái: Không được check-in waitlist đã hủy / đã nhận slot.
    3. Chốt chặn trùng lặp: Không cho vào hàng đợi nếu đã có vé đang chờ khám trong ca hôm nay.
    4. Chốt chặn công suất ca trực: Bác sĩ đầy ca (gioi_han_ca_kham) thì không cho vượt trần.
    5. Độ ưu tiên: Vé tiếp nhận từ Waitlist phải có muc_do_uu_tien = 5 (Vãng lai), KHÔNG ĐƯỢC LÀ 3 (Sau CLS).
    """
    today = clinic_now().date()
    ca_kham = CaLamViecEnum.SANG.value
    suffix = uuid.uuid4().hex[:6]

    # 1. Tạo dữ liệu Bác sĩ
    nd_bs = NguoiDung(ho_ten="BS Waitlist Test", email=f"bs.wl.{suffix}@clinic.com", so_dien_thoai=f"098{suffix[:7]}")
    db_session.add(nd_bs)
    await db_session.flush()

    bs = BacSi(nguoi_dung_id=nd_bs.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-WL-{suffix}", gia_kham_mac_dinh=150000)
    db_session.add(bs)
    await db_session.flush()

    # 2. Tạo Lễ tân thực hiện và lưu vào database
    admin_user = TaiKhoan(nguoi_dung_id=nd_bs.id, email=f"admin.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    db_session.add(admin_user)
    await db_session.flush()

    # 3. Tạo Bệnh nhân 1
    nd_bn1 = NguoiDung(ho_ten="BN Chờ Đúng Ngày", email=f"bn.wl1.{suffix}@clinic.com", so_dien_thoai=f"091{suffix[:7]}")
    db_session.add(nd_bn1)
    await db_session.flush()
    bn1 = BenhNhan(nguoi_dung_id=nd_bn1.id, ma_dinh_danh_y_te=f"BN-WL1-{suffix}")
    db_session.add(bn1)
    await db_session.flush()

    # Guard 1: Đăng ký sai ngày (ngày mai)
    wl_tomorrow = DanhSachCho(
        benh_nhan_id=bn1.id,
        bac_si_id=bs.id,
        ngay_mong_muon=today + timedelta(days=1),
        ca_mong_muon=ca_kham,
        trieu_chung="Đăng ký ngày mai",
        thu_tu_uu_tien=1,
        trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value,
    )
    db_session.add(wl_tomorrow)
    await db_session.flush()

    with pytest.raises(BadRequestException) as exc_date:
        await queue_service.check_in_from_waitlist(wl_tomorrow.id, admin_user, db_session)
    assert "Chỉ có thể tiếp nhận vào đúng ngày đăng ký khám" in str(exc_date.value)

    # Guard 2: Đã bị hủy
    wl_cancelled = DanhSachCho(
        benh_nhan_id=bn1.id,
        bac_si_id=bs.id,
        ngay_mong_muon=today,
        ca_mong_muon=ca_kham,
        trieu_chung="Đã hủy",
        thu_tu_uu_tien=2,
        trang_thai="da_huy",
    )
    db_session.add(wl_cancelled)
    await db_session.flush()

    with pytest.raises(BadRequestException) as exc_cancel:
        await queue_service.check_in_from_waitlist(wl_cancelled.id, admin_user, db_session)
    assert "đã bị hủy" in str(exc_cancel.value)

    # Guard 3 & Success: Tiếp nhận thành công từ Danh sách chờ
    wl_valid = DanhSachCho(
        benh_nhan_id=bn1.id,
        bac_si_id=bs.id,
        ngay_mong_muon=today,
        ca_mong_muon=ca_kham,
        trieu_chung="Đau bụng quặn từng cơn",
        thu_tu_uu_tien=1,
        trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value,
    )
    db_session.add(wl_valid)
    await db_session.flush()

    ticket_res = await queue_service.check_in_from_waitlist(wl_valid.id, admin_user, db_session)

    # ASSERT QUAN TRỌNG: Mức độ ưu tiên PHẢI LÀ 5 (Vãng lai), KHÔNG ĐƯỢC LÀ 3 (Sau CLS)
    assert ticket_res.muc_do_uu_tien == 5
    assert ticket_res.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value
    assert ticket_res.benh_nhan_id == bn1.id
    assert "Tiếp nhận thành công từ Danh sách chờ" in ticket_res.ghi_chu_dieu_phoi

    # Guard 4: Lượt chờ đã được nhận slot -> không được nhận lần 2
    with pytest.raises(ConflictException) as exc_conflict:
        await queue_service.check_in_from_waitlist(wl_valid.id, admin_user, db_session)
    assert "đã được tiếp nhận vào hàng đợi trước đó" in str(exc_conflict.value)

    # Guard 5: Người bệnh đã có vé đang chờ khám trong ca hôm nay (Chống trùng lặp hàng đợi)
    wl_dup_patient = DanhSachCho(
        benh_nhan_id=bn1.id,
        bac_si_id=bs.id,
        ngay_mong_muon=today,
        ca_mong_muon=ca_kham,
        trieu_chung="Vé chờ thứ 2 cho cùng bệnh nhân",
        thu_tu_uu_tien=3,
        trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value,
    )
    db_session.add(wl_dup_patient)
    await db_session.flush()

    with pytest.raises(ConflictException) as exc_dup_queue:
        await queue_service.check_in_from_waitlist(wl_dup_patient.id, admin_user, db_session)
    assert "đã có vé đang chờ hoặc đang khám" in str(exc_dup_queue.value)
