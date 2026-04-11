"""
backend/services/pop_validator.py — Proof-of-Presence Validation
=================================================================

Production-grade PoP validation with multi-layer fraud detection:

  • DB optimisation  — selects only needed columns; hard LIMIT 50 on ping
                       fetch to avoid scanning millions of rows
  • Accuracy filter  — ignores pings with accuracy > 100m (GPS drift / indoor
                       spoofing); treated as if the ping never happened
  • Time distribution — pings all within < 5 minutes → zone_hop_flag=True
                        (burst-mode GPS spoofing pattern)
  • Velocity check   — consecutive ping speed > 120 km/h → velocity_flag=True
                        (physically impossible for a delivery worker on foot/bike)
  • GPS variance     — all lat/lng identical → static_device_flag=True
                        (device reporting a fixed fake coordinate)
  • DB retry         — 2 retries with 0.3s backoff; DB failure → safe default
                        (present=False, no flags set)
  • Structured logging — every decision logged as key=value via pop_logger

Return structure (unchanged — all callers depend on this shape):
    {
        'present':             bool,
        'ping_count':          int,    # filtered in-zone pings only
        'zone_hop_flag':       bool,   # active elsewhere, 0 in-zone
        'time_span_flag':      bool,   # all pings within 5 min (burst pattern)  [NEW]
        'velocity_flag':       bool,   # inter-ping speed > 120 km/h             [NEW]
        'static_device_flag':  bool,   # all coordinates identical                [NEW]
    }

    All keys always present — callers can safely access any key without .get().

Public API (unchanged):
    validate_pop(worker_id, hex_id, disruption_start) -> dict
"""

from __future__ import annotations

import json
import logging
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.db.client import supabase

logger = logging.getLogger("pop_validator")
pop_logger = logging.getLogger("pop_validator.audit")

# ── Tunable constants ─────────────────────────────────────────────────────────
_POP_WINDOW_MINUTES: int        = 90     # lookback window before disruption_start
_MIN_PINGS_REQUIRED: int        = 3      # minimum in-zone pings for PoP approval
_PING_FETCH_LIMIT: int          = 50     # hard DB row cap — avoids full-table scan
_MAX_ACCURACY_METERS: float     = 100.0  # ignore GPS pings worse than this
_MIN_TIME_SPAN_SECONDS: float   = 300.0  # < 5 min span = suspicious burst
_MAX_VELOCITY_KMH: float        = 120.0  # > 120 km/h = physically impossible
_DB_RETRIES: int                = 2
_DB_RETRY_DELAY: float          = 0.3    # seconds between retry attempts


# =============================================================================
# SAFE DEFAULT
# =============================================================================

def _safe_result() -> dict:
    """Returns a fully-populated safe default when DB or logic fails."""
    return {
        "present":            False,
        "ping_count":         0,
        "zone_hop_flag":      False,
        "time_span_flag":     False,
        "velocity_flag":      False,
        "static_device_flag": False,
    }


# =============================================================================
# DB FETCH WITH RETRY
# =============================================================================

def _fetch_pings(
    worker_id:  str,
    start_iso:  str,
    end_iso:    str,
) -> Optional[list[dict]]:
    """
    Fetches location_pings for the worker in the PoP window.
    Selects only needed columns; limits to _PING_FETCH_LIMIT rows.
    Retried up to _DB_RETRIES times with exponential backoff.
    Returns None on total failure (caller uses safe default).
    """
    for attempt in range(1, _DB_RETRIES + 2):  # 1 original + 2 retries = 3 total
        try:
            res = (
                supabase.table("location_pings")
                .select("hex_id, latitude, longitude, accuracy, pinged_at")
                .eq("worker_id", worker_id)
                .gte("pinged_at", start_iso)
                .lte("pinged_at", end_iso)
                .limit(_PING_FETCH_LIMIT)
                .execute()
            )
            return res.data or []
        except Exception as exc:
            logger.warning(
                "[pop] DB fetch attempt %d/%d failed for worker=%s: %s",
                attempt, _DB_RETRIES + 1, worker_id, exc,
            )
            if attempt <= _DB_RETRIES:
                time.sleep(_DB_RETRY_DELAY * attempt)
    return None


