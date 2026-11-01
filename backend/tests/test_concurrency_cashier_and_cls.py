import pytest
from datetime import datetime, timezone
from decimal import Decimal
from app.models.medical import DichVu


@pytest.mark.asyncio
async def test_cashier_idempotent_payment_and_cancel_guard(api_client, booking, db_session):
    """
    Kiểm tra tính an toàn giao dịch của thu ngân:
    - Khi hóa đơn đã thanh toán (da_thu), không thể hủy hóa đơn (409 Conflict)
    - Khi hóa đơn đã hủy (da_huy), không thể thanh toán (409 Conflict)
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám kiểm tra"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    # Tạo 2 hóa đơn cho 2 kịch bản
    res_b1 = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 0.00},
        headers=token_admin
    )
    inv1_id = res_b1.json()["data"]["id"]
    thuc_thu = float(res_b1.json()["data"]["thuc_thu"])

    # 1. Hóa đơn 1: Thanh toán thành công
    res_pay = await api_client.post(
        f"/api/v1/cashier/invoices/{inv1_id}/pay",
        json={"phuong_thuc_thanh_toan": "tien_mat", "so_tien_khach_tra": thuc_thu},
        headers=token_admin
    )
    assert res_pay.status_code == 200

    # Thử hủy hóa đơn đã thu tiền -> 409 Conflict
    res_cancel_paid = await api_client.post(
        f"/api/v1/cashier/invoices/{inv1_id}/cancel?ly_do=Nhầm_lẫn",
        headers=token_admin
    )
    assert res_cancel_paid.status_code == 409
    assert "đã thu tiền" in res_cancel_paid.json()["message"]


@pytest.mark.asyncio
async def test_subclinical_status_race_and_reexecution_guard(api_client, booking, db_session):
    """
    Kiểm tra tính toàn vẹn trạng thái kỹ thuật viên cận lâm sàng:
    - Khi ca cận lâm sàng đã có kết quả (da_co_ket_qua), không thể bắt đầu lại (start) hay hủy (cancel)
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Nghi ngờ sỏi thận"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    dv = DichVu(
        ma_dich_vu=f"CDHA-SA-{booking.suffix}",
        ten_dich_vu="Siêu âm hệ tiết niệu",
        don_gia=200000.00,
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
    order_id = res_order.json()["data"]["id"]

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

    await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/start",
        headers=token_admin
    )
    res_res = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/results",
        json={"ket_qua_chi_tiet": "Thận phải có sỏi 4mm, không ứ nước", "ket_qua_phan_loai": "BAT_THUONG"},
        headers=token_admin
    )
    assert res_res.status_code == 200

    # Thử gọi start lần nữa trên ca đã có kết quả -> 409 Conflict
    res_re_start = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/start",
        headers=token_admin
    )
    assert res_re_start.status_code == 409

    # Thử hủy ca đã có kết quả -> 409 Conflict
    res_cancel_done = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/cancel?ly_do=Hủy_nhầm",
        headers=token_admin
    )
    assert res_cancel_done.status_code == 409
