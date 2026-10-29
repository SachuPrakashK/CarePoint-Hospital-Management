# MediCare+ Release Test Checklist

Release candidate: _TBD_  
Environment: isolated staging  
Tester/date: _TBD_

Use nonproduction identities and synthetic patient data. Record Pass, Fail, Blocked, or Not Applicable and attach evidence. A checked box means the test actually ran.

## Release gates

- [ ] Exact commit SHA and migration set identified.
- [ ] Frontend production build passes.
- [ ] Backend TypeScript build passes.
- [ ] Frontend unit tests pass.
- [ ] Backend unit/integration tests pass.
- [ ] All critical workflow sections below pass.
- [ ] No unresolved critical security finding.
- [ ] Durable storage persistence and authorization pass, or uploads are disabled.
- [ ] Backup retention is confirmed and isolated restore passes.
- [ ] Rollback rehearsal passes.

## Deployment and observability

- [ ] `/health/live` succeeds without disclosing infrastructure details.
- [ ] `/health/ready` succeeds with the database available.
- [ ] `/health/ready` fails safely when database access is unavailable.
- [ ] `/auth/login`, an authenticated deep route, and wildcard 404 work on direct navigation/refresh.
- [ ] HTTPS, HSTS, CSP, frame restrictions, and CORS are correct.
- [ ] API exceptions include a request ID and do not expose stack traces.
- [ ] Logs redact authorization, cookies, passwords, reset/access/refresh tokens, and clinical payloads.
- [ ] A simulated critical error reaches the named operator/alert channel.

## Authentication and authorization

- [ ] Valid login succeeds and invalid login is generic.
- [ ] Lockout threshold and automatic unlock behave as configured.
- [ ] Access-token expiry triggers refresh or logout correctly.
- [ ] Refresh token rotates; replay of an old refresh token is rejected and sessions are revoked as designed.
- [ ] Logout revokes the current session.
- [ ] Password change revokes active refresh sessions and writes an audit event.
- [ ] Password reset token is single-use, expires, and provider failure does not leave a valid orphan token.
- [ ] Disabled/deleted users cannot continue critical actions.
- [ ] Each critical endpoint returns 401 without authentication and 403 without its permission.

## Durable files

- [ ] Valid PDF/JPEG/PNG/text document uploads succeed within size limits.
- [ ] Invalid extension, MIME/signature mismatch, oversized, and multiple-file requests fail.
- [ ] Authorized preview/download succeeds and creates an audit event.
- [ ] Unauthorized preview/download fails without revealing object existence or storage keys.
- [ ] Profile image and hospital logo authorization is correct.
- [ ] Newly uploaded objects remain available after a backend redeployment.
- [ ] Database object references and storage objects reconcile; missing legacy objects are reported.
- [ ] Delete/archive behavior preserves required clinical/legal history.
- [ ] Malware/quarantine behavior is verified or the limitation is a release blocker.

## Backup and restore

- [ ] Automated backup schedule and retention are documented.
- [ ] Backup encryption and access controls are verified.
- [ ] A selected backup restores into an isolated database.
- [ ] Migration status is valid on the restored database.
- [ ] Record counts and sampled patient, invoice, payment, clinical and audit relationships reconcile.
- [ ] Restored credentials/access are isolated from production.
- [ ] Recovery time and recovery point are recorded.

## Patient and appointment workflow

- [ ] Register a synthetic patient; refresh and retrieve the same record.
- [ ] Duplicate identifiers/contact behavior matches the documented rule.
- [ ] Search and open the correct patient; unauthorized role is denied.
- [ ] Create an appointment and verify it in PostgreSQL and refreshed UI.
- [ ] Reschedule and cancel through allowed transitions.
- [ ] Invalid status transition is rejected.
- [ ] Concurrent doctor/time booking conflict is rejected.
- [ ] Check in; stable OPD queue token appears after refresh.
- [ ] Queue progresses through waiting, consultation and completion.

