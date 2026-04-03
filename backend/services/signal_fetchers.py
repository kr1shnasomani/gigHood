import json
import random
import requests
import time
import asyncio
from datetime import datetime, timezone
from backend.config import settings
from backend.db.client import supabase
from backend.db.supabase_retry import execute_with_retry
from backend.services.spatial import get_hex_centroid
from backend.services.mock_external_apis import fetch_mock_tomtom_traffic, fetch_mock_platform_outage


def _run_async(coro):
    """Run async mock API calls from sync service code paths."""
    return asyncio.run(coro)

def cache_signal(hex_id: str, signal_type: str, raw_data: dict, normalized_score: float) -> None:
    """
    Saves the fetched signal payload and its computed score into the Supabase signal_cache.
    UPSERTS based on (hex_id, signal_type).
    """
    try:
        signal_type_db = signal_type.lower()
        # Normalize to plain JSON-safe data to avoid accidental mutable mapping side effects.
        stable_raw_data = json.loads(json.dumps(raw_data, default=str))
        execute_with_retry(
            lambda: supabase.table("signal_cache").upsert({
                "hex_id": hex_id,
                "signal_type": signal_type_db,
                "raw_data": stable_raw_data,
                "normalized_score": normalized_score,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source_available": True,
            }).execute(),
            op_name=f"cache_signal:{signal_type_db}:{hex_id}",
        )
    except Exception as e:
        print(f"Error caching signal {signal_type} for hex {hex_id}: {e}")

def fetch_weather(hex_id: str, lat: float, lng: float) -> float:
    """
    Calls OpenWeatherMap API. Extracts rain.1h and wind.speed.
    Normalizes to W score using W = (rain_mm / 47.05) + (wind_kmh / 100.0)
    """
    if not settings.OPENWEATHER_API_KEY or settings.OPENWEATHER_API_KEY.startswith("your_"):
        raise ValueError("Missing or invalid OPENWEATHER_API_KEY")
        
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={settings.OPENWEATHER_API_KEY}&units=metric"
    resp = requests.get(url, timeout=5)
    resp.raise_for_status()
    data = resp.json()
    
    rain_1h = data.get("rain", {}).get("1h", 0.0)
    wind_speed_ms = data.get("wind", {}).get("speed", 0.0)
    wind_kmh = wind_speed_ms * 3.6
    
    # Normalization math as per spec approximation
    w_score = (rain_1h / 47.05) + (wind_kmh / 100.0)
    
    cache_signal(hex_id, "WEATHER", data, w_score)
    return w_score

def fetch_aqi(hex_id: str, city: str) -> float:
    """
    Calls AQI API (or deterministically mocks it if CPCB endpoint is brittle).
    Returns purely the AQI component scale (aqi / 1000.0)
    """
    aqi = 50.0
    raw_data = {}
    try:
        if settings.CPCB_API_KEY and not settings.CPCB_API_KEY.startswith("your_"):
            # Try to fetch real CPCB from api.data.gov.in
            url = f"https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key={settings.CPCB_API_KEY}&format=json&filters[city]={city}"
            resp = requests.get(url, timeout=5)
            resp.raise_for_status()
            
            data = resp.json()
            records = data.get("records", [])
            if records:
                aqi_str = records[0].get("aqi", "50")
                if aqi_str and aqi_str != "NA":
                    aqi = float(aqi_str)
            raw_data = {"aqi": aqi, "source": "cpcb", "records": records}
        else:
            raise ValueError("No CPCB key")
    except Exception as e:
        # Fallback deterministic mock
        current_hour = datetime.now(timezone.utc).hour
        random.seed(f"aqi-{hex_id}-{current_hour}")
        aqi = random.uniform(50, 450)
        raw_data = {"aqi": aqi, "source": "mock", "error": str(e)}

    a_score = aqi / 1000.0
    cache_signal(hex_id, "AQI", raw_data, a_score)
    return a_score

