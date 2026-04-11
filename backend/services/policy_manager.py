"""
backend/services/policy_manager.py — Policy Lifecycle Orchestration
=====================================================================

Production-grade policy creation and renewal with:
  • Worker validation         — rejects unknown worker_ids before any insert
  • Idempotency guard         — returns existing policy if (worker_id, week_start)
                                already exists; no duplicate rows possible
  • Input validation          — tier must be A/B/C; premium > 0; cap > 0
  • Structured JSON logging   — every outcome logged as key=value pairs via
                                policy_logger (structured, not f-string soup)
  • No unsafe fallback        — removed silent "fetch-after-failed-insert"
                                that could return a different worker's policy
  • renew_policy silent fail  — bare `except: pass` replaced with error log + raise
  • Metadata fields           — created_at (ISO-8601) and source ("auto"/"manual")
                                included in every insert
  • Duplicate protection      — idempotency check fires before insert on both
                                create_policy() and renew_policy()

Public API (unchanged — all callers in workers.py, policies.py, scheduler):
    get_next_monday_sunday_bounds(from_date) -> tuple[date, date]
    get_current_monday_sunday_bounds(from_date) -> tuple[date, date]
    fetch_worker_risk_metrics(worker_id) -> tuple[list, bool, float, str]
    explain_policy_decision(worker_id, tier) -> dict
    create_policy(worker_id) -> dict          ← raises on validation failure
    renew_policy(worker_id) -> dict | None    ← raises on DB failure (not pass)
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from backend.db.client import supabase
from backend.services.premium_bander import calculate_premium
from backend.services.risk_profiler import predict_tier

logger = logging.getLogger("policy_manager")
policy_logger = logging.getLogger("policy_manager.audit")

MONSOON_MONTHS = {6, 7, 8, 9}

# Valid tier values — any other value is a mis-prediction and must be caught early.
_VALID_TIERS = {"A", "B", "C"}

# Coverage caps per tier (rupees/day)
_TIER_COVERAGE_CAPS: dict[str, float] = {
    "A": 600.0,
    "B": 700.0,
    "C": 800.0,
}


# =============================================================================
# DATE UTILITIES  (unchanged)
# =============================================================================

def get_next_monday_sunday_bounds(from_date: date) -> tuple[date, date]:
    """Calculate the next upcoming Monday and following Sunday bounds."""
    days_ahead = 0 - from_date.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_mon = from_date + timedelta(days=days_ahead)
    next_sun = next_mon + timedelta(days=6)
    return next_mon, next_sun


def get_current_monday_sunday_bounds(from_date: date) -> tuple[date, date]:
    """Calculate the current active Monday and Sunday bounds."""
    curr_mon = from_date - timedelta(days=from_date.weekday())
    curr_sun = curr_mon + timedelta(days=6)
    return curr_mon, curr_sun


# =============================================================================
# DATA FETCH HELPERS  (unchanged behaviour, improved logging)
# =============================================================================

def _fetch_worker_profile(worker_id: str) -> tuple[str, Optional[str]]:
    city   = "Bengaluru"
    hex_id = None
    try:
        res = (
            supabase.table("workers")
            .select("city,hex_id")
            .eq("id", worker_id)
            .limit(1)
            .execute()
        )
        if res.data:
            row    = res.data[0]
            city   = row.get("city") or city
            hex_id = row.get("hex_id")
    except Exception as exc:
        logger.warning("_fetch_worker_profile(%s) failed: %s", worker_id, exc)
    return city, hex_id


def _fetch_recent_dci_history(hex_id: Optional[str], limit: int = 12) -> list[float]:
    if not hex_id:
        return [0.5]

    scores: list[float] = []
    try:
        res = (
            supabase.table("dci_history")
            .select("dci_score")
            .eq("hex_id", hex_id)
            .order("computed_at", desc=True)
            .limit(limit)
            .execute()
        )
        for row in res.data or []:
            val = row.get("dci_score")
            if val is not None:
                scores.append(float(val))
    except Exception as exc:
        logger.warning("_fetch_recent_dci_history(%s) failed: %s", hex_id, exc)

    if scores:
        return list(reversed(scores))

    for col in ("h3_index", "hex_id"):
        try:
            zone_res = (
                supabase.table("hex_zones")
                .select("current_dci")
                .eq(col, hex_id)
                .limit(1)
                .execute()
            )
            if zone_res.data and zone_res.data[0].get("current_dci") is not None:
                return [float(zone_res.data[0]["current_dci"])]
        except Exception:
            continue

    return [0.5]


def _fetch_claim_frequency(worker_id: str, lookback_days: int = 28) -> float:
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=lookback_days)
    ).isoformat()
    try:
        res = (
            supabase.table("claims")
            .select("id")
            .eq("worker_id", worker_id)
            .gte("created_at", cutoff)
            .execute()
        )
        return min(1.0, len(res.data or []) / 8.0)
    except Exception as exc:
        logger.warning("_fetch_claim_frequency(%s) failed: %s", worker_id, exc)
        return 0.0


# =============================================================================
# PUBLIC RISK METRICS  (unchanged)
# =============================================================================

def fetch_worker_risk_metrics(
    worker_id: str,
) -> tuple[list[float], bool, float, str]:
    city, hex_id   = _fetch_worker_profile(worker_id)
    history        = _fetch_recent_dci_history(hex_id)
    seasonal_flag  = date.today().month in MONSOON_MONTHS
    claim_freq     = _fetch_claim_frequency(worker_id)
    return history, seasonal_flag, claim_freq, city


# =============================================================================
# POLICY DECISION EXPLAINER  (unchanged)
# =============================================================================

def explain_policy_decision(
    worker_id: str,
    tier: Optional[str] = None,
) -> dict:
    history, season_flag, claim_freq, city = fetch_worker_risk_metrics(worker_id)
    avg_dci = round(sum(history) / len(history), 4) if history else 0.0

    computed_tier = tier or predict_tier(history, season_flag, city, claim_freq)

    dci_band = "low"
    if avg_dci >= 0.65:
        dci_band = "high"
    elif avg_dci >= 0.5:
        dci_band = "moderate"

    claim_band = "low"
    if claim_freq >= 0.7:
        claim_band = "high"
    elif claim_freq >= 0.35:
        claim_band = "moderate"

    seasonal_text = "monsoon risk period" if season_flag else "regular season"
    plain_language = (
        f"Your zone risk is {dci_band}, recent claim pattern is {claim_band}, "
        f"and season is {seasonal_text}. So your plan is set to Tier {computed_tier}."
    )
    reason_lines = [
        f"4-week DCI average: {avg_dci}",
        f"Recent claim frequency (28d): {round(claim_freq, 3)}",
        f"Seasonality flag: {'monsoon' if season_flag else 'regular'}",
        f"City risk context: {city}",
    ]
    return {
        "tier":                  computed_tier,
        "avg_dci_4w":            avg_dci,
        "avg_dci_band":          dci_band,
        "claim_frequency_28d":   round(claim_freq, 4),
        "claim_frequency_band":  claim_band,
        "seasonal_flag":         season_flag,
        "seasonal_text":         seasonal_text,
        "city":                  city,
        "history_points_used":   len(history),
        "plain_language":        plain_language,
        "reason":                " | ".join(reason_lines),
    }


# =============================================================================
# INTERNAL HELPERS
# =============================================================================

def _get_coverage_cap_for_tier(tier: str) -> float:
    return _TIER_COVERAGE_CAPS.get(tier, 700.0)


def _validate_worker_exists(worker_id: str) -> None:
    """
    Confirms the worker row exists in the workers table.
    Raises ValueError if not found — prevents orphaned policies.
    """
    try:
        res = (
            supabase.table("workers")
            .select("id")
            .eq("id", worker_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ValueError(f"Worker {worker_id!r} does not exist in the workers table")
    except ValueError:
        raise
    except Exception as exc:
        # DB call itself failed — surface as a runtime error rather than silently
        # allowing policy creation for an unvalidated worker.
        raise RuntimeError(
            f"Worker existence check failed for {worker_id!r}: {exc}"
        ) from exc


def _validate_policy_params(tier: str, premium: float, coverage_cap: float) -> None:
    """
    Gate that catches miscomputed values before any DB write.
    Raises ValueError with a descriptive message on any violation.
    """
    if tier not in _VALID_TIERS:
        raise ValueError(
            f"Invalid tier {tier!r} — must be one of {sorted(_VALID_TIERS)}"
        )
    if premium <= 0:
        raise ValueError(f"Premium must be > 0, got {premium}")
    if coverage_cap <= 0:
        raise ValueError(f"Coverage cap must be > 0, got {coverage_cap}")


def _check_idempotency(worker_id: str, week_start: date) -> Optional[dict]:
    """
    Returns an existing policy row if one already exists for (worker_id, week_start).
    This is the primary duplicate-protection mechanism — a unique DB constraint
    enforces this at the DB layer too, but checking here avoids a confusing
    constraint-violation error and allows a clean idempotent return.
    """
    try:
        res = (
            supabase.table("policies")
            .select("*")
            .eq("worker_id", worker_id)
            .eq("week_start", week_start.isoformat())
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception as exc:
        # If the idempotency check fails, log and fall through to attempt insert.
        # A duplicate-key error at the DB layer is safer than silently skipping.
        logger.warning(
            "Idempotency check failed for worker=%s week=%s: %s — proceeding to insert",
            worker_id, week_start, exc,
        )
    return None


# =============================================================================
# POLICY CREATION
# =============================================================================

def create_policy(worker_id: str) -> dict:
    """
    Creates a new policy for a worker with a 7-day waiting period.

    Safety guarantees:
      1. Worker must exist (ValueError if not)
      2. Idempotent: identical (worker_id, week_start) returns the existing row
      3. Tier/premium/cap validated before insert
      4. Structured audit log on every outcome

    Returns:
        The created (or existing) policy dict from the DB.

    Raises:
        ValueError  — invalid worker, bad computed params
        RuntimeError — DB call failure after validation passed
    """
    # ── Step 1: Worker validation ─────────────────────────────────────────────
    _validate_worker_exists(worker_id)

    # ── Step 2: Compute policy parameters ─────────────────────────────────────
    history, season_flag, claim_freq, city = fetch_worker_risk_metrics(worker_id)
    tier      = predict_tier(history, season_flag, city, claim_freq)
    dci_avg   = sum(history) / len(history) if history else 0.0
    curr_date = date.today()
    premium   = calculate_premium(tier, dci_avg, curr_date.month)
    cap       = _get_coverage_cap_for_tier(tier)

    # ── Step 3: Input validation ───────────────────────────────────────────────
    _validate_policy_params(tier, premium, cap)

    start_date, end_date = get_next_monday_sunday_bounds(curr_date)

    # ── Step 4: Idempotency guard ──────────────────────────────────────────────
    existing = _check_idempotency(worker_id, start_date)
    if existing:
        policy_logger.info(json.dumps({
            "event":      "policy_idempotent_skip",
            "worker_id":  worker_id,
            "policy_id":  existing.get("id"),
            "tier":       existing.get("tier"),
            "week_start": str(start_date),
        }))
        logger.info(
            "Policy already exists for worker=%s week=%s — returning existing policy_id=%s",
            worker_id, start_date, existing.get("id"),
        )
        return existing

    # ── Step 5: Insert ─────────────────────────────────────────────────────────
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        res = supabase.table("policies").insert({
            "worker_id":          worker_id,
            "tier":               tier,
            "weekly_premium":     premium,
            "coverage_cap_daily": cap,
            "week_start":         start_date.isoformat(),
            "week_end":           end_date.isoformat(),
            "status":             "active",
            "is_waiting_period":  True,
            "created_at":         now_iso,
            "source":             "auto",
        }).execute()

        if not res.data:
            raise RuntimeError(
                f"Policy insert returned no data for worker={worker_id}"
            )

        policy = res.data[0]

        policy_logger.info(json.dumps({
            "event":      "policy_created",
            "worker_id":  worker_id,
            "policy_id":  policy.get("id"),
            "tier":       tier,
            "premium":    premium,
            "cap":        cap,
            "week_start": str(start_date),
            "week_end":   str(end_date),
            "source":     "auto",
        }))
        logger.info(
            "Policy created: worker=%s tier=%s premium=%.2f week=%s→%s",
            worker_id, tier, premium, start_date, end_date,
        )
        return policy

    except (ValueError, RuntimeError):
        raise
    except Exception as exc:
        # ── No unsafe fallback: log clearly and re-raise ───────────────────
        logger.error(
            "Policy insert FAILED for worker=%s tier=%s week=%s: %s",
            worker_id, tier, start_date, exc,
        )
        policy_logger.info(json.dumps({
            "event":      "policy_create_failed",
            "worker_id":  worker_id,
            "tier":       tier,
            "week_start": str(start_date),
            "error":      str(exc),
        }))
        raise RuntimeError(
            f"Policy creation failed for worker {worker_id!r}: {exc}"
        ) from exc


# =============================================================================
# POLICY RENEWAL
# =============================================================================

def renew_policy(worker_id: str) -> Optional[dict]:
    """
    Creates a rollover policy for the next week (no waiting period).
    Called by the weekly APScheduler job every Monday.

    Safety guarantees:
      1. Worker must exist (ValueError if not)
      2. Idempotent: if next week's policy already exists, returns it cleanly
      3. Tier/premium/cap validated before insert
      4. Failures raise — no more silent `except: pass`

    Returns:
        The renewed policy dict, or the existing one if already renewed.

    Raises:
        ValueError  — invalid worker or bad params
        RuntimeError — DB failure
    """
    # ── Step 1: Worker validation ─────────────────────────────────────────────
    _validate_worker_exists(worker_id)

    # ── Step 2: Compute renewal parameters ────────────────────────────────────
    history, season_flag, claim_freq, city = fetch_worker_risk_metrics(worker_id)
    tier      = predict_tier(history, season_flag, city, claim_freq)
    dci_avg   = sum(history) / len(history) if history else 0.0
    curr_date = date.today()
    premium   = calculate_premium(tier, dci_avg, curr_date.month)
    cap       = _get_coverage_cap_for_tier(tier)

    # ── Step 3: Input validation ───────────────────────────────────────────────
    _validate_policy_params(tier, premium, cap)

    start_date, end_date = get_next_monday_sunday_bounds(curr_date)

    # ── Step 4: Idempotency guard ──────────────────────────────────────────────
    existing = _check_idempotency(worker_id, start_date)
    if existing:
        policy_logger.info(json.dumps({
            "event":      "policy_renewal_idempotent_skip",
            "worker_id":  worker_id,
            "policy_id":  existing.get("id"),
            "tier":       existing.get("tier"),
            "week_start": str(start_date),
        }))
        logger.info(
            "Renewal already exists for worker=%s week=%s — returning existing policy_id=%s",
            worker_id, start_date, existing.get("id"),
        )
        return existing

    # ── Step 5: Insert ─────────────────────────────────────────────────────────
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        res = supabase.table("policies").insert({
            "worker_id":          worker_id,
            "tier":               tier,
            "weekly_premium":     premium,
            "coverage_cap_daily": cap,
            "week_start":         start_date.isoformat(),
            "week_end":           end_date.isoformat(),
            "status":             "active",
            "is_waiting_period":  False,
            "created_at":         now_iso,
            "source":             "auto",
        }).execute()

        if not res.data:
            raise RuntimeError(
                f"Policy renewal insert returned no data for worker={worker_id}"
            )

        policy = res.data[0]

        policy_logger.info(json.dumps({
            "event":      "policy_renewed",
            "worker_id":  worker_id,
            "policy_id":  policy.get("id"),
            "tier":       tier,
            "premium":    premium,
            "cap":        cap,
            "week_start": str(start_date),
            "week_end":   str(end_date),
            "source":     "auto",
        }))
        logger.info(
            "Policy renewed: worker=%s tier=%s premium=%.2f week=%s→%s",
            worker_id, tier, premium, start_date, end_date,
        )
        return policy

    except (ValueError, RuntimeError):
        raise
    except Exception as exc:
        # ── No silent pass: log clearly and raise ────────────────────────
        logger.error(
            "Policy renewal FAILED for worker=%s tier=%s week=%s: %s",
            worker_id, tier, start_date, exc,
        )
        policy_logger.info(json.dumps({
            "event":      "policy_renew_failed",
            "worker_id":  worker_id,
            "tier":       tier,
            "week_start": str(start_date),
            "error":      str(exc),
        }))
        raise RuntimeError(
            f"Policy renewal failed for worker {worker_id!r}: {exc}"
        ) from exc
