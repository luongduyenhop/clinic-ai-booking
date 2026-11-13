<!--
Sync Impact Report:
- Version Change: Initial Scaffold -> 1.0.0
- Ratification Date: 2026-11-10
- Added Principles:
  1. I. Clinical Immutability & Audit Trail (NON-NEGOTIABLE)
  2. II. Deterministic State Machines & Invariant Enforcement
  3. III. Strict Clean Code & Zero Inline Comments
  4. IV. Role-Based Segregation & Credential Guarding
  5. V. Specification-Driven & Test-First Verification
- Added Sections:
  - Technical Architecture & Standards
  - Quality Gates & Engineering Workflow
- Governance Rules: Established amendment protocols, semver versioning, and compliance reviews.
- Deferred Items / TODOs: None
-->

# Clinic-AI Constitution

## Core Principles

### I. Clinical Immutability & Audit Trail (NON-NEGOTIABLE)
Finalized electronic medical records (EMR), signed prescriptions, and billing receipts MUST be strictly immutable. Direct updates and deletions to signed or completed clinical data are strictly forbidden. Any correction MUST be executed through a formal Four-Eyes amendment protocol (BienBanDinhChinh) that preserves prior revisions. All read, update, and export access to patient records MUST be recorded asynchronously in an append-only audit trail (NhatKyTruyCapDuLieuYTe) in compliance with NĐ 102/2025/NĐ-CP.

### II. Deterministic State Machines & Invariant Enforcement
Core business lifecycles (Prescriptions, Medical Encounters, Paraclinical Lab Tests, Invoices, Shift Scheduling) MUST be implemented as explicit Finite State Machines (FSM). State transitions MUST be deterministic, validating business invariants (preconditions, postconditions, and resource invariants) before committing transitions. Invalid transitions MUST be rejected immediately with explicit domain error codes.

### III. Strict Clean Code & Zero Inline Comments
Source code across all modules (Python, Java, TypeScript, SQL, Bash/PowerShell) MUST communicate intent through clean architecture, high-cohesion functions, explicit typing, and precise naming conventions. Zero comments (`#`, `//`, `/* */`) and zero docstrings (`"""..."""`, `/** */`) are permitted within source code files. Code must be completely self-documenting.

### IV. Role-Based Segregation & Credential Guarding
Strict role separation (Patient, Receptionist, Doctor, Paraclinical Technician, Pharmacist, Cashier, Medical Director/Admin) MUST be enforced at both the API routing layer and service domain boundaries. Medical actions (encounters, diagnostic orders, prescription issuance) MUST verify the doctor's active license status and specialty scope of practice before execution. Expired or suspended licenses MUST immediately block clinical actions.

### V. Specification-Driven & Test-First Verification
All features MUST adhere to Specification-Driven Development (SDD): formal specification (`spec.md`), architectural planning (`plan.md`), task breakdown (`tasks.md`), and automated test suites prior to merge. Automated unit, integration, and end-to-end regression tests MUST maintain a 100% passing status across critical clinical workflows.

## Technical Architecture & Standards

- Backend Services: Python (FastAPI, SQLAlchemy 2.0 Async, Pydantic v2, Alembic) 
- Frontend Client: React / Next.js / TypeScript with Tailwind CSS, Radix UI, and Vite.
- Database: PostgreSQL with async connection pooling, schema migrations, and relational integrity.
- Integrations: VietQR payments, National Prescription Gateway integration with Idempotency-Key support and timeout resilience, TypeSafe AI / Jev for structured semantic classification.
- Concurrency & Transactions: Explicit transaction boundaries, row-level locking for shared resources (inventory, appointment slots), and race condition prevention.

## Quality Gates & Engineering Workflow

- CI/CD & Automated Verification: Linting, type checking, and automated pytest/JUnit suites MUST pass on all branches before merging.
- Code Review Standard: Every PR is reviewed for correctness, invariant preservation, edge case handling (nullability, concurrency, idempotency), maintainability, and absence of inline comments.
- Scope Discipline: Implementation work MUST strictly follow the approved tasks and specification. Unplanned modifications require formal specification updates.

## Governance

This Constitution represents the supreme operational and engineering authority for the Clinic-AI project, superseding all ad-hoc conventions. Amendments to this document require formal team review, justification, and a semantic version increment:
- MAJOR: Incompatible governance alterations, principle removals, or core invariant redefinitions.
- MINOR: Addition of new principles, sections, or materially expanded architectural guidance.
- PATCH: Wording refinements, grammatical corrections, and non-semantic clarifications.

All pull requests and architecture decision records (ADRs) MUST verify compliance with this Constitution.

**Version**: 1.0.0 | **Ratified**: 2026-11-10 | **Last Amended**: 2026-11-10
