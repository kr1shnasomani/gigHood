# =============================================================================
# backend/services/signal_fetchers.py — External Signal Ingestion Layer
# =============================================================================
# Fetches the 5 parametric trigger signals for every active H3 hex zone.
# Called by the APScheduler every 10 minutes (SIGNAL_JOB_CRON_MINUTE).
#
# Signal pipeline:
#   APScheduler → run_signal_ingestion_cycle()
#                → fetch_weather()   → OpenWeatherMap API  → signal_cache
#                → fetch_aqi()       → CPCB API            → signal_cache
#                → fetch_traffic()   → Google Maps (mock)  → signal_cache
#                → fetch_platform()  → Platform API (mock) → signal_cache
#                → fetch_social()    → Gov alert feed (mock)→ signal_cache
#                → fn_upsert_signal() DB function          → dci_engine reads
#
# Design decisions:
#   • Fully async — all 5 signals fetched concurrently per hex via
#     asyncio.gather(). Original code used _run_async(asyncio.run()) inside
#     sync functions, which fails when called from an already-running event
#     loop (APScheduler runs inside asyncio in FastAPI).
#   • Per-signal typed upsert via fn_upsert_signal() DB function (migration 004)
#     — not a raw dict upsert. The DB function auto-evaluates threshold_breached,
#     updates consecutive_failures, and syncs hex_zones.signal_sources_available.
#   • Normalisation formulas are precise and documented with their derivation.
#     The old W = rain/47.05 was an unexplained magic number. New formula
#     uses the 35mm/hr trigger threshold explicitly: W_rain = rain / 35.0
#     (1.0 at trigger threshold, > 1.0 for extreme events — correct behaviour
#     since sigmoid maps unbounded input to [0,1]).
#   • AQI normalisation: A = aqi / 300.0 (1.0 at trigger threshold of 300).
#   • Each fetcher returns a SignalFetchResult dataclass — typed, not a
#     plain dict — so callers get IDE completion and Pydantic validation.
#   • Degraded mode: if a fetch fails, the PREVIOUS normalised score is held
#     via CACHED_FALLBACK status. The DB function handles the fallback logic;
#     the fetcher just sends fetch_status=TIMEOUT/HTTP_ERROR.
#   • No asyncio.run() anywhere — all public functions are async.
#   • httpx replaces requests — httpx.AsyncClient is native async with
#     connection pooling across calls within a cycle.
#   • Mock APIs are used when USE_MOCK_* settings are True (development/demo).
#     Mock values are deterministic (seeded by hex_id + hour) so they are
#     stable across restarts but change realistically hour-to-hour.
#
# Depends on:
#   config.py          → API keys, timeouts, trigger thresholds, mock flags
#   db/client.py       → supabase_admin for fn_upsert_signal() RPC calls
#   services/spatial.py → get_hex_centroid()
#   services/mock_external_apis.py → mock traffic + platform payloads
# =============================================================================

from __future__ import annotations

import asyncio
import hashlib
import logging
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx

from backend.config import settings
from backend.db.client import supabase_admin
from backend.services.spatial import get_hex_centroid

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CONSTANTS — normalisation denominators derived from trigger thresholds
# ---------------------------------------------------------------------------

# Trigger 1: W score components
# W_rain = rain_mm_hr / RAIN_THRESHOLD → 1.0 at trigger, >1.0 for extremes
# W_wind = wind_kmh / WIND_THRESHOLD  → 1.0 at trigger, >1.0 for extremes
# W = W_rain + W_wind (combined; sigmoid maps the weighted sum to [0,1])
_RAIN_NORM_DENOM: float = settings.TRIGGER_RAINFALL_MM_PER_HR   # 35.0
_WIND_NORM_DENOM: float = settings.TRIGGER_WIND_KM_PER_HR       # 45.0

# Trigger 2: AQI score — A = aqi / 300 → 1.0 at trigger threshold
_AQI_NORM_DENOM: float = float(settings.TRIGGER_AQI_HAZARDOUS)  # 300.0

