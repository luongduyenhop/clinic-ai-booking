import uuid
from datetime import date, datetime, time, timedelta, timezone
import pytest
from sqlalchemy import select, update

from app.core.config import settings
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    LoaiHangDoiEnum,
    LyDoUuTienEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, PhongKham
from app.schemas.queue import CheckInRequest, WalkInCheckInRequest, WalkInQuickRequest


def _get_clinic_now():
    clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
    return datetime.now(clinic_tz).replace(tzinfo=None)


# ==============================================================================
# PHẦN 1: CHECK-IN BỆNH NHÂN ĐÃ ĐẶT LỊCH HẸN TRƯỚC (ONLINE BOOKING)
# ==============================================================================

@pytest.mark.asyncio
async def test_checkin_online_appointment_success(api_client, booking, db_session):
    """
    Check-in cho bệnh nhân đã đặt lịch hẹn online:
    - Trạng thái LichKham chuyển sang DA_TIEP_NHAN.
    - Sinh HangDoiKham liên kết đúng lich_kham_id.
    - Cấp số thứ tự khám (so_thu_tu_kham) và mã STT buồng khám (ma_so_thu_tu).
    """
    token_letan = booking.tokens["admin"]
    today = date.today()
    bs = booking.bs_x
    bn = booking.bn_a

    # Gán chuyên khoa cho BS
    suffix = uuid.uuid4().hex[:6]
    ck = ChuyenKhoa(ma_chuyen_khoa=f"KHOA_NOI_{suffix}", ten_chuyen_khoa=f"Khoa Nội {suffix}", vi_tri_phong="Phòng 101")
    db_session.add(ck)
    await db_session.flush()
    bs.chuyen_khoa_id = ck.id

    now_clinic = _get_clinic_now()
    gio_kham = (now_clinic + timedelta(minutes=10)).time()
    lich = LichKham(
        ma_lich_kham=f"LK-ONLINE-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ngay_kham=today,
        gio_kham=gio_kham,
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        ly_do_kham="Khám định kỳ huyết áp",
    )
    db_session.add(lich)
    await db_session.commit()

    # Thực hiện Check-in tại quầy lễ tân
    req = CheckInRequest(lich_kham_id=lich.id, ghi_chu="Bệnh nhân đến đúng giờ")
    res = await api_client.post("/api/v1/reception/check-in", json=req.model_dump(), headers=token_letan)
    assert res.status_code == 201
    ticket = res.json()["data"]

    # Kiểm tra ticket response
    assert ticket["lich_kham_id"] == lich.id
    assert ticket["benh_nhan_id"] == bn.id
    assert ticket["bac_si_id"] == bs.id
    assert ticket["so_thu_tu_kham"] >= 1
    assert ticket["ma_so_thu_tu"] is not None
    assert ticket["trang_thai"] == "cho_kham"
    assert ticket["loai_hang_doi"] == "dung_hen"

    # Kiểm tra DB: LichKham chuyển sang DA_TIEP_NHAN
    stmt_lich = select(LichKham).where(LichKham.id == lich.id)
    lich_db = (await db_session.execute(stmt_lich)).scalar_one()
    assert lich_db.trang_thai == TrangThaiLichEnum.DA_TIEP_NHAN.value


