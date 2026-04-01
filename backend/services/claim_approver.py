from datetime import datetime, timezone
import logging
from backend.db.client import supabase
from backend.services.pop_validator import validate_pop
from backend.services.payout_calculator import calculate_payout
from backend.services.payment_service import initiate_upi_payout

logger = logging.getLogger("api")

def route_claim(fraud_score: int, gate2_result: str, flags: list[str] | None = None) -> str:
    """
    Standard 4-path routing constraint map determining financial limits.
    Rules defined in the documented claim-routing contract and current tests.
    """
    flags = flags or []
    fast_track_block_flags = {
        'MODEL_CONCENTRATION',
    }

    # Gate2 NONE is an immediate deny irrespective of score.
    if gate2_result == 'NONE':
        return 'denied'

    # Very high fraud score is denied regardless of gate strength.
    if fraud_score >= 90:
        return 'denied'

    # Fast-track is allowed for low-risk STRONG claims with no blocking flags.
    if fraud_score < 30 and gate2_result == 'STRONG' and not any(f in fast_track_block_flags for f in flags):
        return 'fast_track'

    # High-risk but not denied goes to active verification.
    if fraud_score >= 70:
        return 'active_verify'

    return 'soft_queue'

def execute_fast_track_payout(claim_id: str, worker_id: str):
    """
    Only executed on Path 1 (Fast Track). Pushes funds autonomously into Razorpay.
    """
    # 1. Fetch exactly necessary policy constraints
    # Need avg_earnings, disrupted_hrs, tier, upi_id
    try:
        # Join-like cascade through application 
        claim_res = supabase.table('claims').select('disrupted_hours, policy_id, event_id').eq('id', claim_id).execute()
        if not claim_res.data:
            return
            
        claim = claim_res.data[0]
        disrupted_hrs = claim.get('disrupted_hours') or 4.0 # generic mock fallback
        
        pol_res = supabase.table('policies').select('tier').eq('id', claim['policy_id']).execute()
        tier = pol_res.data[0]['tier'] if pol_res.data else 'B'
        
        worker_res = supabase.table('workers').select('avg_daily_earnings, upi_id, device_token').eq('id', worker_id).execute()
        if not worker_res.data:
             return
             
        worker = worker_res.data[0]
        earnings = worker.get('avg_daily_earnings', 500.0)
        upi = worker.get('upi_id', 'generic@ybl')
        
        # 2. Math Math
        payout_rupees = calculate_payout(earnings, disrupted_hrs, tier, worker_id)
        
        # 3. Idempotency Mock Payment execution
        rzp_res = initiate_upi_payout(upi_id=upi, amount_rupees=payout_rupees, reference_id=claim_id)
        
        if rzp_res.get('status') == 'processing':
            # Razorpay accepted the idempotent push
            # Updating Database
            supabase.table('claims').update({
                'payout_amount': payout_rupees,
                'razorpay_payment_id': rzp_res.get('id'),
                'status': 'paid',  # Ideally this waits for the webhook, but specs say we can set directly or via webhook.
                'resolved_at': datetime.now(timezone.utc).isoformat()
            }).eq('id', claim_id).execute()
            
            logger.info(f"Fast Track Payout Completed. Claim {claim_id}. ₹{payout_rupees} sent.")
            
            # TRIGGER FCM HERE (Phase 12)
            device_token = worker.get('device_token')
            if device_token:
                from backend.services.notification_service import notification_service
                notification_service.notify_payout_credited(device_token, payout_rupees, tier)
                
    except Exception as e:
        logger.error(f"Failed cleanly executing Fast-Track payout {claim_id}: {e}")


def process_claim(worker_id: str, event_id: str, policy_id: str) -> dict:
    """
    Master orchestrated pipeline converting Trigger Disruption events into formal Claims.
    """
    # 0. Fetch the Claim ID ensuring idempotency
    try:
         claim_res = supabase.table('claims').select('id, status').eq('worker_id', worker_id).eq('event_id', event_id).execute()
         if not claim_res.data:
              logger.error(f"Cannot process missing claim for {worker_id} / {event_id}")
              return {}
              
         claim_id = claim_res.data[0]['id']
         if claim_res.data[0]['status'] != 'pending':
             logger.info(f"Claim {claim_id} is already progressing. Skipping.")
             return {"status": "skipped"}
             
         # Fetch event bounds
         event_res = supabase.table('disruption_events').select('hex_id, started_at, duration_hours').eq('id', event_id).execute()
         if not event_res.data:
             return {}
             
         event = event_res.data[0]
         hex_id = event['hex_id']
         disruption_start = datetime.fromisoformat(event['started_at'].replace("Z", "+00:00"))
         duration_hours = event.get('duration_hours', 4.0)
         
         # Write disruption_hours directly to claim to allow calculation bounds
         supabase.table('claims').update({'disrupted_hours': duration_hours}).eq('id', claim_id).execute()
         
         # 1. PoP Validation
         pop_result = validate_pop(worker_id, hex_id, disruption_start)
         
         if not pop_result['present']:
              logger.info(f"Claim {claim_id} denied. Failed Proof-of-Presence.")
              supabase.table('claims').update({
                  'pop_validated': False,
                  'status': 'denied',
                  'resolution_path': 'denied',
                  'resolved_at': datetime.now(timezone.utc).isoformat()
              }).eq('id', claim_id).execute()
              return {"path": "denied"}
              
         # 2. Fraud Engine (Phase 11 7-Layer Defense)
         from backend.services.fraud_engine import FraudEvaluator
         evaluator = FraudEvaluator()
         fraud_res = evaluator.evaluate(worker_id, event_id, disruption_start)
         
         fraud_score = fraud_res.get('fraud_score', 0)
         gate2_result = fraud_res.get('gate2_result', 'NONE')
         flags = fraud_res.get('flags', [])
         
         # 3. Rule Router
         path = route_claim(fraud_score, gate2_result, flags)
         
         supabase.table('claims').update({
             'pop_validated': True,
             'fraud_score': fraud_score,
             'resolution_path': path
         }).eq('id', claim_id).execute()
         
         # 4. Automate Execution bounds
         if path == 'fast_track':
              execute_fast_track_payout(claim_id, worker_id)
              
         return {"path": path}
         
    except Exception as e:
         logger.error(f"Error orchestrating Claim Approver for {worker_id} / {event_id}: {e}")
         return {}
