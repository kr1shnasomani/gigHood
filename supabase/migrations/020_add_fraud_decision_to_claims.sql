-- Migration 020: Add AI fraud decision columns to claims
-- Per AGENTS.md: all schema changes are migration-first.
--
-- Adds three nullable columns to the `claims` table:
--   decision            → APPROVE | REVIEW | DENY
--   decision_reason     → human-readable AI explanation
--   decision_confidence → HIGH | MEDIUM | MANUAL_OVERRIDE
--
-- Existing rows remain unaffected (all columns nullable with defaults).

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS decision            TEXT,
  ADD COLUMN IF NOT EXISTS decision_reason     TEXT,
  ADD COLUMN IF NOT EXISTS decision_confidence TEXT;

-- Index: admin dashboard queries filter/sort by decision frequently
CREATE INDEX IF NOT EXISTS idx_claims_decision
  ON claims (decision)
  WHERE decision IS NOT NULL;

COMMENT ON COLUMN claims.decision             IS 'AI fraud decision: APPROVE | REVIEW | DENY';
COMMENT ON COLUMN claims.decision_reason       IS 'Human-readable AI explanation for the decision';
COMMENT ON COLUMN claims.decision_confidence   IS 'Confidence level: HIGH | MEDIUM | MANUAL_OVERRIDE';
