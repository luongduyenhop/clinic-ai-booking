import pytest
from datetime import date, datetime, timezone
from app.models.appointment import HangDoiKham, CaLamViecEnum, TrangThaiHangDoiEnum
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_doctor_cannot_call_next_when_patient_in_consultation(api_client, booking, db_session):
    """Guard A4: Bác sĩ không thể gọi số tiếp theo nếu đang có ca DANG_KHAM"""
    token_bs = booking.tokens["bs_x"]
    today = date.today()

    # 1. Tạo 2 vé CHO_KHAM trong hàng đợi của bs_x
    hd1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc),
    )
    hd2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc),
    )
    db_session.add_all([hd1, hd2])
    await db_session.commit()

    # 2. Bác sĩ gọi số lần 1 -> Thành công gọi vé 1
    res1 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res1.status_code == 200
    assert res1.json()["data"]["ticket"]["so_thu_tu_kham"] == 1
    assert res1.json()["data"]["ticket"]["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value

    # 3. Bác sĩ gọi số lần 2 khi chưa đóng ca 1 -> Bị Guard A4 chặn với 409 Conflict
    res2 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res2.status_code == 409
    assert "chưa hoàn tất" in res2.json()["message"]


@pytest.mark.asyncio
async def test_doctor_can_call_next_after_completing_encounter(api_client, booking, db_session):
    """Bác sĩ sau khi hoàn tất khám (Commit 7.1b) được phép gọi bệnh nhân tiếp theo"""
    token_bs = booking.tokens["bs_x"]
    today = date.today()
    now = datetime.now(timezone.utc)

    # Tạo lịch khám cho bệnh nhân A
    lich_a = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # Tạo 2 vé hàng đợi: vé 1 gắn với lịch A, vé 2 chờ
    hd1 = HangDoiKham(
        lich_kham_id=lich_a.id,
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    hd2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    db_session.add_all([hd1, hd2])
    await db_session.commit()

    # 1. Bác sĩ gọi vé 1
    res1 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res1.status_code == 200

    # 2. Bác sĩ mở ca khám thực tế (Encounter)
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich_a.id},
        headers=token_bs,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    # 3. Thêm chẩn đoán ICD-10 hợp lệ
    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày")
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )

    # 4. Hoàn tất khám ca 1 -> vé 1 chuyển sang DA_KHAM (7.1b)
    res_comp = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Uống thuốc theo đơn"},
        headers=token_bs,
    )
    assert res_comp.status_code == 200

    # 5. Gọi tiếp -> Thành công gọi vé 2!
    res2 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res2.status_code == 200
    assert res2.json()["data"]["ticket"]["so_thu_tu_kham"] == 2


@pytest.mark.asyncio
async def test_doctor_can_call_next_after_postponing_current_ticket(api_client, booking, db_session):
    """Bác sĩ sau khi tạm hoãn ca hiện tại (bệnh nhân vắng mặt) được phép gọi ca tiếp theo"""
    token_bs = booking.tokens["bs_x"]
    today = date.today()
    now = datetime.now(timezone.utc)

    hd1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    hd2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=now,
    )
    db_session.add_all([hd1, hd2])
    await db_session.commit()

    # 1. Gọi vé 1
    res1 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res1.status_code == 200
    ticket1_id = res1.json()["data"]["ticket"]["id"]

    # 2. Tạm hoãn vé 1 vì gọi loa không vào
    res_postpone = await api_client.post(
        f"/api/v1/clinical/queue/{ticket1_id}/postpone",
        headers=token_bs,
    )
    assert res_postpone.status_code == 200
    assert res_postpone.json()["data"]["trang_thai"] == TrangThaiHangDoiEnum.TAM_HOAN.value

    # 3. Gọi tiếp -> Thành công gọi vé 2!
    res2 = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res2.status_code == 200
    assert res2.json()["data"]["ticket"]["so_thu_tu_kham"] == 2


@pytest.mark.asyncio
async def test_receptionist_can_restore_postponed_ticket(api_client, booking, db_session):
    """Lễ tân phục hồi vé tạm hoãn -> vé trở lại CHO_KHAM với độ ưu tiên 4"""
    await booking.tao_tai_khoan("le_tan", "le_tan")
    token_letan = booking.tokens["le_tan"]
    today = date.today()
    now = datetime.now(timezone.utc)

    hd = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.TAM_HOAN.value,
        thoi_gian_check_in=now,
    )
    db_session.add(hd)
    await db_session.commit()

    res_restore = await api_client.post(
        f"/api/v1/reception/queue/{hd.id}/restore",
        headers=token_letan,
    )
    assert res_restore.status_code == 200
    assert res_restore.json()["data"]["trang_thai"] == TrangThaiHangDoiEnum.CHO_KHAM.value
    assert res_restore.json()["data"]["muc_do_uu_tien"] == 4

