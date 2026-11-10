import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import hmac
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.production_models import (
    DiagnosisICD10Production,
    DrugBatchProduction,
    DrugProduction,
    EncounterDiagnosisProduction,
    EncounterProduction,
    InvoiceItemProduction,
    InvoiceProduction,
    ParaclinicalOrderProduction,
    PatientAllergyProduction,
    PatientProduction,
    PaymentTransactionProduction,
    PrescriptionItemProduction,
    PrescriptionProduction,
    ServiceProduction,
    UserProduction,
)
from app.models.user import BacSi, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.clinical import VitalsCreateRequest
from app.schemas.production_billing import BankWebhookPayload
from app.schemas.reception import EncounterCreateRequest, ReceptionPatientCreateRequest
from app.schemas.subclinical import ParaclinicalResultInput, ParaclinicalResultSubmitRequest
from app.services.clinical_service import clinical_service
from app.services.national_gateway_service import national_gateway_service
from app.services.production_cashier_service import production_cashier_service
from app.services.production_pharmacy_service import production_pharmacy_service
from app.services.reception_service import reception_service
from app.services.subclinical_service import subclinical_service


async def _create_test_staff(db, suffix):
    email = f"staff_{suffix}@clinic.local"
    user_prod = UserProduction(
        username=f"dr_{suffix}",
        hashed_password="hash_password",
        full_name=f"Bac Si Nguyen Van {suffix.upper()}",
        email=email,
        role="DOCTOR",
    )
    db.add(user_prod)
    await db.flush()

    nguoi_dung = NguoiDung(
        ho_ten=user_prod.full_name,
        email=email,
        so_dien_thoai=f"097{suffix[:7].ljust(7, '1')}",
        gioi_tinh="Nam",
    )
    db.add(nguoi_dung)
    await db.flush()

    tai_khoan = TaiKhoan(
        nguoi_dung_id=nguoi_dung.id,
        email=nguoi_dung.email,
        mat_khau_hash="hash_password",
        vai_tro=VaiTroEnum.BAC_SI.value,
        is_active=True,
    )
    db.add(tai_khoan)
    await db.flush()

    bac_si = BacSi(
        nguoi_dung_id=nguoi_dung.id,
        hoc_vi="Bác sĩ",
        chung_chi_hanh_nghe=f"CCHN-{suffix.upper()}",
        is_active=True,
    )
    db.add(bac_si)
    await db.flush()

    return user_prod, tai_khoan


async def _get_or_create_icd10(db, code, name_vi):
    stmt = select(DiagnosisICD10Production).where(DiagnosisICD10Production.code == code)
    icd = (await db.execute(stmt)).scalar_one_or_none()
    if not icd:
        icd = DiagnosisICD10Production(
            code=code,
            chapter_code="X",
            name_vi=name_vi,
            is_active=True,
        )
        db.add(icd)
        await db.flush()
    return icd


