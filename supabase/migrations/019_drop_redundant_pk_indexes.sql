-- Cleanup migration: remove redundant indexes that duplicate PK-backed indexes.
-- Primary keys already create unique btree indexes on these columns.

DROP INDEX IF EXISTS idx_disruption_events_id;
DROP INDEX IF EXISTS idx_policies_id;
