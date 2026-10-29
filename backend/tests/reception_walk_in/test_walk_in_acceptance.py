import uuid
from datetime import date, time
import pytest
from sqlalchemy import select, update

from app.models.appointment import HangDoiKham, LichKham, LichLamViec, TrangThaiHangDoiEnum, TrangThaiLichEnum, LoaiHangDoiEnum
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, PhongKham, TaiKhoan, VaiTroEnum
from app.schemas.queue import WalkInCheckInRequest, WalkInQuickRequest
from app.services.queue_service import queue_service


@pytest.mark.asyncio
async def test_walk_in_stt_auto_increment_no_gap_per_room_and_day(api_client, booking, db_session):
    """
    Tiêu chí nghiệm thu 1:
    - STT tự tăng theo ngày và theo buồng khám/bác sĩ, không bị nhảy cóc (1 -> 2 -> 3).
    - Sang bác sĩ/buồng khám khác thì STT khởi tạo độc lập từ 1.
    """
    token_letan = booking.tokens["admin"]
    bs1 = booking.bs_x
    bs2 = booking.bs_y

    today = date.today()
    suffix = uuid.uuid4().hex[:6]

    # Tạo 3 bệnh nhân cho BS 1 và 1 bệnh nhân cho BS 2
    bns = []
    for i in range(4):
        nd = NguoiDung(
            ho_ten=f"Bệnh Nhân Vãng Lai {i+1}",
            email=f"bn.walkin.{suffix}.{i+1}@clinic.com",
            so_dien_thoai=f"0912{i:02d}{suffix[:4]}",
        )
        db_session.add(nd)
        await db_session.flush()
        bn = BenhNhan(nguoi_dung_id=nd.id, ma_dinh_danh_y_te=f"BN-WLK-{suffix}-{i+1}")
        db_session.add(bn)
        bns.append(bn)
    await db_session.commit()

    # 1. Bệnh nhân 1 vào BS 1 -> STT phải là 1
    req1 = WalkInCheckInRequest(
        benh_nhan_id=bns[0].id,
        bac_si_id=bs1.id,
        ca_kham="sang",
        ly_do_kham="Đau khớp gối",
    )
    res1 = await api_client.post("/api/v1/reception/walk-in", json=req1.model_dump(), headers=token_letan)
    assert res1.status_code == 201
    ticket1 = res1.json()["data"]
    assert ticket1["so_thu_tu_kham"] == 1
    assert ticket1["bac_si_id"] == bs1.id

    # 2. Bệnh nhân 2 vào BS 1 -> STT phải tự tăng lên 2 (không nhảy cóc)
    req2 = WalkInCheckInRequest(
        benh_nhan_id=bns[1].id,
        bac_si_id=bs1.id,
        ca_kham="sang",
        ly_do_kham="Tái phát viêm khớp",
    )
    res2 = await api_client.post("/api/v1/reception/walk-in", json=req2.model_dump(), headers=token_letan)
    assert res2.status_code == 201
    ticket2 = res2.json()["data"]
    assert ticket2["so_thu_tu_kham"] == 2
    assert ticket2["so_thu_tu_kham"] == ticket1["so_thu_tu_kham"] + 1

    # 3. Bệnh nhân 3 vào BS 1 -> STT phải tự tăng lên 3 (không nhảy cóc)
    req3 = WalkInCheckInRequest(
        benh_nhan_id=bns[2].id,
        bac_si_id=bs1.id,
        ca_kham="sang",
        ly_do_kham="Kiểm tra dịch khớp",
    )
    res3 = await api_client.post("/api/v1/reception/walk-in", json=req3.model_dump(), headers=token_letan)
    assert res3.status_code == 201
    ticket3 = res3.json()["data"]
    assert ticket3["so_thu_tu_kham"] == 3
    assert ticket3["so_thu_tu_kham"] == ticket2["so_thu_tu_kham"] + 1

    # 4. Bệnh nhân 4 vào BS 2 (buồng khám khác) -> STT phải bắt đầu độc lập từ 1
    req4 = WalkInCheckInRequest(
        benh_nhan_id=bns[3].id,
        bac_si_id=bs2.id,
        ca_kham="sang",
        ly_do_kham="Đau bụng quặn",
    )
    res4 = await api_client.post("/api/v1/reception/walk-in", json=req4.model_dump(), headers=token_letan)
    assert res4.status_code == 201
    ticket4 = res4.json()["data"]
    assert ticket4["so_thu_tu_kham"] == 1
    assert ticket4["bac_si_id"] == bs2.id