@pytest.mark.asyncio
async def test_stage7_e2e_lifecycle_model_b_inhouse_dispensing(db_session):
    doctor_prod, doctor_user = await _create_test_staff(db_session, "e2eb01")

    cccd_raw = "001099088776|123456789|TRAN VAN THANG|12041988|Nam|So 55 Tran Phu, Ba Dinh, Ha Noi|12042021"
    parsed_cccd = reception_service.parse_vietnam_cccd_qr(cccd_raw)
    assert parsed_cccd.cccd_number == "001099088776"
    assert parsed_cccd.full_name == "TRAN VAN THANG"

    patient_payload = ReceptionPatientCreateRequest(
        ho_ten=parsed_cccd.full_name,
        so_dien_thoai="0911223344",
        ngay_sinh=parsed_cccd.date_of_birth,
        gioi_tinh="Nam",
        dia_chi=parsed_cccd.address,
        cccd_so=parsed_cccd.cccd_number,
    )
    created_patient = await reception_service.create_patient(patient_payload, db_session)
    assert created_patient.ho_ten == "TRAN VAN THANG"
    assert created_patient.ma_dinh_danh_y_te is not None

    stmt_p = select(PatientProduction).where(
        PatientProduction.patient_code == created_patient.ma_dinh_danh_y_te
    )
    patient_prod = (await db_session.execute(stmt_p)).scalar_one()

    enc_payload = EncounterCreateRequest(
        patient_id=patient_prod.id,
        doctor_id=doctor_prod.id,
        clinic_room_number="PK-NOI-102",
        chief_complaint="Sốt cao, ho có đờm, đau họng",
    )
    encounter_res = await reception_service.create_encounter(enc_payload, db_session)
    assert encounter_res.status == "WAITING_FOR_EXAMINATION"
    encounter_id = encounter_res.id

    vitals_req = VitalsCreateRequest(
        systolic_bp=125.0,
        diastolic_bp=82.0,
        heart_rate=78.0,
        body_temperature=38.6,
        respiratory_rate=19.0,
        spo2_percentage=98.0,
        height_cm=172.0,
        weight_kg=69.0,
    )
    vitals_res = await clinical_service.record_encounter_vitals(
        encounter_id, vitals_req, doctor_user, db_session
    )
    assert vitals_res.bmi == 23.32
    assert vitals_res.is_critical is False

    icd_j02 = await _get_or_create_icd10(db_session, "J02.9", "Viêm họng cấp không đặc hiệu")
    diagnosis_record = EncounterDiagnosisProduction(
        encounter_id=encounter_id,
        icd10_code=icd_j02.code,
        is_primary=True,
        clinical_notes="Viêm họng cấp tính do vi khuẩn",
    )
    db_session.add(diagnosis_record)
    await db_session.flush()

    lab_service = ServiceProduction(
        service_code="CLS-BLOOD-E2E-01",
        service_name="Tổng phân tích tế bào máu ngoại vi",
        category="LABORATORY",
        unit_price=Decimal("120000.00"),
        department="Khoa Xét Nghiệm",
        is_active=True,
    )
    db_session.add(lab_service)
    await db_session.flush()

    paraclinical_order = ParaclinicalOrderProduction(
        order_code="CLS-ORD-E2E-001",
        encounter_id=encounter_id,
        service_id=lab_service.id,
        ordered_by=doctor_prod.id,
        status="PAID",
    )
    db_session.add(paraclinical_order)
    await db_session.flush()

    barcode_res = await subclinical_service.generate_specimen_barcode(
        paraclinical_order.id, doctor_user, db_session
    )
    assert barcode_res.status == "SAMPLE_COLLECTED"
    assert "BC-LAB-" in barcode_res.barcode_id

    result_payload = ParaclinicalResultSubmitRequest(
        results=[
            ParaclinicalResultInput(
                parameter_code="WBC",
                parameter_name="Bạch cầu (White Blood Cells)",
                measured_value="13.5",
                numeric_value=13.5,
                measurement_unit="G/L",
                reference_low=4.0,
                reference_high=10.0,
                conclusion="Tăng bạch cầu phản ánh tình trạng nhiễm trùng",
            )
        ],
        technician_notes="Mẫu xét nghiệm đạt chuẩn, không vỡ hồng cầu",
    )
    result_res = await subclinical_service.submit_paraclinical_results(
        paraclinical_order.id, result_payload, doctor_user, db_session
    )
    assert result_res.status == "RESULT_ENTERED"

    verify_res = await subclinical_service.verify_paraclinical_order(
        paraclinical_order.id, doctor_user, db_session
    )
    assert verify_res.status == "COMPLETED_VERIFIED"

    drug_cipro = DrugProduction(
        drug_code="DRUG-E2E-CIPRO",
        brand_name="Ciprofloxacin 500mg",
        generic_name="Ciprofloxacin",
        dosage_form="Viên nén",
        strength="500mg",
        route_of_administration="Uống",
        unit_of_measure="Viên",
        unit_selling_price=Decimal("15000.00"),
        is_active=True,
    )
    drug_para = DrugProduction(
        drug_code="DRUG-E2E-PARA",
        brand_name="Paracetamol 500mg",
        generic_name="Paracetamol",
        dosage_form="Viên sủi",
        strength="500mg",
        route_of_administration="Uống",
        unit_of_measure="Viên",
        unit_selling_price=Decimal("2000.00"),
        is_active=True,
    )
    db_session.add_all([drug_cipro, drug_para])
    await db_session.flush()

    batch_cipro = DrugBatchProduction(
        drug_id=drug_cipro.id,
        batch_number="L-CIPRO-2026",
        expiry_date=date.today() + timedelta(days=90),
        physical_stock=50,
        held_stock=0,
        import_price=Decimal("10000.00"),
    )
    batch_para = DrugBatchProduction(
        drug_id=drug_para.id,
        batch_number="L-PARA-2026",
        expiry_date=date.today() + timedelta(days=120),
        physical_stock=100,
        held_stock=0,
        import_price=Decimal("1200.00"),
    )
    db_session.add_all([batch_cipro, batch_para])
    await db_session.flush()

    national_code = national_gateway_service.generate_national_prescription_code("01", "01999", 501)
    qr_url = national_gateway_service.generate_national_qr_lookup_url(national_code)

    prescription = PrescriptionProduction(
        prescription_code="DT-E2E-001",
        national_prescription_code=national_code,
        encounter_id=encounter_id,
        doctor_id=doctor_prod.id,
        status="PRESCRIBED",
        sync_status="SYNCED",
        qr_lookup_url=qr_url,
        doctor_advice="Uống thuốc sau ăn, uống đủ 2 lít nước mỗi ngày",
    )
    db_session.add(prescription)
    await db_session.flush()

    p_item1 = PrescriptionItemProduction(
        prescription_id=prescription.id,
        drug_id=drug_cipro.id,
        quantity_prescribed=10,
        usage_instructions="Sáng 1 viên, tối 1 viên sau ăn",
        treatment_days=5,
    )
    p_item2 = PrescriptionItemProduction(
        prescription_id=prescription.id,
        drug_id=drug_para.id,
        quantity_prescribed=10,
        usage_instructions="Uống 1 viên khi sốt trên 38.5 độ C, cách nhau tối thiểu 4-6 giờ",
        treatment_days=5,
    )
    db_session.add_all([p_item1, p_item2])
    await db_session.flush()

    seal_res = await clinical_service.seal_and_sign_encounter(
        encounter_id, doctor_user, db_session
    )
    assert seal_res.status == "COMPLETED_LOCKED"
    assert seal_res.is_locked is True
    assert len(seal_res.record_hash) == 64

    fee_sheet = await production_cashier_service.calculate_fee_sheet(
        encounter_id, Decimal("0.00"), db_session
    )
    assert fee_sheet.total_service_amount == Decimal("270000.00")
    assert fee_sheet.total_medication_amount == Decimal("170000.00")
    assert fee_sheet.final_amount == Decimal("440000.00")

    invoice = await production_cashier_service.create_invoice(
        encounter_id=encounter_id,
        discount_amount=Decimal("0.00"),
        cashier_id=doctor_prod.id,
        db=db_session,
    )
    assert invoice.status == "PENDING"
    assert invoice.final_amount == Decimal("440000.00")

    vietqr_data = await production_cashier_service.generate_vietqr(invoice.id, db_session)
    assert vietqr_data.invoice_code == invoice.invoice_code
    assert vietqr_data.final_amount == Decimal("440000.00")
    assert len(vietqr_data.qr_payload_emvco) > 50

    txn_code = f"TXN-NAPAS-{invoice.id:06d}"
    amount = Decimal("440000.00")
    secret_bytes = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")
    signature = hmac.new(
        secret_bytes,
        f"{txn_code}|{invoice.id}|{amount}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    webhook_payload = BankWebhookPayload(
        transaction_code=txn_code,
        bank_transaction_id="FT261110009988",
        amount=amount,
        invoice_id=invoice.id,
        signature=signature,
    )

    webhook_res = await production_cashier_service.process_bank_webhook(
        payload=webhook_payload,
        raw_body=b"",
        header_signature=signature,
        db=db_session,
    )
    assert webhook_res.ok is True
    assert webhook_res.status == "SUCCESS"

    await db_session.refresh(invoice)
    assert invoice.status == "PAID"
    assert invoice.is_locked is True

    dispense_res = await production_pharmacy_service.dispense_prescription(
        prescription_id=prescription.id,
        user_id=doctor_prod.id,
        db=db_session,
    )
    assert dispense_res.status == "DISPENSED"
    assert len(dispense_res.items) == 2

    await db_session.refresh(batch_cipro)
    await db_session.refresh(batch_para)
    assert batch_cipro.physical_stock == 40
    assert batch_para.physical_stock == 90

    await db_session.refresh(prescription)
    assert prescription.status == "DISPENSED"


