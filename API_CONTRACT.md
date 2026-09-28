# Backend API contract

This repository does not contain a backend. The production server should expose versioned REST endpoints under `/api` and return correct HTTP status codes.

## Standard lists

`GET /api/{resource}?page=1&pageSize=20&search=&sort=createdAt:desc&status=`

```json
{
  "data": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 0,
  "totalPages": 0
}
```

Validation failures use HTTP 422 with `{ "errors": { "field": ["Message"] } }`. Conflicts use 409. Authorization failures use 401/403. Do not return stack traces or internal database messages.

## Authentication and profile

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `POST /api/auth/profile/image`
- `DELETE /api/auth/profile/image`

## CRUD resources

Patients, doctors, employees, departments, specializations, users, super-admins, roles, permissions and master data follow:

- `GET /api/{resource}`
- `POST /api/{resource}`
- `GET /api/{resource}/{id}`
- `PUT /api/{resource}/{id}`
- `DELETE /api/{resource}/{id}` or a documented deactivate endpoint

Clinical, inpatient, pharmacy and financial transitions require purpose-specific endpoints rather than direct state edits. Examples include `/appointments/{id}/check-in`, `/lab-orders/{id}/verify`, `/admissions/{id}/transfer`, `/dispenses/{id}/complete`, `/invoices/{id}/payments` and `/refunds/{id}/approve`.

All mutations require server-side authentication, authorization, validation, audit recording and idempotency where retries could duplicate financial or clinical activity.
