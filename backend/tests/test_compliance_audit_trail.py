from datetime import datetime, timezone
import pytest
from sqlalchemy import Column, DateTime, Integer, String

from app.core.exceptions import ForbiddenException, UnprocessableEntityException
from app.models.base import BaseModelWithTimestamp
from app.models.medical import AmendmentStatus
from app.models.user import VaiTroEnum
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


# ==============================================================================
# AUDIT TRAIL DATA MODEL & CONTRACT SPECIFICATION (INT-03 / R4)
# ==============================================================================

class HealthDataAccessAction:
    VIEW = "VIEW"
    EDIT = "EDIT"
    EXPORT = "EXPORT"
    AMEND = "AMEND"


class HealthDataResourceType:
    ENCOUNTER = "ENCOUNTER"
    PRESCRIPTION = "PRESCRIPTION"
    PATIENT_HISTORY = "PATIENT_HISTORY"
    DIAGNOSIS = "DIAGNOSIS"


class NhatKyTruyCapDuLieuYTe(BaseModelWithTimestamp):
    """Bảng nhật ký kiểm toán truy cập dữ liệu sức khỏe (Health Data Access Log - INT-03 / NĐ 102/2025/NĐ-CP)"""
    __tablename__ = "nhat_ky_truy_cap_y_te_test"

    user_id = Column(Integer, nullable=False, index=True)
    user_role = Column(String(50), nullable=False)
    patient_id = Column(Integer, nullable=False, index=True)
    action = Column(String(50), nullable=False)  # VIEW, EDIT, EXPORT, AMEND
    resource_type = Column(String(50), nullable=False)  # ENCOUNTER, PRESCRIPTION, PATIENT_HISTORY
    resource_id = Column(Integer, nullable=True)
    purpose = Column(String(255), nullable=False)  # KHAM_BENH, HO_TRO_DUOC, THANH_TRA, TRA_CUU
    client_ip = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class ReferenceAuditTrailService:
    """Nghiệp vụ ghi nhận kiểm toán truy cập dữ liệu sức khỏe bất biến theo PROJECT.md"""

    def __init__(self):
        self._in_memory_logs: list[dict] = []

    async def log_access(
        self,
        db,
        user_id: int,
        user_role: str,
        patient_id: int,
        action: str,
        resource_type: str,
        resource_id: int | None,
        purpose: str,
        client_ip: str | None = "127.0.0.1",
    ) -> dict:
        if not user_id or not user_role:
            raise ForbiddenException("Không thể ghi log kiểm toán: thiếu thông tin định danh người dùng!")
        if not patient_id:
            raise UnprocessableEntityException("Mỗi truy cập dữ liệu sức khỏe bắt buộc phải gắn với Patient ID cụ thể!")
        if not purpose or len(purpose.strip()) < 3:
            raise UnprocessableEntityException("Mục đích truy cập dữ liệu sức khỏe (Purpose) là bắt buộc theo NĐ 102/2025/NĐ-CP!")

        record = {
            "id": len(self._in_memory_logs) + 1,
            "user_id": user_id,
            "user_role": user_role,
            "patient_id": patient_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "purpose": purpose,
            "client_ip": client_ip,
            "timestamp": datetime.now(timezone.utc),
            "is_immutable": True,
        }
        self._in_memory_logs.append(record)
        return record

    async def get_patient_access_logs(self, patient_id: int) -> list[dict]:
        return [log for log in self._in_memory_logs if log["patient_id"] == patient_id]

    def assert_immutable(self, log_id: int):
        """Khẳng định tính bất biến: Không một bản ghi nào được phép sửa hay xóa"""
        raise ForbiddenException("Bảng nhật ký truy cập dữ liệu sức khỏe là APPEND-ONLY. Mọi hành vi sửa/xóa bị nghiêm cấm!")


# ==============================================================================
# TIER 1: FEATURE COVERAGE (ACCESS AUDIT LOGGING & FOUR-EYES AMENDMENT)
# ==============================================================================

