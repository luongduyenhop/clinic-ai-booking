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
    DrugProduction,
    EncounterProduction,
    InvoiceItemProduction,
    InvoiceProduction,
    ParaclinicalOrderProduction,
    PatientProduction,
    PaymentTransactionProduction,
    PrescriptionItemProduction,
    PrescriptionProduction,
    ServiceProduction,
    UserProduction,
)
from app.schemas.production_billing import (
    BankWebhookPayload,
    ProdInvoiceCreateRequest,
)
from app.services.production_cashier_service import (
    _calculate_emvco_crc16,
    production_cashier_service,
)


async def _setup_test_context(db_session, suffix="1"):
    user = UserProduction(
        username=f"user_test_{suffix}",
        hashed_password="hash",
        full_name=f"Bac Si Test {suffix}",
        role="DOCTOR",
    )
    patient = PatientProduction(
        patient_code=f"BN-TEST-{suffix}",
        full_name=f"Benh Nhan Test {suffix}",
        date_of_birth=date(1990, 1, 1),
        gender="MALE",
        phone_number=f"0912{suffix[:6].ljust(6, '0')}",
        address="Hanoi",
    )
    db_session.add_all([user, patient])
    await db_session.flush()

    encounter = EncounterProduction(
        encounter_code=f"ENC-TEST-{suffix}",
        patient_id=patient.id,
        doctor_id=user.id,
        queue_number=1,
        clinic_room_number="PK-101",
        status="IN_CONSULTATION",
        chief_complaint="Kham tong quat",
    )
    db_session.add(encounter)
    await db_session.flush()
    return user, patient, encounter


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


async def _get_or_create_drug(db, code, brand, generic, form, strength, route, unit, price):
    stmt = select(DrugProduction).where(DrugProduction.drug_code == code)
    drug = (await db.execute(stmt)).scalar_one_or_none()
    if not drug:
        drug = DrugProduction(
            drug_code=code,
            brand_name=brand,
            generic_name=generic,
            dosage_form=form,
            strength=strength,
            route_of_administration=route,
            unit_of_measure=unit,
            unit_selling_price=price,
            is_active=True,
        )
        db.add(drug)
        await db.flush()
    return drug


def test_emvco_crc16_calculation():
    sample_payload = "00020101021238560010A00000072701240006970422011009012345670208QRIBFTTA530370454061500005802VN62140810TT-HD-10016304"
    crc = _calculate_emvco_crc16(sample_payload)
    assert len(crc) == 4
    assert crc.isalnum()


