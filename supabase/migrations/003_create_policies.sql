CREATE TYPE policy_tier AS ENUM ('A', 'B', 'C');
CREATE TYPE policy_status AS ENUM ('active', 'expired', 'cancelled');

CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    tier policy_tier NOT NULL,
    weekly_premium DECIMAL(6,2),
    coverage_cap_daily DECIMAL(8,2),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status policy_status DEFAULT 'active',
    is_waiting_period BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
