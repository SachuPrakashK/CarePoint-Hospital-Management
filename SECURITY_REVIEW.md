# Security, privacy, accessibility and production-readiness review

## Security posture

- Routes and sensitive UI actions use permission checks, but every production API must independently authorize the tenant, role, record and action. Client RBAC is not a security boundary.
- The current development session uses `sessionStorage`. Production authentication should use short-lived sessions with refresh rotation in Secure, HttpOnly, SameSite cookies. Add CSRF tokens for cookie-authenticated state changes and revoke sessions server-side.
- Angular template binding provides contextual output escaping. Avoid bypassing sanitization; apply server-side validation and canonicalization to all fields.
- Errors are translated by the API interceptor and do not expose stack traces. Production telemetry must redact tokens, patient identifiers, clinical content and payment data.
- Upload endpoints must validate size, media type and file signatures, rename stored files, scan for malware, isolate object storage, encrypt at rest, and return short-lived authorized download links.
- Audit, lab verification, stock, medication and financial ledgers require append-only server storage. Database transactions and row-level locking must enforce stock, bed, payment and scheduling invariants.
- Payment card data must go directly through a compliant payment provider. The application should retain only provider references and permitted masked metadata.
- Use TLS, CSP, frame restrictions, HSTS, dependency scanning, secret management, encrypted backups, restore testing and environment-specific configuration before deployment.
- Technical safeguards alone do not establish HIPAA, GDPR, DPDP, PCI DSS or local healthcare compliance. Legal basis, retention, consent, breach response, data residency and processor agreements require jurisdiction-specific review.

## Accessibility and responsive review

Primary workflows use native labels, buttons, links, tables, focus-visible indicators and modal dialog semantics. Layouts collapse at 1050px/850px/650px for laptop, tablet and mobile. Wide clinical and financial tables remain horizontally scrollable. Before release, complete manual keyboard and screen-reader testing, automated WCAG scanning, zoom/reflow testing, and contrast verification with real branding.

## Performance

All features are route-lazy-loaded. Stores use computed signals for derived totals and alerts without unmanaged subscriptions. Production list/report endpoints must provide server pagination, sorting, filtering, aggregation and export jobs. Use thumbnail generation for images, cache stable masters, debounce search requests and avoid loading clinical documents into list responses.
