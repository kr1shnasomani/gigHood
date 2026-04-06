# gigHood Database Schema

This document tracks migration-backed schema in `supabase/migrations/` and runtime contracts used by backend/admin dashboards.

## Platform

1. Engine: Supabase Postgres
2. Spatial extension: PostGIS (`000_init_postgis.sql`)

## Enum Types

1. `worker_status`: `active`, `inactive`, `suspended`
2. `hex_dci_status`: `normal`, `elevated`, `disrupted`
3. `policy_tier`: `A`, `B`, `C`
4. `policy_status`: `active`, `expired`, `cancelled`
5. `signal_source_type`: `weather`, `aqi`, `traffic`, `platform`, `social`
6. `claim_resolution_path`: `fast_track`, `soft_queue`, `active_verify`, `denied`
7. `claim_status`: `pending`, `approved`, `denied`, `appealed`, `paid`

## Core Tables

### `workers`

Migrations: `001_create_workers.sql`, `012_add_device_token.sql`, `014_add_platform_affiliation_to_workers.sql`, `015_add_platform_id_verification_to_workers.sql`

Important fields:

1. `id` UUID PK
2. `phone` unique
3. profile and identity fields (`name`, `city`, `platform_affiliation`, `platform_id`, `is_platform_verified`)
4. earnings + payout fields (`avg_daily_earnings`, `upi_id`)
5. device and trust fields (`device_model`, `sim_*`, `device_token`, `trust_score`, `status`)
6. zone binding fields may appear as `hex_id` and/or `h3_index` depending on environment history

### `hex_zones`

Migrations: `002_create_hex_zones.sql`, `011_add_hysteresis_tracking.sql`

Important fields:

1. primary zone key is `hex_id` in early migration, with compatibility support for `h3_index` in runtime environments
2. geospatial fields (`centroid`, `boundary`)
3. disruption state (`current_dci`, `dci_status`, `last_computed_at`)
4. hysteresis helper (`consecutive_normal_cycles`)

### `policies`

Migration: `003_create_policies.sql`

Important fields:

1. `worker_id` FK
2. tier and coverage fields
3. active-window dates (`week_start`, `week_end`)
4. `status` and waiting-period state

### `signal_cache`

Migration: `004_create_signal_cache.sql`

Stores normalized external signal snapshots per hex.

### `dci_history`

Migration: `005_create_dci_history.sql`

Stores DCI and component values over time.

### `location_pings`

Migration: `006_create_location_pings.sql`

Proof-of-presence telemetry with geo + device quality metadata.

### `disruption_events`

Migration: `007_create_disruption_events.sql`

Tracks disruption lifecycle windows per hex.

Runtime note:

1. `dci_peak` is used as admin queue DCI snapshot.
2. If absent, runtime can compute DCI using weighted sigmoid from event `trigger_signals`.

### `claims`

Migrations: `008_create_claims.sql`, `016_add_payout_channel_transaction_to_claims.sql`, `018_backfill_claim_scores_and_event_dci_defaults.sql`

Important fields:

1. worker/policy/event FKs
2. fraud and resolution fields (`fraud_score`, `resolution_path`)
3. payout fields (`payout_amount`, `status`, `payout_channel`, `payout_transaction_id`)
4. unique key on (`worker_id`, `event_id`)

Post-018 guarantees:

1. `claims.fraud_score` has default `30`.
2. `claims.fraud_score` is `NOT NULL`.
3. pending rows with null `resolution_path` are normalized to `soft_queue`.
4. denied rows with null `resolution_path` are normalized to `denied`.

### `fraud_flags`

Migration: `009_create_fraud_flags.sql`

Per-claim fraud signal contributions and structured details.

### `premium_payments`

Migration: `010_create_premium_payments.sql`

Premium collection records and Razorpay references.

## Row-Level Security

`013_enable_rls.sql` enables RLS on core operational tables, including workers, zones, policies, signals, DCI history, pings, events, claims, and payment/fraud tables.

## Compatibility Fields Used by Runtime

Backend and admin analytics include compatibility fallbacks for environments where column naming differs.

Known compatibility fields:

1. `hex_zones.h3_index` (fallback to `hex_id`)
2. `hex_zones.is_disrupted` (environment-dependent)
3. `location_pings.h3_index`
4. component aliases in `dci_history`
5. `disruption_events.h3_index` may coexist with `hex_id` depending on environment

## Operational Note for Admin Analytics

Admin endpoints rely on:

1. `claims` for payouts, trends, and fraud score aggregation
2. `fraud_flags` for signal distributions
3. `workers` for identity/city joins
4. `hex_zones` and `disruption_events` for zone risk context

If admin dashboards appear empty or show repeated `0.00` DCI, validate:

1. `claims.event_id` is populated.
2. `disruption_events.dci_peak` is populated for recent events.
3. migration `018_backfill_claim_scores_and_event_dci_defaults.sql` has been applied.
