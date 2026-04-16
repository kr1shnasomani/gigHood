import math
import time
from datetime import datetime, timezone
from backend.db.client import supabase
from backend.db.supabase_retry import execute_with_retry
from backend.config import settings

_DEGRADED_HEX_ACTIVE: set[str] = set()
_WEIGHT_CACHE_TTL_SECONDS = 300
_weight_cache: dict[str, float] | None = None
_weight_cache_ts = 0.0


def invalidate_weight_cache() -> None:
    """Forces reload of DCI weights on next cycle."""
    global _weight_cache, _weight_cache_ts
    _weight_cache = None
    _weight_cache_ts = 0.0


def _clamp_weight(value: float, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(0.0, min(1.0, parsed))


def get_active_dci_weights() -> dict[str, float]:
    """
    Returns active DCI weights from `dci_weights` with a short in-process cache.
    Falls back to cold-start defaults when table/data is unavailable.
    """
    global _weight_cache, _weight_cache_ts

    now = time.time()
    if _weight_cache and (now - _weight_cache_ts) < _WEIGHT_CACHE_TTL_SECONDS:
        return _weight_cache

    fallback = {
        "alpha": float(getattr(settings, "DCI_WEIGHT_ALPHA", 0.45)),
        "beta": float(getattr(settings, "DCI_WEIGHT_BETA", 0.25)),
        "gamma": float(getattr(settings, "DCI_WEIGHT_GAMMA", 0.20)),
        "delta": float(getattr(settings, "DCI_WEIGHT_DELTA", 0.10)),
    }

    try:
        res = execute_with_retry(
            lambda: supabase.table("dci_weights")
            .select("alpha,beta,gamma,delta")
            .eq("is_active", True)
            .order("trained_at", desc=True)
            .limit(1)
            .execute(),
            op_name="dci_engine:get_active_dci_weights",
        )

        row = (res.data or [None])[0]
        if not row:
            _weight_cache = fallback
            _weight_cache_ts = now
            return fallback

        alpha = _clamp_weight(row.get("alpha"), fallback["alpha"])
        beta = _clamp_weight(row.get("beta"), fallback["beta"])
        gamma = _clamp_weight(row.get("gamma"), fallback["gamma"])
        delta = _clamp_weight(row.get("delta"), fallback["delta"])

        total = alpha + beta + gamma + delta
        if total <= 0.0:
            _weight_cache = fallback
            _weight_cache_ts = now
            return fallback

        normalized = {
            "alpha": alpha / total,
            "beta": beta / total,
            "gamma": gamma / total,
            "delta": delta / total,
        }
        _weight_cache = normalized
        _weight_cache_ts = now
        return normalized
    except Exception:
        _weight_cache = fallback
        _weight_cache_ts = now
        return fallback

def sigmoid(x: float) -> float:
    """Standard sigmoid function mapping any real number into the (0, 1) bounds."""
    # Prevent math overflow for extreme negative values
    if x < -100:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))

def compute_dci(w: float, t: float, p: float, s: float, alpha=0.45, beta=0.25, gamma=0.20, delta=0.10) -> float:
    """
    Computes the Dynamic Condition Index raw polynomial and normalizes it.
    Formula: σ(α·W + β·T + γ·P + δ·S)
    """
    raw = (alpha * w) + (beta * t) + (gamma * p) + (delta * s)
    return sigmoid(raw)

def get_dci_status(dci: float) -> str:
    """
    Categorizes the exact DCI reading into one of the 3 system states.
    """
    if dci > 0.85:
        return 'disrupted'
    elif dci > 0.65:
        return 'elevated'
    return 'normal'

