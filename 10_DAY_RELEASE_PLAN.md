# MediCare+ 10-Day Release Plan

## Objective

Ship a small, verified release by **2026-10-30** that protects patient data, can be recovered, preserves billing integrity, and demonstrates the critical daily workflows end to end. Feature work is frozen unless it directly closes a release gate.

## Evidence-based baseline

- Angular 22 frontend and Express/Prisma backend are deployed as separate Vercel services behind same-origin rewrites.
- PostgreSQL is managed externally through Prisma Postgres.
- Authentication uses short-lived JWT access tokens, rotating database-backed refresh sessions, account lockout, password policy, and reset-token invalidation.
- Backend routes generally enforce permissions and sensitive workflows commonly write audit events.
- Patient, appointment, OPD, clinical, laboratory, radiology, admission, nursing, pharmacy, billing, insurance, reports, documents, and administration modules exist.
- Exact working-tree baseline executed on 2026-10-21: Angular production build passed; frontend Vitest passed (48 files, 141 tests); backend TypeScript build passed; backend Vitest passed (4 files, 22 tests).
- Production smoke baseline previously executed on 2026-10-21: Vercel root returned `<title>MediCare+</title>` and `/health` returned `200`.
- Browser and API E2E scripts exist but are not consolidated into a repeatable release command or CI workflow.

## Scope lock

### Must complete

1. Replace ephemeral upload storage for documents, profile images, and the hospital logo with one private durable-storage adapter, or disable those production write paths.
2. Establish managed PostgreSQL backup retention, write recovery instructions, and perform one isolated restore test.
3. Add a database-aware readiness endpoint while retaining a nonblocking liveness endpoint.
4. Harden billing payment recording against duplicate/concurrent requests and correct refund-aware balances/statuses.
5. Execute the critical API and browser workflows listed in `RELEASE_TEST_CHECKLIST.md` against isolated staging data.
6. Verify backend authorization and auditing for patient, clinical, file, inventory, admission, and financial actions.
7. Produce deployment, rollback, and known-limitations documentation.

### Should complete if must-complete work is green

1. Add an accurate receivables view using persisted invoice, payment, and approved-refund data.
2. Add appointment confirmation/cancellation email through the existing single provider abstraction, only if an approved SMTP or webhook configuration is available.
3. Add a minimal CI workflow for install, build, unit tests, migration validation, and secret-safe smoke checks.

### Explicitly deferred

- New patient portal or mobile application.
- Online booking, online payments, or new patient identity model.
- SMS/WhatsApp provider integration if no approved provider already exists.
- New clinical decision support or drug-interaction engine.
- Complex insurance workflows, tariff engine, or revenue-cycle platform.
- Multi-hospital tenancy, subscription billing, onboarding/import platform.
- Advanced executive analytics, profitability, or scheduled reports.

## External dependencies and decisions

- Private object storage account, bucket/container, region, credentials, retention policy, and encryption policy.
- Confirmation of the managed PostgreSQL backup capability and retention period.
- Approved isolated database/environment for restore and destructive E2E tests.
- Approved SMTP or notification webhook credentials and patient consent rules.
- Hospital representatives for Day 9 UAT and acceptance sign-off.
- Production maintenance window and rollback owner.

## Day-by-day execution

### Day 1 — Audit and scope lock

- Complete repository inventory, gap analysis, risk register, and release checklist.
- Record the verified baseline and freeze nonessential features.
- Obtain owners for storage, backup, provider credentials, staging, and UAT.

Exit: these four release documents are reviewed; blockers have owners and due dates.

### Day 2 — Data protection

- Implement a private durable-storage adapter or disable production uploads.
- Preserve current storage keys and document migration/reconciliation behavior.
- Configure backup retention and execute an isolated restore rehearsal.

Exit: newly uploaded files survive a redeployment; unauthorized reads fail; restore evidence exists.

### Day 3 — Deployment and security

- Add `/health/live` and database-aware `/health/ready` endpoints.
- verify secrets, CORS, SPA direct routes, password reset, logging redaction, and migration status.
- Add minimal CI if time remains after blockers.

Exit: deployment-ready staging build with security checks green.

### Day 4 — Patient and appointment

- Verify patient create/find, duplicate constraints, appointment create/update/cancel/check-in, and OPD queue persistence.
- Verify role denials and audit coverage.
- Add external appointment messages only if the approved provider is ready.

Exit: workflow passes API-to-database-to-refreshed-UI checks.

### Day 5 — Clinical and pharmacy

- Verify consultation, prescription, lab/radiology order/result, admission/discharge, dispensing, and inventory movements.
- Test duplicate, insufficient-stock, invalid transition, and unauthorized cases.

Exit: no critical clinical or stock-integrity failures.

### Day 6 — Billing integrity

- Add payment idempotency/concurrency controls and refund-aware reconciliation.
- Verify invoice arithmetic, partial/full payment, refund, receipt, audit, and permissions.
- Add the minimal receivables correction if safe.

