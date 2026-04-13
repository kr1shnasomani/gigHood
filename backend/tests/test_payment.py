"""
Tests for backend/services/payment_service.py

Updated to match the production-grade implementation:
  - testing_bypass removed (it no longer exists in the service)
  - webhook test uses real HMAC-SHA256 signing
  - mock payout response shape verified against the new API contract
"""

import hashlib
import hmac
import json
import os
import pytest

from backend.services.payment_service import (
    initiate_upi_payout,
    handle_payout_webhook,
    _mock_payout_response,
    _validate_payout_params,
)


# =============================================================================
# initiate_upi_payout — mock fallback path (no Razorpay keys in CI)
# =============================================================================

def test_initiate_upi_payout_mock():
    """
    When Razorpay keys are absent the service must return the mock response
    that mirrors the real Razorpay Payout API schema exactly.
    """
    ref_id = "test_clm_92k4j"
    res = initiate_upi_payout("arjun@ybl", 600.0, ref_id)

    assert res["entity"]       == "payout"
    assert res["amount"]       == 60_000          # ₹600 in paise
    assert res["status"]       == "processing"
    assert res["reference_id"] == ref_id
    assert res["id"].startswith("pout_")
    assert res["currency"]     == "INR"
    assert res["channel"]      == "UPI"


def test_initiate_upi_payout_zero_amount_raises():
    """Zero-amount payouts must be rejected by the validation layer."""
    with pytest.raises(ValueError, match="Invalid amount"):
        initiate_upi_payout("worker@upi", 0.0, "clm_zero_test")


def test_initiate_upi_payout_high_fraud_score_raises():
    """Fraud score at or above the block threshold must raise ValueError."""
    with pytest.raises(ValueError, match="Fraud score"):
        initiate_upi_payout("worker@upi", 100.0, "clm_fraud_test", fraud_score=30)


def test_initiate_upi_payout_cap_exceeded_raises():
    """Payout exceeding the policy cap must be rejected."""
    with pytest.raises(ValueError, match="cap"):
        initiate_upi_payout(
            "worker@upi", 1000.0, "clm_cap_test",
            cap_paise=50_000,   # ₹500 cap
        )


# =============================================================================
# _validate_payout_params
# =============================================================================

def test_validate_payout_params_valid():
    ok, reason = _validate_payout_params(50_000, "clm_abc123")
    assert ok is True
    assert reason == "ok"


def test_validate_payout_params_zero_rejects():
    ok, reason = _validate_payout_params(0, "clm_abc123")
    assert ok is False
    assert "Invalid amount" in reason


def test_validate_payout_params_no_reference_id():
    ok, reason = _validate_payout_params(1000, "")
    assert ok is False


# =============================================================================
# _mock_payout_response
# =============================================================================

def test_mock_payout_response_shape():
    resp = _mock_payout_response(30_000, "clm_mock_x")
    assert resp["entity"]       == "payout"
    assert resp["amount"]       == 30_000
    assert resp["currency"]     == "INR"
    assert resp["status"]       == "processing"
    assert resp["reference_id"] == "clm_mock_x"
    assert resp["id"].startswith("pout_")


# =============================================================================
# handle_payout_webhook
# =============================================================================

def test_handle_payout_webhook_valid_signature():
    """
    Webhook must return True when given a correct HMAC-SHA256 signature
    over the raw body serialised with the same deterministic JSON settings.
    """
    secret  = "test_webhook_secret_xyz"
    payload = {"event": "payout.processed", "reference_id": "clm_123"}
    # Mirror the deterministic serialisation used internally
    body    = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig     = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    assert handle_payout_webhook(payload, sig, secret=secret) is True


def test_handle_payout_webhook_wrong_signature():
    """Mismatched signature must be rejected."""
    secret  = "test_webhook_secret_xyz"
    payload = {"event": "payout.processed"}
    assert handle_payout_webhook(payload, "bad_signature", secret=secret) is False


def test_handle_payout_webhook_rejects_empty():
    """Empty payload and empty signature must both return False."""
    assert handle_payout_webhook({}, "") is False


def test_handle_payout_webhook_missing_signature():
    """Missing signature header (None / empty) must be rejected immediately."""
    assert handle_payout_webhook({"event": "payout.processed"}, "") is False
    assert handle_payout_webhook({"event": "payout.processed"}, None) is False


def test_handle_payout_webhook_no_secret_configured(monkeypatch):
    """
    When RAZORPAY_WEBHOOK_SECRET is not set and no secret arg is passed,
    all webhooks must be rejected (fail-closed).
    """
    monkeypatch.delenv("RAZORPAY_WEBHOOK_SECRET", raising=False)
    payload = {"event": "payout.processed"}
    sig     = "any_sig"
    # No secret arg and no env var → should return False
    assert handle_payout_webhook(payload, sig) is False
