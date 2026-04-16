# gigHood API Contract

This document describes the live API contract expected by the `gigHood` frontend surfaces.

## 1) Base URLs

1. local backend: `http://127.0.0.1:8001`
2. OpenAPI docs: `http://127.0.0.1:8001/docs`
3. health: `GET /`

## 2) Auth Model

1. protected routes require `Authorization: Bearer <access_token>`
2. JWT `sub` maps to `workers.id`
3. token failures return `401`
4. missing/forbidden resources may return `403` or `404` depending on handler

## 3) Router Prefixes Mounted in Backend

1. `/workers`
2. `/workers/me/demo/*`
3. `/policies`
4. `/claims`
5. `/location-pings`
6. `/notifications`
7. `/chat`
8. `/admin`

## 4) Health

### `GET /`

Response:

```json
{ "message": "gigHood API is running" }
```

## 5) Workers and Authentication

### `POST /workers/auth/otp/send`

Purpose:

1. start OTP auth flow for a mobile number

Request:

```json
{ "phone": "9876543210" }
```

Typical success:

```json
{ "success": true, "message": "OTP sent" }
```

### `POST /workers/auth/otp/verify`

Purpose:

1. verify OTP and issue auth token for existing user

Typical success fields:

1. `access_token`
2. `token_type`
3. worker identity metadata

### `POST /workers/auth/register`

Purpose:

1. create worker profile and issue token

Typical payload fields (subject to backend schema evolution):

1. `phone`
2. `name`
3. `city`
4. platform metadata
5. optional earnings/risk profile fields

### `GET /workers/me`

Returns authenticated worker profile.

### `PATCH /workers/me`

Purpose:

1. partial profile update
2. earnings and related worker context updates

### `GET /workers/me/policy`

Returns current policy object for authenticated worker.

### `POST /workers/me/device-token`

Purpose:

1. persist/update device token for push notifications

### `POST /workers/me/location/hex`

Purpose:

1. map worker location to zone hex
2. refresh worker zone context used by DCI/claims

### `GET /workers/me/hex/dci`

Returns current DCI snapshot for worker zone.

Behavior notes:

1. response `dci_status` is derived from the returned numeric `current_dci` threshold mapping (`normal`, `elevated`, `disrupted`) to avoid stale-status mismatches.
2. when zone snapshots are stale or missing, backend attempts a lightweight recompute from cached signals before returning degraded state.
3. for newly created accounts/zones with no usable signal history yet, API returns a normal bootstrap DCI baseline (city-aware) and then transitions to live computed values as signals arrive.

### `GET /workers/me/claims`

Returns claim history list for authenticated worker.

## 6) Demo Endpoints (`/workers/me/demo/*`)

All demo endpoints require worker auth.

### `POST /workers/me/demo/seed`

Purpose:

1. populate deterministic demo state
2. initialize history and baseline signals

### `POST /workers/me/demo/simulate-disruption`

Purpose:

1. apply weighted disruption signals
2. recompute DCI and related outcomes

Request:

```json
{ "w": 2.5, "t": 1.2, "p": 1.8, "s": 1.0 }
```

### `POST /workers/me/demo/process-claim`

Purpose:

1. run demo claim pipeline end to end
2. return route/payout-style result

Behavior notes:

1. claim gating now refreshes stale zone DCI snapshots before disruption checks.
2. if `hex_zones.current_dci` is missing, latest `dci_history` value is used as fallback for disruption eligibility.

## 7) Policies

### `POST /policies/create`

Purpose:

1. create active policy for authenticated worker if eligible and not already active

Typical outcomes:

1. `201/200` with policy payload on creation
2. conflict/business-rule response when policy already active

## 8) Claims

### `GET /claims`

Purpose:

1. list claims for current worker context

### `POST /claims/webhooks/razorpay`

Purpose:

1. ingest payment provider webhook updates
2. reconcile payout/payment state

## 9) Location Pings

### `POST /location-pings`

Purpose:

1. ingest movement telemetry
2. support proof-of-presence and fraud checks

## 10) Chat

### `POST /chat`

