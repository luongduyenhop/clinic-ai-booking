from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.models.base import Base


class UserProduction(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False, index=True)
    license_id = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint(
            "role IN ('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'CASHIER', 'PHARMACIST', 'LAB_TECH')",
            name="chk_users_role",
        ),
    )


class PatientProduction(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_code = Column(String(20), nullable=False, unique=True, index=True)
    cccd_number = Column(String(12), unique=True, nullable=True, index=True)
    full_name = Column(String(255), nullable=False, index=True)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(10), nullable=False)
    phone_number = Column(String(20), nullable=False, index=True)
    address = Column(Text, nullable=False)
    province_code = Column(String(10), nullable=True)
    district_code = Column(String(10), nullable=True)
    ward_code = Column(String(10), nullable=True)
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint(
            "gender IN ('MALE', 'FEMALE', 'OTHER')",
            name="chk_patients_gender",
        ),
    )


class PatientAllergyProduction(Base):
    __tablename__ = "patient_allergies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    active_ingredient_name = Column(String(255), nullable=False, index=True)
    allergy_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    reaction_description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    patient = relationship("PatientProduction")

    __table_args__ = (
        CheckConstraint(
            "allergy_type IN ('DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER')",
            name="chk_allergies_type",
        ),
        CheckConstraint(
            "severity IN ('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING')",
            name="chk_allergies_severity",
        ),
    )


class DoctorSlotProduction(Base):
    __tablename__ = "doctor_slots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    slot_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_available = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    doctor = relationship("UserProduction")

    __table_args__ = (
        UniqueConstraint("doctor_id", "slot_date", "start_time", name="uq_doctor_slot"),
        Index("idx_slots_doctor_date", "doctor_id", "slot_date"),
    )


class AppointmentProduction(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    appointment_code = Column(String(20), nullable=False, unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    slot_id = Column(Integer, ForeignKey("doctor_slots.id", ondelete="RESTRICT"), unique=True, nullable=True)
    appointment_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    status = Column(String(20), nullable=False)
    reason_for_visit = Column(Text, nullable=True)
    is_emergency = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    patient = relationship("PatientProduction")
    doctor = relationship("UserProduction")
    slot = relationship("DoctorSlotProduction")

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW')",
            name="chk_appointments_status",
        ),
        Index("idx_appointments_doctor_date", "doctor_id", "appointment_date"),
    )


class EncounterProduction(Base):
    __tablename__ = "encounters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_code = Column(String(20), nullable=False, unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    queue_number = Column(Integer, nullable=False)
    clinic_room_number = Column(String(20), nullable=False)
    status = Column(String(30), nullable=False, index=True)
    chief_complaint = Column(Text, nullable=False)
    medical_history = Column(Text, nullable=True)
    physical_examination = Column(Text, nullable=True)
    treatment_plan = Column(Text, nullable=True)
    doctor_notes = Column(Text, nullable=True)
    is_locked = Column(Boolean, nullable=False, default=False)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    patient = relationship("PatientProduction")
    doctor = relationship("UserProduction")
    appointment = relationship("AppointmentProduction")

    __table_args__ = (
        CheckConstraint(
            "status IN ('WAITING_FOR_EXAMINATION', 'IN_CONSULTATION', 'AWAITING_PARACLINICAL', 'AWAITING_PAYMENT', 'AWAITING_DISPENSING', 'COMPLETED_LOCKED', 'CANCELLED')",
            name="chk_encounters_status",
        ),
    )


class ClinicalVitalProduction(Base):
    __tablename__ = "clinical_vitals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False, index=True)
    systolic_bp = Column(Numeric(5, 2), nullable=False)
    diastolic_bp = Column(Numeric(5, 2), nullable=False)
    heart_rate = Column(Numeric(5, 2), nullable=False)
    body_temperature = Column(Numeric(4, 2), nullable=False)
    respiratory_rate = Column(Numeric(4, 2), nullable=True)
    spo2_percentage = Column(Numeric(5, 2), nullable=True)
    height_cm = Column(Numeric(5, 2), nullable=True)
    weight_kg = Column(Numeric(5, 2), nullable=True)
    bmi = Column(Numeric(4, 2), nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    encounter = relationship("EncounterProduction")
    recorder = relationship("UserProduction")

    __table_args__ = (
        CheckConstraint("systolic_bp BETWEEN 40 AND 260", name="chk_vitals_systolic_bp"),
        CheckConstraint("diastolic_bp BETWEEN 30 AND 180", name="chk_vitals_diastolic_bp"),
        CheckConstraint("heart_rate BETWEEN 30 AND 250", name="chk_vitals_heart_rate"),
        CheckConstraint("body_temperature BETWEEN 33.0 AND 44.0", name="chk_vitals_body_temp"),
        CheckConstraint("respiratory_rate BETWEEN 8 AND 60", name="chk_vitals_respiratory"),
        CheckConstraint("spo2_percentage BETWEEN 50 AND 100", name="chk_vitals_spo2"),
        CheckConstraint("height_cm BETWEEN 20 AND 250", name="chk_vitals_height"),
        CheckConstraint("weight_kg BETWEEN 1 AND 300", name="chk_vitals_weight"),
    )


class DiagnosisICD10Production(Base):
    __tablename__ = "diagnoses_icd10"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(10), nullable=False, unique=True, index=True)
    chapter_code = Column(String(5), nullable=False)
    name_vi = Column(String(500), nullable=False)
    name_en = Column(String(500), nullable=True)
    is_common = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)