@pytest.mark.asyncio
async def test_checkin_online_arrival_window_priority(api_client, booking, db_session):
    """
    Kiểm thử phân loại khung giờ đến của bệnh nhân đặt hẹn trước:
    - Đến sớm > 30 phút: loai_hang_doi = den_som, muc_do_uu_tien = 4
    - Đúng giờ (-15p đến +30p): loai_hang_doi = dung_hen, muc_do_uu_tien = 2
    - Đến muộn > 15 phút: loai_hang_doi = den_muon, muc_do_uu_tien = 5
    """
    token_admin = booking.tokens["admin"]
    today = date.today()
    now_clinic = _get_clinic_now()

    # 1. Ca đến sớm
    gio_som = (now_clinic + timedelta(minutes=45)).time()
    lich_som = LichKham(
        ma_lich_kham=f"LK-EARLY-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=gio_som,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    # 2. Ca đúng giờ
    gio_dung = (now_clinic + timedelta(minutes=10)).time()
    lich_dung = LichKham(
        ma_lich_kham=f"LK-ONTIME-{booking.suffix}",
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=gio_dung,
        so_thu_tu=2,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    # 3. Ca đến muộn
    gio_muon = (now_clinic - timedelta(minutes=25)).time()
    lich_muon = LichKham(
        ma_lich_kham=f"LK-LATE-{booking.suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=gio_muon,
        so_thu_tu=3,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )

    db_session.add_all([lich_som, lich_dung, lich_muon])
    await db_session.commit()

    res_som = await api_client.post("/api/v1/reception/check-in", json={"lich_kham_id": lich_som.id}, headers=token_admin)
    assert res_som.status_code == 201
    assert res_som.json()["data"]["loai_hang_doi"] == "den_som"
    assert res_som.json()["data"]["muc_do_uu_tien"] == 4

    res_dung = await api_client.post("/api/v1/reception/check-in", json={"lich_kham_id": lich_dung.id}, headers=token_admin)
    assert res_dung.status_code == 201
    assert res_dung.json()["data"]["loai_hang_doi"] == "dung_hen"
    assert res_dung.json()["data"]["muc_do_uu_tien"] == 2

    res_muon = await api_client.post("/api/v1/reception/check-in", json={"lich_kham_id": lich_muon.id}, headers=token_admin)
    assert res_muon.status_code == 201
    assert res_muon.json()["data"]["loai_hang_doi"] == "den_muon"
    assert res_muon.json()["data"]["muc_do_uu_tien"] == 5


@pytest.mark.asyncio
async def test_checkin_online_idempotency_returns_existing_ticket(api_client, booking, db_session):
    """
    Tính chất lũy đoán (Idempotency):
    Khi lễ tân quét hoặc bấm Check-in 2 lần cho cùng 1 lịch hẹn:
    Hệ thống trả về vé cũ đã cấp, không sinh trùng vé và không tăng STT.
    """
    token_letan = booking.tokens["admin"]
    today = date.today()
    now_clinic = _get_clinic_now()

    lich = LichKham(
        ma_lich_kham=f"LK-IDEM-{uuid.uuid4().hex[:6]}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        gio_kham=(now_clinic + timedelta(minutes=5)).time(),
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add(lich)
    await db_session.commit()

    # Lần 1: Cấp vé mới
    res1 = await api_client.post("/api/v1/reception/check-in", json={"lich_kham_id": lich.id}, headers=token_letan)
    assert res1.status_code == 201
    t1 = res1.json()["data"]

    # Lần 2: Quét lại -> trả về vé cũ
    res2 = await api_client.post("/api/v1/reception/check-in", json={"lich_kham_id": lich.id}, headers=token_letan)
    assert res2.status_code == 201
    t2 = res2.json()["data"]

    assert t1["id"] == t2["id"]
    assert t1["so_thu_tu_kham"] == t2["so_thu_tu_kham"]


@pytest.mark.asyncio
async def test_checkin_online_rejected_if_wrong_day(api_client, booking, db_session):
    """
    Chặn check-in nếu người bệnh đến không đúng ngày hẹn (ví dụ: hẹn ngày mai nhưng đến hôm nay).
    """
    token_letan = booking.tokens["admin"]
    tomorrow = date.today() + timedelta(days=1)

    lich_ngay_mai = LichKham(
        ma_lich_kham=f"LK-TOMORROW-{uuid.uuid4().hex[:6]}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=tomorrow,
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
    )
    db_session.add(lich_ngay_mai)
    await db_session.commit()

    res = await api_client.post("/api/v1/reception/check-in", json={"lich_kham_id": lich_ngay_mai.id}, headers=token_letan)
    assert res.status_code == 400
    assert "đúng ngày khám" in res.json()["message"]


# ==============================================================================
# PHẦN 2: TIẾP NHẬN BỆNH NHÂN VÃNG LAI (WALK-IN CHECK-IN)
# ==============================================================================

@pytest.mark.asyncio
async def test_walkin_stt_auto_increment_no_gap_per_room_and_day(api_client, booking, db_session):
    """
    Tiêu chí nghiệm thu 1:
    - STT tự tăng theo ngày và theo buồng khám/bác sĩ, không bị nhảy cóc (1 -> 2 -> 3).
    - Sang bác sĩ/buồng khám khác thì STT khởi tạo độc lập từ 1.
    """
    token_letan = booking.tokens["admin"]
    bs1 = booking.bs_x
    bs2 = booking.bs_y
    suffix = uuid.uuid4().hex[:6]

    bns = []
    for i in range(4):
        nd = NguoiDung(
            ho_ten=f"Bệnh Nhân Vãng Lai {i+1}",
            email=f"wlk_{suffix}_{i+1}@test.com",
            so_dien_thoai=f"0977{i+1:02d}{suffix[:4]}",
        )
        db_session.add(nd)
        await db_session.flush()
        bn = BenhNhan(nguoi_dung_id=nd.id, ma_dinh_danh_y_te=f"BN-WLK-{suffix}-{i+1}")
        db_session.add(bn)
        bns.append(bn)
    await db_session.commit()

    # 1. BN 1 vào BS 1 -> STT = 1
    req1 = WalkInCheckInRequest(benh_nhan_id=bns[0].id, bac_si_id=bs1.id, ca_kham="sang", ly_do_kham="Đau khớp gối")
    res1 = await api_client.post("/api/v1/reception/walk-in", json=req1.model_dump(), headers=token_letan)
    assert res1.status_code == 201
    ticket1 = res1.json()["data"]
    assert ticket1["so_thu_tu_kham"] == 1

    # 2. BN 2 vào BS 1 -> STT = 2 (liên tục không nhảy cóc)
    req2 = WalkInCheckInRequest(benh_nhan_id=bns[1].id, bac_si_id=bs1.id, ca_kham="sang", ly_do_kham="Tái phát viêm khớp")
    res2 = await api_client.post("/api/v1/reception/walk-in", json=req2.model_dump(), headers=token_letan)
    assert res2.status_code == 201
    ticket2 = res2.json()["data"]
    assert ticket2["so_thu_tu_kham"] == 2

    # 3. BN 3 vào BS 1 -> STT = 3
    req3 = WalkInCheckInRequest(benh_nhan_id=bns[2].id, bac_si_id=bs1.id, ca_kham="sang", ly_do_kham="Kiểm tra dịch khớp")
    res3 = await api_client.post("/api/v1/reception/walk-in", json=req3.model_dump(), headers=token_letan)
    assert res3.status_code == 201
    ticket3 = res3.json()["data"]
    assert ticket3["so_thu_tu_kham"] == 3

    # 4. BN 4 vào BS 2 -> STT reset độc lập từ 1
    req4 = WalkInCheckInRequest(benh_nhan_id=bns[3].id, bac_si_id=bs2.id, ca_kham="sang", ly_do_kham="Đau bụng quặn")
    res4 = await api_client.post("/api/v1/reception/walk-in", json=req4.model_dump(), headers=token_letan)
    assert res4.status_code == 201
    ticket4 = res4.json()["data"]
    assert ticket4["so_thu_tu_kham"] == 1
    assert ticket4["bac_si_id"] == bs2.id


@pytest.mark.asyncio
async def test_walkin_enters_queue_directly_without_lich_kham(api_client, booking, db_session):
    """
    Tiêu chí nghiệm thu 2 & Chuẩn hóa nghiệp vụ Vãng lai:
    - Sinh bản ghi trong bảng hang_doi_kham với trạng thái CHO_KHAM.
    - Khách vãng lai không đặt trước -> Không sinh bản ghi trong lich_kham (lich_kham_id = None).
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

    # Nghiệp vụ chuẩn hóa Lễ tân: Khách vãng lai không đặt hẹn trước -> lich_kham_id = None
    assert data["lich_kham_id"] is None
    assert ticket_db.lich_kham_id is None


@pytest.mark.asyncio
async def test_walkin_supports_thermal_print_and_onscreen_display_with_code(api_client, booking, db_session):
    """
    Tiêu chí nghiệm thu 3 & Mã STT tiền tố buồng khám:
    - Hỗ trợ in phiếu STT nhiệt mini hoặc xem trực tiếp trên màn hình.
    - Dữ liệu trả về (QueueTicketResponse) phải chứa đủ mọi trường thông tin cần thiết:
      + Số thứ tự khám (so_thu_tu_kham)
      + Mã số thứ tự buồng khám / chuyên khoa (ma_so_thu_tu, ví dụ: TMH-01, NOI-02...)
      + Tên bệnh nhân, số điện thoại, tên bác sĩ, vị trí buồng khám
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

    # Gán chuyên khoa Tai Mũi Họng để kiểm tra sinh tiền tố TMH
    suffix = uuid.uuid4().hex[:6]
    ck = ChuyenKhoa(ma_chuyen_khoa=f"KHOA_TMH_{suffix}", ten_chuyen_khoa="Khoa Tai Mũi Họng", vi_tri_phong="Phòng 205 - Tầng 2")
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
    assert ticket["ma_so_thu_tu"] is not None
    assert ticket["ma_so_thu_tu"].startswith("TMH-")
    assert ticket["ma_so_thu_tu"] == f"TMH-{ticket['so_thu_tu_kham']:02d}"
    assert ticket["ten_benh_nhan"] is not None
    assert ticket["so_dien_thoai"] == "0988776655"
    assert ticket["ten_bac_si"] is not None
    assert ticket["ngay_kham"] == date.today().isoformat()
    assert ticket["ca_kham"] == "sang"
    assert ticket["trang_thai"] == "cho_kham"
    assert ticket["thoi_gian_check_in"] is not None

    # 2. Kiểm tra định dạng payload phục vụ in máy nhiệt mini (58mm/80mm Thermal Printer)
    thermal_print_payload = {
        "tieu_de": "PHIẾU KHÁM BỆNH VÃNG LAI",
        "stt": ticket["so_thu_tu_kham"],
        "ma_so_thu_tu": ticket["ma_so_thu_tu"],
        "benh_nhan": ticket["ten_benh_nhan"],
        "so_dien_thoai": ticket["so_dien_thoai"],
        "buong_kham": ticket["phong_kham"] or "Phòng khám Ngoại trú",
        "bac_si": ticket["ten_bac_si"],
        "thoi_gian": ticket["thoi_gian_check_in"],
        "loai_ve": ticket["loai_hang_doi"],
    }
    assert thermal_print_payload["stt"] >= 1
    assert thermal_print_payload["ma_so_thu_tu"].startswith("TMH-")
    assert len(thermal_print_payload["benh_nhan"]) > 0
    assert thermal_print_payload["loai_ve"] == "vang_lai"


@pytest.mark.asyncio
async def test_walkin_auto_assign_doctor_when_not_selected(api_client, booking, db_session):
    """
    Tiếp nhận vãng lai khi người bệnh không chọn bác sĩ:
    Hệ thống tự động điều phối vào bác sĩ cùng chuyên khoa có ít người chờ nhất.
    """
    token_letan = booking.tokens["admin"]
    today = date.today()
    suffix = uuid.uuid4().hex[:6]

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK-MAT-{suffix}", ten_chuyen_khoa="Khoa Mắt", vi_tri_phong="Phòng 301")
    db_session.add(ck)
    await db_session.flush()

    nd_bs = NguoiDung(ho_ten=f"BS Mắt {suffix}", email=f"bs_mat_{suffix}@test.com")
    db_session.add(nd_bs)
    await db_session.flush()
    bs_mat = BacSi(nguoi_dung_id=nd_bs.id, chuyen_khoa_id=ck.id, hoc_vi="BSCKI", chung_chi_hanh_nghe=f"CCHN-{suffix}")
    db_session.add(bs_mat)
    await db_session.flush()

    llv = LichLamViec(
        bac_si_id=bs_mat.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        buoc_gio_hen_phut=15,
        gioi_han_ca_kham=20,
        han_muc_dat_truoc=15,
        han_muc_vang_lai=5,
    )
    db_session.add(llv)
    await db_session.commit()

    req = WalkInCheckInRequest(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=None,  # Không chọn bác sĩ
        chuyen_khoa_id=ck.id,  # Chỉ chọn chuyên khoa
        ca_kham="sang",
        ly_do_kham="Cộm ngứa rát mắt",
    )
    res = await api_client.post("/api/v1/reception/walk-in", json=req.model_dump(), headers=token_letan)
    assert res.status_code == 201
    ticket = res.json()["data"]
    assert ticket["bac_si_id"] == bs_mat.id
    assert ticket["so_thu_tu_kham"] >= 1


@pytest.mark.asyncio
async def test_walkin_priority_queue_elevation(api_client, booking, db_session):
    """
    Tiếp nhận vãng lai diện ưu tiên (cấp cứu nhẹ, người già >=80, thai phụ):
    Độ ưu tiên được gán mức 1 (cao nhất) để đẩy lên đầu hàng đợi.
    """
    token_letan = booking.tokens["admin"]
    bs = booking.bs_x
    bn = booking.bn_a

    req = WalkInCheckInRequest(
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ca_kham="sang",
        ly_do_kham="Cụ già 85 tuổi khó thở nhẹ",
        ly_do_uu_tien=LyDoUuTienEnum.NGUOI_GIA,
    )
    res = await api_client.post("/api/v1/reception/walk-in", json=req.model_dump(), headers=token_letan)
    assert res.status_code == 201
    ticket = res.json()["data"]
    assert ticket["muc_do_uu_tien"] == 1
    assert "Ưu tiên" in ticket["ghi_chu_dieu_phoi"]


@pytest.mark.asyncio
async def test_walkin_rejected_when_shift_quota_exceeded(api_client, booking, db_session):
    """
    Ràng buộc hạn mức ca trực:
    Khi số lượng vãng lai đã đạt trần `han_muc_vang_lai` của ca trực,
    hệ thống từ chối tiếp nhận thêm và trả về lỗi 400 Bad Request.
    """
    token_letan = booking.tokens["admin"]
    today = date.today()
    suffix = uuid.uuid4().hex[:6]

    nd_bs = NguoiDung(ho_ten=f"BS Quota {suffix}", email=f"bs_quota_{suffix}@test.com")
    db_session.add(nd_bs)
    await db_session.flush()
    bs_quota = BacSi(nguoi_dung_id=nd_bs.id, hoc_vi="BS", chung_chi_hanh_nghe=f"CCHN-QUOTA-{suffix}")
    db_session.add(bs_quota)
    await db_session.flush()

    # Ca trực chỉ nhận tối đa 1 bệnh nhân vãng lai
    llv = LichLamViec(
        bac_si_id=bs_quota.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        buoc_gio_hen_phut=15,
        gioi_han_ca_kham=10,
        han_muc_dat_truoc=9,
        han_muc_vang_lai=1,
    )
    db_session.add(llv)
    await db_session.commit()

    # Tiếp nhận BN 1 -> Thành công (1/1)
    req1 = WalkInCheckInRequest(benh_nhan_id=booking.bn_a.id, bac_si_id=bs_quota.id, ca_kham="sang", ly_do_kham="Khám 1")
    res1 = await api_client.post("/api/v1/reception/walk-in", json=req1.model_dump(), headers=token_letan)
    assert res1.status_code == 201

    # Tiếp nhận BN 2 -> Chặn do vượt trần (2/1) -> 409 Conflict
    req2 = WalkInCheckInRequest(benh_nhan_id=booking.bn_b.id, bac_si_id=bs_quota.id, ca_kham="sang", ly_do_kham="Khám 2")
    res2 = await api_client.post("/api/v1/reception/walk-in", json=req2.model_dump(), headers=token_letan)
    assert res2.status_code == 409
    assert "chỉ tiêu vãng lai" in res2.json()["message"]
