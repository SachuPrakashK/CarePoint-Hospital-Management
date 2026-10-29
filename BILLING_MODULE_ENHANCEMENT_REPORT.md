# MediCare+ Billing Module Enhancement Report

Status: Implemented and locally verified  
Completion date: 2026-10-22

## Issues identified and outcomes

| Area                       | Root cause                                                                   | Outcome                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Payment dates              | UI/API used nonexistent `paidAt` instead of persisted `createdAt`            | Fixed                                                                                                               |
| Payment context            | Query omitted invoice patient and recorder display data                      | Fixed                                                                                                               |
| Refund context             | Query omitted invoice patient, requester, and approver display data          | Fixed                                                                                                               |
| Financial KPIs             | Revenue was gross payment value and all refunds were counted as requests     | Fixed; only approved refunds reduce revenue and only Requested refunds count as requests                            |
| Invoice details            | Page depended on the first 100 cached invoices                               | Fixed; details load by ID from the authorized API                                                                   |
| Unsupported invoice fields | UI assumed discount, tax, insurance, and encounter fields absent from Prisma | Removed; the UI now shows only persisted values                                                                     |
| Invoice actions            | Edit controls ignored paid/cancelled restrictions                            | Fixed in UI and backend                                                                                             |
| Table workflow             | No row navigation, filters, or export                                        | Fixed with accessible row navigation, supported server filters, column preferences, and CSV page export             |
| Invoice modal              | Dense layout, limited validation feedback, and no explicit cancel action     | Rebuilt with shared fixed modal regions and responsive item cards                                                   |
| Duplicate invoices         | Create had only transient submit-button protection                           | Fixed with a persisted unique invoice idempotency key                                                               |
| Invoice attribution        | Invoice creator was not persisted                                            | Fixed for new invoices with `createdById`; legacy records remain labelled as legacy                                 |
| Invoice audit              | Create, edit, and cancel lacked complete audit coverage                      | Fixed with transactional audit events                                                                               |
| Concurrent refunds         | Two requests could validate the same refundable amount                       | Fixed with a payment-scoped PostgreSQL advisory transaction lock                                                    |
| Payment state display      | The model cannot represent pending/failed processor attempts                 | Persisted payments now show Settled, Partially Refunded, or Refunded; unsupported processor states are not invented |

## Accounting rules preserved

- Invoice total is the sum of `quantity × unitPrice` across persisted line items.
- Net paid is persisted payments minus **Approved** refunds.
- Requested refunds reserve refundable value but do not reduce collections until approved.
- Balance due is invoice total minus net paid, floored at zero.
- Payment creation remains idempotent and serialized per invoice.
- Invoices with payments cannot have line items replaced or be cancelled.
- Cancelled invoices cannot be edited or paid.

## Files changed

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261022090000_invoice_audit_idempotency/migration.sql`
- `backend/src/routes/phase23.routes.ts`
- `backend/src/services/phase23.service.ts`
- `src/app/core/services/phase23-api.service.ts`
- `src/app/core/services/phase23.store.ts`
- `src/app/features/billing/pages/billing-page.ts`
- `src/app/features/billing/pages/billing-page.html`
- `src/app/features/billing/pages/billing-page.scss`
- `src/app/features/billing/pages/bill-form.ts`
- `src/app/features/billing/pages/bill-form.html`
- `src/app/features/billing/pages/bill-form.scss`
- `src/app/features/billing/pages/invoice-page.ts`
- `src/app/features/billing/pages/invoice-page.html`
- `BILLING_MODULE_ENHANCEMENT_REPORT.md`

## API updates

- `GET /api/v1/billing` now supports `status`, returns server-calculated total/net-paid/balance values, and enriches creator display data.
- `GET /api/v1/billing-payments` now uses `createdAt`, supports `method`, and returns invoice patient, refunds, recorder name, and derived persisted-payment status.
- `GET /api/v1/billing/refunds` now supports `status` and returns payment, invoice, patient, requester, and approver context.
- `POST /api/v1/billing` now requires a UUID `Idempotency-Key`, validates an active patient, creates invoice/items/audit atomically, and safely replays identical requests.
- `PUT /api/v1/billing/:id` rejects cancelled or paid invoices and records an audit event.
- `DELETE /api/v1/billing/:id` records cancellation atomically and remains idempotent for an already-cancelled invoice.
- Refund request and decision transactions now serialize against their financial record.

## Database changes

- Added nullable `Invoice.createdById` for new-record attribution without inventing legacy ownership.
- Added nullable unique `Invoice.idempotencyKey` for retry-safe creation.
- Applied all 22 checked-in migrations successfully to the configured local development PostgreSQL database.
- No production database migration was run.

## UI improvements

- Added a feature-scoped responsive billing layout using the MediCare+ navy/teal/blue design system.
- Improved page hierarchy, tab semantics, table density, scrolling, hover/focus states, and mobile behavior.
- Added real money formatting, patient identifiers, relationship display values, statuses, actor names, server filters, configurable columns, and CSV export.
- Noninteractive rows open the related invoice details by mouse or Enter; actions remain explicit and permission-gated.
- Rebuilt Add New Invoice with fixed shared header/footer, scrollable body, patient identification, editable/removable items, inline validation, line totals, grand total, and preserved values on failure.
- Successful create/payment/refund operations now close only after backend confirmation and refresh the relevant data.
- Direct invoice details now load from the API and print only supported persisted financial fields.

## Tests actually executed

| Test                              | Result  | Evidence                                                                                   |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Prisma schema validation          | Pass    | `npx prisma validate`                                                                      |
| Local migration deployment/status | Pass    | 22 migrations applied; schema reported up to date                                          |
| Backend TypeScript build          | Pass    | `npm run build`                                                                            |
| Backend Vitest                    | Pass    | 6 files, 32 tests                                                                          |
| Angular production build          | Pass    | Build completed; three pre-existing unrelated SCSS budget warnings                         |
| Angular Vitest                    | Pass    | 48 files, 141 tests                                                                        |
| Billing list API smoke            | Pass    | Invoice, payment, and refund list endpoints returned successfully with `createdAt` sorting |
| Synthetic invoice create          | Pass    | Created through authenticated REST API and retrieved through details endpoint              |
| Invoice idempotent replay         | Pass    | Same key and payload returned the same persisted invoice ID                                |
| Invoice cancellation              | Pass    | Synthetic invoice cancelled successfully and retained as history                           |
| Invoice audit persistence         | Pass    | Synthetic create and cancel produced `INVOICE_CREATE` and `INVOICE_CANCEL` audit records   |
| Diagnostic session cleanup        | Pass    | Test authentication session logged out                                                     |
| Real payment/refund mutation      | Not Run | No real financial transaction was performed                                                |
| Production/staging E2E            | Blocked | Requires isolated staging data and deployment approval                                     |
| Visual browser matrix             | Not Run | Automated browser tooling is not configured in this repository                             |

## Remaining risks and explicit limitations

- The database has no billable-service/tariff catalogue, discount, tax, payment-terms, department, or doctor relation for manual invoices. Manual prices are bounded and server-validated but cannot yet be checked against an approved tariff. Adding those fields requires a separately approved accounting model.
- The payment model stores completed payments only. Pending, failed, processor-authorized, and reversed attempts require a provider transaction/status model and are intentionally not fabricated.
- CSV exports the authorized current server page and respects active search/filter/sort state; a streaming all-results export endpoint is not implemented.
- Production must receive the new migration together with the compatible API. Staging concurrency, role-matrix, responsive visual, and integration workflow testing remain release gates.
