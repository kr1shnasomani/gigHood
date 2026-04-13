"""
Tests for backend/services/pop_validator.py (production-grade upgrade)

The 3 original tests are preserved with a chain fix:
  old: .select().eq().gte().lte()
  new: .select().eq().gte().lte().limit()   ← added .limit()

New tests cover:
  - Accuracy filter (pings >100m dropped)
  - Time span flag (all pings <5 min apart)
  - Velocity flag (>120 km/h between pings)
  - Static device flag (identical coordinates)
  - DB retry / safe default on failure
  - _haversine_km correctness
  - _check_time_span logic
  - _check_velocity logic
  - _check_static_device logic
"""

import math
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from backend.services.pop_validator import (
    validate_pop,
    _haversine_km,
    _check_time_span,
    _check_velocity,
    _check_static_device,
    _safe_result,
)

# ── Helper: build the full supabase mock chain including .limit() ─────────────

def _mock_chain(data: list) -> MagicMock:
    """Returns a supabase mock that yields `data` from the full query chain."""
    mock_exec = MagicMock()
    mock_exec.execute.return_value.data = data

    mock_sb = MagicMock()
    (
        mock_sb.table.return_value
        .select.return_value
        .eq.return_value
        .gte.return_value
        .lte.return_value
        .limit.return_value
    ) = mock_exec
    return mock_sb


# =============================================================================
# ─── ORIGINAL TESTS (fixed for new .limit() chain) ────────────────────────────
# =============================================================================

@patch("backend.services.pop_validator.supabase")
def test_validate_pop_worker_present(mock_supabase):
    """Worker has exactly 3 pings in the disrupted hex within 90 min → present=True"""
    disruption_start = datetime.now(timezone.utc)
    mock_supabase.table.return_value.select.return_value.eq.return_value \
        .gte.return_value.lte.return_value.limit.return_value \
        .execute.return_value.data = [
            {"hex_id": "89618928cajff", "latitude": 13.0, "longitude": 80.0, "accuracy": 10, "pinged_at": "2025-04-12T00:00:00+00:00"},
            {"hex_id": "89618928cajff", "latitude": 13.0001, "longitude": 80.0001, "accuracy": 20, "pinged_at": "2025-04-12T00:10:00+00:00"},
            {"hex_id": "89618928cajff", "latitude": 13.0002, "longitude": 80.0002, "accuracy": 15, "pinged_at": "2025-04-12T00:20:00+00:00"},
        ]

    res = validate_pop("worker-123", "89618928cajff", disruption_start)
    assert res["present"] is True
    assert res["ping_count"] == 3
    assert res["zone_hop_flag"] is False


@patch("backend.services.pop_validator.supabase")
def test_validate_pop_worker_below_threshold(mock_supabase):
    """Worker has 2 pings in the disrupted hex → present=False"""
    disruption_start = datetime.now(timezone.utc)
    mock_supabase.table.return_value.select.return_value.eq.return_value \
        .gte.return_value.lte.return_value.limit.return_value \
        .execute.return_value.data = [
            {"hex_id": "89618928cajff", "latitude": 13.0, "longitude": 80.0, "accuracy": 10, "pinged_at": "2025-04-12T00:00:00+00:00"},
            {"hex_id": "89618928cajff", "latitude": 13.0001, "longitude": 80.0001, "accuracy": 20, "pinged_at": "2025-04-12T00:10:00+00:00"},
        ]

    res = validate_pop("worker-123", "89618928cajff", disruption_start)
    assert res["present"] is False
    assert res["ping_count"] == 2
    assert res["zone_hop_flag"] is False


@patch("backend.services.pop_validator.supabase")
def test_validate_pop_zone_hop_detected(mock_supabase):
    """Worker has active pings but 0 in the disrupted hex → zone_hop_flag=True"""
    disruption_start = datetime.now(timezone.utc)
    mock_supabase.table.return_value.select.return_value.eq.return_value \
        .gte.return_value.lte.return_value.limit.return_value \
        .execute.return_value.data = [
            {"hex_id": "89618999ffff", "latitude": 12.0, "longitude": 79.0, "accuracy": 10, "pinged_at": "2025-04-12T00:00:00+00:00"},
            {"hex_id": "89618999ffff", "latitude": 12.0001, "longitude": 79.0001, "accuracy": 20, "pinged_at": "2025-04-12T00:10:00+00:00"},
        ]

    res = validate_pop("worker-123", "89618928cajff", disruption_start)
    assert res["present"] is False
    assert res["ping_count"] == 0
    assert res["zone_hop_flag"] is True


