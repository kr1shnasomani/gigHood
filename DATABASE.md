# gigHood Database Schema

This document represents the current live schema implemented in Supabase using PostGIS over 12 sequential migrations.

---

### `workers`
Stores physical attributes and identity states governing the policyholders dynamically.
- `id`: UUID, Primary Key
- `phone`: Text, Unique
- `name`: Text
- `city`: Text
- `dark_store_zone`: Text
- `home_hex`: Text (H3 Resolution 9 index mapping location dynamically)
- `avg_daily_earnings`: Numeric
- `upi_id`: Text (Handles Payouts natively inside Fast Track pipelines)
- `device_model`: Text (Fraud Engine Network Analysis uses this parameter strictly tracking aggregations)
- `device_os_version`: Text
- `sim_carrier`: Text 
- `sim_registration_date`: Date
- `device_token`: Text (Binds FCM IDs sending Payout & Alert messages properly)
- `trust_score`: Integer (0-100)
- `status`: Enum (`active`, `suspended`, `unverified`)
- `created_at`: Timestampz

### `hex_zones`
Spatial infrastructure bounding the physics engine locally into standardized limits.
- `hex_id`: Varchar(15), Primary Key (H3 standard)
- `city`: Varchar(50)
- `centroid`: PostGIS Geometry Point
- `boundary`: PostGIS Geometry Polygon
- `current_dci`: Float (Demand Collapse Index)
- `dci_status`: Enum (`normal`, `elevated`, `disrupted`)
- `is_disrupted`: Boolean (Internal event tracking logic tracking Hysteresis)
- `consecutive_normal_cycles`: Integer (Tracks how long signals stay below 0.65 mapping event close loops)
- `updated_at`: Timestampz

### `policies`
Financial relationships assigning Premium limits enforcing adverse-selection prevention locally.
- `id`: UUID, Primary Key
- `worker_id`: UUID, FK to `workers`
- `status`: Enum (`active`, `expired`, `canceled`)
- `tier`: Enum (`A`, `B`, `C`)
- `weekly_premium`: Numeric
- `is_waiting_period`: Boolean
- `valid_from`: Timestampz
- `valid_until`: Timestampz
- `created_at`: Timestampz

### `location_pings`
Telemetry stream storing tracking logs building Proof-of-Presence engines.
- `id`: UUID, Primary Key
- `worker_id`: UUID, FK to `workers`
- `hex_id`: Text
- `latitude`: Float
- `longitude`: Float
- `accuracy_radius`: Float
- `mock_location_flag`: Boolean (Feeds cleanly into Fraud Engine Gate 4 flags protecting math calculations)
- `network_signal_strength`: Integer
- `pinged_at`: Timestampz

### `disruption_events`
The active records representing live localized economic crashes affecting specific regions natively.
- `id`: UUID, Primary Key
- `hex_id`: Text, FK to `hex_zones(hex_id)`
- `dci_peak`: Float
- `started_at`: Timestampz
- `ended_at`: Timestampz (Null if active)
- `duration_hours`: Float
- `trigger_signals`: JSONB (Documents the initial cause variables natively)

### `claims`
Formal loss tracking documents evaluating presence loops processing financial limits securely.
- `id`: UUID, Primary Key
- `worker_id`: UUID, FK to `workers`
- `policy_id`: UUID, FK to `policies`
- `event_id`: UUID, FK to `disruption_events` *UNIQUE constraint per worker limits multiple payouts idempotently*
- `status`: Enum (`pending`, `paid`, `denied`, `review`)
- `resolution_path`: Enum (`fast_track`, `soft_queue`, `active_verify`, `denied`)
- `fraud_score`: Integer
- `pop_validated`: Boolean 
- `disrupted_hours`: Float
- `payout_amount`: Numeric
- `razorpay_payment_id`: Text
- `created_at`: Timestampz
- `resolved_at`: Timestampz

### `fraud_flags`
Evidence logs connecting specific policy claims to localized metrics natively.
- `id`: UUID, Primary Key
- `claim_id`: UUID, FK to `claims`
- `flag_type`: Text (e.g. `VELOCITY_VIOLATION`, `STATIC_DEVICE_FLAG`)
- `score_contribution`: Integer
- `details`: JSONB
- `created_at`: Timestampz

### `signal_cache`
Ephemerally persisting source intelligence ensuring reproducible ML traces across the network.
- `id`: UUID, Primary Key
- `hex_id`: Text, FK to `hex_zones`
- `signal_type`: Enum (`weather`, `aqi`, `traffic`, `platform`, `social`)
- `raw_data`: JSONB
- `normalized_score`: Float
- `source_available`: Boolean
- `fetched_at`: Timestampz

### `dci_history`
Chronological matrices charting physical physics variables against time globally.
- `id`: UUID, Primary Key
- `hex_id`: Text, FK to `hex_zones`
- `dci_score`: Float
- `w_score`: Float
- `t_score`: Float
- `p_score`: Float
- `s_score`: Float
- `degraded_mode`: Boolean
- `computed_at`: Timestampz

### `premium_payments`
Tracks the weekly subscription charges sent to Razorpay validating active coverages.
- `id`: UUID, Primary Key
- `worker_id`: UUID, FK to `workers`
- `policy_id`: UUID, FK to `policies`
- `amount`: Numeric
- `status`: Enum (`pending`, `success`, `failed`)
- `razorpay_payment_id`: Text
- `attempted_at`: Timestampz
