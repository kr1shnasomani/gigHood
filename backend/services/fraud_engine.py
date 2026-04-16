"""
Fraud Engine — multi-layer fraud scoring for claim validation.

Layers:
    1. GPS static device detection (variance analysis)
    2. Partner API order activity (Gate 2)
    2b. Presence density in target hex
    2c. GPS accuracy quality scoring
    3. Velocity anomaly (>120 km/h)
    4. OS mock-location flag
    5. Network ring / behavioural clustering

Production improvements (v2):
    - asyncio.run() replaced with get_event_loop() — safe inside FastAPI/uvicorn
    - _safe_db_call() helper with retry + exponential backoff for all Supabase calls
    - Synthetic pings disabled in production (ENV != "development")
    - Fraud scoring weights sourced from settings (config-driven)
    - evaluate() emits structured fraud result log with latency
    - Pings pre-processed once (hex_pings, acc_values) to avoid repeated loops
    - Safe defaults on missing/bad lat-lng fields
"""

import math
import asyncio
import hashlib
import time
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import joblib
import numpy as np

from backend.db.client import supabase, supabase_admin
from backend.config import settings
from backend.services.mock_external_apis import verify_zepto_worker_activity

logger = logging.getLogger("fraud_engine")

_fraud_model = None
_fraud_model_loaded_at = 0.0
_FRAUD_MODEL_TTL_SECONDS = 600


def _resolve_fraud_model_path() -> str:
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    return os.path.join(project_root, "backend", "ml", "fraud_model.pkl")


def _load_fraud_model():
    """Loads and caches the fraud ML model, training once on cold-start if needed."""
    global _fraud_model, _fraud_model_loaded_at

    now = time.time()
    if _fraud_model is not None and (now - _fraud_model_loaded_at) < _FRAUD_MODEL_TTL_SECONDS:
        return _fraud_model

    model_path = _resolve_fraud_model_path()
    if not os.path.exists(model_path):
        from backend.ml.train_fraud_model import train_model

        train_model()

    _fraud_model = joblib.load(model_path)
    _fraud_model_loaded_at = now
    return _fraud_model


def predict_fraud_ml(features: dict[str, float]) -> float:
    """
    Returns fraud probability on a 0-100 scale from the trained model.
    """
    model = _load_fraud_model()
    values = np.array(
        [[
            float(features.get("claim_frequency", 0.0)),
            float(features.get("zone_risk", 0.0)),
            float(features.get("location_anomaly", 0.0)),
            float(features.get("time_of_day", 12.0)),
        ]],
        dtype=float,
    )
    proba = model.predict_proba(values)[0][1]
    return max(0.0, min(100.0, float(proba) * 100.0))


# ── Fraud scoring weights (sourced from settings with fallbacks) ────────────
# Hardcoded scores are replaced with config values so thresholds can be tuned
# without a code deploy. Fallback values match the original hardcoded baseline.

_W = {
    "NO_PINGS":              getattr(settings, "FRAUD_WEIGHT_NO_PINGS", 30),
    "MINIMAL_TELEMETRY":     getattr(settings, "FRAUD_WEIGHT_MINIMAL_TELEMETRY", 15),
    "SPARSE_TELEMETRY":      getattr(settings, "FRAUD_WEIGHT_SPARSE_TELEMETRY", 10),
    "MODERATE_TELEMETRY":    getattr(settings, "FRAUD_WEIGHT_MODERATE_TELEMETRY", 5),
    "STATIC_DEVICE":         getattr(settings, "FRAUD_WEIGHT_STATIC_DEVICE", 30),
    "GATE2_NONE":            getattr(settings, "FRAUD_WEIGHT_GATE2_NONE", 40),
    "GATE2_WEAK":            getattr(settings, "FRAUD_WEIGHT_GATE2_WEAK", 12),
    "OUT_OF_ZONE":           getattr(settings, "FRAUD_WEIGHT_OUT_OF_ZONE", 25),
    "SPARSE_IN_ZONE":        getattr(settings, "FRAUD_WEIGHT_SPARSE_IN_ZONE", 12),
    "PARTIAL_COVERAGE":      getattr(settings, "FRAUD_WEIGHT_PARTIAL_COVERAGE", 5),
    "LOW_ACCURACY_GPS":      getattr(settings, "FRAUD_WEIGHT_LOW_ACCURACY_GPS", 25),
    "POOR_ACCURACY_AVERAGE": getattr(settings, "FRAUD_WEIGHT_POOR_ACCURACY_AVERAGE", 20),
    "ELEVATED_GPS_NOISE":    getattr(settings, "FRAUD_WEIGHT_ELEVATED_GPS_NOISE", 15),
    "ACCURACY_35_60":        getattr(settings, "FRAUD_WEIGHT_ACCURACY_35_60", 8),
    "ACCURACY_15_35":        getattr(settings, "FRAUD_WEIGHT_ACCURACY_15_35", 3),
    "VELOCITY_VIOLATION":    getattr(settings, "FRAUD_WEIGHT_VELOCITY_VIOLATION", 15),
    "MOCK_LOCATION":         getattr(settings, "FRAUD_WEIGHT_MOCK_LOCATION", 20),
    "RECENT_CLAIMS":         getattr(settings, "FRAUD_WEIGHT_RECENT_CLAIMS", 15),
    "UNUSUAL_HOURS":         getattr(settings, "FRAUD_WEIGHT_UNUSUAL_HOURS", 10),
    "ZONE_HOPPING":          getattr(settings, "FRAUD_WEIGHT_ZONE_HOPPING", 20),
}

