from datetime import date, datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.models.user import TaiKhoan, VaiTroEnum, NguoiDung, BacSi
from app.models.production_models import (
    PatientProduction,
    PatientAllergyProduction,
    EncounterProduction,
    EncounterDiagnosisProduction,
    DiagnosisICD10Production,
    ParaclinicalOrderProduction,
    ServiceProduction,
)
from app.schemas.reception import CccdQrParseRequest, ReceptionPatientCreateRequest, EncounterCreateRequest
from app.schemas.clinical import VitalsCreateRequest, AllergyCheckRequest
from app.schemas.subclinical import ParaclinicalResultSubmitRequest, ParaclinicalResultInput
from app.services.reception_service import reception_service
from app.services.clinical_service import clinical_service
from app.services.subclinical_service import subclinical_service
from app.services.national_gateway_service import national_gateway_service
from app.core.exceptions import ConflictException, ForbiddenException, UnprocessableEntityException


def test_vietnam_cccd_qr_parser_valid_7_fields():
    qr_payload = "001099012345|123456789|NGUYEN VAN AN|15081995|Nam|So 10 Pho Hue, Hang Bai, Hoan Kiem, Ha Noi|15082021"
    parsed = reception_service.parse_vietnam_cccd_qr(qr_payload)
    assert parsed.cccd_number == "001099012345"
    assert parsed.cmnd_number == "123456789"
    assert parsed.full_name == "NGUYEN VAN AN"
    assert parsed.date_of_birth == date(1995, 8, 15)
    assert parsed.gender == "MALE"
    assert "Pho Hue" in parsed.address
    assert parsed.issue_date == date(2021, 8, 15)


@pytest.mark.asyncio
async def test_patient_registration_prevents_duplicate_cccd(db_session):
    payload1 = ReceptionPatientCreateRequest(
        ho_ten="Tran Thi Mai",
        so_dien_thoai="0912345671",
        ngay_sinh=date(1992, 5, 20),
        gioi_tinh="Nữ",
        dia_chi="Da Nang",
        cccd_so="048192001122",
    )
    p1 = await reception_service.create_patient(payload1, db_session)
    assert p1.ho_ten == "Tran Thi Mai"
    assert p1.cccd_so == "048192001122"

    payload2 = ReceptionPatientCreateRequest(
        ho_ten="Tran Thi Mai Duplicate",
        so_dien_thoai="0988776655",
        ngay_sinh=date(1992, 5, 20),
        gioi_tinh="Nữ",
        dia_chi="Da Nang",
        cccd_so="048192001122",
    )
    with pytest.raises(ConflictException) as exc_info:
        await reception_service.create_patient(payload2, db_session)
    assert "CCCD" in str(exc_info.value)


@pytest.mark.asyncio
async def test_encounter_creation_generates_sequential_queue_number_today(db_session):
    enc_req1 = EncounterCreateRequest(
        patient_id=1,
        doctor_id=1,
        clinic_room_number="PK-NOI-101",
        chief_complaint="Dau dau chong mat",
    )
    res1 = await reception_service.create_encounter(enc_req1, db_session)
    assert res1.queue_number >= 1
    assert res1.status == "WAITING_FOR_EXAMINATION"

    enc_req2 = EncounterCreateRequest(
        patient_id=1,
        doctor_id=1,
        clinic_room_number="PK-NOI-101",
        chief_complaint="Sot cao kem ho",
    )
    res2 = await reception_service.create_encounter(enc_req2, db_session)
    assert res2.queue_number == res1.queue_number + 1


@pytest.mark.asyncio
async def test_icd10_unaccented_vietnamese_search(db_session):
    results = await clinical_service.search_icd10("viem hong", db_session)
    assert len(results) > 0
    codes = [r.code for r in results]
    assert "J02.9" in codes

    results_htn = await clinical_service.search_icd10("tang huyet ap", db_session)
    assert any(r.code == "I10" for r in results_htn)


@pytest.mark.asyncio
async def test_vitals_recording_bmi_and_critical_hypertension_flag(db_session):
    test_user = TaiKhoan(
        id=99,
        nguoi_dung_id=1,
        email="dr_test@clinic.vn",
        mat_khau_hash="hash",
        vai_tro=VaiTroEnum.BAC_SI.value,
        is_active=True,
    )

    enc = EncounterProduction(
        encounter_code="ENC-TEST-VITALS",
        patient_id=1,
        doctor_id=1,
        queue_number=99,
        clinic_room_number="PK-102",
        status="IN_CONSULTATION",
        chief_complaint="Tham kham dinh ky",
    )
    db_session.add(enc)
    await db_session.commit()
    await db_session.refresh(enc)

    vitals_req = VitalsCreateRequest(
        systolic_bp=195.0,
        diastolic_bp=125.0,
        heart_rate=88.0,
        body_temperature=37.0,
        respiratory_rate=18.0,
        spo2_percentage=98.0,
        height_cm=170.0,
        weight_kg=68.0,
    )
    vital_res = await clinical_service.record_encounter_vitals(enc.id, vitals_req, test_user, db_session)
    assert vital_res.bmi == 23.53
    assert vital_res.is_critical is True
    assert any("tăng huyết áp" in w.lower() for w in vital_res.warnings)


