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
from backend.services.claim_approver import explain_claim_decision, is_city_compatible
from backend.services.payout_calculator import calculate_payout, get_4w_avg_payout

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


class PinVerifyRequest(BaseModel):
    phone: str
    pin: str = Field(..., min_length=4, max_length=8)
    device_id: str = Field(..., min_length=8, max_length=128)

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


DEVICE_BINDINGS: dict[str, str] = {}
DEMO_PIN = "2468"


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


def _bootstrap_city_dci(city: Optional[str]) -> float:
    city_token = (city or "").strip().lower()
    if city_token == "chennai":
        return 0.34
    if city_token == "bengaluru":
        return 0.36
    if city_token == "mumbai":
        return 0.38
    return 0.35

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


@router.post("/auth/pin/verify")
def verify_pin(req: PinVerifyRequest):
    """
    PIN-first authentication flow for demo resilience.
    Includes mock device binding: first successful login binds device_id in-memory,
    subsequent logins must come from the same bound device_id.
    """
    if req.pin != DEMO_PIN:
        raise HTTPException(status_code=400, detail="Invalid PIN")

    try:
        worker_row = find_worker_by_phone(req.phone)
        if not worker_row:
            raise HTTPException(status_code=404, detail="Worker not found against this phone number. Please register.")

        worker_id = worker_row['id']
        bound_device_id = DEVICE_BINDINGS.get(worker_id)

        if bound_device_id and bound_device_id != req.device_id:
            raise HTTPException(status_code=403, detail="Device mismatch. Please login from your registered device.")

        if not bound_device_id:
            DEVICE_BINDINGS[worker_id] = req.device_id

        token = create_jwt(worker_id)
        return {
            "access_token": token,
            "token_type": "bearer",
            "worker": worker_row,
            "device_bound": True,
        }
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
            baseline_dci = _bootstrap_city_dci(worker.get('city'))
            return {
                "hex_id": hex_id,
                "current_dci": baseline_dci,
                "dci_status": get_dci_status(baseline_dci),
                "city": worker.get("city"),
                "dark_store_zone": worker.get("dark_store_zone"),
                "note": "Initializing live risk signals for your zone."
            }

        # If the snapshot is stale (or still a bootstrap placeholder), refresh once on-demand.
        # A newly created hex row often starts with current_dci=0 and no timestamp; treat it as uninitialized.
        last_computed = _parse_iso_timestamp(zone.get('last_computed_at'))
        stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=25)
        dci_raw_snapshot = zone.get('current_dci')
        has_snapshot = dci_raw_snapshot is not None
        is_bootstrap_placeholder = False
        if last_computed is None and has_snapshot:
            try:
                is_bootstrap_placeholder = float(dci_raw_snapshot) == 0.0 and (zone.get('dci_status') in {None, 'normal'})
            except Exception:
                is_bootstrap_placeholder = False

        should_refresh = (
            (last_computed is not None and last_computed < stale_cutoff)
            or (last_computed is None and not has_snapshot)
            or is_bootstrap_placeholder
        )
        # Fast-path for app responsiveness:
        # - if we already have a valid snapshot, return it quickly
        # - only perform full signal ingestion when snapshot is missing/uninitialized
        needs_full_recompute = (last_computed is None and not has_snapshot) or is_bootstrap_placeholder
        if should_refresh and needs_full_recompute:
            # Keep GET /me/hex/dci lightweight: compute only from already-cached signals.
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

        # If history is also missing, attempt one direct compute from cached signals.
        if dci_raw is None:
            try:
                compute_res = run_dci_cycle([hex_id]).get(hex_id)
                if compute_res and compute_res.get('dci') is not None:
                    dci_raw = compute_res.get('dci')
                    zone['dci_status'] = compute_res.get('status')
            except Exception:
                pass

        if dci_raw is None:
            baseline_dci = _bootstrap_city_dci(zone.get('city') or worker.get('city'))
            return {
                "hex_id": hex_id,
                "current_dci": baseline_dci,
                "dci_status": get_dci_status(baseline_dci),
                "city": zone.get('city') or worker.get('city'),
                "dark_store_zone": worker.get('dark_store_zone'),
                "note": "Collecting live signal confidence for this zone.",
            }

        dci_val = float(dci_raw)

        # Demo isolation guard:
        # If this zone is disrupted due to a demo-triggered event, but this worker has no claim
        # against that event, refresh from live ingestion once before returning UI state.
        # This prevents cross-account leakage where one user's demo click makes all workers in
        # the same hex appear permanently disrupted.
        try:
            status_now = zone.get('dci_status') or get_dci_status(dci_val)
            if dci_val > 0.85 and status_now == 'disrupted':
                latest_event = None
                for where_col in ('h3_index', 'hex_id'):
                    try:
                        ev_res = (
                            supabase.table('disruption_events')
                            .select('id,trigger_signals,started_at,ended_at')
                            .eq(where_col, hex_id)
                            .is_('ended_at', 'null')
                            .order('started_at', desc=True)
                            .limit(1)
                            .execute()
                        )
                        if ev_res.data:
                            latest_event = ev_res.data[0]
                            break
                    except Exception:
                        continue

                trigger = (latest_event or {}).get('trigger_signals') or {}
                is_demo_event = isinstance(trigger, dict) and bool(trigger.get('demo'))

                if is_demo_event and latest_event and latest_event.get('id'):
                    has_worker_claim = False
                    try:
                        claim_res = (
                            supabase.table('claims')
                            .select('id')
                            .eq('worker_id', worker.get('id'))
                            .eq('event_id', latest_event.get('id'))
                            .limit(1)
                            .execute()
                        )
                        has_worker_claim = bool(claim_res.data)
                    except Exception:
                        has_worker_claim = False

                    if not has_worker_claim:
                        # Recompute from cached signals to avoid cross-account demo leakage
                        # without forcing a fresh external ingestion inside the request path.
                        run_dci_cycle([hex_id])
                        for select_cols, where_col in query_attempts:
                            try:
                                refreshed = supabase.table('hex_zones').select(select_cols).eq(where_col, hex_id).execute()
                                if refreshed.data:
                                    zone = refreshed.data[0]
                                    break
                            except Exception:
                                continue

                        dci_raw_after_refresh = zone.get('current_dci')
                        if dci_raw_after_refresh is not None:
                            dci_val = float(dci_raw_after_refresh)
        except Exception:
            pass

        derived_status = get_dci_status(dci_val)

        return {
            "hex_id": hex_id,
            "current_dci": round(dci_val, 4),
            "dci_status": derived_status,
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

        # **BATCH LOAD** all related data in 3 queries instead of N+1 per claim
        event_ids = [c.get('event_id') for c in claims if c.get('event_id')]
        policy_ids = [c.get('policy_id') for c in claims if c.get('policy_id')]
        
        event_duration_cache: dict[str, float] = {}
        policy_tier_cache: dict[str, str] = {}
        event_city_cache: dict[str, str] = {}
        
        # Query 1: Batch load all disruption_events (duration_hours + hex_id for city lookup)
        if event_ids:
            try:
                events_res = supabase.table('disruption_events').select('id,duration_hours,hex_id,started_at').in_('id', list(set(event_ids))).execute()
                events_by_id = {e['id']: e for e in (events_res.data or [])}
            except Exception:
                events_by_id = {}
        else:
            events_by_id = {}
        
        # Query 2: Batch load all policies
        if policy_ids:
            try:
                policies_res = supabase.table('policies').select('id,tier').in_('id', list(set(policy_ids))).execute()
                policies_by_id = {p['id']: p for p in (policies_res.data or [])}
            except Exception:
                policies_by_id = {}
        else:
            policies_by_id = {}
        
        # Query 3: Batch load all hex_zones (for city lookup)
        hex_ids = [e.get('hex_id') for e in events_by_id.values() if e.get('hex_id')]
        if hex_ids:
            try:
                zones_res = supabase.table('hex_zones').select('hex_id,h3_index,city').in_('hex_id', list(set(hex_ids))).execute()
                zones_by_hex = {z['hex_id']: z for z in (zones_res.data or [])}
            except Exception:
                zones_by_hex = {}
        else:
            zones_by_hex = {}

        def _event_duration(event_id: Optional[str]) -> float:
            if not event_id:
                return 0.0
            event = events_by_id.get(event_id)
            if event:
                duration_raw = event.get('duration_hours')
                if duration_raw is not None:
                    return max(0.0, float(duration_raw))
            return 0.0

        def _policy_tier(policy_id: Optional[str]) -> str:
            if not policy_id:
                return 'B'
            policy = policies_by_id.get(policy_id)
            if policy and policy.get('tier'):
                return policy['tier']
            return 'B'

        def _event_city(event_id: Optional[str]) -> str:
            if not event_id:
                return ''
            event = events_by_id.get(event_id)
            if not event:
                return ''
            hex_id = event.get('hex_id')
            if not hex_id:
                return ''
            zone = zones_by_hex.get(hex_id)
            if zone and zone.get('city'):
                return (zone['city'] or '').strip().lower()
            return ''
        
        def _event_started_at(event_id: Optional[str]) -> Optional[datetime]:
            if not event_id:
                return None
            event = events_by_id.get(event_id)
            if event and event.get('started_at'):
                try:
                    return datetime.fromisoformat(event['started_at'].replace('Z', '+00:00'))
                except Exception:
                    return None
            return None

        # **OPTIMIZATION**: Cache the 4-week average payout ONCE before the loop
        # Instead of calling get_4w_avg_payout(worker_id) for each claim with missing payout,
        # fetch it once and reuse. This eliminates N+1 database queries.
        try:
            cached_4w_avg = get_4w_avg_payout(worker_id)
        except Exception:
            cached_4w_avg = worker_avg_earnings  # Fallback to daily earnings if cache fails

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
                        cached_historical_avg=cached_4w_avg,  # Pass cached value to skip DB query
                    )
                    if recomputed > 0:
                        normalized_payout = recomputed

            gate2_result = 'NONE' if path == 'denied' and fraud_score < 90 else 'WEAK'

            event_city = _event_city(claim.get('event_id'))
            if normalized_path == 'denied' and worker_city and event_city and not is_city_compatible(worker_city, event_city):
                reason_code = 'CITY_ZONE_MISMATCH'

            # **OPTIMIZATION SKIPPED**: evaluate_location_guardrails() was making 4 DB queries per loop iteration
            # Since we already checked city mismatch above, and denied claims rarely need detailed location validation,
            # we skip the expensive location pings query. For future enhancement: pre-compute this once per worker.

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
