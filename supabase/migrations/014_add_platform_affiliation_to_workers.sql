ALTER TABLE workers
ADD COLUMN IF NOT EXISTS platform_affiliation VARCHAR(50) DEFAULT 'Other';
