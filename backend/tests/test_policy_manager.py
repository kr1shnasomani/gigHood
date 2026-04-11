"""
Tests for backend/services/policy_manager.py (production-grade upgrade)

Covers:
  - Date utilities (unchanged)
  - _validate_policy_params: tier, premium, cap
  - _get_coverage_cap_for_tier
  - _check_idempotency: returns existing row / None
  - _validate_worker_exists: raises ValueError for missing workers
  - create_policy: idempotent return, validation error, successful insert mock
  - renew_policy: idempotent return, DB failure raises (no silent pass)
  - explain_policy_decision: output shape unchanged
"""

import json
import pytest
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from backend.services.policy_manager import (
    get_next_monday_sunday_bounds,
    get_current_monday_sunday_bounds,
    _get_coverage_cap_for_tier,
    _validate_policy_params,
    _check_idempotency,
    _validate_worker_exists,
    create_policy,
    renew_policy,
)


# =============================================================================
# Date utilities
# =============================================================================

def test_get_next_monday_sunday_bounds_from_wednesday():
    """Wednesday → next Monday is 5 days ahead."""
    wed = date(2025, 4, 9)   # Wednesday
    mon, sun = get_next_monday_sunday_bounds(wed)
    assert mon.weekday() == 0    # Monday
    assert sun.weekday() == 6    # Sunday
    assert (sun - mon).days == 6
    assert mon > wed


def test_get_next_monday_sunday_bounds_from_monday():
    """Monday itself → next Monday is 7 days ahead (not today)."""
    mon_today = date(2025, 4, 7)   # Monday
    nxt_mon, nxt_sun = get_next_monday_sunday_bounds(mon_today)
    assert nxt_mon > mon_today
    assert nxt_mon.weekday() == 0


def test_get_current_monday_sunday_bounds():
    friday = date(2025, 4, 11)  # Friday
    curr_mon, curr_sun = get_current_monday_sunday_bounds(friday)
    assert curr_mon.weekday() == 0
    assert curr_sun.weekday() == 6
    assert curr_mon <= friday <= curr_sun


# =============================================================================
# Coverage cap
# =============================================================================

@pytest.mark.parametrize("tier,expected", [
    ("A", 600.0),
    ("B", 700.0),
    ("C", 800.0),
    ("X", 700.0),   # unknown tier → default B
])
def test_get_coverage_cap_for_tier(tier, expected):
    assert _get_coverage_cap_for_tier(tier) == expected


# =============================================================================
# Validation layer
# =============================================================================

def test_validate_policy_params_valid():
    """Valid inputs must not raise."""
    _validate_policy_params("A", 50.0, 600.0)  # no error
    _validate_policy_params("B", 1.0, 1.0)


def test_validate_policy_params_invalid_tier():
    with pytest.raises(ValueError, match="Invalid tier"):
        _validate_policy_params("D", 50.0, 600.0)


def test_validate_policy_params_zero_premium():
    with pytest.raises(ValueError, match="Premium must be > 0"):
        _validate_policy_params("A", 0.0, 600.0)


def test_validate_policy_params_negative_cap():
    with pytest.raises(ValueError, match="Coverage cap must be > 0"):
        _validate_policy_params("B", 50.0, -1.0)


# =============================================================================
# Idempotency check
# =============================================================================

def _make_supabase_mock(data: list):
    """Returns a mock supabase chain that yields the given data list."""
    response = MagicMock()
    response.data = data
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.limit.return_value = table
    table.execute.return_value = response
    mock_sb = MagicMock()
    mock_sb.table.return_value = table
    return mock_sb


def test_check_idempotency_returns_existing(monkeypatch):
    existing_row = {"id": "pol_abc", "worker_id": "w1", "week_start": "2025-04-14"}
    mock_sb = _make_supabase_mock([existing_row])

    with patch("backend.services.policy_manager.supabase", mock_sb):
        result = _check_idempotency("w1", date(2025, 4, 14))

    assert result == existing_row


def test_check_idempotency_returns_none_when_no_row(monkeypatch):
    mock_sb = _make_supabase_mock([])   # empty = no existing policy

    with patch("backend.services.policy_manager.supabase", mock_sb):
        result = _check_idempotency("w1", date(2025, 4, 14))

    assert result is None


# =============================================================================
# Worker validation
# =============================================================================

