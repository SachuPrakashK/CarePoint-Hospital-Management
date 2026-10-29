# Settings Support and Language Enhancement Report

## Summary

Implemented the Settings support redesign and organization language-management workflow while preserving the existing Help & Support ticket/article APIs, user language preferences, translation files, and header selector behavior.

## Existing Issues Identified

- The Settings support tab was a plain form/list without a support overview or visual hierarchy.
- Help article editing was inline instead of using the shared scrollable modal pattern.
- Language configuration only supported enable/disable for rows pre-created in the database.
- Hindi, Malayalam, and Tamil were stored as preconfigured languages even though they were incomplete and disabled.
- There was no standards-based language catalog, add/remove/default workflow, or duplicate prevention API.
- Language mutations relied on `settings.update` alone instead of also enforcing the application's highest administrative role.
- A missing or unavailable user preference returned no organization fallback when an administrator changed the default.

## UI Improvements

- Added responsive, pastel support and language hero sections using the MediCare+ navy, teal, and sky palette.
- Added support overview cards backed by configured contact and help-article data; no contact details or tickets are fabricated.
- Kept the existing persisted support contact and Help & Support article workflows.
- Moved help article create/edit into the shared `app-modal` pattern with a scrollable body and duplicate-submit protection.
- Added active-language summary cards, translation-status badges, default/enabled indicators, and an Actions menu.
- Added a searchable language combobox with clear, loading, and empty states. Search matches English name, native name, and code.
- Added responsive layouts for narrow screens.

## Files Modified

- `src/app/features/settings/settings-page.ts`
- `src/app/features/settings/settings-page.html`
- `src/app/features/settings/settings-page.scss`
- `src/app/features/administration/administration-api.service.ts`
- `src/app/core/i18n/language.service.ts`
- `backend/src/routes/language.routes.ts`
- `backend/src/services/language.service.ts`
- `backend/src/data/language-catalog.ts`
- `backend/prisma/migrations/20261025120000_language_catalog_management/migration.sql`
- `backend/tests/language-catalog.test.ts`

## API and Database Changes

- Added `GET /api/v1/languages/catalog` for unconfigured catalog entries.
- Added `POST /api/v1/languages` to configure a catalog language in a disabled, translation-required state.
- Extended `PATCH /api/v1/languages/:code` to enable/disable and atomically change the default.
- Added `DELETE /api/v1/languages/:code` with default-language protection and safe user-preference fallback.
- Existing enabled-language and preference endpoints remain the source for the header selector.
- All language mutations require both `settings.update` and the `HOSPITAL_ADMIN` role. This codebase intentionally removed the obsolete `SUPER_ADMIN` role; `HOSPITAL_ADMIN` is its highest organization-wide administrative role.
- The migration reassigns Hindi, Malayalam, and Tamil preferences to English before deleting only those configured rows. Translation source files are retained.
- English remains enabled, 100% translated, and default after migration.
- Transactions preserve single-default behavior and prevent deletion from orphaning user preferences.

## Language Catalog Source

The catalog uses the comprehensive ISO 639-1 code set plus common IANA BCP 47 script/region variants. Codes are canonicalized with `Intl.getCanonicalLocales`; English and native display names are supplied by the Unicode CLDR data exposed through Node.js `Intl.DisplayNames`. The catalog currently contains more than 180 entries and includes `hi`, `ml`, and `ta` after those languages are removed from configured settings.

## Migration Considerations

- Apply the new Prisma migration in the target environment before using the new management endpoints.
- Existing Hindi, Malayalam, and Tamil user preferences are moved to English; no preference row is silently invalidated.
- Other language preferences fall back to the configured default when their language is unavailable.
- Adding a language creates it with 0% translation coverage, disabled, and marked `Translation required`.
- Enabling or making an incomplete language default is rejected by the backend.

## Permission Changes

- Read-only configuration access continues to use `settings.view`.
- Organization-wide add, update, default, and remove operations require `settings.update` and `HOSPITAL_ADMIN` at the API layer.
- The Angular management controls use the same administrative-role gate, but backend authorization remains authoritative.

## Tests Actually Executed

| Check                                                  | Result  | Notes                                                                                                                                                                                          |
| ------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend TypeScript build (`npm.cmd run build`)         | Pass    | Completed with no compiler errors.                                                                                                                                                             |
| Prisma schema validation (`npx.cmd prisma validate`)   | Pass    | Prisma 6.12.0 PostgreSQL schema is valid.                                                                                                                                                      |
| Language catalog tests                                 | Pass    | 6/6 tests passed: catalog size/order, Hindi, Malayalam, Tamil, Simplified Chinese, invalid identifier.                                                                                         |
| VS Code diagnostics on modified frontend/backend files | Pass    | No diagnostics reported.                                                                                                                                                                       |
| Angular selected support/i18n specs                    | Blocked | Angular test bundle compiled, but the runner emitted no final test summary in this host. Direct Vitest is incompatible with the Angular global-test setup.                                     |
| Angular production build                               | Blocked | The build reached compilation but the host process failed to provide a completion summary; a direct TypeScript retry hit Windows `VirtualAlloc` exhaustion. No source diagnostic was reported. |
| Database migration execution                           | Not Run | No deployment/database mutation was performed from this change task.                                                                                                                           |
| API E2E against PostgreSQL                             | Not Run | Requires a running seeded API/database environment and credentials.                                                                                                                            |
| Browser responsive/accessibility verification          | Not Run | Requires the application and API to be running against the migrated database.                                                                                                                  |

## Remaining Limitations

- The existing application has no translation-editor/upload workflow. `Manage translations` is therefore displayed disabled rather than linking to a nonfunctional screen.
- Language enablement intentionally remains blocked until translation coverage is 100%; a future translation workflow must update that trusted coverage value.
- The repository is not tenant-partitioned: settings are organization-global (`default` records), so tenant scoping cannot be added without a broader data-model migration.
- Final browser and live persistence verification must be run after applying the migration in a test environment.
