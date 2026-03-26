from fastapi import APIRouter, Request, HTTPException, Header, Depends
import logging
from backend.services.payment_service import handle_payout_webhook, process_webhook_mutation
from backend.services.auth_service import get_current_worker
from backend.db.client import supabase

logger = logging.getLogger("api")
router = APIRouter()

@router.get("")
def get_my_claims(worker: dict = Depends(get_current_worker)):
    """
    Returns authentic worker's full claim history dynamically resolving pipeline steps natively.
    """
    worker_id = worker.get("id")
    try:
        res = supabase.table('claims').select('*').eq('worker_id', worker_id).execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(None)):
    """
    Ingests state change callbacks from Razorpay asynchronously.
    Only allows legitimate signatures confirming a payout process success state.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    is_valid = handle_payout_webhook(payload, x_razorpay_signature)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
        
    process_webhook_mutation(payload)
             
    return {"status": "success"}
