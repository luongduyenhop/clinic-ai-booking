from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "018_production_3nf_schema_and_clean_bff"
down_revision: Union[str, None] = "017_relax_unique_active_invoice_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "he_thong_trang_thai_bff" in existing_tables:
        op.drop_table("he_thong_trang_thai_bff")

    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("username", sa.String(50), nullable=False, unique=True),
            sa.Column("hashed_password", sa.String(255), nullable=False),
            sa.Column("full_name", sa.String(255), nullable=False),
            sa.Column("email", sa.String(100), nullable=True),
            sa.Column("phone_number", sa.String(20), nullable=True),
            sa.Column("role", sa.String(20), nullable=False),
            sa.Column("license_id", sa.String(50), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint(
                "role IN ('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'CASHIER', 'PHARMACIST', 'LAB_TECH')",
                name="chk_users_role",
            ),
        )
        op.create_index("idx_users_username", "users", ["username"])
        op.create_index("idx_users_role", "users", ["role"])

    if "patients" not in existing_tables:
        op.create_table(
            "patients",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("patient_code", sa.String(20), nullable=False, unique=True),
            sa.Column("cccd_number", sa.String(12), unique=True, nullable=True),
            sa.Column("full_name", sa.String(255), nullable=False),
            sa.Column("date_of_birth", sa.Date(), nullable=False),
            sa.Column("gender", sa.String(10), nullable=False),
            sa.Column("phone_number", sa.String(20), nullable=False),
            sa.Column("address", sa.Text(), nullable=False),
            sa.Column("province_code", sa.String(10), nullable=True),
            sa.Column("district_code", sa.String(10), nullable=True),
            sa.Column("ward_code", sa.String(10), nullable=True),
            sa.Column("emergency_contact_name", sa.String(255), nullable=True),
            sa.Column("emergency_contact_phone", sa.String(20), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("gender IN ('MALE', 'FEMALE', 'OTHER')", name="chk_patients_gender"),
        )
        op.create_index("idx_patients_code", "patients", ["patient_code"])
        op.create_index("idx_patients_cccd", "patients", ["cccd_number"])
        op.create_index("idx_patients_phone", "patients", ["phone_number"])
        op.create_index("idx_patients_name", "patients", ["full_name"])

    if "patient_allergies" not in existing_tables:
        op.create_table(
            "patient_allergies",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("active_ingredient_name", sa.String(255), nullable=False),
            sa.Column("allergy_type", sa.String(50), nullable=False),
            sa.Column("severity", sa.String(20), nullable=False),
            sa.Column("reaction_description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("allergy_type IN ('DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER')", name="chk_allergies_type"),
            sa.CheckConstraint("severity IN ('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING')", name="chk_allergies_severity"),
        )
        op.create_index("idx_allergies_patient", "patient_allergies", ["patient_id"])
        op.create_index("idx_allergies_ingredient", "patient_allergies", ["active_ingredient_name"])

    if "doctor_slots" not in existing_tables:
        op.create_table(
            "doctor_slots",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("slot_date", sa.Date(), nullable=False),
            sa.Column("start_time", sa.Time(), nullable=False),
            sa.Column("end_time", sa.Time(), nullable=False),
            sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("doctor_id", "slot_date", "start_time", name="uq_doctor_slot"),
        )
        op.create_index("idx_slots_doctor_date", "doctor_slots", ["doctor_id", "slot_date"])

    if "appointments" not in existing_tables:
        op.create_table(
            "appointments",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("appointment_code", sa.String(20), nullable=False, unique=True),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("slot_id", sa.Integer(), sa.ForeignKey("doctor_slots.id", ondelete="RESTRICT"), unique=True, nullable=True),
            sa.Column("appointment_date", sa.Date(), nullable=False),
            sa.Column("start_time", sa.Time(), nullable=False),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column("reason_for_visit", sa.Text(), nullable=True),
            sa.Column("is_emergency", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint(
                "status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW')",
                name="chk_appointments_status",
            ),
        )
        op.create_index("idx_appointments_patient", "appointments", ["patient_id"])
        op.create_index("idx_appointments_doctor_date", "appointments", ["doctor_id", "appointment_date"])

    if "encounters" not in existing_tables:
        op.create_table(
            "encounters",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("encounter_code", sa.String(20), nullable=False, unique=True),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
            sa.Column("queue_number", sa.Integer(), nullable=False),
            sa.Column("clinic_room_number", sa.String(20), nullable=False),
            sa.Column("status", sa.String(30), nullable=False),
            sa.Column("chief_complaint", sa.Text(), nullable=False),
            sa.Column("medical_history", sa.Text(), nullable=True),
            sa.Column("physical_examination", sa.Text(), nullable=True),
            sa.Column("treatment_plan", sa.Text(), nullable=True),
            sa.Column("doctor_notes", sa.Text(), nullable=True),
            sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint(
                "status IN ('WAITING_FOR_EXAMINATION', 'IN_CONSULTATION', 'AWAITING_PARACLINICAL', 'AWAITING_PAYMENT', 'AWAITING_DISPENSING', 'COMPLETED_LOCKED', 'CANCELLED')",
                name="chk_encounters_status",
            ),
        )
        op.create_index("idx_encounters_patient", "encounters", ["patient_id"])
        op.create_index("idx_encounters_doctor", "encounters", ["doctor_id"])
        op.create_index("idx_encounters_status", "encounters", ["status"])
        op.create_index("idx_encounters_created", "encounters", ["created_at"])

    if "clinical_vitals" not in existing_tables:
        op.create_table(
            "clinical_vitals",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("encounter_id", sa.Integer(), sa.ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("systolic_bp", sa.Numeric(5, 2), nullable=False),
            sa.Column("diastolic_bp", sa.Numeric(5, 2), nullable=False),
            sa.Column("heart_rate", sa.Numeric(5, 2), nullable=False),
            sa.Column("body_temperature", sa.Numeric(4, 2), nullable=False),
            sa.Column("respiratory_rate", sa.Numeric(4, 2), nullable=True),
            sa.Column("spo2_percentage", sa.Numeric(5, 2), nullable=True),
            sa.Column("height_cm", sa.Numeric(5, 2), nullable=True),
            sa.Column("weight_kg", sa.Numeric(5, 2), nullable=True),
            sa.Column("bmi", sa.Numeric(4, 2), nullable=True),
            sa.Column("recorded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("systolic_bp BETWEEN 40 AND 260", name="chk_vitals_systolic_bp"),
            sa.CheckConstraint("diastolic_bp BETWEEN 30 AND 180", name="chk_vitals_diastolic_bp"),
            sa.CheckConstraint("heart_rate BETWEEN 30 AND 250", name="chk_vitals_heart_rate"),
            sa.CheckConstraint("body_temperature BETWEEN 33.0 AND 44.0", name="chk_vitals_body_temp"),
            sa.CheckConstraint("respiratory_rate BETWEEN 8 AND 60", name="chk_vitals_respiratory"),
            sa.CheckConstraint("spo2_percentage BETWEEN 50 AND 100", name="chk_vitals_spo2"),
            sa.CheckConstraint("height_cm BETWEEN 20 AND 250", name="chk_vitals_height"),
            sa.CheckConstraint("weight_kg BETWEEN 1 AND 300", name="chk_vitals_weight"),
        )
        op.create_index("idx_vitals_encounter", "clinical_vitals", ["encounter_id"])

    if "diagnoses_icd10" not in existing_tables:
        op.create_table(
            "diagnoses_icd10",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("code", sa.String(10), nullable=False, unique=True),
            sa.Column("chapter_code", sa.String(5), nullable=False),
            sa.Column("name_vi", sa.String(500), nullable=False),
            sa.Column("name_en", sa.String(500), nullable=True),
            sa.Column("is_common", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )
        op.create_index("idx_icd10_code", "diagnoses_icd10", ["code"])

    if "encounter_diagnoses" not in existing_tables:
        op.create_table(
            "encounter_diagnoses",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("encounter_id", sa.Integer(), sa.ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("icd10_code", sa.String(10), sa.ForeignKey("diagnoses_icd10.code", ondelete="RESTRICT"), nullable=False),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("clinical_notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("idx_enc_diag_encounter", "encounter_diagnoses", ["encounter_id"])
        op.create_index("idx_enc_diag_icd10", "encounter_diagnoses", ["icd10_code"])

    if "services" not in existing_tables:
        op.create_table(
            "services",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("service_code", sa.String(50), nullable=False, unique=True),
            sa.Column("service_name", sa.String(255), nullable=False),
            sa.Column("category", sa.String(50), nullable=False),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
            sa.Column("department", sa.String(100), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.CheckConstraint(
                "category IN ('EXAMINATION', 'LABORATORY', 'IMAGING', 'PROCEDURE')",
                name="chk_services_category",
            ),
            sa.CheckConstraint("unit_price >= 0", name="chk_services_unit_price"),
        )

    if "paraclinical_orders" not in existing_tables:
        op.create_table(
            "paraclinical_orders",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("order_code", sa.String(20), nullable=False, unique=True),
            sa.Column("encounter_id", sa.Integer(), sa.ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("service_id", sa.Integer(), sa.ForeignKey("services.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("ordered_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("status", sa.String(30), nullable=False),
            sa.Column("barcode_id", sa.String(50), unique=True, nullable=True),
            sa.Column("clinical_indication", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint(
                "status IN ('ORDERED', 'PAID', 'SAMPLE_COLLECTED', 'PROCESSING', 'RESULT_ENTERED', 'COMPLETED_VERIFIED', 'CANCELLED')",
                name="chk_cls_orders_status",
            ),
        )
        op.create_index("idx_cls_orders_encounter", "paraclinical_orders", ["encounter_id"])
        op.create_index("idx_cls_orders_status", "paraclinical_orders", ["status"])

    if "paraclinical_results" not in existing_tables:
        op.create_table(
            "paraclinical_results",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("paraclinical_orders.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("parameter_code", sa.String(50), nullable=False),
            sa.Column("parameter_name", sa.String(255), nullable=False),
            sa.Column("measured_value", sa.String(100), nullable=False),
            sa.Column("numeric_value", sa.Numeric(12, 4), nullable=True),
            sa.Column("measurement_unit", sa.String(50), nullable=True),
            sa.Column("reference_low", sa.Numeric(12, 4), nullable=True),
            sa.Column("reference_high", sa.Numeric(12, 4), nullable=True),
            sa.Column("is_abnormal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_panic_value", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("conclusion", sa.Text(), nullable=True),
            sa.Column("image_attachment_url", sa.Text(), nullable=True),
            sa.Column("performed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("verified_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("idx_cls_results_order", "paraclinical_results", ["order_id"])

    if "drugs" not in existing_tables:
        op.create_table(
            "drugs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("drug_code", sa.String(50), nullable=False, unique=True),
            sa.Column("national_drug_code", sa.String(50), nullable=True),
            sa.Column("brand_name", sa.String(255), nullable=False),
            sa.Column("generic_name", sa.String(255), nullable=False),
            sa.Column("dosage_form", sa.String(50), nullable=False),
            sa.Column("strength", sa.String(100), nullable=False),
            sa.Column("route_of_administration", sa.String(50), nullable=False),
            sa.Column("unit_of_measure", sa.String(20), nullable=False),
            sa.Column("unit_selling_price", sa.Numeric(12, 2), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.CheckConstraint("unit_selling_price >= 0", name="chk_drugs_selling_price"),
        )
        op.create_index("idx_drugs_code", "drugs", ["drug_code"])
        op.create_index("idx_drugs_national_code", "drugs", ["national_drug_code"])

    if "drug_batches" not in existing_tables:
        op.create_table(
            "drug_batches",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("drug_id", sa.Integer(), sa.ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("batch_number", sa.String(50), nullable=False),
            sa.Column("expiry_date", sa.Date(), nullable=False),
            sa.Column("physical_stock", sa.Integer(), nullable=False),
            sa.Column("held_stock", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("import_price", sa.Numeric(12, 2), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("physical_stock >= 0", name="chk_drug_batch_physical_stock"),
            sa.CheckConstraint("held_stock >= 0", name="chk_drug_batch_held_stock"),
            sa.CheckConstraint("held_stock <= physical_stock", name="chk_held_stock_limit"),
            sa.CheckConstraint("import_price >= 0", name="chk_drug_batch_import_price"),
            sa.UniqueConstraint("drug_id", "batch_number", name="uq_drug_batch"),
        )
        op.create_index("idx_drug_batches_fefo", "drug_batches", ["drug_id", "expiry_date"])

    if "prescriptions" not in existing_tables:
        op.create_table(
            "prescriptions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("prescription_code", sa.String(20), nullable=False, unique=True),
            sa.Column("national_prescription_code", sa.String(14), unique=True, nullable=True),
            sa.Column("encounter_id", sa.Integer(), sa.ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column("sync_status", sa.String(20), nullable=False, server_default=sa.text("'PENDING_SYNC'")),
            sa.Column("national_portal_message_id", sa.String(100), nullable=True),
            sa.Column("qr_lookup_url", sa.Text(), nullable=True),
            sa.Column("doctor_advice", sa.Text(), nullable=True),
            sa.Column("follow_up_date", sa.Date(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint(
                "status IN ('DRAFT', 'PRESCRIBED', 'SYNCED_PORTAL', 'DISPENSED', 'CANCELLED')",
                name="chk_prescriptions_status",
            ),
            sa.CheckConstraint(
                "sync_status IN ('PENDING_SYNC', 'SYNCED', 'FAILED')",
                name="chk_prescriptions_sync_status",
            ),
        )
        op.create_index("idx_prescriptions_encounter", "prescriptions", ["encounter_id"])
        op.create_index("idx_prescriptions_national_code", "prescriptions", ["national_prescription_code"])

    if "prescription_items" not in existing_tables:
        op.create_table(
            "prescription_items",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("prescription_id", sa.Integer(), sa.ForeignKey("prescriptions.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("drug_id", sa.Integer(), sa.ForeignKey("drugs.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("batch_id", sa.Integer(), sa.ForeignKey("drug_batches.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("quantity_prescribed", sa.Integer(), nullable=False),
            sa.Column("morning_dose", sa.String(20), nullable=True),
            sa.Column("noon_dose", sa.String(20), nullable=True),
            sa.Column("afternoon_dose", sa.String(20), nullable=True),
            sa.Column("night_dose", sa.String(20), nullable=True),
            sa.Column("usage_instructions", sa.Text(), nullable=False),
            sa.Column("treatment_days", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("quantity_prescribed > 0", name="chk_presc_items_qty"),
            sa.CheckConstraint("treatment_days > 0", name="chk_presc_items_days"),
        )
        op.create_index("idx_presc_items_prescription", "prescription_items", ["prescription_id"])
        op.create_index("idx_presc_items_drug", "prescription_items", ["drug_id"])

    if "invoices" not in existing_tables:
        op.create_table(
            "invoices",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("invoice_code", sa.String(20), nullable=False, unique=True),
            sa.Column("encounter_id", sa.Integer(), sa.ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("cashier_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("total_service_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("total_medication_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("final_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column("payment_method", sa.String(20), nullable=True),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("e_invoice_lookup_code", sa.String(100), nullable=True),
            sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("total_service_amount >= 0", name="chk_invoices_service_amount"),
            sa.CheckConstraint("total_medication_amount >= 0", name="chk_invoices_med_amount"),
            sa.CheckConstraint("discount_amount >= 0", name="chk_invoices_discount"),
            sa.CheckConstraint("final_amount >= 0", name="chk_invoices_final_amount"),
            sa.CheckConstraint(
                "status IN ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED')",
                name="chk_invoices_status",
            ),
        )
        op.create_index("idx_invoices_encounter", "invoices", ["encounter_id"])
        op.create_index("idx_invoices_status", "invoices", ["status"])

    if "invoice_items" not in existing_tables:
        op.create_table(
            "invoice_items",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("item_type", sa.String(20), nullable=False),
            sa.Column("item_reference_id", sa.Integer(), nullable=False),
            sa.Column("item_name", sa.String(255), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_price", sa.Numeric(12, 2), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("item_type IN ('SERVICE', 'MEDICATION')", name="chk_inv_items_type"),
            sa.CheckConstraint("quantity > 0", name="chk_inv_items_qty"),
            sa.CheckConstraint("unit_price >= 0", name="chk_inv_items_unit_price"),
            sa.CheckConstraint("total_price >= 0", name="chk_inv_items_total_price"),
        )
        op.create_index("idx_invoice_items_invoice", "invoice_items", ["invoice_id"])

    if "payment_transactions" not in existing_tables:
        op.create_table(
            "payment_transactions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("transaction_code", sa.String(50), nullable=False, unique=True),
            sa.Column("gateway_provider", sa.String(50), nullable=False),
            sa.Column("bank_transaction_id", sa.String(100), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("payment_status", sa.String(20), nullable=False),
            sa.Column("webhook_payload", sa.JSON(), nullable=True),
            sa.Column("webhook_signature", sa.String(255), nullable=True),
            sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("amount > 0", name="chk_pay_trans_amount"),
            sa.CheckConstraint(
                "payment_status IN ('INITIATED', 'SUCCESS', 'FAILED')",
                name="chk_pay_trans_status",
            ),
        )
        op.create_index("idx_pay_trans_invoice", "payment_transactions", ["invoice_id"])
        op.create_index("idx_pay_trans_code", "payment_transactions", ["transaction_code"])

    if "emr_signed_records" not in existing_tables:
        op.create_table(
            "emr_signed_records",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("encounter_id", sa.Integer(), sa.ForeignKey("encounters.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("document_type", sa.String(50), nullable=False),
            sa.Column("document_hash", sa.String(64), nullable=False),
            sa.Column("signature_container", sa.Text(), nullable=False),
            sa.Column("signer_name", sa.String(255), nullable=False),
            sa.Column("signer_license_id", sa.String(50), nullable=False),
            sa.Column("certificate_serial", sa.String(100), nullable=False),
            sa.Column("signed_timestamp", sa.DateTime(timezone=True), nullable=False),
            sa.Column("pdf_storage_path", sa.String(500), nullable=False),
            sa.Column("is_tampered", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint(
                "document_type IN ('OUTPATIENT_RECORD', 'PRESCRIPTION', 'LAB_REPORT')",
                name="chk_emr_signed_doc_type",
            ),
        )
        op.create_index("idx_emr_signed_encounter", "emr_signed_records", ["encounter_id"])
        op.create_index("idx_emr_signed_hash", "emr_signed_records", ["document_hash"])

    if "phi_audit_logs" not in existing_tables:
        op.create_table(
            "phi_audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("encounter_id", sa.Integer(), sa.ForeignKey("encounters.id", ondelete="SET NULL"), nullable=True),
            sa.Column("action_type", sa.String(20), nullable=False),
            sa.Column("entity_name", sa.String(100), nullable=False),
            sa.Column("entity_id", sa.Integer(), nullable=False),
            sa.Column("ip_address", sa.String(45), nullable=False),
            sa.Column("user_agent", sa.String(500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint(
                "action_type IN ('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'PRINT')",
                name="chk_phi_audit_action",
            ),
        )
        op.create_index("idx_phi_audit_patient", "phi_audit_logs", ["patient_id", "created_at"])
        op.create_index("idx_phi_audit_user", "phi_audit_logs", ["user_id", "created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    tables_to_drop = [
        "phi_audit_logs",
        "emr_signed_records",
        "payment_transactions",
        "invoice_items",
        "invoices",
        "prescription_items",
        "prescriptions",
        "drug_batches",
        "drugs",
        "paraclinical_results",
        "paraclinical_orders",
        "services",
        "encounter_diagnoses",
        "diagnoses_icd10",
        "clinical_vitals",
        "encounters",
        "appointments",
        "doctor_slots",
        "patient_allergies",
        "patients",
        "users",
    ]

    for tbl in tables_to_drop:
        if tbl in existing_tables:
            op.drop_table(tbl)

    if "he_thong_trang_thai_bff" not in existing_tables:
        op.create_table(
            "he_thong_trang_thai_bff",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("collection_key", sa.String(100), nullable=False, unique=True),
            sa.Column("data_json", sa.JSON(), nullable=False),
            sa.Column("updated_by_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("idx_bff_collection_key", "he_thong_trang_thai_bff", ["collection_key"])