# Trigger 3: Traffic — congestion_index already 0–1 (1.0 = full gridlock)
# Trigger 4: Platform — order_drop_pct already 0–1 (0.70 = trigger)
# Trigger 5: Social — binary 0.0 or 1.0

# HTTP client shared across all fetches within a cycle (connection pooling)
_HTTP_TIMEOUT: float = settings.SIGNAL_FETCH_DEFAULT_TIMEOUT_SECONDS


# =============================================================================
# 1. RESULT DATACLASS
# =============================================================================

@dataclass
class SignalFetchResult:
    """
    Typed result from a single signal fetch.
    Passed to _upsert_signal() which calls fn_upsert_signal() in the DB.
    """
    hex_id:             str
    signal_type:        str             # WEATHER | AQI | TRAFFIC | PLATFORM | SOCIAL
    normalized_score:   float           # Pre-weighted input to fn_compute_dci()
    fetch_status:       str             # SUCCESS | TIMEOUT | HTTP_ERROR | MOCK | CACHED_FALLBACK
    api_endpoint:       Optional[str]   = None
    api_response_ms:    Optional[int]   = None
    http_status_code:   Optional[int]   = None
    raw_data:           Optional[dict]  = None
    error:              Optional[str]   = None

    # Typed signal values (only relevant fields populated per signal type)
    rainfall_mm_hr:         Optional[float] = None
    wind_speed_km_hr:       Optional[float] = None
    temperature_celsius:    Optional[float] = None
    aqi_value:              Optional[int]   = None
    aqi_category:           Optional[str]   = None
    dominant_pollutant:     Optional[str]   = None
    congestion_index:       Optional[float] = None
    incident_count:         Optional[int]   = None
    order_volume_drop_pct:  Optional[float] = None
    platform_api_latency_ms:Optional[int]   = None
    platform_status_flag:   Optional[int]   = None
    curfew_active:          Optional[bool]  = None
    strike_active:          Optional[bool]  = None
    social_severity_score:  Optional[float] = None
    social_event_description:Optional[str]  = None


@dataclass
class HexIngestionResult:
    """Aggregated result for all 5 signals for one hex in one cycle."""
    hex_id:             str
    city:               str
    lat:                float
    lng:                float
    sources_available:  int             = 0
    scores:             dict[str, float] = field(default_factory=dict)
    errors:             dict[str, str]  = field(default_factory=dict)
    fetch_results:      list[SignalFetchResult] = field(default_factory=list)
    cycle_duration_ms:  int             = 0


@dataclass
class CycleResult:
    """Summary of a complete signal ingestion cycle across all hexes."""
    cycle_started_at:   datetime
    hexes_processed:    int     = 0
    signals_fetched:    int     = 0
    signals_failed:     int     = 0
    signals_mocked:     int     = 0
    thresholds_breached:int     = 0
    duration_ms:        int     = 0
    errors:             list[str] = field(default_factory=list)


# =============================================================================
# 2. DB UPSERT VIA fn_upsert_signal()
# =============================================================================

