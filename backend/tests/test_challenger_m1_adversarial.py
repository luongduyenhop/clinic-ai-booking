from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.appointment import CaLamViecEnum
from app.models.compliance import LichSuGiayPhepBacSi, TrangThaiGiayPhep
from app.models.medical import DichVu, LuotKham
from app.models.user import BacSi, ChuyenKhoa, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.admin import ShiftCreateRequest
from app.schemas.appointment import AppointmentCreateRequest
from app.schemas.clinical import EncounterCreateRequest, OrderCreateRequest
from app.schemas.compliance import (
    DoctorLicenseStatusUpdateRequest,
    DoctorLicenseUpdateRequest,
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
    name: str = "BS. Adversarial Test",
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
    doc.nguoi_dung = NguoiDung(id=10, ho_ten=name, email="bs.adv@clinic.com")
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
    if specialty_code:
        svc.chuyen_khoa = ChuyenKhoa(id=specialty_id, ma_chuyen_khoa=specialty_code, ten_chuyen_khoa=specialty_name)
    else:
        svc.chuyen_khoa = None
    return svc


# ==============================================================================
# SUITE 1: EXPIRED & SUSPENDED INVARIANTS (Booking, Encounter, Shift)
# ==============================================================================

@pytest.mark.asyncio
async def test_expired_doctor_cannot_create_booking():
    """Bác sĩ có giấy phép EXPIRED tuyệt đối không thể tạo booking (403)"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=5, nguoi_dung_id=5, vai_tro=VaiTroEnum.BENH_NHAN.value)
    benh_nhan = MagicMock(id=1, is_blocked_booking=False)
    nguoi_dung = MagicMock(ho_ten="Bệnh nhân B")
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.EXPIRED.value)

    mock_db.execute.side_effect = [
        MagicMock(first=MagicMock(return_value=(benh_nhan, nguoi_dung))),
        MagicMock(first=MagicMock(return_value=(doc, doc.nguoi_dung, doc.chuyen_khoa))),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = AppointmentCreateRequest(
        bac_si_id=10,
        ngay_kham=date.today() + timedelta(days=2),
        gio_kham=datetime.strptime("08:00", "%H:%M").time(),
        ly_do_kham="Đau đầu",
    )

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await appointment_service.create_booking(payload, user, mock_db)
    assert exc.value.status_code == 403
    assert "EXPIRED" in exc.value.detail or "HẾT HẠN" in exc.value.detail


@pytest.mark.asyncio
async def test_past_expiry_date_doctor_auto_expires_and_blocks_booking():
    """Bác sĩ có trạng thái ACTIVE nhưng ngay_het_han nằm trong quá khứ bị auto-EXPIRED và chặn 403"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=5, nguoi_dung_id=5, vai_tro=VaiTroEnum.BENH_NHAN.value)
    benh_nhan = MagicMock(id=1, is_blocked_booking=False)
    nguoi_dung = MagicMock(ho_ten="Bệnh nhân B")
    past_date = datetime.now(timezone.utc) - timedelta(hours=2)
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.ACTIVE.value, expiry=past_date)

    mock_db.execute.side_effect = [
        MagicMock(first=MagicMock(return_value=(benh_nhan, nguoi_dung))),
        MagicMock(first=MagicMock(return_value=(doc, doc.nguoi_dung, doc.chuyen_khoa))),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = AppointmentCreateRequest(
        bac_si_id=10,
        ngay_kham=date.today() + timedelta(days=2),
        gio_kham=datetime.strptime("08:00", "%H:%M").time(),
        ly_do_kham="Đau đầu",
    )

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await appointment_service.create_booking(payload, user, mock_db)
    assert exc.value.status_code == 403
    assert doc.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRED.value
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_suspended_doctor_cannot_create_booking():
    """Bác sĩ có giấy phép SUSPENDED tuyệt đối không thể tạo booking (403)"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=5, nguoi_dung_id=5, vai_tro=VaiTroEnum.BENH_NHAN.value)
    benh_nhan = MagicMock(id=1, is_blocked_booking=False)
    nguoi_dung = MagicMock(ho_ten="Bệnh nhân B")
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.SUSPENDED.value)

    mock_db.execute.side_effect = [
        MagicMock(first=MagicMock(return_value=(benh_nhan, nguoi_dung))),
        MagicMock(first=MagicMock(return_value=(doc, doc.nguoi_dung, doc.chuyen_khoa))),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = AppointmentCreateRequest(
        bac_si_id=10,
        ngay_kham=date.today() + timedelta(days=2),
        gio_kham=datetime.strptime("08:00", "%H:%M").time(),
        ly_do_kham="Đau bụng",
    )

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await appointment_service.create_booking(payload, user, mock_db)
    assert exc.value.status_code == 403
    assert "SUSPENDED" in exc.value.detail or "TẠM ĐÌNH CHỈ" in exc.value.detail


@pytest.mark.asyncio
async def test_revoked_doctor_cannot_create_booking():
    """Bác sĩ có giấy phép REVOKED tuyệt đối không thể tạo booking (403)"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=5, nguoi_dung_id=5, vai_tro=VaiTroEnum.BENH_NHAN.value)
    benh_nhan = MagicMock(id=1, is_blocked_booking=False)
    nguoi_dung = MagicMock(ho_ten="Bệnh nhân B")
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.REVOKED.value)

    mock_db.execute.side_effect = [
        MagicMock(first=MagicMock(return_value=(benh_nhan, nguoi_dung))),
        MagicMock(first=MagicMock(return_value=(doc, doc.nguoi_dung, doc.chuyen_khoa))),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = AppointmentCreateRequest(
        bac_si_id=10,
        ngay_kham=date.today() + timedelta(days=2),
        gio_kham=datetime.strptime("08:00", "%H:%M").time(),
        ly_do_kham="Đau ngực",
    )

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await appointment_service.create_booking(payload, user, mock_db)
    assert exc.value.status_code == 403
    assert "REVOKED" in exc.value.detail or "THU HỒI" in exc.value.detail


@pytest.mark.asyncio
async def test_expired_doctor_cannot_start_encounter():
    """Bác sĩ có giấy phép EXPIRED không thể bắt đầu ca khám (start_encounter 403)"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=2, nguoi_dung_id=10, vai_tro=VaiTroEnum.BAC_SI.value)
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.EXPIRED.value)

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = EncounterCreateRequest(lich_kham_id=100)

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await clinical_service.start_encounter(payload, user, mock_db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_suspended_doctor_cannot_start_encounter():
    """Bác sĩ có giấy phép SUSPENDED không thể bắt đầu ca khám (start_encounter 403)"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=2, nguoi_dung_id=10, vai_tro=VaiTroEnum.BAC_SI.value)
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.SUSPENDED.value)

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = EncounterCreateRequest(lich_kham_id=100)

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await clinical_service.start_encounter(payload, user, mock_db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_past_expiry_date_doctor_auto_expires_and_blocks_start_encounter():
    """Bác sĩ có status ACTIVE nhưng expiry trong quá khứ bị auto-expire và chặn start_encounter 403"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=2, nguoi_dung_id=10, vai_tro=VaiTroEnum.BAC_SI.value)
    past_date = datetime.now(timezone.utc) - timedelta(days=1)
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.ACTIVE.value, expiry=past_date)

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = EncounterCreateRequest(lich_kham_id=100)

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await clinical_service.start_encounter(payload, user, mock_db)
    assert exc.value.status_code == 403
    assert doc.trang_thai_giay_phep == TrangThaiGiayPhep.EXPIRED.value


@pytest.mark.asyncio
async def test_suspended_doctor_cannot_create_shift():
    """Bác sĩ có giấy phép SUSPENDED bị chặn khi xếp lịch phân ca (create_shift 403)"""
    mock_db = create_mock_db()
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.SUSPENDED.value)

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
    ]

    payload = ShiftCreateRequest(
        bac_si_id=10,
        ngay_lam_viec=date.today() + timedelta(days=1),
        ca_lam_viec=CaLamViecEnum.CHIEU.value,
    )

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await admin_service.create_shift(payload, mock_db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_inactive_profile_doctor_blocked():
    """Bác sĩ có is_active=False bị chặn bởi check_doctor_license_valid (403)"""
    mock_db = create_mock_db()
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.ACTIVE.value, is_active=False)

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    with pytest.raises(DoctorLicenseInvalidException) as exc:
        await credential_service.check_doctor_license_valid(mock_db, doc.id)
    assert exc.value.status_code == 403
    assert "ngừng hoạt động" in exc.value.detail


# ==============================================================================
# SUITE 2: SCOPE OF PRACTICE INVARIANTS (pham_vi_chuyen_mon)
# ==============================================================================

@pytest.mark.asyncio
async def test_doctor_with_scope_cannot_order_unrelated_service():
    """Bác sĩ chỉ định dịch vụ ngoài pham_vi_chuyen_mon bị chặn ném 409 Conflict"""
    mock_db = create_mock_db()
    user = TaiKhoan(id=2, nguoi_dung_id=10, vai_tro=VaiTroEnum.BAC_SI.value)
    doc = make_doctor(id=10, scope=["KHOA_TIM_MACH"])
    encounter = LuotKham(id=50, bac_si_id=10, is_locked=False)
    svc = make_service(
        id=99,
        code="DV-PT-001",
        name="Phẫu thuật ruột thừa cấp cứu",
        specialty_id=2,
        specialty_code="KHOA_NGOAI",
        specialty_name="Khoa Ngoại tiêu hóa",
    )

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
async def test_doctor_with_case_insensitive_and_whitespace_scope_match():
    """Kiểm tra so khớp phạm vi không phân biệt hoa thường và khoảng trắng dư thừa"""
    mock_db = create_mock_db()
    doc = make_doctor(scope=["  khoa_noi  ", "noi_tim_mach"])
    svc = make_service(specialty_code="KHOA_NOI")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    res = await credential_service.check_doctor_scope_of_practice(mock_db, doc.id, svc.id)
    assert res is True


@pytest.mark.asyncio
async def test_doctor_scope_matching_by_service_code_directly():
    """Bác sĩ được cấp phép cụ thể mã dịch vụ 'DV-XN-001' được phép chỉ định dịch vụ đó"""
    mock_db = create_mock_db()
    doc = make_doctor(scope=["DV-XN-001"])
    svc = make_service(code="DV-XN-001", specialty_code="KHOA_XET_NGHIEM")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    res = await credential_service.check_doctor_scope_of_practice(mock_db, doc.id, svc.id)
    assert res is True


@pytest.mark.asyncio
async def test_doctor_scope_matching_by_specialty_name():
    """Bác sĩ có phạm vi theo tên tiếng Việt có dấu được so khớp chuẩn xác"""
    mock_db = create_mock_db()
    doc = make_doctor(scope=["KHOA NỘI TỔNG QUÁT"])
    svc = make_service(specialty_code="KHOA_NOI", specialty_name="Khoa Nội tổng quát")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    res = await credential_service.check_doctor_scope_of_practice(mock_db, doc.id, svc.id)
    assert res is True


@pytest.mark.asyncio
async def test_doctor_scope_blocks_when_service_has_no_specialty_and_different_code():
    """Dịch vụ không gắn chuyên khoa và mã khác phạm vi bị chặn 409"""
    mock_db = create_mock_db()
    doc = make_doctor(scope=["KHOA_NOI"])
    svc = make_service(code="DV-UNASSIGNED-99", specialty_code=None)

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    with pytest.raises(ScopeMismatchException) as exc:
        await credential_service.check_doctor_scope_of_practice(mock_db, doc.id, svc.id)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_empty_scope_permits_all_services_for_backward_compat():
    """Bác sĩ có pham_vi_chuyen_mon rỗng (mặc định ban đầu) được phép chỉ định (100% backward compat)"""
    mock_db = create_mock_db()
    doc = make_doctor(scope=[])
    svc = make_service(code="DV-ANY-001", specialty_code="BAT_KY")

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=doc)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=svc)),
    ]

    res = await credential_service.check_doctor_scope_of_practice(mock_db, doc.id, svc.id)
    assert res is True


# ==============================================================================
# SUITE 3: IMMUTABILITY & AUDIT TRAIL INVARIANTS (LichSuGiayPhepBacSi)
# ==============================================================================

@pytest.mark.asyncio
async def test_update_license_status_persists_audit_entry_with_mandatory_reason():
    """Chuyển trạng thái tạo bản ghi kiểm toán với đầy đủ thông tin bắt buộc và đồng bộ is_active=False"""
    mock_db = create_mock_db()
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.ACTIVE.value, is_active=True)

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi=TrangThaiGiayPhep.SUSPENDED.value,
        ly_do="Đình chỉ công tác chuyên môn theo công văn số 123/SYT",
        ghi_chu="Chờ quyết định thanh tra tiếp theo",
    )

    resp = await credential_service.update_doctor_license_status(
        mock_db, doctor_id=10, payload=payload, user_id=999
    )

    assert resp.trang_thai_giay_phep == "SUSPENDED"
    assert doc.is_active is False
    assert mock_db.add.called
    added_obj = mock_db.add.call_args[0][0]
    assert isinstance(added_obj, LichSuGiayPhepBacSi)
    assert added_obj.bac_si_id == 10
    assert added_obj.trang_thai_cu == "ACTIVE"
    assert added_obj.trang_thai_moi == "SUSPENDED"
    assert added_obj.nguoi_thuc_hien_id == 999
    assert "123/SYT" in added_obj.ly_do
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_license_status_to_active_restores_is_active():
    """Khi khôi phục trạng thái giấy phép từ SUSPENDED về ACTIVE, cờ is_active được bật lại True"""
    mock_db = create_mock_db()
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.SUSPENDED.value, is_active=False)

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    payload = DoctorLicenseStatusUpdateRequest(
        trang_thai_moi=TrangThaiGiayPhep.ACTIVE.value,
        ly_do="Hết thời hạn đình chỉ, hoàn thành kiểm tra đạt yêu cầu",
    )

    resp = await credential_service.update_doctor_license_status(
        mock_db, doctor_id=10, payload=payload, user_id=1
    )

    assert resp.trang_thai_giay_phep == "ACTIVE"
    assert doc.is_active is True
    assert mock_db.add.called
    added_obj = mock_db.add.call_args[0][0]
    assert isinstance(added_obj, LichSuGiayPhepBacSi)
    assert added_obj.trang_thai_cu == "SUSPENDED"
    assert added_obj.trang_thai_moi == "ACTIVE"
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_doctor_license_put_logs_audit_on_status_change():
    """Endpoint PUT update_doctor_license khi thay đổi trang_thai_giay_phep cũng tự động ghi vết kiểm toán"""
    mock_db = create_mock_db()
    doc = make_doctor(id=10, status=TrangThaiGiayPhep.ACTIVE.value)

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = doc
    mock_db.execute.return_value = mock_res

    payload = DoctorLicenseUpdateRequest(
        trang_thai_giay_phep=TrangThaiGiayPhep.EXPIRED.value,
        pham_vi_chuyen_mon=["KHOA_NOI"],
    )

    await credential_service.update_doctor_license(
        mock_db, doctor_id=10, payload=payload, user_id=1
    )

    assert doc.trang_thai_giay_phep == "EXPIRED"
    assert mock_db.add.called
    added_obj = mock_db.add.call_args[0][0]
    assert isinstance(added_obj, LichSuGiayPhepBacSi)
    assert added_obj.trang_thai_cu == "ACTIVE"
    assert added_obj.trang_thai_moi == "EXPIRED"
    mock_db.commit.assert_awaited()


def test_audit_history_immutability_no_modification_endpoints():
    """Xác minh router không cung cấp bất kỳ API nào để sửa (PUT/PATCH) hoặc xóa (DELETE) lịch sử kiểm toán"""
    routes = [r for r in app.routes if hasattr(r, "path")]
    history_routes = [r for r in routes if "/history" in r.path]

    for route in history_routes:
        assert "DELETE" not in route.methods, f"Audit route must not support DELETE: {route.path}"
        assert "PUT" not in route.methods, f"Audit route must not support PUT: {route.path}"
        assert "PATCH" not in route.methods, f"Audit route must not support PATCH: {route.path}"
