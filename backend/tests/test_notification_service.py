"""
Tests for backend/services/notification_service.py (production-grade upgrade)

Original 2 tests preserved with adjustments:
  - test_notification_service_mock_degraded_path: unchanged (still works)
  - test_notification_templates: token "device-1" is 8 chars < 20 threshold,
    updated to use a long token so validation passes

New tests cover:
  - Token validation (< 20 chars rejected)
  - Mock mode graceful return (present=True without Firebase)
  - Retry logic (retry on FCM exception, success on 2nd attempt)
  - Timeout handling (asyncio.TimeoutError → retry → final failure)
  - Async send_push (non-blocking path)
  - Bulk send (send_bulk_push result shape, invalid tokens filtered)
  - Module-level async functions exist and are callable
  - All template methods resolve with valid tokens
  - Priority=high propagates to message builder
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, call, patch

from backend.services.notification_service import (
    NotificationService,
    send_claim_notification,
    send_elevated_watch_alert,
    notification_service,
)

# ── Fixture: long valid token (>= 20 chars) ──────────────────────────────────
VALID_TOKEN = "device_token_abc123456789xyz"   # 28 chars
SHORT_TOKEN = "short"                          # 5 chars — should be rejected


# =============================================================================
# ─── ORIGINAL TESTS (adjusted tokens where needed) ───────────────────────────
# =============================================================================

def test_notification_service_mock_degraded_path():
    """
    Firebase disabled → mock mode → send_push returns True for any valid token.
    """
    svc = NotificationService()
    svc.enabled = False
    res = svc.send_push(VALID_TOKEN, "Title", "Body", {})
    assert res is True


@patch("backend.services.notification_service.messaging")
def test_notification_templates(mock_messaging):
    """
    Template methods produce correctly structured FCM messages.
    """
    svc = NotificationService()
    svc.enabled = True

    # notify_payout_credited
    res1 = svc.notify_payout_credited(VALID_TOKEN, 450.0, "A")
    assert res1 is True

    msg_args   = mock_messaging.Message.call_args[1]
    notif_args = mock_messaging.Notification.call_args[1]
    assert msg_args["token"] == VALID_TOKEN
    assert "Fast-Track" in notif_args["title"]
    assert "₹450.0" in notif_args["body"]
    assert msg_args["data"]["type"] == "PAYOUT_CREDIT"

    # notify_elevated_watch
    res2 = svc.notify_elevated_watch(VALID_TOKEN, "89283082803ffff", "disrupted")
    assert res2 is True

    # notify_claim_flagged
    res3 = svc.notify_claim_flagged(VALID_TOKEN)
    assert res3 is True


# =============================================================================
# ─── TOKEN VALIDATION ─────────────────────────────────────────────────────────
# =============================================================================

def test_send_push_rejects_short_token():
    """Tokens shorter than 20 characters must return False immediately."""
    svc = NotificationService()
    svc.enabled = False   # mock mode, but token check fires first
    res = svc.send_push(SHORT_TOKEN, "Title", "Body")
    assert res is False


def test_send_push_rejects_empty_token():
    svc = NotificationService()
    svc.enabled = False
    res = svc.send_push("", "Title", "Body")
    assert res is False


def test_send_push_rejects_none_token():
    svc = NotificationService()
    svc.enabled = False
    res = svc.send_push(None, "Title", "Body")  # type: ignore[arg-type]
    assert res is False


# =============================================================================
# ─── SYNC SEND RETRY ──────────────────────────────────────────────────────────
# =============================================================================

@patch("backend.services.notification_service.messaging")
@patch("backend.services.notification_service.time")
def test_send_push_succeeds_on_second_attempt(mock_time, mock_messaging):
    """
    First FCM call raises, second succeeds → returns True, sleep called once.
    The retry loop is [delay=0, 0.5, 1.0, 2.0]; first retry fires sleep(0.5).
    """
    mock_time.sleep = MagicMock()
    mock_messaging.send.side_effect = [
        Exception("FCM transient error"),  # attempt 1 (delay=0)
        "projects/x/messages/abc",         # attempt 2 (after sleep 0.5)
    ]

    svc = NotificationService()
    svc.enabled = True

    res = svc.send_push(VALID_TOKEN, "Test", "Body")
    assert res is True
    assert mock_messaging.send.call_count == 2
    mock_time.sleep.assert_called_once_with(0.5)   # first retry delay


@patch("backend.services.notification_service.messaging")
@patch("backend.services.notification_service.time")
def test_send_push_fails_after_all_retries(mock_time, mock_messaging):
    """
    All 4 attempts raise → returns False.
    Retry loop = [0, 0.5, 1.0, 2.0] → 4 send() calls, sleep called 3 times.
    """
    mock_time.sleep = MagicMock()
    mock_messaging.send.side_effect = Exception("Persistent FCM error")

    svc = NotificationService()
    svc.enabled = True

    res = svc.send_push(VALID_TOKEN, "Test", "Body")
    assert res is False
    # 1 original + 3 retries = 4 total send calls
    assert mock_messaging.send.call_count == 4
    # sleep called for each retry: 0.5, 1.0, 2.0
    assert mock_time.sleep.call_count == 3


# =============================================================================
# ─── ASYNC SEND ───────────────────────────────────────────────────────────────
# =============================================================================

@pytest.mark.asyncio
async def test_async_send_push_mock_mode():
    """async_send_push in mock mode (enabled=False) returns True without FCM."""
    svc = NotificationService()
    svc.enabled = False
    res = await svc.async_send_push(VALID_TOKEN, "Title", "Body")
    assert res is True


@pytest.mark.asyncio
@patch("backend.services.notification_service.messaging")
async def test_async_send_push_success(mock_messaging):
    """async_send_push wraps messaging.send in asyncio.to_thread and returns True."""
    mock_messaging.send.return_value = "projects/x/messages/ok"

    svc = NotificationService()
    svc.enabled = True

    res = await svc.async_send_push(VALID_TOKEN, "Title", "Body")
    assert res is True
    mock_messaging.send.assert_called_once()


@pytest.mark.asyncio
async def test_async_send_push_rejects_short_token():
    """async_send_push must reject short tokens, return False."""
    svc = NotificationService()
    svc.enabled = False
    res = await svc.async_send_push(SHORT_TOKEN, "Title", "Body")
    assert res is False


# =============================================================================
# ─── BULK SEND ────────────────────────────────────────────────────────────────
# =============================================================================

def test_send_bulk_push_mock_mode():
    """Bulk send in mock mode returns correct count with no invalid tokens sent."""
    svc = NotificationService()
    svc.enabled = False
    tokens = [VALID_TOKEN, VALID_TOKEN + "_2"]
    result = svc.send_bulk_push(tokens, "Alert", "Disruption zone active")
    assert result["sent"] == 2
    assert result["failed"] == 0
    assert result["total"] == 2


def test_send_bulk_push_filters_short_tokens():
    """Invalid tokens (shorter than 20 chars) are silently excluded before batch send."""
    svc = NotificationService()
    svc.enabled = False
    tokens = [VALID_TOKEN, SHORT_TOKEN, "x"]  # 2 invalid
    result = svc.send_bulk_push(tokens, "Alert", "Body")
    assert result["total"] == 1    # only valid token counted
    assert result["sent"] == 1


@pytest.mark.asyncio
async def test_async_send_bulk_push_mock_mode():
    """async_send_bulk_push delegates to send_bulk_push in thread pool."""
    svc = NotificationService()
    svc.enabled = False
    tokens = [VALID_TOKEN, VALID_TOKEN + "_2"]
    result = await svc.async_send_bulk_push(tokens, "Alert", "Body")
    assert result["sent"] == 2
    assert result["total"] == 2


# =============================================================================
# ─── PRIORITY SUPPORT ─────────────────────────────────────────────────────────
# =============================================================================

@patch("backend.services.notification_service.messaging")
def test_high_priority_adds_android_config(mock_messaging):
    """priority='high' must set AndroidConfig and APNSConfig on the message."""
    svc = NotificationService()
    svc.enabled = True

    svc.send_push(VALID_TOKEN, "Urgent", "Body", priority="high")

    msg_kwargs = mock_messaging.Message.call_args[1]
    # android and apns kwargs should be set (not None)
    assert mock_messaging.AndroidConfig.called
    assert mock_messaging.APNSConfig.called


# =============================================================================
# ─── MODULE-LEVEL ASYNC FUNCTIONS ────────────────────────────────────────────
# =============================================================================

@pytest.mark.asyncio
async def test_send_claim_notification_callable():
    """send_claim_notification must be an async function that completes."""
    # Use mock mode — no real FCM
    notification_service.enabled = False
    # Should not raise
    await send_claim_notification(VALID_TOKEN, "clm_abc123", "FAST_TRACK", 50000)
    notification_service.enabled = False   # restore


@pytest.mark.asyncio
async def test_send_elevated_watch_alert_callable():
    """send_elevated_watch_alert must accept a list of tokens and complete."""
    notification_service.enabled = False
    await send_elevated_watch_alert([VALID_TOKEN], "hex_abc", 0.72)


# =============================================================================
# ─── TEMPLATE METHODS WORK WITH VALID TOKENS ─────────────────────────────────
# =============================================================================

def test_all_template_methods_mock_mode():
    """All 5 template methods must return True in mock mode with a valid token."""
    svc = NotificationService()
    svc.enabled = False

    assert svc.notify_payout_credited(VALID_TOKEN, 500.0, "B") is True
    assert svc.notify_elevated_watch(VALID_TOKEN, "hex_abc123", "elevated") is True
    assert svc.notify_claim_flagged(VALID_TOKEN) is True
    assert svc.notify_degraded_mode(VALID_TOKEN) is True
    assert svc.notify_tier_upgrade(VALID_TOKEN, "C", "B") is True
