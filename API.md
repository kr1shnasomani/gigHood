# gigHood REST API Specification

This document reflects the currently implemented backend routes in `backend/main.py`.

All authenticated endpoints require:

- `Authorization: Bearer <token>`

---

## Auth and Worker

`POST /workers/auth/register`

- Registers a new worker.
- Body: `phone`, `name`, `city`, `dark_store_zone`, `avg_daily_earnings`, `upi_id`, `device_model`, `device_os_version`, `sim_carrier`, `sim_registration_date`
- Returns: `access_token`, `token_type`, `hex_id`, `worker`

`POST /workers/auth/otp/send`

- Sends a demo OTP (mocked in development).
- Body: `phone`
- Returns: status message

`POST /workers/auth/otp/verify`

- Verifies OTP and returns login token.
- Body: `phone`, `otp`
- Returns: `access_token`, `token_type`, `worker`

`GET /workers/me`

- Returns authenticated worker profile.

`PATCH /workers/me`

- Updates worker profile fields currently supported by API.
- Supported field: `avg_daily_earnings`

`GET /workers/me/policy`

- Returns active policy for authenticated worker.

`POST /workers/me/device-token`

- Stores worker FCM device token.
- Body: `device_token`

`POST /workers/me/location/hex`

- Converts latitude/longitude to hex and updates worker context.
- Body: `latitude`, `longitude`
- Returns: `hex_id`

`GET /workers/me/hex/dci`

- Returns live DCI snapshot for worker's current hex.

`GET /workers/me/claims`

- Returns worker payout history, newest first.

---

## Policies

`POST /policies/create`

- Creates or refreshes an active policy for the authenticated worker.

---

## Claims and Webhooks

`GET /claims`

- Returns claims for authenticated worker.

`POST /claims/webhooks/razorpay`

- Razorpay webhook receiver.
- Header: `X-Razorpay-Signature`
- Validates signature and applies payout mutation.

---

## Telemetry

`POST /location-pings`

- Ingests worker location ping for Proof-of-Presence.
- Body: `hex_id` (or `h3_index`), `latitude`, `longitude`, `accuracy_radius`, `network_signal_strength`, `mock_location_flag`

---

## Chat Assistant

`POST /chat`

- Returns context-aware assistant response using worker context.
- Body: `message`, `language`
- Response: `reply`, `language`, `worker_name`
- Supported `language`: `en`, `hi`, `ta`, `te`, `kn`
- Server sanitizes internal reasoning tags before returning response.

---

## Demo Endpoints (Authenticated)

`POST /workers/me/demo/seed`

- Seeds demo data for the logged-in worker.

`POST /workers/me/demo/simulate-disruption`

- Forces disruption simulation using weighted signals.
- Body: `w`, `t`, `p`, `s`

`POST /workers/me/demo/process-claim`

- Runs demo claim processing and returns receipt details.