# =============================================================================
# FRAUD SIGNAL HELPERS
# =============================================================================

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres between two GPS coordinates."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _check_time_span(pings: list[dict]) -> bool:
    """
    Returns True (suspicious) if all pings are clustered within < 5 minutes.
    Burst-mode GPS spoofing apps generate rapid back-to-back fake pings.
    """
    if len(pings) < 2:
        return False

    times: list[datetime] = []
    for p in pings:
        ts_raw = p.get("pinged_at")
        if not ts_raw:
            continue
        try:
            ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            times.append(ts)
        except Exception:
            continue

    if len(times) < 2:
        return False

    time_span_s = (max(times) - min(times)).total_seconds()
    return time_span_s < _MIN_TIME_SPAN_SECONDS


def _check_velocity(pings: list[dict]) -> bool:
    """
    Returns True (suspicious) if any consecutive ping pair implies speed > 120 km/h.
    Sorted by pinged_at before checking.
    """
    if len(pings) < 2:
        return False

    # Sort by timestamp
    sortable: list[tuple[datetime, float, float]] = []
    for p in pings:
        ts_raw = p.get("pinged_at")
        lat    = p.get("latitude")
        lng    = p.get("longitude")
        if not ts_raw or lat is None or lng is None:
            continue
        try:
            ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            sortable.append((ts, float(lat), float(lng)))
        except Exception:
            continue

    sortable.sort(key=lambda x: x[0])

    for i in range(1, len(sortable)):
        t1, lat1, lng1 = sortable[i - 1]
        t2, lat2, lng2 = sortable[i]
        dt_h = (t2 - t1).total_seconds() / 3600.0
        if dt_h <= 0:
            continue
        dist_km = _haversine_km(lat1, lng1, lat2, lng2)
        speed_kmh = dist_km / dt_h
        if speed_kmh > _MAX_VELOCITY_KMH:
            return True

    return False


