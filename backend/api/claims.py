from fastapi import APIRouter, Request, HTTPException, Header, Depends, Response
import logging
from backend.services.payment_service import handle_payout_webhook, process_webhook_mutation
from backend.services.auth_service import get_current_worker
from backend.db.client import supabase

logger = logging.getLogger("api")
router = APIRouter()

@router.get("")
def get_my_claims(worker: dict = Depends(get_current_worker), response: Response = None):
    """
    Returns authentic worker's full claim history dynamically resolving pipeline steps natively.
    NOTE: This endpoint should redirect to /workers/me/claims in workers.py for optimized batch loading.
    """
    worker_id = worker.get("id")
    try:
        # Use specific columns instead of SELECT * (architectural guideline)
        res = supabase.table('claims').select(
            'id,policy_id,payout_amount,disrupted_hours,resolution_path,status,'
            'fraud_score,pop_validated,event_id,razorpay_payment_id,payout_transaction_id,payout_channel,created_at,resolved_at'
        ).eq('worker_id', worker_id).execute()
        
        # Add cache headers: 30s stale, 60s max-age
        if response:
            response.headers["Cache-Control"] = "public, max-age=60, s-maxage=60"
        
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(None)):
    """
    Ingests state change callbacks from Razorpay asynchronously.
    Only allows legitimate signatures confirming a payout process success state.
    
    After successfully processing, this endpoint updates the database and returns
    a cache-busting timestamp. The frontend listens to this event and invalidates
    React Query's claims cache.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    is_valid = handle_payout_webhook(payload, x_razorpay_signature)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    
    # Process the webhook mutation (updates database)
    process_webhook_mutation(payload)
    
    # Return cache-bust timestamp so frontend can invalidate React Query
    from datetime import datetime
    cache_bust_token = datetime.utcnow().isoformat()
    
    return {
        "status": "success",
        "cache_bust_token": cache_bust_token,  # Frontend listens for this to refetch claims
        "timestamp": cache_bust_token
    }
