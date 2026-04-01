from datetime import date, timedelta
from backend.db.client import supabase
from backend.services.risk_profiler import predict_tier
from backend.services.premium_bander import calculate_premium
import logging

logger = logging.getLogger("api")

def get_next_monday_sunday_bounds(from_date: date) -> tuple[date, date]:
    """Calculate the next upcoming Monday and following Sunday bounds"""
    days_ahead = 0 - from_date.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_mon = from_date + timedelta(days=days_ahead)
    next_sun = next_mon + timedelta(days=6)
    return next_mon, next_sun

def get_current_monday_sunday_bounds(from_date: date) -> tuple[date, date]:
    """Calculate the current active Monday and Sunday bounds"""
    curr_mon = from_date - timedelta(days=from_date.weekday())
    curr_sun = curr_mon + timedelta(days=6)
    return curr_mon, curr_sun

def fetch_worker_mock_metrics() -> tuple[list[float], bool, float]:
    """Stub simulating history fetches for Phase 7 prediction logic"""
    # Assuming standard Bengaluru normal-ish zone
    return [0.35, 0.40, 0.38, 0.30, 0.35, 0.32], False, 0.05

def _get_coverage_cap_for_tier(tier: str) -> float:
    if tier == 'A': return 600.0
    if tier == 'B': return 700.0
    if tier == 'C': return 800.0
    return 700.0 # B

def create_policy(worker_id: str):
    """
    Creates a brand new policy for a completely new worker. 
    Implements a 7-day waiting period as per IMPLEMENTATION.md.
    """
    history, season_flag, claim_freq = fetch_worker_mock_metrics()

    city = "Bengaluru"
    try:
        worker_res = supabase.table('workers').select('city').eq('id', worker_id).execute()
        if worker_res.data and worker_res.data[0].get('city'):
            city = worker_res.data[0]['city']
    except Exception:
        pass

    tier = predict_tier(history, season_flag, city, claim_freq)
    
    # Quick DCI proxy average
    dci_avg = sum(history) / len(history) if history else 0.0
    curr_date = date.today()
    premium = calculate_premium(tier, dci_avg, curr_date.month)
    
    start_date, end_date = get_next_monday_sunday_bounds(curr_date)
    
    try:
        res = supabase.table('policies').insert({
            "worker_id": worker_id,
            "tier": tier,
            "weekly_premium": premium,
            "coverage_cap_daily": _get_coverage_cap_for_tier(tier),
            "week_start": start_date.isoformat(),
            "week_end": end_date.isoformat(),
            "status": "active",
            "is_waiting_period": True
        }).execute()
        
        logger.info(f"Policy successfully created for {worker_id} - Tier {tier}")
        return res.data[0]
    except Exception as e:
        logger.error(f"Failed to create policy for {worker_id}: {e}")
        try:
             # Fallback parsing supabase-py specific APIResponse unpack exception pattern if generated inside execute() layer
             inserted = supabase.table('policies').select('*').eq('worker_id', worker_id).execute()
             return inserted.data[0]
        except Exception as fallback:
             pass
        raise e

def renew_policy(worker_id: str):
    """
    Automatically creates a rollover continuous policy.
    No waiting period cleanly applied (False) since they are renewing active members.
    """
    # We simulate reading the same metrics
    history, season_flag, claim_freq = fetch_worker_mock_metrics()

    city = "Bengaluru"
    try:
        worker_res = supabase.table('workers').select('city').eq('id', worker_id).execute()
        if worker_res.data and worker_res.data[0].get('city'):
            city = worker_res.data[0]['city']
    except Exception:
        pass

    tier = predict_tier(history, season_flag, city, claim_freq)
    dci_avg = sum(history) / len(history) if history else 0.0
    curr_date = date.today()
    premium = calculate_premium(tier, dci_avg, curr_date.month)
    
    # We want the next week's policy (renewing for future)
    start_date, end_date = get_next_monday_sunday_bounds(curr_date)
    
    try:
        res = supabase.table('policies').insert({
            "worker_id": worker_id,
            "tier": tier,
            "weekly_premium": premium,
            "coverage_cap_daily": _get_coverage_cap_for_tier(tier),
            "week_start": start_date.isoformat(),
            "week_end": end_date.isoformat(),
            "status": "active",
            "is_waiting_period": False
        }).execute()
        
        logger.info(f"Policy successfully renewed for {worker_id} - Next bounds: {start_date}")
        if hasattr(res, 'data') and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Failed to renew policy for worker {worker_id}: {e}")
        pass
