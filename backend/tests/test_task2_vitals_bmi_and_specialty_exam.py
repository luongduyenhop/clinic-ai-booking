import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select

from app.models.medical import LuotKham, LuotKhamTheLuc, PhieuKhamChuyenKhoa
from app.models.specialty_exam import KhamNoiKhoa
from app.models.user import ChuyenKhoa


async def _dam_bao_chuyen_khoa(db_session, ma_ck="NOI_TONG_QUAT", ten_ck="Khoa Nội Tổng Quát"):
    stmt = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == ma_ck)
    ck = (await db_session.execute(stmt)).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(ma_chuyen_khoa=ma_ck, ten_chuyen_khoa=ten_ck, is_active=True)
        db_session.add(ck)
        await db_session.flush()
    return ck


@pytest.mark.asyncio
async def test_task2_vitals_sync_and_bmi_auto_calculation(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session)
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_x.chuyen_khoa = ck
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau đầu, hoa mắt, chóng mặt"},
        headers=token_bs,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    workspace_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "mach_lan_phut": 78,
                "huyet_ap_tam_thu": 120,
                "huyet_ap_tam_truong": 80,
                "nhip_tho_lan_phut": 16,
                "nhiet_do_c": "36.8",
                "chieu_cao_cm": "170.0",
                "can_nang_kg": "65.0",
                "ly_do_vao_kham": "Đau đầu, hoa mắt, chóng mặt khi thay đổi tư thế",
                "benh_su": "Tiền sử đau đầu nhẹ 3 ngày nay, không nôn",
                "kham_lam_sang_bo_phan": "Tim đều, T1 T2 rõ; Phổi thông khí tốt, không rale",
            }
        }
    }

    res_sync = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_payload,
        headers=token_bs,
    )
    assert res_sync.status_code == 200

    stmt_lk = select(LuotKham).where(LuotKham.id == enc_id)
    lk = (await db_session.execute(stmt_lk)).scalar_one()

    assert lk.mach_lan_phut == 78
    assert lk.huyet_ap_tam_thu == 120
    assert lk.huyet_ap_tam_truong == 80
    assert lk.nhip_tho_lan_phut == 16
    assert lk.nhiet_do_c == Decimal("36.8")
    assert lk.chieu_cao_cm == Decimal("170.00")
    assert lk.can_nang_kg == Decimal("65.00")
    assert lk.bmi == Decimal("22.5")
    assert lk.ly_do_vao_kham == "Đau đầu, hoa mắt, chóng mặt khi thay đổi tư thế"
    assert lk.benh_su == "Tiền sử đau đầu nhẹ 3 ngày nay, không nôn"
    assert lk.kham_lam_sang_bo_phan == "Tim đều, T1 T2 rõ; Phổi thông khí tốt, không rale"
    assert lk.trieu_chung == "Đau đầu, hoa mắt, chóng mặt khi thay đổi tư thế"

    stmt_pe = select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == enc_id)
    pe = (await db_session.execute(stmt_pe)).scalar_one_or_none()
    assert pe is not None
    assert pe.mach == 78
    assert pe.huyet_ap_tam_thu == 120
    assert pe.huyet_ap_tam_truong == 80
    assert pe.nhiet_do == Decimal("36.8")
    assert pe.nhip_tho == 16
    assert pe.chieu_cao == Decimal("170.00")
    assert pe.can_nang == Decimal("65.00")
    assert pe.bmi == Decimal("22.5")
    assert pe.bac_si_ket_luan_id == booking.bs_x.id


@pytest.mark.asyncio
async def test_task2_specialty_exam_checklist_and_health_classification(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session, "KHOA_HO_HAP", "Khoa Hô Hấp")
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_x.chuyen_khoa = ck
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Ho có đờm, khó thở"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    workspace_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "chieu_cao_cm": "165.0",
                "can_nang_kg": "90.0",
                "kham_chuyen_khoa": {
                    "items": {
                        "Tim mạch": {"status": "BT", "note": "Nhịp tim bình thường"},
                        "Hô hấp": {"status": "BAT", "note": "Ran rít, ran ẩm đáy phổi"},
                        "Tai Mũi Họng": {"status": "BT", "note": "Họng không sưng đỏ"},
                    },
                    "extras": {
                        "Ghi chú bổ sung": "Bệnh nhân khó thở khi gắng sức",
                    },
                },
                "ket_luan_dieu_tri": "Viêm phế quản co thắt, theo dõi hen phế quản",
            }
        }
    }

    res_sync = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_payload,
        headers=token_bs,
    )
    assert res_sync.status_code == 200

    stmt_ck = select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == enc_id)
    phieu = (await db_session.execute(stmt_ck)).scalar_one_or_none()
    assert phieu is not None
    assert phieu.bac_si_id == booking.bs_x.id
    assert phieu.chuyen_khoa_id == ck.id
    assert phieu.ket_luan_chuyen_khoa == "Viêm phế quản co thắt, theo dõi hen phế quản"

    assert "Tim mạch: Bình thường (Nhịp tim bình thường)" in phieu.noi_dung_kham
    assert "Hô hấp: Bất thường (Ran rít, ran ẩm đáy phổi)" in phieu.noi_dung_kham
    assert "Tai Mũi Họng: Bình thường (Họng không sưng đỏ)" in phieu.noi_dung_kham
    assert "Ghi chú bổ sung: Bệnh nhân khó thở khi gắng sức" in phieu.noi_dung_kham

    assert phieu.phan_loai_suc_khoe == "LOAI_3"


