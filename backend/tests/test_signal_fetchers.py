import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from backend.services.signal_fetchers import (
    fetch_weather, 
    fetch_aqi, 
    fetch_traffic, 
    fetch_platform, 
    fetch_social,
    run_signal_ingestion_cycle,
    SignalFetchResult
)

@pytest.mark.asyncio
async def test_fetch_weather_mock():
    # Since USE_MOCK_TRAFFIC_API or OPENWEATHER_API_KEY being missing triggers mock,
    # we can just test the mock path.
    client = httpx.AsyncClient()
    res = await fetch_weather("89618c28133ffff", 12.0, 77.0, client)
    assert res.signal_type == "WEATHER"
    assert res.fetch_status == "MOCK"
    assert "rain_1h" in res.raw_data
    await client.aclose()

@pytest.mark.asyncio
async def test_fetch_aqi_mock():
    client = httpx.AsyncClient()
    res = await fetch_aqi("89618c28133ffff", "Bengaluru", client)
    assert res.signal_type == "AQI"
    assert res.fetch_status == "MOCK"
    assert res.aqi_value is not None
    await client.aclose()

@pytest.mark.asyncio
async def test_fetch_traffic_mock():
    client = httpx.AsyncClient()
    res = await fetch_traffic("89618c28133ffff", 12.0, 77.0, client)
    assert res.signal_type == "TRAFFIC"
    assert res.fetch_status == "MOCK"
    assert res.congestion_index is not None
    await client.aclose()

@pytest.mark.asyncio
async def test_fetch_platform_mock():
    client = httpx.AsyncClient()
    res = await fetch_platform("89618c28133ffff", client)
    assert res.signal_type == "PLATFORM"
    assert res.fetch_status == "MOCK"
    assert res.order_volume_drop_pct is not None
    await client.aclose()

@pytest.mark.asyncio
async def test_fetch_social_mock():
    client = httpx.AsyncClient()
    res = await fetch_social("89618c28133ffff", "Bengaluru", client)
    assert res.signal_type == "SOCIAL"
    assert res.fetch_status == "MOCK"
    assert res.social_severity_score is not None
    await client.aclose()

@pytest.mark.asyncio
@patch("backend.services.signal_fetchers.supabase_admin.rpc")
async def test_run_signal_ingestion_cycle(mock_rpc):
    mock_execute = MagicMock()
    mock_execute.execute.return_value = MagicMock(data=[{}])
    mock_rpc.return_value = mock_execute
    
    hex_ids = ["89618c28133ffff"]
    results = await run_signal_ingestion_cycle(hex_ids)
    
    assert results.hexes_processed == 1
    assert results.signals_mocked == 5
    assert results.signals_fetched == 5
