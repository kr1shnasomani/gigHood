# gigHood API

This document reflects currently mounted FastAPI routers from `backend/main.py`.

Base URLs:

1. Local backend: `http://127.0.0.1:8001`
2. OpenAPI docs: `http://127.0.0.1:8001/docs`

Authentication:

1. Protected routes require `Authorization: Bearer <access_token>`.
2. JWT subject is worker ID (`sub` claim).

## Mounted Router Prefixes

1. `/workers`
2. `/policies`
3. `/claims`
4. `/location-pings`
5. `/notifications`
6. `/chat`

`/admin` is currently not mounted.

## Health

### `GET /`

Returns service heartbeat.

Response:

```json
{ "message": "gigHood API is running" }
```

## Workers and Auth

### `POST /workers/auth/otp/send`

Sends mock OTP in development.

Request:

```json
{ "phone": "9876543210" }
```

Response:

```json
{ "message": "OTP sent successfully." }
```

### `POST /workers/auth/otp/verify`

Verifies OTP and returns access token for existing worker.

Request:

```json
{ "phone": "9876543210", "otp": "123456" }
```

Returns `404` if worker does not exist.

### `POST /workers/auth/register`

Registers a worker and immediately returns JWT.

Required fields:

1. `phone`
2. `name`
3. `city`
4. `dark_store_zone`
5. `avg_daily_earnings`
6. `upi_id`
7. `device_model`
8. `device_os_version`
9. `sim_carrier`
10. `sim_registration_date`

### `GET /workers/me`

Returns current worker profile.

### `PATCH /workers/me`

Updates current worker profile.

Supported field today:

1. `avg_daily_earnings` (must be positive)

### `GET /workers/me/policy`

Returns active policy for current worker.

### `POST /workers/me/device-token`

Stores Firebase device token.

Request:

```json
{ "device_token": "<fcm-token>" }
```

### `POST /workers/me/location/hex`

Converts lat/lng to H3 hex and updates worker `hex_id`.

Request:

```json
{ "latitude": 12.9716, "longitude": 77.5946 }
```

Response:

```json
{ "hex_id": "..." }
```

### `GET /workers/me/hex/dci`

Returns current DCI snapshot for worker's assigned hex.

### `GET /workers/me/claims`

Returns current worker claim history (newest first).

## Demo Endpoints

All demo endpoints are mounted under `/workers/me/demo/*` and require auth.

### `POST /workers/me/demo/seed`

Seeds deterministic demo telemetry and DCI history.

### `POST /workers/me/demo/simulate-disruption`

Injects weighted disruption signals and computes DCI.

Request:

```json
{ "w": 2.5, "t": 1.2, "p": 1.8, "s": 1.0 }
```

### `POST /workers/me/demo/process-claim`

Runs end-to-end demo claim processing and returns settlement receipt payload.

## Policies

### `POST /policies/create`

Creates active policy for current worker if none exists.

Returns `400` when worker already has an active policy.

## Claims

### `GET /claims`

Returns claims for current worker.

### `POST /claims/webhooks/razorpay`

Razorpay webhook ingestion.

Header:

1. `X-Razorpay-Signature`

Validates signature then mutates payout status.

## Location Pings

### `POST /location-pings`

Ingests worker telemetry for Proof-of-Presence.

Request fields:

1. `hex_id` (required)
2. `h3_index` (optional alias)
3. `latitude`
4. `longitude`
5. `accuracy_radius`
6. `network_signal_strength`
7. `mock_location_flag`

## Chat

### `POST /chat`

Context-aware worker assistant endpoint.

Request:

```json
{ "message": "What is my current zone risk?", "language": "en" }
```

Response shape:

```json
{
  "reply": "...",
  "language": "en",
  "worker_name": "..."
}
```

Supported languages:

1. `en`
2. `hi`
3. `ta`
4. `te`
5. `kn`
6. `mr`
7. `bn`
8. `as`

Unsupported language values fallback to `en`.

## Notifications

### `GET /notifications/`

Placeholder route.

Response:

```json
{ "message": "Notifications API" }
```