@pytest.mark.asyncio
async def test_task2_health_classification_bmi_thresholds(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session)
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_x.chuyen_khoa = ck
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich1 = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_enc1 = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich1.id, "ly_do_vao_kham": "Khám định kỳ 1"},
        headers=token_bs,
    )
    enc1_id = res_enc1.json()["data"]["id"]

    await api_client.put(
        "/api/v1/clinical/workspace-state",
        json={
            "encounters": {
                str(enc1_id): {
                    "id": enc1_id,
                    "chieu_cao_cm": "170.0",
                    "can_nang_kg": "60.0",
                    "ket_luan_dieu_tri": "Sức khỏe bình thường",
                }
            }
        },
        headers=token_bs,
    )
    phieu1 = (
        await db_session.execute(
            select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == enc1_id)
        )
    ).scalar_one()
    assert phieu1.phan_loai_suc_khoe == "LOAI_1"

    lich2 = await booking.tao_lich(booking.bn_b, booking.bs_x, now + timedelta(hours=1))
    res_enc2 = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich2.id, "ly_do_vao_kham": "Khám định kỳ 2"},
        headers=token_bs,
    )
    enc2_id = res_enc2.json()["data"]["id"]

    await api_client.put(
        "/api/v1/clinical/workspace-state",
        json={
            "encounters": {
                str(enc2_id): {
                    "id": enc2_id,
                    "chieu_cao_cm": "170.0",
                    "can_nang_kg": "75.0",
                    "ket_luan_dieu_tri": "Cần điều chỉnh chế độ ăn",
                }
            }
        },
        headers=token_bs,
    )
    phieu2 = (
        await db_session.execute(
            select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == enc2_id)
        )
    ).scalar_one()
    assert phieu2.phan_loai_suc_khoe == "LOAI_2"

    lich3 = await booking.tao_lich(booking.bn_a, booking.bs_x, now + timedelta(hours=2))
    res_enc3 = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich3.id, "ly_do_vao_kham": "Khám định kỳ 3"},
        headers=token_bs,
    )
    enc3_id = res_enc3.json()["data"]["id"]

    await api_client.put(
        "/api/v1/clinical/workspace-state",
        json={
            "encounters": {
                str(enc3_id): {
                    "id": enc3_id,
                    "chieu_cao_cm": "165.0",
                    "can_nang_kg": "42.0",
                    "ket_luan_dieu_tri": "Suy dinh dưỡng nhẹ",
                }
            }
        },
        headers=token_bs,
    )
    phieu3 = (
        await db_session.execute(
            select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == enc3_id)
        )
    ).scalar_one()
    assert phieu3.phan_loai_suc_khoe == "LOAI_3"


