# E2E Test Infra: Clinic-AI Compliance Management Layer

## Test Philosophy
- Opaque-box, requirement-driven derived from `ORIGINAL_REQUEST.md` (INT-03, INT-04, INT-05, R1-R5).
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workload Testing.
- 100% pass criterion across all test suites.

## Feature Inventory & Test Mapping
| # | Feature | Source (Requirement) | Tier 1 (Coverage) | Tier 2 (Boundary & Error) | Tier 3 (Cross-Feature) |
|---|---------|----------------------|:-----------------:|:-------------------------:|:----------------------:|
| 1 | Doctor Credentialing & License Lifecycle | INT-05 / R2 | ≥5 cases | ≥5 cases | ✓ |
| 2 | Automated Credentialing & Scope Enforcement | INT-05 / R2 | ≥5 cases | ≥5 cases | ✓ |
| 3 | Prescription FSM Transitions | INT-04 / R3 | ≥5 cases | ≥5 cases | ✓ |
| 4 | Prescription Signing Immutability & Superseding | INT-04 / R3 | ≥5 cases | ≥5 cases | ✓ |
| 5 | National Gateway (Idempotency, Timeout, Receipt) | INT-04 / R3 | ≥5 cases | ≥5 cases | ✓ |
| 6 | Health Data Access Audit Trail | INT-03 / R4 | ≥5 cases | ≥5 cases | ✓ |
| 7 | EMR Amendment Protocol (BienBanDinhChinh) | INT-03 / R4 | ≥5 cases | ≥5 cases | ✓ |
| 8 | Compliance Monitoring Dashboard & Reporting | R5 | ≥5 cases | ≥5 cases | ✓ |

## Test Architecture
- Framework: `pytest` with `pytest-asyncio`, `httpx.AsyncClient` via `tests/conftest.py`.
- Mocking: Mock/Stub adapter for National Gateway to test timeout (HTTP 504), network errors, receipt verification, duplicate retry idempotency.
- In-memory / savepoint isolation: Each test runs inside rollback transaction or isolated database session.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Expired doctor blocked from booking and encounter | F1, F2 | Medium |
| 2 | Doctor attempts out-of-scope lab test order | F2, F7 | Medium |
| 3 | Full prescription lifecycle: Draft -> Validate -> Sign -> Lock items -> Gateway submission -> Accepted | F3, F4, F5, F6 | High |
| 4 | Gateway timeout -> UNKNOWN_RESULT -> Retry with same Idempotency Key -> Receipt validated -> Accepted | F3, F5, F6 | High |
| 5 | Post-sign modification attempt blocked -> Supersede with replacement prescription | F4, F3, F6 | High |
| 6 | Comprehensive patient record view/export triggers immutable access logs | F6, F7 | Medium |
| 7 | Medical Director compliance dashboard inspection & statutory export | F1, F5, F8 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 boundary & negative cases per feature (403/409/422/504 errors)
- Tier 3: Pairwise combinations across doctor status, prescription FSM, and audit logging
- Tier 4: ≥5 realistic clinical compliance workflows
- Total target: Comprehensive test suite with 100% pass rate.
