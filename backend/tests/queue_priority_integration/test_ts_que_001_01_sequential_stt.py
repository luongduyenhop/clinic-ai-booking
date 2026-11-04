"""
Integration Test Suite: TS-QUE-001-01
Requirement: QUE-001
Preconditions:
  - Backend/Frontend baseline commit 8a42575
  - PostgreSQL revision 015
  - Tài khoản phân hệ Queue Management (Lễ tân / Admin) sẵn sàng

Mục tiêu kiểm thử:
  - Cấp số thứ tự khám tuần tự, không trùng lặp trong ngày theo từng buồng khám.
  - Đảm bảo tính toàn vẹn (Unique / No duplicate STT) khi nhiều quầy tiếp đón cùng cấp số.
  - Cách ly dãy số thứ tự độc lập giữa các buồng khám khác nhau.
  - Cơ chế Idempotency chống nhân bản vé / cấp trùng STT cho cùng một lịch hẹn.
"""
import uuid
from datetime import datetime, time, timedelta, timezone
import pytest
from sqlalchemy import select

from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
    LoaiHangDoiEnum,
    CaLamViecEnum,
)
from app.models.user import (
    BacSi,
    BenhNhan,
    ChuyenKhoa,
    NguoiDung,
    PhongKham,
    VaiTroEnum,
)
from app.schemas.queue import WalkInCheckInRequest, CheckInRequest
from app.services.appointment_service import clinic_now


async def _tao_benh_nhan_moi(db_session, suffix: str, idx: int) -> BenhNhan:
    """Tạo bệnh nhân mới với dữ liệu định danh duy nhất"""
    nd = NguoiDung(
        ho_ten=f"Bệnh Nhân Test QUE-001-{idx}",
        email=f"bn.que001.{suffix}.{idx}@clinic.com",
        so_dien_thoai=f"097{uuid.uuid4().int % 10000000:07d}",
    )
    db_session.add(nd)
    await db_session.flush()

    bn = BenhNhan(
        nguoi_dung_id=nd.id,
        ma_dinh_danh_y_te=f"BN-QUE-{suffix}-{idx}",
    )
    db_session.add(bn)
    await db_session.commit()
    return bn


@pytest.mark.asyncio
async def test_ts_que_001_01_sequential_stt_per_room_and_day(api_client, booking, db_session):
    """
    TS-QUE-001-01 Step 1:
    Cấp số thứ tự khám tuần tự, không trùng lặp trong ngày theo buồng khám.
    - Cấp 5 số liên tiếp cho cùng 1 buồng khám / bác sĩ trong ca.
    - Kiểm chứng: so_thu_tu_kham tăng tuần tự 1 -> 2 -> 3 -> 4 -> 5 không nhảy cóc, không trùng lặp.
    - ma_so_thu_tu có tiền tố buồng khám (ví dụ: NOI-01, NOI-02...).
    """
    token_letan = booking.tokens["admin"]
    bs = booking.bs_x
    today = clinic_now().date()
    suffix = uuid.uuid4().hex[:6]

    # 1. Thiết lập Chuyên khoa và Buồng khám vật lý
    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"KHOA_NOI_{suffix}",
        ten_chuyen_khoa=f"Khoa Nội {suffix}",
        vi_tri_phong="Phòng 101 - Tầng 1",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()

    pk = PhongKham(
        ma_phong=f"P101-{suffix}",
        ten_phong="Phòng Khám Nội 101",
        chuyen_khoa_id=ck.id,
        is_active=True,
    )
    db_session.add(pk)
    await db_session.flush()

    bs.chuyen_khoa_id = ck.id
    bs.phong_kham_id = pk.id

    # 2. Tạo lịch trực ca sáng hôm nay cho Bác sĩ tại buồng khám (hạn mức vãng lai lớn để tiếp nhận đủ)
    shift = LichLamViec(
        bac_si_id=bs.id,
        phong_kham_id=pk.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=30,
        han_muc_vang_lai=20,
        is_active=True,
    )
    db_session.add(shift)
    await db_session.commit()

    # 3. Tiếp nhận tuần tự 5 bệnh nhân vãng lai vào buồng khám
    so_thu_tu_nhan_duoc = []
    ma_so_thu_tu_nhan_duoc = []

    for i in range(1, 6):
        bn = await _tao_benh_nhan_moi(db_session, suffix, i)
        req = WalkInCheckInRequest(
            benh_nhan_id=bn.id,
            bac_si_id=bs.id,
            ca_kham="sang",
            ly_do_kham=f"Khám tổng quát lượt {i}",
        )
        res = await api_client.post("/api/v1/reception/walk-in", json=req.model_dump(), headers=token_letan)
        assert res.status_code == 201
        ticket = res.json()["data"]

        so_thu_tu_nhan_duoc.append(ticket["so_thu_tu_kham"])
        ma_so_thu_tu_nhan_duoc.append(ticket["ma_so_thu_tu"])
        assert ticket["bac_si_id"] == bs.id
        assert ticket["phong_kham_id"] == pk.id
        assert ticket["trang_thai"] == TrangThaiHangDoiEnum.CHO_KHAM.value

    # 4. Xác nhận tính tuần tự và không trùng lặp
    assert so_thu_tu_nhan_duoc == [1, 2, 3, 4, 5], "STT phải tăng tuần tự từ 1 đến 5 không nhảy cóc"
    assert len(set(so_thu_tu_nhan_duoc)) == 5, "Không được phép có STT trùng lặp"
    assert ma_so_thu_tu_nhan_duoc[0] == "NOI-01"
    assert ma_so_thu_tu_nhan_duoc[4] == "NOI-05"


