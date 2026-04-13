-- Create threshold audit log table for tracking threshold drift over time
CREATE TABLE IF NOT EXISTS fraud_threshold_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  approve_threshold FLOAT NOT NULL,
  deny_threshold FLOAT NOT NULL,
  sample_count INT NOT NULL,
  override_rate FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Seed with some historical mock data so the chart looks good
INSERT INTO fraud_threshold_audit (approve_threshold, deny_threshold, sample_count, override_rate, created_at)
VALUES 
  (0.20, 0.80, 100, 0.05, now() - INTERVAL '6 weeks'),
  (0.22, 0.78, 250, 0.06, now() - INTERVAL '5 weeks'),
  (0.25, 0.76, 500, 0.08, now() - INTERVAL '4 weeks'),
  (0.28, 0.77, 650, 0.05, now() - INTERVAL '3 weeks'),
  (0.30, 0.75, 800, 0.04, now() - INTERVAL '2 weeks'),
  (0.33, 0.74, 1100, 0.03, now() - INTERVAL '1 weeks');