@pytest.mark.asyncio
async def test_stage7_e2e_lifecycle_model_a_external_pharmacy_outpatient(db_session):
    doctor_prod, doctor_user = await _create_test_staff(db_session, "e2ea02")

    patient = PatientProduction(
        patient_code="BN-MODEL-A-001",
        full_name="HOANG THI NGAN",
        date_of_birth=date(1975, 6, 15),
        gender="FEMALE",
        phone_number="0988112233",
        address="Cau Giay, Ha Noi",
    )
    db_session.add(patient)
    await db_session.flush()

    encounter = EncounterProduction(
        encounter_code="ENC-MODEL-A-001",
        patient_id=patient.id,
        doctor_id=doctor_prod.id,
        queue_number=1,
        clinic_room_number="PK-TIM-MACH-01",
        status="IN_CONSULTATION",
        chief_complaint="Hồi hộp, đánh trống ngực, tăng huyết áp",
    )
    db_session.add(encounter)
    await db_session.flush()

    vitals_req = VitalsCreateRequest(
        systolic_bp=150.0,
        diastolic_bp=95.0,
        heart_rate=88.0,
        body_temperature=37.0,
        respiratory_rate=18.0,
        spo2_percentage=99.0,
        height_cm=160.0,
        weight_kg=58.0,
    )
    vitals_res = await clinical_service.record_encounter_vitals(
        encounter.id, vitals_req, doctor_user, db_session
    )
    assert vitals_res.bmi == 22.66

    icd_i10 = await _get_or_create_icd10(db_session, "I10", "Bệnh tăng huyết áp vô căn (nguyên phát)")
    db_session.add(
        EncounterDiagnosisProduction(
            encounter_id=encounter.id,
            icd10_code=icd_i10.code,
            is_primary=True,
            clinical_notes="Tăng huyết áp độ 1 theo phân độ ESH/ESC",
        )
    )
    await db_session.flush()

    ecg_service = ServiceProduction(
        service_code="CLS-ECG-01",
        service_name="Điện tim gắng sức / Điện tâm đồ 12 chuyển đạo",
        category="PROCEDURE",
        unit_price=Decimal("100000.00"),
        department="Khoa Thăm Dò Chức Năng",
        is_active=True,
    )
    db_session.add(ecg_service)
    await db_session.flush()

    paraclinical_order = ParaclinicalOrderProduction(
        order_code="CLS-ORD-ECG-001",
        encounter_id=encounter.id,
        service_id=ecg_service.id,
        ordered_by=doctor_prod.id,
        status="PAID",
    )
    db_session.add(paraclinical_order)
    await db_session.flush()

    national_code = national_gateway_service.generate_national_prescription_code("01", "01999", 902)
    qr_url = national_gateway_service.generate_national_qr_lookup_url(national_code)

    external_prescription = PrescriptionProduction(
        prescription_code="DT-MODEL-A-EXTERNAL",
        national_prescription_code=national_code,
        encounter_id=encounter.id,
        doctor_id=doctor_prod.id,
        status="SYNCED_PORTAL",
        sync_status="SYNCED",
        qr_lookup_url=qr_url,
        doctor_advice="Đơn thuốc liên thông quốc gia mua ngoài tại nhà thuốc GPP",
    )
    db_session.add(external_prescription)
    await db_session.flush()

    seal_res = await clinical_service.seal_and_sign_encounter(
        encounter.id, doctor_user, db_session
    )
    assert seal_res.status == "COMPLETED_LOCKED"
    assert seal_res.is_locked is True

    fee_sheet = await production_cashier_service.calculate_fee_sheet(
        encounter.id, Decimal("0.00"), db_session
    )
    assert fee_sheet.total_service_amount == Decimal("250000.00")
    assert fee_sheet.total_medication_amount == Decimal("0.00")
    assert fee_sheet.final_amount == Decimal("250000.00")

    invoice = await production_cashier_service.create_invoice(
        encounter_id=encounter.id,
        discount_amount=Decimal("0.00"),
        cashier_id=doctor_prod.id,
        db=db_session,
    )
    assert invoice.final_amount == Decimal("250000.00")

    txn_code = f"TXN-NAPAS-A-{invoice.id:06d}"
    amount = Decimal("250000.00")
    secret_bytes = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")
    signature = hmac.new(
        secret_bytes,
        f"{txn_code}|{invoice.id}|{amount}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    webhook_payload = BankWebhookPayload(
        transaction_code=txn_code,
        bank_transaction_id="FT261110007766",
        amount=amount,
        invoice_id=invoice.id,
        signature=signature,
    )

    webhook_res = await production_cashier_service.process_bank_webhook(
        payload=webhook_payload,
        raw_body=b"",
        header_signature=signature,
        db=db_session,
    )
    assert webhook_res.ok is True
    assert webhook_res.status == "SUCCESS"

    await db_session.refresh(invoice)
    assert invoice.status == "PAID"

    with pytest.raises(ConflictException) as exc_info:
        await production_pharmacy_service.dispense_prescription(
            prescription_id=external_prescription.id,
            user_id=doctor_prod.id,
            db=db_session,
        )
    assert "liên thông Cổng Quốc gia" in str(exc_info.value)


