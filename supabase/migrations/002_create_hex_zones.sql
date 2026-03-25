CREATE TYPE hex_dci_status AS ENUM ('normal', 'elevated', 'disrupted');

CREATE TABLE hex_zones (
    hex_id VARCHAR(20) PRIMARY KEY,
    city VARCHAR(50),
    centroid GEOMETRY(POINT, 4326),
    boundary GEOMETRY(POLYGON, 4326),
    current_dci DECIMAL(4,3),
    dci_status hex_dci_status DEFAULT 'normal',
    last_computed_at TIMESTAMPTZ,
    active_worker_count INTEGER DEFAULT 0
);