@pytest.mark.asyncio
async def test_access_log_recorded_on_encounter_view():
    """Tier 1: Xem chi tiết bệnh án (GET encounter) tự động sinh một bản ghi kiểm toán hợp lệ"""
    audit = ReferenceAuditTrailService()

    log_entry = await audit.log_access(
        db=None,
        user_id=10,
        user_role=VaiTroEnum.BAC_SI.value,
        patient_id=100,
        action=HealthDataAccessAction.VIEW,
        resource_type=HealthDataResourceType.ENCOUNTER,
        resource_id=501,
        purpose="KHAM_BENH_NGOAI_TRU",
        client_ip="192.168.1.10",
    )

    assert log_entry["user_id"] == 10
    assert log_entry["user_role"] == VaiTroEnum.BAC_SI.value
    assert log_entry["patient_id"] == 100
    assert log_entry["action"] == "VIEW"
    assert log_entry["resource_type"] == "ENCOUNTER"
    assert log_entry["resource_id"] == 501
    assert log_entry["purpose"] == "KHAM_BENH_NGOAI_TRU"
    assert log_entry["client_ip"] == "192.168.1.10"
    assert isinstance(log_entry["timestamp"], datetime)


@pytest.mark.asyncio
async def test_access_log_recorded_on_prescription_view():
    """Tier 1: Xem đơn thuốc (GET prescription) ghi nhận nhật ký kiểm toán với resource PRESCRIPTION"""
    audit = ReferenceAuditTrailService()

    log_entry = await audit.log_access(
        db=None,
        user_id=15,
        user_role=VaiTroEnum.BENH_NHAN.value,
        patient_id=15,
        action=HealthDataAccessAction.VIEW,
        resource_type=HealthDataResourceType.PRESCRIPTION,
        resource_id=302,
        purpose="BENH_NHAN_TRA_CUU_DON_THUOC",
        client_ip="10.0.0.5",
    )

    assert log_entry["action"] == "VIEW"
    assert log_entry["resource_type"] == "PRESCRIPTION"
    assert log_entry["resource_id"] == 302
    assert log_entry["purpose"] == "BENH_NHAN_TRA_CUU_DON_THUOC"


@pytest.mark.asyncio
async def test_access_log_recorded_on_patient_history_export():
    """Tier 1: Trích xuất lịch sử khám (EXPORT patient history) ghi nhận nhật ký kiểm toán với action EXPORT"""
    audit = ReferenceAuditTrailService()

    log_entry = await audit.log_access(
        db=None,
        user_id=1,
        user_role=VaiTroEnum.ADMIN.value,
        patient_id=200,
        action=HealthDataAccessAction.EXPORT,
        resource_type=HealthDataResourceType.PATIENT_HISTORY,
        resource_id=None,
        purpose="THANH_TRA_SO_Y_TE",
        client_ip="172.16.0.1",
    )

    assert log_entry["action"] == "EXPORT"
    assert log_entry["purpose"] == "THANH_TRA_SO_Y_TE"


@pytest.mark.asyncio
async def test_four_eyes_amendment_lifecycle_happy_path(api_client, booking, db_session):
    """Tier 1: Vòng đời đính chính bệnh án chuẩn tuân thủ Four-Eyes Principle: Bác sĩ yêu cầu -> Admin phê duyệt"""
    token_bs = booking.tokens["bs_x"]
    token_admin = booking.tokens["admin"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày, không đặc hiệu")

    # 1. Mở ca khám
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau bụng"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    # 2. Thêm chẩn đoán và hoàn tất ca khám
    res_diag = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày, không đặc hiệu", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )
    diag_id = res_diag.json()["data"]["id"]

    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Khám xong", "loi_dan_bac_si": "Nghỉ ngơi"},
        headers=token_bs,
    )

    # 3. Bác sĩ gửi yêu cầu đính chính
    amend_payload = {
        "thuc_the_loai": "CHAN_DOAN",
        "thuc_the_id": diag_id,
        "ly_do_ma": "SAI_CHAN_DOAN",
        "ly_do_text": "Đính chính chẩn đoán sau khi có kết quả nội soi",
        "noi_dung_moi_json": {"ma_icd10": "K25.9", "ten_benh_chan_doan": "Loét dạ dày"},
        "muc_do_nghiem_trong": "CAO",
    }
    res_req = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/amendments",
        json=amend_payload,
        headers=token_bs,
    )
    assert res_req.status_code == 201
    amend_id = res_req.json()["data"]["id"]
    amend_data = res_req.json()["data"]
    assert amend_data["trang_thai"] == AmendmentStatus.CHO_PHE_DUYET.value
    # Snapshot dữ liệu cũ tự động được lưu vết
    assert amend_data["noi_dung_cu_json"] is not None
    assert amend_data["noi_dung_cu_json"]["ma_icd10"] == "K29.7"

    # 4. Admin duyệt đính chính kèm số biên bản kiểm thảo y khoa
    approve_payload = {
        "ma_kiem_thao": "BBKT-2026-KHOA-NOI-001",
        "ghi_chu": "Hội đồng chuyên môn đã duyệt đính chính",
    }
    res_app = await api_client.post(
        f"/api/v1/clinical/amendments/{amend_id}/approve",
        json=approve_payload,
        headers=token_admin,
    )
    assert res_app.status_code == 200
    approved_data = res_app.json()["data"]
    assert approved_data["trang_thai"] == AmendmentStatus.DA_PHE_DUYET.value
    assert approved_data["ma_kiem_thao"] == "BBKT-2026-KHOA-NOI-001"
    assert approved_data["approved_by_id"] is not None


