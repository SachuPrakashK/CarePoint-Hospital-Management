# MediCare+ Billing Bug Fix Report

Date: 23 October 2026  
Scope: Billing invoices, payments, refunds, printing, persistence, authorization, and audit history

## Executive result

All eight requested fixes were implemented. The critical payment and refund workflows were verified against the local PostgreSQL database with controlled test data. Payment and refund requests now use server-enforced idempotency, transactional balance checks, and PostgreSQL advisory locks. A live test exposed and fixed a Prisma/PostgreSQL incompatibility in the lock call (`$queryRaw` attempted to deserialize PostgreSQL's `void` result); lock acquisition now uses `$executeRaw`.

## Fixes

### 1. Invoice Actions menu — Pass

- Root cause: invoice operations were rendered as separate row buttons and did not share the application's permission-aware action menu.
- Resolution: invoices now use the shared three-dot Actions menu for View Details, Edit, Print Invoice, Record Payment, and Cancel/Void. Actions are permission/status gated, stop row propagation, and inherit the shared menu's keyboard and fixed-overlay behavior.
- Files: `src/app/features/billing/pages/billing-page.html`, `billing-page.ts`, `src/app/shared/components/actions-menu/app-actions-menu.html`, `app-actions-menu.ts`.

### 2. Actions column alignment — Pass

- Root cause: a generic `td:last-child { display: flex }` rule changed table-cell layout and caused headers and controls to drift.
- Resolution: action cells retain table-cell display with a consistent 9rem width, centered alignment, and matching padding across invoices, payments, and refunds.
- Files: `src/app/features/billing/pages/billing-page.scss`.

### 3. Add Invoice modal and scrollbar — Pass

- Root cause: the form body had no themed scrollbar or horizontal overflow guard.
- Resolution: retained the shared fixed modal header/footer, made the body independently scrollable through the shared modal, added a slim themed scrollbar, prevented horizontal overflow, and preserved responsive line-item grids and inline validation. The shared modal remains explicit-close only; backdrop and Escape do not dismiss it.
- Files: `src/app/features/billing/pages/bill-form.scss`, `billing-page.html`.
- Note: the current financial schema supports quantity and unit price, but has no persisted discount or tax fields. No synthetic discount/tax values were introduced.

### 4. Print invoice layout — Pass

- Root cause: component print CSS hid only the invoice action buttons; navigation chrome lives outside the routed component and remained printable.
- Resolution: global print rules hide sidebar, application header, breadcrumbs, overlays, and controls. The invoice uses A4 portrait margins, repeating table headers, and page-break protection. `?print=1` opens print preview after invoice data loads.
- Files: `src/styles/styles.scss`, `src/app/features/billing/pages/invoice-page.scss`, `invoice-page.ts`.
- Note: available persisted branding, invoice, patient, line-item, payment, refund, and balance data are printed. The database currently has no hospital-contact, discount, or tax fields to render.

### 5. Record Payment modal — Pass

- Root cause: the form accepted only an invoice ID and lacked sufficient context and outstanding-balance validation.
- Resolution: the form receives the selected invoice, displays invoice/patient/total/paid/outstanding summaries, validates amount against the remaining balance, preserves values on failure, disables duplicate submission, and closes only after backend confirmation.
- Files: `src/app/features/billing/pages/payment-form.ts`, `payment-form.html`, `financial-form.scss`, `billing-page.html`.
- Note: the server records the authoritative transaction timestamp. The schema does not support user-supplied payment date or notes.

### 6. Visible Refund button — Pass

- Root cause: refund initiation was not sufficiently visible in the payment row workflow.
- Resolution: eligible, authorized payments show a compact outlined Refund button with an SVG icon. It uses the correct payment object, stops row propagation, and is hidden when no refundable balance remains.
- Files: `src/app/features/billing/pages/billing-page.html`, `billing-page.scss`, `billing-page.ts`.

### 7. Refund modal — Pass

- Root cause: the form lacked original-payment context and did not expose the reserved/refundable calculation.
- Resolution: the shared modal now shows payment reference, invoice, patient, original amount, prior non-rejected refunds, and remaining refundable balance. It validates amount and reason, preserves values on failure, and clearly states that submission creates a Requested item pending approval.
- Files: `src/app/features/billing/pages/refund-form.ts`, `refund-form.html`, `financial-form.scss`, `billing-page.html`.
- Note: refund method, provider reference, and free-form notes are not fields in the current internal approval workflow.

### 8. Save Payment and Refund Payment — Pass

- Root causes:
  - UI forms lacked the complete selected invoice/payment context.
  - Refund requests did not have database-backed idempotency.
  - PostgreSQL advisory locks used Prisma `$queryRaw`; `pg_advisory_xact_lock` returns `void`, producing a runtime 500 during payment save.
- Resolution:
  - Correct form handlers and payload relationships are wired end to end.
  - Payment and refund endpoints require UUID `Idempotency-Key` headers.
  - Refunds now persist a unique idempotency key.
  - Identical retries return the original record; reuse for a different request returns 409.
  - Payment/refund calculations execute inside database transactions with per-entity advisory locks.
  - Overpayment and over-refund are rejected with 422.
  - Refund requests remain `Requested` until explicitly Approved/Rejected.
  - Invoice status and net paid balance are recalculated after approved refunds.
  - Store refreshes update invoices, payments, refunds, summaries, and dashboard billing data after confirmed operations.
  - Audit events cover invoice creation, payment, refund request, and refund approval/rejection.
- Files: `backend/src/routes/phase23.routes.ts`, `backend/src/services/phase23.service.ts`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261022130000_refund_idempotency/migration.sql`, `src/app/core/services/phase23-api.service.ts`, `phase23.store.ts`, payment/refund forms.

## API and database changes

- `POST /api/v1/billing/:id/payments` requires a UUID `Idempotency-Key` and returns the existing payment for an identical retry.
- `POST /api/v1/billing/payments/:id/refunds` now requires a UUID `Idempotency-Key` and returns the existing refund request for an identical retry.
- Migration `20261022130000_refund_idempotency` adds required `Refund.idempotencyKey`, backfills historical rows with `legacy-<id>`, and creates a unique index.
- The migration was applied successfully to local PostgreSQL database `hospital_management` on port 5433.

## Financial verification

Controlled test: one ₹100 invoice, one ₹40 partial payment, and one ₹10 approved refund.

| Scenario                             | Result                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Valid payment persisted              | Pass                                                                             |
| Partial payment/status               | Pass — `Partially Paid`, ₹60 outstanding before refund                           |
| Invalid/excess payment               | Pass — ₹61 rejected with 422                                                     |
| Duplicate invoice/payment submission | Pass — one record per idempotency key                                            |
| Unauthorized payment                 | Pass — doctor role rejected with 403                                             |
| Valid refund request                 | Pass — persisted as `Requested`                                                  |
| Partial approved refund              | Pass — net paid ₹30, outstanding ₹70                                             |
| Excess refund                        | Pass — ₹31 rejected while ₹10 was reserved                                       |
| Duplicate refund submission          | Pass — one refund per idempotency key                                            |
| Ineligible/fully reserved amount     | Pass — server rejects amounts beyond remaining refundable balance                |
| Audit trail                          | Pass — create/payment/refund-request/refund-approve events found                 |
| Persistence/page refresh basis       | Pass — records read back from PostgreSQL and list/store loaders refresh from API |
| API failure UI behavior              | Pass by code path — modal stays open, values remain, server message is displayed |

No external payment provider or real financial transaction was used.

## Tests actually executed

| Test                                                                | Result                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| Prisma schema format and validation                                 | Pass                                                 |
| Prisma client generation                                            | Pass                                                 |
| Prisma migration deploy                                             | Pass — 23 migrations present; new migration applied  |
| Backend TypeScript production build                                 | Pass                                                 |
| Backend Vitest suite                                                | Pass — 6 files, 32 tests                             |
| Angular production build                                            | Pass — existing unrelated style-budget warnings only |
| Angular test suite                                                  | Pass — 48 files, 141 tests                           |
| `backend/tests/e2e-billing-critical.mjs` live API/database workflow | Pass                                                 |
| Static whitespace/error check (`git diff --check`)                  | Pass before final report generation                  |

## Remaining issues and risks

- Discount, tax, hospital contact details, user-selected payment date, payment/refund notes, refund method, and provider transaction reference are not represented by the current Prisma schema. They were not fabricated or silently stored elsewhere. Adding them requires a separately defined accounting/data migration.
- Print CSS and responsive layouts were production-built, but physical printer/PDF rendering and manual device viewport inspection remain environment-dependent and should receive a short browser acceptance pass before release.
- The controlled test leaves clearly labelled `Automated Test` financial history in the local development database to avoid deleting or rewriting finalized financial records.
- Existing Angular build warnings for support, layout, and login SCSS budgets are outside this billing scope.

## Acceptance summary

The requested Actions menu, alignment, modal scrolling, print isolation, payment UI, visible refund control, refund UI, payment persistence, refund persistence, balance reconciliation, authorization, audit history, and duplicate protection are complete and verified. The only unavailable display/input fields are those not supported by the existing data model, as documented above.
