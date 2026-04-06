from datetime import datetime, timedelta, timezone
from typing import Optional
import logging
from backend.db.client import supabase
from backend.services.pop_validator import validate_pop
from backend.services.payout_calculator import calculate_payout
from backend.services.payment_service import initiate_upi_payout

logger = logging.getLogger("api")


def _normalize_city_token(city: str | None) -> str:
    if not city:
        return ""
    lowered = city.strip().lower()
    return "".join(ch for ch in lowered if ch.isalnum())


def is_city_compatible(worker_city: str | None, zone_city: str | None) -> bool:
    """
    City compatibility for claim guardrails.
    Includes Chennai outskirts aliases used by workers in metro periphery.
    """
    w = _normalize_city_token(worker_city)
    z = _normalize_city_token(zone_city)
    if not w or not z:
        return False
    if w == z:
        return True

    chennai_metro_aliases = {
        "chennai",
        "potheri",
        "kattankulathur",
    }
    return w in chennai_metro_aliases and z in chennai_metro_aliases


def evaluate_location_guardrails(worker_id: str, event_id: str, disruption_start: datetime) -> tuple[bool, str | None, int]:
    """
    Enforce hard location guardrails before any payout path is considered.
    Returns (allowed, reason_code, in_zone_ping_count).
    """
    try:
        event_res = supabase.table('disruption_events').select('hex_id').eq('id', event_id).limit(1).execute()
        if not event_res.data:
            return False, 'EVENT_NOT_FOUND', 0
        event_hex = event_res.data[0].get('hex_id')

        worker_city = None
        worker_res = supabase.table('workers').select('city').eq('id', worker_id).limit(1).execute()
        if worker_res.data:
            worker_city = worker_res.data[0].get('city')

        zone_city = None
        for col in ('h3_index', 'hex_id'):
            try:
                z = supabase.table('hex_zones').select('city').eq(col, event_hex).limit(1).execute()
                if z.data:
                    zone_city = z.data[0].get('city')
                    break
            except Exception:
                continue

        if worker_city and zone_city and not is_city_compatible(worker_city, zone_city):
            return False, 'CITY_ZONE_MISMATCH', 0

        window_start = disruption_start - timedelta(minutes=90)
        pings_res = (
            supabase.table('location_pings')
            .select('hex_id')
            .eq('worker_id', worker_id)
            .gte('pinged_at', window_start.isoformat())
            .lte('pinged_at', disruption_start.isoformat())
            .execute()
        )
        all_pings = pings_res.data or []
        if not all_pings:
            return False, 'LOCATION_SERVICE_OFF', 0

        in_zone = [p for p in all_pings if p.get('hex_id') == event_hex]
        if len(in_zone) == 0:
            return False, 'OUT_OF_ZONE', 0
        if len(in_zone) < 3:
            return False, 'INSUFFICIENT_IN_ZONE_PINGS', len(in_zone)

        return True, None, len(in_zone)
    except Exception:
        return False, 'LOCATION_VALIDATION_ERROR', 0

def route_claim(fraud_score: int, gate2_result: str, flags: Optional[list[str]] = None) -> str:
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


