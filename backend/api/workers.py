import hashlib
import traceback
from datetime import date, datetime, timedelta, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from backend.db.client import supabase
from backend.services.auth_service import create_jwt, get_current_worker
from backend.services.spatial import lat_lng_to_hex
from backend.services.dci_engine import get_dci_status
from backend.services.signal_fetchers import run_signal_ingestion_cycle
from backend.services.dci_engine import run_dci_cycle
from backend.services.policy_manager import create_policy, explain_policy_decision
from backend.services.trust_score import calculate_dynamic_trust
from backend.services.claim_approver import explain_claim_decision
from backend.services.claim_approver import evaluate_location_guardrails
from backend.services.payout_calculator import calculate_payout

router = APIRouter()

# --- Schemas ---
class WorkerRegisterRequest(BaseModel):
    phone: str = Field(..., max_length=15)
    name: str = Field(..., max_length=100)
    city: str = Field(..., max_length=50)
    platform_affiliation: str = Field(..., max_length=50)
    platform_id: str = Field(..., max_length=80)
    is_platform_verified: bool = False
    dark_store_zone: str = Field(..., max_length=100)
    avg_daily_earnings: float
    upi_id: str = Field(..., max_length=100)
    device_model: str = Field(..., max_length=100)
    device_os_version: str = Field(..., max_length=20)
    sim_carrier: str = Field(..., max_length=50)
    sim_registration_date: date

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

class DeviceTokenRequest(BaseModel):
    device_token: str


class CoordinatesToHexRequest(BaseModel):
    latitude: float
    longitude: float


def normalize_phone(raw_phone: str) -> str:
    """Normalize Indian phone input to a consistent +91XXXXXXXXXX format."""
    digits_only = ''.join(ch for ch in (raw_phone or '') if ch.isdigit())
    if len(digits_only) == 10:
        return f"+91{digits_only}"
    if len(digits_only) == 12 and digits_only.startswith('91'):
        return f"+{digits_only}"
    if raw_phone.startswith('+'):
        return raw_phone
    return raw_phone


def find_worker_by_phone(phone: str):
    """Lookup worker by normalized phone with fallback to raw value for legacy rows."""
    primary = normalize_phone(phone)
    res = supabase.table('workers').select('*').eq('phone', primary).execute()
    if res.data:
        return res.data[0]

    if primary != phone:
        fallback = supabase.table('workers').select('*').eq('phone', phone).execute()
        if fallback.data:
            return fallback.data[0]
    return None


def hash_dark_store_to_coords(dark_store_name: str) -> tuple[float, float]:
    """
    Deterministically hash a dark store string into valid coords within Bengaluru.
    Bengaluru bounds: Lat roughly 12.8 to 13.1, Lng roughly 77.5 to 77.8
    """
    hs = hashlib.sha256(dark_store_name.encode('utf-8')).hexdigest()
    # Take first 8 chars for lat, next 8 for lng
    lat_val = int(hs[:8], 16) / 0xFFFFFFFF
    lng_val = int(hs[8:16], 16) / 0xFFFFFFFF
    
    lat = 12.8 + (lat_val * (13.1 - 12.8))
    lng = 77.5 + (lng_val * (77.8 - 77.5))
    return lat, lng


def ensure_hex_zone_exists(hex_id: str, city: Optional[str] = None) -> None:
    # Never overwrite live DCI snapshots for existing zones.
    for where_col in ("h3_index", "hex_id"):
        try:
            existing = supabase.table('hex_zones').select(where_col).eq(where_col, hex_id).limit(1).execute()
            if existing.data:
                return
        except Exception:
            continue

    payload_base = {
        "city": city or "Unknown",
        "current_dci": 0.0,
        "dci_status": "normal",
        "active_worker_count": 0,
    }

    try:
        supabase.table('hex_zones').insert({
            **payload_base,
            "h3_index": hex_id,
        }).execute()
        return
    except Exception:
        pass

    try:
        supabase.table('hex_zones').insert({
            **payload_base,
            "hex_id": hex_id,
        }).execute()
    except Exception:
        pass


