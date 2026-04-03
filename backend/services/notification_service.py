import os
import logging
import json
from typing import Dict, Any, Optional

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
        
        if FIREBASE_AVAILABLE:
            cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
            cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON", "")
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
                logger.warning(f"Firebase credentials not found at {cred_path}. Notifications disabled.")
    
    def send_push(self, device_token: str, title: str, body: str, data: Optional[Dict[str, str]] = None) -> bool:
        """
        Pushes an FCM notification strictly targeting a single worker device.
        """
        if not device_token:
            logger.info(f"Skipping push: No device_token provided for '{title}'")
            return False
            
        data = data or {}
        
        if self.enabled:
            try:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=title,
                        body=body
                    ),
                    data=data,
                    token=device_token
                )
                response = messaging.send(message)
                logger.info(f"FCM Push successful: {response}")
                return True
            except Exception as e:
                logger.error(f"FCM Push failed: {e}")
                return False
        else:
            # Mock mode tracing
            logger.info(f"[MOCK FCM] To {device_token[:8]}... | Title: {title} | Body: {body}")
            return True

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
            title="Sensors Offline \ud83d\udce1",
            body="Some external network signals are down. Coverage operates on degraded fallback mapping.",
            data={"type": "DEGRADED_MODE"}
        )
        
    def notify_tier_upgrade(self, device_token: str, old_tier: str, new_tier: str) -> bool:
        return self.send_push(
            device_token,
            title="Premium Eligibility \u2b50",
            body=f"Your risk profile decreased! You are now eligible to upgrade from Tier {old_tier} to Tier {new_tier}.",
            data={"type": "TIER_UPGRADE", "tier": new_tier}
        )

# Global singleton
notification_service = NotificationService()