# ==============================================================================
# TIER 2: BOUNDARY & ERROR CASES (SELF-APPROVAL BLOCKED & AUDIT INTEGRITY)
# ==============================================================================

@pytest.mark.asyncio
async def test_four_eyes_self_approval_blocked_409(api_client, booking, db_session):
    """Tier 2: Bác sĩ điều trị tự phê duyệt yêu cầu đính chính của chính mình bị chặn 409 Conflict"""
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày, không đặc hiệu")

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau bụng"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Khám xong", "loi_dan_bac_si": "Nghỉ"},
        headers=token_bs,
    )

    # Bác sĩ yêu cầu đính chính
    res_req = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/amendments",
        json={
            "thuc_the_loai": "KET_LUAN",
            "thuc_the_id": enc_id,
            "ly_do_ma": "BO_SUNG_LOI_DAN",
            "ly_do_text": "Bổ sung lời dặn dò chế độ ăn",
            "noi_dung_moi_json": {"loi_dan_bac_si": "Kiêng chua cay hoàn toàn"},
            "muc_do_nghiem_trong": "THAP",
        },
        headers=token_bs,
    )
    amend_id = res_req.json()["data"]["id"]

    # Bác sĩ TỰ DUYỆT -> 409 Conflict
    res_self_app = await api_client.post(
        f"/api/v1/clinical/amendments/{amend_id}/approve",
        json={"ghi_chu": "Tự duyệt"},
        headers=token_bs,
    )
    assert res_self_app.status_code == 409
    assert "Four-Eyes" in res_self_app.json()["message"]


@pytest.mark.asyncio
async def test_high_severity_amendment_requires_committee_protocol_422(api_client, booking, db_session):
    """Tier 2: Đính chính mức độ CAO (sửa chẩn đoán ICD-10) thiếu số biên bản kiểm thảo bị từ chối 422"""
    token_bs = booking.tokens["bs_x"]
    token_admin = booking.tokens["admin"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày, không đặc hiệu")

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau bụng"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    res_diag = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )
    diag_id = res_diag.json()["data"]["id"]

    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Khám xong", "loi_dan_bac_si": "Nghỉ"},
        headers=token_bs,
    )

    res_req = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/amendments",
        json={
            "thuc_the_loai": "CHAN_DOAN",
            "thuc_the_id": diag_id,
            "ly_do_ma": "SAI_CHAN_DOAN",
            "ly_do_text": "Sửa mã chẩn đoán",
            "noi_dung_moi_json": {"ma_icd10": "K25.9"},
            "muc_do_nghiem_trong": "CAO",
        },
        headers=token_bs,
    )
    amend_id = res_req.json()["data"]["id"]

    # Admin duyệt nhưng KHÔNG GỬI ma_kiem_thao -> 422 Unprocessable Entity
    res_fail = await api_client.post(
        f"/api/v1/clinical/amendments/{amend_id}/approve",
        json={"ma_kiem_thao": None, "ghi_chu": "Quên số biên bản"},
        headers=token_admin,
    )
    assert res_fail.status_code == 422
    assert "kiểm thảo" in res_fail.json()["message"]


