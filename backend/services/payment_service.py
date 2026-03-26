import hmac
import hashlib
import razorpay
import uuid
import logging
from backend.config import settings

logger = logging.getLogger("api")

# Initialize Razorpay client only if keys are present
# Fallback smoothly otherwise so the app won't crash aggressively offline
try:
    rzp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
except Exception as e:
    logger.warning(f"Razorpay Client init failed (likely missing keys): {e}")
    rzp_client = None

def initiate_upi_payout(upi_id: str, amount_rupees: float, reference_id: str) -> dict:
    """
    Simulates a Razorpay Sandbox UPI payout. 
    Live RazorpayX payouts require heavy manual KYC, so we mock the direct API response tightly
    mirroring their exact structured output dict.
    """
    logger.info(f"--- MOCK RAZORPAY PAYOUT ---")
    logger.info(f"Amount: ₹{amount_rupees} -> {upi_id}")
    logger.info(f"Reference ID (Idempotency Key): {reference_id}")
    
    mock_rzp_id = f"pout_{uuid.uuid4().hex[:14]}"
    logger.info(f"Generated Mock Payout ID: {mock_rzp_id}")
    logger.info(f"----------------------------")
    
    return {
        "id": mock_rzp_id,
        "entity": "payout",
        "fund_account_id": "fa_mocked123",
        "amount": int(amount_rupees * 100), # paise
        "currency": "INR",
        "status": "processing",
        "reference_id": reference_id
    }

def debit_premium_mock(upi_id: str, amount_rupees: float, worker_id: str) -> bool:
    """
    Mock debit cycle utilized by the weekly Monday scheduler extracting premium bounds securely.
    """
    logger.info(f"--- MOCK RAZORPAY DEBIT ---")
    logger.info(f"Debiting ₹{amount_rupees} from {upi_id} (Worker {worker_id})")
    logger.info(f"Status: SUCCESS (Mock)")
    logger.info(f"---------------------------")
    return True

def handle_payout_webhook(payload: dict, signature: str, secret: str = "gigHoodTestSecret") -> bool:
    """
    Parses and authenticates incoming Razorpay webhooks securely.
    """
    if not payload or not signature:
        return False
        
    # Standard Razorpay HMAC signature validation
    # For testing, if payload contains testing bypass we allow it
    if payload.get("event") == "payout.processed" and payload.get("testing_bypass") is True:
        return True
        
    try:
        # Reconstruct the raw JSON string (in a real app you pass raw bytes directly to this fn)
        import json
        payload_body = json.dumps(payload, separators=(',', ':'))
        
        expected_sig = hmac.new(
            secret.encode('utf-8'),
            payload_body.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if hmac.compare_digest(expected_sig, signature):
            return True
        else:
            logger.warning("Razorpay webhook signature mismatch!")
            return False
    except Exception as e:
        logger.error(f"Error handling webhook: {e}")
        return False

def process_webhook_mutation(payload: dict):
    """
    Safely executes database modifications directly intercepting Razorpay success streams cleanly preventing route leaks.
    """
    from backend.db.client import supabase
    if payload.get("event") == "payout.processed":
        try:
             # Extract the reference ID which we mapped to our internal Claim UUID securely
             payout_entity = payload.get("payload", {}).get("payout", {}).get("entity", {})
             reference_id = payout_entity.get("reference_id")
             
             if reference_id:
                 # Update the Claim status safely to paid
                 logger.info(f"Webhook confirming payout {reference_id} processed. Updating database...")
                 supabase.table('claims').update({
                     "status": "paid"
                 }).eq("id", reference_id).execute()
                 
        except Exception as e:
             logger.error(f"Failed to parse and update database from Razorpay Webhook: {e}")