def run_dci_cycle(hex_ids: list[str]) -> dict:
    """
    For each hex:
    1. Read latest signals from `signal_cache`
    2. Check >=3 sources available (degraded mode if <3)
    3. Compute DCI
    4. Write to `dci_history`
    5. Update `hex_zones.current_dci` and `dci_status`
    """
    results = {}
    
    if not hex_ids:
        return results

    # Read active learned weights once per cycle.
    weights = get_active_dci_weights()

    # Fetch signals from Supabase cache
    try:
        response = execute_with_retry(
            lambda: supabase.table('signal_cache').select("*").in_('hex_id', hex_ids).execute(),
            op_name="dci_cycle:fetch_signal_cache",
        )
        all_signals = response.data
    except Exception as e:
        print(f"Failed to fetch signal_cache: {e}")
        all_signals = []

    # Group signals by hex
    signals_by_hex = {h: {} for h in hex_ids}
    for row in all_signals:
        h = row['hex_id']
        if h in signals_by_hex:
            sig_key = str(row.get('signal_type') or '').upper()
            signals_by_hex[h][sig_key] = row['normalized_score']
            
    for hex_id in hex_ids:
        hex_sigs = signals_by_hex[hex_id]
        
        # Check signal degraded condition
        if len(hex_sigs) < 3:
            # Degraded Mode: fallback to normal, skip computation
            results[hex_id] = {
                "dci": None,
                "status": "degraded (insufficient signals)"
            }

            if hex_id not in _DEGRADED_HEX_ACTIVE:
                _DEGRADED_HEX_ACTIVE.add(hex_id)
                try:
                    from backend.services.notification_service import notification_service

                    workers_res = None
                    try:
                        workers_res = execute_with_retry(
                            lambda: supabase.table('workers').select('id,device_token').eq('hex_id', hex_id).eq('status', 'active').execute(),
                            op_name=f"dci_cycle:degraded_workers_hex_id:{hex_id}",
                        )
                    except Exception:
                        workers_res = execute_with_retry(
                            lambda: supabase.table('workers').select('id,device_token').eq('home_hex', hex_id).eq('status', 'active').execute(),
                            op_name=f"dci_cycle:degraded_workers_home_hex:{hex_id}",
                        )

                    for worker in (workers_res.data or []):
                        token = worker.get('device_token')
                        if token:
                            notification_service.notify_degraded_mode(token)

                    notification_service.log_admin_alert(
                        f"Zone {hex_id} entered degraded monitoring mode."
                    )
                except Exception:
                    pass

            # Set to normal/none in DB, but log degradation safely
            try:
                execute_with_retry(
                    lambda: supabase.table('hex_zones').update({
                        "current_dci": None,
                        "dci_status": "normal",
                        "last_computed_at": datetime.now(timezone.utc).isoformat(),
                    }).eq('h3_index', hex_id).execute(),
                    op_name=f"dci_cycle:degraded_update_hex:{hex_id}",
                )
            except Exception:
                try:
                    execute_with_retry(
                        lambda: supabase.table('hex_zones').update({
                            "current_dci": None,
                            "dci_status": "normal",
                            "last_computed_at": datetime.now(timezone.utc).isoformat(),
                        }).eq('hex_id', hex_id).execute(),
                        op_name=f"dci_cycle:degraded_update_hex_compat:{hex_id}",
                    )
                except Exception:
                    pass
            continue

        if hex_id in _DEGRADED_HEX_ACTIVE:
            _DEGRADED_HEX_ACTIVE.discard(hex_id)
            
        # Defaults for missing signals safely mapped to 0 if required (since >=3 exist, max 2 are 0)
        w = float(hex_sigs.get("WEATHER", 0.0) or 0.0)
        t = float(hex_sigs.get("TRAFFIC", 0.0) or 0.0)
        p = float(hex_sigs.get("PLATFORM", 0.0) or 0.0)
        s = float(hex_sigs.get("SOCIAL", 0.0) or 0.0)

        # AQI contributes into weather context, but raw additive sums can inflate baseline DCI.
        # Use bounded averaging so fresh zones start in normal ranges unless true extremes occur.
        a = float(hex_sigs.get("AQI", 0.0) or 0.0)
        w_combined = (w + a) / 2.0 if a > 0 else w

        # Clamp signal components to prevent malformed upstream scores from saturating sigmoid.
        w_combined = max(0.0, min(1.5, w_combined))
        t = max(0.0, min(1.0, t))
        p = max(0.0, min(1.0, p))
        s = max(0.0, min(1.0, s))
        
        dci = compute_dci(
            w_combined,
            t,
            p,
            s,
            alpha=weights["alpha"],
            beta=weights["beta"],
            gamma=weights["gamma"],
            delta=weights["delta"],
        )
        status = get_dci_status(dci)
        
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Store to history
        try:
            execute_with_retry(
                lambda: supabase.table('dci_history').insert({
                    "hex_id": hex_id,
                    "dci_score": dci,
                    "weather_component": w_combined,
                    "traffic_component": t,
                    "platform_component": p,
                    "social_component": s,
                    "computed_at": now_iso
                }).execute(),
                op_name=f"dci_cycle:insert_history:{hex_id}",
            )
        except Exception as e:
            # Backward-compatible schema variant using w_score/t_score/p_score/s_score.
            try:
                execute_with_retry(
                    lambda: supabase.table('dci_history').insert({
                        "hex_id": hex_id,
                        "dci_score": dci,
                        "w_score": w_combined,
                        "t_score": t,
                        "p_score": p,
                        "s_score": s,
                        "dci_status": status,
                        "signal_count": len(hex_sigs),
                        "computed_at": now_iso,
                    }).execute(),
                    op_name=f"dci_cycle:insert_history_compat:{hex_id}",
                )
            except Exception as e2:
                print(f"Error inserting dci_history for {hex_id}: {e2}")
            
        # Update zone
        try:
            execute_with_retry(
                lambda: supabase.table('hex_zones').update({
                    "current_dci": dci,
                    "dci_status": status,
                    "last_computed_at": now_iso,
                }).eq('h3_index', hex_id).execute(),
                op_name=f"dci_cycle:update_hex:{hex_id}",
            )
        except Exception as e:
            try:
                execute_with_retry(
                    lambda: supabase.table('hex_zones').update({
                        "current_dci": dci,
                        "dci_status": status,
                        "last_computed_at": now_iso,
                    }).eq('hex_id', hex_id).execute(),
                    op_name=f"dci_cycle:update_hex_compat:{hex_id}",
                )
            except Exception:
                print(f"Error updating hex_zones for {hex_id}: {e}")
            
        results[hex_id] = {
            "dci": dci,
            "status": status
        }
        

        if settings.DCI_CYCLE_HEX_SLEEP_SECONDS > 0:
            time.sleep(settings.DCI_CYCLE_HEX_SLEEP_SECONDS)
        
    return results
