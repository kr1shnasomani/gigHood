-- Keep claims and disruption events render-safe for admin/worker surfaces.
-- This migration mirrors the live patch applied via Supabase MCP.

ALTER TABLE public.claims
  ALTER COLUMN fraud_score SET DEFAULT 30;

UPDATE public.claims
SET fraud_score = 30
WHERE fraud_score IS NULL;

UPDATE public.claims
SET resolution_path = 'soft_queue'
WHERE resolution_path IS NULL
  AND status = 'pending';

UPDATE public.claims
SET resolution_path = 'denied'
WHERE resolution_path IS NULL
  AND status = 'denied';

UPDATE public.disruption_events
SET dci_peak = (
  1 / (
    1 + exp(-(
      0.45 * COALESCE((trigger_signals->>'W')::numeric, 0)
      + 0.25 * COALESCE((trigger_signals->>'T')::numeric, 0)
      + 0.20 * COALESCE((trigger_signals->>'P')::numeric, 0)
      + 0.10 * COALESCE((trigger_signals->>'S')::numeric, 0)
    ))
  )
)
WHERE dci_peak IS NULL
  AND trigger_signals IS NOT NULL
  AND (
    trigger_signals ? 'W'
    OR trigger_signals ? 'T'
    OR trigger_signals ? 'P'
    OR trigger_signals ? 'S'
  );

UPDATE public.disruption_events de
SET dci_peak = hz.current_dci
FROM public.hex_zones hz
WHERE de.dci_peak IS NULL
  AND (hz.h3_index = de.hex_id OR hz.h3_index = de.h3_index);

ALTER TABLE public.claims
  ALTER COLUMN fraud_score SET NOT NULL;