@pytest.mark.asyncio
async def test_ts_que_001_01_independent_stt_per_room(api_client, booking, db_session):
    """
    TS-QUE-001-01:
    Cách ly STT độc lập giữa các buồng khám khác nhau trong cùng ngày.
    - Buồng 1 (Phòng 101, Khoa Nội): cấp STT 1, 2, 3.
    - Buồng 2 (Phòng 201, Khoa Tai Mũi Họng): cấp bệnh nhân mới -> STT phải bắt đầu độc lập từ 1.
    """
    token_letan = booking.tokens["admin"]
    bs1 = booking.bs_x
    bs2 = booking.bs_y
    today = clinic_now().date()
    suffix = uuid.uuid4().hex[:6]

    # Buồng 1: Khoa Nội (Phòng 101)
    ck1 = ChuyenKhoa(
        ma_chuyen_khoa=f"KHOA_NOI_{suffix}",
        ten_chuyen_khoa=f"Khoa Nội {suffix}",
        vi_tri_phong="Phòng 101",
        is_active=True,
    )
    # Buồng 2: Khoa Tai Mũi Họng (Phòng 201)
    ck2 = ChuyenKhoa(
        ma_chuyen_khoa=f"KHOA_TMH_{suffix}",
        ten_chuyen_khoa=f"Khoa Tai Mũi Họng {suffix}",
        vi_tri_phong="Phòng 201",
        is_active=True,
    )
    db_session.add_all([ck1, ck2])
    await db_session.flush()

    pk1 = PhongKham(ma_phong=f"P101-{suffix}", ten_phong="Phòng 101", chuyen_khoa_id=ck1.id, is_active=True)
    pk2 = PhongKham(ma_phong=f"P201-{suffix}", ten_phong="Phòng 201", chuyen_khoa_id=ck2.id, is_active=True)
    db_session.add_all([pk1, pk2])
    await db_session.flush()

    bs1.chuyen_khoa_id = ck1.id
    bs1.phong_kham_id = pk1.id
    bs2.chuyen_khoa_id = ck2.id
    bs2.phong_kham_id = pk2.id

    shift1 = LichLamViec(
        bac_si_id=bs1.id,
        phong_kham_id=pk1.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=30,
        han_muc_vang_lai=20,
        is_active=True,
    )
    shift2 = LichLamViec(
        bac_si_id=bs2.id,
        phong_kham_id=pk2.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=30,
        han_muc_vang_lai=20,
        is_active=True,
    )
    db_session.add_all([shift1, shift2])
    await db_session.commit()

    # Cấp 3 số cho Buồng 1
    for i in range(1, 4):
        bn = await _tao_benh_nhan_moi(db_session, suffix, i)
        req = WalkInCheckInRequest(benh_nhan_id=bn.id, bac_si_id=bs1.id, ca_kham="sang", ly_do_kham=f"Buồng 1 lượt {i}")
        res = await api_client.post("/api/v1/reception/walk-in", json=req.model_dump(), headers=token_letan)
        assert res.status_code == 201
        assert res.json()["data"]["so_thu_tu_kham"] == i

    # Cấp 2 số cho Buồng 2 -> STT phải reset bắt đầu độc lập từ 1
    bn_b2_1 = await _tao_benh_nhan_moi(db_session, suffix, 101)
    req_b2_1 = WalkInCheckInRequest(benh_nhan_id=bn_b2_1.id, bac_si_id=bs2.id, ca_kham="sang", ly_do_kham="Buồng 2 lượt 1")
    res_b2_1 = await api_client.post("/api/v1/reception/walk-in", json=req_b2_1.model_dump(), headers=token_letan)
    assert res_b2_1.status_code == 201
    ticket_b2_1 = res_b2_1.json()["data"]
    assert ticket_b2_1["so_thu_tu_kham"] == 1, "Buồng khám khác phải có STT khởi tạo độc lập từ 1"
    assert ticket_b2_1["ma_so_thu_tu"] == "TMH-01"

    bn_b2_2 = await _tao_benh_nhan_moi(db_session, suffix, 102)
    req_b2_2 = WalkInCheckInRequest(benh_nhan_id=bn_b2_2.id, bac_si_id=bs2.id, ca_kham="sang", ly_do_kham="Buồng 2 lượt 2")
    res_b2_2 = await api_client.post("/api/v1/reception/walk-in", json=req_b2_2.model_dump(), headers=token_letan)
    assert res_b2_2.status_code == 201
    ticket_b2_2 = res_b2_2.json()["data"]
    assert ticket_b2_2["so_thu_tu_kham"] == 2
    assert ticket_b2_2["ma_so_thu_tu"] == "TMH-02"


