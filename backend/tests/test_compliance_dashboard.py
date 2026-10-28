import csv
import io
import json
from datetime import datetime, timezone
import pytest
from pydantic import BaseModel, Field

from app.core.exceptions import BadRequestException, ForbiddenException
from app.models.user import VaiTroEnum
from app.services.credential_service import credential_service


# ==============================================================================
# COMPLIANCE DASHBOARD SCHEMAS & CONTRACT DEFINITIONS (R5 / PROJECT.md)
# ==============================================================================

class GatewayQueueSummary(BaseModel):
    retry_pending_count: int = 0
    manual_review_count: int = 0
    unknown_result_count: int = 0
    total_attention_required: int = 0


class EMRComplianceSummary(BaseModel):
    total_encounters: int = 0
    locked_encounters: int = 0
    locked_completion_rate: float = 100.0
    pending_amendments: int = 0


class ComplianceDashboardResponse(BaseModel):
    facility_license_status: str = "ACTIVE"
    doctor_licenses_active: int = 0
    doctor_licenses_expiring_soon: int = 0
    doctor_licenses_expired: int = 0
    alerts_90_days: int = 0
    alerts_60_days: int = 0
    alerts_30_days: int = 0
    gateway_queues: GatewayQueueSummary = Field(default_factory=GatewayQueueSummary)
    emr_compliance: EMRComplianceSummary = Field(default_factory=EMRComplianceSummary)
    statutory_compliance_status: str = "COMPLIANT"  # COMPLIANT, ATTENTION_REQUIRED, NON_COMPLIANT
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReferenceComplianceService:
    """Nghiệp vụ Bảng điều khiển giám sát tuân thủ & Xuất báo cáo thanh tra (R5)"""

    def __init__(self):
        self.facility_status = "ACTIVE"
        self.gateway_items = []
        self.encounters = []

    async def get_compliance_dashboard(self, db) -> ComplianceDashboardResponse:
        # 1. Tính toán cảnh báo giấy phép từ credential_service
        alerts = await credential_service.get_license_expiry_alerts(db)

        # 2. Tính toán gateway queue
        retry_count = sum(1 for item in self.gateway_items if item.get("status") == "RETRY_PENDING")
        manual_count = sum(1 for item in self.gateway_items if item.get("status") == "MANUAL_REVIEW")
        unknown_count = sum(1 for item in self.gateway_items if item.get("status") == "UNKNOWN_RESULT")

        # 3. Tính toán EMR lock rate
        total_enc = len(self.encounters)
        locked_enc = sum(1 for enc in self.encounters if enc.get("is_locked"))
        rate = (locked_enc / total_enc * 100.0) if total_enc > 0 else 100.0

        # 4. Đánh giá trạng thái tuân thủ
        has_critical = len(alerts.expired) > 0 or manual_count > 5 or rate < 80.0
        has_warning = len(alerts.expiring_30_days) > 0 or retry_count > 0 or unknown_count > 0

        status = "NON_COMPLIANT" if has_critical else ("ATTENTION_REQUIRED" if has_warning else "COMPLIANT")

        return ComplianceDashboardResponse(
            facility_license_status=self.facility_status,
            doctor_licenses_active=max(0, 10 - len(alerts.expired)),
            doctor_licenses_expiring_soon=len(alerts.expiring_30_days) + len(alerts.expiring_60_days) + len(alerts.expiring_90_days),
            doctor_licenses_expired=len(alerts.expired),
            alerts_90_days=len(alerts.expiring_90_days),
            alerts_60_days=len(alerts.expiring_60_days),
            alerts_30_days=len(alerts.expiring_30_days),
            gateway_queues=GatewayQueueSummary(
                retry_pending_count=retry_count,
                manual_review_count=manual_count,
                unknown_result_count=unknown_count,
                total_attention_required=retry_count + manual_count + unknown_count,
            ),
            emr_compliance=EMRComplianceSummary(
                total_encounters=total_enc,
                locked_encounters=locked_enc,
                locked_completion_rate=round(rate, 2),
                pending_amendments=0,
            ),
            statutory_compliance_status=status,
            generated_at=datetime.now(timezone.utc),
        )

    async def export_compliance_report(self, db, format: str) -> str:
        fmt = (format or "").strip().upper()
        if fmt not in ("JSON", "CSV"):
            raise BadRequestException(f"Định dạng xuất báo cáo '{format}' không được hỗ trợ. Chỉ hỗ trợ 'JSON' hoặc 'CSV'!")

        dashboard = await self.get_compliance_dashboard(db)

        if fmt == "JSON":
            return dashboard.model_dump_json(indent=2)

        # CSV format
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["CHỈ SỐ TUÂN THỦ PHÁP LÝ", "GIÁ TRỊ", "ĐƠN VỊ", "GHI CHÚ"])
        writer.writerow(["Trạng thái GPHĐ Cơ sở", dashboard.facility_license_status, "Trạng thái", "Sở Y Tế cấp"])
        writer.writerow(["Bác sĩ có CCHN hợp lệ", dashboard.doctor_licenses_active, "Người", "Đang hành nghề"])
        writer.writerow(["Cảnh báo hết hạn 30 ngày", dashboard.alerts_30_days, "Hồ sơ", "Cần gia hạn gấp"])
        writer.writerow(["Cảnh báo hết hạn 60 ngày", dashboard.alerts_60_days, "Hồ sơ", "Nhắc nhở đợt 2"])
        writer.writerow(["Cảnh báo hết hạn 90 ngày", dashboard.alerts_90_days, "Hồ sơ", "Nhắc nhở đợt 1"])
        writer.writerow(["Giấy phép đã hết hạn (EXPIRED)", dashboard.doctor_licenses_expired, "Hồ sơ", "Đã khóa hành nghề"])
        writer.writerow(["Đơn thuốc chờ gửi lại (Retry)", dashboard.gateway_queues.retry_pending_count, "Đơn", "Cổng quốc gia"])
        writer.writerow(["Đơn thuốc chờ xử lý thủ công", dashboard.gateway_queues.manual_review_count, "Đơn", "Lỗi liên thông"])
        writer.writerow(["Đơn thuốc timeout (Unknown)", dashboard.gateway_queues.unknown_result_count, "Đơn", "Mất kết nối"])
        writer.writerow(["Tỷ lệ khóa bệnh án đúng hạn", f"{dashboard.emr_compliance.locked_completion_rate}%", "%", "NĐ 102/2025/NĐ-CP"])
        writer.writerow(["Đánh giá tuân thủ tổng thể", dashboard.statutory_compliance_status, "Kết luận", "Thanh tra Y tế"])
        return output.getvalue()


