# Global Character Encoding Bug Fix Report

## Summary

Confirmed mojibake was removed from the Angular templates and regenerated translation catalogs. The application already declared UTF-8 correctly in HTML and editor configuration, and Express already serves JSON as `application/json; charset=utf-8`. The defect was therefore stored source text that had previously been decoded and saved with the wrong character encoding, not a current browser or API response-decoding problem.

## Root cause

- Several template literals contained UTF-8 characters that had been interpreted as Windows-1252/Latin-1 and then committed in that corrupted form.
- The translation-catalog generator correctly read source files as UTF-8, but it propagated those already-corrupted literals into both frontend and backend catalogs.
- No manual runtime encode/decode transformation was found in the application or translation save/load path.

Existing safeguards confirmed during the audit:

- `src/index.html` declares `<meta charset="utf-8" />`.
- `.editorconfig` declares `charset = utf-8`.
- Express JSON responses include `charset=utf-8`.
- CSV responses and browser-created CSV blobs explicitly use UTF-8.

## Corrected text

Confirmed corrupted sequences were restored to their intended characters, including:

- Ellipsis in create, update, save, submit, process, record, admit, and loading states.
- Middle dot separators.
- Rupee symbols.
- Multiplication/close symbols.
- Right arrows.
- Typographic apostrophes.
- The inpatient bed-status geometric symbol.

The corrections cover patients, appointments, billing, support, operations, laboratory, nursing, procedures, inpatient/admissions, and radiology templates. The generated frontend and backend translation catalogs were then rebuilt from the corrected source.

## Regression protection

- Added `npm run encoding:check`, which scans frontend source, backend source, Prisma files, tests, and public text assets for high-confidence mojibake patterns while leaving legitimate multilingual Unicode untouched.
- Added UTF-8 and translation-catalog checks to the frontend CI job.
- Added unit assertions for representative loading labels, punctuation, and currency symbols.
- Added a patient-form rendering test for the exact `Creating…` and `Updating…` progress states.
- Extended the translation persistence E2E scenario with Arabic, an em dash, an ellipsis, accented Latin text, and a rupee symbol.
- Added `npm run encoding:audit-db` in the backend. It performs a read-only scan and reports only affected table/column counts, never stored values.

## Database findings

The production PostgreSQL audit completed successfully across 484 text columns. No known mojibake pattern was found. No database content was updated, and no backup or repair operation was necessary.

## Verification performed

- `npm run encoding:check` — passed.
- `npm run i18n:check` — passed; 2,056 translation keys current.
- Frontend unit suite — passed: 57 files, 186 tests.
- Focused encoding regression suite after the patient-form assertion was added — passed: 2 files, 10 tests.
- Angular production build — passed with pre-existing unused-import and style-budget warnings.
- Backend unit/integration suite — passed: 8 files, 45 tests.
- Backend TypeScript build — passed.
- Production database encoding audit — passed: 484 text columns checked.
- Repository scan after catalog regeneration — no confirmed mojibake occurrences remained.

The language-management E2E script was enhanced for Unicode persistence but was not run because it requires a separately started, seeded API/database E2E environment. Existing frontend and backend suites, production data audit, and builds completed successfully.

## Remaining issues

- The Angular build continues to report unrelated pre-existing unused imports in `RadiologyDetails` and style-budget warnings.
- The enhanced full language-management E2E scenario should run in the seeded release environment before the next release.