Exit: duplicate/failed requests cannot overpay or falsely close invoices.

### Day 7 — Narrow reporting

- Verify the existing report definitions against source records.
- Add receivables aging only if a documented due-date rule can be represented accurately.
- Confirm financial metrics require `billing.view`.

Exit: calculations and filters have test evidence; no invented metrics.

### Day 8 — Regression and security

- Run frontend, backend, API E2E, browser E2E, authorization, file-persistence, and recovery checks.
- Fix release-blocking regressions only.

Exit: release candidate built and checklist evidence recorded.

### Day 9 — Staging and UAT

- Deploy the exact candidate to staging.
- Run representative receptionist, doctor, nurse, pharmacist, billing, and administrator scenarios.
- Rehearse rollback and capture sign-off or blockers.

Exit: signed acceptance or no-go decision.

### Day 10 — Production and stabilization

- Confirm backup, restore evidence, rollback target, migration plan, and monitoring.
- Deploy only if every strict gate passes.
- Run post-deployment smoke tests and monitor errors/database health.

Exit: stable release report, known limitations, and next-sprint backlog.

## Day-10 acceptance criteria

- No critical patient-data exposure or broken backend authorization.
- Documents and images use verified durable private storage, or affected production uploads are disabled.
- Automated backup retention is confirmed and an isolated restore is demonstrated.
- All migrations apply cleanly and database readiness is observable.
- Critical patient, appointment, OPD, clinical, pharmacy, billing, admission, and discharge scenarios pass.
- Duplicate/concurrent payments cannot silently overpay an invoice.
- Financial reports reconcile to persisted invoice/payment/refund records.
- Production and rollback instructions are executable by someone other than the implementer.
- Known limitations and deferred features are explicit.

## Change record template

Every completed task must record:

- Root cause
- Files changed
- API/database impact
- Tests executed and actual results
- Remaining risk

## Completed-task record

### Database-aware readiness — 2026-10-21

- Root cause: the only health endpoint returned `ok` without verifying PostgreSQL connectivity, allowing an unavailable API to appear healthy.
- Files changed: `backend/src/app.ts`, `backend/tests/app.test.ts`.
- API/database impact: added `GET /health/live` and `GET /health/ready`; retained `GET /health` for compatibility. Readiness executes `SELECT 1` and returns a generic `503` on failure. No schema change.
- Tests executed: backend TypeScript build passed; backend Vitest passed (4 files, 25 tests), including ready, unavailable, and response-redaction cases.
- Actual result: liveness remains infrastructure-independent; readiness now detects database failure without returning its internal error to the client.
- Remaining risk: an external monitor/alert must still be configured to poll readiness and notify an operator.

### Private durable-storage adapter — 2026-10-21

- Root cause: documents, profile images, and hospital logos wrote to ephemeral container storage, allowing database references to survive after their files disappeared.
- Files changed: shared storage/configuration, profile-image and hospital-logo services, backend dependency manifests, environment example, README, and storage safety tests.
- API/database impact: existing API routes and database keys remain compatible. Production now requires `STORAGE_DRIVER=vercel-blob`; private Blob objects are stored under `medicare-private/`. No schema change.
- Tests executed: backend TypeScript build passed; backend Vitest passed (5 files, 29 tests), including unsafe storage-key rejection.
- Actual result: all three upload types use one adapter; production cannot silently select local disk; provider SDK loading is lazy so liveness remains fast.
- Remaining risk: the Blob store and environment binding must be created, new-object persistence must be tested across redeployment, and existing database keys must be reconciled against/copy available local objects before this release gate is closed.

### Payment idempotency and refund reconciliation — 2026-10-21

- Root cause: concurrent payment requests could validate against the same pre-payment balance, retries had no stable idempotency key, and approved refunds did not recalculate invoice status or receivables.
- Files changed: Prisma schema/migration, billing routes/service, shared invoice financial calculation, reports, Angular API/store/payment form and billing totals, plus unit/E2E coverage.
- API/database impact: `POST /api/v1/billing/:id/payments` now requires a UUID `Idempotency-Key` header. `Payment.idempotencyKey` is unique and required; legacy rows receive deterministic `legacy-<payment-id>` values during migration. Payment processing serializes by invoice inside a serializable transaction.
- Tests executed: backend build passed; backend Vitest passed (6 files, 32 tests); Angular production build passed; full frontend suite passed (48 files, 141 tests). The password-page spec was also rerun separately after an earlier resource-contention timeout and passed (6 tests).
- Actual result: identical retries return the original payment without a duplicate; key reuse with a different request is rejected; approved refunds reduce net collections, increase receivables, and recalculate invoice status.
- Remaining risk: the migration and updated E2E payment workflow must run against isolated PostgreSQL before production. The migration must not be applied while an older API version is still accepting payments.
