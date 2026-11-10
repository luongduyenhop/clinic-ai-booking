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
    DrugBatchProduction,
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
from app.schemas.production_pharmacy import DrugBatchCreateRequest
from app.services.production_cashier_service import (
    _calculate_emvco_crc16,
    production_cashier_service,
)
from app.services.production_pharmacy_service import production_pharmacy_service


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


def test_emvco_crc16_calculation():
    sample_payload = "00020101021238560010A00000072701240006970422011009012345670208QRIBFTTA530370454061500005802VN62140810TT-HD-10016304"
    crc = _calculate_emvco_crc16(sample_payload)
    assert len(crc) == 4
    assert crc.isalnum()


@pytest.mark.asyncio
async def test_fee_sheet_calculation_accuracy(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "fee01")

    service1 = ServiceProduction(
        service_code="CLS-XRAY-01",
        service_name="Chụp X-Quang Ngực Thẳng",
        category="IMAGING",
        unit_price=Decimal("200000.00"),
        department="KHOA_CDHA",
        is_active=True,
    )
    service2 = ServiceProduction(
        service_code="CLS-BLOOD-01",
        service_name="Tổng phân tích tế bào máu",
        category="LABORATORY",
        unit_price=Decimal("120000.00"),
        department="KHOA_XN",
        is_active=True,
    )
    db_session.add_all([service1, service2])
    await db_session.flush()

    order1 = ParaclinicalOrderProduction(
        order_code="ORD-CLS-001",
        encounter_id=encounter.id,
        service_id=service1.id,
        ordered_by=user.id,
        status="ORDERED",
    )
    order2 = ParaclinicalOrderProduction(
        order_code="ORD-CLS-002",
        encounter_id=encounter.id,
        service_id=service2.id,
        ordered_by=user.id,
        status="ORDERED",
    )
    db_session.add_all([order1, order2])
    await db_session.flush()

    drug1 = DrugProduction(
        drug_code="DRUG-PARA-01",
        brand_name="Panadol Extra",
        generic_name="Paracetamol",
        dosage_form="Viên nén",
        strength="500mg",
        route_of_administration="Uống",
        unit_of_measure="Viên",
        unit_selling_price=Decimal("5000.00"),
        is_active=True,
    )
    drug2 = DrugProduction(
        drug_code="DRUG-AUG-01",
        brand_name="Augmentin",
        generic_name="Amoxicillin/Clavulanate",
        dosage_form="Viên bao phim",
        strength="1000mg",
        route_of_administration="Uống",
        unit_of_measure="Viên",
        unit_selling_price=Decimal("20000.00"),
        is_active=True,
    )
    db_session.add_all([drug1, drug2])
    await db_session.flush()

    prescription = PrescriptionProduction(
        prescription_code="DT-202611-0001",
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
    expected_med = (Decimal("10") * Decimal("5000.00")) + (Decimal("5") * Decimal("20000.00"))
    expected_final = expected_service + expected_med - discount

    assert fee_sheet.total_service_amount == expected_service
    assert fee_sheet.total_medication_amount == expected_med
    assert fee_sheet.discount_amount == discount
    assert fee_sheet.final_amount == expected_final
    assert len(fee_sheet.items) == 5

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


@pytest.mark.asyncio
async def test_drug_inventory_fefo_dispensing_order(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "fefo01")

    drug = DrugProduction(
        drug_code="DRUG-FEFO-01",
        brand_name="Ciprofloxacin",
        generic_name="Ciprofloxacin 500mg",
        dosage_form="Viên nén",
        strength="500mg",
        route_of_administration="Uống",
        unit_of_measure="Viên",
        unit_selling_price=Decimal("15000.00"),
        is_active=True,
    )
    db_session.add(drug)
    await db_session.flush()

    today = date.today()
    batch_near = DrugBatchProduction(
        drug_id=drug.id,
        batch_number="L01-EXP30D",
        expiry_date=today + timedelta(days=30),
        physical_stock=10,
        held_stock=0,
        import_price=Decimal("10000.00"),
    )
    batch_mid = DrugBatchProduction(
        drug_id=drug.id,
        batch_number="L02-EXP90D",
        expiry_date=today + timedelta(days=90),
        physical_stock=20,
        held_stock=0,
        import_price=Decimal("10000.00"),
    )
    batch_far = DrugBatchProduction(
        drug_id=drug.id,
        batch_number="L03-EXP180D",
        expiry_date=today + timedelta(days=180),
        physical_stock=30,
        held_stock=0,
        import_price=Decimal("10000.00"),
    )
    db_session.add_all([batch_near, batch_mid, batch_far])
    await db_session.commit()

    fefo_list = await production_pharmacy_service.list_drug_batches(
        drug_id=drug.id,
        db=db_session,
    )
    assert len(fefo_list) == 3
    assert fefo_list[0].batch_number == "L01-EXP30D"
    assert fefo_list[1].batch_number == "L02-EXP90D"
    assert fefo_list[2].batch_number == "L03-EXP180D"

    prescription = PrescriptionProduction(
        prescription_code="DT-FEFO-TEST",
        encounter_id=encounter.id,
        doctor_id=user.id,
        status="PRESCRIBED",
    )
    db_session.add(prescription)
    await db_session.flush()

    p_item = PrescriptionItemProduction(
        prescription_id=prescription.id,
        drug_id=drug.id,
        quantity_prescribed=15,
        usage_instructions="Uống 1 viên x 2 lần/ngày",
        treatment_days=7,
    )
    db_session.add(p_item)
    await db_session.commit()

    dispense_res = await production_pharmacy_service.dispense_prescription(
        prescription_id=prescription.id,
        user_id=user.id,
        db=db_session,
    )

    assert dispense_res.status == "DISPENSED"
    item_report = dispense_res.items[0]
    assert item_report.quantity_prescribed == 15
    assert len(item_report.allocations) == 2

    assert item_report.allocations[0].batch_number == "L01-EXP30D"
    assert item_report.allocations[0].allocated_quantity == 10
    assert item_report.allocations[0].remaining_stock == 0

    assert item_report.allocations[1].batch_number == "L02-EXP90D"
    assert item_report.allocations[1].allocated_quantity == 5
    assert item_report.allocations[1].remaining_stock == 15

    await db_session.refresh(batch_near)
    await db_session.refresh(batch_mid)
    await db_session.refresh(batch_far)

    assert batch_near.physical_stock == 0
    assert batch_mid.physical_stock == 15
    assert batch_far.physical_stock == 30

    with pytest.raises(ConflictException):
        await production_pharmacy_service.dispense_prescription(
            prescription_id=prescription.id,
            user_id=user.id,
            db=db_session,
        )


@pytest.mark.asyncio
async def test_drug_inventory_fefo_out_of_stock_guard(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "fefo02")

    drug = DrugProduction(
        drug_code="DRUG-FEFO-02",
        brand_name="Azithromycin",
        generic_name="Azithromycin 500mg",
        dosage_form="Viên nén",
        strength="500mg",
        route_of_administration="Uống",
        unit_of_measure="Viên",
        unit_selling_price=Decimal("25000.00"),
        is_active=True,
    )
    db_session.add(drug)
    await db_session.flush()

    batch = DrugBatchProduction(
        drug_id=drug.id,
        batch_number="L01-AZI",
        expiry_date=date.today() + timedelta(days=60),
        physical_stock=5,
        held_stock=0,
        import_price=Decimal("18000.00"),
    )
    db_session.add(batch)
    await db_session.commit()

    prescription = PrescriptionProduction(
        prescription_code="DT-FEFO-OOS",
        encounter_id=encounter.id,
        doctor_id=user.id,
        status="PRESCRIBED",
    )
    db_session.add(prescription)
    await db_session.flush()

    p_item = PrescriptionItemProduction(
        prescription_id=prescription.id,
        drug_id=drug.id,
        quantity_prescribed=10,
        usage_instructions="Uống 1 viên/ngày",
        treatment_days=10,
    )
    db_session.add(p_item)
    await db_session.commit()

    with pytest.raises(ConflictException) as exc_info:
        await production_pharmacy_service.dispense_prescription(
            prescription_id=prescription.id,
            user_id=user.id,
            db=db_session,
        )

    assert "Không đủ tồn kho" in str(exc_info.value)
    await db_session.refresh(batch)
    assert batch.physical_stock == 5


@pytest.mark.asyncio
async def test_drug_batch_expiry_date_validation(db_session):
    user, patient, encounter = await _setup_test_context(db_session, "fefo03")

    drug = DrugProduction(
        drug_code="DRUG-FEFO-03",
        brand_name="Berberin",
        generic_name="Berberin",
        dosage_form="Viên nang",
        strength="100mg",
        route_of_administration="Uống",
        unit_of_measure="Viên",
        unit_selling_price=Decimal("1000.00"),
        is_active=True,
    )
    db_session.add(drug)
    await db_session.commit()

    expired_request = DrugBatchCreateRequest(
        drug_id=drug.id,
        batch_number="EXPIRED-BATCH",
        expiry_date=date.today() - timedelta(days=1),
        physical_stock=100,
        import_price=Decimal("800.00"),
    )

    with pytest.raises(BadRequestException) as exc_info:
        await production_pharmacy_service.import_drug_batch(
            payload=expired_request,
            db=db_session,
        )

    assert "Hạn dùng" in str(exc_info.value)