def explain_claim_decision(
    fraud_score: int,
    gate2_result: str,
    path: str,
    pop_validated: Optional[bool] = None,
    flags: Optional[list[str]] = None,
    reason_code: Optional[str] = None,
) -> dict:
    flags = flags or []

    if reason_code == "CITY_ZONE_MISMATCH":
        return {
            "code": "CITY_ZONE_MISMATCH",
            "title": "City and disruption zone do not match",
            "message": "This claim was denied because the disruption zone city does not match your registered worker city.",
            "worker_tip": "Update your profile city and location pings to the city where you currently work.",
        }

    if reason_code == "LOCATION_SERVICE_OFF":
        return {
            "code": "LOCATION_SERVICE_OFF",
            "title": "Location service evidence is missing",
            "message": "Your claim was denied because no location pings were found in the disruption window.",
            "worker_tip": "Keep location service enabled and keep the app active during your shift.",
        }

    if reason_code == "OUT_OF_ZONE":
        return {
            "code": "OUT_OF_ZONE",
            "title": "Current location did not match disruption zone",
            "message": "Your claim was denied because your recent pings were outside the disrupted zone.",
            "worker_tip": "Move into your registered work zone and keep location tracking on.",
        }

    if reason_code == "INSUFFICIENT_IN_ZONE_PINGS":
        return {
            "code": "INSUFFICIENT_IN_ZONE_PINGS",
            "title": "Not enough in-zone location evidence",
            "message": "Your claim was denied because fewer than 3 in-zone pings were recorded in the disruption window.",
            "worker_tip": "Stay active in-zone longer so the app can record enough telemetry.",
        }

    if pop_validated is False:
        return {
            "code": "POP_FAILED",
            "title": "Presence check failed",
            "message": "We could not verify that you were in the disrupted zone during the event window.",
            "worker_tip": "Keep location on and ensure your app records pings in your delivery zone.",
        }

    if path == 'denied':
        if gate2_result == 'NONE':
            return {
                "code": "NO_PARTNER_ACTIVITY",
                "title": "Partner activity could not be verified",
                "message": "The system did not find sufficient delivery activity evidence for this disruption window. This denial is not based on your city.",
                "worker_tip": "Wait for live deliveries and location pings before reattempting during an active disruption.",
            }
        if fraud_score >= 90:
            return {
                "code": "HIGH_FRAUD_RISK",
                "title": "Claim risk score was too high",
                "message": "Your claim crossed the denial risk threshold based on fraud checks.",
                "worker_tip": "Avoid mock locations, ensure consistent movement, and keep partner activity valid.",
            }

    if path == 'active_verify':
        return {
            "code": "ACTIVE_REVIEW",
            "title": "Additional review required",
            "message": "Your claim is valid enough to continue, but risk signals require manual/extended verification.",
            "worker_tip": "No action needed now. We will update once verification completes.",
        }

    if path == 'soft_queue':
        return {
            "code": "STANDARD_QUEUE",
            "title": "Queued for standard settlement",
            "message": "Your claim entered standard processing due to moderate risk checks.",
            "worker_tip": "This is normal and usually resolves after queue processing.",
        }

    return {
        "code": "FAST_TRACK",
        "title": "Fast-track approved",
        "message": "Your claim passed all automated checks based on your registered zone and verified in-zone telemetry.",
        "worker_tip": "Keep your UPI active to avoid payout delays.",
    }

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
        
        if rzp_res.get('status') in {'processing', 'processed'}:
            # Razorpay accepted the idempotent push
            # Updating Database
            try:
                supabase.table('claims').update({
                    'payout_amount': payout_rupees,
                    'razorpay_payment_id': rzp_res.get('id'),
                    'payout_transaction_id': rzp_res.get('transaction_id') or rzp_res.get('id'),
                    'payout_channel': rzp_res.get('channel', 'UPI'),
                    'status': 'paid',  # Ideally this waits for the webhook, but specs say we can set directly or via webhook.
                    'resolved_at': datetime.now(timezone.utc).isoformat()
                }).eq('id', claim_id).execute()
            except Exception:
                supabase.table('claims').update({
                    'payout_amount': payout_rupees,
                    'razorpay_payment_id': rzp_res.get('id'),
                    'status': 'paid',
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

         # Compute fraud context early so denied outcomes still expose meaningful risk values.
         from backend.services.fraud_engine import FraudEvaluator
         evaluator = FraudEvaluator()
         fraud_res = evaluator.evaluate(worker_id, event_id, disruption_start)
         fraud_score = int(fraud_res.get('fraud_score', 0))
         gate2_result = fraud_res.get('gate2_result', 'NONE')
         flags = fraud_res.get('flags', [])

         # Hard guardrails: deny claims when location service evidence is missing,
         # out-of-zone, insufficient, or city/zone mismatch.
         allowed, reason_code, in_zone_count = evaluate_location_guardrails(worker_id, event_id, disruption_start)
         if not allowed:
             supabase.table('claims').update({
                 'status': 'denied',
                 'resolution_path': 'denied',
                 'payout_amount': 0,
                 'fraud_score': fraud_score,
                 'pop_validated': False,
                 'resolved_at': datetime.now(timezone.utc).isoformat(),
             }).eq('id', claim_id).execute()
             return {"path": "denied", "reason_code": reason_code}
         
         # Write disruption_hours directly to claim to allow calculation bounds
         supabase.table('claims').update({'disrupted_hours': duration_hours}).eq('id', claim_id).execute()
         
         # 1. PoP Validation (secondary consistency check)
         pop_result = validate_pop(worker_id, hex_id, disruption_start)
         if not pop_result['present']:
              logger.info(f"Claim {claim_id} denied after secondary PoP check.")
              supabase.table('claims').update({
                  'pop_validated': False,
                  'fraud_score': fraud_score,
                  'status': 'denied',
                  'resolution_path': 'denied',
                  'resolved_at': datetime.now(timezone.utc).isoformat()
              }).eq('id', claim_id).execute()
              return {"path": "denied", "reason_code": "INSUFFICIENT_IN_ZONE_PINGS"}

         # 2. Fraud Engine (Phase 11 7-Layer Defense)
         
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
         try:
             # Keep claim visible and scored even if processing fails mid-flight.
             claim_res = supabase.table('claims').select('id,status').eq('worker_id', worker_id).eq('event_id', event_id).limit(1).execute()
             if claim_res.data:
                 claim_id = claim_res.data[0]['id']
                 supabase.table('claims').update({
                     'fraud_score': 30,
                     'resolution_path': 'soft_queue',
                     'status': 'pending',
                 }).eq('id', claim_id).execute()
         except Exception as recovery_error:
             logger.error(f"Claim recovery write failed for {worker_id}/{event_id}: {recovery_error}")
         return {}
