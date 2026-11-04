import uuid
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select

from app.models.appointment import (
    CaLamViecEnum,
    HangDoiKham,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
)
from app.models.user import BenhNhan, ChuyenKhoa, NguoiDung
from app.services.appointment_service import clinic_now


async def _tao_benh_nhan(db_session, suffix: str, index: int) -> BenhNhan:
    """Tạo nhanh bệnh nhân với định danh y tế và SĐT ngẫu nhiên, không trùng lặp seed data."""
    nd = NguoiDung(
        ho_ten=f"Bệnh Nhân Ưu Tiên {index} {suffix}",
        email=f"bn_priority_{index}_{suffix}@clinic-test.vn",
        so_dien_thoai=f"097{uuid.uuid4().int % 10000000:07d}",
    )
    db_session.add(nd)
    await db_session.flush()

    bn = BenhNhan(
        nguoi_dung_id=nd.id,
        ma_dinh_danh_y_te=f"BN-PRI-{suffix}-{index:02d}",
    )
    db_session.add(bn)
    await db_session.flush()
    return bn


@pytest.mark.asyncio
async def test_5_tier_full_priority_sequence_dispatch(api_client, booking, db_session):
    """
    Kiểm chứng đầy đủ chu trình điều phối 5 mức ưu tiên:
    B1 (Cấp cứu: tier 1)
    -> B2 (Đúng hẹn: tier 2)
    -> B3 (KQ CLS: tier 3)
    -> B4 (Đến sớm >30p: tier 4)
    -> B5 (Vãng lai / Muộn >15p: tier 5)

    Bác sĩ bấm 'Mời khám' (/api/v1/clinical/queue/call-next) tuần tự:
    - B1 đến muộn nhất nhưng được phục vụ ĐẦU TIÊN.
    - B5 đến sớm nhất nhưng phải nhường và được phục vụ CUỐI CÙNG.
    - Sau khi khám hết 5 ca, hàng đợi báo rỗng an toàn.
    """
    suffix = uuid.uuid4().hex[:6]
    token_bs = booking.tokens["bs_x"]
    bs = booking.bs_x
    today = clinic_now().date()
    now_utc = datetime.now(timezone.utc)

    # 1. Gán chuyên khoa và vị trí phòng khám cho bác sĩ
    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-PRI-{suffix}",
        ten_chuyen_khoa=f"Khoa Đa Khoa Ưu Tiên {suffix}",
        vi_tri_phong="Phòng 105 - Khu A",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()
    bs.chuyen_khoa_id = ck.id
    await db_session.commit()

    # 2. Tạo 5 bệnh nhân riêng biệt
    bn1 = await _tao_benh_nhan(db_session, suffix, 1)  # Cấp cứu
    bn2 = await _tao_benh_nhan(db_session, suffix, 2)  # Đúng hẹn
    bn3 = await _tao_benh_nhan(db_session, suffix, 3)  # Sau CLS
    bn4 = await _tao_benh_nhan(db_session, suffix, 4)  # Đến sớm
    bn5 = await _tao_benh_nhan(db_session, suffix, 5)  # Vãng lai

    # 3. Tạo 5 vé hàng đợi với thời gian check-in cố ý ngược lại:
    # Ca vãng lai check-in sớm nhất (50 phút trước), ca cấp cứu check-in muộn nhất (1 phút trước)
    ticket_b5_walkin = HangDoiKham(
        benh_nhan_id=bn5.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.VANG_LAI.value,
        muc_do_uu_tien=5,  # B5: Tier 5
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=50),
        so_lan_goi=0,
    )

    ticket_b4_early = HangDoiKham(
        benh_nhan_id=bn4.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        loai_hang_doi=LoaiHangDoiEnum.DEN_SOM.value,
        muc_do_uu_tien=4,  # B4: Tier 4
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=40),
        so_lan_goi=0,
    )

    ticket_b3_cls = HangDoiKham(
        benh_nhan_id=bn3.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=3,
        loai_hang_doi="tai_kham_cls",
        muc_do_uu_tien=3,  # B3: Tier 3
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=30),
        so_lan_goi=0,
    )

    ticket_b2_ontime = HangDoiKham(
        benh_nhan_id=bn2.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=4,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,  # B2: Tier 2
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=20),
        so_lan_goi=0,
    )

    ticket_b1_emergency = HangDoiKham(
        benh_nhan_id=bn1.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=5,
        loai_hang_doi="cap_cuu",
        muc_do_uu_tien=1,  # B1: Tier 1
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=1),
        so_lan_goi=0,
    )

    db_session.add_all([
        ticket_b5_walkin,
        ticket_b4_early,
        ticket_b3_cls,
        ticket_b2_ontime,
        ticket_b1_emergency,
    ])
    await db_session.commit()

    # Hàm trợ giúp hoàn thành lượt khám để giải phóng Guard A4 (chống khám đè) trước lần gọi kế tiếp
    async def _hoan_thanh_ve_hien_tai(ticket_id: int):
        stmt = select(HangDoiKham).where(HangDoiKham.id == ticket_id)
        tk = (await db_session.execute(stmt)).scalar_one()
        tk.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
        await db_session.commit()

    # 4. Kiểm chứng lần lượt 5 lần gọi khám theo đúng thứ tự ưu tiên:
    # Lần 1: Gọi B1 (Cấp cứu - Tier 1)
    res1 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res1.status_code == 200
    called1 = res1.json()["data"]["ticket"]
    assert called1["id"] == ticket_b1_emergency.id
    assert called1["muc_do_uu_tien"] == 1
    assert called1["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value
    await _hoan_thanh_ve_hien_tai(called1["id"])

    # Lần 2: Gọi B2 (Đúng hẹn - Tier 2)
    res2 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res2.status_code == 200
    called2 = res2.json()["data"]["ticket"]
    assert called2["id"] == ticket_b2_ontime.id
    assert called2["muc_do_uu_tien"] == 2
    assert called2["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value
    await _hoan_thanh_ve_hien_tai(called2["id"])

    # Lần 3: Gọi B3 (KQ CLS - Tier 3)
    res3 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res3.status_code == 200
    called3 = res3.json()["data"]["ticket"]
    assert called3["id"] == ticket_b3_cls.id
    assert called3["muc_do_uu_tien"] == 3
    assert called3["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value
    await _hoan_thanh_ve_hien_tai(called3["id"])

    # Lần 4: Gọi B4 (Đến sớm - Tier 4)
    res4 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res4.status_code == 200
    called4 = res4.json()["data"]["ticket"]
    assert called4["id"] == ticket_b4_early.id
    assert called4["muc_do_uu_tien"] == 4
    assert called4["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value
    await _hoan_thanh_ve_hien_tai(called4["id"])

    # Lần 5: Gọi B5 (Vãng lai - Tier 5)
    res5 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res5.status_code == 200
    called5 = res5.json()["data"]["ticket"]
    assert called5["id"] == ticket_b5_walkin.id
    assert called5["muc_do_uu_tien"] == 5
    assert called5["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value
    await _hoan_thanh_ve_hien_tai(called5["id"])

    # Lần 6: Hàng đợi rỗng
    res6 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res6.status_code == 200
    empty_data = res6.json()["data"]
    assert empty_data["ticket"] is None
    assert empty_data["so_nguoi_con_lai"] == 0
    assert "không còn bệnh nhân" in empty_data["message"]


@pytest.mark.asyncio
async def test_same_tier_tie_break_by_check_in_time(api_client, booking, db_session):
    """
    Kiểm chứng quy tắc Tie-Break:
    Khi 2 bệnh nhân có CÙNG MỨC ƯU TIÊN (ví dụ cùng Tier 2 - Đúng hẹn):
    - Bệnh nhân đến trước (check-in trước) phải luôn được gọi trước.
    - Bệnh nhân đến sau phải được gọi sau (First In, First Served).
    """
    suffix = uuid.uuid4().hex[:6]
    token_bs = booking.tokens["bs_x"]
    bs = booking.bs_x
    today = clinic_now().date()
    now_utc = datetime.now(timezone.utc)

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-TIE-{suffix}",
        ten_chuyen_khoa=f"Khoa Tie Break {suffix}",
        vi_tri_phong="Phòng 106 - Khu A",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()
    bs.chuyen_khoa_id = ck.id
    await db_session.commit()

    bn_a = await _tao_benh_nhan(db_session, suffix, 10)  # Đến trước
    bn_b = await _tao_benh_nhan(db_session, suffix, 20)  # Đến sau

    # Người A: Check-in trước (15 phút trước), STT 10
    ticket_a = HangDoiKham(
        benh_nhan_id=bn_a.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=10,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,  # Cùng Tier 2
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=15),
        so_lan_goi=0,
    )

    # Người B: Check-in sau (5 phút trước), STT 11
    ticket_b = HangDoiKham(
        benh_nhan_id=bn_b.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=11,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,  # Cùng Tier 2
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=5),
        so_lan_goi=0,
    )

    db_session.add_all([ticket_a, ticket_b])
    await db_session.commit()

    # Lần 1: Bác sĩ gọi -> Phải là vé A (check-in trước)
    res1 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res1.status_code == 200
    called1 = res1.json()["data"]["ticket"]
    assert called1["id"] == ticket_a.id
    assert called1["benh_nhan_id"] == bn_a.id

    # Hoàn thành lượt khám của vé A
    stmt_a = select(HangDoiKham).where(HangDoiKham.id == ticket_a.id)
    tk_a = (await db_session.execute(stmt_a)).scalar_one()
    tk_a.trang_thai = TrangThaiHangDoiEnum.DA_KHAM.value
    await db_session.commit()

    # Lần 2: Bác sĩ gọi -> Đến lượt vé B (check-in sau)
    res2 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res2.status_code == 200
    called2 = res2.json()["data"]["ticket"]
    assert called2["id"] == ticket_b.id
    assert called2["benh_nhan_id"] == bn_b.id


@pytest.mark.asyncio
async def test_tie_break_with_restored_queue_ticket_priority(api_client, booking, db_session):
    """
    Kiểm chứng quy tắc Tie-Break với ca tái xếp hàng sau tạm hoãn:
    Hệ thống sử dụng COALESCE(thoi_gian_xep_hang_lai, thoi_gian_check_in).
    - Vé X: Check-in từ 40 phút trước nhưng bị tạm hoãn, vừa xếp hàng lại cách đây 3 phút.
    - Vé Y: Check-in từ 12 phút trước, chưa từng bị tạm hoãn.
    -> Vé Y có thời gian chờ liên tục hiệu lực (12p) dài hơn thời gian xếp hàng lại của Vé X (3p),
       do đó Vé Y được gọi trước Vé X.
    """
    suffix = uuid.uuid4().hex[:6]
    token_bs = booking.tokens["bs_x"]
    bs = booking.bs_x
    today = clinic_now().date()
    now_utc = datetime.now(timezone.utc)

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-RES-{suffix}",
        ten_chuyen_khoa=f"Khoa Requeue {suffix}",
        vi_tri_phong="Phòng 107 - Khu A",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()
    bs.chuyen_khoa_id = ck.id
    await db_session.commit()

    bn_x = await _tao_benh_nhan(db_session, suffix, 30)
    bn_y = await _tao_benh_nhan(db_session, suffix, 31)

    # Vé X: Cùng Tier 4, check-in sớm (40p trước), nhưng xếp hàng lại cách đây 3 phút
    ticket_x = HangDoiKham(
        benh_nhan_id=bn_x.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=30,
        loai_hang_doi=LoaiHangDoiEnum.DEN_SOM.value,
        muc_do_uu_tien=4,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=40),
        thoi_gian_xep_hang_lai=now_utc - timedelta(minutes=3),
        so_lan_goi=1,
    )

    # Vé Y: Cùng Tier 4, check-in 12 phút trước, không có thoi_gian_xep_hang_lai
    ticket_y = HangDoiKham(
        benh_nhan_id=bn_y.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=31,
        loai_hang_doi=LoaiHangDoiEnum.DEN_SOM.value,
        muc_do_uu_tien=4,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=12),
        thoi_gian_xep_hang_lai=None,
        so_lan_goi=0,
    )

    db_session.add_all([ticket_x, ticket_y])
    await db_session.commit()

    # Bác sĩ bấm gọi: Vé Y phải được gọi TRƯỚC Vé X
    res = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res.status_code == 200
    called = res.json()["data"]["ticket"]
    assert called["id"] == ticket_y.id
    assert called["benh_nhan_id"] == bn_y.id


@pytest.mark.asyncio
async def test_postpone_sets_priority_6_and_restore_sets_priority_4_with_wait_time_reset(api_client, booking, db_session):
    """
    Kiểm chứng quy trình Tạm hoãn -> Phục hồi:
    1. Khi ca khám bị Tạm hoãn (/postpone):
       - Trạng thái chuyển sang 'tam_hoan'
       - Mức ưu tiên được chuyển thành Mức 6 (tự động tụt sau 5 mức chờ thông thường).
    2. Khi bệnh nhân quay lại báo danh và Lễ tân bấm Phục hồi (/restore):
       - Trạng thái quay trở lại 'cho_kham'
       - Mức ưu tiên được đưa về Mức 4 (nhường cấp cứu, đúng giờ, CLS; trên vãng lai)
       - Ghi nhận mốc thoi_gian_xep_hang_lai = now
       - Tính lại thời gian chờ từ thời điểm phục hồi (thoi_gian_cho_phut được reset về 0).
    """
    suffix = uuid.uuid4().hex[:6]
    token_bs = booking.tokens["bs_x"]
    token_letan = booking.tokens["admin"]
    bs = booking.bs_x
    today = clinic_now().date()
    now_utc = datetime.now(timezone.utc)

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-POST-{suffix}",
        ten_chuyen_khoa=f"Khoa Postpone Test {suffix}",
        vi_tri_phong="Phòng 108 - Khu A",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()
    bs.chuyen_khoa_id = ck.id
    await db_session.commit()

    bn = await _tao_benh_nhan(db_session, suffix, 50)

    # Vé ban đầu là Đúng hẹn (Tier 2), check-in cách đây 30 phút
    ticket = HangDoiKham(
        benh_nhan_id=bn.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=50,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc - timedelta(minutes=30),
        so_lan_goi=0,
    )
    db_session.add(ticket)
    await db_session.commit()

    # 1. Bác sĩ bấm gọi vé
    res_call = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res_call.status_code == 200
    called = res_call.json()["data"]["ticket"]
    assert called["id"] == ticket.id
    assert called["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value

    # 2. Bác sĩ gọi loa 3 lần không vào -> Bác sĩ bấm Tạm hoãn
    res_postpone = await api_client.post(f"/api/v1/clinical/queue/{ticket.id}/postpone", headers=token_bs)
    assert res_postpone.status_code == 200
    postponed_data = res_postpone.json()["data"]
    assert postponed_data["trang_thai"] == TrangThaiHangDoiEnum.TAM_HOAN.value
    # Xác nhận: Tạm hoãn được đẩy lên Mức 6
    assert postponed_data["muc_do_uu_tien"] == 6

    # Kiểm tra trực tiếp CSDL
    stmt = select(HangDoiKham).where(HangDoiKham.id == ticket.id)
    ticket_db = (await db_session.execute(stmt)).scalar_one()
    assert ticket_db.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value
    assert ticket_db.muc_do_uu_tien == 6

    # 3. Bệnh nhân quay lại quầy Lễ tân -> Lễ tân bấm Phục hồi vé
    res_restore = await api_client.post(f"/api/v1/reception/queue/{ticket.id}/restore", headers=token_letan)
    assert res_restore.status_code == 200
    restored_data = res_restore.json()["data"]

    # Xác nhận: Trạng thái quay lại 'cho_kham', mức ưu tiên được đưa về Mức 4
    assert restored_data["trang_thai"] == TrangThaiHangDoiEnum.CHO_KHAM.value
    assert restored_data["muc_do_uu_tien"] == 4
    assert restored_data["thoi_gian_xep_hang_lai"] is not None

    # Xác nhận: Thời gian chờ được tính lại từ mốc phục hồi (thay vì 30 phút từ lúc check-in cũ)
    assert restored_data["thoi_gian_cho_phut"] <= 1
    assert "tính lại thời gian chờ" in restored_data["ghi_chu_dieu_phoi"]



@pytest.mark.asyncio
async def test_cancel_and_leave_queue_sets_priority_7_at_the_end(api_client, booking, db_session):
    suffix = uuid.uuid4().hex[:6]
    token_letan = booking.tokens['admin']
    bs = booking.bs_x
    today = clinic_now().date()
    now_utc = datetime.now(timezone.utc)

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f'CK-P7-{suffix}',
        ten_chuyen_khoa=f'Khoa Priority 7 {suffix}',
        vi_tri_phong='Phòng 109 - Khu B',
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()
    bs.chuyen_khoa_id = ck.id
    await db_session.commit()

    bn_leave = await _tao_benh_nhan(db_session, suffix, 71)
    bn_close = await _tao_benh_nhan(db_session, suffix, 72)

    ticket_leave = HangDoiKham(
        benh_nhan_id=bn_leave.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=71,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc,
        so_lan_goi=0,
    )
    ticket_close = HangDoiKham(
        benh_nhan_id=bn_close.id,
        bac_si_id=bs.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=72,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now_utc,
        so_lan_goi=0,
    )
    db_session.add_all([ticket_leave, ticket_close])
    await db_session.commit()

    # 1. Bệnh nhân xin bỏ về (patient_leave_queue)
    res_leave = await api_client.patch(
        f'/api/v1/reception/queue/{ticket_leave.id}/leave',
        headers=token_letan,
        json={'ly_do': 'Bệnh nhân bận việc đột xuất'}
    )
    assert res_leave.status_code == 200

    # 2. Lễ tân đóng vé hành chính (close_ticket)
    res_close = await api_client.patch(
        f'/api/v1/reception/queue/{ticket_close.id}/close',
        headers=token_letan,
        json={'ly_do': 'Đóng vé do trùng lịch'}
    )
    assert res_close.status_code == 200

    # Kiểm tra CSDL: Cả 2 vé đều được gán mức ưu tiên 7
    stmt_l = select(HangDoiKham).where(HangDoiKham.id == ticket_leave.id)
    t_leave_db = (await db_session.execute(stmt_l)).scalar_one()
    assert t_leave_db.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value
    assert t_leave_db.muc_do_uu_tien == 7

    stmt_c = select(HangDoiKham).where(HangDoiKham.id == ticket_close.id)
    t_close_db = (await db_session.execute(stmt_c)).scalar_one()
    assert t_close_db.trang_thai == TrangThaiHangDoiEnum.DA_DONG_VE.value
    assert t_close_db.muc_do_uu_tien == 7
