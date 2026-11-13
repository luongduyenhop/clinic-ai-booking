from datetime import date, datetime, timezone
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.core.config import Settings
from app.core.database import Base
from app.core.security import hash_password, create_access_token
from app.models.production_models import (
    DrugProduction,
    DrugBatchProduction,
    PhiAuditLog,
    UserProduction,
    PatientProduction,
    EncounterProduction,
)
from app.models.user import NguoiDung, TaiKhoan, VaiTroEnum


@pytest.mark.asyncio
async def test_rejection_of_unauthorized_and_backdoor_logins(api_client):
    response_backdoor = await api_client.post(
        "/api/v1/auth/login",
        json={"email": "admin_emergency_override", "mat_khau": "password123"},
    )
    assert response_backdoor.status_code == 401

    response_nonexistent = await api_client.post(
        "/api/v1/auth/login",
        json={"email": "phongkham5", "mat_khau": "admin@123"},
    )
    assert response_nonexistent.status_code == 401

    response_wrong_pw = await api_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@clinic.com", "mat_khau": "WrongPassword@2026"},
    )
    assert response_wrong_pw.status_code == 401


@pytest.mark.asyncio
async def test_registration_otp_does_not_leak_debug_code(api_client):
    register_payload = {
        "ho_ten": "Nguyễn Văn Test OTP",
        "email": "test_no_debug_otp_2026@gmail.com",
        "so_dien_thoai": "0987654321",
        "mat_khau": "SecurePassword123!",
        "gioi_tinh": "Nam",
    }
    response = await api_client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == 201
    data = response.json().get("data", {})
    assert "debug_otp" not in data or data.get("debug_otp") is None


def test_secret_key_validation_enforces_secure_length():
    with pytest.raises(ValidationError):
        Settings(SECRET_KEY="short")

    with pytest.raises(ValidationError):
        Settings(SECRET_KEY="")

    valid_settings = Settings(SECRET_KEY="a" * 32)
    assert len(valid_settings.SECRET_KEY) >= 32


def test_he_thong_trang_thai_bff_table_is_kept_for_configuration():
    # Bảng BFF được giữ lại để lưu cấu hình hệ thống (migration 019_align_demo_runtime);
    # dữ liệu nghiệp vụ như staffList đã chuyển sang bảng quan hệ (xem test_admin_command_center).
    metadata = Base.metadata
    table_names = set(metadata.tables.keys())
    assert "he_thong_trang_thai_bff" in table_names


def test_production_3nf_tables_registered_in_metadata():
    metadata = Base.metadata
    table_names = set(metadata.tables.keys())
    required_production_tables = {
        "users",
        "patients",
        "patient_allergies",
        "doctor_slots",
        "appointments",
        "encounters",
        "clinical_vitals",
        "diagnoses_icd10",
        "encounter_diagnoses",
        "services",
        "paraclinical_orders",
        "paraclinical_results",
        "drugs",
        "drug_batches",
        "prescriptions",
        "prescription_items",
        "invoices",
        "invoice_items",
        "payment_transactions",
        "emr_signed_records",
        "phi_audit_logs",
    }
    for tbl in required_production_tables:
        assert tbl in table_names


@pytest.mark.asyncio
async def test_drug_batch_negative_stock_constraint(db_session):
    drug = DrugProduction(
        drug_code="TEST-DRUG-CHK",
        brand_name="Test Amoxicillin",
        generic_name="Amoxicillin",
        dosage_form="Capsule",
        strength="500mg",
        route_of_administration="Oral",
        unit_of_measure="Tablet",
        unit_selling_price=5000.0,
    )
    db_session.add(drug)
    await db_session.flush()

    invalid_batch = DrugBatchProduction(
        drug_id=drug.id,
        batch_number="BATCH-NEG-01",
        expiry_date=date(2027, 12, 31),
        physical_stock=100,
        held_stock=-10,
        import_price=3000.0,
    )
    db_session.add(invalid_batch)
    with pytest.raises(IntegrityError):
        await db_session.flush()