@pytest.mark.asyncio
async def test_walk_in_generates_hang_doi_record_cho_kham(api_client, booking, db_session):
    """
    Tiêu chí nghiệm thu 2:
    - Sinh bản ghi trong bảng hang_doi_kham với trạng thái CHO_KHAM.
    - Sinh bản ghi lich_kham tại chỗ tương ứng với trạng thái DA_TIEP_NHAN.
    """
    token_letan = booking.tokens["admin"]
    bs = booking.bs_x
    bn = booking.bn_a

    req = WalkInCheckInRequest(
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ca_kham="sang",
        ly_do_kham="Sốt xuất huyết nghi ngờ",
        ghi_chu="Bệnh nhân mệt nhiều, cần theo dõi huyết áp",
    )
    res = await api_client.post("/api/v1/reception/walk-in", json=req.model_dump(), headers=token_letan)
    assert res.status_code == 201
    data = res.json()["data"]
    ticket_id = data["id"]
    lich_id = data["lich_kham_id"]

    # Kiểm tra trực tiếp bản ghi trong bảng hang_doi_kham
    stmt_ticket = select(HangDoiKham).where(HangDoiKham.id == ticket_id)
    ticket_db = (await db_session.execute(stmt_ticket)).scalar_one()

    assert ticket_db.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value
    assert ticket_db.loai_hang_doi == LoaiHangDoiEnum.VANG_LAI.value
    assert ticket_db.so_lan_goi == 0
    assert ticket_db.thoi_gian_check_in is not None
    assert ticket_db.benh_nhan_id == bn.id
    assert ticket_db.bac_si_id == bs.id
    assert "Sốt xuất huyết nghi ngờ" in ticket_db.ghi_chu_dieu_phoi

    # Kiểm tra trực tiếp bản ghi trong bảng lich_kham (tạo tại chỗ cho vãng lai)
    stmt_lich = select(LichKham).where(LichKham.id == lich_id)
    lich_db = (await db_session.execute(stmt_lich)).scalar_one()

    assert lich_db.trang_thai == TrangThaiLichEnum.DA_TIEP_NHAN.value
    assert "WLK" in lich_db.ma_lich_kham
    assert lich_db.benh_nhan_id == bn.id
    assert lich_db.bac_si_id == bs.id


