# Hospital Management Application

MediCare+ is an Angular 22 hospital operations application with a Node.js/Express REST API, Prisma ORM, PostgreSQL, and amCharts 5 dashboards.

## Technology

- Angular 22.1 with standalone components and lazy feature routes
- TypeScript 6 strict mode
- Angular Signals and RxJS
- Reactive Forms
- SCSS with centralized Serenity in Blue design tokens
- Vitest through Angular's unit-test builder
- Local SVG icon sprite and SVG branding

- amCharts 5 for API-backed dashboard visualizations
- Node.js, Express, Prisma and PostgreSQL backend

## Features

Authentication and frontend RBAC, users and roles, patients, doctors and staff, appointments, OPD consultation, EMR, laboratory, radiology, admissions and beds, nursing, procedures and OT, pharmacy, billing, insurance, procurement, ambulances, documents, reports and audit logs.

The Patients module is the reference enhanced CRUD workflow with shared search, empty state, right-side create/edit drawer, validation, loading feedback, action menu, confirmation and toast feedback.

## Prerequisites

- Node.js 24 or another version supported by Angular 22
- npm 12+
- Docker Desktop (for the isolated development PostgreSQL service)

## Installation

```bash
npm install --include=dev
```

## Development server

```bash
cd backend && npm run dev
# In a second terminal, from the repository root:
npm start
```

Open `http://localhost:4200`. Angular proxies `/api` requests to the backend on `http://localhost:3000`; both processes must be running for login and registration.

## Build and tests

```bash
npm run build
npm test
```

The production output is written to `dist/hospital-management`.

## Architecture

```text
src/app/
  core/          authentication, guards, interceptors, stores, services
  shared/        reusable components and domain models
  layout/        responsive application shell
  features/      lazy-loaded domain features
```

Signal stores expose read-only state and enforce client-side workflow invariants. Components handle presentation and interaction. Functional guards protect routes and functional interceptors apply authentication, safe errors and reference-counted loading state.

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY_REVIEW.md](SECURITY_REVIEW.md) and [API_CONTRACT.md](API_CONTRACT.md).

## Database and backend setup

1. Start Docker Desktop and ensure its Linux/WSL engine is operational.
2. Run `docker compose up -d postgres`.
3. Copy `backend/.env.example` to the ignored `backend/.env` and configure `DATABASE_URL`. This repository maps PostgreSQL to host port 5433 to avoid collisions with a local default instance: `postgresql://hospital_app:hospital_dev_password@localhost:5433/hospital_management?schema=public`.
4. Run `cd backend && npm install --include=dev`.
5. Run `npm run prisma:generate`.
6. Run `npm run prisma:deploy` for checked-in migrations, or `npm run prisma:migrate -- --name complete_phase_1_3_domains` while developing a schema change.
7. Set secure development seed values and run `npm run prisma:seed`.
8. Run `npm run dev`; separately run `npm start` from the repository root for Angular.

Production must use environment-specific credentials and signing secrets. Never reuse the Compose development password.

Check database health with `docker compose ps`. The backend runs on the host during development; a backend container added later should connect to `postgres:5432`, not `localhost:5433`.

## Theme and icons

Theme tokens are in `src/theme.scss`. The requested font stack is `Poppins, sans-serif`; local font package installation may be needed on machines without Poppins installed. Interface icons use `public/icons.svg`. Full and collapsed logos are `public/logo-full.svg` and `public/logo-mark.svg`.

## Formatting

```bash
npx prettier --write "src/**/*.{ts,html,scss}"
```

No lint script is currently configured.

## Security and deployment

Deploy only behind HTTPS with an appropriate CSP, HSTS, CORS and CSRF policy. Server-side authentication, authorization, validation, rate limiting, audit persistence and file scanning are mandatory. Never place patient data, tokens or payment details in URLs or logs.

Serve the generated SPA from a hardened web server and route unknown application paths to `index.html`.

### Vercel

The repository includes `vercel.json` and a serverless Express entry point under `api/`. Vercel serves the Angular application and keeps the existing same-origin `/api/v1` requests working through a Node.js function.

Configure these environment variables for Production, Preview and Development before deploying:

- `NODE_ENV=production`
- `DATABASE_URL` using a pooled, serverless-compatible PostgreSQL connection string
- `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`, each at least 32 characters
- `FRONTEND_URL` set to the production Vercel URL or custom domain
- `FRONTEND_RESET_URL` set to `<FRONTEND_URL>/auth/reset-password`
- `STORAGE_DRIVER=vercel-blob` so production uploads cannot fall back to ephemeral disk
- A private Vercel Blob connection using `BLOB_READ_WRITE_TOKEN`, or `BLOB_STORE_ID` with Vercel OIDC
- Optional mail variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- Optional notification variable: `NOTIFICATION_WEBHOOK_URL`

Apply the checked-in database migrations to the production database before first use:

```bash
cd backend
npm run prisma:deploy
```

Then deploy from the repository root:

```bash
vercel --prod
```

Documents, profile images and hospital logos use the shared storage adapter. Development defaults to `FILE_UPLOAD_PATH`; production fails closed unless `STORAGE_DRIVER=vercel-blob` and private Blob credentials are configured. Existing local objects are not automatically migrated—reconcile and copy them before enabling the affected production workflows.

## Troubleshooting

- `NG05104`: ensure `src/index.html` contains `<hms-root>`.
- PowerShell may block `npm.ps1`; use `npm.cmd`.
- `EBUSY` during dependency installation usually means a running development/build process has locked the Sass binary. Stop that process and retry.
