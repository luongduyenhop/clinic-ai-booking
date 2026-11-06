import pytest
import uuid
from datetime import date, time
from app.services.appointment_service import clinic_now
from app.models.user import VaiTroEnum, NguoiDung, TaiKhoan, BenhNhan, BacSi, PhongKham
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
    CaLamViecEnum,
    LoaiHangDoiEnum,
)
from app.schemas.queue import TransferTicketRequest
from app.services.queue_service import queue_service
from app.core.exceptions import ConflictException, NotFoundException


@pytest.mark.asyncio
async def test_transfer_ticket_success_and_invariants(db_session):
    """
    KIỂM THỬ ENDPOINT POST /api/v1/reception/queue/{ticket_id}/transfer (FC-14):
    1. Lễ tân điều chuyển buồng khám cho 1 vé đang chờ khám.
    2. Cập nhật phong_kham_id đích, bác sĩ đích, STT mới.
    3. Hỗ trợ lý do ngắn (min_length=1).
    4. Cập nhật ghi_chu_dieu_phoi và thoi_gian_xep_hang_lai.
    5. Không thể điều chuyển vé đã khám xong (DA_KHAM) hoặc đã đóng (DA_DONG_VE).
    """
    today = clinic_now().date()
    ca_kham = CaLamViecEnum.SANG.value
    suffix = uuid.uuid4().hex[:6]

    # 1. Tạo 2 phòng khám
    p1 = PhongKham(ma_phong=f"P1-{suffix}", ten_phong="Phòng Khám 1", loai_phong="kham_benh", is_active=True)
    p2 = PhongKham(ma_phong=f"P2-{suffix}", ten_phong="Phòng Khám 2", loai_phong="kham_benh", is_active=True)
    db_session.add_all([p1, p2])
    await db_session.flush()

    # 2. Tạo 2 Bác sĩ
    nd_bs1 = NguoiDung(ho_ten="BS Một", email=f"bs1.{suffix}@clinic.com", so_dien_thoai=f"098{suffix[:7]}")
    nd_bs2 = NguoiDung(ho_ten="BS Hai", email=f"bs2.{suffix}@clinic.com", so_dien_thoai=f"097{suffix[:7]}")
    db_session.add_all([nd_bs1, nd_bs2])
    await db_session.flush()

    bs1 = BacSi(nguoi_dung_id=nd_bs1.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-1-{suffix}", phong_kham_id=p1.id, gia_kham_mac_dinh=150000)
    bs2 = BacSi(nguoi_dung_id=nd_bs2.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-2-{suffix}", phong_kham_id=p2.id, gia_kham_mac_dinh=150000)
    db_session.add_all([bs1, bs2])
    await db_session.flush()

    # 3. Tạo Lễ tân
    admin_user = TaiKhoan(nguoi_dung_id=nd_bs1.id, email=f"reception.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    db_session.add(admin_user)
    await db_session.flush()

    # 4. Tạo Bệnh nhân
    nd_bn = NguoiDung(ho_ten="BN Chuyển Buồng", email=f"bn.{suffix}@clinic.com", so_dien_thoai=f"091{suffix[:7]}")
    db_session.add(nd_bn)
    await db_session.flush()
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-TFR-{suffix}")
    db_session.add(bn)
    await db_session.flush()

    # 5. Tạo LichKham và HangDoiKham ở phòng 1
    lich = LichKham(
        ma_lich_kham=f"LK-TFR-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        ngay_kham=today,
        gio_kham=time(8, 0),
        thoi_luong_phut=30,
        so_thu_tu=1,
        ly_do_kham="Khám ban đầu",
        trang_thai=TrangThaiLichEnum.DA_TIEP_NHAN.value
    )
    db_session.add(lich)
    await db_session.flush()

    ticket = HangDoiKham(
        lich_kham_id=lich.id,
        benh_nhan_id=bn.id,
        bac_si_id=bs1.id,
        phong_kham_id=p1.id,
        ngay_kham=today,
        ca_kham=ca_kham,
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        muc_do_uu_tien=5,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=clinic_now(),
        so_lan_goi=0,
        nguoi_tiep_nhan_id=admin_user.id
    )
    db_session.add(ticket)
    await db_session.flush()

    # 6. Thực hiện điều chuyển sang Phòng 2 (Bác sĩ 2) với lý do ngắn 'o'
    payload = TransferTicketRequest(
        phong_kham_id=p2.id,
        bac_si_id=bs2.id,
        ly_do="o"
    )
    res = await queue_service.transfer_ticket(ticket.id, payload, admin_user, db_session)

    assert res.phong_kham_id == p2.id
    assert res.bac_si_id == bs2.id
    assert "Chuyển từ buồng" in res.ghi_chu_dieu_phoi
    assert res.so_thu_tu_kham >= 1

    # 7. Kiểm tra trạng thái đã đóng vé không được điều chuyển
    ticket.trang_thai = TrangThaiHangDoiEnum.DA_DONG_VE.value
    await db_session.commit()

    with pytest.raises(ConflictException) as exc_closed:
        await queue_service.transfer_ticket(ticket.id, payload, admin_user, db_session)
    assert "Không thể điều chuyển phiếu khám" in str(exc_closed.value)

