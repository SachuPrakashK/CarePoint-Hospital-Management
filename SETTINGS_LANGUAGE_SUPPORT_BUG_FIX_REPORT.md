# Settings Languages & Support Bug Fix Report

## Outcome

All five requested Settings changes were implemented. Language enablement and translation completeness are now independent persisted states, English remains the protected fallback, and Tamil, Hindi, and Malayalam are excluded throughout the active application and database configuration.

## Root causes and fixes

1. **Language search** — Settings used a module-specific search/combobox. Both catalog and configured-language searches now use the shared debounced `SearchField`, including its clear action and case-insensitive name/native-name/code filtering.
2. **Retired languages** — `hi`, `ml`, and `ta` existed in the catalog, built-in translation object, configured-language records, and user preferences. They are excluded by catalog generation and API validation, removed from active frontend translation resources, and removed through a controlled migration after preferences are moved to English.
3. **Enable/disable** — The backend previously coupled enablement to 100% translation coverage. Super Admins can now enable incomplete languages independently; status persists in PostgreSQL and the header immediately reloads enabled options. English/default protection and role/permission middleware remain enforced.
4. **Translation Required** — The former button was permanently disabled with no workflow. Enabled non-English languages now open a real modal backed by persisted `LanguageTranslation` rows. Saving recalculates coverage; missing keys fall back to English.
5. **Languages and Support UI** — Languages now uses shared Search, Modal, and anchored Actions components with responsive list/toolbars and explicit empty search results. The existing compact Support cards, contact form, article modal, permissions, API submission, and notification behavior were reviewed and preserved.

## Database and API changes

- Applied `20261025120000_language_catalog_management`.
- Added and applied `20261025150000_language_translations`.
- Added `LanguageTranslation` with a unique `(languageId, key)` constraint and cascading cleanup.
- Added protected GET/PUT `/api/v1/languages/:code/translations` endpoints.
- Catalog/add/update/select operations reject `hi`, `ml`, and `ta`.
- Enabled-language responses include persisted translations for runtime localization.
- Only Super Admins with `settings.update` can manage language status or translations.

## Migration verification

Read-only PostgreSQL verification after deployment:

- Retired configured languages: **0**
- Preferences referencing retired languages: **0**
- English enabled: **true**
- English default: **true**
- English coverage: **100%**
- Initial managed translation rows: **0** (expected until an administrator saves a new pack)

## Files modified

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261025120000_language_catalog_management/migration.sql`
- `backend/prisma/migrations/20261025150000_language_translations/migration.sql`
- `backend/src/data/language-catalog.ts`
- `backend/src/data/translation-keys.ts`
- `backend/src/routes/language.routes.ts`
- `backend/src/services/language.service.ts`
- `backend/tests/language-catalog.test.ts`
- `backend/tests/security-validation.test.ts`
- `src/app/core/i18n/language.service.ts`
- `src/app/core/i18n/translations.ts`
- `src/app/core/i18n/translations.spec.ts`
- `src/app/features/administration/administration-api.service.ts`
- `src/app/features/settings/settings-page.ts`
- `src/app/features/settings/settings-page.html`
- `src/app/features/settings/settings-page.scss`
- `src/app/shared/components/actions-menu/app-actions-menu.ts`
- `src/app/shared/components/actions-menu/app-actions-menu.html`

## Verification status

| Check | Result |
|---|---|
| Controlled PostgreSQL migrations | Pass |
| Retired language/preference database verification | Pass |
| Backend TypeScript production build | Pass |
| Angular production build | Pass |
| Backend tests after expectation updates | Pass — 7 files, 41 tests |
| Angular regression suite | Pass — 53 files, 171 tests |
| Manual desktop/tablet/mobile browser walkthrough | Not Run |

## Remaining issues

- A manual browser walkthrough should still be performed against a running frontend/API to visually validate dropdown flipping, modal scrolling, and responsive breakpoints.
- Existing unrelated Angular warnings remain for unused Radiology Details imports and stylesheet budgets.
