import uuid
import pytest
from datetime import date, time, datetime, timezone, timedelta
from sqlalchemy import select

from app.models.user import VaiTroEnum, NguoiDung, TaiKhoan, BenhNhan, BacSi, ChuyenKhoa, PhongKham
from app.models.appointment import (
    LichKham,
    LichLamViec,
    LichDinhKyBacSi,
    NghiPhepBacSi,
    HangDoiKham,
    TrangThaiLichEnum,
    TrangThaiHangDoiEnum,
    TrangThaiNghiPhepEnum,
    LoaiNghiPhepEnum,
    LoaiHangDoiEnum,
)
from app.schemas.incident import RebalanceQueueRequest
from app.services.queue_service import queue_service
from app.services.incident_service import incident_service
from app.core.exceptions import BadRequestException


@pytest.mark.asyncio
async def test_fc10_shift_dashboard(db_session):
    """
    FC-10: Dashboard ca trực lễ tân tính toán chính xác số liệu vận hành
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()
    shift_name = "sang"
    now_utc = datetime.now(timezone.utc)

    # Tạo chuyên khoa & bác sĩ
    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK-{suffix}", ten_chuyen_khoa=f"Khoa {suffix}")
    db_session.add(ck)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten="BS Test FC10", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0981{suffix}")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}")
    db_session.add(bs)
    await db_session.flush()

    # Bệnh nhân 1 (đặt trước, check-in CHO_KHAM)
    nd_bn1 = NguoiDung(ho_ten="BN1 FC10", email=f"bn1.{suffix}@clinic.com", so_dien_thoai=f"0982{suffix}")
    # Bệnh nhân 2 (đặt trước, check-in DANG_KHAM)
    nd_bn2 = NguoiDung(ho_ten="BN2 FC10", email=f"bn2.{suffix}@clinic.com", so_dien_thoai=f"0983{suffix}")
    # Bệnh nhân 3 (đặt trước chưa check-in)
    nd_bn3 = NguoiDung(ho_ten="BN3 FC10", email=f"bn3.{suffix}@clinic.com", so_dien_thoai=f"0984{suffix}")
    # Bệnh nhân 4 (vãng lai BO_KHAM)
    nd_bn4 = NguoiDung(ho_ten="BN4 FC10", email=f"bn4.{suffix}@clinic.com", so_dien_thoai=f"0985{suffix}")
    db_session.add_all([nd_bn1, nd_bn2, nd_bn3, nd_bn4])
    await db_session.flush()

    bn1 = BenhNhan(nguoi_dung_id=nd_bn1.id, ma_dinh_danh_y_te=f"BN1-{suffix}")
    bn2 = BenhNhan(nguoi_dung_id=nd_bn2.id, ma_dinh_danh_y_te=f"BN2-{suffix}")
    bn3 = BenhNhan(nguoi_dung_id=nd_bn3.id, ma_dinh_danh_y_te=f"BN3-{suffix}")
    bn4 = BenhNhan(nguoi_dung_id=nd_bn4.id, ma_dinh_danh_y_te=f"BN4-{suffix}")
    db_session.add_all([bn1, bn2, bn3, bn4])
    await db_session.flush()

    # Tạo 3 lịch khám đặt trước
    apt1 = LichKham(
        ma_lich_kham=f"APT1-{suffix}",
        benh_nhan_id=bn1.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ca_kham=shift_name,
        ngay_kham=today,
        gio_kham=time(8, 30),
        trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value,
    )
    apt2 = LichKham(
        ma_lich_kham=f"APT2-{suffix}",
        benh_nhan_id=bn2.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ca_kham=shift_name,
        ngay_kham=today,
        gio_kham=time(9, 0),
        trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value,
    )
    apt3 = LichKham(
        ma_lich_kham=f"APT3-{suffix}",
        benh_nhan_id=bn3.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ca_kham=shift_name,
        ngay_kham=today,
        gio_kham=time(9, 30),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add_all([apt1, apt2, apt3])
    await db_session.flush()

    # Vé hàng đợi
    q1 = HangDoiKham(
        so_thu_tu_kham=1,
        lich_kham_id=apt1.id,
        benh_nhan_id=bn1.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=shift_name,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc,
    )
    q2 = HangDoiKham(
        so_thu_tu_kham=2,
        lich_kham_id=apt2.id,
        benh_nhan_id=bn2.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=shift_name,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        trang_thai=TrangThaiHangDoiEnum.DANG_KHAM.value,
        thoi_gian_check_in=now_utc,
    )
    q4 = HangDoiKham(
        so_thu_tu_kham=3,
        benh_nhan_id=bn4.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=shift_name,
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        trang_thai=TrangThaiHangDoiEnum.BO_KHAM.value,
        thoi_gian_check_in=now_utc,
    )
    db_session.add_all([q1, q2, q4])
    await db_session.flush()

    # Gọi get_shift_dashboard
    dashboard = await queue_service.get_shift_dashboard(today, shift_name, db_session)
    assert dashboard.ngay == today
    assert dashboard.ca_kham == shift_name
    assert dashboard.tong_hen_truoc == 3
    assert dashboard.so_da_check_in == 3  # q1, q2, q4
    assert dashboard.so_dang_cho == 1
    assert dashboard.so_dang_kham == 1
    assert dashboard.so_bo_kham == 1
    assert dashboard.so_vang_lai == 1


@pytest.mark.asyncio
async def test_fc11_room_status_dashboard(db_session):
    """
    FC-11: Giám sát buồng khám vật lý và cảnh báo quá tải (>= 5 bệnh nhân chờ)
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()
    shift_name = "sang"
    now_utc = datetime.now(timezone.utc)

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK11-{suffix}", ten_chuyen_khoa=f"Khoa Tai Mũi Họng {suffix}")
    db_session.add(ck)
    await db_session.flush()

    # Tạo buồng khám
    room = PhongKham(
        ma_phong=f"P101-{suffix}",
        ten_phong="Phòng Khám TMH 101",
        chuyen_khoa_id=ck.id,
        tang="Tầng 1",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room)
    await db_session.flush()

    # Bác sĩ trực
    nd_bs = NguoiDung(ho_ten="BS TMH Quá Tải", email=f"bs11.{suffix}@clinic.com", so_dien_thoai=f"0986{suffix}")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BSCKI", chung_chi_hanh_nghe=f"CCHN11-{suffix}")
    db_session.add(bs)
    await db_session.flush()

    # Phân ca vào phòng khám
    roster = LichLamViec(
        bac_si_id=bs.id,
        phong_kham_id=room.id,
        ngay_lam_viec=today,
        ca_lam_viec=shift_name,
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        is_active=True,
    )
    db_session.add(roster)
    await db_session.flush()

    # Tạo 5 bệnh nhân chờ khám để kích hoạt cảnh báo quá tải
    for i in range(5):
        nd_bn = NguoiDung(ho_ten=f"BN Cho {i}", email=f"bn11_{i}.{suffix}@clinic.com", so_dien_thoai=f"0987{suffix}{i}")
        db_session.add(nd_bn)
        await db_session.flush()
        bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN11-{suffix}-{i}")
        db_session.add(bn)
        await db_session.flush()

        ticket = HangDoiKham(
            so_thu_tu_kham=i + 1,
            benh_nhan_id=bn.id,
            bac_si_id=bs.id,
            ngay_kham=today,
            ca_kham=shift_name,
            loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
            trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
            thoi_gian_check_in=now_utc,
        )
        db_session.add(ticket)
    await db_session.flush()

    # Gọi get_room_status_dashboard
    room_dashboard = await queue_service.get_room_status_dashboard(today, shift_name, db_session)
    matched_room = next((r for r in room_dashboard.danh_sach if r.phong_kham_id == room.id), None)
    assert matched_room is not None
    assert matched_room.bac_si_id == bs.id
    assert matched_room.ten_bac_si == "BS TMH Quá Tải"
    assert matched_room.so_benh_nhan_cho == 5
    assert matched_room.canh_bao_qua_tai is True