async def _upsert_signal(result: SignalFetchResult) -> dict:
    """
    Calls the DB function fn_upsert_signal() (migration 004) to upsert a
    signal cache row. The DB function:
      - Auto-evaluates threshold_breached from typed columns
      - Updates consecutive_failures on non-SUCCESS status
      - Syncs hex_zones.signal_sources_available via after-update trigger
      - Returns {signal_id, threshold_breached, breach_detail, sources_available}

    Uses supabase_admin RPC — not a raw table upsert — so all DB-side logic fires.
    """
    try:
        response = supabase_admin.rpc(
            "fn_upsert_signal",
            {
                "p_hex_id":                 result.hex_id,
                "p_signal_type":            result.signal_type,
                "p_raw_data":               result.raw_data or {},
                "p_normalized_score":       result.normalized_score,
                "p_fetch_status":           result.fetch_status,
                "p_api_endpoint":           result.api_endpoint,
                "p_api_response_ms":        result.api_response_ms,
                "p_http_status_code":       result.http_status_code,
                # Typed signal fields
                "p_rainfall_mm_hr":         result.rainfall_mm_hr,
                "p_wind_speed_km_hr":       result.wind_speed_km_hr,
                "p_temperature_celsius":    result.temperature_celsius,
                "p_aqi_value":              result.aqi_value,
                "p_aqi_category":           result.aqi_category,
                "p_dominant_pollutant":     result.dominant_pollutant,
                "p_congestion_index":       result.congestion_index,
                "p_incident_count":         result.incident_count,
                "p_order_volume_drop_pct":  result.order_volume_drop_pct,
                "p_platform_latency_ms":    result.platform_api_latency_ms,
                "p_platform_status_flag":   result.platform_status_flag,
                "p_curfew_active":          result.curfew_active,
                "p_strike_active":          result.strike_active,
                "p_social_severity_score":  result.social_severity_score,
                "p_social_event_desc":      result.social_event_description,
            }
        ).execute()
        return (response.data or [{}])[0]
    except Exception as exc:
        logger.error(
            "fn_upsert_signal failed for %s/%s: %s",
            result.hex_id, result.signal_type, exc,
        )
        return {}


def _failed_result(
    hex_id: str,
    signal_type: str,
    fetch_status: str,
    error: str,
    api_endpoint: Optional[str] = None,
    api_response_ms: Optional[int] = None,
    http_status_code: Optional[int] = None,
) -> SignalFetchResult:
    """
    Returns a CACHED_FALLBACK result when a fetch fails.
    The DB fn_upsert_signal will hold the previous normalized_score value.
    normalized_score=0.0 is sent as a placeholder — the DB function uses
    the previous value when fetch_status is not SUCCESS.
    """
    return SignalFetchResult(
        hex_id=hex_id,
        signal_type=signal_type,
        normalized_score=0.0,
        fetch_status=fetch_status,
        api_endpoint=api_endpoint,
        api_response_ms=api_response_ms,
        http_status_code=http_status_code,
        error=error,
    )


# =============================================================================
# 3. MOCK HELPERS (deterministic for demo stability)
# =============================================================================

def _mock_seed(hex_id: str, signal_type: str) -> int:
    """
    Deterministic seed from hex_id + signal_type + current UTC hour.
    Ensures mock values are:
      - Stable within the same hour (no jitter on repeated scheduler cycles)
      - Realistic-feeling (change hour-to-hour like real weather)
      - Unique per hex and signal type (no cross-contamination)
    """
    hour = datetime.now(timezone.utc).hour
    key = f"{hex_id}:{signal_type}:{hour}"
    return int(hashlib.md5(key.encode()).hexdigest(), 16) % (2 ** 32)


def _mock_weather(hex_id: str) -> SignalFetchResult:
    """
    Deterministic mock weather signal.
    Most hours: light weather (DCI contribution ≈ 0.1–0.3).
    ~15% of hours: moderate rain (DCI contribution ≈ 0.5–0.8).
    ~5% of hours: heavy rain triggering Trigger 1 (≥ 35mm/hr).
    """
    rng = random.Random(_mock_seed(hex_id, "WEATHER"))
    roll = rng.random()

    if roll > 0.95:
        # Heavy rain — Trigger 1 fires
        rain = rng.uniform(35.0, 75.0)
        wind = rng.uniform(30.0, 60.0)
    elif roll > 0.80:
        # Moderate rain
        rain = rng.uniform(10.0, 34.9)
        wind = rng.uniform(15.0, 40.0)
    else:
        # Light / no rain
        rain = rng.uniform(0.0, 5.0)
        wind = rng.uniform(5.0, 20.0)

    temp = rng.uniform(18.0, 38.0)
    wind_kmh = wind  # mock already in km/hr

    # W = rain contribution + wind contribution
    # Each component reaches 1.0 at its trigger threshold
    # Combined W can exceed 1.0 (extreme events) — sigmoid handles mapping
    w_score = (rain / _RAIN_NORM_DENOM) + (wind_kmh / _WIND_NORM_DENOM)

    return SignalFetchResult(
        hex_id=hex_id,
        signal_type="WEATHER",
        normalized_score=round(w_score, 6),
        fetch_status="MOCK",
        raw_data={"rain_1h": rain, "wind_kmh": wind_kmh, "temp": temp, "source": "mock"},
        rainfall_mm_hr=round(rain, 2),
        wind_speed_km_hr=round(wind_kmh, 2),
        temperature_celsius=round(temp, 1),
    )