def _parse_iso_timestamp(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None

# --- Endpoints ---
@router.post("/auth/otp/send")
def send_otp(req: OTPRequest):
    # Mocking OTP sent via fake SMS gateway
    # Using deterministic mock for testing simplicity: "123456" for demo.
    print(f"Mock OTP Sent: 123456 (to {normalize_phone(req.phone)})")
    return {"message": "OTP sent successfully."}

@router.post("/auth/otp/verify")
def verify_otp(req: OTPVerify):
    # Verify mock OTP
    if req.otp != "123456":
         raise HTTPException(status_code=400, detail="Invalid OTP")
         
    # Check if user exists
    try:
        worker_row = find_worker_by_phone(req.phone)
        if not worker_row:
            raise HTTPException(status_code=404, detail="Worker not found against this phone number. Please register.")
        worker_id = worker_row['id']
        token = create_jwt(worker_id)
        return {"access_token": token, "token_type": "bearer", "worker": worker_row}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/register")
def register_worker(req: WorkerRegisterRequest):
    # Map abstract dark store string to physical PostGIS H3 index geometrically 
    lat, lng = hash_dark_store_to_coords(req.dark_store_zone)
    hex_id = lat_lng_to_hex(lat, lng)
    
    try:
        normalized_phone = normalize_phone(req.phone)

        # Prevent duplicates
        existing = find_worker_by_phone(normalized_phone)
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already registered")
            
        insert_res = supabase.table('workers').insert({
            "phone": normalized_phone,
            "name": req.name,
            "city": req.city,
            "platform_affiliation": req.platform_affiliation,
            "platform_id": req.platform_id,
            "is_platform_verified": req.is_platform_verified,
            "dark_store_zone": req.dark_store_zone,
            "hex_id": hex_id,
            "avg_daily_earnings": req.avg_daily_earnings,
            "upi_id": req.upi_id,
            "device_model": req.device_model,
            "device_os_version": req.device_os_version,
            "sim_carrier": req.sim_carrier,
            "sim_registration_date": req.sim_registration_date.isoformat(),
            "trust_score": 50,
            "status": "active"
        }).execute()
        
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to insert worker record.")
            
        worker_row = insert_res.data[0]
        worker_id = worker_row['id']
        ensure_hex_zone_exists(hex_id, req.city)
        token = create_jwt(worker_id)
        return {
            "access_token": token,
            "token_type": "bearer",
            "hex_id": hex_id,
            "worker": worker_row,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me")
def get_me(worker: dict = Depends(get_current_worker)):
    worker_id = worker.get("id")
    if not worker_id:
        return worker

    try:
        trust = calculate_dynamic_trust(worker_id)
        return {
            **worker,
            "trust_score": trust.get("score", worker.get("trust_score", 50)),
            "trust_breakdown": trust,
        }
    except Exception:
        return worker

class WorkerUpdateRequest(BaseModel):
    avg_daily_earnings: Optional[float] = None

@router.patch("/me")
def update_me(req: WorkerUpdateRequest, worker: dict = Depends(get_current_worker)):
    """
    Allows a worker to update their average daily earnings declaration.
    This is the only self-service field workers can update post-registration.
    """
    worker_id = worker.get("id")
    updates = {}
    if req.avg_daily_earnings is not None:
        if req.avg_daily_earnings <= 0:
            raise HTTPException(status_code=422, detail="avg_daily_earnings must be positive")
        updates["avg_daily_earnings"] = req.avg_daily_earnings

    if not updates:
        raise HTTPException(status_code=422, detail="No valid fields to update")

    try:
        supabase.table('workers').update(updates).eq('id', worker_id).execute()
        return {"message": "Profile updated successfully", "updated_fields": list(updates.keys())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me/policy")
def get_my_policy(worker: dict = Depends(get_current_worker)):
    worker_id = worker.get("id")
    try:
        res = supabase.table('policies').select('*').eq('worker_id', worker_id).eq('status', 'active').execute()
        active_policy = None
        if not res.data:
            # Auto-issue first policy for newly registered users so the app never hard-fails on cold start.
            created = create_policy(worker_id)
            if created:
                active_policy = created
            else:
                raise HTTPException(status_code=404, detail="No active policy found. Please onboard your risk profile.")
        else:
            active_policy = res.data[0]

        policy_explanation = explain_policy_decision(worker_id, tier=active_policy.get('tier'))
        return {
            **active_policy,
            "tier_explanation": policy_explanation,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/me/device-token")
def update_device_token(req: DeviceTokenRequest, worker: dict = Depends(get_current_worker)):
    """Maps the physical worker profile explicitly to their Firebase Cloud Messaging identity"""
    worker_id = worker.get("id")
    try:
        supabase.table('workers').update({'device_token': req.device_token}).eq('id', worker_id).execute()
        return {"message": "Device token bound securely."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/me/location/hex")
def convert_location_to_hex(req: CoordinatesToHexRequest, worker: dict = Depends(get_current_worker)):
    """
    Converts coordinates to H3 hex ID and updates worker context.
    Used by frontend location tracking flow.
    """
    worker_id = worker.get("id")
    try:
        hex_id = lat_lng_to_hex(req.latitude, req.longitude)
        if worker_id and hex_id:
            supabase.table('workers').update({'hex_id': hex_id}).eq('id', worker_id).execute()
            ensure_hex_zone_exists(hex_id, worker.get('city'))
        return {"hex_id": hex_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me/hex/dci")
def get_my_hex_dci(worker: dict = Depends(get_current_worker)):
    """
    Returns the live DCI score and status for the worker's registered hex zone.
    Used by the mobile app Home screen to power the DCI gauge widget.
    """
    hex_id = worker.get("hex_id")
    if not hex_id:
        raise HTTPException(status_code=404, detail="Worker has no hex zone assigned.")
    try:
        zone = None

        # Try common schema variants without assuming all columns exist.
        query_attempts = [
            ('h3_index,current_dci,dci_status,city,last_computed_at', 'h3_index'),
            ('hex_id,current_dci,dci_status,city,last_computed_at', 'hex_id'),
            ('h3_index,current_dci,dci_status,last_computed_at', 'h3_index'),
            ('hex_id,current_dci,dci_status,last_computed_at', 'hex_id'),
            ('current_dci,dci_status,last_computed_at', 'h3_index'),
            ('current_dci,dci_status,last_computed_at', 'hex_id'),
            ('h3_index,current_dci,dci_status,city', 'h3_index'),
            ('hex_id,current_dci,dci_status,city', 'hex_id'),
            ('current_dci,dci_status', 'h3_index'),
            ('current_dci,dci_status', 'hex_id'),
        ]
        for select_cols, where_col in query_attempts:
            try:
                res = supabase.table('hex_zones').select(select_cols).eq(where_col, hex_id).execute()
                if res.data:
                    zone = res.data[0]
                    break
            except Exception:
                continue
        if not zone:
            ensure_hex_zone_exists(hex_id, worker.get('city'))
            return {
                "hex_id": hex_id,
                "current_dci": None,
                "dci_status": "degraded",
                "city": worker.get("city"),
                "dark_store_zone": worker.get("dark_store_zone"),
                "note": "Hex zone is not seeded with live DCI yet."
            }

        # If the snapshot is stale, refresh once on-demand.
        # Do not refresh immediately when a valid snapshot exists but has no timestamp yet
        # (common right after demo simulation writes).
        last_computed = _parse_iso_timestamp(zone.get('last_computed_at'))
        stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=25)
        has_snapshot = zone.get('current_dci') is not None
        should_refresh = (last_computed is not None and last_computed < stale_cutoff) or (last_computed is None and not has_snapshot)
        if should_refresh:
            run_signal_ingestion_cycle([hex_id], city=(worker.get('city') or 'Bengaluru'))
            run_dci_cycle([hex_id])

            for select_cols, where_col in query_attempts:
                try:
                    refreshed = supabase.table('hex_zones').select(select_cols).eq(where_col, hex_id).execute()
                    if refreshed.data:
                        zone = refreshed.data[0]
                        break
                except Exception:
                    continue

        dci_raw = zone.get('current_dci')
        if dci_raw is None:
            try:
                hist = (
                    supabase.table('dci_history')
                    .select('dci_score')
                    .eq('hex_id', hex_id)
                    .order('computed_at', desc=True)
                    .limit(1)
                    .execute()
                )
                if hist.data and hist.data[0].get('dci_score') is not None:
                    dci_raw = hist.data[0].get('dci_score')
            except Exception:
                pass

        if dci_raw is None:
            return {
                "hex_id": hex_id,
                "current_dci": None,
                "dci_status": "degraded",
                "city": zone.get('city') or worker.get('city'),
                "dark_store_zone": worker.get('dark_store_zone'),
                "note": "Insufficient live signals to compute DCI right now.",
            }

        dci_val = float(dci_raw)
        return {
            "hex_id": hex_id,
            "current_dci": round(dci_val, 4),
            "dci_status": zone.get('dci_status') or get_dci_status(dci_val),
            "city": zone.get('city') or worker.get('city'),
            "dark_store_zone": worker.get('dark_store_zone'),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me/claims")
def get_my_claims(worker: dict = Depends(get_current_worker)):
    """
    Returns the authenticated worker's full claim history, ordered newest first.
    Used by the mobile app Payout History screen.
    """
    worker_id = worker.get("id")
    try:
        try:
            res = supabase.table('claims').select(
                'id,policy_id,payout_amount,disrupted_hours,resolution_path,status,'
                'fraud_score,pop_validated,event_id,razorpay_payment_id,payout_transaction_id,payout_channel,created_at,resolved_at'
            ).eq('worker_id', worker_id).order('created_at', desc=True).execute()
        except Exception:
            res = supabase.table('claims').select(
                'id,policy_id,payout_amount,disrupted_hours,resolution_path,status,'
                'fraud_score,pop_validated,event_id,razorpay_payment_id,created_at,resolved_at'
            ).eq('worker_id', worker_id).order('created_at', desc=True).execute()
        claims = res.data or []
        enriched = []

        worker_city = (worker.get('city') or '').strip().lower()
        worker_avg_earnings = float(worker.get('avg_daily_earnings') or 500.0)

        event_city_cache: dict[str, str] = {}
        event_duration_cache: dict[str, float] = {}
        policy_tier_cache: dict[str, str] = {}

        def _event_duration(event_id: Optional[str]) -> float:
            if not event_id:
                return 0.0
            if event_id in event_duration_cache:
                return event_duration_cache[event_id]
            event_duration_cache[event_id] = 0.0
            try:
                ev = supabase.table('disruption_events').select('duration_hours').eq('id', event_id).limit(1).execute()
                if ev.data:
                    duration_raw = ev.data[0].get('duration_hours')
                    if duration_raw is not None:
                        event_duration_cache[event_id] = max(0.0, float(duration_raw))
            except Exception:
                pass
            return event_duration_cache[event_id]

        def _policy_tier(policy_id: Optional[str]) -> str:
            if not policy_id:
                return 'B'
            if policy_id in policy_tier_cache:
                return policy_tier_cache[policy_id]
            policy_tier_cache[policy_id] = 'B'
            try:
                pol = supabase.table('policies').select('tier').eq('id', policy_id).limit(1).execute()
                if pol.data and pol.data[0].get('tier'):
                    policy_tier_cache[policy_id] = pol.data[0].get('tier')
            except Exception:
                pass
            return policy_tier_cache[policy_id]

        def _event_city(event_id: Optional[str]) -> str:
            if not event_id:
                return ''
            if event_id in event_city_cache:
                return event_city_cache[event_id]
            event_city_cache[event_id] = ''
            try:
                ev = supabase.table('disruption_events').select('hex_id').eq('id', event_id).limit(1).execute()
                if not ev.data:
                    return ''
                hex_id = ev.data[0].get('hex_id')
                if not hex_id:
                    return ''
                for col in ('h3_index', 'hex_id'):
                    try:
                        zone = supabase.table('hex_zones').select('city').eq(col, hex_id).limit(1).execute()
                        if zone.data and zone.data[0].get('city'):
                            event_city_cache[event_id] = (zone.data[0].get('city') or '').strip().lower()
                            return event_city_cache[event_id]
                    except Exception:
                        continue
            except Exception:
                return ''
            return ''

        for claim in claims:
            path = claim.get('resolution_path') or 'soft_queue'
            fraud_score = int(claim.get('fraud_score') or 0)
            pop_validated = claim.get('pop_validated')
            normalized_status = claim.get('status')
            normalized_path = path
            normalized_payout = claim.get('payout_amount')
            reason_code = None

            # Defensive consistency: impossible combination should not be shown as paid.
            if pop_validated is False and normalized_status in {'paid', 'approved'}:
                normalized_status = 'denied'
                normalized_path = 'denied'
                normalized_payout = 0

            # Denied claims should never retain a non-denied route label.
            if normalized_status == 'denied' and normalized_path != 'denied':
                normalized_path = 'denied'
                normalized_payout = 0

            # Pending claims should keep unresolved payouts as null so UI can display TBD.
            if normalized_status == 'pending' and normalized_payout is None:
                normalized_payout = None

            # Legacy cleanup at read time: unresolved pending rows were historically stored as 0.
            if (
                normalized_status == 'pending'
                and normalized_payout == 0
                and not claim.get('razorpay_payment_id')
                and not claim.get('payout_transaction_id')
            ):
                normalized_payout = None

            normalized_disrupted_hours = claim.get('disrupted_hours')
            resolved_hours = 0.0
            try:
                if normalized_disrupted_hours is not None:
                    resolved_hours = max(0.0, float(normalized_disrupted_hours))
            except Exception:
                resolved_hours = 0.0

            if resolved_hours <= 0:
                event_hours = _event_duration(claim.get('event_id'))
                if event_hours > 0:
                    resolved_hours = event_hours
                    normalized_disrupted_hours = event_hours

            # Heal legacy paid rows where payout/disrupted_hours were stored as 0 due to old demo path bugs.
            if normalized_status in {'paid', 'approved'}:
                if resolved_hours <= 0:
                    resolved_hours = 4.0
                    normalized_disrupted_hours = 4.0

                payout_missing_or_zero = normalized_payout is None or float(normalized_payout) <= 0
                if payout_missing_or_zero and resolved_hours > 0:
                    recomputed = calculate_payout(
                        avg_daily_earnings=worker_avg_earnings,
                        disrupted_hours=resolved_hours,
                        tier=_policy_tier(claim.get('policy_id')),
                        worker_id=worker_id,
                    )
                    if recomputed > 0:
                        normalized_payout = recomputed

            gate2_result = 'NONE' if path == 'denied' and fraud_score < 90 else 'WEAK'

            event_city = _event_city(claim.get('event_id'))
            if normalized_path == 'denied' and worker_city and event_city and worker_city != event_city:
                reason_code = 'CITY_ZONE_MISMATCH'

            if normalized_path == 'denied' and reason_code is None and claim.get('event_id'):
                try:
                    event_res = supabase.table('disruption_events').select('started_at').eq('id', claim.get('event_id')).limit(1).execute()
                    if event_res.data:
                        started_at = event_res.data[0].get('started_at')
                        disruption_start = datetime.fromisoformat(started_at.replace('Z', '+00:00')) if started_at else datetime.now(timezone.utc)
                        allowed, inferred_code, _ = evaluate_location_guardrails(worker_id, claim.get('event_id'), disruption_start)
                        if not allowed:
                            reason_code = inferred_code
                except Exception:
                    pass

            explanation = explain_claim_decision(
                fraud_score=fraud_score,
                gate2_result=gate2_result,
                path=normalized_path,
                pop_validated=pop_validated,
                flags=[],
                reason_code=reason_code,
            )

            enriched.append({
                **claim,
                'status': normalized_status,
                'resolution_path': normalized_path,
                'disrupted_hours': normalized_disrupted_hours,
                'payout_amount': normalized_payout,
                'decision_explanation': explanation,
            })

        return enriched
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