class EncounterDiagnosisProduction(Base):
    __tablename__ = "encounter_diagnoses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False, index=True)
    icd10_code = Column(String(10), ForeignKey("diagnoses_icd10.code", ondelete="RESTRICT"), nullable=False, index=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    clinical_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    encounter = relationship("EncounterProduction")
    diagnosis = relationship("DiagnosisICD10Production")


class ServiceProduction(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, autoincrement=True)
    service_code = Column(String(50), nullable=False, unique=True, index=True)
    service_name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    department = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint(
            "category IN ('EXAMINATION', 'LABORATORY', 'IMAGING', 'PROCEDURE')",
            name="chk_services_category",
        ),
        CheckConstraint("unit_price >= 0", name="chk_services_unit_price"),
    )


class ParaclinicalOrderProduction(Base):
    __tablename__ = "paraclinical_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_code = Column(String(20), nullable=False, unique=True, index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="RESTRICT"), nullable=False)
    ordered_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(30), nullable=False, index=True)
    barcode_id = Column(String(50), unique=True, nullable=True)
    clinical_indication = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    encounter = relationship("EncounterProduction")
    service = relationship("ServiceProduction")
    doctor = relationship("UserProduction")

    __table_args__ = (
        CheckConstraint(
            "status IN ('ORDERED', 'PAID', 'SAMPLE_COLLECTED', 'PROCESSING', 'RESULT_ENTERED', 'COMPLETED_VERIFIED', 'CANCELLED')",
            name="chk_cls_orders_status",
        ),
    )


