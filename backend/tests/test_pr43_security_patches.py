import pytest
from app.models.user import VaiTroEnum


@pytest.mark.asyncio
async def test_cashier_refund_requires_staff_role(api_client, booking):
    """
    Vá lỗ hổng PR #43 - Mục 12.1:
    POST /cashier/refund : Phải chặn bệnh nhân hoặc người không có thẩm quyền.
    Chỉ cho phép LE_TAN / THU_NGAN / ADMIN.
    """
    token_bn = booking.tokens["bn_a"]
    payload = {
        "invoice_id": 999999,
        "ly_do": "Hủy dịch vụ khám",
    }

    # Bệnh nhân cố tình gửi request hoàn tiền -> Phải bị từ chối 403 Forbidden
    res = await api_client.post("/api/v1/cashier/refund", json=payload, headers=token_bn)
    assert res.status_code == 403
    assert "hoàn tiền" in res.json()["message"]


@pytest.mark.asyncio
async def test_reception_patient_history_and_packages_idor_protection(api_client, booking):
    """
    Vá lỗ hổng PR #43 - Mục 12.2:
    GET /reception/patients/{benh_nhan_id}/history-summary và /packages : Chặn IDOR.
    Bệnh nhân A không được phép đọc lịch sử hoặc gói khám của Bệnh nhân B.
    """
    token_bn_a = booking.tokens["bn_a"]
    token_letan = booking.tokens["admin"]
    bn_b_id = booking.bn_b.id

    # 1. Bệnh nhân A tra cứu hồ sơ của Bệnh nhân B -> Bị chặn 403 Forbidden
    res_idor_summary = await api_client.get(
        f"/api/v1/reception/patients/{bn_b_id}/history-summary",
        headers=token_bn_a,
    )
    assert res_idor_summary.status_code == 403
    assert "không có quyền" in res_idor_summary.json()["message"]

    # 2. Bệnh nhân A tra cứu gói khám của Bệnh nhân B -> Bị chặn 403 Forbidden
    res_idor_packages = await api_client.get(
        f"/api/v1/reception/patients/{bn_b_id}/packages",
        headers=token_bn_a,
    )
    assert res_idor_packages.status_code == 403
    assert "không có quyền" in res_idor_packages.json()["message"]

    # 3. Lễ tân / Bác sĩ tra cứu bệnh nhân B -> Cho phép (200 OK)
    res_staff = await api_client.get(
        f"/api/v1/reception/patients/{bn_b_id}/history-summary",
        headers=token_letan,
    )
    assert res_staff.status_code == 200


@pytest.mark.asyncio
async def test_reception_appointments_requires_staff_role(api_client, booking):
    """
    Vá lỗ hổng PR #43 - Mục 12.3:
    GET /reception/appointments và /reception/search-appointments:
    Chặn rò rỉ dữ liệu danh sách người bệnh (PII Leak) cho Bệnh nhân hoặc Unauthenticated.
    """
    token_bn = booking.tokens["bn_a"]
    token_letan = booking.tokens["admin"]

    # 1. Người dùng chưa đăng nhập -> 401 Unauthorized
    res_unauth = await api_client.get("/api/v1/reception/appointments")
    assert res_unauth.status_code == 401

    # 2. Bệnh nhân tra cứu toàn bộ danh sách lịch hẹn của phòng khám -> Bị chặn 403 Forbidden
    res_bn_appointments = await api_client.get("/api/v1/reception/appointments", headers=token_bn)
    assert res_bn_appointments.status_code == 403
    assert "tiếp đón" in res_bn_appointments.json()["message"]

    # 3. Bệnh nhân tìm kiếm thông tin lịch hẹn tại quầy -> Bị chặn 403 Forbidden
    res_bn_search = await api_client.get("/api/v1/reception/search-appointments?q=098", headers=token_bn)
    assert res_bn_search.status_code == 403

    # 4. Lễ tân / Admin tra cứu -> Cho phép (200 OK)
    res_staff = await api_client.get("/api/v1/reception/appointments", headers=token_letan)
    assert res_staff.status_code == 200