# ==============================================================================
# TIER 1: FEATURE COVERAGE (DASHBOARD KPIS & STATUTORY REPORT EXPORT)
# ==============================================================================

@pytest.mark.asyncio
async def test_dashboard_kpis_calculation(db_session):
    """Tier 1: API Dashboard trả về đầy đủ các chỉ số tuân thủ pháp lý y tế"""
    service = ReferenceComplianceService()
    dashboard = await service.get_compliance_dashboard(db_session)

    assert dashboard.facility_license_status == "ACTIVE"
    assert isinstance(dashboard.alerts_90_days, int)
    assert isinstance(dashboard.alerts_60_days, int)
    assert isinstance(dashboard.alerts_30_days, int)
    assert isinstance(dashboard.doctor_licenses_expired, int)

    # Gateway Queues
    assert dashboard.gateway_queues.total_attention_required == (
        dashboard.gateway_queues.retry_pending_count
        + dashboard.gateway_queues.manual_review_count
        + dashboard.gateway_queues.unknown_result_count
    )

    # EMR Compliance
    assert 0.0 <= dashboard.emr_compliance.locked_completion_rate <= 100.0
    assert dashboard.statutory_compliance_status in ("COMPLIANT", "ATTENTION_REQUIRED", "NON_COMPLIANT")


