import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import hmac
import uuid
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


async def _get_or_create_service(db, code, name, category, price, department):
    stmt = select(ServiceProduction).where(ServiceProduction.service_code == code)
    svc = (await db.execute(stmt)).scalar_one_or_none()
    if not svc:
        svc = ServiceProduction(
            service_code=code,
            service_name=name,
            category=category,
            unit_price=price,
            department=department,
            is_active=True,
        )
        db.add(svc)
        await db.flush()
    return svc


@pytest.mark.asyncio
async def test_stage7_e2e_lifecycle_outpatient_clinic(db_session):
    run_id = uuid.uuid4().hex[:6]
    doctor_prod, doctor_user = await _create_test_staff(db_session, f"e2ea{run_id}")

    patient = PatientProduction(
        patient_code=f"BN-MODA-{run_id}",
        full_name="HOANG THI NGAN",
        date_of_birth=date(1975, 6, 15),
        gender="FEMALE",
        phone_number="0988112233",
        address="Cau Giay, Ha Noi",
    )
    db_session.add(patient)
    await db_session.flush()

    encounter = EncounterProduction(
        encounter_code=f"ENC-MODA-{run_id}",
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

    ecg_service = await _get_or_create_service(
        db_session,
        "CLS-ECG-01",
        "Điện tim gắng sức / Điện tâm đồ 12 chuyển đạo",
        "PROCEDURE",
        Decimal("100000.00"),
        "Khoa Thăm Dò Chức Năng",
    )

    paraclinical_order = ParaclinicalOrderProduction(
        order_code=f"CLS-ORD-{run_id}",
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
        prescription_code=f"DT-MODA-{run_id}",
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
async def test_stage7_concurrency_invoice_payment_atomic_guard(db_session):
    doctor_prod, _ = await _create_test_staff(db_session, "conc04")

    patient = PatientProduction(
        patient_code="BN-CONC-INV-01",
        full_name="BENH NHAN TRANH CHAP HOA DON",
        date_of_birth=date(1990, 1, 1),
        gender="MALE",
        phone_number="0911000001",
        address="Ha Noi",
    )
    db_session.add(patient)
    await db_session.flush()

    encounter = EncounterProduction(
        encounter_code="ENC-CONC-INV-01",
        patient_id=patient.id,
        doctor_id=doctor_prod.id,
        queue_number=1,
        clinic_room_number="PK-101",
        status="IN_CONSULTATION",
        chief_complaint="Kham tong quat tranh chap hoa don",
    )
    db_session.add(encounter)
    await db_session.flush()

    invoice = await production_cashier_service.create_invoice(
        encounter_id=encounter.id,
        discount_amount=Decimal("0.00"),
        cashier_id=doctor_prod.id,
        db=db_session,
    )
    await db_session.commit()

    txn_code1 = f"TXN-CONC-1-{invoice.id:06d}"
    txn_code2 = f"TXN-CONC-2-{invoice.id:06d}"
    amount = Decimal("150000.00")
    secret_bytes = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")
    sig1 = hmac.new(secret_bytes, f"{txn_code1}|{invoice.id}|{amount}".encode("utf-8"), hashlib.sha256).hexdigest()
    sig2 = hmac.new(secret_bytes, f"{txn_code2}|{invoice.id}|{amount}".encode("utf-8"), hashlib.sha256).hexdigest()

    payload1 = BankWebhookPayload(transaction_code=txn_code1, bank_transaction_id="FT1", amount=amount, invoice_id=invoice.id, signature=sig1)
    payload2 = BankWebhookPayload(transaction_code=txn_code2, bank_transaction_id="FT2", amount=amount, invoice_id=invoice.id, signature=sig2)

    res1 = await production_cashier_service.process_bank_webhook(payload=payload1, raw_body=b"", header_signature=sig1, db=db_session)
    assert res1.ok is True
    assert res1.status == "SUCCESS"

    with pytest.raises(ConflictException) as exc_info:
        await production_cashier_service.process_bank_webhook(payload=payload2, raw_body=b"", header_signature=sig2, db=db_session)
    assert "đã được thanh toán" in str(exc_info.value)


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
