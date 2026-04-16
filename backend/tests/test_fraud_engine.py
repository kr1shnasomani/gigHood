import pytest
import math
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from backend.services.fraud_engine import FraudEvaluator, haversine

def test_haversine_formula():
    """Validates the Haversine great-circle Earth math internally."""
    # Known distance roughly: ~473.0 meters
    dist = haversine(12.9716, 77.5946, 12.9758, 77.5950)
    assert math.isclose(dist, 469.0, rel_tol=1e-1)
    
def test_gate2_micro_delivery_exclusions():
    """
    Simulates mock worker processing micro-trips < 100 meters.
    Ensures they are truncated preventing spatial looping fraud.
    """
    evaluator = FraudEvaluator()
    # 'offline' generic workers immediately map to NONE without iterating.
    assert evaluator._evaluate_gate2_orders('worker-offline-123') == 'NONE'
    
    # Generic worker uses default mock array in _evaluate_gate2_orders:
    # 1 valid (>100m) and 1 invalid (<100m).
    # Since valid_orders >= 1 remains, returns STRONG.
    assert evaluator._evaluate_gate2_orders('worker-strong-123') == 'STRONG'
    
    assert evaluator._evaluate_gate2_orders('weak-signal-worker') == 'WEAK'

@patch("backend.services.fraud_engine.supabase")
def test_full_pipeline_compound_score(mock_supabase):
    """
    Tests Layer accumulations strictly natively bounded:
    With short observation windows, static GPS should not trigger.
    """
    start_time = datetime.now(timezone.utc)
    evaluator = FraudEvaluator()
    
    # We will build isolated table mocks
    event_table = MagicMock()
    event_table.select.return_value.eq.return_value.execute.return_value.data = [{"hex_id": "hex-1"}]
    
    ping_table = MagicMock()
    p1 = {"hex_id": "hex-1", "latitude": 12.0, "longitude": 77.0, "mock_location_flag": True, "pinged_at": start_time.isoformat()}
    p2 = {"hex_id": "hex-1", "latitude": 12.0, "longitude": 77.0, "mock_location_flag": False, "pinged_at": (start_time+timedelta(minutes=1)).isoformat()}
    p3 = {"hex_id": "hex-1", "latitude": 12.0, "longitude": 77.0, "mock_location_flag": False, "pinged_at": (start_time+timedelta(minutes=2)).isoformat()}
    
    ping_table.select.return_value.eq.return_value.gte.return_value.lte.return_value.order.return_value.execute.return_value.data = [p1, p2, p3]
    
    # Tie to side_effect
    def table_mock_router(table_name):
        if table_name == 'disruption_events': return event_table
        if table_name == 'location_pings': return ping_table
        return MagicMock()
        
    mock_supabase.table.side_effect = table_mock_router
    
    res = evaluator.evaluate('worker-cohort-ring', 'ev-1', start_time)
    
    assert 'STATIC_DEVICE_FLAG' not in res['flags']
    assert 'MOCK_LOCATION_FLAG' in res['flags']
    # With 3 pings in the window, SPARSE_TELEMETRY flag triggered (+5)
    # Mock location detected (+20) 
    # Expected flags: SPARSE_TELEMETRY, MOCK_LOCATION_FLAG
    assert any('TELEMETRY' in f for f in res['flags']), f"Expected telemetry flag, got {res['flags']}"
    assert res['fraud_score'] > 0, f"Expected fraud_score > 0, got {res['fraud_score']}"

def test_evaluate_velocity():
    evaluator = FraudEvaluator()
    # 10 km in 2 minutes = 300 km/hr > 120km/hr limit.
    ping1 = {"hex_id": "hex-0", "latitude": 12.0, "longitude": 77.0, "pinged_at": "2026-03-27T00:00:00+00:00"}
    ping2 = {"hex_id": "hex-1", "latitude": 12.09, "longitude": 77.0, "pinged_at": "2026-03-27T00:02:00+00:00"}
    
    assert evaluator._evaluate_velocity([ping1, ping2], "hex-1") is True
