import pytest
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from app.models.medical import DichVu, LuotKham, ChiDinh, DonThuoc, ChiTietDonThuoc
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_cashier_create_invoice_auto_calculation(api_client, booking, db_session):
    """
    Kiểm tra tạo hóa đơn viện phí tự động từ lượt khám:
    - Gom công khám bác sĩ
    - Gom chỉ định cận lâm sàng
    - Gom thuốc từ đơn thuốc
    - Tính đúng tổng tiền, miễn giảm và thực thu
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # 1. Bác sĩ mở ca khám
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám đau đầu chóng mặt"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    # 2. Tạo dịch vụ CLS và kê chỉ định
    dv = DichVu(
        ma_dich_vu=f"CLS-XN-{booking.suffix}",
        ten_dich_vu="Điện não đồ vi tính",
        don_gia=350000.00,
        don_vi_tinh="Lần",
        is_active=True
    )
    db_session.add(dv)
    await db_session.flush()

    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders",
        json={"dich_vu_id": dv.id, "so_luong": 1},
        headers=token_bs
    )
    assert res_order.status_code == 201

    # 3. Thu ngân khởi tạo hóa đơn viện phí
    res_bill = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 50000.00, "ghi_chu": "Bệnh nhân ưu tiên"},
        headers=token_admin
    )
    assert res_bill.status_code == 201
    bill_data = res_bill.json()["data"]
    assert bill_data["ma_hoa_don"].startswith("HD-")
    assert bill_data["trang_thai"] == "chua_thu"
    assert Decimal(str(bill_data["mien_giam"])) == Decimal("50000.00")
    assert Decimal(str(bill_data["tong_tien"])) > Decimal("350000.00")
    assert Decimal(str(bill_data["thuc_thu"])) == Decimal(str(bill_data["tong_tien"])) - Decimal("50000.00")
    assert len(bill_data["chi_tiet_hoa_don"]) >= 2  # ít nhất công khám + 1 CLS


@pytest.mark.asyncio
async def test_cashier_pay_invoice_success_and_prevent_double_pay(api_client, booking, db_session):
    """
    Kiểm tra thanh toán hóa đơn:
    - Thanh toán thành công, đổi trạng thái da_thu, sinh số hóa đơn in BL-YYYY-XXXXXX
    - Không cho phép thanh toán 2 lần trên cùng hóa đơn (409 Conflict)
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám tổng quát"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    res_bill = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    assert res_bill.status_code == 201
    inv_id = res_bill.json()["data"]["id"]
    thuc_thu = float(res_bill.json()["data"]["thuc_thu"])

    # Thanh toán thiếu tiền -> 422
    res_underpay = await api_client.post(
        f"/api/v1/cashier/invoices/{inv_id}/pay",
        json={"phuong_thuc_thanh_toan": "tien_mat", "so_tien_khach_tra": thuc_thu - 10000},
        headers=token_admin
    )
    assert res_underpay.status_code == 422

    # Thanh toán đủ tiền -> 200 OK
    res_pay = await api_client.post(
        f"/api/v1/cashier/invoices/{inv_id}/pay",
        json={"phuong_thuc_thanh_toan": "chuyen_khoan", "so_tien_khach_tra": thuc_thu, "ghi_chu": "VietQR Techcombank"},
        headers=token_admin
    )
    assert res_pay.status_code == 200
    pay_data = res_pay.json()["data"]
    assert pay_data["trang_thai"] == "da_thu"
    assert pay_data["phuong_thuc_thanh_toan"] == "chuyen_khoan"
    assert pay_data["so_hoa_don_in"].startswith("BL-")
    assert pay_data["ngay_thanh_toan"] is not None

    # Thử thanh toán lại lần 2 -> 409 Conflict
    res_repay = await api_client.post(
        f"/api/v1/cashier/invoices/{inv_id}/pay",
        json={"phuong_thuc_thanh_toan": "tien_mat", "so_tien_khach_tra": thuc_thu},
        headers=token_admin
    )
    assert res_repay.status_code == 409