Purpose:

1. multilingual worker support assistant

Request:

```json
{ "message": "What is my current zone risk?", "language": "en" }
```

## 11) Notifications

### `GET /notifications/`

Current state:

1. placeholder route in this branch

## 12) Admin API

Admin endpoints are mounted under `/admin/*` and power analytics + operations UI.

### Dashboard endpoints

1. `GET /admin/dashboard/kpis`
2. `GET /admin/dashboard/zones`
3. `GET /admin/dashboard/risk-forecast`
4. `GET /admin/dashboard/payout-trends`
5. `GET /admin/dashboard/fraud-queue`

Scheduler-backed behavior notes:

1. Sunday forecast notifications are now trend-based from recent `dci_history` by worker zone (not blind broadcast).
2. Sunday retrain pipeline refreshes risk tier model, fraud model, and DCI signal weights.

#### `GET /admin/dashboard/fraud-queue` contract notes

1. joins claim, worker, disruption, and fraud data
2. returns non-null render-safe `fraud_score`
3. includes route/status fields for UI chips
4. computes `dci_score` with priority:
   - `disruption_events.dci_peak`
   - sigmoid of weighted trigger vector
   - zone fallback
   - `0.0` only if no source exists

Weighted expression:

$$
\sigma(0.45W + 0.25T + 0.20P + 0.10S)
$$

Runtime note:

1. live DCI computation uses active weights from `dci_weights` when available (normalized to sum to 1), else configured cold-start defaults.

Example queue item:

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

### Payout endpoints

1. `GET /admin/payouts/summary`
2. `GET /admin/payouts/recent`

### Policy analytics endpoints

1. `GET /admin/policies/stats`
2. `GET /admin/policies/tiers`

### Fraud analytics endpoints

1. `GET /admin/fraud/metrics`
2. `GET /admin/fraud/signals`
3. `GET /admin/fraud/workers`
4. `GET /admin/fraud/events`
5. `GET /admin/fraud/network-graph`
6. `POST /admin/fraud/network-graph/backfill`

`GET /admin/fraud/network-graph` returns graph JSON for visualization:

1. `nodes`: graph node list (`Worker`, `Device`, `Hex_Zone`)
2. `links`: graph edge list (`USES_DEVICE`, `CLAIMED_IN`)
3. `meta`: aggregate counts (`syndicate_devices`, `node_count`, `link_count`)
4. consumed by frontend route `/admin-dashboard/fraud` for the Fraud Relationship Network Graph panel
5. by default, `seed_if_empty=true` attempts one backfill pass from historical claims when Neo4j projection is empty
6. each node includes live scoring fields: `fraud_score` and `risk_level` (not hardcoded in UI)
7. frontend filter chips (`CRITICAL/HIGH/MEDIUM/LOW`) operate on backend-provided `risk_level`

`POST /admin/fraud/network-graph/backfill` triggers manual backfill from Supabase claims:

1. query param `limit` controls number of recent claims projected (default `1000`, max `5000`)
2. response: `{ total, ingested, failed }`

## 13) Frontend Compatibility Rules

1. admin UI requires backend with mounted `/admin/*`
2. preview frontend may encounter backend 404 when pointed to non-admin backend
3. preview-only fallback behavior exists for selected admin calls on preview runtime + 404
4. production validation must use real admin-capable backend responses

## 14) Session and Redirect Behavior

1. admin sign-out clears session keys and redirects to `/`
2. worker sign-out clears auth/cache and redirects to `/`
3. protected worker routes redirect unauthenticated users to `/`

## 15) Error and Response Conventions

1. successful reads/writes return JSON objects or arrays
2. validation/business-rule errors typically return `400/422`
3. auth failures return `401`
4. not-found resources return `404`
5. internal processing failures return `500`

## 16) Test and Validation Recommendations

1. validate all mounted routes via OpenAPI docs and route smoke tests
2. exercise OTP, policy, claim, and chat flows with authenticated session
3. verify admin dashboard/fraud queue from real backend data
4. verify preview fallback behavior by intentionally targeting non-admin backend in preview only
