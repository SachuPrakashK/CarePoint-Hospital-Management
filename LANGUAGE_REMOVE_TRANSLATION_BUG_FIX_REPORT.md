# Language Remove and Translation Bug Fix Report

## Outcome

Both Settings → Languages operations now work through Angular, the REST API, Prisma, and PostgreSQL:

- Translation Required loads the selected configured language, including a language with no translation rows.
- Translation values are saved against only the selected language and coverage is recalculated.
- Remove deletes the selected configured language, moves user preferences to the translated default language, refreshes frontend state, and makes the catalog language available for re-adding.

## Root causes

### Translation Required

`GET /api/v1/languages/:identifier/translations` used a validation schema that required an object request body. Browser GET requests do not normally have a body, so validation could return HTTP 422 before the route reached the translation service. The frontend converted that failure into `Translations could not be loaded.`

The route now accepts a bodyless request. An empty translation collection is returned successfully with the complete source-key list and an empty values object.

### Remove

`DELETE /api/v1/languages/:identifier` had the same mandatory-body validation defect. The failure was reproduced against the running API as:

- Request: `DELETE /api/v1/languages/{languageId}`
- Response: HTTP 422
- Code: `VALIDATION_ERROR`
- Detail: `Invalid input: expected object, received undefined`

The route now accepts a bodyless DELETE request. The verified response after the fix is HTTP 204.

### Identifier mapping

The UI previously sent a catalog code even though every configured language already has a stable PostgreSQL identifier. All configured-language operations now send `Language.id`. The backend resolves either an ID or a code for backward compatibility, then performs updates, translation queries, and deletion by the resolved database ID. The route validator now permits UUID-length identifiers.

### Failed-save data loss

The translation modal previously cleared its selected language in the `finally` block, including after a failed save. It now closes only after a confirmed successful response, preserving unsaved input when persistence fails.

## Files modified

### Frontend

- `src/app/features/settings/settings-state.ts`
- `src/app/features/administration/administration-api.service.ts`

### Backend

- `backend/src/routes/language.routes.ts`
- `backend/src/services/language.service.ts`
- `backend/tests/e2e-language-management.mjs`

## Database

No schema change was required. Prisma migration status reports all 25 migrations applied to the configured local PostgreSQL database, including the language translations table.

Removal uses the existing transaction to:

1. Move affected user language preferences to the valid translated default language.
2. Delete only the configured language record.

The global in-code language catalog and audit history are not deleted. Translation rows follow the existing configured-language cascade retention policy.

## Verification results

The end-to-end test created a previously unconfigured language and verified real API and database behavior before cleaning it up:

- Super Admin authentication: passed.
- Add a new configured language: HTTP 201.
- Enable using its database ID: HTTP 200.
- Load a language with zero translations: HTTP 200; source keys present; values empty.
- Save a translation: HTTP 200; persisted value returned.
- Unauthorized translation request: HTTP 403.
- Remove using the database ID: HTTP 204.
- Removed language absent from configuration: passed.
- Removed language remains available in the global catalog for re-adding: passed.
- Test record cleanup: passed.
- Prisma migration status: database schema up to date.
- Backend TypeScript production build: passed.
- Frontend Angular production build: passed.
- Backend Vitest suite: 7 files and 41 tests passed.

Existing unrelated Angular warnings remain for Radiology unused imports and stylesheet size budgets.

## Deployment note

The production/Vercel deployment must run `prisma migrate deploy` before serving the updated API. If the `LanguageTranslation` migration has not been applied to the production database, translation endpoints will correctly report a genuine database error rather than suppressing it.