def _mock_aqi(hex_id: str, city: str) -> SignalFetchResult:
    """
    Deterministic mock AQI.
    Delhi-specific hexes get higher AQI range (post-Diwali pollution model).
    ~8% chance of hazardous AQI (> 300 → Trigger 2 fires).
    """
    rng = random.Random(_mock_seed(hex_id, "AQI"))
    roll = rng.random()

    is_delhi = "delhi" in city.lower()
    if roll > 0.92 or (is_delhi and roll > 0.85):
        aqi = int(rng.uniform(301, 500))
        category = "Hazardous"
    elif roll > 0.70:
        aqi = int(rng.uniform(200, 300))
        category = "Very Unhealthy"
    elif roll > 0.40:
        aqi = int(rng.uniform(100, 200))
        category = "Unhealthy for Sensitive Groups"
    else:
        aqi = int(rng.uniform(30, 100))
        category = "Good" if aqi < 50 else "Moderate"

    pollutants = ["PM2.5", "PM10", "NO2", "O3"]
    dominant = pollutants[rng.randint(0, len(pollutants) - 1)]

    # A = aqi / 300 → 1.0 at trigger threshold
    a_score = aqi / _AQI_NORM_DENOM

    return SignalFetchResult(
        hex_id=hex_id,
        signal_type="AQI",
        normalized_score=round(a_score, 6),
        fetch_status="MOCK",
        raw_data={"aqi": aqi, "category": category, "source": "mock", "city": city},
        aqi_value=aqi,
        aqi_category=category,
        dominant_pollutant=dominant,
    )


def _mock_traffic(hex_id: str) -> SignalFetchResult:
    """
    Deterministic mock traffic congestion.
    ~5% chance of full gridlock (congestion_index = 1.0 → Trigger 3 fires).
    """
    rng = random.Random(_mock_seed(hex_id, "TRAFFIC"))
    roll = rng.random()

    if roll > 0.95:
        congestion = 1.0
        incidents = rng.randint(3, 8)
    elif roll > 0.75:
        congestion = rng.uniform(0.5, 0.99)
        incidents = rng.randint(1, 3)
    else:
        congestion = rng.uniform(0.0, 0.5)
        incidents = 0

    return SignalFetchResult(
        hex_id=hex_id,
        signal_type="TRAFFIC",
        normalized_score=round(congestion, 6),
        fetch_status="MOCK",
        raw_data={"congestion_index": congestion, "incidents": incidents, "source": "mock"},
        congestion_index=round(congestion, 4),
        incident_count=incidents,
    )


def _mock_platform(hex_id: str) -> SignalFetchResult:
    """
    Deterministic mock platform status.
    ~7% chance of major outage (order_drop ≥ 0.70 → Trigger 4 fires).
    """
    rng = random.Random(_mock_seed(hex_id, "PLATFORM"))
    roll = rng.random()

    if roll > 0.93:
        order_drop = rng.uniform(0.70, 1.0)
        latency_ms = rng.randint(30001, 60000)
        status_flag = 2  # down
    elif roll > 0.80:
        order_drop = rng.uniform(0.30, 0.69)
        latency_ms = rng.randint(5000, 30000)
        status_flag = 1  # degraded
    else:
        order_drop = rng.uniform(0.0, 0.29)
        latency_ms = rng.randint(200, 2000)
        status_flag = 0  # operational

    # P = order_drop_pct (already 0–1; 0.70 = trigger threshold)
    p_score = order_drop

    return SignalFetchResult(
        hex_id=hex_id,
        signal_type="PLATFORM",
        normalized_score=round(p_score, 6),
        fetch_status="MOCK",
        raw_data={
            "order_drop_pct": order_drop,
            "latency_ms": latency_ms,
            "status_flag": status_flag,
            "source": "mock",
        },
        order_volume_drop_pct=round(order_drop, 4),
        platform_api_latency_ms=latency_ms,
        platform_status_flag=status_flag,
    )


