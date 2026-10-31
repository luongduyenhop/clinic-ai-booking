import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select

from app.models.medical import LuotKham, LuotKhamTheLuc, PhieuKhamChuyenKhoa
from app.models.user import ChuyenKhoa


async def _dam_bao_chuyen_khoa(db_session, ma_ck="NOI_TONG_QUAT", ten_ck="Khoa Nội Tổng Quát"):
    """Đảm bảo có dữ liệu chuyên khoa trong CSDL và gắn với bác sĩ khám."""
    stmt = select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == ma_ck)
    ck = (await db_session.execute(stmt)).scalar_one_or_none()
    if not ck:
        ck = ChuyenKhoa(ma_chuyen_khoa=ma_ck, ten_chuyen_khoa=ten_ck, is_active=True)
        db_session.add(ck)
        await db_session.flush()
    return ck


@pytest.mark.asyncio
async def test_task2_vitals_sync_and_bmi_auto_calculation(api_client, booking, db_session):
    """
    Task 2 AC1: Nhập và đồng bộ chỉ số sinh hiệu (HA, Mạch, Nhiệt độ, Chiều cao, Cân nặng)
    từ Bàn khám bác sĩ. Hệ thống tự động tính BMI chuẩn xác và lưu vào luot_kham & luot_kham_the_luc.
    """
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session)
    booking.bs_x.chuyen_khoa_id = ck.id
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # 1. Khởi tạo ca khám lâm sàng
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau đầu, hoa mắt, chóng mặt"},
        headers=token_bs,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    # 2. Bác sĩ đo sinh hiệu: Cao 170cm, Nặng 65kg -> BMI = 65 / (1.7^2) = 22.4913... làm tròn 22.5
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

    # 3. Kiểm tra bảng luot_kham: Lưu đầy đủ sinh hiệu và tự động tính BMI
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

    # 4. Kiểm tra bảng luot_kham_the_luc: Đồng bộ thể lực
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
    """
    Task 2 AC2: Ghi nhận checklist khám chuyên khoa (items & extras),
    tổng hợp định dạng nội dung khám và tự động phân loại sức khỏe vào phieu_kham_chuyen_khoa.
    """
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session, "KHOA_HO_HAP", "Khoa Hô Hấp")
    booking.bs_x.chuyen_khoa_id = ck.id
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Ho có đờm, khó thở"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    # BMI = 90 / (1.65^2) = 33.06 -> BMI >= 30 => LOAI_3 (Béo phì độ II / nguy cơ cao)
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

    # Kiểm tra phieu_kham_chuyen_khoa được tạo chính xác
    stmt_ck = select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == enc_id)
    phieu = (await db_session.execute(stmt_ck)).scalar_one_or_none()
    assert phieu is not None
    assert phieu.bac_si_id == booking.bs_x.id
    assert phieu.chuyen_khoa_id == ck.id
    assert phieu.ket_luan_chuyen_khoa == "Viêm phế quản co thắt, theo dõi hen phế quản"

    # Kiểm tra format nội dung khám từ checklist
    assert "Tim mạch: Bình thường (Nhịp tim bình thường)" in phieu.noi_dung_kham
    assert "Hô hấp: Bất thường (Ran rít, ran ẩm đáy phổi)" in phieu.noi_dung_kham
    assert "Tai Mũi Họng: Bình thường (Họng không sưng đỏ)" in phieu.noi_dung_kham
    assert "Ghi chú bổ sung: Bệnh nhân khó thở khi gắng sức" in phieu.noi_dung_kham

    # BMI >= 30 -> phân loại LOAI_3
    assert phieu.phan_loai_suc_khoe == "LOAI_3"


@pytest.mark.asyncio
async def test_task2_health_classification_bmi_thresholds(api_client, booking, db_session):
    """
    Task 2 AC2: Kiểm tra phân loại sức khỏe LOAI_1, LOAI_2, LOAI_3 theo các ngưỡng BMI chuẩn Châu Á:
    - LOAI_1: Thể trạng chuẩn (18.5 <= BMI < 25)
    - LOAI_2: Tiền béo phì / Thừa cân (25 <= BMI < 30)
    - LOAI_3: Béo phì hoặc gầy thiếu cân (BMI >= 30 hoặc BMI < 18.5)
    """
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session)
    booking.bs_x.chuyen_khoa_id = ck.id
    await db_session.flush()

    # Trường hợp 1: Thể trạng chuẩn (Cao 170cm, nặng 60kg -> BMI = 20.8 -> LOAI_1)
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

    # Trường hợp 2: Tiền béo phì (Cao 170cm, nặng 75kg -> BMI = 26.0 -> LOAI_2)
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

    # Trường hợp 3: Thiếu cân (Cao 165cm, nặng 42kg -> BMI = 15.4 < 18.5 -> LOAI_3)
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
    """
    Task 2 AC1 & AC2: Bác sĩ chỉnh sửa số đo sinh hiệu và kết luận khám nhiều lần (draft update).
    Hệ thống cập nhật tại chỗ các bản ghi LuotKham, PhieuKhamChuyenKhoa, LuotKhamTheLuc
    mà không sinh bản ghi nhân đôi (idempotent update).
    """
    token_bs = booking.tokens["bs_x"]
    ck = await _dam_bao_chuyen_khoa(db_session)
    booking.bs_x.chuyen_khoa_id = ck.id
    await db_session.flush()

    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám ban đầu"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    # Lần 1: Lưu sinh hiệu ban đầu (Nặng 60kg, Cao 170cm -> BMI = 20.8, LOAI_1)
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

    # Lần 2: Cập nhật lại số đo chính xác hơn và kết luận mới
    payload_v2 = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "mach_lan_phut": 75,
                "chieu_cao_cm": "170.0",
                "can_nang_kg": "76.0",  # BMI mới: 76 / 1.7^2 = 26.3 -> LOAI_2
                "kham_chuyen_khoa": {
                    "items": {"Họng": {"status": "BAT", "note": "Họng sung huyết đỏ, có mủ"}},
                },
                "ket_luan_dieu_tri": "Viêm amidan hốc mủ",
            }
        }
    }
    res_v2 = await api_client.put("/api/v1/clinical/workspace-state", json=payload_v2, headers=token_bs)
    assert res_v2.status_code == 200

    # Kiểm tra LuotKham cập nhật đúng
    lk = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    assert lk.mach_lan_phut == 75
    assert lk.can_nang_kg == Decimal("76.00")
    assert lk.bmi == Decimal("26.3")

    # Kiểm tra chỉ có DUY NHẤT 1 PhieuKhamChuyenKhoa và 1 LuotKhamTheLuc
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
    """
    Task 2 Edge cases: Bác sĩ gửi dữ liệu sinh hiệu trống, chuỗi rỗng hoặc chiều cao = 0.
    Hệ thống xử lý an toàn (graceful handling), không văng lỗi chia cho 0 (ZeroDivisionError).
    """
    token_bs = booking.tokens["bs_x"]
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
                "chieu_cao_cm": "0",  # Chiều cao = 0 không được gây ZeroDivisionError
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

    # Kiểm tra LuotKham: BMI vẫn là None (không tính do chiều cao = 0)
    lk = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    assert lk.bmi is None