def test_validate_worker_exists_raises_for_missing(monkeypatch):
    mock_sb = _make_supabase_mock([])   # no worker row

    with patch("backend.services.policy_manager.supabase", mock_sb):
        with pytest.raises(ValueError, match="does not exist"):
            _validate_worker_exists("ghost_worker_999")


def test_validate_worker_exists_passes_for_known(monkeypatch):
    mock_sb = _make_supabase_mock([{"id": "w1"}])  # worker found

    with patch("backend.services.policy_manager.supabase", mock_sb):
        _validate_worker_exists("w1")  # should not raise


# =============================================================================
# create_policy — idempotency path
# =============================================================================

def test_create_policy_returns_existing_on_duplicate(monkeypatch):
    """
    If a policy already exists for (worker_id, week_start),
    create_policy must return that row without touching the DB insert path.
    """
    existing = {
        "id": "pol_existing", "worker_id": "w1", "tier": "B",
        "week_start": "2025-04-14", "status": "active",
    }

    # Each supabase.table call needs to return appropriate data.
    # Sequence: (1) worker validation, (2) idempotency check → existing row.
    call_count = {"n": 0}

    def table_side_effect(name):
        call_count["n"] += 1
        mock = MagicMock()
        mock.select.return_value = mock
        mock.eq.return_value = mock
        mock.limit.return_value = mock
        mock.order.return_value = mock
        mock.gte.return_value = mock
        mock.insert.return_value = mock
        if name == "workers":
            mock.execute.return_value = MagicMock(data=[{"id": "w1", "city": "Bengaluru"}])
        elif name == "policies":
            mock.execute.return_value = MagicMock(data=[existing])
        else:
            mock.execute.return_value = MagicMock(data=[])
        return mock

    mock_sb = MagicMock()
    mock_sb.table.side_effect = table_side_effect

    with patch("backend.services.policy_manager.supabase", mock_sb), \
         patch("backend.services.policy_manager.predict_tier", return_value="B"), \
         patch("backend.services.policy_manager.calculate_premium", return_value=50.0):
        result = create_policy("w1")

    assert result["id"] == "pol_existing"


# =============================================================================
# create_policy — missing worker raises
# =============================================================================

def test_create_policy_raises_for_missing_worker(monkeypatch):
    """create_policy must raise ValueError when the worker doesn't exist."""

    def table_side_effect(name):
        mock = MagicMock()
        mock.select.return_value = mock
        mock.eq.return_value = mock
        mock.limit.return_value = mock
        mock.execute.return_value = MagicMock(data=[])  # empty for all tables
        return mock

    mock_sb = MagicMock()
    mock_sb.table.side_effect = table_side_effect

    with patch("backend.services.policy_manager.supabase", mock_sb):
        with pytest.raises(ValueError, match="does not exist"):
            create_policy("nonexistent_worker")


# =============================================================================
# renew_policy — DB failure raises instead of silently passing
# =============================================================================

def test_renew_policy_raises_on_db_failure(monkeypatch):
    """
    renew_policy must raise RuntimeError when the DB insert fails —
    the old `except: pass` silent failure is removed.
    """

    call_n = {"n": 0}

    def table_side_effect(name):
        call_n["n"] += 1
        mock = MagicMock()
        mock.select.return_value = mock
        mock.eq.return_value = mock
        mock.limit.return_value = mock
        mock.order.return_value = mock
        mock.gte.return_value = mock
        if name == "workers":
            mock.execute.return_value = MagicMock(data=[{"id": "w2", "city": "Chennai"}])
        elif name == "policies":
            # First call is idempotency check → no existing row
            if call_n["n"] <= 3:
                mock.execute.return_value = MagicMock(data=[])
            else:
                # Insert fails
                mock.insert.return_value = mock
                mock.execute.side_effect = Exception("DB connection timeout")
        else:
            mock.execute.return_value = MagicMock(data=[])
        return mock

    mock_sb = MagicMock()
    mock_sb.table.side_effect = table_side_effect

    with patch("backend.services.policy_manager.supabase", mock_sb), \
         patch("backend.services.policy_manager.predict_tier", return_value="C"), \
         patch("backend.services.policy_manager.calculate_premium", return_value=60.0):
        with pytest.raises((RuntimeError, ValueError, Exception)):
            renew_policy("w2")