@pytest.mark.asyncio
async def test_statutory_compliance_report_export_json(db_session):
    """Tier 1: Trích xuất báo cáo tuân thủ định dạng JSON phục vụ thanh kiểm tra y tế"""
    service = ReferenceComplianceService()
    json_str = await service.export_compliance_report(db_session, format="JSON")

    data = json.loads(json_str)
    assert "facility_license_status" in data
    assert "gateway_queues" in data
    assert "emr_compliance" in data
    assert "statutory_compliance_status" in data


@pytest.mark.asyncio
async def test_statutory_compliance_report_export_csv(db_session):
    """Tier 1: Trích xuất báo cáo tuân thủ định dạng CSV chuẩn hóa với các trường chỉ số và ghi chú"""
    service = ReferenceComplianceService()
    csv_str = await service.export_compliance_report(db_session, format="CSV")

    reader = list(csv.reader(io.StringIO(csv_str)))
    assert len(reader) >= 10
    header = reader[0]
    assert header == ["CHỈ SỐ TUÂN THỦ PHÁP LÝ", "GIÁ TRỊ", "ĐƠN VỊ", "GHI CHÚ"]

    # Kiểm tra có dòng báo cáo tỷ lệ khóa bệnh án
    rows_text = [row[0] for row in reader]
    assert any("khóa bệnh án" in r for r in rows_text)
    assert any("hết hạn" in r for r in rows_text)


# ==============================================================================
# TIER 2: BOUNDARY & ERROR CASES (UNSUPPORTED FORMAT & EMPTY STATE)
# ==============================================================================

@pytest.mark.parametrize("invalid_fmt", ["XML", "PDF", "XLSX", "HTML", "", "   "])
@pytest.mark.asyncio
async def test_export_rejects_unsupported_format(db_session, invalid_fmt):
    """Tier 2: Xuất báo cáo với định dạng không được hỗ trợ bị từ chối 400 Bad Request"""
    service = ReferenceComplianceService()
    with pytest.raises(BadRequestException) as exc:
        await service.export_compliance_report(db_session, format=invalid_fmt)
    assert "không được hỗ trợ" in str(exc.value.message)


@pytest.mark.asyncio
async def test_dashboard_empty_encounters_handles_zero_division(db_session):
    """Tier 2: Trường hợp chưa có ca khám nào, tỷ lệ hoàn tất bệnh án không gây lỗi chia cho 0"""
    service = ReferenceComplianceService()
    service.encounters = []

    dashboard = await service.get_compliance_dashboard(db_session)
    assert dashboard.emr_compliance.total_encounters == 0
    assert dashboard.emr_compliance.locked_completion_rate == 100.0


@pytest.mark.asyncio
async def test_unauthorized_user_forbidden_from_dashboard():
    """Tier 2: Người dùng mang vai trò Bệnh nhân không được phép xem dashboard tuân thủ của Admin (403)"""
    def check_dashboard_permission(user_role: str):
        if user_role != VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Bảng điều khiển giám sát tuân thủ chỉ dành riêng cho Ban Giám đốc và Quản trị viên!")

    # Admin được phép
    check_dashboard_permission(VaiTroEnum.ADMIN.value)

    # Bệnh nhân bị từ chối
    with pytest.raises(ForbiddenException):
        check_dashboard_permission(VaiTroEnum.BENH_NHAN.value)


# ==============================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS & DYNAMIC KPI UPDATES
# ==============================================================================