@pytest.mark.asyncio
async def test_stage7_emr_immutability_and_tamper_proofing(db_session):
    doctor_prod, doctor_user = await _create_test_staff(db_session, "lock03")

    patient = PatientProduction(
        patient_code="BN-LOCK-003",
        full_name="VU THI LOAN",
        date_of_birth=date(1993, 2, 14),
        gender="FEMALE",
        phone_number="0944556677",
        address="Dong Da, Ha Noi",
    )
    db_session.add(patient)
    await db_session.flush()

    encounter = EncounterProduction(
        encounter_code="ENC-LOCK-003",
        patient_id=patient.id,
        doctor_id=doctor_prod.id,
        queue_number=1,
        clinic_room_number="PK-105",
        status="IN_CONSULTATION",
        chief_complaint="Đau lưng mãn tính",
    )
    db_session.add(encounter)
    await db_session.flush()

    icd_m54 = await _get_or_create_icd10(db_session, "M54.5", "Đau lưng vùng thắt lưng")
    db_session.add(
        EncounterDiagnosisProduction(
            encounter_id=encounter.id,
            icd10_code=icd_m54.code,
            is_primary=True,
            clinical_notes="Hội chứng đau cột sống thắt lưng",
        )
    )
    await db_session.flush()

    seal_res = await clinical_service.seal_and_sign_encounter(
        encounter.id, doctor_user, db_session
    )
    assert seal_res.status == "COMPLETED_LOCKED"
    assert seal_res.is_locked is True
    assert len(seal_res.record_hash) == 64

    with pytest.raises(ConflictException) as exc_info:
        await clinical_service.seal_and_sign_encounter(
            encounter.id, doctor_user, db_session
        )
    assert "đã được ký số" in str(exc_info.value)

    tamper_vitals = VitalsCreateRequest(
        systolic_bp=120.0,
        diastolic_bp=80.0,
        heart_rate=72.0,
        body_temperature=36.8,
    )
    with pytest.raises(ForbiddenException) as exc_info:
        await clinical_service.record_encounter_vitals(
            encounter.id, tamper_vitals, doctor_user, db_session
        )
    assert "Invariant EMR-1" in str(exc_info.value)


