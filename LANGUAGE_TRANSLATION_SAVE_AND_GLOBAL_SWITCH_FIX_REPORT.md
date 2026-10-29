# Language Translation Save and Global Switch Fix Report

## Outcome

The two critical language defects are fixed across Angular, REST, Prisma, and PostgreSQL:

- Saved translations are loaded from PostgreSQL and populated by stable translation key whenever the editor reopens.
- Existing translations can be edited and saved again.
- Separate languages retain isolated dictionaries.
- Header language selection uses the same persisted dictionary as the translation editor.
- Application UI updates reactively without a browser refresh.
- Missing translations continue to display their English source text.

## Root causes

### Saved translations appeared missing after reopening

The backend returned the saved values correctly, but the editor reset to the `missing` filter whenever it opened. Successfully translated entries were therefore immediately filtered out, making persistence appear broken.

The editor now opens in `all` mode. Existing values returned by the API populate `translationValues` by their stable translation keys and are visible/editable immediately.

The loading workflow also lacked request identity. A late response could populate state after another language had been selected or the modal had closed. Each load now receives a monotonically increasing version. State is cleared before loading, and responses are applied only when both the request version and selected language ID still match.

### Save completion behavior

The modal previously attempted to close while `translationsSaving` was still true, so its own close guard rejected the operation. Persistence and refresh were also handled as one failure boundary, allowing a later refresh error to be reported as a save failure.

The corrected sequence is:

1. Validate selected language and prevent duplicate submission.
2. Persist the complete key/value map for that language.
3. Wait for the confirmed API response.
4. Display the success notification.
5. Clear the saving state and close the editor.
6. Refresh language status and runtime dictionaries separately.
7. Report a refresh error separately without claiming the save failed.

If persistence fails, the editor remains open and retains all unsaved values.

### Global language switching

The original application localized only 28 navigation/header keys. The active language signal could change, but most routed interface text was disconnected from it.

The application now uses one centralized `LanguageService` and one generated source catalog. `DomLocalizationService` reacts to the active language and runtime dictionary signals and localizes existing and dynamically created interface content, including routed pages, tables, forms, placeholders, modal content, shared overlays, confirmation dialogs, and toast notifications.

The observer preserves each original English value, handles legitimate Angular text changes such as Save → Saving, and restores English immediately when switching back. User-entered form values and application records are not translated.

Header selection now:

- Rejects disabled or stale languages.
- Prevents duplicate selection requests.
- Persists the preference before changing the active language.
- Reverts to the previous language on API failure.
- Falls back to English when a language is no longer available.

## Stable translation keys

The current generated catalog contains 1,994 unique keys. Frequently reused labels now have stable semantic keys, including:

- `common.save`
- `common.cancel`
- `common.create`
- `common.edit`
- `common.delete`
- `common.actions`
- `common.search`
- `common.close`
- `common.next`
- `common.previous`

For example, saving `common.save → Enregistrer` for a language updates every catalogued Save label when that language is selected.

Catalog commands:

- `npm run i18n:generate`
- `npm run i18n:check`

## Backend persistence and performance

Translations remain stored in the existing `LanguageTranslation` table with:

- Language ID
- Stable translation key
- Translation value
- Created and updated timestamps
- Unique `(languageId, key)` constraint

No second storage system or Prisma migration was introduced.

Large saves no longer execute one sequential upsert per field. A bounded transaction deletes only submitted keys for the selected language, bulk inserts their non-empty replacements, recounts completion, and updates coverage. Unsubmitted keys and other languages remain untouched.

## Files modified

### Frontend

- `src/app/core/i18n/language.service.ts`
- `src/app/core/i18n/translate.pipe.ts`
- `src/app/core/i18n/translations.ts`
- `src/app/core/i18n/ui-catalog.ts`
- `src/app/core/i18n/dom-localization.service.ts`
- `src/app/core/i18n/dom-localization.service.spec.ts`
- `src/app/app.config.ts`
- `src/app/features/settings/settings-state.ts`
- `src/app/features/settings/tabs/language-settings-tab.html`
- `src/app/features/settings/tabs/language-settings-tab.ts`
- `src/app/features/settings/tabs/language-settings-tab.scss`
- `src/app/features/administration/administration-api.service.ts`

### Backend

- `backend/src/data/translation-keys.ts`
- `backend/src/routes/language.routes.ts`
- `backend/src/services/language.service.ts`
- `backend/tests/e2e-language-management.mjs`

### Tooling

- `scripts/generate-i18n-catalog.mjs`
- `package.json`

## Module coverage

The catalog audit covers all current Angular modules: Dashboard, Patients, Appointments, OPD & Queue, Clinical EMR, Admissions & Beds, Nursing, Procedures & OT, Laboratory, Radiology, Pharmacy, Billing, Insurance, Inventory & Operations, Doctors, Employees, Roles & Permissions, Documents, Reports, Audit Logs, Settings, Help & Support, authentication, and shared UI components.

Names, identifiers, clinical notes, uploaded content, and other user-generated data remain intentionally untranslated.

## Tests actually executed

### PostgreSQL/API integration

A temporary pair of configured languages was created and removed during the test. The test verified:

- Empty first-time translation dictionary loads successfully.
- A 600-entry batch persists.
- Reopening returns the saved values.
- Updating a saved value replaces the previous value.
- Reopening after the update returns the updated value.
- A second language stores a different value for the same key.
- Updating one language does not affect the other.
- The enabled-language runtime endpoint contains the saved `common.save` value.
- Preference selection succeeds for the enabled language.
- Unauthorized translation access returns HTTP 403.
- Removed languages return to the add-language catalog.
- Temporary test records were cleaned up.

### Compilation and automated tests

- Angular production build: passed.
- Backend TypeScript build: passed.
- Full Angular suite: 55 files, 174 tests passed.
- Focused localization suite: 2 files, 4 tests passed.
- Backend suite: 7 files, 41 tests passed.
- Translation catalog validation: passed with 1,994 unique keys.

The reactive DOM test verifies French translation, translated attributes, dynamic Angular text changes, and switching back to English.

No configured Playwright/browser traversal suite exists in the repository, so a full visual route-by-route browser regression was not claimed. Existing compiler warnings remain limited to unrelated Radiology unused imports and stylesheet warning budgets.

## Remaining translation content

English is complete because it is the shipped source catalog. Other languages are complete only when all 1,994 approved translations exist in PostgreSQL. No translations were fabricated. Missing entries remain pending in Settings and render through the English fallback instead of exposing raw keys.
