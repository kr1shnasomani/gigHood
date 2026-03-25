CREATE TABLE disruption_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hex_id VARCHAR(20) NOT NULL REFERENCES hex_zones(hex_id) ON DELETE CASCADE,
    dci_peak DECIMAL(4,3),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_hours DECIMAL(4,2),
    trigger_signals JSONB
);