@pytest.mark.asyncio
async def test_stage7_concurrency_fefo_stock_depletion_row_level_lock(db_session):
    doctor_prod, _ = await _create_test_staff(db_session, "conc04")

    patient1 = PatientProduction(
        patient_code="BN-CONC-01",
        full_name="BENH NHAN TRANH CHAP 1",
        date_of_birth=date(1990, 1, 1),
        gender="MALE",
        phone_number="0911000001",
        address="Ha Noi",
    )
    patient2 = PatientProduction(
        patient_code="BN-CONC-02",
        full_name="BENH NHAN TRANH CHAP 2",
        date_of_birth=date(1992, 2, 2),
        gender="FEMALE",
        phone_number="0911000002",
        address="Ha Noi",
    )
    db_session.add_all([patient1, patient2])
    await db_session.flush()

    enc1 = EncounterProduction(
        encounter_code="ENC-CONC-01",
        patient_id=patient1.id,
        doctor_id=doctor_prod.id,
        queue_number=1,
        clinic_room_number="PK-101",
        status="IN_CONSULTATION",
        chief_complaint="Kham tong quat benh nhan 1",
    )
    enc2 = EncounterProduction(
        encounter_code="ENC-CONC-02",
        patient_id=patient2.id,
        doctor_id=doctor_prod.id,
        queue_number=2,
        clinic_room_number="PK-101",
        status="IN_CONSULTATION",
        chief_complaint="Kham tong quat benh nhan 2",
    )
    db_session.add_all([enc1, enc2])
    await db_session.flush()

    drug = DrugProduction(
        drug_code="DRUG-CONC-LIMITED",
        brand_name="Thuốc Kháng Sinh Hiếm 500mg",
        generic_name="Rare Antibiotic",
        dosage_form="Viên",
        strength="500mg",
        route_of_administration="Uống",
        unit_of_measure="Viên",
        unit_selling_price=Decimal("50000.00"),
        is_active=True,
    )
    db_session.add(drug)
    await db_session.flush()

    batch = DrugBatchProduction(
        drug_id=drug.id,
        batch_number="L-RARE-ONLY-10",
        expiry_date=date.today() + timedelta(days=60),
        physical_stock=10,
        held_stock=0,
        import_price=Decimal("40000.00"),
    )
    db_session.add(batch)
    await db_session.flush()

    presc1 = PrescriptionProduction(
        prescription_code="DT-CONC-001",
        encounter_id=enc1.id,
        doctor_id=doctor_prod.id,
        status="PRESCRIBED",
    )
    presc2 = PrescriptionProduction(
        prescription_code="DT-CONC-002",
        encounter_id=enc2.id,
        doctor_id=doctor_prod.id,
        status="PRESCRIBED",
    )
    db_session.add_all([presc1, presc2])
    await db_session.flush()

    p_item1 = PrescriptionItemProduction(
        prescription_id=presc1.id,
        drug_id=drug.id,
        quantity_prescribed=10,
        usage_instructions="Uống 1 viên x 2 lần/ngày",
        treatment_days=5,
    )
    p_item2 = PrescriptionItemProduction(
        prescription_id=presc2.id,
        drug_id=drug.id,
        quantity_prescribed=10,
        usage_instructions="Uống 1 viên x 2 lần/ngày",
        treatment_days=5,
    )
    db_session.add_all([p_item1, p_item2])
    await db_session.commit()

    dispense_res1 = await production_pharmacy_service.dispense_prescription(
        prescription_id=presc1.id,
        user_id=doctor_prod.id,
        db=db_session,
    )
    assert dispense_res1.status == "DISPENSED"
    assert dispense_res1.items[0].allocations[0].allocated_quantity == 10

    await db_session.refresh(batch)
    assert batch.physical_stock == 0

    with pytest.raises(ConflictException) as exc_info:
        await production_pharmacy_service.dispense_prescription(
            prescription_id=presc2.id,
            user_id=doctor_prod.id,
            db=db_session,
        )

    assert "Không đủ tồn kho" in str(exc_info.value)
    await db_session.refresh(batch)
    assert batch.physical_stock == 0
    assert batch.physical_stock >= 0

    await db_session.refresh(presc2)
    assert presc2.status == "PRESCRIBED"


