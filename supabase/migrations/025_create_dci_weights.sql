-- Migration 025: Create dci_weights table for ML-optimized DCI signal weights
-- ============================================================================
-- SOLUTION.md §XGBoost's Exact Role:
--   "XGBoost performs DCI weight optimization — updating the α, β, γ, δ
--    coefficients weekly based on actual disruption outcomes."
--
-- This table stores the ML-derived weights so they are:
--   1. Persistent across server restarts
--   2. Auditable (full history of weekly retrains)
--   3. Queryable from the admin dashboard
--   4. Used by dci_engine.py instead of the hardcoded defaults

CREATE TABLE IF NOT EXISTS dci_weights (
    id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    alpha                   float       NOT NULL DEFAULT 0.45,  -- weather signal weight
    beta                    float       NOT NULL DEFAULT 0.25,  -- traffic signal weight
    gamma                   float       NOT NULL DEFAULT 0.20,  -- platform signal weight
    delta                   float       NOT NULL DEFAULT 0.10,  -- social signal weight
    model_accuracy          float,                               -- XGBoost validation accuracy
    training_sample_count   int,                                 -- disruption events trained on
    feature_importances     jsonb,                               -- raw XGB importances for audit
    notes                   text,                                -- human-readable provenance
    is_active               boolean     NOT NULL DEFAULT true,
    trained_at              timestamptz NOT NULL DEFAULT now(),
    created_at              timestamptz NOT NULL DEFAULT now()
);

-- Index for fast latest-row lookup by dci_engine.py
CREATE INDEX IF NOT EXISTS idx_dci_weights_trained_at
    ON dci_weights (trained_at DESC);

-- Seed the cold-start priors — always present even before any ML retraining
-- Weights derived from: RedSeer 2023 Q-commerce incident data +
-- IMD historical monsoon rainfall correlation with delivery downtime
INSERT INTO dci_weights (
    alpha, beta, gamma, delta,
    notes, is_active, training_sample_count, model_accuracy
)
VALUES (
    0.45, 0.25, 0.20, 0.10,
    'cold-start priors — IMD/RedSeer actuarial bootstrapping (SOLUTION.md §Cold-Start Strategy). '
    'Weather (α=0.45) dominant per RedSeer 2023 Q-commerce 60-80% order drop during heavy rain. '
    'Traffic (β=0.25) secondary — curfews and floods block routes independently. '
    'Platform (γ=0.20) tertiary — binary outage flag less frequent. '
    'Social (δ=0.10) lowest — <1 bandh/month vs 3-6 weather events (RedSeer 2023).',
    true, 0, NULL
)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE dci_weights ENABLE ROW LEVEL SECURITY;

-- Service role gets full access for the backend
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'dci_weights' AND policyname = 'service_role_all_dci_weights'
    ) THEN
        CREATE POLICY "service_role_all_dci_weights" ON dci_weights
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Anon role can read weights (admin dashboard, public audit)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'dci_weights' AND policyname = 'anon_read_dci_weights'
    ) THEN
        CREATE POLICY "anon_read_dci_weights" ON dci_weights
            FOR SELECT TO anon USING (true);
    END IF;
END $$;