@pytest.mark.asyncio
async def test_ts_que_001_01_multi_counter_checkin_no_duplicate(api_client, booking, db_session):
    """
    TS-QUE-001-01 Multi-Counter Requirement:
    Đảm bảo không trùng STT khi nhiều quầy Lễ tân cùng cấp số cho 1 buồng khám.
    - Giả lập Quầy 1 và Quầy 2 lần lượt tiếp nhận các bệnh nhân vào cùng 1 buồng khám trong ngày.
    - Kiểm chứng: Tất cả các vé trả về đều có STT riêng biệt tăng dần (1, 2, 3, 4), không bị trùng STT.
    """
    token_counter_1 = booking.tokens["admin"]
    token_counter_2 = booking.tokens["admin"]
    bs = booking.bs_x
    today = clinic_now().date()
    suffix = uuid.uuid4().hex[:6]

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"KHOA_CONC_{suffix}",
        ten_chuyen_khoa=f"Khoa Concurrent {suffix}",
        vi_tri_phong="Phòng 105 - Tầng 1",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()

    pk = PhongKham(ma_phong=f"P105-{suffix}", ten_phong="Phòng 105", chuyen_khoa_id=ck.id, is_active=True)
    db_session.add(pk)
    await db_session.flush()

    bs.chuyen_khoa_id = ck.id
    bs.phong_kham_id = pk.id
    shift = LichLamViec(
        bac_si_id=bs.id,
        phong_kham_id=pk.id,
        ngay_lam_viec=today,
        ca_lam_viec="sang",
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        gioi_han_ca_kham=30,
        han_muc_vang_lai=20,
        is_active=True,
    )
    db_session.add(shift)
    await db_session.commit()

    # Chuẩn bị trước 4 bệnh nhân
    patients = []
    for i in range(1, 5):
        bn = await _tao_benh_nhan_moi(db_session, suffix, 200 + i)
        patients.append(bn)

    # Giả lập Quầy 1 và Quầy 2 luân phiên cấp số cho cùng buồng khám
    counter_tokens = [token_counter_1, token_counter_2, token_counter_1, token_counter_2]
    stt_list = []

    for i, (p, token) in enumerate(zip(patients, counter_tokens)):
        req = WalkInCheckInRequest(
            benh_nhan_id=p.id,
            bac_si_id=bs.id,
            ca_kham="sang",
            ly_do_kham=f"Tiếp nhận tại quầy {(i % 2) + 1}",
        )
        res = await api_client.post("/api/v1/reception/walk-in", json=req.model_dump(), headers=token)
        assert res.status_code == 201
        data = res.json()["data"]
        stt_list.append(data["so_thu_tu_kham"])

    # Xác nhận KHÔNG TRÙNG LẶP STT giữa các quầy
    assert len(stt_list) == len(set(stt_list)), f"Phát hiện trùng lặp STT giữa các quầy: {stt_list}"
    assert sorted(stt_list) == [1, 2, 3, 4], f"Tập hợp STT phải đầy đủ từ 1 đến 4, nhận được: {sorted(stt_list)}"


