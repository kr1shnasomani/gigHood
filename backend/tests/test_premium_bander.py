import pytest
from backend.services.premium_bander import calculate_premium

def test_tier_A_non_monsoon_low_dci():
    """Tier A, avg DCI 0.35, non-monsoon -> ₹20"""
    premium = calculate_premium(tier='A', avg_dci_4w=0.35, month=3) # March
    assert premium == 20.0

def test_tier_A_monsoon_low_dci():
    """Tier A, avg DCI 0.35, monsoon -> 20 * 1.4 = 28"""
    premium = calculate_premium(tier='A', avg_dci_4w=0.35, month=7) # July
    assert premium == 28.0

def test_tier_C_monsoon_high_dci():
    """Tier C, avg DCI 0.85, monsoon -> capped to ₹50 per rubric."""
    premium = calculate_premium(tier='C', avg_dci_4w=0.85, month=8) # August
    assert premium == 50.0