@pytest.mark.asyncio
async def test_cashier_cancel_invoice_and_pending_bills(api_client, booking, db_session):
    """
    Kiểm tra danh sách hóa đơn chờ thu và nghiệp vụ hủy hóa đơn
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_b, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Tái khám huyết áp"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    res_bill = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    inv_id = res_bill.json()["data"]["id"]

    # Tra cứu danh sách pending-bills
    res_list = await api_client.get(
        "/api/v1/cashier/pending-bills",
        headers=token_admin
    )
    assert res_list.status_code == 200
    pending_items = res_list.json()["data"]["items"]
    assert any(it["id"] == inv_id for it in pending_items)

    # Hủy hóa đơn
    res_cancel = await api_client.post(
        f"/api/v1/cashier/invoices/{inv_id}/cancel?ly_do=Bệnh_nhân_xin_hoãn_khám",
        headers=token_admin
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["data"]["trang_thai"] == "da_huy"

    # Sau khi hủy, không còn trong pending-bills
    res_list_after = await api_client.get(
        "/api/v1/cashier/pending-bills",
        headers=token_admin
    )
    assert not any(it["id"] == inv_id for it in res_list_after.json()["data"]["items"])


@pytest.mark.asyncio
async def test_cashier_shift_summary_and_close_shift(api_client, booking, db_session):
    """
    Kiểm tra báo cáo tổng kết ca trực và khóa sổ thu ngân
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kiểm tra định kỳ"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    res_bill = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    inv_id = res_bill.json()["data"]["id"]
    thuc_thu = float(res_bill.json()["data"]["thuc_thu"])

    # Thanh toán
    await api_client.post(
        f"/api/v1/cashier/invoices/{inv_id}/pay",
        json={"phuong_thuc_thanh_toan": "tien_mat", "so_tien_khach_tra": thuc_thu},
        headers=token_admin
    )

    # Xem tổng kết ca
    res_summary = await api_client.get(
        "/api/v1/cashier/shift-summary",
        headers=token_admin
    )
    assert res_summary.status_code == 200
    summary_data = res_summary.json()["data"]
    assert Decimal(str(summary_data["tong_tien_mat"])) >= Decimal(str(thuc_thu))
    assert summary_data["so_phieu_thu"] >= 1

    # Khóa sổ ca trực
    res_close = await api_client.post(
        "/api/v1/cashier/close-shift",
        json={"ghi_chu": "Bàn giao ca 1 cho thu ngân chiều"},
        headers=token_admin
    )
    assert res_close.status_code == 200
    assert res_close.json()["data"]["ok"] is True


@pytest.mark.asyncio
async def test_cashier_closed_loop_auto_aggregate_and_unbilled_encounters(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kiem tra toan dien hop 1"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    dv = DichVu(
        ma_dich_vu=f"CLS-XRAY-{booking.suffix}",
        ten_dich_vu="Chup X-Quang Nguc Thang",
        don_gia=Decimal("220000.00"),
        don_vi_tinh="Lan",
        is_active=True
    )
    db_session.add(dv)
    await db_session.flush()

    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders",
        json={"dich_vu_id": dv.id, "so_luong": 1},
        headers=token_bs
    )
    assert res_order.status_code == 201

    rx_payload = {
        "so_ngay_dung": 7,
        "loi_dan_uong_thuoc": "Uong sau khi an",
        "danh_sach_thuoc": [
            {
                "ten_thuoc": "Amoxicillin 500mg",
                "hoat_chat": "Amoxicillin",
                "ham_luong": "500mg",
                "don_vi_tinh": "Vien",
                "so_luong": 14,
                "cach_dung": "Uong 2 vien chia 2 lan/ngay",
                "so_ngay_dung": 7
            }
        ]
    }
    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json=rx_payload,
        headers=token_bs
    )
    assert res_rx.status_code == 201

    res_unbilled = await api_client.get(
        "/api/v1/cashier/unbilled-encounters",
        headers=token_admin
    )
    assert res_unbilled.status_code == 200
    unbilled_data = res_unbilled.json()["data"]
    enc_unbilled = next(item for item in unbilled_data["items"] if item["luot_kham_id"] == enc_id)
    assert enc_unbilled["so_chi_dinh"] == 1

    res_bill = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    assert res_bill.status_code == 201
    bill_data = res_bill.json()["data"]
    inv_id = bill_data["id"]

    loai_mucs = [item["loai_muc"] for item in bill_data["chi_tiet_hoa_don"]]
    assert "cong_kham" in loai_mucs
    assert "can_lam_sang" in loai_mucs
    assert "thuoc" not in loai_mucs
    assert float(enc_unbilled["tam_tinh"]) == float(bill_data["thuc_thu"])

    res_unbilled_after = await api_client.get(
        "/api/v1/cashier/unbilled-encounters",
        headers=token_admin
    )
    assert res_unbilled_after.status_code == 200
    assert not any(item["luot_kham_id"] == enc_id for item in res_unbilled_after.json()["data"]["items"])

    thuc_thu = float(bill_data["thuc_thu"])
    res_pay = await api_client.post(
        f"/api/v1/cashier/invoices/{inv_id}/pay",
        json={"phuong_thuc_thanh_toan": "chuyen_khoan", "so_tien_khach_tra": thuc_thu, "ghi_chu": "VietQR NAPAS 247"},
        headers=token_admin
    )
    assert res_pay.status_code == 200
    assert res_pay.json()["data"]["trang_thai"] == "da_thu"

    res_queue = await api_client.get(
        "/api/v1/subclinical/queue",
        headers=token_admin
    )
    assert res_queue.status_code == 200
    queue_items = res_queue.json()["data"]["items"]
    assert any(q["luot_kham_id"] == enc_id and q["trang_thai"] == "da_thanh_toan" for q in queue_items)

    stmt_rx = select(DonThuoc).where(DonThuoc.luot_kham_id == enc_id)
    rx_in_db = (await db_session.execute(stmt_rx)).scalar_one()
    assert rx_in_db.trang_thai != "PAID"