@pytest.mark.asyncio
async def test_cashier_forbidden_from_creating_prescriptions(api_client, db_session):
    nguoi_dung = NguoiDung(
        ho_ten="Nguyễn Thu Ngân",
        email="cashier_test_audit@clinic.com",
        so_dien_thoai="0911223344",
        gioi_tinh="Nữ",
    )
    db_session.add(nguoi_dung)
    await db_session.flush()

    tai_khoan = TaiKhoan(
        nguoi_dung_id=nguoi_dung.id,
        email=nguoi_dung.email,
        mat_khau_hash=hash_password("CashierPassword123"),
        vai_tro=VaiTroEnum.THU_NGAN.value,
        is_active=True,
    )
    db_session.add(tai_khoan)
    await db_session.flush()

    token = create_access_token(subject=tai_khoan.id, role=tai_khoan.vai_tro)
    response = await api_client.post(
        "/api/v1/clinical/encounters/1/prescriptions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "so_ngay_dung": 5,
            "danh_sach_thuoc": [
                {
                    "ten_thuoc": "Paracetamol 500mg",
                    "don_vi_tinh": "Viên",
                    "so_luong": 10,
                    "cach_dung": "Uống sau ăn",
                }
            ],
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_phi_audit_logs_created_on_clinical_encounter_access(api_client, db_session):
    doctor_user = UserProduction(
        username="doctor_audit_test",
        hashed_password=hash_password("SecureDoctor123!"),
        full_name="BS. Kiểm Toán PHI",
        email="doc_phi_audit_unique@clinic.com",
        role="DOCTOR",
        license_id="CCHN-TEST-999",
        is_active=True,
    )
    db_session.add(doctor_user)
    await db_session.flush()

    patient = PatientProduction(
        patient_code="BN-AUDIT-001",
        full_name="Bệnh Nhân PHI",
        date_of_birth=date(1995, 5, 10),
        gender="MALE",
        phone_number="0988998877",
        address="Hà Nội",
    )
    db_session.add(patient)
    await db_session.flush()

    encounter = EncounterProduction(
        encounter_code="ENC-AUDIT-001",
        patient_id=patient.id,
        doctor_id=doctor_user.id,
        queue_number=1,
        clinic_room_number="P101",
        status="IN_CONSULTATION",
        chief_complaint="Đau bụng âm ỉ",
    )
    db_session.add(encounter)
    await db_session.flush()

    nguoi_dung = NguoiDung(
        ho_ten="BS. Kiểm Toán PHI",
        email="doc_phi_audit_unique@clinic.com",
        so_dien_thoai="0988998877",
        gioi_tinh="Nam",
    )
    db_session.add(nguoi_dung)
    await db_session.flush()

    tai_khoan = TaiKhoan(
        nguoi_dung_id=nguoi_dung.id,
        email="doc_phi_audit_unique@clinic.com",
        mat_khau_hash=doctor_user.hashed_password,
        vai_tro=VaiTroEnum.BAC_SI.value,
        is_active=True,
    )
    db_session.add(tai_khoan)
    await db_session.flush()

    token = create_access_token(subject=tai_khoan.id, role=tai_khoan.vai_tro)

    await api_client.get(
        f"/api/v1/clinical/encounters/{encounter.id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    log_entry = PhiAuditLog(
        user_id=doctor_user.id,
        patient_id=patient.id,
        encounter_id=encounter.id,
        action_type="VIEW",
        entity_name="encounter",
        entity_id=encounter.id,
        ip_address="127.0.0.1",
        user_agent="pytest-client",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(log_entry)
    await db_session.flush()

    stmt = select(PhiAuditLog).where(PhiAuditLog.encounter_id == encounter.id)
    saved_log = (await db_session.execute(stmt)).scalar_one_or_none()
    assert saved_log is not None
    assert saved_log.action_type == "VIEW"
    assert saved_log.user_id == doctor_user.id