# ── Supabase retry helper ────────────────────────────────────────────────────

def _safe_db_call(fn: Callable[[], Any], retries: int = 3) -> Any:
    """
    Execute a zero-argument callable that performs a Supabase query.
    Retries up to `retries` times with exponential backoff.
    Raises the last exception if all attempts fail.
    """
    delay = 0.2
    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as exc:
            # Permission errors are deterministic in the current auth context;
            # retrying only spams logs and increases latency.
            msg = str(exc)
            if "permission denied" in msg or "'code': '42501'" in msg:
                raise exc
            last_exc = exc
            logger.warning(
                f"[fraud_engine] DB call failed (attempt {attempt}/{retries}): {exc}"
            )
            if attempt < retries:
                time.sleep(delay)
                delay *= 2  # exponential back-off: 0.2s → 0.4s → 0.8s
    raise last_exc  # type: ignore[misc]


#
# Architecture
# ─────────────
# 1. Static baseline thresholds baked into code (cold-start safe).
# 2. A TTL-cached _ThresholdState object holds the in-process learned thresholds.
# 3. refresh_adaptive_thresholds() re-derives thresholds from fraud_feedback and
#    resets the cache TTL.  This is called:
#      a) On first request (lazy init).
#      b) By the weekly retrain scheduler (run_fraud_threshold_retrain).
#      c) Immediately after every admin override (closing the feedback loop).
# 4. The cache is intentionally MODULE-LEVEL so all FastAPI workers within the
#    same process share one copy.  Multi-process deployments converge within one
#    cache TTL (1 h default).

_BASELINE_APPROVE_THRESHOLD: float = 45.0   # scores < 45  → APPROVE
_BASELINE_DENY_THRESHOLD:    float = 75.0   # scores >= 75 → DENY
_CACHE_TTL_SECONDS: int = 3600              # re-read DB at most once per hour

class _ThresholdState:
    """
    In-memory snapshot of learned thresholds with a timestamp for TTL checks.
    Thread-safety: reads/writes of float are atomic in CPython; the worst-case
    race is a redundant DB read on concurrent first requests, which is harmless.
    """
    def __init__(self) -> None:
        self.approve: float  = _BASELINE_APPROVE_THRESHOLD
        self.deny:    float  = _BASELINE_DENY_THRESHOLD
        self.sample_count: int = 0
        self.override_rate: float = 0.0   # fraction of rows that were overrides
        self.last_refreshed_at: float = 0.0   # epoch seconds; 0 = never

    def is_stale(self) -> bool:
        return (time.time() - self.last_refreshed_at) > _CACHE_TTL_SECONDS

    def mark_stale(self) -> None:
        """Force the next call to get_fraud_decision to re-read the DB."""
        self.last_refreshed_at = 0.0


_thresholds = _ThresholdState()


def refresh_adaptive_thresholds() -> _ThresholdState:
    """
    Read the fraud_feedback table and re-derive APPROVE / DENY thresholds.

    Algorithm (Stripe Radar-style weighted averaging):
      - Collect all admin-confirmed APPROVE scores and DENY scores.
      - APPROVE threshold = mean(APPROVE scores) + 5-point conservative buffer.
        (Everything below this is auto-approved.)
      - DENY threshold    = mean(DENY scores)    - 5-point conservative buffer.
        (Everything above this is auto-denied.)
      - Both are clamped to stay within [20, 90] so the system can’t learn
        itself into degenerate extremes.
      - Falls back to baseline if < 5 samples exist (cold-start safety).

    Returns the updated _ThresholdState for logging/testing.
    """
    global _thresholds
    try:
        res = _safe_db_call(
            lambda: supabase_admin.table("fraud_feedback")
                .select("fraud_score,ai_decision,admin_decision")
                .execute()
        )
        rows_data = getattr(res, "data", None)
        rows = rows_data if isinstance(rows_data, list) else []

        approve_scores = [
            float(r["fraud_score"]) for r in rows
            if r.get("admin_decision") == "APPROVE" and r.get("fraud_score") is not None
        ]
        deny_scores = [
            float(r["fraud_score"]) for r in rows
            if r.get("admin_decision") == "DENY" and r.get("fraud_score") is not None
        ]
        override_count = sum(
            1 for r in rows
            if r.get("ai_decision") and r.get("admin_decision")
            and r["ai_decision"] != r["admin_decision"]
        )

        MIN_SAMPLES = 5   # need at least 5 confirmed overrides before adapting

        if len(approve_scores) >= MIN_SAMPLES:
            raw_approve = sum(approve_scores) / max(len(approve_scores), 1)
            _thresholds.approve = max(20.0, min(60.0, raw_approve + 5.0))
        else:
            _thresholds.approve = _BASELINE_APPROVE_THRESHOLD

        if len(deny_scores) >= MIN_SAMPLES:
            raw_deny = sum(deny_scores) / max(len(deny_scores), 1)
            _thresholds.deny = max(55.0, min(90.0, raw_deny - 5.0))
        else:
            _thresholds.deny = _BASELINE_DENY_THRESHOLD

        _thresholds.sample_count  = len(rows)
        _thresholds.override_rate = override_count / max(len(rows), 1)
        _thresholds.last_refreshed_at = time.time()

        logger.info(
            f"[fraud_engine] Thresholds refreshed | samples={len(rows)} "
            f"| approve_t={_thresholds.approve:.1f} deny_t={_thresholds.deny:.1f} "
            f"| override_rate={_thresholds.override_rate:.1%}"
        )

    except Exception as exc:
        # Soft failure: keep existing thresholds, log once, continue.
        if "permission denied" in str(exc) or "'code': '42501'" in str(exc):
            logger.info("[fraud_engine] Threshold feedback table not accessible in current environment; using baseline thresholds.")
        else:
            logger.warning(f"[fraud_engine] Threshold refresh failed (using cached): {exc}")
        _thresholds.last_refreshed_at = time.time()  # back-off: don’t hammer DB on transient errors

    return _thresholds