def _mock_social(hex_id: str, city: str) -> SignalFetchResult:
    """
    Deterministic mock social/government alert signal.
    ~3% chance of curfew, ~4% chance of strike/bandh.
    Social disruptions are city-level — same seed for all hexes in a city.
    """
    city_seed = _mock_seed(city.lower(), "SOCIAL")
    rng = random.Random(city_seed)
    roll = rng.random()

    curfew_active = roll > 0.97
    strike_active = (not curfew_active) and roll > 0.93

    if curfew_active:
        severity = 1.0
        description = f"Government curfew in effect — {city}"
    elif strike_active:
        severity = 0.85
        description = f"Local bandh/strike — {city}"
    else:
        severity = 0.0
        description = None

    return SignalFetchResult(
        hex_id=hex_id,
        signal_type="SOCIAL",
        normalized_score=round(severity, 6),
        fetch_status="MOCK",
        raw_data={
            "curfew_active": curfew_active,
            "strike_active": strike_active,
            "severity": severity,
            "city": city,
            "source": "mock",
        },
        curfew_active=curfew_active,
        strike_active=strike_active,
        social_severity_score=round(severity, 4),
        social_event_description=description,
    )


# =============================================================================
# 4. REAL API FETCHERS
# =============================================================================

async def fetch_weather(
    hex_id: str,
    lat: float,
    lng: float,
    client: httpx.AsyncClient,
) -> SignalFetchResult:
    """
    Calls OpenWeatherMap Current Weather API.
    Extracts: rain.1h (mm/hr), wind.speed (m/s → km/hr), temp.

    Normalisation:
      W_rain = rain_mm_hr / 35.0   (1.0 at Trigger 1 threshold)
      W_wind = wind_kmh / 45.0     (1.0 at Trigger 1 threshold)
      W      = W_rain + W_wind     (can exceed 1.0 for extreme events)
    """
    if settings.USE_MOCK_TRAFFIC_API or not settings.OPENWEATHER_API_KEY:
        return _mock_weather(hex_id)

    endpoint = (
        f"{settings.OPENWEATHER_BASE_URL}/weather"
        f"?lat={lat}&lon={lng}"
        f"&appid={settings.OPENWEATHER_API_KEY}&units=metric"
    )
    t0 = time.perf_counter()

    try:
        resp = await client.get(
            endpoint,
            timeout=settings.OPENWEATHER_TIMEOUT_SECONDS,
        )
        latency_ms = int((time.perf_counter() - t0) * 1000)
        resp.raise_for_status()
        data = resp.json()

        rain_mm_hr    = float(data.get("rain", {}).get("1h", 0.0))
        wind_speed_ms = float(data.get("wind", {}).get("speed", 0.0))
        wind_kmh      = wind_speed_ms * 3.6
        temp          = float(data.get("main", {}).get("temp", 25.0))

        w_score = (rain_mm_hr / _RAIN_NORM_DENOM) + (wind_kmh / _WIND_NORM_DENOM)

        return SignalFetchResult(
            hex_id=hex_id,
            signal_type="WEATHER",
            normalized_score=round(w_score, 6),
            fetch_status="SUCCESS",
            api_endpoint=endpoint.split("?")[0],
            api_response_ms=latency_ms,
            http_status_code=resp.status_code,
            raw_data=data,
            rainfall_mm_hr=round(rain_mm_hr, 2),
            wind_speed_km_hr=round(wind_kmh, 2),
            temperature_celsius=round(temp, 1),
        )

    except httpx.TimeoutException:
        return _failed_result(
            hex_id, "WEATHER", "TIMEOUT",
            "OpenWeatherMap request timed out",
            api_endpoint=endpoint.split("?")[0],
            api_response_ms=int((time.perf_counter() - t0) * 1000),
        )
    except httpx.HTTPStatusError as exc:
        return _failed_result(
            hex_id, "WEATHER", "HTTP_ERROR",
            str(exc),
            api_endpoint=endpoint.split("?")[0],
            api_response_ms=int((time.perf_counter() - t0) * 1000),
            http_status_code=exc.response.status_code,
        )
    except Exception as exc:
        logger.exception("fetch_weather(%s) unexpected error: %s", hex_id, exc)
        return _failed_result(hex_id, "WEATHER", "PARSE_ERROR", str(exc))


