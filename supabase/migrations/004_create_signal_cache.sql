CREATE TYPE signal_source_type AS ENUM ('weather', 'aqi', 'traffic', 'platform', 'social');

CREATE TABLE signal_cache (
    id BIGSERIAL PRIMARY KEY,
    hex_id VARCHAR(20) NOT NULL REFERENCES hex_zones(hex_id) ON DELETE CASCADE,
    signal_type signal_source_type NOT NULL,
    raw_data JSONB,
    normalized_score DECIMAL(5,3),
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    source_available BOOLEAN DEFAULT true
);
