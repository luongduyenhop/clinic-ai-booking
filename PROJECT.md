# Project: Clinic-AI Compliance Management Layer (INT-03, INT-04, INT-05, R1-R5)

## Architecture
The Compliance Management Layer integrates legal and healthcare regulatory safeguards into the existing `clinic-ai/backend` FastAPI application.

```
+---------------------------------------------------------------------------------------+
|                                    API ROUTERS                                        |
|  /admin/licenses        /clinical/prescriptions/fsm       /clinical/audit-logs        |
|  /admin/compliance      /clinical/encounters (enforced)   /admin/dashboard-stats      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                   SERVICE LAYER                                       |
|  CredentialService        PrescriptionFSMService           AuditTrailService          |
|  - License lifecycle      - 11-state FSM                   - Append-only access logs  |
|  - Scope enforcement      - Signing immutability           - Read/export audit hooks  |
|  - 90/60/30d alerts       - Superseding protocol           - ND 102/2025/ND-CP compliance
|                                  |                                                    |
|                           NationalGatewayService           ComplianceReportService    |
|                           - Idempotency key                - Aggregated metrics       |
|                           - Timeout -> UNKNOWN_RESULT      - Statutory audit export   |
|                           - Transaction Receipt check                                 |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                DATABASE & MODELS                                      |
|  bac_si (extended)        don_thuoc (extended FSM)         nhat_ky_truy_cap_y_te      |
|  giay_phep_co_so          chi_tiet_don_thuoc               bien_ban_dinh_chinh        |
|  lich_su_giay_phep_bac_si luot_kham (locked immutability)                             |
+---------------------------------------------------------------------------------------+
```