@pytest.mark.asyncio
async def test_walk_in_supports_thermal_print_and_onscreen_display(api_client, booking, db_session):
    """
    Tiêu chí nghiệm thu 3:
    - Hỗ trợ in phiếu STT nhiệt mini hoặc xem trực tiếp trên màn hình.
    - Dữ liệu trả về (QueueTicketResponse) phải chứa đủ mọi trường thông tin cần thiết:
      + Số thứ tự khám (so_thu_tu_kham)
      + Tên bệnh nhân (ten_benh_nhan)
      + Số điện thoại bệnh nhân (so_dien_thoai)
      + Tên bác sĩ phụ trách (ten_bac_si)
      + Buồng khám / Vị trí phòng (phong_kham)
      + Ngày khám & Ca khám (ngay_kham, ca_kham)
      + Thời gian check-in (thoi_gian_check_in)
      + Trạng thái lượt khám (trang_thai = 'cho_kham')
    """
    token_letan = booking.tokens["admin"]
    bs = booking.bs_x
    bn = booking.bn_b

    # Gán số điện thoại cho bệnh nhân để in phiếu nhiệt
    await db_session.execute(
        update(NguoiDung)
        .where(NguoiDung.id == bn.nguoi_dung_id)
        .values(so_dien_thoai="0988776655")
    )
    await db_session.commit()

    # Gán buồng khám và chuyên khoa cho bác sĩ để phiếu in hiển thị rõ ràng
    suffix = uuid.uuid4().hex[:6]
    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK-{suffix}", ten_chuyen_khoa="Khoa Tai Mũi Họng", vi_tri_phong="Phòng 205 - Tầng 2")
    db_session.add(ck)
    await db_session.flush()

    bs.chuyen_khoa_id = ck.id
    await db_session.commit()

    req = WalkInCheckInRequest(
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ca_kham="sang",
        ly_do_kham="Khám amidan mạn tính",
    )
    res = await api_client.post("/api/v1/reception/walk-in", json=req.model_dump(), headers=token_letan)
    assert res.status_code == 201
    ticket = res.json()["data"]

    # 1. Kiểm tra các trường phục vụ hiển thị màn hình Lễ tân / Kiosk
    assert ticket["so_thu_tu_kham"] >= 1
    assert ticket["ten_benh_nhan"] is not None
    assert ticket["so_dien_thoai"] is not None
    assert ticket["ten_bac_si"] is not None
    assert ticket["ngay_kham"] == date.today().isoformat()
    assert ticket["ca_kham"] == "sang"
    assert ticket["trang_thai"] == "cho_kham"
    assert ticket["thoi_gian_check_in"] is not None

    # 2. Kiểm tra các trường phục vụ định dạng in phiếu nhiệt mini (58mm/80mm Thermal Printer)
    # Phiếu in nhiệt yêu cầu: Mã phiếu, STT to rõ ràng, Tên BN, Vị trí phòng khám, Bác sĩ khám
    thermal_print_payload = {
        "tieu_de": "PHIẾU KHÁM BỆNH VÃNG LAI",
        "stt": ticket["so_thu_tu_kham"],
        "benh_nhan": ticket["ten_benh_nhan"],
        "so_dien_thoai": ticket["so_dien_thoai"],
        "buong_kham": ticket["phong_kham"] or "Phòng khám Ngoại trú",
        "bac_si": ticket["ten_bac_si"],
        "thoi_gian": ticket["thoi_gian_check_in"],
        "loai_ve": ticket["loai_hang_doi"],
    }

    assert thermal_print_payload["stt"] >= 1
    assert len(thermal_print_payload["benh_nhan"]) > 0
    assert len(thermal_print_payload["bac_si"]) > 0
    assert thermal_print_payload["loai_ve"] == "vang_lai"