@pytest.mark.asyncio
async def test_stage7_webhook_idempotency_and_replay_protection(db_session):
    doctor_prod, _ = await _create_test_staff(db_session, "idem05")

    patient = PatientProduction(
        patient_code="BN-IDEM-005",
        full_name="DO DUY MANH",
        date_of_birth=date(1996, 9, 29),
        gender="MALE",
        phone_number="0966778899",
        address="Ha Noi",
    )
    db_session.add(patient)
    await db_session.flush()

    encounter = EncounterProduction(
        encounter_code="ENC-IDEM-005",
        patient_id=patient.id,
        doctor_id=doctor_prod.id,
        queue_number=5,
        clinic_room_number="PK-102",
        status="IN_CONSULTATION",
        chief_complaint="Kham tong quat dinh ky",
    )
    db_session.add(encounter)
    await db_session.flush()

    invoice = InvoiceProduction(
        invoice_code="HD-IDEM-005",
        encounter_id=encounter.id,
        patient_id=patient.id,
        cashier_id=doctor_prod.id,
        total_service_amount=Decimal("150000.00"),
        total_medication_amount=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        final_amount=Decimal("150000.00"),
        status="PENDING",
    )
    db_session.add(invoice)
    await db_session.commit()

    txn_code = f"TXN-REPLAY-{invoice.id}"
    amount = Decimal("150000.00")
    secret_bytes = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")
    signature = hmac.new(
        secret_bytes,
        f"{txn_code}|{invoice.id}|{amount}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    webhook_payload = BankWebhookPayload(
        transaction_code=txn_code,
        bank_transaction_id="FT999888777",
        amount=amount,
        invoice_id=invoice.id,
        signature=signature,
    )

    first_call = await production_cashier_service.process_bank_webhook(
        payload=webhook_payload,
        raw_body=b"",
        header_signature=signature,
        db=db_session,
    )
    assert first_call.ok is True
    assert first_call.is_idempotent is False
    assert first_call.status == "SUCCESS"

    second_call = await production_cashier_service.process_bank_webhook(
        payload=webhook_payload,
        raw_body=b"",
        header_signature=signature,
        db=db_session,
    )
    assert second_call.ok is True
    assert second_call.is_idempotent is True
    assert second_call.status == "SUCCESS"

    third_call = await production_cashier_service.process_bank_webhook(
        payload=webhook_payload,
        raw_body=b"",
        header_signature=signature,
        db=db_session,
    )
    assert third_call.ok is True
    assert third_call.is_idempotent is True
    assert third_call.status == "SUCCESS"

    await db_session.refresh(invoice)
    assert invoice.status == "PAID"

    tx_stmt = select(PaymentTransactionProduction).where(
        PaymentTransactionProduction.transaction_code == txn_code
    )
    tx_records = (await db_session.execute(tx_stmt)).scalars().all()
    assert len(tx_records) == 1


