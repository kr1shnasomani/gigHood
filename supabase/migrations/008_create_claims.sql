CREATE TYPE claim_resolution_path AS ENUM ('fast_track', 'soft_queue', 'active_verify', 'denied');
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'denied', 'appealed', 'paid');

CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES disruption_events(id) ON DELETE CASCADE,
    pop_validated BOOLEAN,
    fraud_score INTEGER,
    resolution_path claim_resolution_path,
    payout_amount DECIMAL(8,2),
    disrupted_hours DECIMAL(4,2),
    status claim_status DEFAULT 'pending',
    razorpay_payment_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    UNIQUE(worker_id, event_id)
);
