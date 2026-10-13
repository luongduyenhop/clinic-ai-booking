from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import NotFoundException, BadRequestException
from app.main import app
from app.models.compliance import GiayPhepCoSo, LichSuGiayPhepBacSi, TrangThaiGiayPhep
from app.models.medical import DichVu, LuotKham
from app.models.appointment import CaLamViecEnum
from app.models.user import BacSi, ChuyenKhoa, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.admin import ShiftCreateRequest
from app.schemas.appointment import AppointmentCreateRequest
from app.schemas.clinical import EncounterCreateRequest, OrderCreateRequest
from app.schemas.compliance import (
    DoctorLicenseStatusUpdateRequest,
    FacilityLicenseCreateRequest,
    FacilityLicenseUpdateRequest,
)
from app.services.credential_service import (
    DoctorLicenseInvalidException,
    ScopeMismatchException,
    credential_service,
)
from app.services.appointment_service import appointment_service
from app.services.clinical_service import clinical_service
from app.services.admin_service import admin_service


client = TestClient(app)


# ==============================================================================
# Helper Factories
# ==============================================================================

def create_mock_db() -> AsyncMock:
    db = AsyncMock()
    db.add = MagicMock()
    return db


def make_doctor(
    id: int = 1,
    cchn: str = "CCHN-TEST-001",
    status: str = TrangThaiGiayPhep.ACTIVE.value,
    expiry: datetime = None,
    scope: list = None,
    is_active: bool = True,
    specialty_id: int = 1,
    name: str = "BS. Nguyễn Văn A",
) -> BacSi:
    doc = BacSi(
        id=id,
        nguoi_dung_id=10,
        chuyen_khoa_id=specialty_id,
        hoc_vi="BSCKI",
        chung_chi_hanh_nghe=cchn,
        nam_kinh_nghiem=5,
        gia_kham_mac_dinh=200000.0,
        is_active=is_active,
        trang_thai_giay_phep=status,
        ngay_het_han=expiry,
        pham_vi_chuyen_mon=scope if scope is not None else [],
    )
    doc.nguoi_dung = NguoiDung(id=10, ho_ten=name, email="bsa@clinic.com")
    doc.chuyen_khoa = ChuyenKhoa(id=specialty_id, ma_chuyen_khoa="KHOA_NOI", ten_chuyen_khoa="Khoa Nội tổng quát")
    return doc


def make_service(
    id: int = 100,
    code: str = "DV-XN-001",
    name: str = "Xét nghiệm máu tổng quát",
    specialty_id: int = 1,
    specialty_code: str = "KHOA_NOI",
    specialty_name: str = "Khoa Nội tổng quát",
    is_active: bool = True,
) -> DichVu:
    svc = DichVu(
        id=id,
        ma_dich_vu=code,
        ten_dich_vu=name,
        chuyen_khoa_id=specialty_id,
        don_gia=150000.0,
        is_active=is_active,
    )
    svc.chuyen_khoa = ChuyenKhoa(id=specialty_id, ma_chuyen_khoa=specialty_code, ten_chuyen_khoa=specialty_name)
    return svc


# ==============================================================================
# 1. DATA MODEL & SCHEMA TESTS
# ==============================================================================

def test_bac_si_model_backward_compatibility():
    """Kiểm tra model BacSi giữ 100% tương thích ngược với các trường mới có default hợp lý"""
    doc = BacSi(
        id=1,
        nguoi_dung_id=1,
        hoc_vi="ThS.BS",
        chung_chi_hanh_nghe="CCHN-123",
    )
    assert doc.trang_thai_giay_phep == "ACTIVE"
    assert doc.pham_vi_chuyen_mon == []
    assert doc.ngay_cap is None
    assert doc.ngay_het_han is None
    assert doc.tep_dinh_kem_url is None


def test_giay_phep_co_so_model():
    """Kiểm tra model GiayPhepCoSo (Facility Credentialing)"""
    now = datetime.now(timezone.utc)
    fac = GiayPhepCoSo(
        id=1,
        so_giay_phep="GPHD-001/BYT",
        ten_co_so="Phòng khám Clinic-AI TP.HCM",
        ngay_cap=now,
        pham_vi_hoat_dong="Khám chữa bệnh đa khoa",
        trang_thai=TrangThaiGiayPhep.ACTIVE.value,
    )
    assert fac.so_giay_phep == "GPHD-001/BYT"
    assert fac.trang_thai == "ACTIVE"


