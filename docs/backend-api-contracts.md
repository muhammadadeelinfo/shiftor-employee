# Employee App Backend Contracts

These are the mobile client's release-critical expectations. All authenticated endpoints use `Authorization: Bearer <Supabase access token>` and return JSON. Production acceptance requires contract tests against the deployed Employee API.

## QR clock-in/out

`POST /api/objects/qr-clock-in`

Request: `{ "qrCode": "<opaque scanner value>" }`

Success: `{ "clockIn": { "shiftId": "uuid", "action": "clock_in|clock_out", "workedMs": 0 } }`

The server must authenticate the employee, validate the opaque/expiring QR value, confirm shift eligibility, prevent replay, apply an idempotent presence transition, and return a stable error code. The mobile app treats a missing `clockIn.shiftId` as failure.

## Monthly hours

`GET /api/employee/monthly-hours?month=YYYY-MM`

The response shape is defined by `MonthlyHoursResponse` in `src/features/account/monthlyHours.ts`. Invalid months return `400`, unauthenticated requests `401`, unavailable employees `404`, and server failures `5xx` with `{ "error": "stable_code" }`.

## Employee documents

- `GET /api/employees/documents/list?employeeId=<uuid>&slug=<type>` → `{ "documents": [] }`
- `POST /api/employees/documents/register` with `employeeId`, `slug`, `fileName`, `storagePath`, `contentType`, and `sizeBytes` → `{ "success": true }`
- `POST /api/employees/documents/download` with `{ "documentId": "uuid" }` → `{ "signedUrl": "https://..." }`

The API must derive/verify the caller from the token and reject access to another employee even when an `employeeId` is supplied. Signed URLs must be short-lived. Registration must verify that the storage object belongs to the authenticated employee and configured company.

## Vacation requests

The mobile client writes `vacation_requests` through Supabase. Production RLS must allow employees to create and read only their own requests; approval/rejection and approval-letter fields are admin-only.

## Push notifications

The mobile client registers tokens in `employee_push_tokens`. The sender must apply stored preferences, remove invalid tokens, avoid sensitive content in payloads, and use only supported `target`, `deepLink`, or `shiftId` navigation metadata.

## Contract acceptance evidence

For every release candidate, record request/response fixtures for success, unauthorized, forbidden, invalid input, not found, conflict/idempotency, rate limit, and server-unavailable cases. Never store real access tokens, QR codes, document URLs, or employee data in fixtures.
