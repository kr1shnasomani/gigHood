# gigHood API

This document reflects the routers mounted in `backend/main.py` for this branch.

## Base URLs

1. Local backend: `http://127.0.0.1:8001`
2. OpenAPI docs: `http://127.0.0.1:8001/docs`

## Authentication

1. Protected routes require `Authorization: Bearer <access_token>`.
2. JWT `sub` claim maps to `workers.id`.

## Mounted Router Prefixes

1. `/workers`
2. `/workers/me/demo/*`
3. `/policies`
4. `/claims`
5. `/location-pings`
6. `/notifications`
7. `/chat`
8. `/admin`

## Health

### `GET /`

Returns service heartbeat.

Response:

```json
{ "message": "gigHood API is running" }
```

## Workers and Auth

### `POST /workers/auth/otp/send`

Sends OTP in development/test flow.

Request:

```json
{ "phone": "9876543210" }
```

### `POST /workers/auth/otp/verify`

Verifies OTP and returns access token for existing worker.

### `POST /workers/auth/register`

Registers worker and returns JWT.

### `GET /workers/me`

Returns authenticated worker profile.

### `PATCH /workers/me`

Updates profile fields (currently earnings-focused updates).

### `GET /workers/me/policy`

Returns active policy for authenticated worker.

### `POST /workers/me/device-token`

Stores FCM token for push notifications.

### `POST /workers/me/location/hex`

Maps lat/lng to H3 and updates worker hex assignment.

### `GET /workers/me/hex/dci`

Returns current DCI snapshot for worker hex.

### `GET /workers/me/claims`

Returns worker claim history.

## Demo Endpoints

All require auth and are mounted under `/workers/me/demo/*`.

### `POST /workers/me/demo/seed`

Seeds deterministic demo telemetry + DCI history.

### `POST /workers/me/demo/simulate-disruption`

Injects weighted disruption signals and computes DCI.

Request:

```json
{ "w": 2.5, "t": 1.2, "p": 1.8, "s": 1.0 }
```

### `POST /workers/me/demo/process-claim`

Runs demo claim pipeline and returns settlement-style payload.

## Policies

### `POST /policies/create`

Creates active policy for current worker if one does not exist.

## Claims

### `GET /claims`

Returns claims for current worker.

### `POST /claims/webhooks/razorpay`

Razorpay webhook ingestion endpoint.

## Location Pings

### `POST /location-pings`

Ingests worker telemetry for proof-of-presence checks.

## Chat

### `POST /chat`

Worker support assistant endpoint.

Request:

```json
{ "message": "What is my current zone risk?", "language": "en" }
```

## Notifications

### `GET /notifications/`

Placeholder route.

## Admin Endpoints

These routes are mounted in this branch under `/admin/*`.

### Dashboard

1. `GET /admin/dashboard/kpis`
2. `GET /admin/dashboard/zones`
3. `GET /admin/dashboard/risk-forecast`
4. `GET /admin/dashboard/payout-trends`
5. `GET /admin/dashboard/fraud-queue`

`GET /admin/dashboard/fraud-queue` behavior details:

1. Joins claims, workers, disruption events, and fraud flags.
2. Always returns a render-safe `fraud_score` (non-null integer).
3. Returns `dci_score` using this priority:
	 - `disruption_events.dci_peak`
	 - computed DCI from event `trigger_signals` using `sigma(0.45W + 0.25T + 0.20P + 0.10S)`
	 - `hex_zones.current_dci`
	 - `0.0` fallback only if all data is unavailable
4. Returns `resolution_path` and `status` for path-chip rendering.

Example response item:

```json
{
	"claim_id": "f1990ed6-e01a-4ad9-b49f-f8ebb42b8b00",
	"created_at": "2026-04-06T07:35:48.243759+00:00",
	"worker_name": "Khusbu Raj",
	"city": "Chennai",
	"status": "pending",
	"resolution_path": "soft_queue",
	"fraud_score": 25,
	"dci_score": 0.885,
	"payout": 0.0,
	"flags": []
}
```

### Payouts

1. `GET /admin/payouts/summary`
2. `GET /admin/payouts/recent`

### Policies

1. `GET /admin/policies/stats`
2. `GET /admin/policies/tiers`

### Fraud

1. `GET /admin/fraud/metrics`
2. `GET /admin/fraud/signals`
3. `GET /admin/fraud/workers`
4. `GET /admin/fraud/events`

## Branch Compatibility Note

1. Frontend admin previews must target a backend where `/admin/*` is mounted.
2. If preview frontend calls a backend without admin routes, `/admin/*` returns 404.
3. This branch includes preview fallback behavior for admin endpoints on preview runtime 404s only. Production-grade validation should use a real admin-capable backend.

## Frontend Session Behavior

1. Admin sign-out clears local auth/session keys and redirects to `/` (main website).
2. Worker sign-out clears token/cache and redirects to `/`.
3. Protected worker routes redirect unauthenticated sessions to `/`.