@pytest.mark.asyncio
async def test_walk_in_auto_assign_doctor_when_not_selected(api_client, booking, db_session):
    """
    Kiểm tra tiếp nhận vãng lai tự động cân bằng tải (Auto-assign):
    Khi bệnh nhân vãng lai không chọn đích danh bác sĩ mà chỉ chọn chuyên khoa,
    hệ thống tự động tìm bác sĩ đang trực có số lượng bệnh nhân chờ ít nhất.
    """
    token_letan = booking.tokens["admin"]
    today = date.today()
    suffix = uuid.uuid4().hex[:6]

    # Tạo chuyên khoa và 2 bác sĩ cùng chuyên khoa
    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK-{suffix}", ten_chuyen_khoa="Khoa Mắt", vi_tri_phong="Phòng 301")
    db_session.add(ck)
    await db_session.flush()

    nd_bs1 = NguoiDung(ho_ten="BS Mắt 1", email=f"bs1.{suffix}@clinic.com", so_dien_thoai=f"0933{suffix[:6]}")
    nd_bs2 = NguoiDung(ho_ten="BS Mắt 2", email=f"bs2.{suffix}@clinic.com", so_dien_thoai=f"0934{suffix[:6]}")
    nd_bn = NguoiDung(ho_ten="BN Chờ Auto", email=f"bn.{suffix}@clinic.com", so_dien_thoai=f"0935{suffix[:6]}")
    db_session.add_all([nd_bs1, nd_bs2, nd_bn])
    await db_session.flush()

    bs1 = BacSi(nguoi_dung_id=nd_bs1.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN1-{suffix}", is_active=True)
    bs2 = BacSi(nguoi_dung_id=nd_bs2.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN2-{suffix}", is_active=True)
    bn = BenhNhan(nguoi_dung_id=nd_bn.id, ma_dinh_danh_y_te=f"BN-{suffix}")
    db_session.add_all([bs1, bs2, bn])
    await db_session.flush()

    # Cả 2 bác sĩ đều có ca trực sáng nay
    shift1 = LichLamViec(bac_si_id=bs1.id, ngay_lam_viec=today, ca_lam_viec="sang", gio_bat_dau=time(8, 0), gio_ket_thuc=time(12, 0), is_active=True)
    shift2 = LichLamViec(bac_si_id=bs2.id, ngay_lam_viec=today, ca_lam_viec="sang", gio_bat_dau=time(8, 0), gio_ket_thuc=time(12, 0), is_active=True)
    db_session.add_all([shift1, shift2])
    await db_session.commit()

    # Tiếp nhận vãng lai không chọn bác sĩ (bac_si_id = None)
    req = WalkInCheckInRequest(
        benh_nhan_id=bn.id,
        bac_si_id=None,
        chuyen_khoa_id=ck.id,
        ca_kham="sang",
        ly_do_kham="Cộm mắt, ngứa mắt",
    )
    res = await api_client.post("/api/v1/reception/walk-in", json=req.model_dump(), headers=token_letan)
    assert res.status_code == 201
    ticket = res.json()["data"]

    # Đảm bảo được gán vào 1 trong 2 bác sĩ thuộc chuyên khoa Mắt
    assert ticket["bac_si_id"] in [bs1.id, bs2.id]
    assert ticket["trang_thai"] == "cho_kham"
    assert ticket["so_thu_tu_kham"] == 1


@pytest.mark.asyncio
async def test_walk_in_rejected_when_shift_quota_exceeded(db_session):
    """
    Kiểm tra ràng buộc hạn ngạch ca trực:
    Khi bác sĩ đã tiếp nhận đủ chỉ tiêu vãng lai (han_muc_vang_lai)
    thì hệ thống ném ngoại lệ ConflictException từ chối tiếp nhận thêm.
    """
    from app.core.exceptions import ConflictException

    suffix = uuid.uuid4().hex[:6]
    today = date.today()

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK-{suffix}", ten_chuyen_khoa="Khoa Ngoại", is_active=True)
    db_session.add(ck)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten="BS Ngoại", email=f"bs.{suffix}@clinic.com", so_dien_thoai=f"0944{suffix[:6]}")
    nd_bn1 = NguoiDung(ho_ten="BN 1", email=f"bn1.{suffix}@clinic.com", so_dien_thoai=f"0945{suffix[:6]}")
    nd_bn2 = NguoiDung(ho_ten="BN 2", email=f"bn2.{suffix}@clinic.com", so_dien_thoai=f"0946{suffix[:6]}")
    nd_lt = NguoiDung(ho_ten="Lễ Tân", email=f"lt.{suffix}@clinic.com", so_dien_thoai=f"0947{suffix[:6]}")
    db_session.add_all([nd_bs, nd_bn1, nd_bn2, nd_lt])
    await db_session.flush()

    bs = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-{suffix}", is_active=True)
    bn1 = BenhNhan(nguoi_dung_id=nd_bn1.id, ma_dinh_danh_y_te=f"BN-{suffix}-01")
    bn2 = BenhNhan(nguoi_dung_id=nd_bn2.id, ma_dinh_danh_y_te=f"BN-{suffix}-02")
    tk_lt = TaiKhoan(nguoi_dung_id=nd_lt.id, email=f"lt.{suffix}@clinic.com", mat_khau_hash="x", vai_tro=VaiTroEnum.LE_TAN.value)
    db_session.add_all([bs, bn1, bn2, tk_lt])
    await db_session.flush()

    # Ca trực chỉ tiếp nhận tối đa 1 bệnh nhân vãng lai
    shift = LichLamViec(
        bac_si_id=bs.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        han_muc_vang_lai=1,
        is_active=True,
    )
    db_session.add(shift)
    await db_session.commit()

    # Bệnh nhân 1 tiếp nhận thành công
    res1 = await queue_service.check_in_walk_in(
        payload=WalkInCheckInRequest(benh_nhan_id=bn1.id, bac_si_id=bs.id, ca_kham="sang"),
        receptionist_user=tk_lt,
        db=db_session,
    )
    assert res1.so_thu_tu_kham == 1

    # Bệnh nhân 2 vào tiếp nhận -> Bị chặn do chạm trần chỉ tiêu vãng lai = 1
    with pytest.raises(ConflictException) as exc:
        await queue_service.check_in_walk_in(
            payload=WalkInCheckInRequest(benh_nhan_id=bn2.id, bac_si_id=bs.id, ca_kham="sang"),
            receptionist_user=tk_lt,
            db=db_session,
        )
    assert "tiếp nhận đủ chỉ tiêu vãng lai" in str(exc.value.message)
