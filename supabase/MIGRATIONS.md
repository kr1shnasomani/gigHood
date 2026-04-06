# Supabase Migration Index

This project uses ordered, immutable migrations in `supabase/migrations/`.

Important:

1. Do not edit or merge historical migration files that may already be applied in shared environments.
2. For cleanup/refactors, add a new forward migration instead.
3. Keep migration names action-oriented and deterministic.

## Current Sequence

### Foundation

1. `000_init_postgis.sql`
2. `001_create_workers.sql`
3. `002_create_hex_zones.sql`
4. `003_create_policies.sql`
5. `004_create_signal_cache.sql`
6. `005_create_dci_history.sql`
7. `006_create_location_pings.sql`
8. `007_create_disruption_events.sql`
9. `008_create_claims.sql`
10. `009_create_fraud_flags.sql`
11. `010_create_premium_payments.sql`

### Incremental Schema Evolution

1. `011_add_hysteresis_tracking.sql`
2. `012_add_device_token.sql`
3. `013_enable_rls.sql`
4. `014_add_platform_affiliation_to_workers.sql`
5. `015_add_platform_id_verification_to_workers.sql`
6. `016_add_payout_channel_transaction_to_claims.sql`
7. `017_add_performance_indexes.sql`
8. `018_backfill_claim_scores_and_event_dci_defaults.sql`
9. `019_drop_redundant_pk_indexes.sql`

## Why We Do Not Squash Historical Files

1. Existing environments have already executed older files in order.
2. Squashing or deleting historical migrations can break drift detection and replays.
3. Forward-only migrations keep branch merges and production rollouts conflict-safe.

## Cleanup Policy

If two migrations overlap, do this instead of rewriting history:

1. Add a new migration that normalizes/fixes the final state.
2. Document rationale in this file and in `docs/DATABASE.md`.