## Feature Inventory
Every feature from the Survey phase and `ORIGINAL_REQUEST.md` is assigned to a milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Database Models & Schema Extensions | Extended `BacSi` & license models, `DonThuoc` FSM fields, `NhatKyTruyCapDuLieuYTe` table | M1, M2, M3 | Survey / R1-R4 |
| 2 | License Lifecycle Management (INT-05) | Facility & Doctor licenses CRUD, status transitions (`ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `SUSPENDED`, `REVOKED`), 90/60/30-day alerts, history audit trail | M1 | INT-05 / R2 |
| 3 | Credentialing Enforcement & Blocking (INT-05) | Automated 403/409 guards preventing bookings (`create_booking`), encounters (`start_encounter`), and shifts (`create_shift`) for expired/suspended doctors; scope of practice validation in `add_order` | M1 | INT-05 / R2 |
| 4 | Prescription Compliance FSM (INT-04) | Full lifecycle state machine (`DRAFT` -> `VALIDATED` -> `SIGNED` -> `ISSUED` -> `SUBMISSION_PENDING` -> `SUBMITTED` -> `ACCEPTED` / `REJECTED` / `RETRY_PENDING` / `MANUAL_REVIEW`) | M2 | INT-04 / R3 |
| 5 | Prescription Immutability & Superseding (INT-04) | Strict immutability preventing item/dosage edits post-signature; `/supersede` workflow linking old prescription to new replacement | M2 | INT-04 / R3 |
| 6 | National Prescription Gateway Service (INT-04) | Integration service with facility/doctor validation, Idempotency-Key support, timeout handling to `UNKNOWN_RESULT`, and strict Transaction Receipt verification | M2 | INT-04 / R3 |
| 7 | Health Data Access Audit Trail (INT-03) | Immutable `NhatKyTruyCapDuLieuYTe` capturing user ID, role, patient ID, action (`VIEW`, `EDIT`, `EXPORT`), purpose, timestamp, and IP on encounters, prescriptions, histories | M3 | INT-03 / R4 |
| 8 | EMR Amendment Protocol (BienBanDinhChinh) | Preserving locked encounter immutability while maintaining Four-Eyes amendment history and audit trail under NĐ 102/2025/NĐ-CP | M3 | INT-03 / R4 |
| 9 | Compliance Monitoring Dashboard & Reporting (R5) | Dedicated endpoints for Medical Director / Admin tracking expiring licenses, gateway retry queue, EMR completion rate, and statutory compliance export | M4 | R5 |
| 10| Dual Track E2E Test Suite Verification | Comprehensive pytest test suite (100% pass) verifying happy path, 403/409 blocks, gateway timeout, retry idempotency, immutability, amendment, access audit | M5 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Doctor Credentialing & License Lifecycle (INT-05) | Models (`GiayPhepCoSo`, `LichSuGiayPhepBacSi`, `BacSi` extended), Schemas, `credential_service.py`, 403/409 guards on booking/encounter/order, router endpoints | none | DONE |
| M2 | Prescription Compliance FSM & National Gateway (INT-04) | Models (`DonThuoc` FSM & Gateway fields), Schemas, `prescription_fsm_service.py`, `national_gateway_service.py`, signing immutability, superseding logic | M1 | DONE |
| M3 | EMR Access Audit Trail & Immutability (INT-03) | Models (`NhatKyTruyCapDuLieuYTe`), Schemas, `audit_trail_service.py`, read/view/export interceptors, Four-Eyes amendment protocol | M1 | DONE |
| M4 | Compliance Monitoring Dashboard & Reporting (R5) | Schemas, `compliance_service.py`, dashboard stats API, statutory report export endpoint | M1, M2, M3 | DONE |
| M5 | Final Verification & Dual Track E2E Test Suite | Full pytest test suite (happy path, 403/409, timeout, retry, immutability, license enforcement - 100% pass) | M1, M2, M3, M4 | DONE |

## Interface Contracts

### CredentialService ↔ AppointmentService / ClinicalService
- `CredentialService.validate_doctor_active(db: AsyncSession, doctor_id: int) -> BacSi`
  - Raises `HTTPException(403, "Doctor license is EXPIRED or SUSPENDED")` if license invalid.
- `CredentialService.validate_doctor_scope(db: AsyncSession, doctor_id: int, service_id: int) -> bool`
  - Raises `HTTPException(409, "Service specialty outside doctor licensed scope of practice")` if not authorized.

### PrescriptionFSMService ↔ NationalGatewayService
- `PrescriptionFSMService.sign_prescription(db, prescription_id, doctor_user, signature_data) -> DonThuoc`
  - Transitions `VALIDATED` -> `SIGNED`. Locks items against modifications.
- `NationalGatewayService.submit_prescription(prescription: DonThuoc, idempotency_key: str) -> GatewaySubmissionResult`
  - Returns `GatewaySubmissionResult(status='ACCEPTED', transaction_receipt='...', code=200)`
  - On timeout: returns `GatewaySubmissionResult(status='UNKNOWN_RESULT', code=504)`
  - On duplicate retry: returns same cached receipt via `idempotency_key`.

### AuditTrailService ↔ Clinical Routers
- `AuditTrailService.log_access(db, user_id: int, user_role: str, patient_id: int, action: str, resource_type: str, resource_id: int, purpose: str, client_ip: str)`
  - Asynchronously inserts into `nhat_ky_truy_cap_y_te`. Append-only.

### ComplianceService ↔ Admin Routers
- `ComplianceService.get_compliance_dashboard(db) -> ComplianceDashboardResponse`
  - Returns expiring license buckets (90/60/30d), gateway retry/manual review counts, EMR locked completion rates.
- `ComplianceService.export_compliance_report(db, format: str) -> str / bytes`
  - Produces statutory compliance report.

## Code Layout
```
clinic-ai/backend/
├── app/
│   ├── models/
│   │   ├── base.py
│   │   ├── user.py                  # BacSi extended (license fields)
│   │   ├── compliance.py            # NEW: GiayPhepCoSo, LichSuGiayPhepBacSi, NhatKyTruyCapDuLieuYTe
│   │   ├── medical.py               # DonThuoc extended (trang_thai, receipt, signature, superseded)
│   │   └── __init__.py              # Export all models for Base.metadata
│   ├── schemas/
│   │   ├── compliance.py            # NEW: License schemas, AccessLog schemas, Dashboard schemas
│   │   ├── clinical.py              # Extended: Prescription FSM requests & responses
│   │   └── admin.py                 # Extended: Doctor license schemas
│   ├── services/
│   │   ├── credential_service.py    # NEW: License lifecycle & enforcement guards
│   │   ├── prescription_fsm_service.py # NEW: 11-state FSM & immutability
│   │   ├── national_gateway_service.py # NEW: Gateway client, idempotency, timeout, receipts
│   │   ├── audit_trail_service.py   # NEW: Health data access logger
│   │   ├── compliance_service.py    # NEW: Dashboard metrics & compliance exports
│   │   ├── appointment_service.py   # Integrated: license checks on booking
│   │   └── clinical_service.py      # Integrated: license/scope checks on encounter & orders
│   └── routers/
│       ├── compliance.py            # NEW: License APIs, Compliance dashboard, Audit logs
│       ├── clinical.py              # Extended: FSM transition endpoints (/sign, /issue, /gateway)
│       └── api_v1.py                # Mount compliance router
└── tests/
    ├── test_compliance_credentialing.py   # NEW: M2 license tests (expired, suspended, 403/409, scope)
    ├── test_compliance_prescription_fsm.py # NEW: M3 FSM, immutability, gateway timeout, retry
    ├── test_compliance_audit_trail.py     # NEW: M4 access audit logging & amendment tests
    ├── test_compliance_dashboard.py       # NEW: M5 compliance stats & report export
    └── test_compliance_e2e_full.py        # NEW: M6 comprehensive E2E integration test
```