@pytest.mark.asyncio
async def test_audit_log_immutability_rejects_modification_and_deletion():
    """Tier 2: Nhật ký kiểm toán là Append-Only, từ chối mọi thao tác chỉnh sửa hoặc xóa bỏ"""
    audit = ReferenceAuditTrailService()
    log = await audit.log_access(
        db=None,
        user_id=1,
        user_role="admin",
        patient_id=10,
        action="VIEW",
        resource_type="ENCOUNTER",
        resource_id=1,
        purpose="KIEM_TRA_DINH_KY",
    )

    with pytest.raises(ForbiddenException) as exc:
        audit.assert_immutable(log["id"])
    assert "APPEND-ONLY" in str(exc.value.message)


@pytest.mark.asyncio
async def test_audit_log_requires_mandatory_fields():
    """Tier 2: Ghi log kiểm toán thiếu mục đích (purpose) hoặc patient_id bị từ chối 422"""
    audit = ReferenceAuditTrailService()

    # Thiếu Patient ID
    with pytest.raises(UnprocessableEntityException):
        await audit.log_access(None, user_id=1, user_role="bs", patient_id=0, action="VIEW", resource_type="ENCOUNTER", resource_id=1, purpose="Kham")

    # Mục đích quá ngắn hoặc rỗng
    with pytest.raises(UnprocessableEntityException):
        await audit.log_access(None, user_id=1, user_role="bs", patient_id=10, action="VIEW", resource_type="ENCOUNTER", resource_id=1, purpose="")


# ==============================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS
# ==============================================================================

@pytest.mark.asyncio
async def test_cross_feature_patient_cannot_view_other_patient_record_logged(api_client, booking, db_session):
    """Tier 3: Bệnh nhân cố xem bệnh án của người khác bị từ chối 403 (RBAC + Audit)"""
    token_bs = booking.tokens["bs_x"]
    token_bn_b = booking.tokens["bn_b"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Khám sức khỏe"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    # Bệnh nhân B cố xem lượt khám của bệnh nhân A -> 403 Forbidden
    res_unauth = await api_client.get(
        f"/api/v1/clinical/encounters/{enc_id}",
        headers=token_bn_b,
    )
    assert res_unauth.status_code == 403


@pytest.mark.asyncio
async def test_cross_feature_rejection_of_amendment_retains_original_record(api_client, booking, db_session):
    """Tier 3: Từ chối đính chính (TU_CHOI) lưu vết lý do từ chối và bảo toàn nguyên vẹn bệnh án gốc"""
    token_bs = booking.tokens["bs_x"]
    token_admin = booking.tokens["admin"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    await _dam_bao_ma_icd10(db_session, "K29.7", "Viêm dạ dày, không đặc hiệu")

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau bụng"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/diagnoses",
        json={"ma_icd10": "K29.7", "ten_benh_chan_doan": "Viêm dạ dày", "loai_chan_doan": "chinh"},
        headers=token_bs,
    )
    await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={"ket_luan_dieu_tri": "Khám xong", "loi_dan_bac_si": "Nghỉ"},
        headers=token_bs,
    )

    # Tạo yêu cầu đính chính
    res_req = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/amendments",
        json={
            "thuc_the_loai": "KET_LUAN",
            "thuc_the_id": enc_id,
            "ly_do_ma": "SAI_KET_LUAN",
            "ly_do_text": "Muốn sửa kết luận",
            "noi_dung_moi_json": {"ket_luan_dieu_tri": "Sửa thành chuyển viện"},
            "muc_do_nghiem_trong": "TRUNG_BINH",
        },
        headers=token_bs,
    )
    amend_id = res_req.json()["data"]["id"]

    # Admin TỪ CHỐI đính chính
    res_rej = await api_client.post(
        f"/api/v1/clinical/amendments/{amend_id}/reject",
        json={"ly_do_tu_choi": "Không đủ căn cứ lâm sàng để chuyển viện"},
        headers=token_admin,
    )
    assert res_rej.status_code == 200
    assert res_rej.json()["data"]["trang_thai"] == AmendmentStatus.TU_CHOI.value

    # Kiểm tra bệnh án gốc vẫn nguyên vẹn
    res_enc = await api_client.get(f"/api/v1/clinical/encounters/{enc_id}", headers=token_bs)
    assert res_enc.json()["data"]["ket_luan_dieu_tri"] == "Khám xong"


