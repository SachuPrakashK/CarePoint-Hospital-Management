# MediCare+ Insurance UI Bug Fix Report

Date: 24 October 2026

## Fix status and root causes

| Issue                         | Status | Root cause and resolution                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dropdown height changes       | Pass   | Insurance fields did not reserve a dedicated validation row. Selects now use a fixed 43px control row and validation is rendered beneath the control without changing its height.                                                                                                                             |
| Incorrect validation colors   | Pass   | The module inherited mixed legacy danger colors. Invalid controls and messages now use `#DC2626`, `#FEF2F2`, and `#FCA5A5`, with a preserved accessible focus ring.                                                                                                                                           |
| Missing Select placeholders   | Pass   | Several native selects relied on initialized values or enabled empty options. Patient, provider, policy, invoice, priority, and status selects now expose disabled empty placeholders while edit values remain intact.                                                                                        |
| Missing Add Policy scrollbar  | Pass   | `overflow: auto hidden` assigned `auto` to the horizontal axis and `hidden` to the vertical axis. The body now explicitly uses `overflow-y: auto`, `overflow-x: hidden`, and the existing `min-height: 0` flex layout.                                                                                        |
| Delete icon in claim approval | Pass   | The shared confirmation dialog always rendered a trash icon. It now accepts an intent icon and automatically uses approval styling for non-danger confirmations; claim approval requests `check-circle`.                                                                                                      |
| Incorrect global toast colors | Pass   | The shared toast container only colored a small dot while retaining a neutral card. Success and error cards now use the specified backgrounds, borders, text colors, SVG icons, wrapping layout, and close-button colors. Insurance feedback now uses the global Toast service instead of a local navy toast. |

## Files modified

- `src/app/features/insurance/pages/insurance-form.html`
- `src/app/features/insurance/pages/insurance-form.ts`
- `src/app/features/insurance/pages/insurance-form.scss`
- `src/app/features/insurance/pages/insurance-page.html`
- `src/app/features/insurance/pages/insurance-page.ts`
- `src/app/core/services/confirmation.service.ts`
- `src/app/shared/components/confirmation-dialog/confirmation-dialog.html`
- `src/app/shared/components/confirmation-dialog/confirmation-dialog.scss`
- `src/app/shared/components/confirmation-dialog/confirmation-dialog.spec.ts`
- `src/app/shared/components/toast-container/toast-container.html`
- `src/app/shared/components/toast-container/toast-container.scss`
- `src/app/shared/components/toast-container/toast-container.spec.ts`
- `public/icons.svg`

## Shared component changes

- Confirmation requests support an optional icon while retaining the existing destructive default.
- Non-danger confirmations receive a teal approval icon treatment.
- The global toast container renders semantic success/error SVG icons and full-card state colors.
- Added the reusable `alert-circle` symbol to the application SVG sprite.

## Functional preservation

- Insurance reactive-form controls and existing API payloads are preserved.
- A newly created provider or policy still defaults to active when the optional status placeholder remains unchanged.
- Existing edit records populate their persisted status and priority.
- The approval request, authorization, transition validation, persistence, and refresh workflow are unchanged.
- Modal backdrop and Escape behavior remain unchanged.

## Tests executed

| Test                                 | Result  | Notes                                                                                              |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------- |
| Angular production build             | Pass    | `npm run build` completed successfully. Existing unrelated component-style budget warnings remain. |
| Frontend focused unit tests          | Pass    | 2 files and 4 tests passed for toast state/icons, dismissal, and approval icon selection.          |
| Backend build/tests                  | Not Run | No backend behavior was changed in this work package.                                              |
| Manual desktop responsive inspection | Not Run | Requires an interactive browser session.                                                           |
| Manual tablet/mobile inspection      | Not Run | Requires an interactive browser session.                                                           |
| Live Save/Approve API operations     | Not Run | Existing business operations were not invoked against live data.                                   |

## Remaining issues

- Browser-based visual checks at desktop, tablet, and mobile widths remain necessary before release.
- No dark theme is currently defined by the application; toast colors use the requested accessible light-theme palette.
