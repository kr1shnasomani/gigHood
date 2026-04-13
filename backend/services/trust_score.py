from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.db.client import supabase


def _safe_ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def calculate_dynamic_trust(worker_id: str) -> dict[str, Any]:
    """
    Compute a live trust score from recent claim outcomes and fraud signals.
    Returns both the score and factor-wise breakdown for UI explanations.
    """
    now = datetime.now(timezone.utc)
    lookback_start = (now - timedelta(days=60)).isoformat()

    try:
        claims_res = (
            supabase.table("claims")
            .select("status,fraud_score,pop_validated,created_at")
            .eq("worker_id", worker_id)
            .gte("created_at", lookback_start)
            .execute()
        )
        claims = claims_res.data or []
    except Exception:
        claims_res = (
            supabase.table("claims")
            .select("status,fraud_score,created_at")
            .eq("worker_id", worker_id)
            .gte("created_at", lookback_start)
            .execute()
        )
        claims = claims_res.data or []

    total = len(claims)
    paid = sum(1 for c in claims if c.get("status") in {"paid", "approved"})
    denied = sum(1 for c in claims if c.get("status") == "denied")
    pop_failed = sum(1 for c in claims if c.get("pop_validated") is False)

    fraud_scores: list[float] = []
    for c in claims:
        val = c.get("fraud_score")
        if val is not None:
            fraud_scores.append(float(val))
    fraud_avg = (sum(fraud_scores) / max(len(fraud_scores), 1)) if fraud_scores else 0.0

    paid_ratio = _safe_ratio(paid, total)
    denied_ratio = _safe_ratio(denied, total)

    # Score components (0-100 target):
    # - Strong reward for successful paid history
    # - Penalty for denials and high fraud averages
    # - Smaller penalty for PoP failures
    base = 55.0
    paid_component = paid_ratio * 30.0
    denial_penalty = denied_ratio * 28.0
    fraud_penalty = (fraud_avg / 100.0) * 25.0
    pop_penalty = _safe_ratio(pop_failed, total) * 12.0

    score = _clamp(base + paid_component - denial_penalty - fraud_penalty - pop_penalty, 0.0, 100.0)

    formula_string = (
        f"Base Score: {base:.2f} | "
        f"Paid Bonus: +{paid_component:.2f} | "
        f"Denial Penalty: -{denial_penalty:.2f} | "
        f"Fraud Penalty: -{fraud_penalty:.2f} | "
        f"PoP Penalty: -{pop_penalty:.2f}"
    )

    summary = (
        "Strong recent history"
        if score >= 80
        else "Stable but watchlisted" if score >= 60 else "High-risk profile"
    )

    return {
        "score": round(score, 1),
        "summary": summary,
        "lookback_days": 60,
        "factors": {
            "claims_considered": total,
            "paid_claims": paid,
            "denied_claims": denied,
            "pop_failures": pop_failed,
            "average_fraud_score": round(fraud_avg, 1),
            "paid_ratio": round(paid_ratio, 3),
            "denied_ratio": round(denied_ratio, 3),
        },
        "formula": {
            "base": base,
            "paid_component": round(paid_component, 2),
            "denial_penalty": round(denial_penalty, 2),
            "fraud_penalty": round(fraud_penalty, 2),
            "pop_penalty": round(pop_penalty, 2),
        },
        "formula_string": formula_string,
    }
