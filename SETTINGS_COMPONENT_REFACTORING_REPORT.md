# Settings Component Refactoring Report

## Outcome

The Settings module now uses a navigation-only page component, a route-scoped state service, and six independent standalone tab components:

1. Hospital Settings
2. Application Settings
3. Notification Settings
4. Security Settings
5. Language Settings
6. Support Settings

The existing Settings stylesheet remains the single visual source of truth. The page uses non-emulated encapsulation only for this Settings-scoped stylesheet so the extracted child views retain the existing appearance and responsive rules without duplicating styles.

## Architecture

- `SettingsPage` owns the page heading, tab navigation, active tab, and route guard delegation.
- `SettingsState` owns the route-scoped forms, API operations, loading/saving state, permissions, language management, support contacts, article management, logo lifecycle, and dirty-state checks.
- Each tab is a standalone Angular component with its own template and only the shared controls it uses.
- The state service is provided by `SettingsPage`, so all tabs share one Settings session and it is destroyed when the route is left.

## Add Article improvements

- Category: `Enter article category`
- Related module: `Enter related module (optional)`
- Title: `Enter article title`
- Article content: `Enter article content`
- Publication status: disabled empty `Select publication status` option
- New articles no longer receive an implicit status selection. The required validator prevents submission until a real status is chosen.
- Existing article status values continue to be restored in edit mode.

## Functional preservation

- Existing reactive forms and validators are retained.
- Existing API calls, backend-confirmed success notifications, and error handling are retained.
- Hospital logo loading/upload/deletion remains in the shared state lifecycle.
- Language catalog, batch add, translations, enable/default/remove actions remain connected to their existing APIs and permissions.
- Support contacts and help article create/edit/delete behavior remain connected to their existing APIs.
- Unsaved changes across every tab and modal are still covered by the route guard.

## Verification

- Angular production build: passed.
- Angular template compilation for all six extracted tabs: passed.
- Full frontend test run: 51 test files and 164 tests passed. The run did not complete cleanly because two Vitest workers exhausted the available JavaScript heap; one unrelated pre-existing password-page test then timed out. No Settings compilation or Settings runtime test failure was reported.
- Existing build warnings remain limited to unrelated Radiology unused imports and existing stylesheet budget warnings.