class ParaclinicalResultProduction(Base):
    __tablename__ = "paraclinical_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("paraclinical_orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    parameter_code = Column(String(50), nullable=False)
    parameter_name = Column(String(255), nullable=False)
    measured_value = Column(String(100), nullable=False)
    numeric_value = Column(Numeric(12, 4), nullable=True)
    measurement_unit = Column(String(50), nullable=True)
    reference_low = Column(Numeric(12, 4), nullable=True)
    reference_high = Column(Numeric(12, 4), nullable=True)
    is_abnormal = Column(Boolean, nullable=False, default=False)
    is_panic_value = Column(Boolean, nullable=False, default=False)
    conclusion = Column(Text, nullable=True)
    image_attachment_url = Column(Text, nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    order = relationship("ParaclinicalOrderProduction")
    technician = relationship("UserProduction", foreign_keys=[performed_by])
    verifier = relationship("UserProduction", foreign_keys=[verified_by])


class DrugProduction(Base):
    __tablename__ = "drugs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    drug_code = Column(String(50), nullable=False, unique=True, index=True)
    national_drug_code = Column(String(50), nullable=True, index=True)
    brand_name = Column(String(255), nullable=False)
    generic_name = Column(String(255), nullable=False)
    dosage_form = Column(String(50), nullable=False)
    strength = Column(String(100), nullable=False)
    route_of_administration = Column(String(50), nullable=False)
    unit_of_measure = Column(String(20), nullable=False)
    unit_selling_price = Column(Numeric(12, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("unit_selling_price >= 0", name="chk_drugs_selling_price"),
    )


class DrugBatchProduction(Base):
    __tablename__ = "drug_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    drug_id = Column(Integer, ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False)
    batch_number = Column(String(50), nullable=False)
    expiry_date = Column(Date, nullable=False)
    physical_stock = Column(Integer, nullable=False)
    held_stock = Column(Integer, nullable=False, default=0)
    import_price = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    drug = relationship("DrugProduction")

    __table_args__ = (
        CheckConstraint("physical_stock >= 0", name="chk_drug_batch_physical_stock"),
        CheckConstraint("held_stock >= 0", name="chk_drug_batch_held_stock"),
        CheckConstraint("held_stock <= physical_stock", name="chk_held_stock_limit"),
        CheckConstraint("import_price >= 0", name="chk_drug_batch_import_price"),
        UniqueConstraint("drug_id", "batch_number", name="uq_drug_batch"),
        Index("idx_drug_batches_fefo", "drug_id", "expiry_date"),
    )


class PrescriptionProduction(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_code = Column(String(20), nullable=False, unique=True, index=True)
    national_prescription_code = Column(String(14), unique=True, nullable=True, index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(20), nullable=False)
    sync_status = Column(String(20), nullable=False, default="PENDING_SYNC")
    national_portal_message_id = Column(String(100), nullable=True)
    qr_lookup_url = Column(Text, nullable=True)
    doctor_advice = Column(Text, nullable=True)
    follow_up_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    encounter = relationship("EncounterProduction")
    doctor = relationship("UserProduction")

    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT', 'PRESCRIBED', 'SYNCED_PORTAL', 'DISPENSED', 'CANCELLED')",
            name="chk_prescriptions_status",
        ),
        CheckConstraint(
            "sync_status IN ('PENDING_SYNC', 'SYNCED', 'FAILED')",
            name="chk_prescriptions_sync_status",
        ),
    )


class PrescriptionItemProduction(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id", ondelete="RESTRICT"), nullable=False, index=True)
    drug_id = Column(Integer, ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("drug_batches.id", ondelete="RESTRICT"), nullable=True)
    quantity_prescribed = Column(Integer, nullable=False)
    morning_dose = Column(String(20), nullable=True)
    noon_dose = Column(String(20), nullable=True)
    afternoon_dose = Column(String(20), nullable=True)
    night_dose = Column(String(20), nullable=True)
    usage_instructions = Column(Text, nullable=False)
    treatment_days = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    prescription = relationship("PrescriptionProduction")
    drug = relationship("DrugProduction")
    batch = relationship("DrugBatchProduction")

    __table_args__ = (
        CheckConstraint("quantity_prescribed > 0", name="chk_presc_items_qty"),
        CheckConstraint("treatment_days > 0", name="chk_presc_items_days"),
    )


class InvoiceProduction(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_code = Column(String(20), nullable=False, unique=True, index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    total_service_amount = Column(Numeric(12, 2), nullable=False, default=0)
    total_medication_amount = Column(Numeric(12, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0)
    final_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, index=True)
    payment_method = Column(String(20), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    e_invoice_lookup_code = Column(String(100), nullable=True)
    is_locked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    encounter = relationship("EncounterProduction")
    patient = relationship("PatientProduction")
    cashier = relationship("UserProduction")

    __table_args__ = (
        CheckConstraint("total_service_amount >= 0", name="chk_invoices_service_amount"),
        CheckConstraint("total_medication_amount >= 0", name="chk_invoices_med_amount"),
        CheckConstraint("discount_amount >= 0", name="chk_invoices_discount"),
        CheckConstraint("final_amount >= 0", name="chk_invoices_final_amount"),
        CheckConstraint(
            "status IN ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED')",
            name="chk_invoices_status",
        ),
        CheckConstraint(
            "payment_method IS NULL OR payment_method IN ('CASH', 'VIETQR', 'POS_CARD', 'BANK_TRANSFER')",
            name="chk_invoices_payment_method",
        ),
    )


class InvoiceItemProduction(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_type = Column(String(20), nullable=False)
    item_reference_id = Column(Integer, nullable=False)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    invoice = relationship("InvoiceProduction")

    __table_args__ = (
        CheckConstraint("item_type IN ('SERVICE', 'MEDICATION')", name="chk_inv_items_type"),
        CheckConstraint("quantity > 0", name="chk_inv_items_qty"),
        CheckConstraint("unit_price >= 0", name="chk_inv_items_unit_price"),
        CheckConstraint("total_price >= 0", name="chk_inv_items_total_price"),
    )


class PaymentTransactionProduction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    transaction_code = Column(String(50), nullable=False, unique=True, index=True)
    gateway_provider = Column(String(50), nullable=False)
    bank_transaction_id = Column(String(100), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_status = Column(String(20), nullable=False)
    webhook_payload = Column(JSON, nullable=True)
    webhook_signature = Column(String(255), nullable=True)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    invoice = relationship("InvoiceProduction")

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_pay_trans_amount"),
        CheckConstraint(
            "payment_status IN ('INITIATED', 'SUCCESS', 'FAILED')",
            name="chk_pay_trans_status",
        ),
    )


class EmrSignedRecordProduction(Base):
    __tablename__ = "emr_signed_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False, index=True)
    document_type = Column(String(50), nullable=False)
    document_hash = Column(String(64), nullable=False, index=True)
    signature_container = Column(Text, nullable=False)
    signer_name = Column(String(255), nullable=False)
    signer_license_id = Column(String(50), nullable=False)
    certificate_serial = Column(String(100), nullable=False)
    signed_timestamp = Column(DateTime(timezone=True), nullable=False)
    pdf_storage_path = Column(String(500), nullable=False)
    is_tampered = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    encounter = relationship("EncounterProduction")

    __table_args__ = (
        CheckConstraint(
            "document_type IN ('OUTPATIENT_RECORD', 'PRESCRIPTION', 'LAB_REPORT')",
            name="chk_emr_signed_doc_type",
        ),
    )


class PhiAuditLog(Base):
    __tablename__ = "phi_audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String(20), nullable=False)
    entity_name = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=False)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("UserProduction")
    patient = relationship("PatientProduction")
    encounter = relationship("EncounterProduction")

    __table_args__ = (
        CheckConstraint(
            "action_type IN ('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'PRINT')",
            name="chk_phi_audit_action",
        ),
        Index("idx_phi_audit_patient", "patient_id", "created_at"),
        Index("idx_phi_audit_user", "user_id", "created_at"),
    )
