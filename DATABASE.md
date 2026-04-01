# gigHood Database Schema

This schema document is aligned to SQL migrations in `supabase/migrations/`.

## Platform and Extensions

1. Database: Supabase Postgres
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

### `workers` (`001_create_workers.sql` + `012_add_device_token.sql`)

1. `id` UUID PK
2. `phone` VARCHAR(15) UNIQUE NOT NULL
3. `name` VARCHAR(100)
4. `city` VARCHAR(50)
5. `dark_store_zone` VARCHAR(100)
6. `hex_id` VARCHAR(20)
7. `avg_daily_earnings` DECIMAL(8,2)
8. `upi_id` VARCHAR(100)
9. `device_model` VARCHAR(100)
10. `device_os_version` VARCHAR(20)
11. `sim_carrier` VARCHAR(50)
12. `sim_registration_date` DATE
13. `created_at` TIMESTAMPTZ DEFAULT now()
14. `trust_score` INTEGER DEFAULT 50
15. `status` `worker_status` DEFAULT `active`
16. `device_token` TEXT

### `hex_zones` (`002_create_hex_zones.sql` + `011_add_hysteresis_tracking.sql`)

1. `hex_id` VARCHAR(20) PK
2. `city` VARCHAR(50)
3. `centroid` GEOMETRY(POINT, 4326)
4. `boundary` GEOMETRY(POLYGON, 4326)
5. `current_dci` DECIMAL(4,3)
6. `dci_status` `hex_dci_status` DEFAULT `normal`
7. `last_computed_at` TIMESTAMPTZ
8. `active_worker_count` INTEGER DEFAULT 0
9. `consecutive_normal_cycles` INT DEFAULT 0 NOT NULL

### `policies` (`003_create_policies.sql`)

1. `id` UUID PK
2. `worker_id` UUID FK -> `workers(id)` ON DELETE CASCADE
3. `tier` `policy_tier` NOT NULL
4. `weekly_premium` DECIMAL(6,2)
5. `coverage_cap_daily` DECIMAL(8,2)
6. `week_start` DATE NOT NULL
7. `week_end` DATE NOT NULL
8. `status` `policy_status` DEFAULT `active`
9. `is_waiting_period` BOOLEAN DEFAULT false
10. `created_at` TIMESTAMPTZ DEFAULT now()

### `signal_cache` (`004_create_signal_cache.sql`)

1. `id` BIGSERIAL PK
2. `hex_id` VARCHAR(20) FK -> `hex_zones(hex_id)` ON DELETE CASCADE
3. `signal_type` `signal_source_type` NOT NULL
4. `raw_data` JSONB
5. `normalized_score` DECIMAL(5,3)
6. `fetched_at` TIMESTAMPTZ DEFAULT now()
7. `source_available` BOOLEAN DEFAULT true

### `dci_history` (`005_create_dci_history.sql`)

1. `id` BIGSERIAL PK
2. `hex_id` VARCHAR(20) FK -> `hex_zones(hex_id)` ON DELETE CASCADE
3. `dci_score` DECIMAL(4,3) NOT NULL
4. `w_score` DECIMAL(5,3)
5. `t_score` DECIMAL(5,3)
6. `p_score` DECIMAL(5,3)
7. `s_score` DECIMAL(5,3)
8. `computed_at` TIMESTAMPTZ DEFAULT now()

### `location_pings` (`006_create_location_pings.sql`)

1. `id` BIGSERIAL PK
2. `worker_id` UUID FK -> `workers(id)` ON DELETE CASCADE
3. `hex_id` VARCHAR(20)
4. `latitude` DECIMAL(10,7)
5. `longitude` DECIMAL(10,7)
6. `accuracy_radius` DECIMAL(6,2)
7. `network_signal_strength` INTEGER
8. `mock_location_flag` BOOLEAN DEFAULT false
9. `pinged_at` TIMESTAMPTZ DEFAULT now()

### `disruption_events` (`007_create_disruption_events.sql`)

1. `id` UUID PK
2. `hex_id` VARCHAR(20) FK -> `hex_zones(hex_id)` ON DELETE CASCADE
3. `dci_peak` DECIMAL(4,3)
4. `started_at` TIMESTAMPTZ DEFAULT now()
5. `ended_at` TIMESTAMPTZ
6. `duration_hours` DECIMAL(4,2)
7. `trigger_signals` JSONB

### `claims` (`008_create_claims.sql`)

1. `id` UUID PK
2. `worker_id` UUID FK -> `workers(id)` ON DELETE CASCADE
3. `policy_id` UUID FK -> `policies(id)` ON DELETE CASCADE
4. `event_id` UUID FK -> `disruption_events(id)` ON DELETE CASCADE
5. `pop_validated` BOOLEAN
6. `fraud_score` INTEGER
7. `resolution_path` `claim_resolution_path`
8. `payout_amount` DECIMAL(8,2)
9. `disrupted_hours` DECIMAL(4,2)
10. `status` `claim_status` DEFAULT `pending`
11. `razorpay_payment_id` VARCHAR(100)
12. `created_at` TIMESTAMPTZ DEFAULT now()
13. `resolved_at` TIMESTAMPTZ
14. UNIQUE constraint on (`worker_id`, `event_id`)

### `fraud_flags` (`009_create_fraud_flags.sql`)

1. `id` BIGSERIAL PK
2. `claim_id` UUID FK -> `claims(id)` ON DELETE CASCADE
3. `flag_type` VARCHAR(50) NOT NULL
4. `score_contribution` INTEGER NOT NULL
5. `details` JSONB

### `premium_payments` (`010_create_premium_payments.sql`)

1. `id` UUID PK
2. `worker_id` UUID FK -> `workers(id)` ON DELETE CASCADE
3. `policy_id` UUID FK -> `policies(id)` ON DELETE CASCADE
4. `amount` DECIMAL(6,2) NOT NULL
5. `razorpay_payment_id` VARCHAR(100) NOT NULL
6. `paid_at` TIMESTAMPTZ DEFAULT now()

## Row-Level Security

`013_enable_rls.sql` enables RLS on these tables:

1. `workers`
2. `hex_zones`
3. `policies`
4. `signal_cache`
5. `dci_history`
6. `location_pings`
7. `disruption_events`
8. `claims`
9. `fraud_flags`
10. `premium_payments`
11. `fraud_evaluations` (expected table in deployed DB)
12. `notification_log` (expected table in deployed DB)

## Runtime Compatibility Notes

Current backend code supports mixed environments where some deployments may include additional columns used by newer services, including:

1. `hex_zones.h3_index`
2. `hex_zones.is_disrupted`
3. `location_pings.h3_index`
4. `dci_history.weather_component`, `traffic_component`, `platform_component`, `social_component`

These are handled with compatibility fallbacks in service/query logic and should be migration-backed when standardized.
