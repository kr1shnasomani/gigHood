import pytest
import math
from unittest.mock import patch, MagicMock
from backend.services.dci_engine import sigmoid, compute_dci, get_dci_status, run_dci_cycle

def test_sigmoid_values():
    """Verify exact output of the sigmoid boundary function."""
    assert sigmoid(0) == 0.5
    assert math.isclose(sigmoid(2), 0.88079, rel_tol=1e-3)
    assert math.isclose(sigmoid(-2), 0.11920, rel_tol=1e-3)

def test_compute_dci_formula():
    """
    Test exact formula inputs from the documented DCI formula examples:
    σ(0.45×1.0 + 0.25×0.8 + 0.20×0.9 + 0.10×0.5) = σ(0.88) ≈ 0.70682
    """
    res = compute_dci(w=1.0, t=0.8, p=0.9, s=0.5)
    assert math.isclose(res, 0.70682, rel_tol=1e-4)

def test_get_dci_status():
    """Validate status definitions based on exact float boundaries."""
    assert get_dci_status(0.60) == 'normal'
    assert get_dci_status(0.65) == 'normal' # <= 0.65 is normal
    assert get_dci_status(0.66) == 'elevated'
    assert get_dci_status(0.85) == 'elevated' # <= 0.85 is elevated
    assert get_dci_status(0.86) == 'disrupted'

@patch("backend.services.dci_engine.supabase")
def test_run_dci_cycle_degraded_mode(mock_supabase):
    """If < 3 signals are available for a hex, the cycle should fail safely to 'normal'."""
    # Mock supabase response to return only 2 signals
    mock_response = MagicMock()
    mock_response.data = [
        {"hex_id": "hex123", "signal_type": "WEATHER", "normalized_score": 0.8},
        {"hex_id": "hex123", "signal_type": "TRAFFIC", "normalized_score": 0.5}
    ]
    
    mock_supabase.table().select().in_().execute.return_value = mock_response
    
    results = run_dci_cycle(["hex123"])
    
    assert "hex123" in results
    assert results["hex123"]["status"] == "degraded (insufficient signals)"
    assert results["hex123"]["dci"] is None