@pytest.mark.asyncio
async def test_task2_update_and_idempotency(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session)
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_x.chuyen_khoa = ck
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám ban đầu"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    payload_v1 = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "mach_lan_phut": 80,
                "chieu_cao_cm": "170.0",
                "can_nang_kg": "60.0",
                "kham_chuyen_khoa": {
                    "items": {"Họng": {"status": "BT", "note": ""}},
                },
                "ket_luan_dieu_tri": "Theo dõi lâm sàng",
            }
        }
    }
    res_v1 = await api_client.put("/api/v1/clinical/workspace-state", json=payload_v1, headers=token_bs)
    assert res_v1.status_code == 200

    payload_v2 = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "mach_lan_phut": 75,
                "chieu_cao_cm": "170.0",
                "can_nang_kg": "76.0",
                "kham_chuyen_khoa": {
                    "items": {"Họng": {"status": "BAT", "note": "Họng sung huyết đỏ, có mủ"}},
                },
                "ket_luan_dieu_tri": "Viêm amidan hốc mủ",
            }
        }
    }
    res_v2 = await api_client.put("/api/v1/clinical/workspace-state", json=payload_v2, headers=token_bs)
    assert res_v2.status_code == 200

    lk = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    assert lk.mach_lan_phut == 75
    assert lk.can_nang_kg == Decimal("76.00")
    assert lk.bmi == Decimal("26.3")

    phieu_list = (
        await db_session.execute(
            select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == enc_id)
        )
    ).scalars().all()
    assert len(phieu_list) == 1
    assert phieu_list[0].ket_luan_chuyen_khoa == "Viêm amidan hốc mủ"
    assert phieu_list[0].phan_loai_suc_khoe == "LOAI_2"
    assert "Họng sung huyết đỏ, có mủ" in phieu_list[0].noi_dung_kham

    pe_list = (
        await db_session.execute(
            select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == enc_id)
        )
    ).scalars().all()
    assert len(pe_list) == 1
    assert pe_list[0].mach == 75
    assert pe_list[0].bmi == Decimal("26.3")


@pytest.mark.asyncio
async def test_task2_edge_cases_empty_or_zero_values(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session)
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_x.chuyen_khoa = ck
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kiểm tra sinh hiệu rỗng"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    edge_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "mach_lan_phut": "",
                "huyet_ap_tam_thu": None,
                "chieu_cao_cm": "0",
                "can_nang_kg": "55.0",
                "nhiet_do_c": "  ",
            }
        }
    }

    res_sync = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=edge_payload,
        headers=token_bs,
    )
    assert res_sync.status_code == 200

    lk = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    assert lk.bmi is None


@pytest.mark.asyncio
async def test_ts_emr_004_01_specialty_exam_and_health_classification(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session, "KHOA_NOI", "Khoa Nội tổng quát")
    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_x.chuyen_khoa = ck
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kiểm tra sức khỏe chuyên khoa nội"},
        headers=token_bs,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    await api_client.put(
        "/api/v1/clinical/workspace-state",
        json={
            "encounters": {
                str(enc_id): {
                    "id": enc_id,
                    "chieu_cao_cm": "170.0",
                    "can_nang_kg": "64.7",
                }
            }
        },
        headers=token_bs,
    )

    specialty_payload = {
        "tuan_hoan": "Nhịp tim đều, T1 T2 rõ, tần số 78ck/p, không tiếng thổi bệnh lý",
        "ho_hap": "Phổi 2 bên thông khí rõ, rì rào phế nang êm dịu, không rale",
        "tieu_hoa": "Bụng mềm, gan lách không sờ chạm, không điểm đau khu trú",
        "than_tiet_nieu": "Hố thắt lưng 2 bên không đầy, chạm thận âm tính",
        "than_kinh": "Tỉnh táo, tiếp xúc tốt, GCS 15đ, không có dấu thần kinh khu trú",
        "co_xuong_khop": "Trục chi thẳng, các khớp cử động bình thường, không sưng nóng đỏ",
        "ket_luan_chuyen_khoa": "Hệ cơ quan nội khoa - tiêu hóa hoàn toàn bình thường",
    }

    res_spec = await api_client.put(
        f"/api/v1/clinical/encounters/{enc_id}/specialty/noi-khoa",
        json=specialty_payload,
        headers=token_bs,
    )
    assert res_spec.status_code == 200

    stmt_noi = select(KhamNoiKhoa).where(KhamNoiKhoa.luot_kham_id == enc_id)
    noi_rec = (await db_session.execute(stmt_noi)).scalar_one_or_none()
    assert noi_rec is not None
    assert "Nhịp tim đều" in noi_rec.tuan_hoan
    assert "Phổi 2 bên" in noi_rec.ho_hap
    assert "Bụng mềm" in noi_rec.tieu_hoa
    assert "chạm thận âm tính" in noi_rec.than_tiet_nieu
    assert "Tỉnh táo" in noi_rec.than_kinh
    assert "Trục chi thẳng" in noi_rec.co_xuong_khop
    assert noi_rec.ket_luan_chuyen_khoa == "Hệ cơ quan nội khoa - tiêu hóa hoàn toàn bình thường"

    stmt_phieu = select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == enc_id)
    phieu = (await db_session.execute(stmt_phieu)).scalar_one_or_none()
    assert phieu is not None
    assert phieu.phan_loai_suc_khoe == "LOAI_1"
    assert "Tiêu hóa: Bụng mềm" in phieu.noi_dung_kham
    assert "Tuần hoàn: Nhịp tim đều" in phieu.noi_dung_kham