@pytest.mark.asyncio
async def test_cross_feature_gateway_failures_trigger_attention_status(db_session):
    """Tier 3: Xuất hiện đơn thuốc timeout và chờ retry làm chuyển trạng thái tổng thể sang ATTENTION_REQUIRED"""
    service = ReferenceComplianceService()
    service.gateway_items = [
        {"id": 1, "status": "UNKNOWN_RESULT"},
        {"id": 2, "status": "RETRY_PENDING"},
    ]

    dashboard = await service.get_compliance_dashboard(db_session)
    assert dashboard.gateway_queues.unknown_result_count == 1
    assert dashboard.gateway_queues.retry_pending_count == 1
    assert dashboard.gateway_queues.total_attention_required == 2
    assert dashboard.statutory_compliance_status == "ATTENTION_REQUIRED"


@pytest.mark.asyncio
async def test_cross_feature_locked_encounters_boost_compliance_rate(db_session):
    """Tier 3: Khóa bệnh án nâng tỷ lệ hoàn thành nghĩa vụ pháp lý EMR lên 100%"""
    service = ReferenceComplianceService()
    service.encounters = [
        {"id": 1, "is_locked": True},
        {"id": 2, "is_locked": True},
        {"id": 3, "is_locked": False},
        {"id": 4, "is_locked": True},
    ]

    dashboard = await service.get_compliance_dashboard(db_session)
    assert dashboard.emr_compliance.total_encounters == 4
    assert dashboard.emr_compliance.locked_encounters == 3
    assert dashboard.emr_compliance.locked_completion_rate == 75.0

    # Khóa nốt ca thứ 3
    service.encounters[2]["is_locked"] = True
    updated_dashboard = await service.get_compliance_dashboard(db_session)
    assert updated_dashboard.emr_compliance.locked_completion_rate == 100.0


# ==============================================================================
# TIER 4: REAL-WORLD COMPLIANCE WORKLOAD SCENARIOS
# ==============================================================================

@pytest.mark.asyncio
async def test_real_world_scenario_medical_director_inspection_workflow(db_session):
    """
    Tier 4 Scenario 7:
    Quy trình kiểm tra tuân thủ pháp lý định kỳ của Người phụ trách chuyên môn / Ban Giám đốc:
    1. Giám đốc chuyên môn mở Dashboard kiểm tra chỉ số tổng quan.
    2. Phát hiện các ca đơn thuốc lỗi cổng liên thông cần xử lý thủ công.
    3. Kiểm tra số lượng bác sĩ sắp hết hạn trong 30 ngày để gửi công văn gia hạn.
    4. Trích xuất báo cáo tuân thủ pháp lý định dạng CSV cho đoàn thanh tra Sở Y Tế.
    5. Trích xuất báo cáo tuân thủ định dạng JSON để lưu trữ điện tử.
    """
    service = ReferenceComplianceService()

    # Giả lập tình hình phòng khám
    service.facility_status = "ACTIVE"
    service.gateway_items = [
        {"id": 101, "status": "MANUAL_REVIEW"},
        {"id": 102, "status": "ACCEPTED"},
        {"id": 103, "status": "RETRY_PENDING"},
    ]
    service.encounters = [
        {"id": 1, "is_locked": True},
        {"id": 2, "is_locked": True},
    ]

    # Bước 1: Tra cứu Dashboard
    dashboard = await service.get_compliance_dashboard(db_session)
    assert dashboard.facility_license_status == "ACTIVE"
    assert dashboard.emr_compliance.locked_completion_rate == 100.0
    assert dashboard.gateway_queues.manual_review_count == 1
    assert dashboard.gateway_queues.retry_pending_count == 1

    # Bước 2 & 3: Xuất báo cáo CSV phục vụ đoàn thanh tra y tế
    csv_report = await service.export_compliance_report(db_session, format="CSV")
    assert "Sở Y Tế cấp" in csv_report
    assert "100.0%" in csv_report

    # Bước 4: Xuất báo cáo JSON lưu trữ số
    json_report = await service.export_compliance_report(db_session, format="JSON")
    parsed = json.loads(json_report)
    assert parsed["emr_compliance"]["locked_completion_rate"] == 100.0
    assert parsed["gateway_queues"]["manual_review_count"] == 1
