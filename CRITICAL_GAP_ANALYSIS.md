# MediCare+ Critical Gap Analysis

Audit date: **2026-10-21**

## Capability classification

| Area                                     | Classification                                     | Repository evidence                                                                                                       | Release action                                                                                  |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Angular SPA and direct routes            | Implemented and previously smoke-tested            | Lazy routes, wildcard route, Vercel frontend service and catch-all rewrite                                                | Repeat login, deep-link and 404 checks on staging                                               |
| API deployment                           | Implemented and previously smoke-tested            | Vercel container service, Dockerfile, same-origin `/api` rewrite                                                          | Verify staging/production parity and rollback                                                   |
| Managed PostgreSQL and migrations        | Implemented, verification incomplete               | Prisma PostgreSQL datasource and 20 migrations; production reported no pending migrations                                 | Prove backup retention and isolated restore                                                     |
| Authentication                           | Implemented                                        | Argon2, access JWT, rotating persisted refresh sessions, lockout, password policy                                         | Test expiry, logout, refresh reuse, disabled users and reset                                    |
| RBAC                                     | Implemented, requires systematic verification      | `authenticate` and `requirePermissions` used across backend routes                                                        | Build negative authorization matrix for critical endpoints                                      |
| Audit logging                            | Partially implemented                              | Password, clinical, documents, payments, refunds and other services write audit events                                    | Trace all release-critical mutations and fill only critical omissions                           |
| Patient and appointments                 | Implemented                                        | Persisted patients/appointments, unique doctor/time constraint, status transitions, E2E scripts                           | Verify duplicate handling, reschedule/cancel/check-in and refreshed UI                          |
| OPD and clinical                         | Implemented                                        | Persisted queue, consultation transaction, prescription/vitals/diagnosis and audit                                        | Verify permissions and end-to-end retrieval                                                     |
| Lab/radiology                            | Implemented                                        | Persisted routes/services and browser/API scripts                                                                         | Verify order/result permissions and audit coverage                                              |
| Admissions, beds and discharge           | Implemented                                        | Admission service/routes and E2E scripts                                                                                  | Verify concurrent bed assignment, discharge and bed release                                     |
| Pharmacy and inventory                   | Implemented                                        | Batch/stock transactions, dispensing/procurement flows and E2E scripts                                                    | Verify atomic stock movement and duplicate completion rejection                                 |
| Billing and refunds                      | Code fix implemented; database E2E pending         | Required unique idempotency key, per-invoice transaction lock, serializable transaction, shared refund-aware calculations | Apply migration and run duplicate/concurrent/refund staging tests before closing gate           |
| Receivables reporting                    | Net balance correction implemented; aging deferred | Reports now use charges minus net payments after approved refunds                                                         | Verify totals against staging source rows; aging still requires a due-date rule/schema decision |
| Management reporting                     | Implemented                                        | Persisted counts, date/department filters, finance permission gate, CSV formula neutralization                            | Reconcile selected KPIs to source records                                                       |
| Internal notifications                   | Implemented                                        | Database notifications and user-scoped reads                                                                              | Verify isolation and failure behavior                                                           |
| Patient appointment delivery             | Missing but potentially feasible                   | Existing provider only sends password-reset email/webhook; no reminder model, consent or delivery log                     | Implement only if provider and consent decisions are supplied                                   |
| Durable documents                        | Release blocker                                    | `file-storage.service.ts` writes to `FILE_UPLOAD_PATH` on local filesystem                                                | Replace with private durable object storage or disable uploads                                  |
| Durable profile images and hospital logo | Release blocker                                    | Separate filesystem implementations in profile and hospital-logo services                                                 | Consolidate behind the same durable adapter or disable writes                                   |
| Upload malware scanning                  | Missing and externally dependent                   | Signature/type/size checks exist; no scanner                                                                              | Document limitation; use quarantine/scanner if provider-ready                                   |
| Backup/restore                           | Release blocker; no evidence                       | No backup automation, retention or restore procedure in repository                                                        | Configure managed backup and perform nonproduction restore test                                 |
| Readiness monitoring                     | Defective/incomplete                               | `/health` always reports `ok` without database check                                                                      | Split liveness and readiness; verify failure response                                           |
| Exception monitoring/alerting            | Missing                                            | Structured Pino logs and redaction exist; no external sink/alert integration                                              | Configure platform log drain/alert or document operational owner                                |
| CI                                       | Missing                                            | No workflow files and no lint script                                                                                      | Add minimal build/test/migration pipeline if it does not delay blockers                         |
| Patient portal/mobile app                | Too large for release                              | No patient identity or patient-facing application                                                                         | Defer                                                                                           |
| Multi-hospital tenancy                   | Too risky for release                              | No tenant boundary in schema/services                                                                                     | Defer and do not market as multi-tenant                                                         |

## Important technical findings

### Storage

- Documents, profile images, and hospital logos each write to local disk.
- File-type, signature, and size checks exist, and document downloads require permissions.
- Local Vercel/container storage is not durable. Database metadata can therefore outlive its object, producing silent loss after redeployment.
- Existing keys must remain stable during migration. Missing legacy objects must be reported, not silently treated as migrated.

### Database recovery

- Migrations are checked in and production migration status was queried previously.
- Migration success is not equivalent to backup recovery.
- There is no checked-in retention policy, restore runbook, restore timestamp, or integrity check from a recovered database.

### Authentication and authorization

- Password hashes use Argon2; refresh tokens are hashed in the database and rotated.
- Password changes/resets revoke active refresh sessions and create audit records.
- Access JWT permissions are snapshots until token expiry. Critical role changes should therefore be verified against the accepted revocation window.
- Tokens are returned to the Angular client rather than Secure HttpOnly cookies. This is an accepted short-term risk only with strong CSP/XSS controls and a documented next step.

### Billing

- Invoice items and payments use Prisma decimals and transactions.
- The payment transaction reads aggregate paid value and then inserts a payment, but it does not serialize concurrent requests. Two requests can both validate against the same balance.
- There is no external/request idempotency key on `Payment`.
- Reported outstanding balance subtracts gross payments without applying approved refunds.
- Invoice status is updated on payment but not reconciled when a refund is approved.

### Notifications

- SMTP/webhook support exists only for password-reset delivery.
- Appointment events create staff-facing database notifications.
- No patient communication preference, consent record, reminder schedule, delivery-attempt table, or duplicate-reminder constraint was found.
- Appointment reminders are therefore conditional scope, not a release promise.

### Reporting

- Reports use persisted PostgreSQL records, role-gate financial data, support date/department filters, and protect CSV cells against formula injection.
- Bed occupancy is current-state rather than historical occupancy for the selected period; this must be labelled accurately.
- Receivables aging cannot be authoritative until the due-date rule is documented; the current invoice schema has no explicit due date.

## Baseline test gaps

- Many API and browser E2E scripts exist, but they require running services and mutable database fixtures.
- No single release command provisions isolated data, runs the suites, cleans up, and emits a report.
- No CI currently prevents unbuilt or untested changes from reaching `develop`.
- Backup restore, deployment persistence, concurrent payment, file authorization, and provider-failure scenarios require dedicated evidence.