@pytest.mark.asyncio
async def test_cashier_unbilled_encounters_exclude_cancelled_and_verify_cls_quantities(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)

    lich_cancelled = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_cancelled_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich_cancelled.id, "ly_do_vao_kham": "Ca sau do bi huy"},
        headers=token_bs
    )
    assert res_cancelled_enc.status_code == 201
    cancelled_enc_id = res_cancelled_enc.json()["data"]["id"]

    lich_cancelled.trang_thai = "da_huy"
    await db_session.flush()

    lich_active = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_active_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich_active.id, "ly_do_vao_kham": "Kham thuc te"},
        headers=token_bs
    )
    assert res_active_enc.status_code == 201
    active_enc_id = res_active_enc.json()["data"]["id"]

    dv_a = DichVu(
        ma_dich_vu=f"CLS-XN-A-{booking.suffix}",
        ten_dich_vu="Xet nghiem mau A",
        don_gia=Decimal("100000.00"),
        don_vi_tinh="Lan",
        is_active=True
    )
    dv_b = DichVu(
        ma_dich_vu=f"CLS-XN-B-{booking.suffix}",
        ten_dich_vu="Sieu am tong quat B",
        don_gia=Decimal("150000.00"),
        don_vi_tinh="Lan",
        is_active=True
    )
    db_session.add(dv_a)
    db_session.add(dv_b)
    await db_session.flush()

    res_order_a = await api_client.post(
        f"/api/v1/clinical/encounters/{active_enc_id}/orders",
        json={"dich_vu_id": dv_a.id, "so_luong": 2},
        headers=token_bs
    )
    assert res_order_a.status_code == 201

    res_order_b = await api_client.post(
        f"/api/v1/clinical/encounters/{active_enc_id}/orders",
        json={"dich_vu_id": dv_b.id, "so_luong": 1},
        headers=token_bs
    )
    assert res_order_b.status_code == 201

    res_unbilled = await api_client.get(
        "/api/v1/cashier/unbilled-encounters",
        headers=token_admin
    )
    assert res_unbilled.status_code == 200
    items = res_unbilled.json()["data"]["items"]

    assert not any(it["luot_kham_id"] == cancelled_enc_id for it in items)

    active_item = next(it for it in items if it["luot_kham_id"] == active_enc_id)
    assert active_item["so_chi_dinh"] == 2
    exam_fee = float(booking.bs_x.gia_kham_mac_dinh or 150000.00)
    assert float(active_item["tam_tinh"]) == exam_fee + (100000.00 * 2) + 150000.00

    res_bill = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": active_enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    assert res_bill.status_code == 201
    bill_data = res_bill.json()["data"]
    assert float(bill_data["thuc_thu"]) == float(active_item["tam_tinh"])