def get_fraud_decision(fraud_score: float) -> dict:
    """
    Converts a fraud score into a structured AI decision using ADAPTIVE thresholds.

    Thresholds start at the static baseline and shift over time as admins
    confirm or override AI decisions (stored in fraud_feedback).  The cache
    is transparently refreshed every hour or immediately after any override.

    Returns a dict with:
        decision:    APPROVE | REVIEW | DENY
        confidence:  HIGH | MEDIUM | LOW
        reason:      Human-readable explanation including current thresholds
        severity:    LOW | MEDIUM | HIGH
    """
    # Lazy / TTL-based cache refresh
    if _thresholds.is_stale():
        refresh_adaptive_thresholds()

    approve_t = _thresholds.approve
    deny_t    = _thresholds.deny
    adaptive  = _thresholds.sample_count >= 5
    mode_tag  = f"adaptive [{_thresholds.sample_count} samples]" if adaptive else "baseline"

    # Define Severity
    if fraud_score > 70.0:
        severity = "HIGH"
    elif fraud_score > 40.0:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    # Define Actions based on severity and thresholds
    if fraud_score >= deny_t or fraud_score > 80.0:
        return {
            "decision":   "DENY",
            "confidence": "HIGH",
            "severity":   severity,
            "reason":     (
                f"Score {int(fraud_score)}/100 ≥ DENY threshold ({int(deny_t)}) — {mode_tag}. "
                "Strong anomaly signals: high claim frequency, zone spoofing risk, "
                "and/or confirmed network ring membership."
            ),
        }
    if fraud_score >= approve_t or fraud_score > 50.0:
        return {
            "decision":   "REVIEW",
            "confidence": "MEDIUM",
            "severity":   severity,
            "reason":     (
                f"Score {int(fraud_score)}/100 between APPROVE ({int(approve_t)}) and "
                f"DENY ({int(deny_t)}) thresholds — {mode_tag}. "
                "Suspicious behavioral deviations detected. "
                "Manual verification required before payout."
            ),
        }
    return {
        "decision":   "APPROVE",
        "confidence": "HIGH",
        "severity":   severity,
        "reason":     (
            f"Score {int(fraud_score)}/100 < APPROVE threshold ({int(approve_t)}) — {mode_tag}. "
            "Behavior consistent with legitimate gig-worker patterns. "
            "Auto-approve authorized."
        ),
    }



# ── Haversine distance (unchanged) ──────────────────────────────────────────

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the great-circle distance between two points in meters."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return R * c * 1000  # metres



# ── Explainable AI (XAI) Layer ───────────────────────────────────────────────
# Maps raw layer scores to named feature buckets for RBI/IRDAI traceability.

FEATURE_LABELS: dict[str, str] = {
    "location_anomaly":  "GPS / Location Anomaly",
    "telemetry_quality": "Telemetry Quality",
    "partner_activity":  "Partner Order Activity (Gate-2)",
    "gps_accuracy":      "GPS Accuracy Quality",
    "velocity":          "Velocity Violation",
    "mock_location":     "Mock Location Flag",
    "network_behavior":  "Network / Behavioural Clustering",
    "recent_claims":     "High Claim Frequency (7d)",
    "unusual_hours":     "Unusual Activity Hours",
    "zone_hopping":      "Rapid Zone Hopping",
}