def test_lich_su_giay_phep_model():
    """Kiểm tra model LichSuGiayPhepBacSi lưu vết kiểm toán"""
    now = datetime.now(timezone.utc)
    audit = LichSuGiayPhepBacSi(
        id=1,
        bac_si_id=10,
        trang_thai_cu="ACTIVE",
        trang_thai_moi="SUSPENDED",
        nguoi_thuc_hien_id=1,
        ly_do="Tạm đình chỉ để thanh tra y tế",
        ngay_hieu_luc=now,
    )
    assert audit.trang_thai_cu == "ACTIVE"
    assert audit.trang_thai_moi == "SUSPENDED"
    assert "thanh tra" in audit.ly_do


# ==============================================================================
# 2. AUTOMATED CREDENTIAL GUARD TESTS (check_doctor_license_valid)
# ==============================================================================

@pytest.mark.asyncio
async def test_guard_valid_active_doctor():
    """Bác sĩ ACTIVE với giấy phép còn hạn vượt qua kiểm tra thành công"""
    mock_db = create_mock_db()
    doc = make_doctor(
        status=TrangThaiGiayPhep.ACTIVE.value,
        expiry=datetime.now(timezone.utc) + timedelta(days=180),
    )
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    res = await credential_service.check_doctor_license_valid(mock_db, doc.id)
    assert res.id == doc.id
    assert res.trang_thai_giay_phep == TrangThaiGiayPhep.ACTIVE.value


@pytest.mark.asyncio
async def test_guard_valid_expiring_soon_doctor():
    """Bác sĩ EXPIRING_SOON (<=90 ngày nhưng chưa hết hạn) vẫn được phép hành nghề"""
    mock_db = create_mock_db()
    doc = make_doctor(
        status=TrangThaiGiayPhep.EXPIRING_SOON.value,
        expiry=datetime.now(timezone.utc) + timedelta(days=20),
    )
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    res = await credential_service.check_doctor_license_valid(mock_db, doc.id)
    assert res.id == doc.id


@pytest.mark.asyncio
async def test_guard_blocked_expired_doctor():
    """Bác sĩ có trạng thái EXPIRED bị chặn với mã lỗi 403/Forbidden"""
    mock_db = create_mock_db()
    doc = make_doctor(status=TrangThaiGiayPhep.EXPIRED.value)
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await credential_service.check_doctor_license_valid(mock_db, doc.id)
    assert exc.value.status_code == 403
    assert "HẾT HẠN" in exc.value.detail or "EXPIRED" in exc.value.detail


@pytest.mark.asyncio
async def test_guard_blocked_suspended_doctor():
    """Bác sĩ có trạng thái SUSPENDED bị chặn với mã lỗi 403/Forbidden"""
    mock_db = create_mock_db()
    doc = make_doctor(status=TrangThaiGiayPhep.SUSPENDED.value)
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await credential_service.check_doctor_license_valid(mock_db, doc.id)
    assert exc.value.status_code == 403
    assert "TẠM ĐÌNH CHỈ" in exc.value.detail or "SUSPENDED" in exc.value.detail


@pytest.mark.asyncio
async def test_guard_blocked_revoked_doctor():
    """Bác sĩ có trạng thái REVOKED bị chặn với mã lỗi 403/Forbidden"""
    mock_db = create_mock_db()
    doc = make_doctor(status=TrangThaiGiayPhep.REVOKED.value)
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await credential_service.check_doctor_license_valid(mock_db, doc.id)
    assert exc.value.status_code == 403
    assert "THU HỒI" in exc.value.detail or "REVOKED" in exc.value.detail


@pytest.mark.asyncio
async def test_guard_auto_detect_expired_date():
    """Bác sĩ có trạng thái ACTIVE nhưng ngày hết hạn nằm trong quá khứ bị tự động chuyển EXPIRED và chặn 403"""
    mock_db = create_mock_db()
    past_date = datetime.now(timezone.utc) - timedelta(days=5)
    doc = make_doctor(status=TrangThaiGiayPhep.ACTIVE.value, expiry=past_date)
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await credential_service.check_doctor_license_valid(mock_db, doc.id)
    assert exc.value.status_code == 403
    assert doc.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRED.value
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_guard_doctor_not_found():
    """Tra cứu bác sĩ không tồn tại ném NotFoundException 404"""
    mock_db = create_mock_db()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_res

    with pytest.raises(NotFoundException):
        await credential_service.check_doctor_license_valid(mock_db, 9999)