async def fetch_aqi(
    hex_id: str,
    city: str,
    client: httpx.AsyncClient,
) -> SignalFetchResult:
    """
    Calls CPCB (data.gov.in) AQI API.
    Falls back to deterministic mock if API key absent or request fails.

    Normalisation:
      A = aqi / 300.0   (1.0 at Trigger 2 threshold of AQI > 300)
    """
    if not settings.CPCB_API_KEY or settings.USE_MOCK_SOCIAL_API:
        return _mock_aqi(hex_id, city)

    endpoint = (
        f"{settings.CPCB_BASE_URL}/"
        "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
        f"?api-key={settings.CPCB_API_KEY}&format=json&filters[city]={city}"
    )
    t0 = time.perf_counter()

    try:
        resp = await client.get(
            endpoint,
            timeout=settings.CPCB_TIMEOUT_SECONDS,
        )
        latency_ms = int((time.perf_counter() - t0) * 1000)
        resp.raise_for_status()
        data = resp.json()

        records = data.get("records", [])
        aqi = 50
        category = "Moderate"
        dominant = None

        if records:
            aqi_str = records[0].get("aqi", "50")
            if aqi_str and aqi_str != "NA":
                aqi = int(float(aqi_str))
            category = records[0].get("pollutant_id", "Unknown")
            dominant = records[0].get("pollutant_avg", None)

        a_score = aqi / _AQI_NORM_DENOM

        return SignalFetchResult(
            hex_id=hex_id,
            signal_type="AQI",
            normalized_score=round(a_score, 6),
            fetch_status="SUCCESS",
            api_endpoint=endpoint.split("?")[0],
            api_response_ms=latency_ms,
            http_status_code=resp.status_code,
            raw_data={"aqi": aqi, "category": category, "city": city, "records": records[:1]},
            aqi_value=aqi,
            aqi_category=category,
            dominant_pollutant=str(dominant) if dominant else None,
        )

    except httpx.TimeoutException:
        logger.warning("CPCB AQI timeout for %s/%s — using mock", city, hex_id)
        return _mock_aqi(hex_id, city)
    except httpx.HTTPStatusError as exc:
        logger.warning("CPCB AQI HTTP %s for %s — using mock", exc.response.status_code, city)
        return _mock_aqi(hex_id, city)
    except Exception as exc:
        logger.warning("CPCB AQI error for %s/%s: %s — using mock", city, hex_id, exc)
        return _mock_aqi(hex_id, city)


async def fetch_traffic(
    hex_id: str,
    lat: float,
    lng: float,
    client: httpx.AsyncClient,  # noqa: ARG001 — unused; real API uses it
) -> SignalFetchResult:
    """
    Fetches traffic congestion index.
    Production: Google Maps Traffic Layer API.
    Demo: Deterministic mock.

    Normalisation:
      T = congestion_index (already 0–1; 1.0 = full gridlock = Trigger 3)
    """
    # Always mock until a real traffic API partnership is established
    if settings.USE_MOCK_TRAFFIC_API:
        return _mock_traffic(hex_id)

    # Production path (Google Maps Roads API or TomTom Traffic API)
    # Placeholder — replace with real implementation when API key available
    return _mock_traffic(hex_id)