async def fetch_traffic_async(hex_id: str, lat: float, lng: float) -> float:
    """Fetch traffic score from partner-style async mock API."""
    payload = await fetch_mock_tomtom_traffic(hex_id, lat, lng)
    t_score = float(payload.get("congestion_level", 0.0))
    cache_signal(hex_id, "TRAFFIC", payload, t_score)
    return t_score


def fetch_traffic(hex_id: str, lat: float, lng: float) -> float:
    """
    Mock traffic congestion API.
    Returns random T score seeded deterministically per hex/hour.
    """
    return _run_async(fetch_traffic_async(hex_id, lat, lng))

async def fetch_platform_status_async(hex_id: str) -> float:
    """Fetch platform outage/degradation score from partner-style async mock API."""
    payload = await fetch_mock_platform_outage(hex_id)
    p_score = float(payload.get("order_drop_pct", 0.0)) / 100.0
    cache_signal(hex_id, "PLATFORM", payload, p_score)
    return p_score


def fetch_platform_status(hex_id: str) -> float:
    """
    Mock platform status (Zepto/Blinkit) API simulating order volume drop %.
    Return P score as order_drop_pct / 100
    """
    return _run_async(fetch_platform_status_async(hex_id))

def fetch_social_signals(hex_id: str, city: str) -> float:
    """
    Mock government alert feed.
    Return S score (0 = no alert, 1 = curfew/bandh)
    """
    current_hour = datetime.now(timezone.utc).hour
    random.seed(f"social-{hex_id}-{current_hour}-{city}")
    # 5% chance of severe alert
    is_alert = random.random() > 0.95 
    s_score = 1.0 if is_alert else 0.0
    
    raw_data = {"alert_active": is_alert, "city": city}
    cache_signal(hex_id, "SOCIAL", raw_data, s_score)
    return s_score

def run_signal_ingestion_cycle(hex_ids: list[str], city: str = "Bengaluru"):
    """
    Orchestrator that calls all 5 fetchers for a list of hexes.
    Tracks availability of signals to power degraded DB modes.
    Returns a dictionary of results per hex to aid testing and DCI processing.
    """
    results = {}
    
    for hex_id in hex_ids:
        # Default coords if spatial lookup fails
        lat, lng = 12.9716, 77.5946
        try:
            centroid = get_hex_centroid(hex_id)
            if centroid:
                lat, lng = centroid
        except Exception:
            pass
            
        hex_result = {"source_available": 0, "scores": {}, "errors": {}}
        
        # 1. Weather
        try:
            w = fetch_weather(hex_id, lat, lng)
            hex_result["scores"]["WEATHER"] = w
            hex_result["source_available"] += 1
        except Exception as e:
            hex_result["errors"]["WEATHER"] = str(e)
            
        # 2. AQI
        try:
            a = fetch_aqi(hex_id, city)
            hex_result["scores"]["AQI"] = a
            hex_result["source_available"] += 1
        except Exception as e:
            hex_result["errors"]["AQI"] = str(e)
            
        # 3. Traffic
        try:
            t = fetch_traffic(hex_id, lat, lng)
            hex_result["scores"]["TRAFFIC"] = t
            hex_result["source_available"] += 1
        except Exception as e:
            hex_result["errors"]["TRAFFIC"] = str(e)
            
        # 4. Platform
        try:
            p = fetch_platform_status(hex_id)
            hex_result["scores"]["PLATFORM"] = p
            hex_result["source_available"] += 1
        except Exception as e:
            hex_result["errors"]["PLATFORM"] = str(e)
            
        # 5. Social
        try:
            s = fetch_social_signals(hex_id, city)
            hex_result["scores"]["SOCIAL"] = s
            hex_result["source_available"] += 1
        except Exception as e:
            hex_result["errors"]["SOCIAL"] = str(e)
            
        results[hex_id] = hex_result

        # Small pacing delay lowers burst pressure on DB and transport.
        if settings.SIGNAL_INGESTION_HEX_SLEEP_SECONDS > 0:
            time.sleep(settings.SIGNAL_INGESTION_HEX_SLEEP_SECONDS)

    return results
