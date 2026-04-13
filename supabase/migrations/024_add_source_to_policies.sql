-- Add source column to policies table
ALTER TABLE policies ADD COLUMN source VARCHAR(50) DEFAULT 'auto';
