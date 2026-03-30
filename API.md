# gigHood REST API Specification

This document maps all backend capabilities spanning Fast-Track Automation pipelines, DCI metrics logic, and Identity schemas routing across the system. 

All authenticated endpoints strictly expect to find `Authorization: Bearer <TOKEN>` in Headers securely. 

---

### Auth & Worker Operations 

`POST /api/auth/register`
*Registers a brand-new Worker creating identity tracking and mapping them natively into an encrypted Hex Region physically based on geometric bounds.*
- **Body**: `WorkerRegisterRequest` (phone, name, city, dark_store_zone, avg_daily_earnings, upi_id, device_model, device_os_version, sim_carrier, sim_registration_date)
- **Returns**: `{ "access_token": string, "hex_id": string }`

`POST /api/auth/otp/send`
*Triggers native Mock APIs outputting physical OTPs to console for Demo operations smoothly.*
- **Body**: `{ "phone": string }`
- **Returns**: Success Message

`POST /api/auth/otp/verify`
*Examines Mock OTP codes extracting worker profile variables routing a dynamic JWT Session back across components.*
- **Body**: `{ "phone": string, "otp": string }`
- **Returns**: `{ "access_token": string }`

`GET /api/workers/me`
*Fetches physical profile components natively representing worker structures dynamically.*
- **Requires Auth**: Yes
- **Returns**: Worker JSON payload.

`GET /api/workers/me/policy`
*Retrieves exactly one Active Policy isolating their coverage ceilings, premiums, and tier definitions locally.*
- **Requires Auth**: Yes
- **Returns**: Policy JSON payload (or 404 if missing)

`POST /api/workers/me/device-token`
*Updates their physical structure injecting Firebase mappings binding device boundaries safely intercepting FCM Notification triggers natively.*
- **Requires Auth**: Yes
- **Body**: `{ "device_token": string }`
- **Returns**: Success message natively describing token bind state

---

### Policy Enrollment & Webhooks

`POST /api/policies/create`
*Creates a brand new Subscription dynamically triggering Risk Profiling engines pushing Workers sequentially into strict physical Tier limits (A, B, C).*
- **Requires Auth**: Yes
- **Returns**: The generated Policy payload securely containing Premium caps and Coverage wait lists dynamically.

`POST /api/webhooks/razorpay`
*Un-authenticated async webhook interface allowing Razorpay server hooks to validate internally encrypted signatures matching local Secret keys.*
*Once `payout.processed` binds securely, modifies the corresponding database claim directly inside `payment_service` bypassing router loops isolating strictly to `payment_service`.*
- **Headers**: `X-Razorpay-Signature`
- **Body**: JSON Webhook Body 

---

### Telemetry Pipeline

`POST /api/location-pings`
*Crucial backend polling layer designed explicitly for handling 15-minute bursts originating across the physical applications running. Ingests precise geometric traces protecting Proof-of-Presence tracking.*
- **Requires Auth**: Yes
- **Body**: `{ "hex_id": str, "latitude": float, "longitude": float, "accuracy_radius": float, "network_signal_strength": int, "mock_location_flag": boolean }`
- **Returns**: Success JSON

--- 

### Claim Management

`GET /api/claims`
*Fetches the complete payout histories representing Disruption Events mapping cleanly across Worker constraints locally.*
- **Requires Auth**: Yes
- **Returns**: JSON Array of native `claims` rows tracing specific mathematical outcomes (Path 1-4).
