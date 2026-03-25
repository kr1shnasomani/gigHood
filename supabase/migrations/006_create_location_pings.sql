CREATE TABLE location_pings (
    id BIGSERIAL PRIMARY KEY,
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    hex_id VARCHAR(20),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    accuracy_radius DECIMAL(6,2),
    network_signal_strength INTEGER,
    mock_location_flag BOOLEAN DEFAULT false,
    pinged_at TIMESTAMPTZ DEFAULT NOW()
);