def _check_static_device(pings: list[dict]) -> bool:
    """
    Returns True (suspicious) if all pings share an identical lat/lng.
    A real moving worker will have natural GPS drift between readings.
    """
    if len(pings) < 2:
        return False

    coords = set()
    for p in pings:
        lat = p.get("latitude")
        lng = p.get("longitude")
        if lat is not None and lng is not None:
            coords.add((round(float(lat), 6), round(float(lng), 6)))

    # Only one unique coordinate → static/spoofed device
    return len(coords) == 1


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def validate_pop(
    worker_id:         str,
    hex_id:            str,
    disruption_start:  datetime,
) -> dict:
    """
    Validates physical Proof-of-Presence (PoP) for a worker inside a declared
    disruption zone.

    Requires >= 3 quality pings (accuracy <= 100m) within the preceding 90
    minutes to grant coverage, plus four fraud-signal checks:
      1. Time span    — burst pings within 5 min → zone_hop_flag
      2. Velocity     — > 120 km/h between pings → velocity_flag
      3. Static coord — identical lat/lng across all pings → static_device_flag
      4. Zone hop     — pings active elsewhere, 0 in target hex → zone_hop_flag

    Args:
        worker_id:         UUID of the worker
        hex_id:            H3/hex zone ID of the disrupted area
        disruption_start:  Timestamp when the disruption was declared

    Returns:
        dict with keys: present, ping_count, zone_hop_flag,
                        time_span_flag, velocity_flag, static_device_flag
    """
    result = _safe_result()

    start_window = disruption_start - timedelta(minutes=_POP_WINDOW_MINUTES)
    start_iso    = start_window.isoformat()
    end_iso      = disruption_start.isoformat()

    # ── Step 1: Fetch pings with retry ───────────────────────────────────────
    all_pings = _fetch_pings(worker_id, start_iso, end_iso)

    if all_pings is None:
        # DB totally unavailable — safe default (present=False)
        logger.error(
            "[pop] DB unavailable after %d retries for worker=%s — returning safe default",
            _DB_RETRIES, worker_id,
        )
        pop_logger.info(json.dumps({
            "event":      "pop_db_failure",
            "worker_id":  worker_id,
            "hex_id":     hex_id,
            "present":    False,
        }))
        return result

    if not all_pings:
        # Phone off / ghosting — no pings at all
        pop_logger.info(json.dumps({
            "event":      "pop_no_pings",
            "worker_id":  worker_id,
            "hex_id":     hex_id,
            "present":    False,
        }))
        return result

    # ── Step 2: Accuracy filter — drop noisy/indoor GPS readings ─────────────
    quality_pings = [
        p for p in all_pings
        if (p.get("accuracy") is None) or (float(p.get("accuracy", 0)) <= _MAX_ACCURACY_METERS)
    ]
    # Note: pings without an accuracy field are assumed acceptable (backward compat)

    # ── Step 3: In-zone count ─────────────────────────────────────────────────
    in_zone_pings  = [p for p in quality_pings if p.get("hex_id") == hex_id]
    ping_count     = len(in_zone_pings)
    result["ping_count"] = ping_count

    # ── Step 4: Zone-hop detection ────────────────────────────────────────────
    # Worker was active (had quality pings) but none in the required hex
    if ping_count == 0 and len(quality_pings) > 0:
        result["zone_hop_flag"] = True
        logger.warning(
            "[pop] Zone-hop detected: worker=%s had %d quality pings but 0 in hex=%s",
            worker_id, len(quality_pings), hex_id,
        )

    # ── Step 5: Time span check (burst spoofing) ──────────────────────────────
    if in_zone_pings:
        result["time_span_flag"] = _check_time_span(in_zone_pings)
        if result["time_span_flag"]:
            logger.warning(
                "[pop] Burst-ping pattern: worker=%s all %d in-zone pings within < 5 min",
                worker_id, ping_count,
            )

    # ── Step 6: Velocity check ────────────────────────────────────────────────
    if in_zone_pings:
        result["velocity_flag"] = _check_velocity(in_zone_pings)
        if result["velocity_flag"]:
            logger.warning(
                "[pop] Velocity violation: worker=%s ping speed > %s km/h",
                worker_id, _MAX_VELOCITY_KMH,
            )

    # ── Step 7: Static device check ───────────────────────────────────────────
    if in_zone_pings:
        result["static_device_flag"] = _check_static_device(in_zone_pings)
        if result["static_device_flag"]:
            logger.warning(
                "[pop] Static device: worker=%s all %d pings at identical coordinate",
                worker_id, ping_count,
            )

    # ── Step 8: Presence decision ─────────────────────────────────────────────
    result["present"] = ping_count >= _MIN_PINGS_REQUIRED

    # ── Step 9: Structured audit log ──────────────────────────────────────────
    pop_logger.info(json.dumps({
        "event":              "pop_validated",
        "worker_id":          worker_id,
        "hex_id":             hex_id,
        "total_pings":        len(all_pings),
        "quality_pings":      len(quality_pings),
        "ping_count":         ping_count,
        "present":            result["present"],
        "zone_hop_flag":      result["zone_hop_flag"],
        "time_span_flag":     result["time_span_flag"],
        "velocity_flag":      result["velocity_flag"],
        "static_device_flag": result["static_device_flag"],
    }))
    logger.info(
        "[pop] worker=%s hex=%s pings=%d/%d present=%s "
        "zone_hop=%s burst=%s velocity=%s static=%s",
        worker_id, hex_id, ping_count, len(all_pings),
        result["present"],
        result["zone_hop_flag"], result["time_span_flag"],
        result["velocity_flag"], result["static_device_flag"],
    )

    return result