FLAG_EXPLANATIONS: dict[str, str] = {
    "NO_LOCATION_PINGS": "No location data found during the disruption.",
    "MINIMAL_TELEMETRY": "Very few location points available.",
    "SPARSE_TELEMETRY": "Insufficient location data to confidently verify presence.",
    "MODERATE_TELEMETRY": "Location data is moderate but less than ideal.",
    "STATIC_DEVICE_FLAG": "Device remained suspiciously stationary (possible GPS spoofing).",
    "OUT_OF_ZONE_TELEMETRY": "All location pings were outside the affected zone.",
    "SPARSE_IN_ZONE_TELEMETRY": "Majority of location pings were outside the zone.",
    "PARTIAL_COVERAGE": "Some location pings were outside the valid area.",
    "GATE2_NONE": "No verified partner order activity detected.",
    "GATE2_WEAK": "Weak or unverified partner order activity.",
    "LOW_ACCURACY_GPS": "GPS accuracy is extremely poor (over 120m radius).",
    "POOR_ACCURACY_AVERAGE": "Average GPS accuracy is very weak.",
    "ELEVATED_GPS_NOISE": "GPS signal is noisy and unreliable.",
    "VELOCITY_VIOLATION": "Movement speed implies impossible travel (over 120 km/h).",
    "MOCK_LOCATION_FLAG": "Device OS reported Mock Location was used.",
    "HIGH_RECENT_CLAIMS": "Worker has an unusually high number of recent claims.",
    "UNUSUAL_ACTIVITY_HOURS": "Activity occurred during unusual late-night hours.",
    "RAPID_ZONE_HOPPING": "Worker moved across many different zones abnormally fast.",
    "REGISTRATION_COHORT": "Part of an anomalous registration cohort.",
    "ANOMALOUS_PATTERN": "Behavior matches known anomalous network patterns.",
    "MODEL_CONCENTRATION": "High similarity to concentrated fraudulent models.",
    "MODERATE_CLUSTERING": "Moderate similarity to known anomalous clusters.",
}

def explain_fraud_score(layer_scores: dict[str, float]) -> dict:
    """
    Converts raw per-layer point contributions into a normalised XAI dict.

    Args:
        layer_scores: {feature_key: raw_points_contributed}

    Returns:
        {
            "breakdown":        {feature_key: 0-100 contribution},
            "top_reason":       "feature_key of highest contributor",
            "top_reason_label": "Human-readable label",
        }

    Contributions are normalised to 0-100 so each bar is intuitive in the UI.
    """
    MAX_SCORE = 100.0
    breakdown: dict[str, float] = {}
    for key in FEATURE_LABELS:
        pts = float(layer_scores.get(key, 0.0))
        breakdown[key] = round(min(pts / MAX_SCORE * 100.0, 100.0), 2)

    total = sum(breakdown.values())
    top_reason = "none" if total == 0 else max(breakdown, key=lambda k: breakdown[k])

    return {
        "breakdown":        breakdown,
        "top_reason":       top_reason,
        "top_reason_label": FEATURE_LABELS.get(top_reason, top_reason),
    }


# ── Audit Log Helper ──────────────────────────────────────────────────────────
# Soft-fail: audit writes NEVER block or crash the main decision pipeline.

def write_audit_log(
    entity_type:  str,
    entity_id:    str,
    action:       str,
    performed_by: str,
    metadata:     dict,
) -> None:
    """
    Inserts one row into audit_logs. Silently swallows any DB failure so
    a transient error here never affects the claim decision result.
    """
    try:
        supabase_admin.table("audit_logs").insert({
            "entity_type":  entity_type,
            "entity_id":    entity_id,
            "action":       action,
            "performed_by": performed_by,
            "metadata":     metadata,
        }).execute()
    except Exception as exc:
        if "permission denied" in str(exc) or "'code': '42501'" in str(exc):
            logger.info("[fraud_engine] audit_logs table not accessible in current environment; skipping audit write.")
        else:
            logger.warning(f"[fraud_engine] audit_log write failed (non-fatal): {exc}")


# ── FraudEvaluator ──────────────────────────────────────────────────────────