## Clinical, laboratory and radiology

- [ ] Open the intended patient/appointment context.
- [ ] Save consultation, vitals, diagnoses, prescription and follow-up atomically.
- [ ] Retrieve the same clinical documentation after refresh.
- [ ] Create and retrieve laboratory and radiology orders.
- [ ] Record/verify results with the permitted role; unauthorized roles fail.
- [ ] Critical clinical mutations produce audit evidence.
- [ ] Duplicate completion or invalid transitions fail safely.

## Admission, nursing and discharge

- [ ] Admit a patient and allocate an available bed.
- [ ] Concurrent allocation cannot assign one bed twice.
- [ ] Transfer/update status and verify bed state.
- [ ] Add/retrieve nursing notes and medication records with correct permissions.
- [ ] Complete discharge documentation and release the bed.
- [ ] Refresh verifies persisted admission, discharge and bed state.

## Pharmacy and inventory

- [ ] Create/receive stock and verify persisted batch/item quantity.
- [ ] Dispense valid stock and verify one atomic decrement and stock transaction.
- [ ] Insufficient stock fails without partial changes.
- [ ] Retrying completion does not decrement stock twice.
- [ ] Low-stock and near-expiry values reconcile to source batches/items.
- [ ] Unauthorized stock adjustments and dispensing fail.

## Billing and payments

- [ ] Create invoice items and independently recalculate quantity × unit price.
- [ ] Duplicate source charge is rejected where source/source ID is supplied.
- [ ] Partial payment updates balance and status correctly.
- [ ] Final payment sets Paid and produces a receipt/audit event.
- [ ] Overpayment is rejected without writing a payment.
- [ ] Concurrent requests cannot overpay the invoice.
- [ ] Retry with the same idempotency key returns the original result without a duplicate payment.
- [ ] Failed notification after payment does not roll back or duplicate the committed payment.
- [ ] Refund request cannot exceed refundable net payment.
- [ ] Approved refund recalculates invoice status and receivables; rejected refund does not.
- [ ] User without financial permissions cannot view or mutate financial data.

## Reports and management KPIs

- [ ] Appointment totals/statuses match source queries for the selected dates.
- [ ] Revenue equals captured payments minus approved refunds under the documented definition.
- [ ] Outstanding receivables equal invoice charges minus net payments.
- [ ] Department filter affects only metrics with a valid department relationship.
- [ ] Bed occupancy is labelled as current-state unless historical state is implemented.
- [ ] Financial values are omitted for users without `billing.view`.
- [ ] CSV applies filters and neutralizes spreadsheet formulas.
- [ ] Aging buckets remain disabled until a finance-approved due-date rule exists.

## Patient communication (conditional)

- [ ] Approved provider and sender/template configuration exist.
- [ ] Patient consent/preference is checked before delivery.
- [ ] Confirmation, reschedule/cancellation and one reminder are delivered.
- [ ] Duplicate reminder is prevented.
- [ ] Provider acceptance/failure is persisted without sensitive message contents.
- [ ] If prerequisites are absent, the feature is marked Blocked and is not advertised.

## Rollback and post-deployment

- [ ] Pre-deployment backup and currently active deployment ID are recorded.
- [ ] Database changes are backward compatible with the rollback version.
- [ ] Previous deployment can be promoted/redeployed without manual reconstruction.
- [ ] Post-deploy root, login, readiness, protected route and representative workflow smoke tests pass.
- [ ] Error rate, latency, database connections and storage failures are monitored during stabilization.
- [ ] Known limitations and deferred work are published with owners.

## Test result record

For each failed or blocked item record:

| Item  | Result | Evidence | Defect/risk ID | Owner | Decision |
| ----- | ------ | -------- | -------------- | ----- | -------- |
| _TBD_ | _TBD_  | _TBD_    | _TBD_          | _TBD_ | _TBD_    |
