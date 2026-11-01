import pytest
from datetime import datetime, timezone
from app.models.medical import DichVu


@pytest.mark.asyncio
async def test_subclinical_queue_start_and_submit_result_flow(api_client, booking, db_session):
    """
    Kiểm tra luồng kỹ thuật viên cận lâm sàng:
    1. Bác sĩ kê chỉ định
    2. Kỹ thuật viên xem hàng đợi CLS
    3. Tiếp nhận thực hiện (chuyển dang_thuc_hien)
    4. Nhập kết quả kèm trị số chi tiết và phân loại (chuyển da_co_ket_qua)
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # 1. Bác sĩ mở ca khám
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Sốt kéo dài"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    # 2. Tạo dịch vụ xét nghiệm máu
    dv = DichVu(
        ma_dich_vu=f"XN-CTM-{booking.suffix}",
        ten_dich_vu="Tổng phân tích tế bào máu ngoại vi",
        don_gia=120000.00,
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
    order_id = res_order.json()["data"]["id"]

    # 3. Kỹ thuật viên xem hàng đợi CLS
    res_q = await api_client.get(
        "/api/v1/subclinical/queue",
        headers=token_admin
    )
    assert res_q.status_code == 200
    q_items = res_q.json()["data"]["items"]
    assert any(it["id"] == order_id for it in q_items)

    # 4. Kỹ thuật viên tiếp nhận mẫu
    res_take_fail = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/start",
        headers=token_admin
    )
    assert res_take_fail.status_code == 409
    assert "chưa được thanh toán" in res_take_fail.json()["message"]

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

    res_take = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/start",
        headers=token_admin
    )
    assert res_take.status_code == 200
    assert res_take.json()["data"]["trang_thai"] == "dang_thuc_hien"

    # 5. Kỹ thuật viên nhập kết quả
    tri_so = {
        "WBC": {"value": 11.5, "unit": "G/L", "ref": "4.0 - 10.0", "flag": "HIGH"},
        "RBC": {"value": 4.8, "unit": "T/L", "ref": "3.8 - 5.5", "flag": "NORMAL"},
        "PLT": {"value": 250, "unit": "G/L", "ref": "150 - 450", "flag": "NORMAL"},
    }
    res_result = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/results",
        json={
            "ket_qua_chi_tiet": "Bạch cầu tăng nhẹ, hướng nhiễm khuẩn cấp",
            "ket_qua_phan_loai": "BAT_THUONG",
            "tri_so_chi_tiet": tri_so,
            "file_dinh_kem_urls": ["https://cdn.clinic-ai.local/lab/ctm-001.pdf"]
        },
        headers=token_admin
    )
    assert res_result.status_code == 200
    res_data = res_result.json()["data"]
    assert res_data["trang_thai"] == "da_co_ket_qua"
    assert res_data["ket_qua_phan_loai"] == "BAT_THUONG"
    assert res_data["tri_so_chi_tiet"]["WBC"]["flag"] == "HIGH"
    assert res_data["thoi_gian_tra_ket_qua"] is not None


@pytest.mark.asyncio
async def test_subclinical_cancel_and_reject_modifying_cancelled(api_client, booking, db_session):
    """
    Kiểm tra hủy chỉ định CLS và chặn ghi kết quả lên chỉ định đã hủy
    """
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_b, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau khớp gối"},
        headers=token_bs
    )
    enc_id = res_start.json()["data"]["id"]

    dv = DichVu(
        ma_dich_vu=f"CDHA-XQ-{booking.suffix}",
        ten_dich_vu="X-Quang khớp gối thẳng nghiêng",
        don_gia=180000.00,
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

    # Hủy chỉ định
    res_cancel = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/cancel?ly_do=Bệnh_nhân_từ_chối_chụp",
        headers=token_admin
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["data"]["trang_thai"] == "da_huy"

    # Thử nhập kết quả vào chỉ định đã hủy -> 409 Conflict
    res_fail = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/results",
        json={"ket_qua_chi_tiet": "Hình ảnh bình thường"},
        headers=token_admin
    )
    assert res_fail.status_code == 409
