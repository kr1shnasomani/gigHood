import logging
from datetime import datetime, timedelta, timezone
from backend.db.client import supabase

logger = logging.getLogger("api")

def get_4w_avg_payout(worker_id: str) -> float:
    """
    Queries past 28-day finalized 'paid' claims extracting an average payout tracking historical size.
    Features Cold Start proxy defaults: Returns 500 flat for new workers.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=28)
    
    try:
        res = supabase.table('claims').select('payout_amount') \
            .eq('worker_id', worker_id) \
            .eq('status', 'paid') \
            .gte('resolved_at', cutoff.isoformat()) \
            .execute()
            
        data = res.data
        if not data:
            return 500.0
            
        total = sum(d.get('payout_amount', 0.0) for d in data)
        return round(total / len(data), 2)
        
    except Exception as e:
        logger.error(f"Failed to fetch 4-week claims for {worker_id}: {e}")
        return 500.0

def _get_tier_cap(tier: str) -> float:
    if tier == 'A': return 600.0
    if tier == 'B': return 700.0
    if tier == 'C': return 800.0
    return 700.0

def calculate_payout(avg_daily_earnings: float, disrupted_hours: float, tier: str, worker_id: str, cached_historical_avg: float = None) -> float:
    """
    Computes exact payout constraints sequentially.
    1. Base math (Earnings/8 * Hrs)
    2. Physical Tier Policy Caps (A: 600, B: 700, C: 800)
    3. Trailing 2.5x Maturation Max Cap mapping historical trust
    
    Args:
        cached_historical_avg: Optional pre-computed 4-week average to skip database call.
                               If None, will fetch from database (slower).
    """
    if disrupted_hours <= 0:
         return 0.0
         
    # 1. Base Math Formula
    raw_payout = (avg_daily_earnings / 8.0) * disrupted_hours
    
    # 2. Daily Coverage Caps
    tier_cap = _get_tier_cap(tier)
    capped_by_tier = min(raw_payout, tier_cap)
    
    # 3. Maturation Cap (2.5x 4-week average boundary)
    # Use cached value if provided, otherwise query database (slower path)
    if cached_historical_avg is None:
        historical_avg = get_4w_avg_payout(worker_id)
    else:
        historical_avg = cached_historical_avg
    maturation_cap = historical_avg * 2.5
    
    final_payout = min(capped_by_tier, maturation_cap)
    
    return round(final_payout, 2)
