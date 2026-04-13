-- Migration 021: Create fraud_feedback table for self-learning AI engine
-- Per AGENTS.md: all schema changes are migration-first.
--
-- This table forms the closed feedback loop:
--   AI Decision → Admin Override → fraud_feedback → Adaptive thresholds
--
-- Each row records one learning event:
--   fraud_score    – raw score from the fraud engine (0-100 scale)
--   ai_decision    – what the AI originally decided
--   admin_decision – what the admin overrode to (NULL if not overridden)
--   was_override   – TRUE when admin_decision differs from ai_decision
--   notes          – free-text context for auditors

CREATE TABLE IF NOT EXISTS fraud_feedback (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id         TEXT        NOT NULL,
  fraud_score      FLOAT       NOT NULL CHECK (fraud_score >= 0 AND fraud_score <= 100),
  ai_decision      TEXT        NOT NULL CHECK (ai_decision IN ('APPROVE', 'REVIEW', 'DENY')),
  admin_decision   TEXT        NOT NULL CHECK (admin_decision IN ('APPROVE', 'DENY')),
  was_override     BOOLEAN     GENERATED ALWAYS AS (ai_decision <> admin_decision) STORED,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT
);

-- Fast access for the adaptive threshold query (reads ALL rows, needs no filter index)
-- but we index claim_id for lookup and admin_decision for aggregation scans.
CREATE INDEX IF NOT EXISTS idx_fraud_feedback_claim_id
  ON fraud_feedback (claim_id);

CREATE INDEX IF NOT EXISTS idx_fraud_feedback_admin_decision
  ON fraud_feedback (admin_decision);

-- Useful for analytics: how many overrides per day
CREATE INDEX IF NOT EXISTS idx_fraud_feedback_created_at
  ON fraud_feedback (created_at DESC);

COMMENT ON TABLE  fraud_feedback IS 'Closed-loop AI training data: stores AI decision + admin override for adaptive threshold learning';
COMMENT ON COLUMN fraud_feedback.was_override IS 'True when admin corrected the AI — the most valuable training signal';
