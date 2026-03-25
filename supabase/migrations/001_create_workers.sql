CREATE TYPE worker_status AS ENUM ('active', 'inactive', 'suspended');

CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100),
    city VARCHAR(50),
    dark_store_zone VARCHAR(100),
    hex_id VARCHAR(20),
    avg_daily_earnings DECIMAL(8,2),
    upi_id VARCHAR(100),
    device_model VARCHAR(100),
    device_os_version VARCHAR(20),
    sim_carrier VARCHAR(50),
    sim_registration_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    trust_score INTEGER DEFAULT 50,
    status worker_status DEFAULT 'active'
);
