"""
backend/services/payout_calculator.py — Payout Computation Engine
==================================================================

Production-grade payout calculation with:
  • Input validation      — rejects zero/negative earnings & hours; clamps
                            hours to [0, 12] and earnings to [0, 2000]
  • Fraud-aware scaling   — optional fraud_score (0.0–1.0) halves payout at
                            >0.6 and zeroes it at >0.8
  • Global safety cap     — absolute ceiling of ₹2,000 per single payout
  • No DB call in hot path — calculate_payout() never touches the DB;
                             get_4w_avg_payout() is kept for the pre-fetch
                             pattern (callers pass cached_historical_avg=...)
  • Consistent rounding   — round(x, 2) applied at every exit point
  • Structured audit log  — every decision logged as key=value via
                             payout_logger for offline analysis
  • Safe defaults         — unknown tier defaults to "B" with a warning

Public API (unchanged — all callers in claim_approver, workers.py, demo):
    get_4w_avg_payout(worker_id) -> float
    calculate_payout(avg_daily_earnings, disrupted_hours, tier, worker_id,
                     cached_historical_avg=None, fraud_score=0.0) -> float
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from backend.db.client import supabase

logger = logging.getLogger("payout_calculator")
payout_logger = logging.getLogger("payout_calculator.audit")

# ── Tier coverage caps (rupees/day) ───────────────────────────────────────────
_TIER_CAPS: dict[str, float] = {
    "A": 600.0,
    "B": 700.0,
    "C": 800.0,
}
_VALID_TIERS = set(_TIER_CAPS)

# ── Global absolute ceiling — no single payout can exceed this ────────────────
MAX_PAYOUT: float = 2000.0

# ── Fraud score thresholds ────────────────────────────────────────────────────
_FRAUD_ZERO_THRESHOLD: float  = 0.8   # score > this → ₹0
_FRAUD_HALVE_THRESHOLD: float = 0.6   # score > this → 50% payout

# ── Input clamp limits ────────────────────────────────────────────────────────
_MAX_EARNINGS_INPUT: float       = 2000.0   # beyond this is data error
_MAX_DISRUPTED_HOURS_INPUT: float = 12.0    # beyond 12h is physical impossible
_COLD_START_AVG: float           = 500.0    # fallback for new workers


# =============================================================================
# 1. HISTORICAL AVERAGE (DB call — keep OUT of calculate_payout hot path)
# =============================================================================

def get_4w_avg_payout(worker_id: str) -> float:
    """
    Queries past 28-day finalised 'paid' claims to compute the average payout
    for this worker. Call this ONCE before the hot path and pass the result as
    cached_historical_avg to calculate_payout().

    Cold-start default: returns 500.0 for new workers with no history.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=28)
    try:
        res = (
            supabase.table("claims")
            .select("payout_amount")
            .eq("worker_id", worker_id)
            .eq("status", "paid")
            .gte("resolved_at", cutoff.isoformat())
            .limit(100)
            .execute()
        )
        if res and hasattr(res, "data") and res.data:
            data = res.data
        else:
            return float(_COLD_START_AVG)

        total = sum(float(d.get("payout_amount") or 0.0) for d in data)
        return round(total / max(len(data), 1), 2)

    except Exception as exc:
        logger.error(
            "get_4w_avg_payout(%s) DB query failed: %s — using cold-start default",
            worker_id, exc,
        )
        return float(_COLD_START_AVG)


# =============================================================================
# 2. TIER CAP LOOKUP
# =============================================================================

def _get_tier_cap(tier: str) -> float:
    return _TIER_CAPS.get(tier, _TIER_CAPS["B"])


# =============================================================================
# 3. CORE PAYOUT FORMULA (NO DB calls)
# =============================================================================

