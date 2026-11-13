# Database table cleanup reconciliation

Read-only source review of Alembic revisions 001–018 and current ORM/runtime references. This records code-defined DDL only; no production database was queried, so it does not assert the deployed schema or row counts.

## Removal candidates and holds

Only `chi_dinh_dich_vu` and `lich_su_ai` are static code-level removal candidates: revision 001 creates them (`backend/alembic/versions/001_initial_schema.py:299–309,333–343`), while the current `backend/app` ORM/runtime has no references to those table names. This is not approval to drop them. Before any removal, perform a read-only deployed row-count and retention review, confirm dependencies, and verify a restorable backup; `lich_su_ai` contains symptom input and analysis (`001:334–342`), and `chi_dinh_dich_vu` contains service-order/result data (`001:300–308`).

Reject the four legacy package-table removal proposals (`goi_dich_vu`, `chi_tiet_goi_dich_vu`, `dang_ky_goi_kham`, `chi_tiet_dang_ky_goi_kham`) for now. Revisions 005 and 006 created these tables and their FKs (`005:96–150`; `006:130–155`), including `fk_chi_dinh_goi_da_mua`, `fk_hoa_don_dang_ky_goi`, and `fk_ct_hoa_don_goi_da_mua` (`006:151–155,181–195`). Revision 011 creates parallel active tables `goi_kham`, `chi_tiet_goi_kham`, `goi_kham_da_mua`, and `chi_tiet_goi_kham_da_mua` (`011:197–273`); that DDL does not copy legacy rows. Current model aliases map package concepts to those new table names (`backend/app/models/specialized.py:6–8,23–30,46–52,80–88`). No later migration in 001–018 repairs the missing data transfer or removes the 006 legacy dependencies. Do not drop the legacy family until data reconciliation and FK migration are explicitly designed and rehearsed.

## Schema and deploy findings

The seven claimed missing core tables are created by revision 018: `users` (`backend/alembic/versions/018_production_3nf_schema_and_clean_bff.py:19–40`), `patients` (`42–68`), `doctor_slots` (`84–96`), `appointments` (`98–119`), `encounters` (`121–150`), `clinical_vitals` (`152–177`), and `diagnoses_icd10` (`179–188`). The claim that Alembic has no creation DDL for these tables is false when revision 018 is included.

Application startup now checks connectivity with `SELECT 1` and does not call `create_all` (`backend/app/main.py:24–29`). The compose command starts Uvicorn directly (`backend/docker-compose.yml:50`); the separate runner performs the Alembic upgrade (`backend/scripts/run_migrations.py:180–183,213–246,311–339`). Therefore migrations must be run through that runner before a fresh deployment; otherwise startup may connect successfully while schema-dependent requests fail. This is a deployment-path requirement, not a claim about any currently deployed database.

`cau_hoi_y_khoa` is a separate stale-model mismatch: revision 008 drops it (`backend/alembic/versions/008_drop_kham_doan_and_qa.py:25–30`), but the ORM class still declares it (`backend/app/models/content.py:23–29`).

## Safe staged review before any drop

1. On the deployed database, use a read-only role/transaction to count rows in the two code-level candidates and all four legacy package tables; inspect FK dependencies from the catalog and compare legacy package/registration/detail rows and IDs with their `goi_kham*` counterparts. Record counts and reconciliation results without selecting patient symptom or result payloads.
2. Have the data owner decide retention/export requirements, especially for clinical service orders and AI triage history. Take a database backup, then verify restoreability in an isolated environment before authorizing DDL.
3. Rehearse any approved migration/drop only against that restored copy: migrate dependent FKs and preserve or explicitly retire required rows, run referential-integrity and row-count checks, and verify application behavior. Proceed in production only after review of the rehearsal and backup; this reconciliation itself authorizes no DDL.