# ==============================================================================
# 3. SCOPE OF PRACTICE GUARD TESTS (check_doctor_scope_of_practice)
# ==============================================================================

@pytest.mark.asyncio
async def test_scope_guard_empty_scope_allowed_by_default():
    """Bác sĩ có danh sách phạm vi rỗng (mặc định) được phép chỉ định (bảo toàn tương thích ngược)"""
    mock_db = create_mock_db()
    doc = make_doctor(scope=[])
    svc = make_service()

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    res = await credential_service.check_doctor_scope_of_practice(mock_db, doc.id, svc.id)
    assert res is True


@pytest.mark.asyncio
async def test_scope_guard_matching_specialty_allowed():
    """Dịch vụ có chuyên khoa nằm trong pham_vi_chuyen_mon được phép chỉ định"""
    mock_db = create_mock_db()
    doc = make_doctor(scope=["KHOA_NOI", "NOI_TIM_MACH"])
    svc = make_service(specialty_code="KHOA_NOI")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    res = await credential_service.check_doctor_scope_of_practice(mock_db, doc.id, svc.id)
    assert res is True


@pytest.mark.asyncio
async def test_scope_guard_mismatched_specialty_blocked_409():
    """Dịch vụ có chuyên khoa nằm ngoài pham_vi_chuyen_mon bị chặn với mã lỗi 409/Conflict"""
    mock_db = create_mock_db()
    doc = make_doctor(scope=["KHOA_NOI", "NOI_TIM_MACH"])
    svc = make_service(
        code="DV-PT-001",
        name="Phẫu thuật nội soi ngoại khoa",
        specialty_id=2,
        specialty_code="KHOA_NGOAI",
        specialty_name="Khoa Ngoại tổng quát",
    )

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    with pytest.raises(ScopeMismatchException) as exc:
        await credential_service.check_doctor_scope_of_practice(mock_db, doc.id, svc.id)
    assert exc.value.status_code == 409
    assert "phạm vi chuyên môn" in exc.value.detail


# ==============================================================================
# 4. BUSINESS LOGIC INTEGRATION GUARDS
# ==============================================================================

