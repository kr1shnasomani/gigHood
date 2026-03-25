CREATE TABLE dci_history (
    id BIGSERIAL PRIMARY KEY,
    hex_id VARCHAR(20) NOT NULL REFERENCES hex_zones(hex_id) ON DELETE CASCADE,
    dci_score DECIMAL(4,3) NOT NULL,
    w_score DECIMAL(5,3),
    t_score DECIMAL(5,3),
    p_score DECIMAL(5,3),
    s_score DECIMAL(5,3),
    computed_at TIMESTAMPTZ DEFAULT NOW()
);
