# Audit Logs Bug Fix Report

## Outcome

The Audit Logs list and details flow was corrected across PostgreSQL/Prisma, the REST API, Angular state mapping, and the shared table UI. Audit records remain read-only.

## Identified issues and root causes

- The list omitted the persisted `ipAddress` field.
- Audit events whose user relation was unavailable were incorrectly presented as `System`, even when `userId` was retained.
- The Details column displayed serialized metadata instead of a readable description derived from the real action and entity fields.
- The table had no Actions column or explicit View Details action.
- Date-only filters were converted to UTC day boundaries, while the application displays India Standard Time.
- Empty search/filter results did not provide a combined recovery action.
- The metadata redaction key matcher did not cover credential, API-key, access-key, or private-key variants.
- Create, update, delete, and login audit actions used the neutral badge tone.
- Table content had insufficient four-sided spacing and lacked dedicated IP/Actions column sizing.

## Files modified

- `src/app/core/services/audit.store.ts`
- `src/app/core/services/audit.store.spec.ts`
- `src/app/features/audit/audit-page.ts`
- `src/app/features/audit/audit-page.html`
- `src/app/features/audit/audit-page.scss`
- `src/app/features/audit/audit-details.html`
- `src/app/shared/components/status-badge/status-badge.ts`
- `backend/src/services/phase23.service.ts`
- `backend/tests/security-validation.test.ts`
- `AUDIT_LOGS_BUG_FIX_REPORT.md`

## API and Prisma changes

- No schema migration was required. `AuditLog` already persists actor ID, action, module, entity reference, metadata, IP address, and timestamp.
- Audit search now includes the stable `userId` value.
- Actor options preserve unavailable user identifiers.
- Audit date filters now use IST (`+05:30`) day boundaries.
- Sensitive metadata continues to be recursively redacted and now covers additional credential/key names.
- No Status column was added because the current `AuditLog` schema does not record event status.

## Database verification

Result: **Pass**

A read-only query ran against the configured PostgreSQL database. It found 150 audit records and inspected the three newest rows without printing confidential values. All sampled rows contained real timestamps, actions, modules, entity types, actor relationships/IDs, and supported metadata. None of the sampled rows contained an IP address; the UI therefore displays `—` for those records.

No historical audit record was modified.

## Tests executed

| Verification                                                  | Result  |
| ------------------------------------------------------------- | ------- |
| Angular test suite — 53 files, 171 tests                      | Pass    |
| Backend test suite — 6 files, 32 tests                        | Pass    |
| Backend TypeScript production build                           | Pass    |
| Configured PostgreSQL read-only representative-row comparison | Pass    |
| Formatting and changed-file diff validation                   | Pass    |
| Manual desktop/tablet/mobile browser walkthrough              | Not Run |

## Security and integrity

- Both list and details routes remain protected by `audit.view`.
- Audit records expose no Edit or Delete action.
- Metadata is sanitized by the API before list or detail responses.
- Missing optional values use `—`; historical values are not fabricated.
- The current schema has no tenant/organization key on `AuditLog`, so tenant-scoped filtering is not applicable to this single-organization data model.

## Remaining issues

- Many existing audit writers do not capture the request IP address. Existing records must remain unchanged; future IP capture requires request-context propagation into every audited service workflow.
- Event success/failure status is not currently stored in `AuditLog`; the UI intentionally does not synthesize or display it.
- A manual responsive browser walkthrough remains to be completed in a running application.