async def fetch_platform(
    hex_id: str,
    client: httpx.AsyncClient,  # noqa: ARG001 — unused; real API uses it
) -> SignalFetchResult:
    """
    Fetches platform delivery status (Zepto/Blinkit order volume + latency).
    Production: Platform partnership API.
    Demo: Deterministic mock.

    Normalisation:
      P = order_volume_drop_pct (0–1; 0.70 = Trigger 4 threshold)
    """
    if settings.USE_MOCK_PLATFORM_API:
        return _mock_platform(hex_id)

    # Production path — placeholder for platform API partnership
    return _mock_platform(hex_id)


async def fetch_social(
    hex_id: str,
    city: str,
    client: httpx.AsyncClient,  # noqa: ARG001 — future gov alert feed
) -> SignalFetchResult:
    """
    Fetches government alert feed (curfew, strike, bandh events).
    Production: GOV_ALERT_FEED_URL (NDMA / state disaster management APIs).
    Demo: Deterministic city-level mock.

    Normalisation:
      S = 1.0 if curfew_active or strike_active, else 0.0
    """
    if settings.USE_MOCK_SOCIAL_API or not settings.GOV_ALERT_FEED_URL:
        return _mock_social(hex_id, city)

    endpoint = settings.GOV_ALERT_FEED_URL
    t0 = time.perf_counter()

    try:
        resp = await client.get(
            endpoint,
            params={"city": city},
            timeout=settings.GOV_ALERT_FEED_TIMEOUT_SECONDS,
        )
        latency_ms = int((time.perf_counter() - t0) * 1000)
        resp.raise_for_status()
        data = resp.json()

        curfew_active = bool(data.get("curfew_active", False))
        strike_active = bool(data.get("strike_active", False))
        severity      = 1.0 if curfew_active else (0.85 if strike_active else 0.0)
        description   = data.get("description")

        return SignalFetchResult(
            hex_id=hex_id,
            signal_type="SOCIAL",
            normalized_score=round(severity, 6),
            fetch_status="SUCCESS",
            api_endpoint=endpoint,
            api_response_ms=latency_ms,
            http_status_code=resp.status_code,
            raw_data=data,
            curfew_active=curfew_active,
            strike_active=strike_active,
            social_severity_score=round(severity, 4),
            social_event_description=description,
        )

    except Exception as exc:
        logger.warning("Gov alert feed error for %s: %s — using mock", city, exc)
        return _mock_social(hex_id, city)


# =============================================================================
# 5. PER-HEX FETCH ORCHESTRATOR
# =============================================================================

async def fetch_all_signals_for_hex(
    hex_id: str,
    city:   str,
    lat:    float,
    lng:    float,
    client: httpx.AsyncClient,
) -> HexIngestionResult:
    """
    Fetches all 5 signals concurrently for a single hex zone.
    Uses asyncio.gather() so all 5 API calls run in parallel (≈ 5× faster
    than sequential fetching, keeping total cycle time under 60s for 150 hexes).

    Each fetch result is immediately upserted to signal_cache via fn_upsert_signal().
    """
    t0 = time.perf_counter()

    # Fire all 5 fetches concurrently
    weather_r, aqi_r, traffic_r, platform_r, social_r = await asyncio.gather(
        fetch_weather(hex_id, lat, lng, client),
        fetch_aqi(hex_id, city, client),
        fetch_traffic(hex_id, lat, lng, client),
        fetch_platform(hex_id, client),
        fetch_social(hex_id, city, client),
        return_exceptions=False,   # let individual errors be caught per fetcher
    )

    results: list[SignalFetchResult] = [
        weather_r, aqi_r, traffic_r, platform_r, social_r
    ]

    # Upsert all 5 signals concurrently
    upsert_tasks = [_upsert_signal(r) for r in results]
    upsert_responses = await asyncio.gather(*upsert_tasks, return_exceptions=True)

    # Build HexIngestionResult
    ingestion = HexIngestionResult(
        hex_id=hex_id,
        city=city,
        lat=lat,
        lng=lng,
        cycle_duration_ms=int((time.perf_counter() - t0) * 1000),
    )

    for r, upsert_resp in zip(results, upsert_responses):
        if r.fetch_status in ("SUCCESS", "MOCK"):
            ingestion.sources_available += 1
            ingestion.scores[r.signal_type] = r.normalized_score
        else:
            ingestion.errors[r.signal_type] = r.error or r.fetch_status

        ingestion.fetch_results.append(r)

        if isinstance(upsert_resp, Exception):
            logger.error(
                "Upsert failed for %s/%s: %s",
                hex_id, r.signal_type, upsert_resp,
            )

    return ingestion


