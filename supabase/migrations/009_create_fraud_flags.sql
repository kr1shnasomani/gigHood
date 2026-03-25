CREATE TABLE fraud_flags (
    id BIGSERIAL PRIMARY KEY,
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) NOT NULL,
    score_contribution INTEGER NOT NULL,
    details JSONB
);