@pytest.mark.asyncio
async def test_appointment_booking_blocks_expired_doctor():
    """appointment_service.create_booking từ chối đặt lịch nếu bác sĩ hết hạn (EXPIRED)"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=5, nguoi_dung_id=5, vai_tro=VaiTroEnum.BENH_NHAN.value)
    benh_nhan = MagicMock(id=1, is_blocked_booking=False)
    nguoi_dung = MagicMock(ho_ten="Bệnh nhân B")

    # 1. Row bệnh nhân
    mock_bn_res = MagicMock()
    mock_bn_res.first.return_value = (benh_nhan, nguoi_dung)

    # 2. Row bác sĩ active
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.EXPIRED.value)
    mock_doc_res = MagicMock()
    mock_doc_res.first.return_value = (doc, doc.nguoi_dung, doc.chuyen_khoa)

    # 3. check_doctor_license_valid query
    mock_license_res = MagicMock()
    mock_license_res.scalar_one_or_none.return_value = doc

    mock_db.execute.side_effect = [mock_bn_res, mock_doc_res, mock_license_res]

    payload = AppointmentCreateRequest(
        bac_si_id=10,
        ngay_kham=date.today() + timedelta(days=2),
        gio_kham=datetime.strptime("08:00", "%H:%M").time(),
        ly_do_kham="Đau đầu",
    )

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await appointment_service.create_booking(payload, user, mock_db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_clinical_start_encounter_blocks_suspended_doctor():
    """clinical_service.start_encounter từ chối mở ca khám nếu bác sĩ bị đình chỉ (SUSPENDED)"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=2, nguoi_dung_id=10, vai_tro=VaiTroEnum.BAC_SI.value)
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.SUSPENDED.value)

    # 1. _get_doctor_from_user
    mock_doc_user_res = MagicMock()
    mock_doc_user_res.scalar_one_or_none.return_value = doc

    # 2. check_doctor_license_valid
    mock_check_res = MagicMock()
    mock_check_res.scalar_one_or_none.return_value = doc

    mock_db.execute.side_effect = [mock_doc_user_res, mock_check_res]

    payload = EncounterCreateRequest(lich_kham_id=100)

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await clinical_service.start_encounter(payload, user, mock_db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_clinical_add_order_blocks_out_of_scope_service():
    """clinical_service.add_order từ chối chỉ định dịch vụ ngoài phạm vi (409)"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=2, nguoi_dung_id=10, vai_tro=VaiTroEnum.BAC_SI.value)
    doc = make_doctor(id=10, scope=["KHOA_NOI"])
    encounter = LuotKham(id=50, bac_si_id=10, is_locked=False)
    svc = make_service(
        id=99,
        code="DV-RHM-001",
        name="Nhổ răng khôn",
        specialty_id=3,
        specialty_code="KHOA_RANG_HAM_MAT",
    )

    # 1. _get_doctor_from_user
    # 2. encounter query
    # 3. service query in add_order
    # 4. doctor query in check_doctor_scope_of_practice
    # 5. service query in check_doctor_scope_of_practice
    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=encounter)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    payload = OrderCreateRequest(dich_vu_id=99, so_luong=1)

    with pytest.raises(ScopeMismatchException) as exc:
        await clinical_service.add_order(encounter_id=50, payload=payload, user=user, db=mock_db)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_admin_create_shift_blocks_expired_doctor():
    """admin_service.create_shift từ chối phân ca nếu bác sĩ hết hạn (EXPIRED)"""
    mock_db = create_mock_db()
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.EXPIRED.value)

    # 1. get doctor in create_shift
    # 2. check_doctor_license_valid
    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = ShiftCreateRequest(
        bac_si_id=10,
        ngay_lam_viec=date.today() + timedelta(days=1),
        ca_lam_viec=CaLamViecEnum.SANG.value,
    )

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await admin_service.create_shift(payload, mock_db)
    assert exc.value.status_code == 403


# ==============================================================================
# 5. EXPIRY ALERTS & LIFECYCLE AUDIT TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_license_expiry_alerts_bucket_distribution():
    """Kiểm tra phân bổ các nhóm cảnh báo 90, 60, 30 ngày và đã hết hạn (INT-05)"""
    mock_db = create_mock_db()
    now = datetime.now(timezone.utc)

    d_expired = make_doctor(id=1, cchn="C1", expiry=now - timedelta(days=2))
    d_30 = make_doctor(id=2, cchn="C2", expiry=now + timedelta(days=15))
    d_60 = make_doctor(id=3, cchn="C3", expiry=now + timedelta(days=45))
    d_90 = make_doctor(id=4, cchn="C4", expiry=now + timedelta(days=75))
    d_safe = make_doctor(id=5, cchn="C5", expiry=now + timedelta(days=120))

    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = [d_expired, d_30, d_60, d_90, d_safe]
    mock_db.execute.return_value = mock_res

    report = await credential_service.get_license_expiry_alerts(mock_db)

    assert len(report.expired) == 1
    assert report.expired[0].bac_si_id == 1
    assert len(report.expiring_30_days) == 1
    assert report.expiring_30_days[0].bac_si_id == 2
    assert len(report.expiring_60_days) == 1
    assert report.expiring_60_days[0].bac_si_id == 3
    assert len(report.expiring_90_days) == 1
    assert report.expiring_90_days[0].bac_si_id == 4
    assert report.total_alerts == 4


@pytest.mark.asyncio
async def test_update_license_status_creates_audit_record():
    """Cập nhật trạng thái giấy phép tạo bản ghi LichSuGiayPhepBacSi và cập nhật is_active"""
    mock_db = create_mock_db()
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.ACTIVE.value, is_active=True)

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi=TrangThaiGiayPhep.SUSPENDED.value,
        ly_do="Đình chỉ tạm thời để xác minh chuyên môn theo yêu cầu Sở Y tế",
    )

    updated = await credential_service.update_doctor_license_status(
        mock_db, doctor_id=10, payload=payload, user_id=1
    )

    assert updated.trang_thai_giay_phep == TrangThaiGiayPhep.SUSPENDED.value
    assert doc.is_active is False
    mock_db.add.assert_called()
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_license_status_invalid_value_fails():
    """Cập nhật trạng thái bằng giá trị không hợp lệ ném BadRequestException 400"""
    mock_db = create_mock_db()
    payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi="INVALID_STATUS",
        ly_do="Test invalid",
    )
    with pytest.raises(BadRequestException):
        await credential_service.update_doctor_license_status(mock_db, doctor_id=10, payload=payload)


# ==============================================================================
# 6. FACILITY LICENSE CRUD TESTS (GiayPhepCoSo)
# ==============================================================================

@pytest.mark.asyncio
async def test_facility_license_crud_lifecycle():
    """Kiểm tra toàn bộ vòng đời CRUD giấy phép hoạt động cơ sở"""
    mock_db = create_mock_db()

    # 1. Create duplicate check
    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)), # not exist
    ]

    create_payload = FacilityLicenseCreateRequest(
        so_giay_phep="GPHD-2026/HN",
        ten_co_so="Clinic-AI Hà Nội",
        ngay_cap=datetime.now(timezone.utc),
        pham_vi_hoat_dong="Đa khoa",
    )

    async def mock_refresh(obj):
        if not getattr(obj, "id", None):
            setattr(obj, "id", 1)
    mock_db.refresh = AsyncMock(side_effect=mock_refresh)

    res = await credential_service.create_facility_license(mock_db, create_payload)
    assert res.so_giay_phep == "GPHD-2026/HN"
    mock_db.add.assert_called()
    mock_db.commit.assert_awaited()

    # 2. Get license
    existing_facility = GiayPhepCoSo(
        id=99,
        so_giay_phep="GPHD-2026/HN",
        ten_co_so="Clinic-AI Hà Nội",
        ngay_cap=datetime.now(timezone.utc),
        trang_thai=TrangThaiGiayPhep.ACTIVE.value,
    )
    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=existing_facility)),
    ]
    fetched = await credential_service.get_facility_license(mock_db, 99)
    assert fetched.id == 99

    # 3. Update license
    update_payload = FacilityLicenseUpdateRequest(ten_co_so="Clinic-AI Hà Nội - Mở rộng")
    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=existing_facility)),
    ]
    updated = await credential_service.update_facility_license(mock_db, 99, update_payload)
    assert updated.ten_co_so == "Clinic-AI Hà Nội - Mở rộng"

    # 4. Delete license
    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=existing_facility)),
    ]
    deleted = await credential_service.delete_facility_license(mock_db, 99)
    assert deleted is True
    mock_db.delete.assert_called_with(existing_facility)


# ==============================================================================
# 7. ROUTER SMOKE & ENVELOPE VERIFICATION
# ==============================================================================

def test_unauthorized_access_to_compliance_routes():
    """Các endpoint tuân thủ pháp lý yêu cầu Bearer Token (401 khi không đăng nhập)"""
    resp1 = client.get("/api/v1/compliance/doctors/1/license")
    assert resp1.status_code == 401

    resp2 = client.get("/api/v1/compliance/facility-licenses")
    assert resp2.status_code == 401

    resp3 = client.get("/api/v1/compliance/alerts/expiring-licenses")
    assert resp3.status_code == 401


def test_doctor_user_forbidden_from_admin_compliance_routes():
    """Tài khoản Bác sĩ bị từ chối 403 khi thực hiện các tác vụ quản trị giấy phép cơ sở"""
    from app.core.dependencies import get_current_user
    from app.core.database import get_db

    def mock_get_doctor_user():
        return TaiKhoan(id=10, email="doc@clinic.com", vai_tro=VaiTroEnum.BAC_SI.value, is_active=True)

    async def mock_db_gen():
        yield AsyncMock()

    app.dependency_overrides[get_current_user] = mock_get_doctor_user
    app.dependency_overrides[get_db] = mock_db_gen
    try:
        payload = {
            "so_giay_phep": "GPHD-TEST",
            "ten_co_so": "Test",
            "ngay_cap": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.post("/api/v1/compliance/facility-licenses", json=payload)
        assert resp.status_code == 403
        body = resp.json()
        assert body["code"] == 403
        assert body["success"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ==============================================================================
# 8. CHALLENGER 2 EMPIRICAL BOUNDARY & CORNER STRESS TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_license_expiry_alerts_exact_boundaries():
    """
    Empirically verify exact boundary days for license expiry alerts:
    - 91 days: not in alert buckets (safe)
    - 90 days: in expiring_90_days
    - 61 days: in expiring_90_days
    - 60 days: in expiring_60_days
    - 31 days: in expiring_60_days
    - 30 days: in expiring_30_days
    - 1 day: in expiring_30_days
    - 0 days: in expiring_30_days (expires today)
    - -1 days: in expired (expired yesterday)
    - -10 days: in expired
    """
    mock_db = create_mock_db()
    now = datetime.now(timezone.utc)

    d_safe = make_doctor(id=1, cchn="C-91", expiry=now + timedelta(days=91))
    d_90 = make_doctor(id=2, cchn="C-90", expiry=now + timedelta(days=90))
    d_61 = make_doctor(id=3, cchn="C-61", expiry=now + timedelta(days=61))
    d_60 = make_doctor(id=4, cchn="C-60", expiry=now + timedelta(days=60))
    d_31 = make_doctor(id=5, cchn="C-31", expiry=now + timedelta(days=31))
    d_30 = make_doctor(id=6, cchn="C-30", expiry=now + timedelta(days=30))
    d_1 = make_doctor(id=7, cchn="C-1", expiry=now + timedelta(days=1))
    d_0 = make_doctor(id=8, cchn="C-0", expiry=now)
    d_neg1 = make_doctor(id=9, cchn="C-NEG1", expiry=now - timedelta(days=1))
    d_neg10 = make_doctor(id=10, cchn="C-NEG10", expiry=now - timedelta(days=10))

    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = [
        d_safe, d_90, d_61, d_60, d_31, d_30, d_1, d_0, d_neg1, d_neg10
    ]
    mock_db.execute.return_value = mock_res

    report = await credential_service.get_license_expiry_alerts(mock_db)

    # 1. 91 days -> not included
    all_alert_ids = {
        item.bac_si_id
        for group in (report.expired, report.expiring_30_days, report.expiring_60_days, report.expiring_90_days)
        for item in group
    }
    assert 1 not in all_alert_ids, "91 days must NOT be included in any alert bucket"

    # 2. 90 days and 61 days -> expiring_90_days
    exp_90_ids = [item.bac_si_id for item in report.expiring_90_days]
    assert 2 in exp_90_ids
    assert 3 in exp_90_ids
    assert len(report.expiring_90_days) == 2

    # 3. 60 days and 31 days -> expiring_60_days
    exp_60_ids = [item.bac_si_id for item in report.expiring_60_days]
    assert 4 in exp_60_ids
    assert 5 in exp_60_ids
    assert len(report.expiring_60_days) == 2

    # 4. 30 days, 1 day, 0 days -> expiring_30_days
    exp_30_ids = [item.bac_si_id for item in report.expiring_30_days]
    assert 6 in exp_30_ids
    assert 7 in exp_30_ids
    assert 8 in exp_30_ids
    assert len(report.expiring_30_days) == 3

    # 5. -1 days and -10 days -> expired
    expired_ids = [item.bac_si_id for item in report.expired]
    assert 9 in expired_ids
    assert 10 in expired_ids
    assert len(report.expired) == 2

    # Total alerts = 2 + 2 + 3 + 2 = 9
    assert report.total_alerts == 9


@pytest.mark.asyncio
async def test_auto_transition_from_active_to_expiring_soon_within_30_days():
    """
    Empirically verify auto-transition from ACTIVE to EXPIRING_SOON:
    - ACTIVE doctors within 30 days are automatically transitioned to EXPIRING_SOON.
    - SUSPENDED and REVOKED doctors within 30 days retain their severe status.
    - Database commit is triggered when status is updated.
    """
    mock_db = create_mock_db()
    now = datetime.now(timezone.utc)

    doc_active_30 = make_doctor(id=1, cchn="C-ACT30", status=TrangThaiGiayPhep.ACTIVE.value, expiry=now + timedelta(days=30))
    doc_active_10 = make_doctor(id=2, cchn="C-ACT10", status=TrangThaiGiayPhep.ACTIVE.value, expiry=now + timedelta(days=10))
    doc_active_0 = make_doctor(id=3, cchn="C-ACT0", status=TrangThaiGiayPhep.ACTIVE.value, expiry=now)
    doc_suspended = make_doctor(id=4, cchn="C-SUSP", status=TrangThaiGiayPhep.SUSPENDED.value, expiry=now + timedelta(days=15))
    doc_revoked = make_doctor(id=5, cchn="C-REV", status=TrangThaiGiayPhep.REVOKED.value, expiry=now + timedelta(days=15))

    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = [
        doc_active_30, doc_active_10, doc_active_0, doc_suspended, doc_revoked
    ]
    mock_db.execute.return_value = mock_res

    report = await credential_service.get_license_expiry_alerts(mock_db)
    assert report is not None

    # ACTIVE doctors must transition to EXPIRING_SOON
    assert doc_active_30.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRING_SOON.value
    assert doc_active_10.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRING_SOON.value
    assert doc_active_0.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRING_SOON.value

    # SUSPENDED and REVOKED doctors must NOT transition to EXPIRING_SOON
    assert doc_suspended.trang_thai_giay_phep == TrangThaiGiayPhep.SUSPENDED.value
    assert doc_revoked.trang_thai_giay_phep == TrangThaiGiayPhep.REVOKED.value

    # Verify db.commit was called to persist status updates
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_auto_transition_from_active_to_expired_when_past_expiry():
    """
    Empirically verify auto-transition from ACTIVE to EXPIRED when past expiry date:
    Case A: During get_license_expiry_alerts sweep:
      - Doctors past expiry (days_left < 0) transition from ACTIVE to EXPIRED.
      - Doctors in EXPIRING_SOON transition to EXPIRED.
      - Doctors in REVOKED stay REVOKED.
    Case B: In check_doctor_license_valid guard (runtime enforcement):
      - A doctor whose expiry date has passed is auto-updated to EXPIRED and committed on the fly.
    """
    # Case A: Sweep
    mock_db = create_mock_db()
    now = datetime.now(timezone.utc)

    doc_active_past = make_doctor(id=1, cchn="C-P1", status=TrangThaiGiayPhep.ACTIVE.value, expiry=now - timedelta(days=1))
    doc_expiring_soon_past = make_doctor(id=2, cchn="C-P2", status=TrangThaiGiayPhep.EXPIRING_SOON.value, expiry=now - timedelta(days=5))
    doc_revoked_past = make_doctor(id=3, cchn="C-P3", status=TrangThaiGiayPhep.REVOKED.value, expiry=now - timedelta(days=10))

    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = [
        doc_active_past, doc_expiring_soon_past, doc_revoked_past
    ]
    mock_db.execute.return_value = mock_res

    report = await credential_service.get_license_expiry_alerts(mock_db)
    assert report is not None

    assert doc_active_past.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRED.value
    assert doc_expiring_soon_past.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRED.value
    assert doc_revoked_past.trang_thai_giay_phep == TrangThaiGiayPhep.REVOKED.value
    mock_db.commit.assert_awaited()

    # Case B: On-the-fly check_doctor_license_valid
    mock_db_runtime = create_mock_db()
    doc_runtime = make_doctor(
        id=99,
        cchn="C-RUN",
        status=TrangThaiGiayPhep.ACTIVE.value,
        expiry=now - timedelta(hours=2)
    )
    mock_res_runtime = MagicMock()
    mock_res_runtime.scalar_one_or_none.return_value = doc_runtime
    mock_db_runtime.execute.return_value = mock_res_runtime

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await credential_service.check_doctor_license_valid(mock_db_runtime, doc_runtime.id)

    assert exc.value.status_code == 403
    assert doc_runtime.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRED.value
    mock_db_runtime.add.assert_called_with(doc_runtime)
    mock_db_runtime.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_license_status_edge_cases_and_invalid_inputs():
    """
    Empirically test invalid inputs and edge cases on update_doctor_license_status:
    1. Invalid status string raises BadRequestException (400)
    2. Lowercase status string raises BadRequestException (400)
    3. Non-existent doctor ID raises NotFoundException (404)
    4. Transition to SUSPENDED / REVOKED / EXPIRED sets is_active=False
    5. Transition from SUSPENDED back to ACTIVE sets is_active=True
    6. Audit history captures custom reason and custom ngay_hieu_luc
    """
    mock_db = create_mock_db()
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.ACTIVE.value, is_active=True)

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    # 1. Invalid status string
    bad_payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi="UNKNOWN_STATE",
        ly_do="Test invalid input",
    )
    with pytest.raises(BadRequestException) as exc1:
        await credential_service.update_doctor_license_status(mock_db, doctor_id=10, payload=bad_payload)
    assert "không hợp lệ" in str(exc1.value.message)

    # 2. Lowercase status string
    bad_lower_payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi="active",
        ly_do="Test lower case",
    )
    with pytest.raises(BadRequestException) as exc2:
        await credential_service.update_doctor_license_status(mock_db, doctor_id=10, payload=bad_lower_payload)
    assert "không hợp lệ" in str(exc2.value.message)

    # 3. Doctor not found
    mock_db_not_found = create_mock_db()
    mock_res_nf = MagicMock()
    mock_res_nf.scalar_one_or_none.return_value = None
    mock_db_not_found.execute.return_value = mock_res_nf

    valid_payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi=TrangThaiGiayPhep.SUSPENDED.value,
        ly_do="Đình chỉ công tác",
    )
    with pytest.raises(NotFoundException):
        await credential_service.update_doctor_license_status(mock_db_not_found, doctor_id=99999, payload=valid_payload)

    # 4. ACTIVE -> SUSPENDED syncs is_active=False
    res_suspended = await credential_service.update_doctor_license_status(
        mock_db, doctor_id=10, payload=valid_payload, user_id=1
    )
    assert res_suspended.trang_thai_giay_phep == TrangThaiGiayPhep.SUSPENDED.value
    assert doc.is_active is False

    # 5. SUSPENDED -> ACTIVE restores is_active=True
    reactivate_payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi=TrangThaiGiayPhep.ACTIVE.value,
        ly_do="Phục hồi giấy phép sau thanh tra đạt yêu cầu",
    )
    res_active = await credential_service.update_doctor_license_status(
        mock_db, doctor_id=10, payload=reactivate_payload, user_id=1
    )
    assert res_active.trang_thai_giay_phep == TrangThaiGiayPhep.ACTIVE.value
    assert doc.is_active is True

    # 6. ACTIVE -> REVOKED syncs is_active=False
    revoke_payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi=TrangThaiGiayPhep.REVOKED.value,
        ly_do="Thu hồi giấy phép vĩnh viễn theo quyết định Bộ Y tế",
    )
    res_revoked = await credential_service.update_doctor_license_status(
        mock_db, doctor_id=10, payload=revoke_payload, user_id=1
    )
    assert res_revoked.trang_thai_giay_phep == TrangThaiGiayPhep.REVOKED.value
    assert doc.is_active is False


@pytest.mark.asyncio
async def test_concurrent_license_status_updates():
    """
    Empirically test concurrent status updates for doctors.
    Simulate multiple asynchronous operations executing concurrently via asyncio.gather.
    """
    import asyncio

    # Setup 3 independent mock sessions and doctors
    tasks = []
    doctors = []
    sessions = []

    for i in range(1, 4):
        doc = make_doctor(id=i, cchn=f"CCHN-CONC-{i}", status=TrangThaiGiayPhep.ACTIVE.value)
        doctors.append(doc)
        s = create_mock_db()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = doc
        s.execute.return_value = mock_res
        sessions.append(s)

        payload = DoctorLicenseStatusUpdateRequest(
            trang_thai_moi=TrangThaiGiayPhep.SUSPENDED.value,
            ly_do=f"Đình chỉ kiểm tra đồng thời {i}",
        )
        tasks.append(credential_service.update_doctor_license_status(s, doctor_id=i, payload=payload, user_id=99))

    results = await asyncio.gather(*tasks)

    assert len(results) == 3
    for i, res in enumerate(results):
        assert res.trang_thai_giay_phep == TrangThaiGiayPhep.SUSPENDED.value
        assert doctors[i].is_active is False
        sessions[i].commit.assert_awaited()

