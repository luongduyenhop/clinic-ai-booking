from datetime import datetime, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select, update

from app.models.medical import ChiDinh, DichVu, HoaDon
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_p0_complete_auto_creates_invoice_and_syncs_cashier_and_patient_portals(
    api_client, booking, db_session
):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    token_bn = booking.tokens["bn_a"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám tăng huyết áp"},
        headers=token_bs,
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "I10", "Tăng huyết áp vô căn")
    res_dx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "I10", "ten_benh_chan_doan": "Tăng huyết áp vô căn", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )
    assert res_dx.status_code in (200, 201)

    dv_active = DichVu(
        ma_dich_vu=f"DV-P0-ACT-{booking.suffix}",
        ten_dich_vu="Điện tâm đồ thường",
        ma_nhom_byt="TDCN",
        don_gia=Decimal("120000.00"),
        don_vi_tinh="Lần",
        is_active=True,
    )
    dv_cancelled = DichVu(
        ma_dich_vu=f"DV-P0-CAN-{booking.suffix}",
        ten_dich_vu="Siêu âm bụng tổng quát",
        ma_nhom_byt="CDHA",
        don_gia=Decimal("80000.00"),
        don_vi_tinh="Lần",
        is_active=True,
    )
    db_session.add_all([dv_active, dv_cancelled])
    await db_session.flush()

    cd_done = ChiDinh(
        luot_kham_id=enc_id,
        dich_vu_id=dv_active.id,
        so_luong=1,
        don_gia_tai_thoi_diem=Decimal("120000.00"),
        trang_thai="da_co_ket_qua",
        ket_qua_chi_tiet="Nhịp xoang đều 78 ck/phút",
    )
    cd_cancelled = ChiDinh(
        luot_kham_id=enc_id,
        dich_vu_id=dv_cancelled.id,
        so_luong=1,
        don_gia_tai_thoi_diem=Decimal("80000.00"),
        trang_thai="da_huy",
    )
    db_session.add_all([cd_done, cd_cancelled])
    await db_session.commit()

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "loi_dan": "Uống thuốc buổi sáng",
            "danh_sach_thuoc": [
                {
                    "ten_thuoc": "Amlodipin 5mg",
                    "don_vi_tinh": "Viên",
                    "so_luong": 30,
                    "cach_dung": "Sáng 1 viên sau ăn",
                }
            ],
        },
        headers=token_bs,
    )
    assert res_rx.status_code == 201

    res_comp = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Kiểm soát huyết áp ngoại trú", "loi_dan_bac_si": "Ăn nhạt"},
        headers=token_bs,
    )
    assert res_comp.status_code == 200
    assert res_comp.json()["data"]["is_locked"] is True

    exam_fee = Decimal(str(booking.bs_x.gia_kham_mac_dinh or "150000.00"))
    expected_total = exam_fee + Decimal("120000.00")

    res_list_pending = await api_client.get(
        "/api/v1/cashier/invoices?trang_thai=chua_thu",
        headers=token_admin,
    )
    assert res_list_pending.status_code == 200
    pending_items = res_list_pending.json()["data"]["items"]
    auto_inv = next(it for it in pending_items if it["luot_kham_id"] == enc_id)
    assert Decimal(str(auto_inv["thuc_thu"])) == expected_total
    line_types = [ln["loai_muc"] for ln in auto_inv["cac_khoan_thu"]]
    assert line_types == ["cong_kham", "can_lam_sang"]

    res_detail = await api_client.get(
        f"/api/v1/cashier/invoices/{auto_inv['id']}",
        headers=token_admin,
    )
    assert res_detail.status_code == 200
    assert res_detail.json()["data"]["thu_ngan_id"] is None

    res_patient_before = await api_client.get("/api/v1/patient/invoices", headers=token_bn)
    assert res_patient_before.status_code == 200
    p_inv_before = next(it for it in res_patient_before.json()["data"] if it["luot_kham_id"] == enc_id)
    assert p_inv_before["trang_thai"] == "chua_thu"
    assert p_inv_before["so_tien_phai_thu"] == float(expected_total)
    assert p_inv_before["thuc_thu"] == 0.0

    res_pay = await api_client.post(
        f"/api/v1/cashier/invoices/{auto_inv['id']}/pay",
        json={"phuong_thuc_thanh_toan": "tien_mat", "so_tien_khach_tra": float(expected_total)},
        headers=token_admin,
    )
    assert res_pay.status_code == 200
    assert res_pay.json()["data"]["trang_thai"] == "da_thu"

    res_list_paid = await api_client.get(
        "/api/v1/cashier/invoices?trang_thai=da_thu",
        headers=token_admin,
    )
    assert res_list_paid.status_code == 200
    paid_inv = next(it for it in res_list_paid.json()["data"]["items"] if it["luot_kham_id"] == enc_id)
    assert paid_inv["trang_thai"] == "da_thu"
    assert paid_inv["phuong_thuc_thanh_toan"] == "tien_mat"
    assert paid_inv["ngay_thanh_toan"] is not None

    res_patient_after = await api_client.get("/api/v1/patient/invoices", headers=token_bn)
    assert res_patient_after.status_code == 200
    p_inv_after = next(it for it in res_patient_after.json()["data"] if it["luot_kham_id"] == enc_id)
    assert p_inv_after["trang_thai"] == "da_thu"
    assert p_inv_after["thuc_thu"] == float(expected_total)


