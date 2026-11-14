import pytest
from datetime import datetime, timezone
from sqlalchemy import select

from app.models.medical import ChanDoan, ChiDinh, DichVu, LuotKham


@pytest.mark.asyncio
async def test_task3_sync_diagnoses_primary_and_secondary(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Sốt, ho khan, đau rát họng"},
        headers=token_bs,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    workspace_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "danh_sach_chan_doan": [
                    {
                        "ma_icd10": "J02.9",
                        "ten_benh_chan_doan": "Viêm họng cấp không đặc hiệu",
                        "loai_chan_doan": "chinh",
                        "ghi_chu_chuyen_mon": "Họng đỏ, amidan sưng nhẹ",
                    },
                    {
                        "ma_icd10": "J30.4",
                        "ten_benh_chan_doan": "Viêm mũi dị ứng không xác định",
                        "loai_chan_doan": "phu",
                        "ghi_chu_chuyen_mon": "Chảy mũi trong, ngứa mũi",
                    },
                ],
            }
        }
    }

    res_sync = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_payload,
        headers=token_bs,
    )
    assert res_sync.status_code == 200

    stmt_cd = (
        select(ChanDoan)
        .where(ChanDoan.luot_kham_id == enc_id)
        .order_by(ChanDoan.id.asc())
    )
    diagnoses = (await db_session.execute(stmt_cd)).scalars().all()
    assert len(diagnoses) == 2

    primary_diag = next((d for d in diagnoses if d.loai_chan_doan == "chinh"), None)
    assert primary_diag is not None
    assert primary_diag.ma_icd10 == "J02.9"
    assert primary_diag.ten_benh_chan_doan == "Viêm họng cấp không đặc hiệu"
    assert primary_diag.ghi_chu_chuyen_mon == "Họng đỏ, amidan sưng nhẹ"

    secondary_diag = next((d for d in diagnoses if d.loai_chan_doan == "phu"), None)
    assert secondary_diag is not None
    assert secondary_diag.ma_icd10 == "J30.4"
    assert secondary_diag.ten_benh_chan_doan == "Viêm mũi dị ứng không xác định"

    lk = (await db_session.execute(select(LuotKham).where(LuotKham.id == enc_id))).scalar_one()
    assert lk.chan_doan_so_bo is not None
    assert "J02.9" in lk.chan_doan_so_bo


@pytest.mark.asyncio
async def test_task3_order_subclinical_services_sets_cho_thuc_hien_status(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Nghi ngờ viêm phổi"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    workspace_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "danh_sach_chi_dinh": [
                    {
                        "ma_dich_vu": "XN_CTM",
                        "ten_dich_vu": "Tổng phân tích tế bào máu ngoại vi",
                        "nhom_dich_vu": "xet_nghiem",
                        "trang_thai": "da_chi_dinh",
                    },
                    {
                        "ma_dich_vu": "CDHA_XQ_PHOI",
                        "ten_dich_vu": "Chụp X-quang ngực thẳng",
                        "nhom_dich_vu": "cdha",
                        "trang_thai": "",
                    },
                ],
            }
        }
    }

    res_sync = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_payload,
        headers=token_bs,
    )
    assert res_sync.status_code == 200

    stmt_ord = (
        select(ChiDinh)
        .where(ChiDinh.luot_kham_id == enc_id)
        .order_by(ChiDinh.id.asc())
    )
    orders = (await db_session.execute(stmt_ord)).scalars().all()
    assert len(orders) == 2

    for ord_item in orders:
        assert ord_item.trang_thai == "CHO_THUC_HIEN", (
            f"Trạng thái chỉ định phải là CHO_THUC_HIEN để phòng KTV tiếp nhận, nhận được: {ord_item.trang_thai}"
        )
        assert ord_item.bac_si_chi_dinh_id is not None

    stmt_dv = select(DichVu).where(DichVu.ma_dich_vu.in_(["XN_CTM", "CDHA_XQ_PHOI"]))
    dvs = (await db_session.execute(stmt_dv)).scalars().all()
    assert len(dvs) == 2


