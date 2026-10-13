import csv
import io
import pytest
from app.models.compliance import (
    HealthDataAccessAction,
    HealthDataResourceType,
)


@pytest.mark.asyncio
async def test_audit_log_api_create_and_query(api_client, booking):
    """Kiểm tra API ghi nhận nhật ký kiểm toán và tra cứu theo bệnh nhân (INT-03)"""
    doctor_headers = booking.tokens["bs_x"]
    patient_headers = booking.tokens["bn_a"]
    patient_id = booking.bn_a.id

    # 1. Bác sĩ ghi nhận hành vi truy cập hồ sơ
    log_payload = {
        "patient_id": patient_id,
        "action": HealthDataAccessAction.VIEW.value,
        "resource_type": HealthDataResourceType.ENCOUNTER.value,
        "resource_id": 101,
        "purpose": "KHAM_BENH",
    }
    resp = await api_client.post("/api/v1/compliance/audit/log", json=log_payload, headers=doctor_headers)
    assert resp.status_code == 201
    res_data = resp.json()["data"]
    assert res_data["patient_id"] == patient_id
    assert res_data["action"] == HealthDataAccessAction.VIEW.value
    assert res_data["purpose"] == "KHAM_BENH"
    assert res_data["is_immutable"] is True

    # 2. Bác sĩ tra cứu nhật ký kiểm toán của bệnh nhân
    resp_query = await api_client.get(f"/api/v1/compliance/audit/patients/{patient_id}", headers=doctor_headers)
    assert resp_query.status_code == 200
    logs = resp_query.json()["data"]
    assert len(logs) >= 1
    assert any(log["purpose"] == "KHAM_BENH" for log in logs)

    # 3. Bệnh nhân không được phép tự xem toàn bộ nhật ký kiểm toán hệ thống (403)
    resp_unauth = await api_client.get(f"/api/v1/compliance/audit/patients/{patient_id}", headers=patient_headers)
    assert resp_unauth.status_code == 403


@pytest.mark.asyncio
async def test_compliance_dashboard_and_export_api(api_client, booking):
    """Kiểm tra API Dashboard giám sát tuân thủ và xuất báo cáo CSV/JSON (R5)"""
    admin_headers = booking.tokens["admin"]
    patient_headers = booking.tokens["bn_a"]

    # 1. Admin truy vấn Dashboard thành công
    resp_dash = await api_client.get("/api/v1/compliance/dashboard", headers=admin_headers)
    assert resp_dash.status_code == 200
    dash_data = resp_dash.json()["data"]
    assert "facility_license_status" in dash_data
    assert "gateway_queues" in dash_data
    assert "emr_compliance" in dash_data
    assert dash_data["statutory_compliance_status"] in ("COMPLIANT", "ATTENTION_REQUIRED", "NON_COMPLIANT")

    # 2. Bệnh nhân bị cấm truy cập Dashboard (403)
    resp_dash_unauth = await api_client.get("/api/v1/compliance/dashboard", headers=patient_headers)
    assert resp_dash_unauth.status_code == 403

    # 3. Admin xuất báo cáo JSON
    resp_export_json = await api_client.get("/api/v1/compliance/reports/export?format=JSON", headers=admin_headers)
    assert resp_export_json.status_code == 200
    export_json_data = resp_export_json.json()["data"]
    assert "statutory_compliance_status" in export_json_data

    # 4. Admin xuất báo cáo CSV
    resp_export_csv = await api_client.get("/api/v1/compliance/reports/export?format=CSV", headers=admin_headers)
    assert resp_export_csv.status_code == 200
    assert "text/csv" in resp_export_csv.headers["content-type"]
    csv_text = resp_export_csv.text
    reader = list(csv.reader(io.StringIO(csv_text)))
    assert len(reader) >= 10
    assert reader[0] == ["CHỈ SỐ TUÂN THỦ PHÁP LÝ", "GIÁ TRỊ", "ĐƠN VỊ", "GHI CHÚ"]

    # 5. Xuất định dạng không hỗ trợ bị từ chối 400
    resp_export_invalid = await api_client.get("/api/v1/compliance/reports/export?format=XML", headers=admin_headers)
    assert resp_export_invalid.status_code == 400
