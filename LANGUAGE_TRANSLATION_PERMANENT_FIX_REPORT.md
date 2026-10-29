# MediCare+ Language Translation Permanent Fix Report

Date verified: 28 October 2026

## 1. Root causes

1. `LanguageSettingsTab` bound the form to `(ngSubmit)` without importing `FormsModule`. The dirty state enabled the visible Save button, but Angular had no `NgForm` directive and no translation PUT request was emitted.
2. The editor originally submitted the complete translation dictionary instead of maintaining an explicit set of modified keys.
3. The backend treated a submitted dictionary like a replacement set: submitted rows were deleted and recreated inside a long-running transaction. This performed unnecessary writes and made omitted-value semantics unsafe.
4. The editor initially emphasized missing translations, which could hide an already persisted value and make reopening appear unsuccessful.
5. Translation loads did not sufficiently isolate late responses when users changed or closed the selected language.
6. Save persistence and post-save catalog/runtime refresh were handled as one failure boundary, allowing a successful database write to be presented as a failed save.

## 2. Frontend changes

- `src/app/features/settings/tabs/language-settings-tab.ts`
  - Imports `FormsModule`, activating the existing `(ngSubmit)` binding.
- `src/app/features/settings/tabs/language-settings-tab.html`
  - Keeps the Save button disabled during save and disables fields while a save is in flight.
  - Displays all translations when the editor opens so existing values remain visible.
- `src/app/features/settings/settings-state.ts`
  - Tracks modified values in `translationChanges`.
  - Sends only changed keys.
  - Clears a key from the change set when its value is restored to the saved baseline.
  - Prevents repeated Save requests with `translationsSaving`.
  - Preserves values and dirty state after failure.
  - Closes only after the save response confirms persistence.
  - Separates post-save language/runtime refresh errors from persistence errors.
  - Uses a load version to prevent a stale response from another language populating the editor.
- `src/app/features/administration/administration-api.service.ts`
  - Defines the partial-update response, including persisted values, updated keys, counts, and coverage.
- `src/app/core/i18n/language.service.ts`, `translate.pipe.ts`, and `dom-localization.service.ts`
  - Maintain reactive runtime dictionaries, persisted user preference, immediate switching, and English fallback.

## 3. Backend changes

- `backend/src/routes/language.routes.ts`
  - Validates the language identifier, value shape, lengths, and batch size.
  - Retains Hospital Admin/Super Admin authorization through the existing settings permissions and role middleware.
- `backend/src/services/language.service.ts`
  - Implements partial-update semantics: omitted keys are never changed or deleted.
  - Rejects unknown catalog keys with `422 INVALID_TRANSLATION_KEY`.
  - Upserts only non-empty changed values by `(languageId, key)` in bounded batches.
  - Deletes a row only when that specific submitted key is explicitly cleared.
  - Recalculates coverage from persisted rows.
  - No extended transaction timeout is used as a workaround.
- `backend/src/data/translation-keys.ts`
  - Uses the generated canonical 1,994-key catalog shared with the frontend source catalog.

## 4. Prisma and database

No schema migration was required. The existing constraint is correct and prevents duplicate translations:

```prisma
@@unique([languageId, key])
```

`LanguageTranslation` remains related to `Language` with cascade deletion. Language configuration is global in the current schema; there is no hospital/tenant column on these models to scope further.

## 5. API contract

Endpoint:

```http
PUT /api/v1/languages/{languageId}/translations
```

One-field partial update:

```json
{
  "values": {
    "common.save": "Sauvegarder"
  }
}
```

Successful response includes the complete database-backed dictionary and update metadata:

```json
{
  "data": {
    "code": "fr",
    "values": {
      "common.save": "Sauvegarder"
    },
    "updatedKeys": ["common.save"],
    "completedKeys": 1,
    "missingKeys": 1993,
    "translationCoverage": 0
  }
}
```

Values not present in `values` are preserved. An explicitly submitted blank value removes only that key so English fallback applies.

## 6. Persistence verification

The live integration test used disposable languages and the configured PostgreSQL database.

- Saved 600 translations in one language.
- Reopened and verified `common.save = Enregistrer`.
- Queried `LanguageTranslation` directly through Prisma and found the expected row.
- Updated only `common.save` to `Sauvegarder`.
- Verified the request reported exactly one updated key.
- Verified all 599 omitted translations remained unchanged and the total remained 600.
- Verified exactly one `(languageId, common.save)` row existed after the update.
- Saved a different value in a second language and verified language isolation.
- Rejected an invalid language with 404, an unknown key with 422, and an unauthorized role with 403.
- Removed all disposable test languages after verification.

## 7. Save, reopen, and failure tests

The real Edge browser test exercised the rendered Angular UI:

1. Opened Settings → Languages → Translation Required.
2. Entered `common.save`.
3. Clicked the visible Save translations button.
4. Captured and asserted the actual PUT payload contained only `common.save`.
5. Asserted HTTP 200 and the returned persisted value.
6. Confirmed the modal closed after the response.
7. Queried the API/database-backed value.
8. Reopened the editor and confirmed the field was populated.
9. Edited the value and saved again.
10. Confirmed the updated value persisted.

The Angular state test also verifies that a failed save keeps the editor open, retains the unsaved value, preserves dirty state, and produces an error notification without a false success.

## 8. Global switching verification

The browser test saved a runtime value for `nav.dashboard`, selected the disposable language from the header, and confirmed the sidebar updated immediately. After a full page reload, the selected language and translated navigation label remained active. Selecting English restored `Dashboard`.

The integration test also confirmed the enabled-language endpoint exposes the saved runtime dictionary. Missing keys continue to resolve through the English catalog.

## 9. Coverage and missing keys

- Canonical catalog: 1,994 unique keys.
- English source coverage: 1,994/1,994.
- Non-English coverage is calculated from actual persisted rows and returned as `completedKeys`, `missingKeys`, and `translationCoverage`.
- The UI exposes All and Missing views; it does not claim a language is complete when values are absent.
- Clinical records, patient data, and user-entered values are excluded from automatic DOM translation.

## 10. Verification results

- Angular production build: passed.
- Backend TypeScript build: passed.
- Angular focused translation tests: 2 files, 2 tests passed.
- Full Angular suite: 56 files, 175 tests passed.
- Full backend suite: 7 files, 41 tests passed.
- PostgreSQL/API integration workflow: passed.
- Browser Save → Reopen → Edit → Save Again: passed.
- Browser header switch → UI update → refresh persistence → English restore: passed.
- Translation catalog validation: 1,994 unique keys, current.
- Prettier repository validation: passed before final report generation; final touched files were formatted again.

## 11. Remaining limitations

- Complete non-English application coverage still depends on administrators entering translations for all missing keys.
- Existing Angular build warnings for unused Radiology imports and component stylesheet budget overruns are unrelated to translation persistence.
- No deployment or production-database write was performed; verification used the locally configured PostgreSQL environment and disposable records.