@pytest.mark.asyncio
async def test_drug_allergy_conflict_guard(db_session):
    patient = PatientProduction(
        patient_code="BN-ALLERGY-TEST",
        full_name="Le Van Di Ung",
        date_of_birth=date(1985, 3, 10),
        gender="MALE",
        phone_number="0905111222",
        address="Hai Phong",
    )
    db_session.add(patient)
    await db_session.commit()
    await db_session.refresh(patient)

    allergy = PatientAllergyProduction(
        patient_id=patient.id,
        active_ingredient_name="Amoxicillin",
        allergy_type="DRUG",
        severity="SEVERE",
        reaction_description="Phu quincke va kho tho",
    )
    db_session.add(allergy)
    await db_session.commit()

    check_res = await clinical_service.check_drug_allergy_conflict(patient.id, "Amoxicilin 500mg", db_session)
    assert check_res.has_conflict is True
    assert check_res.is_blocked is True
    assert "Amoxicillin" in check_res.details

    safe_check = await clinical_service.check_drug_allergy_conflict(patient.id, "Paracetamol", db_session)
    assert safe_check.has_conflict is False


@pytest.mark.asyncio
async def test_emr_seal_and_sign_immutability_guard(db_session):
    doctor_user = TaiKhoan(
        id=77,
        nguoi_dung_id=1,
        email="dr_seal@clinic.vn",
        mat_khau_hash="hash",
        vai_tro=VaiTroEnum.BAC_SI.value,
        is_active=True,
    )

    enc = EncounterProduction(
        encounter_code="ENC-SEAL-TEST",
        patient_id=1,
        doctor_id=doctor_user.id,
        queue_number=5,
        clinic_room_number="PK-105",
        status="IN_CONSULTATION",
        chief_complaint="Kham tong quat",
    )
    db_session.add(enc)
    await db_session.commit()
    await db_session.refresh(enc)

    diag = EncounterDiagnosisProduction(
        encounter_id=enc.id,
        icd10_code="I10",
        is_primary=True,
        clinical_notes="Tang huyet ap giai doan 1",
    )
    db_session.add(diag)
    await db_session.commit()

    seal_res = await clinical_service.seal_and_sign_encounter(enc.id, doctor_user, db_session)
    assert seal_res.status == "COMPLETED_LOCKED"
    assert seal_res.is_locked is True
    assert len(seal_res.record_hash) == 64

    vitals_req = VitalsCreateRequest(
        systolic_bp=120.0,
        diastolic_bp=80.0,
        heart_rate=75.0,
        body_temperature=36.8,
    )
    with pytest.raises(ForbiddenException) as exc_info:
        await clinical_service.record_encounter_vitals(enc.id, vitals_req, doctor_user, db_session)
    assert "Invariant EMR-1" in str(exc_info.value)


@pytest.mark.asyncio
async def test_paraclinical_6_step_state_machine(db_session):
    lab_user = TaiKhoan(
        id=55,
        nguoi_dung_id=1,
        email="tech_lab@clinic.vn",
        mat_khau_hash="hash",
        vai_tro=VaiTroEnum.KY_THUAT_VIEN.value,
        is_active=True,
    )

    service = ServiceProduction(
        service_code="LAB-ELECTROLYTE-01",
        service_name="Dien giai do mau (Na+, K+, Cl-)",
        category="LABORATORY",
        unit_price=120000.0,
        department="Khoa Xet Nghiem",
    )
    db_session.add(service)
    await db_session.commit()
    await db_session.refresh(service)

    order = ParaclinicalOrderProduction(
        order_code="CLS-ORD-001",
        encounter_id=1,
        service_id=service.id,
        ordered_by=1,
        status="PAID",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    barcode_res = await subclinical_service.generate_specimen_barcode(order.id, lab_user, db_session)
    assert barcode_res.status == "SAMPLE_COLLECTED"
    assert "BC-LAB-" in barcode_res.barcode_id

    submit_payload = ParaclinicalResultSubmitRequest(
        results=[
            ParaclinicalResultInput(
                parameter_code="K+",
                parameter_name="Kali mau",
                measured_value="7.2",
                numeric_value=7.2,
                measurement_unit="mmol/L",
                reference_low=3.5,
                reference_high=5.0,
                conclusion="Tang kali mau nguy hiem",
            )
        ],
        technician_notes="Mau khong tieu huyet",
    )
    result_res = await subclinical_service.submit_paraclinical_results(order.id, submit_payload, lab_user, db_session)
    assert result_res.status == "RESULT_ENTERED"
    assert result_res.has_panic_value is True

    verify_res = await subclinical_service.verify_paraclinical_order(order.id, lab_user, db_session)
    assert verify_res.status == "COMPLETED_VERIFIED"
    assert verify_res.verified_by == lab_user.id


def test_national_prescription_code_format_14_characters():
    code = national_gateway_service.generate_national_prescription_code("01", "01999", 1048)
    assert len(code) == 14
    assert code == "01019990001048"

    url = national_gateway_service.generate_national_qr_lookup_url(code)
    assert url == "https://donthuocquocgia.vn/tra-cuu?ma_don=01019990001048"