@pytest.mark.asyncio
async def test_cannot_create_duplicate_invoice_for_paid_encounter(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kiem tra suc khoe dinh ky"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    res_inv = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    assert res_inv.status_code == 201
    inv_id = res_inv.json()["data"]["id"]
    thuc_thu = float(res_inv.json()["data"]["thuc_thu"])

    res_pay = await api_client.post(
        f"/api/v1/cashier/invoices/{inv_id}/pay",
        json={"phuong_thuc_thanh_toan": "tien_mat", "so_tien_khach_tra": thuc_thu},
        headers=token_admin
    )
    assert res_pay.status_code == 200
    assert res_pay.json()["data"]["trang_thai"] == "da_thu"

    res_dup = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    assert res_dup.status_code == 409
    assert "đã được lập hóa đơn và thanh toán" in res_dup.json()["message"]


@pytest.mark.asyncio
async def test_cashier_and_subclinical_rbac_forbidden(api_client, booking):
    token_patient = booking.tokens["bn_a"]

    res_unbilled = await api_client.get(
        "/api/v1/cashier/unbilled-encounters",
        headers=token_patient
    )
    assert res_unbilled.status_code == 403

    res_create_inv = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": 999999, "mien_giam": 0.00},
        headers=token_patient
    )
    assert res_create_inv.status_code == 403

    res_queue = await api_client.get(
        "/api/v1/subclinical/queue",
        headers=token_patient
    )
    assert res_queue.status_code == 403

    res_start_cls = await api_client.post(
        "/api/v1/subclinical/orders/999999/start",
        headers=token_patient
    )
    assert res_start_cls.status_code == 403



@pytest.mark.asyncio
async def test_cashier_invoice_preview_read_only(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kham kiem tra preview"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    dv = DichVu(
        ma_dich_vu=f"CLS-PREV-{booking.suffix}",
        ten_dich_vu="Sieu am o bung tong quat",
        don_gia=200000.00,
        don_vi_tinh="Lan",
        is_active=True
    )
    db_session.add(dv)
    await db_session.flush()

    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders",
        json={"dich_vu_id": dv.id, "so_luong": 1},
        headers=token_bs
    )
    assert res_order.status_code == 201

    res_prev = await api_client.get(
        f"/api/v1/cashier/encounters/{enc_id}/invoice-preview",
        headers=token_admin
    )
    assert res_prev.status_code == 200
    prev_data = res_prev.json()["data"]
    assert prev_data["luot_kham_id"] == enc_id
    assert len(prev_data["cac_khoan_thu"]) == 2
    assert Decimal(str(prev_data["tong_tien"])) > Decimal("200000.00")

    res_unbilled = await api_client.get(
        "/api/v1/cashier/unbilled-encounters",
        headers=token_admin
    )
    assert res_unbilled.status_code == 200
    unbilled_ids = [it["luot_kham_id"] for it in res_unbilled.json()["data"]["items"]]
    assert enc_id in unbilled_ids


@pytest.mark.asyncio
async def test_cashier_pricing_from_master_dich_vu_when_doctor_has_no_fee(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    booking.bs_x.gia_kham_mac_dinh = 0.0
    await db_session.flush()

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kham vang lai tra gia dich vu"},
        headers=token_bs
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    res_no_config = await api_client.get(
        f"/api/v1/cashier/encounters/{enc_id}/invoice-preview",
        headers=token_admin
    )
    assert res_no_config.status_code == 422
    assert "KHAM_LAM_SANG_CO_BAN" in res_no_config.json()["message"]

    dv_kham = DichVu(
        ma_dich_vu="KHAM_LAM_SANG_CO_BAN",
        ten_dich_vu="Khám lâm sàng cơ bản",
        don_gia=150000.00,
        don_vi_tinh="Lượt",
        is_active=True
    )
    db_session.add(dv_kham)
    await db_session.flush()

    res_prev = await api_client.get(
        f"/api/v1/cashier/encounters/{enc_id}/invoice-preview",
        headers=token_admin
    )
    assert res_prev.status_code == 200
    prev_data = res_prev.json()["data"]
    cong_kham_line = next(it for it in prev_data["cac_khoan_thu"] if it["loai_muc"] == "cong_kham")
    assert Decimal(str(cong_kham_line["don_gia"])) == Decimal("150000.00")

    res_bill = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    assert res_bill.status_code == 201
    bill_data = res_bill.json()["data"]
    inv_cong_kham = next(it for it in bill_data["chi_tiet_hoa_don"] if it["loai_muc"] == "cong_kham")
    assert Decimal(str(inv_cong_kham["don_gia"])) == Decimal("150000.00")
