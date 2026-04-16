# gigHood Database Contract

This document defines the schema and runtime data invariants for `gigHood`.

Canonical migration source:

1. `supabase/migrations/`
2. migration index and policy: `supabase/MIGRATIONS.md`

## 1) Platform and Extensions

1. engine: Supabase Postgres
2. spatial extension: PostGIS (`000_init_postgis.sql`)
3. fraud graph store: Neo4j Aura (operational network graph, not relational source-of-truth)

## 2) Enum Domains

1. `worker_status`: `active`, `inactive`, `suspended`
2. `hex_dci_status`: `normal`, `elevated`, `disrupted`
3. `policy_tier`: `A`, `B`, `C`
4. `policy_status`: `active`, `expired`, `cancelled`
5. `signal_source_type`: `weather`, `aqi`, `traffic`, `platform`, `social`
6. `claim_resolution_path`: `fast_track`, `soft_queue`, `active_verify`, `denied`
7. `claim_status`: `pending`, `approved`, `denied`, `appealed`, `paid`, `payment_failed`, `rollback`

## 3) Core Entity Map

1. worker (`workers`) owns policy and emits telemetry
2. zone (`hex_zones`) stores current disruption state
3. event (`disruption_events`) represents disruption windows
4. claim (`claims`) links worker + policy + event
5. fraud signal (`fraud_flags`) attaches to claim
6. premium payment (`premium_payments`) tracks policy payment lifecycle

## 4) Table Specifications

### `workers`

Migrations:

1. `001_create_workers.sql`
2. `012_add_device_token.sql`
3. `014_add_platform_affiliation_to_workers.sql`
4. `015_add_platform_id_verification_to_workers.sql`

Contract highlights:

1. PK: `id` (UUID)
2. natural key: `phone` (unique)
3. profile: `name`, `city`, `language_preference`
4. platform identity: `platform_affiliation`, `platform_id`, `is_platform_verified`
5. trust and status: `trust_score`, `status`
6. payout profile: `avg_daily_earnings`, `upi_id`
7. device profile: `device_model`, `sim_*`, `device_token`
8. zone ref may be `hex_id` and/or `h3_index` depending on environment history

### `hex_zones`

Migrations:

1. `002_create_hex_zones.sql`
2. `011_add_hysteresis_tracking.sql`

Contract highlights:

1. zone identifier compatibility: `hex_id` with runtime support for `h3_index`
2. geospatial columns: `centroid`, `boundary`
3. live disruption state: `current_dci`, `dci_status`, `last_computed_at`
4. hysteresis support: `consecutive_normal_cycles`

### `policies`

Migration:

1. `003_create_policies.sql`

Contract highlights:

1. FK: `worker_id -> workers.id`
2. coverage/tier fields drive premium and payout calculations
3. policy window: `week_start`, `week_end`
4. status lifecycle: `active|expired|cancelled`

### `signal_cache`

Migration:

1. `004_create_signal_cache.sql`

Contract highlights:

1. stores normalized signal snapshots by source and zone
2. serves as DCI input cache for zone recomputation

### `dci_history`

Migration:

1. `005_create_dci_history.sql`

Contract highlights:

1. time-series record of DCI and component contributions
2. used for trend charts and historical diagnostics

### `dci_weights`

Migration:

1. `025_create_dci_weights.sql`

Contract highlights:

1. stores versioned α/β/γ/δ coefficients for DCI runtime
2. `is_active=true` row is the live weight vector consumed by `backend/services/dci_engine.py`
3. includes model metadata (`model_accuracy`, `training_sample_count`, `feature_importances`) for auditability
4. retains historical rows across weekly retrains

### `location_pings`

Migration:

1. `006_create_location_pings.sql`

Contract highlights:

1. telemetry payload for proof-of-presence
2. includes geo/device quality indicators
3. may include compatibility fields for zone id aliasing

### `disruption_events`

Migration:

1. `007_create_disruption_events.sql`

Contract highlights:

1. disruption interval and trigger vector by zone
2. `dci_peak` is primary event-level DCI snapshot for admin queue
3. `trigger_signals` is fallback compute source when `dci_peak` missing

### `claims`

Migrations:

1. `008_create_claims.sql`
2. `016_add_payout_channel_transaction_to_claims.sql`
3. `018_backfill_claim_scores_and_event_dci_defaults.sql`

Contract highlights:

1. FKs: worker, policy, disruption event
2. unique constraint: `(worker_id, event_id)`
3. routing fields: `resolution_path`, `status`
4. fraud field: `fraud_score`
5. payout fields: `payout_amount`, `payout_channel`, `payout_transaction_id`

Post-018 invariants:

1. `fraud_score` has default `30`
2. `fraud_score` is `NOT NULL`
3. pending + null path normalized to `soft_queue`
4. denied + null path normalized to `denied`

### `fraud_flags`

Migration:

1. `009_create_fraud_flags.sql`

Contract highlights:

1. per-claim flag records for explainable fraud signal decomposition
2. stores source/weight/value style details used by admin fraud analytics

### `premium_payments`

Migration:

1. `010_create_premium_payments.sql`

Contract highlights:

1. premium payment transaction tracking
2. external gateway references for reconciliation

## 5) Relationship Summary

1. one worker can have many policies over time
2. one disruption event can map to many claims
3. one claim can have many fraud flags
4. one policy can have many premium payments over lifecycle

## 6) Row-Level Security

Migration:

1. `013_enable_rls.sql`

RLS is enabled across major operational tables to constrain access by role/context.

## 7) Index and Cleanup Policy

Performance migration:

1. `017_add_performance_indexes.sql`

Cleanup migration:

1. `019_drop_redundant_pk_indexes.sql`

Cleanup rationale:

1. redundant single-column indexes duplicating PK coverage were removed
2. keep query plan clean and write overhead lower

Policy:

1. applied migrations are immutable
2. fixes happen in new forward migrations
3. do not delete/squash historical migration files in shared branches

## 8) Compatibility and Drift-Tolerant Reads

Runtime supports schema variance seen across environments.

Known compatibility fields:

1. `hex_zones.h3_index` fallback to `hex_id`
2. `hex_zones.is_disrupted` may or may not exist
3. `location_pings.h3_index` in some environments
4. aliased component fields in `dci_history`
5. `disruption_events.h3_index` coexistence with `hex_id`

## 9) Admin Analytics Data Dependencies

Critical join sources:

1. `claims` for queue, payout, and route analytics
2. `workers` for city and identity context
3. `disruption_events` for event-level DCI and triggers
4. `fraud_flags` for fraud explainability
5. `hex_zones` for zone fallback and map context

Queue quality dependencies:

1. populated `claims.event_id`
2. available `disruption_events.dci_peak` or usable trigger signals
3. post-018 default guarantees on path/score

## 9.1 Neo4j Fraud Network Projection

Neo4j is used as a projection layer for graph analytics, while Supabase remains transactional source-of-truth.

Projection entities:

1. `(:Worker {id})`
2. `(:Device {fingerprint})`
3. `(:Hex_Zone {id})`

Projection relationships:

1. `(:Worker)-[:USES_DEVICE]->(:Device)`
2. `(:Worker)-[:CLAIMED_IN {claim_count}]->(:Hex_Zone)`

Projection ingestion source:

1. claim processing pipeline (`backend/services/claim_approver.py`)
2. demo claim processing pipeline (`backend/api/demo.py`)

Syndicate detection query rule:

1. find `Device` nodes linked to multiple distinct `Worker` nodes
2. ensure those workers claim across multiple distinct `Hex_Zone` nodes
3. return graph payload via `GET /admin/fraud/network-graph`

## 10) Diagnostic Queries (Operational)

Use read-only checks before incident escalation.

1. verify claims missing event links:

```sql
select count(*) as missing_event_refs
from claims
where event_id is null;
```

2. verify missing `dci_peak` on active disruption windows:

```sql
select count(*) as missing_dci_peak
from disruption_events
where dci_peak is null;
```

3. verify null fraud scores (should be zero rows post-018):

```sql
select count(*) as null_fraud_score
from claims
where fraud_score is null;
```

## 11) Migration Safety Rules

1. write schema changes as explicit SQL migrations only
2. include idempotent guards when practical
3. document every migration in `supabase/MIGRATIONS.md`
4. update `docs/DATABASE.md` and `docs/CONTEXT.md` in same change set

## 12) Failure Patterns and Prevention

Observed pattern:

1. duplicate index creation on PK columns can silently bloat index set over time

Prevention:

1. before adding index, verify existing PK/unique/index coverage
2. if duplicates exist, create forward cleanup migration