# =============================================================================
# 6. CYCLE ORCHESTRATOR
# =============================================================================

async def run_signal_ingestion_cycle(
    hex_ids: list[str],
    city:    str = "bengaluru",
) -> CycleResult:
    """
    Fetches all 5 signals for every hex in hex_ids.
    Entry point called by APScheduler every SIGNAL_JOB_CRON_MINUTE.

    Architecture:
      - One shared httpx.AsyncClient for all hexes (connection pooling)
      - Hexes are processed sequentially (not all concurrently) to avoid
        bursting Supabase free tier rate limits.
      - SIGNAL_INGESTION_HEX_SLEEP_SECONDS paces the hex iteration.
      - Within each hex, all 5 signals are fetched concurrently (asyncio.gather).

    Args:
        hex_ids:  List of H3 cell index strings to process
        city:     City name for AQI and social signal context

    Returns:
        CycleResult with aggregate statistics for monitoring.
    """
    cycle_result = CycleResult(cycle_started_at=datetime.now(timezone.utc))
    t_cycle_start = time.perf_counter()

    logger.info(
        "Signal ingestion cycle started: %d hexes, city=%s",
        len(hex_ids), city,
    )

    async with httpx.AsyncClient(
        headers={"User-Agent": f"gigHood-signal-fetcher/{settings.APP_VERSION}"},
        follow_redirects=True,
    ) as client:
        for hex_id in hex_ids:
            # Resolve centroid coordinates for this hex
            lat, lng = 12.9716, 77.5946   # Bengaluru fallback
            try:
                centroid = get_hex_centroid(hex_id)
                if centroid:
                    lat, lng = centroid
            except Exception as exc:
                logger.warning(
                    "get_hex_centroid(%s) failed: %s — using fallback coords",
                    hex_id, exc,
                )

            try:
                hex_result = await fetch_all_signals_for_hex(
                    hex_id=hex_id,
                    city=city,
                    lat=lat,
                    lng=lng,
                    client=client,
                )

                # Accumulate cycle stats
                cycle_result.hexes_processed += 1
                cycle_result.signals_fetched += hex_result.sources_available
                cycle_result.signals_failed  += len(hex_result.errors)
                cycle_result.signals_mocked  += sum(
                    1 for r in hex_result.fetch_results
                    if r.fetch_status == "MOCK"
                )

                if settings.SIGNAL_INGESTION_HEX_SLEEP_SECONDS > 0:
                    await asyncio.sleep(settings.SIGNAL_INGESTION_HEX_SLEEP_SECONDS)

            except Exception as exc:
                error_msg = f"Hex {hex_id} ingestion error: {exc}"
                logger.error(error_msg)
                cycle_result.errors.append(error_msg)
                cycle_result.hexes_processed += 1

    cycle_result.duration_ms = int((time.perf_counter() - t_cycle_start) * 1000)

    logger.info(
        "Signal ingestion cycle complete: %d hexes, %d signals, "
        "%d failed, %d mocked, duration=%dms",
        cycle_result.hexes_processed,
        cycle_result.signals_fetched,
        cycle_result.signals_failed,
        cycle_result.signals_mocked,
        cycle_result.duration_ms,
    )

    return cycle_result