@pytest.mark.asyncio
async def test_ts_que_001_01_idempotency_prevents_duplicate_stt(api_client, booking, db_session):
    """
    TS-QUE-001-01 Idempotency Rule:
    Khi cùng một lịch hẹn đã được cấp số thứ tự, nếu Lễ tân vô tình bấm Check-in lần 2:
    - Hệ thống không tạo vé mới.
    - Không cấp thêm số thứ tự mới gây nhảy cóc/trùng lặp.
    - Trả về chính xác thông tin vé và STT đã cấp ban đầu.
    """
    token_letan = booking.tokens["admin"]
    bs = booking.bs_x
    bn = booking.bn_a
    today = clinic_now().date()
    suffix = uuid.uuid4().hex[:6]

    ck = ChuyenKhoa(ma_chuyen_khoa=f"CK-IDEM-{suffix}", ten_chuyen_khoa=f"Khoa Idempotency {suffix}", vi_tri_phong="Phòng 103", is_active=True)
    db_session.add(ck)
    await db_session.flush()
    bs.chuyen_khoa_id = ck.id

    now_clinic = clinic_now()
    lich = LichKham(
        ma_lich_kham=f"LK-IDEM-{suffix}",
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ngay_kham=today,
        gio_kham=(now_clinic + timedelta(minutes=15)).time(),
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        ly_do_kham="Khám huyết áp",
    )
    db_session.add(lich)
    await db_session.commit()

    # Lần check-in thứ 1 -> Thành công tạo vé với STT
    req1 = CheckInRequest(lich_kham_id=lich.id)
    res1 = await api_client.post("/api/v1/reception/check-in", json=req1.model_dump(), headers=token_letan)
    assert res1.status_code == 201
    t1 = res1.json()["data"]
    stt_first = t1["so_thu_tu_kham"]

    # Lần check-in thứ 2 (Trùng lặp từ quầy) -> Idempotent, không sinh STT mới
    res2 = await api_client.post("/api/v1/reception/check-in", json=req1.model_dump(), headers=token_letan)
    assert res2.status_code in (200, 201)
    t2 = res2.json()["data"]

    # Kiểm chứng: Trả về cùng ID vé và cùng STT, không làm tăng STT
    assert t1["id"] == t2["id"]
    assert t2["so_thu_tu_kham"] == stt_first
    assert t2["trang_thai"] == TrangThaiHangDoiEnum.CHO_KHAM.value
