import pytest
from datetime import datetime, timezone
from decimal import Decimal
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