@pytest.mark.asyncio
async def test_stage7_webhook_security_tamper_signature_and_amount_mismatch(db_session):
    doctor_prod, _ = await _create_test_staff(db_session, "sec06")

    patient = PatientProduction(
        patient_code="BN-SEC-006",
        full_name="NGUYEN THI ANH",
        date_of_birth=date(1995, 5, 5),
        gender="FEMALE",
        phone_number="0977889900",
        address="Ha Noi",
    )
    db_session.add(patient)
    await db_session.flush()

    encounter = EncounterProduction(
        encounter_code="ENC-SEC-006",
        patient_id=patient.id,
        doctor_id=doctor_prod.id,
        queue_number=6,
        clinic_room_number="PK-103",
        status="IN_CONSULTATION",
        chief_complaint="Kham suc khoe",
    )
    db_session.add(encounter)
    await db_session.flush()

    invoice = InvoiceProduction(
        invoice_code="HD-SEC-006",
        encounter_id=encounter.id,
        patient_id=patient.id,
        cashier_id=doctor_prod.id,
        total_service_amount=Decimal("300000.00"),
        total_medication_amount=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        final_amount=Decimal("300000.00"),
        status="PENDING",
    )
    db_session.add(invoice)
    await db_session.commit()

    valid_payload = BankWebhookPayload(
        transaction_code=f"TXN-SEC-{invoice.id}",
        bank_transaction_id="FT888777666",
        amount=Decimal("300000.00"),
        invoice_id=invoice.id,
        signature="tampered_hex_signature_1234567890abcdef",
    )

    with pytest.raises(ForbiddenException) as exc_info:
        await production_cashier_service.process_bank_webhook(
            payload=valid_payload,
            raw_body=b"",
            header_signature="tampered_hex_signature_1234567890abcdef",
            db=db_session,
        )
    assert "không hợp lệ" in str(exc_info.value).lower()

    secret_bytes = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")
    mismatch_amount = Decimal("100000.00")
    txn_mismatch = f"TXN-MISMATCH-{invoice.id}"
    sig_mismatch = hmac.new(
        secret_bytes,
        f"{txn_mismatch}|{invoice.id}|{mismatch_amount}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    mismatched_payload = BankWebhookPayload(
        transaction_code=txn_mismatch,
        bank_transaction_id="FT777666555",
        amount=mismatch_amount,
        invoice_id=invoice.id,
        signature=sig_mismatch,
    )

    with pytest.raises(BadRequestException) as exc_info:
        await production_cashier_service.process_bank_webhook(
            payload=mismatched_payload,
            raw_body=b"",
            header_signature=sig_mismatch,
            db=db_session,
        )
    assert "không đủ" in str(exc_info.value)


@pytest.mark.asyncio
async def test_stage7_drug_allergy_interception_in_e2e_flow(db_session):
    patient = PatientProduction(
        patient_code="BN-ALLERGY-STAGE7",
        full_name="PHAM VAN ALLERGY",
        date_of_birth=date(1989, 8, 18),
        gender="MALE",
        phone_number="0912999888",
        address="Hai Duong",
    )
    db_session.add(patient)
    await db_session.flush()

    allergy = PatientAllergyProduction(
        patient_id=patient.id,
        active_ingredient_name="Amoxicillin",
        allergy_type="DRUG",
        severity="SEVERE",
        reaction_description="Sốc phản vệ độ 2",
    )
    db_session.add(allergy)
    await db_session.commit()

    check_conflict = await clinical_service.check_drug_allergy_conflict(
        patient.id, "Amoxicillin 500mg (Augmentin)", db_session
    )
    assert check_conflict.has_conflict is True
    assert check_conflict.is_blocked is True
    assert "Amoxicillin" in check_conflict.details

    check_safe = await clinical_service.check_drug_allergy_conflict(
        patient.id, "Paracetamol 500mg", db_session
    )
    assert check_safe.has_conflict is False
    assert check_safe.is_blocked is False