@pytest.mark.asyncio
async def test_fee_sheet_calculation_accuracy(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "fee01")

    service1 = await _get_or_create_service(
        db_session,
        "CLS-XRAY-01",
        "Chụp X-Quang Ngực Thẳng",
        "IMAGING",
        Decimal("200000.00"),
        "KHOA_CDHA",
    )
    service2 = await _get_or_create_service(
        db_session,
        "CLS-BLOOD-01",
        "Tổng phân tích tế bào máu",
        "LABORATORY",
        Decimal("120000.00"),
        "KHOA_XN",
    )

    order1 = ParaclinicalOrderProduction(
        order_code=f"ORD-CLS-{encounter.id}-001",
        encounter_id=encounter.id,
        service_id=service1.id,
        ordered_by=user.id,
        status="ORDERED",
    )
    order2 = ParaclinicalOrderProduction(
        order_code=f"ORD-CLS-{encounter.id}-002",
        encounter_id=encounter.id,
        service_id=service2.id,
        ordered_by=user.id,
        status="ORDERED",
    )
    db_session.add_all([order1, order2])
    await db_session.flush()

    drug1 = await _get_or_create_drug(
        db_session,
        "DRUG-PARA-01",
        "Panadol Extra",
        "Paracetamol",
        "Viên nén",
        "500mg",
        "Uống",
        "Viên",
        Decimal("5000.00"),
    )
    drug2 = await _get_or_create_drug(
        db_session,
        "DRUG-AUG-01",
        "Augmentin",
        "Amoxicillin/Clavulanate",
        "Viên bao phim",
        "1000mg",
        "Uống",
        "Viên",
        Decimal("20000.00"),
    )

    prescription = PrescriptionProduction(
        prescription_code=f"DT-{encounter.id}-0001",
        encounter_id=encounter.id,
        doctor_id=user.id,
        status="PRESCRIBED",
    )
    db_session.add(prescription)
    await db_session.flush()

    item1 = PrescriptionItemProduction(
        prescription_id=prescription.id,
        drug_id=drug1.id,
        quantity_prescribed=10,
        usage_instructions="Uống sau ăn",
        treatment_days=5,
    )
    item2 = PrescriptionItemProduction(
        prescription_id=prescription.id,
        drug_id=drug2.id,
        quantity_prescribed=5,
        usage_instructions="Uống sáng tối",
        treatment_days=5,
    )
    db_session.add_all([item1, item2])
    await db_session.flush()

    discount = Decimal("20000.00")
    fee_sheet = await production_cashier_service.calculate_fee_sheet(
        encounter_id=encounter.id,
        discount_amount=discount,
        db=db_session,
    )

    expected_service = Decimal("150000.00") + Decimal("200000.00") + Decimal("120000.00")
    expected_med = Decimal("0.00")
    expected_final = expected_service - discount

    assert fee_sheet.total_service_amount == expected_service
    assert fee_sheet.total_medication_amount == expected_med
    assert fee_sheet.discount_amount == discount
    assert fee_sheet.final_amount == expected_final
    assert len(fee_sheet.items) == 3

    invoice = await production_cashier_service.create_invoice(
        encounter_id=encounter.id,
        discount_amount=discount,
        cashier_id=user.id,
        db=db_session,
    )

    assert invoice.final_amount == expected_final
    assert invoice.status == "PENDING"
    assert invoice.is_locked is False

    with pytest.raises(ConflictException):
        await production_cashier_service.create_invoice(
            encounter_id=encounter.id,
            discount_amount=Decimal("0.00"),
            cashier_id=user.id,
            db=db_session,
        )


@pytest.mark.asyncio
async def test_generate_vietqr_napas_247_standard(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "qr01")

    invoice = InvoiceProduction(
        invoice_code="HD-20261110-000099",
        encounter_id=encounter.id,
        patient_id=patient.id,
        cashier_id=user.id,
        total_service_amount=Decimal("300000.00"),
        total_medication_amount=Decimal("150000.00"),
        discount_amount=Decimal("50000.00"),
        final_amount=Decimal("400000.00"),
        status="PENDING",
        is_locked=False,
    )
    db_session.add(invoice)
    await db_session.commit()
    await db_session.refresh(invoice)

    qr_res = await production_cashier_service.generate_vietqr(
        invoice_id=invoice.id,
        db=db_session,
    )

    assert qr_res.bank_bin == "970422"
    assert qr_res.account_number == "0901234567"
    assert qr_res.final_amount == Decimal("400000.00")
    assert f"TT-HD-{invoice.id}" in qr_res.payment_reference

    emvco = qr_res.qr_payload_emvco
    assert emvco.startswith("000201010212")
    assert "A000000727" in emvco
    assert "QRIBFTTA" in emvco
    assert "5303704" in emvco
    assert "5802VN" in emvco
    assert "400000" in emvco

    computed_crc = _calculate_emvco_crc16(emvco[:-4])
    assert emvco[-4:] == computed_crc
    assert "img.vietqr.io" in qr_res.qr_quicklink_url


