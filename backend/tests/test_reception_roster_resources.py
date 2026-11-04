import pytest
from datetime import date, time, timedelta
from app.services.appointment_service import clinic_now
from app.services.queue_service import queue_service
from app.models.appointment import LichLamViec, HangDoiKham, TrangThaiHangDoiEnum, LoaiHangDoiEnum, CaLamViecEnum
from app.models.user import BacSi, NguoiDung, ChuyenKhoa, BenhNhan


@pytest.mark.asyncio
async def test_get_roster_resources_success(db_session):
    """
    KIỂM THỬ ENDPOINT /api/v1/reception/resources/roster:
    - Tra cứu lịch phân ca trực thực tế trong ngày của Bác sĩ (FC-15)
    - Kiểm tra chữ ký hàm nhận đủ 4 tham số: query_date, ca_kham, chuyen_khoa_id, db
    - Không bị lỗi 500 TypeError mismatch argument
    """
    today = clinic_now().date()

    # 1. Gọi không lọc (lấy toàn bộ ca trực trong ngày)
    rosters = await queue_service.get_roster_resources(
        query_date=today,
        ca_kham=None,
        chuyen_khoa_id=None,
        db=db_session
    )
    assert isinstance(rosters, list)

    # 2. Gọi có lọc ca khám
    rosters_sang = await queue_service.get_roster_resources(
        query_date=today,
        ca_kham="sang",
        chuyen_khoa_id=None,
        db=db_session
    )
    assert isinstance(rosters_sang, list)
    for r in rosters_sang:
        assert r.ca_lam_viec == "sang"
        assert r.lich_lam_viec_id is not None
        assert r.ten_bac_si is not None


@pytest.mark.asyncio
async def test_get_roster_resources_excludes_bo_kham_and_da_dong_ve(db_session):
    """
    Kiểm tra so_luot_da_nhan trong roster resources:
    - Bệnh nhân hủy/bỏ khám (BO_KHAM) hoặc đã đóng vé (DA_DONG_VE) không được tính vào so_luot_da_nhan
    - Tránh tình trạng báo đầy ảo (fake full) cho ca khám của bác sĩ.
    """
    target_d = clinic_now().date() + timedelta(days=25)
    
    # 1. Tạo khoa, bác sĩ và bệnh nhân
    ck = ChuyenKhoa(ten_chuyen_khoa=f"Khoa Test {target_d}", ma_chuyen_khoa=f"CK_{target_d.strftime('%Y%m%d')}")
    db_session.add(ck)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten="BS Test Roster", email=f"bs_roster_{target_d.strftime('%Y%m%d')}@test.local")
    db_session.add(nd_bs)
    await db_session.flush()

    bs = BacSi(
        nguoi_dung_id=nd_bs.id,
        chuyen_khoa_id=ck.id,
        hoc_vi="Bác sĩ CKI",
        chung_chi_hanh_nghe=f"CCHN-{target_d.strftime('%Y%m%d')}"
    )
    db_session.add(bs)
    await db_session.flush()

    nd_bn = NguoiDung(ho_ten="BN Test Roster", email=f"bn_roster_{target_d.strftime('%Y%m%d')}@test.local")
    db_session.add(nd_bn)
    await db_session.flush()

    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-ROSTER-{target_d.strftime('%Y%m%d')}")
    db_session.add(bn)
    await db_session.flush()

    # 2. Tạo lịch làm việc
    llv = LichLamViec(
        bac_si_id=bs.id,
        ngay_lam_viec=target_d,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        gioi_han_ca_kham=10,
        han_muc_dat_truoc=8,
        han_muc_vang_lai=2,
        is_active=True,
    )
    db_session.add(llv)
    await db_session.flush()

    # 3. Tạo 3 vé hàng đợi:
    # - 1 vé CHO_KHAM (hợp lệ)
    # - 1 vé BO_KHAM (hủy khám)
    # - 1 vé DA_DONG_VE (đóng vé)
    t1 = HangDoiKham(
        benh_nhan_id=bn.id,
        so_thu_tu_kham=1,
        ngay_kham=target_d,
        ca_kham=CaLamViecEnum.SANG.value,
        bac_si_id=bs.id,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        thoi_gian_check_in=clinic_now(),
    )
    t2 = HangDoiKham(
        benh_nhan_id=bn.id,
        so_thu_tu_kham=2,
        ngay_kham=target_d,
        ca_kham=CaLamViecEnum.SANG.value,
        bac_si_id=bs.id,
        trang_thai=TrangThaiHangDoiEnum.BO_KHAM.value,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        thoi_gian_check_in=clinic_now(),
    )
    t3 = HangDoiKham(
        benh_nhan_id=bn.id,
        so_thu_tu_kham=3,
        ngay_kham=target_d,
        ca_kham=CaLamViecEnum.SANG.value,
        bac_si_id=bs.id,
        trang_thai=TrangThaiHangDoiEnum.DA_DONG_VE.value,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        thoi_gian_check_in=clinic_now(),
    )
    db_session.add_all([t1, t2, t3])
    await db_session.commit()

    # 4. Kiểm tra get_roster_resources
    rosters = await queue_service.get_roster_resources(
        query_date=target_d,
        ca_kham="sang",
        chuyen_khoa_id=ck.id,
        db=db_session
    )
    assert len(rosters) == 1
    # Chỉ tính 1 vé CHO_KHAM, 2 vé BO_KHAM và DA_DONG_VE phải bị loại trừ
    assert rosters[0].so_luot_da_nhan == 1
