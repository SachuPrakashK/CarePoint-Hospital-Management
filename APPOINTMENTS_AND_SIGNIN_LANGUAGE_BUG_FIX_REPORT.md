# MediCare+ Appointments and Sign-In Language Bug Fix Report

Date: 29 October 2026

## Outcome

The appointment modal, completed-appointment protection, appointment details, invoice-action policy, and pre-authentication language requirements have been implemented and verified against the Angular application, Node.js API, and PostgreSQL-backed workflows.

## Root causes identified

- Gender and Payment Status filters had been accidentally placed inside the Reschedule modal, creating unrelated fields and alignment problems.
- Completed appointment rows still exposed Edit, and the appointment update API did not prevent reassignment to another patient.
- The Appointment Details page did not render demographic and billing fields already returned by the consolidated appointment query.
- Print and Download were shown without applying the persisted Billing payment status.
- The shared Actions menu had no disabled Reschedule state.
- Every language route was behind authentication. Broad `/api/v1` authenticated routers were also mounted before the language router, preventing a public language endpoint from being reached.
- The language service did not persist a pre-login selection or set the document direction.
- Authentication screens had no shared language selector and email inputs inherited RTL direction.

## Appointment modal fixes

- New Appointment now uses the full shared modal structure with an XL responsive width, padded scroll body, two bordered content sections, fixed header/footer, and Cancel/Book actions. It supports Existing Patient and New Patient modes.
- Reschedule is wrapped in the required modal form container, preserving its two-column grid instead of being overridden by the shared flex content rule. It contains only current appointment data, physician, new date, real available slots, and reason. The misplaced list filters were removed.
- Change Status is wrapped in the same fixed-header/body/footer structure and includes a responsive appointment/patient/current-status summary card, a field-specific Select placeholder, inline validation, loading protection, and Cancel/Update actions.
- All three use the shared modal design, responsive grids, existing validation styling, and protected close behavior.
- Close and Cancel are disabled while submission is running. Failed saves retain entered data and display errors without closing the modal.

## Completed appointment restrictions

- Edit is hidden in the completed appointment's Actions menu while View remains available.
- The backend rejects patient reassignment through a Completed appointment with HTTP 409 and code `COMPLETED_APPOINTMENT_PATIENT_READ_ONLY`.
- The separate Patients module remains unchanged, preserving authorized demographic-correction workflows.
- Reschedule is visible but natively disabled for Completed appointments, with the tooltip `Completed appointments cannot be rescheduled.`
- The backend independently rejects Completed reschedule requests with HTTP 409 `NOT_RESCHEDULABLE` before starting a database transaction.

## Appointment Details

The page is now organized into responsive Patient Information, Appointment Information, Billing & Payment Information, and Notes sections. It displays:

- Patient name, MRN, gender, age, and mobile number.
- Appointment reference, physician, specialty, department, date/time, status, type, and consultation type.
- Invoice reference, payment status, and outstanding balance.
- Notes when available.
- Missing optional values use an em dash.

Age is calculated from date of birth relative to the appointment date. Payment state is derived from persisted invoices, payments, and refunds by the existing backend financial service rather than appointment status.

## Invoice action policy

A centralized appointment action policy now applies the same rule to Print and Download:

- Visible only when `paymentStatus === 'Paid'` and `invoiceId` is present.
- Hidden for Pending, Partially Paid, Refunded, Not Billed, and missing-invoice cases.
- Existing billing-view authorization remains enforced on both invoice endpoints.
- Print continues to open the existing print-ready Billing invoice page.
- Download continues to retrieve the backend-generated PDF for the selected appointment's existing invoice; neither operation creates an invoice.
- Long downloaded invoices create additional A4 PDF pages instead of truncating content after the first page.

## Sign-in translation implementation

- Added `GET /api/v1/languages/public` before broad authenticated routers.
- The endpoint returns only enabled, non-excluded language metadata and saved translation values. Administrative update endpoints remain authenticated and role-protected.
- Added a reusable authentication language selector to Sign In, Forgot Password, and Reset Password screens.
- English remains the safe default. Only enabled languages appear; excluded Tamil, Hindi, and Malayalam codes remain filtered by the existing service policy.
- Selection updates text immediately through the centralized runtime translation service and existing DOM localization layer.
- The selection is stored locally before login, restored on refresh, and synchronized to the authenticated user preference after login when still enabled.
- Unavailable selections safely return to English.
- Arabic sets `lang="ar"` and `dir="rtl"`; English restores `lang="en"` and `dir="ltr"`.
- Email fields explicitly remain LTR. Authentication screens use an Arabic-capable system-font fallback and responsive logical positioning.
- Authentication, rate limiting, tokens, session persistence, password validation, and redirects were not bypassed or weakened.

## API and database changes

- Added the public read-only language endpoint; no schema migration was required.
- Added backend Completed-appointment patient reassignment enforcement.
- Existing reschedule conflict and transition enforcement remains in place.
- Existing consolidated appointment/billing queries supply details without per-field database requests.
- No invoice or payment calculation rules were changed.

## Principal files modified

- `backend/src/app.ts`
- `backend/src/routes/language.routes.ts`
- `backend/src/services/appointment.service.ts`
- `backend/tests/app.test.ts`
- `public/icons.svg`
- `src/app/app.config.ts`
- `src/app/core/i18n/language.service.ts`
- `src/app/features/auth/auth-language-selector.*`
- `src/app/features/auth/login-page.*`
- `src/app/features/auth/password-page.*`
- `src/app/features/appointments/appointment-action-policy.*`
- `src/app/features/appointments/pages/appointment-details.*`
- `src/app/features/appointments/pages/appointment-list.*`
- `src/app/shared/components/actions-menu/app-actions-menu.*`
- `tests/signin-language-browser.e2e.mjs`

## Tests actually executed

| Verification                           | Result                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Angular unit/component suite           | Pass — 57 files, 184 tests                                                                                                            |
| Backend unit/API suite                 | Pass — 8 files, 45 tests                                                                                                              |
| Backend TypeScript production build    | Pass                                                                                                                                  |
| Angular production build               | Pass                                                                                                                                  |
| Appointment PostgreSQL/API integration | Pass — nine workflow/financial scenarios                                                                                              |
| Appointment browser regression         | Pass — desktop, mobile, and RTL                                                                                                       |
| Sign-in language browser regression    | Pass — public load, enabled Arabic, live translation, RTL, mobile overflow, refresh persistence, English LTR restore, Forgot Password |
| Invoice PDF integration                | Pass — linked invoice values and valid PDF signature                                                                                  |
| Completed patient reassignment         | Pass — rejected before update                                                                                                         |
| Completed reschedule                   | Pass — rejected before transaction                                                                                                    |
| Actions policy combinations            | Pass — Paid, Pending, Partially Paid, Refunded, Not Billed, and missing invoice                                                       |
| Disabled shared-menu action            | Pass — visible, tooltip present, no emitted event                                                                                     |
| Persisted Actions menu browser matrix  | Pass — Paid/Completed and Pending/Confirmed rows verified against real invoice and payment records                                    |
| Multipage invoice PDF                  | Pass — 110 lines rendered across three A4 pages without truncation                                                                    |
| Isolated rendered modal browser test   | Pass — all three modals, fixed footer structure, preserved grid, scroll body, mobile overflow, and unrelated-field removal            |

## Remaining non-blocking limitations

- Physician availability still uses persisted appointment conflicts plus the configured clinic-hours fallback because the current schema has no physician roster table.
- Existing unrelated Angular warnings remain for unused Radiology imports and pre-existing stylesheet budget overruns.