@pytest.mark.asyncio
async def test_payment_webhook_hmac_signature_verification_success(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "pay01")

    invoice = InvoiceProduction(
        invoice_code="HD-20261110-000100",
        encounter_id=encounter.id,
        patient_id=patient.id,
        cashier_id=user.id,
        total_service_amount=Decimal("250000.00"),
        total_medication_amount=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        final_amount=Decimal("250000.00"),
        status="PENDING",
        is_locked=False,
    )
    db_session.add(invoice)
    await db_session.commit()
    await db_session.refresh(invoice)

    txn_code = "MB-20261110-0001"
    amount = Decimal("250000.00")
    secret_bytes = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")
    valid_sig = hmac.new(
        secret_bytes,
        f"{txn_code}|{invoice.id}|{amount}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    payload = BankWebhookPayload(
        transaction_code=txn_code,
        bank_transaction_id="FT261110009988",
        amount=amount,
        invoice_id=invoice.id,
        signature=valid_sig,
    )

    webhook_res = await production_cashier_service.process_bank_webhook(
        payload=payload,
        raw_body=b"",
        header_signature=valid_sig,
        db=db_session,
    )

    assert webhook_res.ok is True
    assert webhook_res.status == "SUCCESS"
    assert webhook_res.is_idempotent is False

    await db_session.refresh(invoice)
    assert invoice.status == "PAID"
    assert invoice.payment_method == "VIETQR"
    assert invoice.paid_at is not None
    assert invoice.is_locked is True

    txn_stmt = select(PaymentTransactionProduction).where(
        PaymentTransactionProduction.transaction_code == txn_code
    )
    saved_txn = (await db_session.execute(txn_stmt)).scalar_one()
    assert saved_txn.amount == amount
    assert saved_txn.payment_status == "SUCCESS"


@pytest.mark.asyncio
async def test_payment_webhook_fraudulent_signature_rejected(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "pay02")

    invoice = InvoiceProduction(
        invoice_code="HD-20261110-000101",
        encounter_id=encounter.id,
        patient_id=patient.id,
        cashier_id=user.id,
        total_service_amount=Decimal("150000.00"),
        total_medication_amount=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        final_amount=Decimal("150000.00"),
        status="PENDING",
        is_locked=False,
    )
    db_session.add(invoice)
    await db_session.commit()
    await db_session.refresh(invoice)

    fraudulent_payload = BankWebhookPayload(
        transaction_code="MB-FAKE-9999",
        amount=Decimal("150000.00"),
        invoice_id=invoice.id,
        signature="invalid_signature_hash_value_12345",
    )

    with pytest.raises(ForbiddenException) as exc_info:
        await production_cashier_service.process_bank_webhook(
            payload=fraudulent_payload,
            raw_body=b"",
            header_signature="invalid_signature_hash_value_12345",
            db=db_session,
        )

    assert "không hợp lệ" in str(exc_info.value)
    await db_session.refresh(invoice)
    assert invoice.status == "PENDING"
    assert invoice.is_locked is False


@pytest.mark.asyncio
async def test_payment_webhook_idempotency_guard(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "pay03")

    invoice = InvoiceProduction(
        invoice_code="HD-20261110-000102",
        encounter_id=encounter.id,
        patient_id=patient.id,
        cashier_id=user.id,
        total_service_amount=Decimal("180000.00"),
        total_medication_amount=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        final_amount=Decimal("180000.00"),
        status="PENDING",
        is_locked=False,
    )
    db_session.add(invoice)
    await db_session.commit()
    await db_session.refresh(invoice)

    txn_code = "MB-IDEMPOTENT-0001"
    amount = Decimal("180000.00")
    secret_bytes = settings.PAYMENT_WEBHOOK_SECRET.encode("utf-8")
    valid_sig = hmac.new(
        secret_bytes,
        f"{txn_code}|{invoice.id}|{amount}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    payload = BankWebhookPayload(
        transaction_code=txn_code,
        amount=amount,
        invoice_id=invoice.id,
        signature=valid_sig,
    )

    first_res = await production_cashier_service.process_bank_webhook(
        payload=payload,
        raw_body=b"",
        header_signature=valid_sig,
        db=db_session,
    )
    assert first_res.ok is True
    assert first_res.is_idempotent is False

    second_res = await production_cashier_service.process_bank_webhook(
        payload=payload,
        raw_body=b"",
        header_signature=valid_sig,
        db=db_session,
    )
    assert second_res.ok is True
    assert second_res.is_idempotent is True
    assert second_res.transaction_code == txn_code
