# Settings Language Bug Fix Report

## Root causes and resolutions

### Settings initialization 404

The Settings constructor legitimately requests the optional hospital logo. When no logo exists, the logo endpoint returns 404, but the global API interceptor converted that expected absence into “The requested record was not found.” The logo request now carries `X-Handle-Error-Locally`; `loadLogo()` continues to show the normal fallback logo while all other Settings errors remain globally visible.

### English Actions menu

The language row rendered the Actions trigger for every language. English now retains its visible Default and Enabled indicators but renders no menu and uses a two-column row layout with no reserved Actions space. Backend default-language protections remain unchanged.

### Add Language selection

The previous workflow stored one catalog item and submitted one request. A reusable shared searchable multi-select now supports checkboxes, removable chips, selected count, clear selection, disabled configured options, and responsive dropdown behavior. English, Hindi, Malayalam, and Tamil are excluded.

The new Super Admin batch endpoint validates every code, rejects duplicates/configured languages, and creates all selected languages in one Prisma transaction. A failure rolls back the complete batch; selection clears only after success.

### Translation Required targeting

The selected `AppLanguage` object, including its unique ID and code, is retained for the modal. Each open clears/reloads keys and values through the selected code endpoint, hides prior values while loading, and saves only to the language resolved by that code. The list and header runtime translations refresh after saving.

## Modified files

- `backend/src/routes/language.routes.ts`
- `backend/src/services/language.service.ts`
- `src/app/features/administration/administration-api.service.ts`
- `src/app/features/settings/settings-page.ts`
- `src/app/features/settings/settings-page.html`
- `src/app/features/settings/settings-page.scss`
- `src/app/shared/components/multi-select/shared-multi-select.ts`
- `src/app/shared/components/multi-select/shared-multi-select.html`
- `src/app/shared/components/multi-select/shared-multi-select.scss`
- `src/app/shared/components/multi-select/shared-multi-select.spec.ts`
- `SETTINGS_LANGUAGE_BUG_FIX_REPORT.md`

## API and database behavior

- Added atomic `POST /api/v1/languages/batch` for 1–50 language codes.
- Existing Super Admin role and `settings.update` permission middleware protects the endpoint.
- Existing language and translation tables are reused; no additional migration was required for this follow-up.
- English remains enabled/default and cannot be disabled, removed, or edited through translation management.

## Tests executed

| Check | Result |
|---|---|
| Angular regression suite | Pass — 54 files, 172 tests |
| Backend test suite | Pass — 7 files, 41 tests |
| Backend TypeScript build | Pass |
| Shared multi-select selection/disabled/clear behavior | Pass |
| Prior PostgreSQL retired-language verification | Pass — 0 retired languages and 0 retired preferences |
| Manual browser responsive walkthrough | Not Run |

## Remaining issues

- A manual browser walkthrough is still recommended for visual validation at desktop, tablet, and mobile widths.
- Existing unrelated warnings remain for unused Radiology Details imports and stylesheet size budgets.
