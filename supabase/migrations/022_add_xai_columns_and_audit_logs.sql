-- Migration 022: XAI breakdown columns on claims + audit_logs table
-- Per AGENTS.md: all schema changes are migration-first.

-- ── 1. Explainable AI columns on claims ──────────────────────────────────────
-- Stores the per-feature score breakdown and primary risk signal for every
-- claim so regulators can inspect WHY a decision was made, not just what it was.

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS fraud_breakdown      JSONB,
  ADD COLUMN IF NOT EXISTS fraud_top_reason     TEXT;

COMMENT ON COLUMN claims.fraud_breakdown  IS 'XAI: per-feature fraud score contributions (location, telemetry, gate2, gps, velocity, mock, network)';
COMMENT ON COLUMN claims.fraud_top_reason IS 'XAI: name of the highest-contributing fraud feature for this claim';

-- ── 2. Audit log table ────────────────────────────────────────────────────────
-- Immutable ledger of every system action: AI decisions AND admin overrides.
-- Satisfies RBI/IRDAI traceability requirements:
--   "Who did what, to which entity, with what evidence, when?"

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT        NOT NULL,          -- 'claim' | 'policy' | 'worker'
  entity_id     TEXT        NOT NULL,
  action        TEXT        NOT NULL,          -- 'AUTO_DECISION' | 'OVERRIDE' | 'CREATE' | 'STATUS_CHANGE'
  performed_by  TEXT        NOT NULL,          -- 'AI' | admin user_id
  metadata      JSONB,                         -- full context snapshot at time of action
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the audit page query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by
  ON audit_logs (performed_by);

-- Audit logs are append-only — optionally enforce with RLS in production:
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY audit_insert_only ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

COMMENT ON TABLE  audit_logs IS 'Immutable action ledger for RBI/IRDAI compliance: records every AI decision and admin override with full metadata';
COMMENT ON COLUMN audit_logs.performed_by IS 'AI (system) or Admin UUID for human actions';
COMMENT ON COLUMN audit_logs.metadata     IS 'JSONB snapshot: fraud_score, decision, breakdown, reason, XAI features — everything needed to reconstruct WHY';