@pytest.mark.asyncio
async def test_task3_technician_receives_queue_and_starts_order(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    token_admin = booking.tokens["admin"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kiểm tra sinh hóa máu"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    workspace_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "danh_sach_chi_dinh": [
                    {
                        "ma_dich_vu": "XN_DUONG_HUYET",
                        "ten_dich_vu": "Định lượng Glucose máu",
                        "nhom_dich_vu": "xet_nghiem",
                        "trang_thai": "CHO_THUC_HIEN",
                    }
                ],
            }
        }
    }
    await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_payload,
        headers=token_bs,
    )

    res_queue = await api_client.get(
        "/api/v1/subclinical/queue",
        headers=token_admin,
    )
    assert res_queue.status_code == 200
    queue_items = res_queue.json()["data"]["items"]

    target_order = next((it for it in queue_items if it["luot_kham_id"] == enc_id), None)
    assert target_order is not None
    assert target_order["trang_thai"] == "CHO_THUC_HIEN"
    order_id = target_order["id"]

    res_start = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/start",
        headers=token_admin,
    )
    assert res_start.status_code == 200
    assert res_start.json()["data"]["trang_thai"] == "dang_thuc_hien"

    ord_db = (await db_session.execute(select(ChiDinh).where(ChiDinh.id == order_id))).scalar_one()
    assert ord_db.trang_thai == "dang_thuc_hien"
    assert ord_db.thoi_gian_thuc_hien is not None


@pytest.mark.asyncio
async def test_task3_safety_guard_no_first_lk_fallback(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Ca khám hợp lệ"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    tamper_payload = {
        "encounters": {
            "999999": {
                "id": 999999,
                "danh_sach_chan_doan": [
                    {
                        "ma_icd10": "A00.0",
                        "ten_benh_chan_doan": "Bệnh tả do Vibrio cholerae",
                        "loai_chan_doan": "chinh",
                    }
                ],
                "danh_sach_chi_dinh": [
                    {
                        "ma_dich_vu": "XN_TA",
                        "ten_dich_vu": "Cấy phân tìm vi khuẩn tả",
                    }
                ],
            }
        }
    }

    res_tamper = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=tamper_payload,
        headers=token_bs,
    )
    assert res_tamper.status_code == 404

    cd_valid = (
        await db_session.execute(select(ChanDoan).where(ChanDoan.luot_kham_id == enc_id))
    ).scalars().all()
    assert len(cd_valid) == 0, "Ca khám hợp lệ không được bị ghi đè bởi encounter ID không tồn tại"

    ord_valid = (
        await db_session.execute(select(ChiDinh).where(ChiDinh.luot_kham_id == enc_id))
    ).scalars().all()
    assert len(ord_valid) == 0, "Chỉ định của ca khám hợp lệ không được bị ghi đè"


@pytest.mark.asyncio
async def test_task3_updating_and_replacing_diagnoses(api_client, booking, db_session):
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám ban đầu"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    payload_1 = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "danh_sach_chan_doan": [
                    {
                        "ma_icd10": "R50.9",
                        "ten_benh_chan_doan": "Sốt không đặc hiệu",
                        "loai_chan_doan": "chinh",
                    }
                ],
            }
        }
    }
    await api_client.put("/api/v1/clinical/workspace-state", json=payload_1, headers=token_bs)

    cd_1 = (await db_session.execute(select(ChanDoan).where(ChanDoan.luot_kham_id == enc_id))).scalars().all()
    assert len(cd_1) == 1
    assert cd_1[0].ma_icd10 == "R50.9"

    payload_2 = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "danh_sach_chan_doan": [
                    {
                        "ma_icd10": "A09",
                        "ten_benh_chan_doan": "Viêm dạ dày - ruột nhiễm trùng",
                        "loai_chan_doan": "chinh",
                        "ghi_chu_chuyen_mon": "Chẩn đoán xác định",
                    },
                    {
                        "ma_icd10": "E86",
                        "ten_benh_chan_doan": "Giảm thể tích tuần hoàn (Mất nước nhẹ)",
                        "loai_chan_doan": "phu",
                    },
                ],
            }
        }
    }
    await api_client.put("/api/v1/clinical/workspace-state", json=payload_2, headers=token_bs)

    cd_2 = (await db_session.execute(select(ChanDoan).where(ChanDoan.luot_kham_id == enc_id))).scalars().all()
    assert len(cd_2) == 2
    codes = {d.ma_icd10 for d in cd_2}
    assert codes == {"A09", "E86"}
    assert "R50.9" not in codes