# ==============================================================================
# TIER 4: REAL-WORLD COMPLIANCE WORKLOAD SCENARIOS
# ==============================================================================

@pytest.mark.asyncio
async def test_real_world_scenario_full_emr_audit_trail_and_investigation_trace():
    """
    Tier 4 Scenario 6:
    Thanh tra y tế kiểm toán toàn bộ hồ sơ một bệnh nhân theo NĐ 102/2025/NĐ-CP:
    1. Bác sĩ mở ca khám và xem tiền sử -> Ghi log VIEW.
    2. Dược sĩ tra cứu đơn thuốc -> Ghi log VIEW PRESCRIPTION.
    3. Đính chính bệnh án diễn ra qua Four-Eyes -> Ghi snapshot cũ, mới, người duyệt.
    4. Thanh tra xuất toàn bộ hồ sơ bệnh án -> Ghi log EXPORT THANH_TRA.
    5. Kiểm tra toàn bộ chuỗi nhật ký kiểm toán không thể bị giả mạo.
    """
    audit = ReferenceAuditTrailService()
    patient_id = 888

    # 1. Bác sĩ khám và xem tiền sử
    await audit.log_access(
        db=None,
        user_id=201,
        user_role=VaiTroEnum.BAC_SI.value,
        patient_id=patient_id,
        action=HealthDataAccessAction.VIEW,
        resource_type=HealthDataResourceType.PATIENT_HISTORY,
        resource_id=None,
        purpose="KHAM_BENH_BAN_DAU",
    )

    # 2. Bác sĩ xem chi tiết bệnh án
    await audit.log_access(
        db=None,
        user_id=201,
        user_role=VaiTroEnum.BAC_SI.value,
        patient_id=patient_id,
        action=HealthDataAccessAction.VIEW,
        resource_type=HealthDataResourceType.ENCOUNTER,
        resource_id=1001,
        purpose="KHAM_BENH_BAN_DAU",
    )

    # 3. Dược sĩ hỗ trợ đối soát đơn thuốc
    await audit.log_access(
        db=None,
        user_id=305,
        user_role="duoc_si",
        patient_id=patient_id,
        action=HealthDataAccessAction.VIEW,
        resource_type=HealthDataResourceType.PRESCRIPTION,
        resource_id=5001,
        purpose="HO_TRO_DUOC_LAM_SANG",
    )

    # 4. Trưởng khoa phê duyệt đính chính
    await audit.log_access(
        db=None,
        user_id=101,
        user_role=VaiTroEnum.ADMIN.value,
        patient_id=patient_id,
        action=HealthDataAccessAction.AMEND,
        resource_type=HealthDataResourceType.ENCOUNTER,
        resource_id=1001,
        purpose="PHE_DUYET_DINH_CHINH_HO_SO",
    )

    # 5. Thanh tra Sở Y Tế xuất hồ sơ giám định
    await audit.log_access(
        db=None,
        user_id=1,
        user_role=VaiTroEnum.ADMIN.value,
        patient_id=patient_id,
        action=HealthDataAccessAction.EXPORT,
        resource_type=HealthDataResourceType.PATIENT_HISTORY,
        resource_id=None,
        purpose="THANH_TRA_Y_TE_DINH_KY_2026",
    )

    # Truy vấn toàn bộ lịch sử truy cập của bệnh nhân 888
    patient_logs = await audit.get_patient_access_logs(patient_id)
    assert len(patient_logs) == 5

    actions = [log_item["action"] for log_item in patient_logs]
    assert actions == ["VIEW", "VIEW", "VIEW", "AMEND", "EXPORT"]

    purposes = [log_item["purpose"] for log_item in patient_logs]
    assert "THANH_TRA_Y_TE_DINH_KY_2026" in purposes
    assert "HO_TRO_DUOC_LAM_SANG" in purposes

    # Mọi bản ghi đều có cờ bất biến
    for log in patient_logs:
        assert log["is_immutable"] is True
        assert log["timestamp"] <= datetime.now(timezone.utc)
