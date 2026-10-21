# MediCare+ Production Risk Register

Audit date: **2026-10-21**

Scoring: likelihood and impact are 1–5; score is their product. Scores 15–25 are critical, 8–12 high, 4–6 medium, and 1–3 low.

| ID | Risk | L | I | Score | Release treatment | Owner/evidence required |
|---|---|---:|---:|---:|---|---|
| R-01 | Uploaded documents disappear after a container redeployment while database records remain | 5 | 5 | 25 | Block release until private durable storage is verified or upload/download workflows are disabled | Engineering: persistence and authorization tests |
| R-02 | Profile images and hospital logo disappear after redeployment | 5 | 3 | 15 | Move all upload types through the same adapter or disable affected writes | Engineering: redeployment test |
| R-03 | Database cannot be restored after corruption/operator error | 3 | 5 | 15 | Confirm automated backups/retention and complete an isolated restore test | Operations: provider configuration and restore evidence |
| R-04 | Concurrent or retried payment requests overpay an invoice | 3 | 5 | 15 | Add serialization/idempotency and concurrent-request tests | Engineering/QA: database and API tests |
| R-05 | Approved refunds leave invoice status and receivables incorrect | 4 | 4 | 16 | Centralize net-paid/balance/status calculation and test partial/full refunds | Engineering/Finance: reconciled fixtures |
| R-06 | Service reports healthy while database is unavailable | 4 | 4 | 16 | Add database-aware readiness; alert on failures | Engineering/Operations: forced-failure check |
| R-07 | Critical endpoint lacks record/action authorization despite frontend RBAC | 3 | 5 | 15 | Execute negative permission matrix; fix critical gaps | Security/QA: 401/403 evidence |
| R-08 | Sensitive patient or token data leaks through logs | 2 | 5 | 10 | Expand redaction review and inspect failure logs | Security: log samples without PHI/secrets |
| R-09 | No external exception alert reaches an operator | 4 | 4 | 16 | Configure Vercel/log-drain alerting or name a monitored fallback | Operations: test alert receipt |
| R-10 | Appointment reminders are promised but no approved patient-delivery system exists | 4 | 3 | 12 | Mark blocked until provider, consent, template and delivery logging exist | Product/Compliance: written approval |
| R-11 | Browser/API regressions reach production because CI is absent | 4 | 4 | 16 | Add minimum CI and a repeatable release test command | Engineering: green protected pipeline |
| R-12 | Access permissions remain in a JWT briefly after a role is revoked | 3 | 4 | 12 | Verify timeout and session revocation policy; document residual window | Security/Product: accepted maximum window |
| R-13 | Upload validation accepts malicious content hidden in an otherwise valid file | 3 | 5 | 15 | Add scanning/quarantine if available; otherwise document and restrict production uploads | Security/Operations: scanner result or blocker |
| R-14 | Current-state bed occupancy is misread as historical filtered occupancy | 3 | 3 | 9 | Label definition and do not imply period history | Product/QA: report definition check |
| R-15 | Receivables aging is inaccurate because invoices have no explicit due date | 4 | 4 | 16 | Do not release aging buckets until finance approves a deterministic rule | Finance/Product: approved definition |
| R-16 | Production rollback changes code but leaves an incompatible database migration | 3 | 5 | 15 | Require backward-compatible migrations and migration-specific rollback notes | Engineering/Operations: rehearsal |
| R-17 | Seed/test credentials or patient data are used outside isolated environments | 2 | 5 | 10 | Environment separation, credential checks, and data-cleanup evidence | QA/Security |
| R-18 | Existing local files cannot be migrated because ephemeral instances no longer contain them | 4 | 4 | 16 | Inventory storage metadata versus objects; report missing keys explicitly | Engineering/Operations: reconciliation report |

## Immediate go/no-go blockers

- R-01 durable clinical/document storage.
- R-03 verified database recovery.
- R-04/R-05 billing integrity.
- R-07 critical backend authorization.
- R-13 safe upload handling if uploads remain enabled.
- Any failed production migration or critical clinical workflow test.

## Risk acceptance rules

- A critical risk cannot be accepted silently or solely by engineering.
- Any deferred high risk needs a named business/operations owner, compensating control, expiry date, and written rationale.
- Test evidence must include the command/scenario, environment, date, actual outcome, and relevant artifact or log reference.