def calculate_payout(
    avg_daily_earnings:  float,
    disrupted_hours:     float,
    tier:                str,
    worker_id:           str,
    cached_historical_avg: float | None = None,
    fraud_score:         float = 0.0,
) -> float:
    """
    Computes the final payout for a disruption claim.

    Formula stages (applied in order):
      1. Input validation & clamping
      2. Fraud-score zero-out  (score > 0.8 → ₹0)
      3. Base math:  (avg_daily_earnings / 8) × disrupted_hours
      4. Tier cap:   A=₹600  B=₹700  C=₹800
      5. Maturation cap:  2.5 × 4-week historical average
      6. Fraud-score halve  (score > 0.6 → ×0.5)
      7. Global safety cap: ₹2,000
      8. Consistent rounding to 2 decimal places

    Args:
        avg_daily_earnings:    Worker's self-declared average daily earnings (₹)
        disrupted_hours:       Hours of disruption in the event window
        tier:                  Policy tier — "A", "B", or "C"
        worker_id:             Worker UUID (used for cache fallback only)
        cached_historical_avg: Pre-fetched 4-week average from get_4w_avg_payout().
                               Pass this to avoid a DB call in the hot path.
                               If None, falls back to cold-start default (₹500).
                               ⚠ The DB is NOT called here — pass the cached value.
        fraud_score:           Normalised fraud score [0.0, 1.0].  Default 0.

    Returns:
        Final payout in rupees, rounded to 2 decimal places.
        Returns 0.0 if inputs are invalid or fraud_score > 0.8.
    """
    # ── Stage 1: Input validation ─────────────────────────────────────────────
    if avg_daily_earnings <= 0:
        logger.warning(
            "calculate_payout(%s): avg_daily_earnings=%s ≤ 0 — returning 0",
            worker_id, avg_daily_earnings,
        )
        return 0.0

    if disrupted_hours <= 0 or disrupted_hours > 24:
        logger.warning(
            "calculate_payout(%s): disrupted_hours=%s out of range (0, 24] — returning 0",
            worker_id, disrupted_hours,
        )
        return 0.0

    # Normalise tier — unknown tier silently falls back to B
    if tier not in _VALID_TIERS:
        logger.warning(
            "calculate_payout(%s): unknown tier=%r — defaulting to 'B'",
            worker_id, tier,
        )
        tier = "B"

    # Clamp inputs to sane physical limits
    earnings = min(float(avg_daily_earnings), _MAX_EARNINGS_INPUT)
    hours    = min(float(disrupted_hours), _MAX_DISRUPTED_HOURS_INPUT)
    score    = max(0.0, min(1.0, float(fraud_score)))  # clamp to [0, 1]

    # ── Stage 2: Fraud zero-out (highest severity, checked first) ────────────
    if score > _FRAUD_ZERO_THRESHOLD:
        logger.warning(
            "calculate_payout(%s): fraud_score=%.3f > %.1f threshold — payout zeroed",
            worker_id, score, _FRAUD_ZERO_THRESHOLD,
        )
        payout_logger.info(json.dumps({
            "event":        "payout_fraud_zeroed",
            "worker_id":    worker_id,
            "earnings":     earnings,
            "hours":        hours,
            "tier":         tier,
            "fraud_score":  score,
            "final_payout": 0.0,
        }))
        return 0.0

    # ── Stage 3: Base math ───────────────────────────────────────────────────
    raw_payout = (earnings / 8.0) * hours

    # ── Stage 4: Tier coverage cap ───────────────────────────────────────────
    tier_cap       = _get_tier_cap(tier)
    capped_by_tier = min(raw_payout, tier_cap)

    # ── Stage 5: Maturation cap (2.5× 4-week average) ────────────────────────
    # DO NOT call get_4w_avg_payout() here — use the cached value or default.
    historical_avg  = float(cached_historical_avg) if cached_historical_avg is not None else _COLD_START_AVG
    maturation_cap  = historical_avg * 2.5
    after_maturation = min(capped_by_tier, maturation_cap)

    # ── Stage 6: Fraud-score halving ─────────────────────────────────────────
    after_fraud = after_maturation
    if score > _FRAUD_HALVE_THRESHOLD:
        after_fraud = after_maturation * 0.5
        logger.info(
            "calculate_payout(%s): fraud_score=%.3f > %.1f — payout halved %.2f → %.2f",
            worker_id, score, _FRAUD_HALVE_THRESHOLD, after_maturation, after_fraud,
        )

    # ── Stage 7: Global absolute safety cap ──────────────────────────────────
    final_payout = round(min(after_fraud, MAX_PAYOUT), 2)

    # ── Structured audit log ──────────────────────────────────────────────────
    payout_logger.info(json.dumps({
        "event":            "payout_calculated",
        "worker_id":        worker_id,
        "earnings":         earnings,
        "hours":            hours,
        "tier":             tier,
        "raw_payout":       round(raw_payout, 2),
        "tier_cap":         tier_cap,
        "maturation_cap":   round(maturation_cap, 2),
        "fraud_score":      score,
        "final_payout":     final_payout,
    }))

    logger.info(
        "calculate_payout(%s): earnings=%.2f hrs=%.1f tier=%s "
        "raw=%.2f tier_cap=%.2f mat_cap=%.2f fraud=%.3f final=%.2f",
        worker_id, earnings, hours, tier,
        raw_payout, tier_cap, maturation_cap, score, final_payout,
    )

    return final_payout
