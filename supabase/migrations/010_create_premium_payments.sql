CREATE TABLE premium_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    amount DECIMAL(6,2) NOT NULL,
    razorpay_payment_id VARCHAR(100) NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW()
);