@pytest.mark.asyncio
async def test_fc12_reception_appointments(db_session):
    """
    FC-12: Tra cứu lịch hẹn toàn diện của Lễ tân theo ngày, ca, chuyên khoa và search keyword
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()
    now_utc = datetime.now(timezone.utc)

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK12-{suffix}", ten_chuyen_khoa=f"Khoa Tim Mạch {suffix}")
    db_session.add(ck)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten=f"BS Tim Mach {suffix}", email=f"bstm.{suffix}@clinic.com", so_dien_thoai=f"0988{suffix}")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="ThS", chung_chi_hanh_nghe=f"CCHN12-{suffix}")
    db_session.add(bs)
    await db_session.flush()

    nd_bn = NguoiDung(ho_ten=f"Nguyen Van TimMach {suffix}", email=f"bntm.{suffix}@clinic.com", so_dien_thoai=f"0989{suffix}")
    db_session.add(nd_bn)
    await db_session.flush()
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN12-{suffix}")
    db_session.add(bn)
    await db_session.flush()

    apt = LichKham(
        ma_lich_kham=f"APT12-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ngay_kham=today,
        gio_kham=time(10, 0),
        trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value,
    )
    db_session.add(apt)
    await db_session.flush()

    q = HangDoiKham(
        so_thu_tu_kham=12,
        lich_kham_id=apt.id,
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham="sang",
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc,
    )
    db_session.add(q)
    await db_session.flush()

    # Tra cứu theo search keyword
    res = await queue_service.get_reception_appointments(
        query_date=today,
        ca_kham="sang",
        bac_si_id=None,
        chuyen_khoa_id=ck.id,
        trang_thai=None,
        search="Nguyen Van TimMach",
        page=1,
        page_size=10,
        db=db_session
    )
    assert res.total >= 1
    item = next((it for it in res.items if it.id == apt.id), None)
    assert item is not None
    assert item.ma_lich_kham == f"APT12-{suffix}"
    assert item.trang_thai_hang_doi == TrangThaiHangDoiEnum.CHO_KHAM.value
    assert item.so_thu_tu_kham == 12
    assert item.ticket_id == q.id


@pytest.mark.asyncio
async def test_fc13_doctor_absence_incidents(db_session):
    """
    FC-13: Trung tâm sự cố phát hiện bác sĩ nghỉ đột xuất và gợi ý bác sĩ thay thế cùng chuyên khoa
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    # Tạo receptionist user
    nd_rec = NguoiDung(ho_ten="Le Tan FC13", email=f"rec13.{suffix}@clinic.com", so_dien_thoai=f"0990{suffix}")
    db_session.add(nd_rec)
    await db_session.flush()
    receptionist_user = TaiKhoan(
        nguoi_dung_id=nd_rec.id,
        email=f"rec13.{suffix}@clinic.com",
        mat_khau_hash="hash",
        vai_tro=VaiTroEnum.LE_TAN.value,
        is_active=True,
    )
    db_session.add(receptionist_user)
    await db_session.flush()

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK13-{suffix}", ten_chuyen_khoa=f"Khoa Nhi {suffix}")
    db_session.add(ck)
    await db_session.flush()

    # Bác sĩ A (nghỉ phép đột xuất)
    nd_bsA = NguoiDung(ho_ten=f"BS A Nghi {suffix}", email=f"bsA.{suffix}@clinic.com", so_dien_thoai=f"0991{suffix}")
    # Bác sĩ B (đang trực cùng chuyên khoa - phương án thay thế)
    nd_bsB = NguoiDung(ho_ten=f"BS B Truc {suffix}", email=f"bsB.{suffix}@clinic.com", so_dien_thoai=f"0992{suffix}")
    db_session.add_all([nd_bsA, nd_bsB])
    await db_session.flush()

    bsA = BacSi(nguoi_dung_id=nd_bsA.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-A-{suffix}")
    bsB = BacSi(nguoi_dung_id=nd_bsB.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-B-{suffix}")
    db_session.add_all([bsA, bsB])
    await db_session.flush()

    # Đơn nghỉ phép của BS A
    np = NghiPhepBacSi(
        bac_si_id=bsA.id,
        tu_ngay=today,
        den_ngay=today,
        ca_lam_viec="sang",
        loai_nghi=LoaiNghiPhepEnum.NGHI_DOT_XUAT.value,
        ly_do="Sốt xuất huyết cấp cứu",
        trang_thai=TrangThaiNghiPhepEnum.DA_DUYET.value,
    )
    db_session.add(np)

    # Lịch trực của BS B (đang mở)
    shiftB = LichLamViec(
        bac_si_id=bsB.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=15,
        is_active=True,
    )
    db_session.add(shiftB)
    await db_session.flush()

    # Bệnh nhân có lịch hẹn với BS A
    nd_bn = NguoiDung(ho_ten=f"Be Binh {suffix}", email=f"bebinh.{suffix}@clinic.com", so_dien_thoai=f"0993{suffix}")
    db_session.add(nd_bn)
    await db_session.flush()
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN13-{suffix}")
    db_session.add(bn)
    await db_session.flush()

    aptA = LichKham(
        ma_lich_kham=f"APT13-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bsA.id,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ngay_kham=today,
        gio_kham=time(9, 0),
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add(aptA)
    await db_session.flush()

    incidents = await incident_service.get_doctor_absences_incidents(today, receptionist_user, db_session)
    matched_inc = next((inc for inc in incidents if inc.bac_si_id == bsA.id), None)
    assert matched_inc is not None
    # Kiểm tra danh sách thay thế có BS B
    alt_b = next((alt for alt in matched_inc.danh_sach_bac_si_thay_the if alt.bac_si_id == bsB.id), None)
    assert alt_b is not None


@pytest.mark.asyncio
async def test_fc14_rebalance_queue(db_session):
    """
    FC-14: Điều phối tải hàng đợi hàng loạt giữa 2 bác sĩ cùng chuyên khoa
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()
    now_utc = datetime.now(timezone.utc)

    # Tạo receptionist user chuẩn
    nd_rec = NguoiDung(ho_ten="Le Tan Test", email=f"letan.{suffix}@clinic.com", so_dien_thoai=f"0999{suffix}")
    db_session.add(nd_rec)
    await db_session.flush()
    receptionist_user = TaiKhoan(
        nguoi_dung_id=nd_rec.id,
        email=f"letan.{suffix}@clinic.com",
        mat_khau_hash="hash",
        vai_tro=VaiTroEnum.LE_TAN.value,
        is_active=True,
    )
    db_session.add(receptionist_user)
    await db_session.flush()

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK14-{suffix}", ten_chuyen_khoa=f"Khoa Da Liễu {suffix}")
    db_session.add(ck)
    await db_session.flush()

    # Bác sĩ nguồn A và Bác sĩ đích B
    nd_bsA = NguoiDung(ho_ten=f"BS A Nguon {suffix}", email=f"bs14A.{suffix}@clinic.com", so_dien_thoai=f"0994{suffix}")
    nd_bsB = NguoiDung(ho_ten=f"BS B Dich {suffix}", email=f"bs14B.{suffix}@clinic.com", so_dien_thoai=f"0995{suffix}")
    db_session.add_all([nd_bsA, nd_bsB])
    await db_session.flush()

    bsA = BacSi(nguoi_dung_id=nd_bsA.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN14A-{suffix}")
    bsB = BacSi(nguoi_dung_id=nd_bsB.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN14B-{suffix}")
    db_session.add_all([bsA, bsB])
    await db_session.flush()

    # Đơn nghỉ phép cho BS A để tạo incident
    np = NghiPhepBacSi(
        bac_si_id=bsA.id,
        tu_ngay=today,
        den_ngay=today,
        ca_lam_viec="sang",
        loai_nghi=LoaiNghiPhepEnum.NGHI_DOT_XUAT.value,
        ly_do="Sự cố đột xuất",
        trang_thai=TrangThaiNghiPhepEnum.DA_DUYET.value,
    )
    db_session.add(np)

    # Ca trực cho cả 2 bác sĩ
    shiftA = LichLamViec(bac_si_id=bsA.id, ngay_lam_viec=today, ca_lam_viec="sang", gio_bat_dau=time(8, 0), gio_ket_thuc=time(12, 0), is_active=False)
    shiftB = LichLamViec(bac_si_id=bsB.id, ngay_lam_viec=today, ca_lam_viec="sang", gio_bat_dau=time(8, 0), gio_ket_thuc=time(12, 0), is_active=True)
    db_session.add_all([shiftA, shiftB])
    await db_session.flush()

    # Tạo 2 vé chờ cho BS A
    nd_bn1 = NguoiDung(ho_ten="BN1 Rebal", email=f"bn14_1.{suffix}@clinic.com", so_dien_thoai=f"0996{suffix}")
    nd_bn2 = NguoiDung(ho_ten="BN2 Rebal", email=f"bn14_2.{suffix}@clinic.com", so_dien_thoai=f"0997{suffix}")
    db_session.add_all([nd_bn1, nd_bn2])
    await db_session.flush()

    bn1 = BenhNhan(nguoi_dung_id=nd_bn1.id, ma_dinh_danh_y_te=f"BN14-1-{suffix}")
    bn2 = BenhNhan(nguoi_dung_id=nd_bn2.id, ma_dinh_danh_y_te=f"BN14-2-{suffix}")
    db_session.add_all([bn1, bn2])
    await db_session.flush()

    t1 = HangDoiKham(
        so_thu_tu_kham=1,
        benh_nhan_id=bn1.id,
        bac_si_id=bsA.id,
        ngay_kham=today,
        ca_kham="sang",
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc,
    )
    t2 = HangDoiKham(
        so_thu_tu_kham=2,
        benh_nhan_id=bn2.id,
        bac_si_id=bsA.id,
        ngay_kham=today,
        ca_kham="sang",
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc,
    )
    db_session.add_all([t1, t2])
    await db_session.flush()

    # Thực hiện điều chuyển vé t1 sang BS B
    req = RebalanceQueueRequest(
        nghi_phep_bac_si_id=np.id,
        ticket_ids=[t1.id],
        bac_si_nhan_id=bsB.id,
    )
    rebal_res = await incident_service.rebalance_queue(req, receptionist_user, db_session)
    assert rebal_res.ok is True
    assert rebal_res.so_ve_chuyen == 1
    assert len(rebal_res.chi_tiet) == 1
    trans_item = rebal_res.chi_tiet[0]
    assert trans_item.old_ticket_id == t1.id

    # Verify database ticket t1 đã đóng vé và có ghi chú điều phối sang BS mới
    await db_session.refresh(t1)
    assert t1.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value
    assert "Điều phối sang BS" in (t1.ghi_chu_dieu_phoi or "")

    # Ticket t2 vẫn của BS A
    await db_session.refresh(t2)
    assert t2.bac_si_id == bsA.id


@pytest.mark.asyncio
async def test_fc15_resource_views(db_session):
    """
    FC-15: Tra cứu tài nguyên phân ca (roster), buồng khám (rooms), và lịch định kỳ (roster template)
    """
    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK15-{suffix}", ten_chuyen_khoa=f"Khoa Mắt {suffix}")
    db_session.add(ck)
    await db_session.flush()

    room = PhongKham(
        ma_phong=f"P15-{suffix}",
        ten_phong="Phòng Khám Mắt 202",
        chuyen_khoa_id=ck.id,
        tang="Tầng 2",
        loai_phong="kham_benh",
        is_active=True,
    )
    db_session.add(room)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten=f"BS Mat {suffix}", email=f"bsmat.{suffix}@clinic.com", so_dien_thoai=f"0998{suffix}")
    db_session.add(nd_bs)
    await db_session.flush()
    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="ThS", chung_chi_hanh_nghe=f"CCHN15-{suffix}")
    db_session.add(bs)
    await db_session.flush()

    roster = LichLamViec(
        bac_si_id=bs.id,
        phong_kham_id=room.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        is_active=True,
    )
    tmpl = LichDinhKyBacSi(
        bac_si_id=bs.id,
        thu_trong_tuan=2,  # Thứ 2
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        phong_kham_id=room.id,
        is_active=True,
    )
    db_session.add_all([roster, tmpl])
    await db_session.flush()

    # 1. Test get_roster_resources
    roster_list = await queue_service.get_roster_resources(today, "sang", db_session)
    assert any(r.bac_si_id == bs.id and r.phong_kham_id == room.id for r in roster_list)

    # 2. Test get_rooms_resources
    room_list = await queue_service.get_rooms_resources(ck.id, db_session)
    assert any(rm.id == room.id for rm in room_list)

    # 3. Test get_roster_template_resources
    tmpl_list = await queue_service.get_roster_template_resources(2, db_session)
    assert any(tp.bac_si_id == bs.id for tp in tmpl_list)
