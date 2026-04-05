-- Performance indexes for claim enrichment and filtering
-- Reduces N+1 query problem in /workers/me/claims endpoint

-- Index for batch-loading disruption_events by ID
-- Used when enriching claims with event duration and city info
CREATE INDEX IF NOT EXISTS idx_disruption_events_id ON disruption_events(id);

-- Index for batch-loading policies by ID
-- Used when enriching claims with policy tier information
CREATE INDEX IF NOT EXISTS idx_policies_id ON policies(id);

-- Composite index for efficient claims ordering and filtering
-- Used by /workers/me/claims to order by creation date DESC
-- Also used by get_4w_avg_payout() to filter paid claims by date
CREATE INDEX IF NOT EXISTS idx_claims_worker_created_at 
  ON claims(worker_id, created_at DESC);

-- Composite index for filtering paid claims in date range
-- Optimizes get_4w_avg_payout() and payout recalculation queries
CREATE INDEX IF NOT EXISTS idx_claims_worker_status_resolved_at 
  ON claims(worker_id, status, resolved_at DESC);

-- Index for verifying city compatibility in denied claims
-- Optimizes evaluate_location_guardrails() queries
CREATE INDEX IF NOT EXISTS idx_disruption_events_hex_id 
  ON disruption_events(hex_id);
