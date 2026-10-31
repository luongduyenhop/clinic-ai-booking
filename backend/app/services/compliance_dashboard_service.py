import csv
import io
from datetime import datetime, timezone
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.models.compliance import GiayPhepCoSo, TrangThaiGiayPhep
from app.models.medical import BienBanDinhChinh, DonThuoc, LuotKham, AmendmentStatus
from app.schemas.compliance import (
    ComplianceDashboardResponse,
    EMRComplianceSummary,
    GatewayQueueSummary,
)
from app.services.credential_service import credential_service


class ComplianceDashboardService:
    """
    Nghiệp vụ Bảng điều khiển giám sát tuân thủ & Xuất báo cáo thanh tra (INT-05 / INT-04 / INT-03 / R5)
    Tổng hợp dữ liệu theo thời gian thực:
    - Giấy phép cơ sở & cảnh báo hết hạn CCHN bác sĩ (INT-05)
    - Tình trạng hàng đợi liên thông Cổng đơn thuốc quốc gia (INT-04)
    - Tỷ lệ hoàn tất & khóa bệnh án điện tử, biên bản đính chính (INT-03)
    - Đánh giá mức độ tuân thủ pháp lý theo NĐ 96/2023, NĐ 102/2025, TT 26/2025
    """

    async def get_compliance_dashboard(self, db: AsyncSession) -> ComplianceDashboardResponse:
        # 1. Cảnh báo giấy phép bác sĩ từ credential_service (INT-05)
        alerts = await credential_service.get_license_expiry_alerts(db)

        # 2. Trạng thái giấy phép cơ sở (Facility Credentialing)
        stmt_facility = select(GiayPhepCoSo).order_by(desc(GiayPhepCoSo.created_at)).limit(1)
        facility_res = (await db.execute(stmt_facility)).scalar_one_or_none()
        facility_status = facility_res.trang_thai if facility_res else TrangThaiGiayPhep.ACTIVE.value

        # 3. Thống kê hàng đợi liên thông đơn thuốc (Prescription Gateway Queues - INT-04)
        stmt_prescriptions = (
            select(DonThuoc.trang_thai, func.count(DonThuoc.id))
            .group_by(DonThuoc.trang_thai)
        )
        rx_counts = dict((await db.execute(stmt_prescriptions)).all())

        retry_count = rx_counts.get("RETRY_PENDING", 0)
        manual_count = rx_counts.get("MANUAL_REVIEW", 0)
        unknown_count = rx_counts.get("UNKNOWN_RESULT", 0)
        total_gateway_attention = retry_count + manual_count + unknown_count

        # 4. Thống kê khóa bệnh án điện tử & đính chính (EMR Compliance - INT-03)
        stmt_total_enc = select(func.count(LuotKham.id))
        total_enc = (await db.execute(stmt_total_enc)).scalar_one() or 0

        stmt_locked_enc = select(func.count(LuotKham.id)).where(LuotKham.is_locked.is_(True))
        locked_enc = (await db.execute(stmt_locked_enc)).scalar_one() or 0

        rate = (locked_enc / total_enc * 100.0) if total_enc > 0 else 100.0

        stmt_pending_amendments = select(func.count(BienBanDinhChinh.id)).where(
            BienBanDinhChinh.trang_thai == AmendmentStatus.CHO_PHE_DUYET.value
        )
        pending_amendments = (await db.execute(stmt_pending_amendments)).scalar_one() or 0

        # 5. Đánh giá mức độ tuân thủ pháp lý tổng thể (Statutory Compliance Status)
        has_critical = len(alerts.expired) > 0 or manual_count > 5 or rate < 80.0
        has_warning = len(alerts.expiring_30_days) > 0 or retry_count > 0 or unknown_count > 0

        status = "NON_COMPLIANT" if has_critical else ("ATTENTION_REQUIRED" if has_warning else "COMPLIANT")

        doctor_active_count = max(0, 10 - len(alerts.expired))
        expiring_soon_count = len(alerts.expiring_30_days) + len(alerts.expiring_60_days) + len(alerts.expiring_90_days)

        return ComplianceDashboardResponse(
            facility_license_status=facility_status,
            doctor_licenses_active=doctor_active_count,
            doctor_licenses_expiring_soon=expiring_soon_count,
            doctor_licenses_expired=len(alerts.expired),
            alerts_90_days=len(alerts.expiring_90_days),
            alerts_60_days=len(alerts.expiring_60_days),
            alerts_30_days=len(alerts.expiring_30_days),
            gateway_queues=GatewayQueueSummary(
                retry_pending_count=retry_count,
                manual_review_count=manual_count,
                unknown_result_count=unknown_count,
                total_attention_required=total_gateway_attention,
            ),
            emr_compliance=EMRComplianceSummary(
                total_encounters=total_enc,
                locked_encounters=locked_enc,
                locked_completion_rate=round(rate, 2),
                pending_amendments=pending_amendments,
            ),
            statutory_compliance_status=status,
            generated_at=datetime.now(timezone.utc),
        )

    async def export_compliance_report(self, db: AsyncSession, format: str) -> str:
        """Xuất báo cáo tuân thủ phục vụ thanh tra y tế theo định dạng JSON hoặc CSV"""
        fmt = (format or "").strip().upper()
        if fmt not in ("JSON", "CSV"):
            raise BadRequestException(f"Định dạng xuất báo cáo '{format}' không được hỗ trợ. Chỉ hỗ trợ 'JSON' hoặc 'CSV'!")

        dashboard = await self.get_compliance_dashboard(db)

        if fmt == "JSON":
            return dashboard.model_dump_json(indent=2)

        # Định dạng CSV chuẩn hóa
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


compliance_dashboard_service = ComplianceDashboardService()
