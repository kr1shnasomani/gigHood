import os
import logging
import json
import time
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from backend.config import settings

logger = logging.getLogger("api")

# Try importing firebase_admin, allow degraded mode
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("firebase_admin not installed. Notifications will be mocked.")

class NotificationService:
    def __init__(self):
        self.enabled = False
        self._admin_events = deque(maxlen=200)

        if not settings.ENABLE_PUSH_NOTIFICATIONS:
            logger.info("Push notifications disabled via ENABLE_PUSH_NOTIFICATIONS=false.")
            return
        
        if FIREBASE_AVAILABLE:
            cred_path = (settings.FIREBASE_CREDENTIALS_PATH or os.getenv("FIREBASE_CREDENTIALS_PATH", "")).strip()
            cred_json = (settings.FIREBASE_CREDENTIALS_JSON or os.getenv("FIREBASE_CREDENTIALS_JSON", "")).strip()
            if cred_path and os.path.exists(cred_path):
                try:
                    # Check if already initialized
                    if not firebase_admin._apps:
                        cred = credentials.Certificate(cred_path)
                        firebase_admin.initialize_app(cred)
                    self.enabled = True
                    logger.info("Firebase Cloud Messaging initialized successfully.")
                except Exception as e:
                    logger.error(f"Failed to initialize Firebase: {e}")
            elif cred_json:
                try:
                    if not firebase_admin._apps:
                        cred = credentials.Certificate(json.loads(cred_json))
                        firebase_admin.initialize_app(cred)
                    self.enabled = True
                    logger.info("Firebase Cloud Messaging initialized successfully via JSON env.")
                except Exception as e:
                    logger.error(f"Failed to initialize Firebase from FIREBASE_CREDENTIALS_JSON: {e}")
            else:
                logger.warning(
                    "Push notifications enabled but Firebase credentials are missing. "
                    "Set FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON."
                )
    
    def send_push(self, device_token: str, title: str, body: str, data: Optional[Dict[str, str]] = None, priority: str = "normal") -> bool:
        """
        Pushes an FCM notification strictly targeting a single worker device.
        """
        if not device_token or len(device_token) < 20:
            logger.info(f"Skipping push: No valid device_token provided for '{title}'")
            return False
            
        data = data or {}
        
        if self.enabled:
            for attempt, delay in enumerate([0, 0.5, 1.0, 2.0]):
                if delay > 0:
                    time.sleep(delay)
                try:
                    kwargs = {
                        "notification": messaging.Notification(
                            title=title,
                            body=body
                        ),
                        "data": data,
                        "token": device_token
                    }
                    if priority == "high":
                        kwargs["android"] = messaging.AndroidConfig(priority="high")
                        kwargs["apns"] = messaging.APNSConfig(payload=messaging.APNSPayload(aps=messaging.Aps(content_available=True)))
                        
                    message = messaging.Message(**kwargs)
                    response = messaging.send(message)
                    logger.info(f"FCM Push successful: {response}")
                    return True
                except Exception as e:
                    logger.error(f"FCM Push failed (attempt {attempt+1}): {e}")
            return False
        else:
            # Mock mode tracing
            logger.info(f"[MOCK FCM] To {device_token[:8]}... | Title: {title} | Body: {body}")
            return True

    def send_bulk_push(self, tokens: list[str], title: str, body: str) -> dict:
        valid_tokens = [t for t in tokens if t and len(t) >= 20]
        if not valid_tokens:
            return {"sent": 0, "failed": 0, "total": 0}
        
        sent = 0
        failed = 0
        for t in valid_tokens:
            if self.send_push(t, title, body):
                sent += 1
            else:
                failed += 1
        return {"sent": sent, "failed": failed, "total": len(valid_tokens)}

    async def async_send_push(self, device_token: str, title: str, body: str) -> bool:
        import asyncio
        return await asyncio.to_thread(self.send_push, device_token, title, body)
        
    async def async_send_bulk_push(self, tokens: list[str], title: str, body: str) -> dict:
        import asyncio
        return await asyncio.to_thread(self.send_bulk_push, tokens, title, body)

    # ---------- 5 BOUNDED NOTIFICATION TEMPLATES ----------
    
    def notify_payout_credited(self, device_token: str, amount: float, tier: str) -> bool:
        return self.send_push(
            device_token,
            title="Fast-Track Payout Sent \ud83d\udcb8",
            body=f"Your {tier} tier coverage payout of ₹{amount} has been securely routed via UPI.",
            data={"type": "PAYOUT_CREDIT", "amount": str(amount)}
        )
        
    def notify_elevated_watch(self, device_token: str, hex_id: str, severity: str) -> bool:
        return self.send_push(
            device_token,
            title="DCI Alert: Elevated Watch \u26a0\ufe0f",
            body=f"Disruptions detected in your Zone ({hex_id}). Stay online, coverage may trigger soon.",
            data={"type": "ELEVATED_WATCH", "status": severity}
        )
        
    def notify_claim_flagged(self, device_token: str) -> bool:
        return self.send_push(
            device_token,
            title="Review Required \ud83d\udee1\ufe0f",
            body="Your recent zone claim requires verification. Support will reach out shortly.",
            data={"type": "CLAIM_FLAGGED"}
        )
        
    def notify_degraded_mode(self, device_token: str) -> bool:
        return self.send_push(
            device_token,
            title="Degraded Monitoring Mode",
            body="gigHood is monitoring your zone with reduced signal coverage. Coverage remains active.",
            data={"type": "DEGRADED_MODE"}
        )

    def log_admin_alert(self, message: str) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        self._admin_events.appendleft(f"[{ts}] {message}")

    def list_admin_alerts(self, limit: int = 25) -> list[str]:
        return list(self._admin_events)[:max(1, limit)]
        
    def notify_tier_upgrade(self, device_token: str, old_tier: str, new_tier: str) -> bool:
        return self.send_push(
            device_token,
            title="Premium Eligibility \u2b50",
            body=f"Your risk profile decreased! You are now eligible to upgrade from Tier {old_tier} to Tier {new_tier}.",
            data={"type": "TIER_UPGRADE", "tier": new_tier}
        )

# Global singleton
notification_service = NotificationService()

async def send_claim_notification(device_token: str, claim_id: str, tier: str, amount: float):
    return await notification_service.async_send_push(
        device_token, 
        "Claim Fast-Tracked", 
        f"Your {tier} claim {claim_id} for ₹{amount} has been approved."
    )

async def send_elevated_watch_alert(tokens: list[str], hex_id: str, risk_score: float):
    return await notification_service.async_send_bulk_push(
        tokens, 
        "Elevated Watch", 
        f"Zone {hex_id} is at {risk_score} risk."
    )