class FraudEvaluator:

    def __init__(self):
        pass

    def _std_dev(self, data: list) -> float:
        if len(data) < 2:
            return 0.0
        mean = sum(data) / max(len(data), 1)
        variance = sum((x - mean) ** 2 for x in data) / (len(data) - 1)
        return math.sqrt(variance)

    def _run_async(self, coro):
        """
        Safe async-to-sync bridge.

        asyncio.run() creates a *new* event loop — this crashes inside
        uvicorn/FastAPI which already runs an event loop on the same thread.
        get_event_loop() reuses the running loop if one exists, and falls
        back to creating a new one only if needed.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Inside an async context (FastAPI request thread):
                # use run_until_complete via a new thread to avoid deadlock.
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(asyncio.run, coro)
                    return future.result(timeout=10)
            else:
                return loop.run_until_complete(coro)
        except RuntimeError:
            # No current event loop at all — create one.
            return asyncio.run(coro)

    def _generate_synthetic_pings_for_demo(
        self,
        worker_id: str,
        hex_id: str,
        disruption_start: datetime,
        disruption_end: datetime,
    ) -> list:
        """
        Generate realistic synthetic location pings for demo claims that lack
        real telemetry. Deterministic seed ensures the same worker always gets
        the same ping pattern across evaluation runs.
        """
        import random

        seed_val = int(hashlib.md5(f"{worker_id}:{hex_id}".encode()).hexdigest(), 16)
        random.seed(seed_val)

        pings = []
        behavior = seed_val % 10
        num_pings = 8 + (behavior % 8)
        time_span = (disruption_end - disruption_start).total_seconds()

        for i in range(num_pings):
            progress = i / max(num_pings - 1, 1)
            variation = (random.random() - 0.5) * 0.3
            ping_time = disruption_start + timedelta(seconds=time_span * (progress + variation))
            ping_time = max(disruption_start, min(disruption_end, ping_time))

            in_hex = behavior < 7 and (random.random() > (0.2 if behavior < 5 else 0.5))

            if in_hex:
                base_lat = 13.0 + (seed_val % 100) / 1000.0
                base_lng = 77.5 + (seed_val % 100) / 1000.0
                lat = base_lat + (random.random() - 0.5) * 0.05
                lng = base_lng + (random.random() - 0.5) * 0.05
            else:
                lat = 13.5 + (random.random() - 0.5) * 0.1
                lng = 77.0 + (random.random() - 0.5) * 0.1

            accuracy = 10 if behavior < 5 else (30 if behavior < 8 else (40 + random.randint(0, 60)))
            mock_flag = behavior >= 8 and random.random() < 0.05

            pings.append({
                "worker_id":          worker_id,
                "hex_id":             hex_id if in_hex else f"hex_{behavior}_{i}",
                "latitude":           round(lat, 6),
                "longitude":          round(lng, 6),
                "accuracy_radius":    accuracy,
                "pinged_at":          ping_time.isoformat(),
                "mock_location_flag": mock_flag,
            })

        return sorted(pings, key=lambda p: p["pinged_at"])

    # ── Main evaluation entry point ──────────────────────────────────────────

    def evaluate(self, worker_id: str, event_id: str, disruption_start: datetime) -> dict:
        eval_start = time.time()
        flags: list[str] = []
        score = 0.0
        gate2_result = "WEAK"

        try:
            # ── Time window ──────────────────────────────────────────────────
            window_start = disruption_start - timedelta(minutes=90)
            window_end   = max(disruption_start, datetime.now(timezone.utc))
            start_iso    = window_start.isoformat()
            end_iso      = window_end.isoformat()

            # ── Fetch disruption event / hex_id ──────────────────────────────
            event_res = _safe_db_call(
                lambda: supabase.table("disruption_events")
                    .select("hex_id")
                    .eq("id", event_id)
                    .execute()
            )
            if not event_res.data:
                logger.error(f"[fraud_engine] Event {event_id} not found for worker {worker_id}")
                return {"fraud_score": 0, "flags": [], "gate2_result": "NONE"}
            hex_id = event_res.data[0]["hex_id"]

            # ── Fetch location pings ─────────────────────────────────────────
            pings_res = _safe_db_call(
                lambda: supabase.table("location_pings")
                    .select("*")
                    .eq("worker_id", worker_id)
                    .gte("pinged_at", start_iso)
                    .lte("pinged_at", end_iso)
                    .order("pinged_at")
                    .execute()
            )
            pings = pings_res.data or []

            # Synthetic pings: ONLY in development mode.
            # In production, missing telemetry is scored as-is (high risk).
            if not pings:
                env = getattr(settings, "ENV", "production")
                if env == "development":
                    pings = self._generate_synthetic_pings_for_demo(
                        worker_id, hex_id, window_start, window_end
                    )
                    logger.debug(
                        f"[fraud_engine] Synthetic pings generated for dev: worker={worker_id}"
                    )

            # ── Pre-compute derived data once ────────────────────────────────
            # hex_pings and acc_values are reused across multiple layers below.
            hex_pings = [p for p in pings if p.get("hex_id") == hex_id]

            acc_values: list[float] = []
            for p in pings:
                raw = p.get("accuracy_radius")
                if raw is not None:
                    try:
                        acc_values.append(float(raw))
                    except (TypeError, ValueError):
                        pass

            # ── Layer 0: Global no-ping penalty (telemetry quality) ──────────
            telemetry_pts = 0.0
            if not pings:
                flags.append("NO_LOCATION_PINGS")
                telemetry_pts += _W["NO_PINGS"]
                score += telemetry_pts
            else:
                num_pings = len(pings)
                if num_pings <= 1:
                    telemetry_pts += _W["MINIMAL_TELEMETRY"]
                    score += _W["MINIMAL_TELEMETRY"]
                    flags.append("MINIMAL_TELEMETRY")
                elif num_pings <= 4:
                    telemetry_pts += _W["SPARSE_TELEMETRY"]
                    score += _W["SPARSE_TELEMETRY"]
                    flags.append("SPARSE_TELEMETRY")
                elif num_pings <= 7:
                    telemetry_pts += _W["MODERATE_TELEMETRY"]
                    score += _W["MODERATE_TELEMETRY"]
                    flags.append("MODERATE_TELEMETRY")

            # ── Layer 1: Static GPS variance analysis (location anomaly) ──────
            location_pts = 0.0
            if len(hex_pings) >= 5:
                try:
                    first_ts = datetime.fromisoformat(
                        str(hex_pings[0]["pinged_at"]).replace("Z", "+00:00")
                    )
                    last_ts = datetime.fromisoformat(
                        str(hex_pings[-1]["pinged_at"]).replace("Z", "+00:00")
                    )
                    observed_minutes = (last_ts - first_ts).total_seconds() / 60.0
                except Exception:
                    observed_minutes = 0.0

                if observed_minutes >= 15.0:
                    lats, lngs = [], []
                    for p in hex_pings:
                        try:
                            lats.append(float(p["latitude"]))
                            lngs.append(float(p["longitude"]))
                        except (TypeError, ValueError, KeyError):
                            pass  # skip pings with bad lat/lng — no crash

                    if (
                        lats
                        and lngs
                        and self._std_dev(lats) < 0.0001
                        and self._std_dev(lngs) < 0.0001
                    ):
                        flags.append("STATIC_DEVICE_FLAG")
                        location_pts += _W["STATIC_DEVICE"]
                        score += _W["STATIC_DEVICE"]

            # Zone presence penalty also lands in location_anomaly bucket
            zone_pts = 0.0
            if pings:
                hex_ratio = len(hex_pings) / max(len(pings), 1)
                if hex_ratio == 0:
                    flags.append("OUT_OF_ZONE_TELEMETRY")
                    zone_pts += _W["OUT_OF_ZONE"]
                    score += _W["OUT_OF_ZONE"]
                elif hex_ratio <= 0.33:
                    flags.append("SPARSE_IN_ZONE_TELEMETRY")
                    zone_pts += _W["SPARSE_IN_ZONE"]
                    score += _W["SPARSE_IN_ZONE"]
                elif hex_ratio <= 0.66:
                    flags.append("PARTIAL_COVERAGE")
                    zone_pts += _W["PARTIAL_COVERAGE"]
                    score += _W["PARTIAL_COVERAGE"]
            location_pts += zone_pts

            # ── Layer 2: Partner API order activity (Gate 2) ──────────────────
            gate2_pts = 0.0
            gate2_result = self._evaluate_gate2_orders(worker_id)
            if gate2_result == "NONE":
                flags.append("GATE2_NONE")
                gate2_pts += _W["GATE2_NONE"]
                score += _W["GATE2_NONE"]
            elif gate2_result == "WEAK":
                flags.append("GATE2_WEAK")
                gate2_pts += _W["GATE2_WEAK"]
                score += _W["GATE2_WEAK"]

            # ── Layer 2c: GPS accuracy quality ────────────────────────────────
            gps_pts = 0.0
            if acc_values:
                avg_accuracy = sum(acc_values) / max(len(acc_values), 1)
                max_accuracy = max(acc_values)

                if max_accuracy > 120:
                    flags.append("LOW_ACCURACY_GPS")
                    gps_pts += _W["LOW_ACCURACY_GPS"]
                    score  += _W["LOW_ACCURACY_GPS"]
                elif avg_accuracy > 120:
                    flags.append("POOR_ACCURACY_AVERAGE")
                    gps_pts += _W["POOR_ACCURACY_AVERAGE"]
                    score  += _W["POOR_ACCURACY_AVERAGE"]
                elif avg_accuracy > 60:
                    flags.append("ELEVATED_GPS_NOISE")
                    gps_pts += _W["ELEVATED_GPS_NOISE"]
                    score  += _W["ELEVATED_GPS_NOISE"]
                elif avg_accuracy > 35:
                    gps_pts += _W["ACCURACY_35_60"]
                    score  += _W["ACCURACY_35_60"]
                elif avg_accuracy > 15:
                    gps_pts += _W["ACCURACY_15_35"]
                    score  += _W["ACCURACY_15_35"]

            # ── Layer 3: Velocity > 120 km/h ──────────────────────────────────
            velocity_pts = 0.0
            if self._evaluate_velocity(pings, hex_id):
                flags.append("VELOCITY_VIOLATION")
                velocity_pts += _W["VELOCITY_VIOLATION"]
                score        += _W["VELOCITY_VIOLATION"]

            # ── Layer 4: OS mock-location flag ────────────────────────────────
            mock_pts = 0.0
            if any(p.get("mock_location_flag", False) for p in hex_pings):
                flags.append("MOCK_LOCATION_FLAG")
                mock_pts += _W["MOCK_LOCATION"]
                score    += _W["MOCK_LOCATION"]

            # ── Layer 5: Network ring / behavioural clustering ────────────────
            network_pts = 0.0
            l5_flags = self._evaluate_network_rings(worker_id, hex_id, start_iso)
            for flag_name, pts in l5_flags.items():
                flags.append(flag_name)
                network_pts += pts
                score       += pts

            # ── Layer 6: Behavioral signal (claims in last 7 days) ────────────
            behavioral_pts = 0.0
            seven_days_ago = (disruption_start - timedelta(days=7)).isoformat()
            try:
                claims_res = _safe_db_call(
                    lambda: supabase.table("claims")
                        .select("id", count="exact")
                        .eq("worker_id", worker_id)
                        .gte("created_at", seven_days_ago)
                        .execute()
                )
                raw_claim_count = getattr(claims_res, 'count', 0)
                recent_claims = int(raw_claim_count) if isinstance(raw_claim_count, (int, float)) else 0
            except Exception:
                recent_claims = 0

            normalized_claims = min(recent_claims / 5.0, 1.0)
            if normalized_claims > 0:
                flags.append("HIGH_RECENT_CLAIMS")
                behavioral_pts += _W["RECENT_CLAIMS"] * normalized_claims
                score += behavioral_pts

            # ── Layer 7: Temporal signal (unusual hours) ──────────────────────
            temporal_pts = 0.0
            is_night = 1.0 if 1 <= disruption_start.hour <= 5 else 0.0
            if is_night > 0:
                flags.append("UNUSUAL_ACTIVITY_HOURS")
                temporal_pts += _W["UNUSUAL_HOURS"] * is_night
                score += temporal_pts

            # ── Layer 8: Spatial signal (zone hopping) ────────────────────────
            spatial_pts = 0.0
            unique_hexes = set(p.get("hex_id") for p in pings if p.get("hex_id"))
            zone_hops = len(unique_hexes)
            normalized_hops = min(zone_hops / 5.0, 1.0)
            if normalized_hops > 0:
                flags.append("RAPID_ZONE_HOPPING")
                spatial_pts += _W["ZONE_HOPPING"] * normalized_hops
                score += spatial_pts

            # ── Final Score (Hybrid Rule + ML) ────────────────────────────────
            rule_score_val = int(round(max(0.0, min(100.0, score))))

            ml_score_val = None
            ml_features = {
                "claim_frequency": normalized_claims,
                "zone_risk": zone_pts,
                "location_anomaly": location_pts,
                "time_of_day": float(disruption_start.hour + disruption_start.minute / 60.0)
            }

            try:
                if "predict_fraud_ml" in globals():
                    ml_score_raw = predict_fraud_ml(ml_features)
                    ml_score_val = int(round(max(0.0, min(100.0, ml_score_raw))))
                    final_hybrid_score = (0.6 * ml_score_val) + (0.4 * rule_score_val)
                    bounded_score = int(round(max(0.0, min(100.0, final_hybrid_score))))
                else:
                    bounded_score = rule_score_val
            except Exception as ml_err:
                logger.debug(f"[fraud_engine] ML prediction failed: {ml_err}")
                bounded_score = rule_score_val

            latency = round(time.time() - eval_start, 3)

            # ── AI Decision ───────────────────────────────────────────────────
            decision_data = get_fraud_decision(bounded_score)

            # ── XAI breakdown ─────────────────────────────────────────────────
            xai = explain_fraud_score({
                "location_anomaly":  location_pts,
                "telemetry_quality": telemetry_pts,
                "partner_activity":  gate2_pts,
                "gps_accuracy":      gps_pts,
                "velocity":          velocity_pts,
                "mock_location":     mock_pts,
                "network_behavior":  network_pts,
                "recent_claims":     behavioral_pts,
                "unusual_hours":     temporal_pts,
                "zone_hopping":      spatial_pts,
            })

            logger.info(
                f"[fraud_engine] Fraud eval | worker={worker_id} | event={event_id} "
                f"| score={bounded_score} | decision={decision_data['decision']} "
                f"| top_reason={xai['top_reason']} "
                f"| flags={flags} | gate2={gate2_result} "
                f"| time={latency}s"
            )

            explanations = [FLAG_EXPLANATIONS.get(f, f) for f in flags]

            # ── Persist XAI to claim (best-effort) + write audit log ──────────
            # Both are soft-fail: a DB hiccup here must not block the response.
            try:
                supabase.table("claims") \
                    .update({
                        "fraud_breakdown":  xai["breakdown"],
                        "fraud_top_reason": xai["top_reason"],
                    }) \
                    .eq("event_id", event_id) \
                    .eq("worker_id", worker_id) \
                    .execute()
            except Exception as persist_exc:
                logger.debug(f"[fraud_engine] XAI persist skipped: {persist_exc}")

            write_audit_log(
                entity_type  = "claim",
                entity_id    = event_id,   # best available key at eval time
                action       = "AUTO_DECISION",
                performed_by = "AI",
                metadata     = {
                    "worker_id":         worker_id,
                    "fraud_score":        bounded_score,
                    "decision":           decision_data["decision"],
                    "confidence":         decision_data["confidence"],
                    "severity":           decision_data.get("severity", "LOW"),
                    "reason":             decision_data["reason"],
                    "top_reason":         xai["top_reason"],
                    "top_reason_label":   xai["top_reason_label"],
                    "breakdown":          xai["breakdown"],
                    "flags":              flags,
                    "explanations":       explanations,
                    "gate2_result":       gate2_result,
                    "eval_latency_s":     latency,
                },
            )

            return {
                "fraud_score":         bounded_score,
                "flags":               flags,
                "explanations":        explanations,
                "gate2_result":        gate2_result,
                "decision":            decision_data["decision"],
                "decision_reason":     decision_data["reason"],
                "decision_confidence": decision_data["confidence"],
                "severity":            decision_data.get("severity", "LOW"),
                "fraud_breakdown":     xai["breakdown"],
                "fraud_top_reason":    xai["top_reason"],
                "fraud_top_reason_label": xai["top_reason_label"],
            }

        except Exception as e:
            latency = round(time.time() - eval_start, 3)
            logger.error(
                f"[fraud_engine] Evaluation failed safely | worker={worker_id} "
                f"| error={e} | time={latency}s"
            )
            return {"fraud_score": 0, "flags": [], "gate2_result": "NONE"}

    # ── Gate 2: Partner order validation ────────────────────────────────────

    async def _evaluate_gate2_orders_async(self, worker_id: str) -> str:
        """
        Validates Zepto/partner activity via async mock external API.
        Returns: STRONG, WEAK, NONE.
        """
        payload = await verify_zepto_worker_activity(worker_id)
        status  = payload.get("status", "inactive")
        if status != "active":
            return "NONE"

        mock_orders  = payload.get("orders", [])
        total_orders = len(mock_orders)
        valid_orders = 0

        for o in mock_orders:
            try:
                dist = haversine(
                    float(o["pickup_lat"]),  float(o["pickup_lng"]),
                    float(o["dropoff_lat"]), float(o["dropoff_lng"]),
                )
                if dist >= 100.0:
                    valid_orders += 1
            except (KeyError, TypeError, ValueError):
                pass  # skip malformed order records

        if valid_orders >= 1:
            return "STRONG"
        elif total_orders > 0:
            return "WEAK"
        return "NONE"

    def _evaluate_gate2_orders(self, worker_id: str) -> str:
        """Sync wrapper used by existing pipeline and tests."""
        return self._run_async(self._evaluate_gate2_orders_async(worker_id))

    # ── Velocity anomaly check ───────────────────────────────────────────────

    def _evaluate_velocity(self, pings: list, target_hex: str) -> bool:
        """Returns True if any out-hex → in-hex transition implies speed > 120 km/h."""
        out_ping = None
        in_ping  = None

        for p in pings:
            if p.get("hex_id") != target_hex:
                out_ping = p
            elif p.get("hex_id") == target_hex and out_ping is not None:
                in_ping = p
                break

        if not (out_ping and in_ping):
            return False

        try:
            t1 = datetime.fromisoformat(
                str(out_ping["pinged_at"]).replace("Z", "+00:00")
            )
            t2 = datetime.fromisoformat(
                str(in_ping["pinged_at"]).replace("Z", "+00:00")
            )
            hours = (t2 - t1).total_seconds() / 3600.0
            if hours <= 0:
                return False

            dist_km = haversine(
                float(out_ping["latitude"]),  float(out_ping["longitude"]),
                float(in_ping["latitude"]),   float(in_ping["longitude"]),
            ) / 1000.0

            return (dist_km / hours) > 120.0
        except (KeyError, TypeError, ValueError, Exception):
            return False  # safe default — missing/bad fields don't crash eval

    # ── Network ring / behavioural clustering ────────────────────────────────

    def _evaluate_network_rings(
        self, worker_id: str, hex_id: str, start_iso: str
    ) -> dict:
        """
        Evaluates fraud rings using observed network evidence from recent events.

        Signals:
          1) Same-hex multi-claim cluster in the last 30 days
          2) Worker concentration in the cluster (few workers taking many claims)
          3) Shared device/carrier fingerprint concentration within clustered workers
        """
        flags: dict[str, int] = {}

        try:
            try:
                start_dt = datetime.fromisoformat(str(start_iso).replace("Z", "+00:00"))
            except Exception:
                start_dt = datetime.now(timezone.utc)
            since_iso = (start_dt - timedelta(days=30)).isoformat()

            events_res = _safe_db_call(
                lambda: supabase.table("disruption_events")
                .select("id")
                .eq("hex_id", hex_id)
                .gte("started_at", since_iso)
                .limit(300)
                .execute()
            )
            event_ids = [row.get("id") for row in (events_res.data or []) if row.get("id")]
            if not event_ids:
                return flags

            claims_res = _safe_db_call(
                lambda: supabase.table("claims")
                .select("worker_id,event_id,created_at")
                .in_("event_id", event_ids)
                .gte("created_at", since_iso)
                .limit(5000)
                .execute()
            )
            rows = claims_res.data or []
            if not rows:
                return flags

            claim_counts: dict[str, int] = {}
            for row in rows:
                wid = row.get("worker_id")
                if not wid:
                    continue
                claim_counts[wid] = claim_counts.get(wid, 0) + 1

            if not claim_counts:
                return flags

            cluster_workers = {wid for wid, cnt in claim_counts.items() if cnt >= 2}
            total_claims = sum(claim_counts.values())
            worker_claims = claim_counts.get(worker_id, 0)

            if worker_id in cluster_workers and len(cluster_workers) >= 3:
                flags["REGISTRATION_COHORT"] = 12

            if total_claims > 0:
                concentration = worker_claims / total_claims
                if concentration >= 0.35 and worker_claims >= 3:
                    flags["MODEL_CONCENTRATION"] = 10

            if cluster_workers and worker_id in cluster_workers:
                cluster_ids = list(cluster_workers)[:100]
                workers_res = _safe_db_call(
                    lambda: supabase.table("workers")
                    .select("id,device_model,sim_carrier")
                    .in_("id", cluster_ids)
                    .execute()
                )
                profiles = workers_res.data or []
                target = next((r for r in profiles if r.get("id") == worker_id), None)
                if target:
                    device = str(target.get("device_model") or "").strip().lower()
                    carrier = str(target.get("sim_carrier") or "").strip().lower()
                    if device or carrier:
                        peers = 0
                        for row in profiles:
                            if row.get("id") == worker_id:
                                continue
                            same_device = device and str(row.get("device_model") or "").strip().lower() == device
                            same_carrier = carrier and str(row.get("sim_carrier") or "").strip().lower() == carrier
                            if same_device or same_carrier:
                                peers += 1
                        if peers >= 2:
                            flags["ANOMALOUS_PATTERN"] = 8
                        elif peers == 1:
                            flags["MODERATE_CLUSTERING"] = 4

        except Exception as exc:
            logger.debug(f"[fraud_engine] network ring evaluation skipped: {exc}")

        return flags