# =============================================================================
# ─── ACCURACY FILTER ─────────────────────────────────────────────────────────
# =============================================================================

@patch("backend.services.pop_validator.supabase")
def test_accuracy_filter_drops_noisy_pings(mock_supabase):
    """Pings with accuracy > 100m must be excluded from in-zone count."""
    disruption_start = datetime.now(timezone.utc)
    # 2 good pings + 1 noisy ping (accuracy=150) — filtered → only 2 valid → present=False
    mock_supabase.table.return_value.select.return_value.eq.return_value \
        .gte.return_value.lte.return_value.limit.return_value \
        .execute.return_value.data = [
            {"hex_id": "89618928cajff", "latitude": 13.0, "longitude": 80.0, "accuracy": 10,  "pinged_at": "2025-04-12T00:00:00+00:00"},
            {"hex_id": "89618928cajff", "latitude": 13.0001, "longitude": 80.0, "accuracy": 150, "pinged_at": "2025-04-12T00:10:00+00:00"},  # dropped
            {"hex_id": "89618928cajff", "latitude": 13.0002, "longitude": 80.0, "accuracy": 20,  "pinged_at": "2025-04-12T00:20:00+00:00"},
        ]

    res = validate_pop("worker-123", "89618928cajff", disruption_start)
    assert res["ping_count"] == 2    # 1 dropped
    assert res["present"] is False   # needs 3, only 2 quality


@patch("backend.services.pop_validator.supabase")
def test_pings_without_accuracy_field_are_accepted(mock_supabase):
    """Pings missing 'accuracy' key are treated as acceptable (backward compat)."""
    disruption_start = datetime.now(timezone.utc)
    mock_supabase.table.return_value.select.return_value.eq.return_value \
        .gte.return_value.lte.return_value.limit.return_value \
        .execute.return_value.data = [
            {"hex_id": "89618928cajff", "latitude": 13.0, "longitude": 80.0, "pinged_at": "2025-04-12T00:00:00+00:00"},
            {"hex_id": "89618928cajff", "latitude": 13.0001, "longitude": 80.0, "pinged_at": "2025-04-12T00:10:00+00:00"},
            {"hex_id": "89618928cajff", "latitude": 13.0002, "longitude": 80.0, "pinged_at": "2025-04-12T00:20:00+00:00"},
        ]

    res = validate_pop("worker-123", "89618928cajff", disruption_start)
    assert res["ping_count"] == 3
    assert res["present"] is True


# =============================================================================
# ─── _safe_result / DB FAILURE ───────────────────────────────────────────────
# =============================================================================

def test_safe_result_has_all_required_keys():
    """_safe_result() must include every key callers may access."""
    r = _safe_result()
    for key in ("present", "ping_count", "zone_hop_flag",
                "time_span_flag", "velocity_flag", "static_device_flag"):
        assert key in r
    assert r["present"] is False
    assert r["ping_count"] == 0


@patch("backend.services.pop_validator.supabase")
@patch("backend.services.pop_validator.time")  # stop real sleep in tests
def test_db_failure_returns_safe_default(mock_time, mock_supabase):
    """Total DB failure after retries must return present=False safe default."""
    mock_time.sleep = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value \
        .gte.return_value.lte.return_value.limit.return_value \
        .execute.side_effect = Exception("DB connection refused")

    disruption_start = datetime.now(timezone.utc)
    res = validate_pop("worker-x", "hex-y", disruption_start)

    assert res["present"] is False
    assert res["ping_count"] == 0


# =============================================================================
# ─── _check_time_span ────────────────────────────────────────────────────────
# =============================================================================

def test_check_time_span_detects_burst():
    """All pings within 2 minutes → suspicious."""
    base = datetime(2025, 4, 12, 10, 0, 0, tzinfo=timezone.utc)
    pings = [
        {"pinged_at": base.isoformat()},
        {"pinged_at": (base + timedelta(seconds=60)).isoformat()},
        {"pinged_at": (base + timedelta(seconds=120)).isoformat()},
    ]
    assert _check_time_span(pings) is True