@pytest.mark.asyncio
async def test_p0_complete_creates_supplementary_invoice_only_for_unbilled_cls(
    api_client, booking, db_session
):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám tiêu hóa"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày")
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )

    res_first_inv = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin,
    )
    assert res_first_inv.status_code == 201
    first_inv = res_first_inv.json()["data"]
    res_pay = await api_client.post(
        f"/api/v1/cashier/invoices/{first_inv['id']}/pay",
        json={"phuong_thuc_thanh_toan": "tien_mat", "so_tien_khach_tra": float(first_inv["thuc_thu"])},
        headers=token_admin,
    )
    assert res_pay.status_code == 200

    dv_extra = DichVu(
        ma_dich_vu=f"DV-P0-SUP-{booking.suffix}",
        ten_dich_vu="Test HP hơi thở",
        ma_nhom_byt="XN",
        don_gia=Decimal("180000.00"),
        don_vi_tinh="Lần",
        is_active=True,
    )
    db_session.add(dv_extra)
    await db_session.flush()
    db_session.add(
        ChiDinh(
            luot_kham_id=enc_id,
            dich_vu_id=dv_extra.id,
            so_luong=1,
            don_gia_tai_thoi_diem=Decimal("180000.00"),
            trang_thai="da_co_ket_qua",
            ket_qua_chi_tiet="Âm tính",
        )
    )
    await db_session.commit()

    res_comp = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Ổn định"},
        headers=token_bs,
    )
    assert res_comp.status_code == 200

    invoices = (
        await db_session.execute(select(HoaDon).where(HoaDon.luot_kham_id == enc_id).order_by(HoaDon.id.asc()))
    ).scalars().all()
    assert len(invoices) == 2
    assert invoices[0].trang_thai == "da_thu"
    assert invoices[1].trang_thai == "chua_thu"
    assert Decimal(str(invoices[1].thuc_thu)) == Decimal("180000.00")


@pytest.mark.asyncio
async def test_p0_complete_skips_invoice_when_already_fully_paid(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_b, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Tái khám"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "J02.9", "Viêm họng cấp")
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "J02.9", "ten_benh_chan_doan": "Viêm họng cấp", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )

    res_inv = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin,
    )
    inv_data = res_inv.json()["data"]
    await api_client.post(
        f"/api/v1/cashier/invoices/{inv_data['id']}/pay",
        json={"phuong_thuc_thanh_toan": "tien_mat", "so_tien_khach_tra": float(inv_data["thuc_thu"])},
        headers=token_admin,
    )

    res_comp = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Khỏi bệnh"},
        headers=token_bs,
    )
    assert res_comp.status_code == 200

    invoices = (await db_session.execute(select(HoaDon).where(HoaDon.luot_kham_id == enc_id))).scalars().all()
    assert len(invoices) == 1
    assert invoices[0].trang_thai == "da_thu"


@pytest.mark.asyncio
async def test_p0_complete_appends_missing_items_into_existing_pending_invoice(
    api_client, booking, db_session
):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám tổng quát"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "E11", "Đái tháo đường")
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "E11", "ten_benh_chan_doan": "Đái tháo đường", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )

    res_inv = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 10000.00},
        headers=token_admin,
    )
    assert res_inv.status_code == 201
    initial_due = Decimal(str(res_inv.json()["data"]["thuc_thu"]))

    dv_glucose = DichVu(
        ma_dich_vu=f"DV-P0-GLU-{booking.suffix}",
        ten_dich_vu="Định lượng Glucose máu",
        ma_nhom_byt="XN",
        don_gia=Decimal("95000.00"),
        don_vi_tinh="Lần",
        is_active=True,
    )
    db_session.add(dv_glucose)
    await db_session.flush()
    db_session.add(
        ChiDinh(
            luot_kham_id=enc_id,
            dich_vu_id=dv_glucose.id,
            so_luong=1,
            don_gia_tai_thoi_diem=Decimal("95000.00"),
            trang_thai="da_co_ket_qua",
            ket_qua_chi_tiet="6.1 mmol/L",
        )
    )
    await db_session.commit()

    res_comp = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Kiểm soát đường huyết"},
        headers=token_bs,
    )
    assert res_comp.status_code == 200

    db_session.expire_all()
    invoices = (await db_session.execute(select(HoaDon).where(HoaDon.luot_kham_id == enc_id))).scalars().all()
    assert len(invoices) == 1
    assert invoices[0].trang_thai == "chua_thu"
    assert Decimal(str(invoices[0].thuc_thu)) == initial_due + Decimal("95000.00")


@pytest.mark.asyncio
async def test_p0_complete_succeeds_via_savepoint_when_exam_price_missing(
    api_client, booking, db_session
):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    booking.bs_x.gia_kham_mac_dinh = Decimal("0.00")
    await db_session.execute(
        update(DichVu).where(DichVu.ma_dich_vu == "KHAM_LAM_SANG_CO_BAN").values(is_active=False)
    )
    await db_session.commit()

    lich = await booking.tao_lich(booking.bn_b, booking.bs_x, now)
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám kiểm tra"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    await _dam_bao_ma_icd10(db_session, "A09", "Tiêu chảy nhiễm trùng")
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "A09", "ten_benh_chan_doan": "Tiêu chảy", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )

    res_comp = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Bù nước điện giải"},
        headers=token_bs,
    )
    assert res_comp.status_code == 200
    assert res_comp.json()["data"]["is_locked"] is True

    invoices = (await db_session.execute(select(HoaDon).where(HoaDon.luot_kham_id == enc_id))).scalars().all()
    assert len(invoices) == 0

    res_unbilled = await api_client.get("/api/v1/cashier/unbilled-encounters", headers=token_admin)
    assert res_unbilled.status_code == 200
    unbilled_item = next(it for it in res_unbilled.json()["data"]["items"] if it["luot_kham_id"] == enc_id)
    assert unbilled_item["is_locked"] is True
    assert unbilled_item["canh_bao_gia"] is not None
