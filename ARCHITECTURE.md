# CarePoint Phase 1 architecture

The application uses Angular 22 standalone components, lazy feature routes, strict TypeScript, signal stores, reactive forms and functional guards/interceptors. `ClinicalStore` is an in-memory development adapter: replace it with feature API services and keep the public store API stable when the backend is connected.

## Required backend contracts

- OAuth-style login, refresh rotation, logout/revocation and session expiry. Tokens should move to secure, SameSite, HttpOnly cookies in production.
- Server-authoritative RBAC for every endpoint; frontend permissions only improve the UI.
- Paginated/sorted/filterable endpoints for patients, doctors, staff, users, roles, masters and appointments.
- Transactional appointment/availability conflict checking, queue token allocation and schedule exceptions.
- Append-only vitals and audit events, versioned consultation records, prescription rendering, secure document upload/download.
- Hospital/tenant scope, encryption at rest, immutable audit trails, retention policy, backups and recovery testing.

## Phase 2 seams

Patient details are ready for medical records/admissions/lab/radiology routes. Consultation, diagnosis and prescription models remain separate so standardized diagnosis codes, order entry, lab results and pharmacy fulfillment can be introduced without changing the shell or route topology.

## Phase 2 clinical and inpatient operations

`InpatientStore` extends the development adapter with admissions, immutable bed-allocation history, laboratory verification, radiology worklists, nursing records, medication administration, procedures/OT, discharge summaries, patient timeline events and append-only audit events. Domain methods reject double allocation, invalid discharge or transfer, verified-result edits, duplicate medication outcomes and theatre collisions. In production, these checks must also execute transactionally on the server and the client store should orchestrate the corresponding APIs.

## Phase 3 operational and financial integration

`OperationsStore` provides the development adapter for medicine batches, immutable stock movements, dispensing, invoices, payments, refunds, insurance claims, general inventory, procurement, suppliers, ambulances and notifications. Pharmacy dispensing writes a stock issue and creates a deduplicated invoice source item in one orchestration. Invoice balances are always derived from item, insurance, payment and processed-refund ledgers. Production APIs must perform these transitions atomically with idempotency keys and database locking.