def test_check_time_span_ok_when_spread():
    """Pings spread over 20 minutes → not suspicious."""
    base = datetime(2025, 4, 12, 10, 0, 0, tzinfo=timezone.utc)
    pings = [
        {"pinged_at": base.isoformat()},
        {"pinged_at": (base + timedelta(minutes=10)).isoformat()},
        {"pinged_at": (base + timedelta(minutes=20)).isoformat()},
    ]
    assert _check_time_span(pings) is False


def test_check_time_span_single_ping():
    """Single ping → cannot determine span → not flagged."""
    assert _check_time_span([{"pinged_at": "2025-04-12T10:00:00+00:00"}]) is False


# =============================================================================
# ─── _check_velocity ─────────────────────────────────────────────────────────
# =============================================================================

def test_check_velocity_detects_impossible_speed():
    """10 km in 2 minutes = 300 km/h → velocity flag."""
    base = datetime(2025, 4, 12, 10, 0, 0, tzinfo=timezone.utc)
    # ~10 km apart (roughly 0.09 degrees latitude ≈ 10 km)
    pings = [
        {"pinged_at": base.isoformat(), "latitude": 13.0, "longitude": 80.0},
        {"pinged_at": (base + timedelta(minutes=2)).isoformat(), "latitude": 13.09, "longitude": 80.0},
    ]
    assert _check_velocity(pings) is True


def test_check_velocity_ok_for_walking_speed():
    """1 km in 10 minutes = 6 km/h → no flag."""
    base = datetime(2025, 4, 12, 10, 0, 0, tzinfo=timezone.utc)
    # ~1 km apart
    pings = [
        {"pinged_at": base.isoformat(), "latitude": 13.0, "longitude": 80.0},
        {"pinged_at": (base + timedelta(minutes=10)).isoformat(), "latitude": 13.009, "longitude": 80.0},
    ]
    assert _check_velocity(pings) is False


# =============================================================================
# ─── _check_static_device ────────────────────────────────────────────────────
# =============================================================================

def test_check_static_device_detects_identical_coords():
    """All pings at exactly the same coordinate → static device."""
    pings = [
        {"latitude": 13.0, "longitude": 80.0},
        {"latitude": 13.0, "longitude": 80.0},
        {"latitude": 13.0, "longitude": 80.0},
    ]
    assert _check_static_device(pings) is True


def test_check_static_device_ok_with_natural_drift():
    """Natural GPS drift → not flagged."""
    pings = [
        {"latitude": 13.0000, "longitude": 80.0000},
        {"latitude": 13.0001, "longitude": 80.0001},
        {"latitude": 13.0002, "longitude": 80.0002},
    ]
    assert _check_static_device(pings) is False


def test_check_static_device_single_ping():
    """Single ping → cannot compare → not flagged."""
    assert _check_static_device([{"latitude": 13.0, "longitude": 80.0}]) is False


# =============================================================================
# ─── _haversine_km ───────────────────────────────────────────────────────────
# =============================================================================

def test_haversine_same_point():
    assert _haversine_km(13.0, 80.0, 13.0, 80.0) == pytest.approx(0.0, abs=1e-6)


def test_haversine_known_distance():
    """Chennai ↔ ~1 degree north: expect ~111 km."""
    dist = _haversine_km(13.0, 80.0, 14.0, 80.0)
    assert 108 < dist < 114


# =============================================================================
# ─── RESULT SHAPE ALWAYS COMPLETE ────────────────────────────────────────────
# =============================================================================

@patch("backend.services.pop_validator.supabase")
def test_result_always_has_all_keys(mock_supabase):
    """validate_pop must always return all 6 keys regardless of which path is taken."""
    disruption_start = datetime.now(timezone.utc)
    mock_supabase.table.return_value.select.return_value.eq.return_value \
        .gte.return_value.lte.return_value.limit.return_value \
        .execute.return_value.data = []  # no pings at all

    res = validate_pop("w", "h", disruption_start)
    for key in ("present", "ping_count", "zone_hop_flag",
                "time_span_flag", "velocity_flag", "static_device_flag"):
        assert key in res, f"Missing key: {key}"
