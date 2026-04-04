import pytest
from unittest.mock import patch, MagicMock
from backend.services.signal_fetchers import (
    fetch_weather, 
    fetch_aqi, 
    fetch_traffic, 
    fetch_platform_status, 
    fetch_social_signals,
    run_signal_ingestion_cycle
)

@patch("backend.services.signal_fetchers.requests.get")
@patch("backend.services.signal_fetchers.cache_signal")
def test_fetch_weather_normalization(mock_cache, mock_get, monkeypatch):
    """
    Test that 40mm/hr rain normalizes to ~0.85 W score, as per the math rule:
    W = (rain_1h / 47.05) + (wind_kmh / 100.0)
    """
    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "rain": {"1h": 40.0},
        "wind": {"speed": 0.0} # 0 km/h wind
    }
    mock_get.return_value = mock_resp

    monkeypatch.setattr("backend.services.signal_fetchers.settings.OPENWEATHER_API_KEY", "unit-test-key")
    
    # 40 / 47.05 ≈ 0.8501
    w_score = fetch_weather("89618c28133ffff", 12.0, 77.0)
    assert 0.84 < w_score < 0.86
    
    mock_cache.assert_called_once()
    args, kwargs = mock_cache.call_args
    assert args[0] == "89618c28133ffff"
    assert args[1] == "WEATHER"

@patch("backend.services.signal_fetchers.requests.get")
def test_fetch_weather_missing_key(mock_get, monkeypatch):
    """
    Test that it raises ValueError if no OpenWeatherMap key is present
    """
    monkeypatch.setattr("backend.services.signal_fetchers.settings.OPENWEATHER_API_KEY", "")
    with pytest.raises(ValueError):
        fetch_weather("89618c28133ffff", 12.0, 77.0)

@patch("backend.services.signal_fetchers.requests.get")
@patch("backend.services.signal_fetchers.cache_signal")
def test_fetch_aqi_normalization(mock_cache, mock_get):
    """
    Test that an AQI of 350 maps to an exact 0.35 W component score addition.
    """
    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "records": [{"aqi": "350"}]
    }
    mock_get.return_value = mock_resp
    
    # Needs valid CPCB key for the mock to be hit
    with patch("backend.services.signal_fetchers.settings.CPCB_API_KEY", "real-key"):
        a_score = fetch_aqi("89618c28133ffff", "Bengaluru")
        assert a_score == 0.35

@patch("backend.services.signal_fetchers.fetch_weather")
@patch("backend.services.signal_fetchers.fetch_aqi")
@patch("backend.services.signal_fetchers.fetch_traffic")
@patch("backend.services.signal_fetchers.fetch_platform_status")
@patch("backend.services.signal_fetchers.fetch_social_signals")
@patch("backend.services.signal_fetchers.get_hex_centroid")
def test_degraded_mode_signal_counting(
    mock_get_hex, mock_social, mock_platform, mock_traffic, mock_aqi, mock_weather
):
    """
    Test that the run_signal_ingestion_cycle properly catches errors 
    and returns a `source_available` count representing only successful fetchers.
    """
    mock_get_hex.return_value = (12.0, 77.0)
    
    # Weather and AQI fail (simulating extreme API outage)
    mock_weather.side_effect = Exception("Connection Timeout")
    mock_aqi.side_effect = Exception("Connection Timeout")
    
    # Traffic, Platform, Social succeed
    mock_traffic.return_value = 0.5
    mock_platform.return_value = 0.2
    mock_social.return_value = 0.0
    
    hex_ids = ["89618c28133ffff"]
    results = run_signal_ingestion_cycle(hex_ids)
    
    assert "89618c28133ffff" in results
    res = results["89618c28133ffff"]
    
    # Out of 5 signals, 2 failed -> 3 available.
    assert res["source_available"] == 3
    
    # Assert errors are tracked cleanly
    assert "WEATHER" in res["errors"]
    assert "AQI" in res["errors"]
    
    # Assert successful scores are tracked
    assert res["scores"]["TRAFFIC"] == 0.5
    assert res["scores"]["PLATFORM"] == 0.2
    assert res["scores"]["SOCIAL"] == 0.0
