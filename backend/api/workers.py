import hashlib
import traceback
from datetime import date
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from backend.db.client import supabase
from backend.services.auth_service import create_jwt, get_current_worker
from backend.services.spatial import lat_lng_to_hex
from backend.services.dci_engine import get_dci_status

router = APIRouter()

# --- Schemas ---
class WorkerRegisterRequest(BaseModel):
    phone: str = Field(..., max_length=15)
    name: str = Field(..., max_length=100)
    city: str = Field(..., max_length=50)
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

# --- Endpoints ---
@router.post("/auth/otp/send")
def send_otp(req: OTPRequest):
    # Mocking OTP sent via fake SMS gateway
    # Using deterministic mock for testing simplicity: "123456" for demo.
    print(f"--- MOCK SMS ---")
    print(f"To: {normalize_phone(req.phone)}")
    print(f"OTP: 123456")
    print(f"----------------")
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
        if not res.data:
            raise HTTPException(status_code=404, detail="No active policy found. Please onboard your risk profile.")
        return res.data[0]
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
            ('h3_index,current_dci,dci_status,city', 'h3_index'),
            ('hex_id,current_dci,dci_status,city', 'hex_id'),
            ('h3_index,current_dci,dci_status', 'h3_index'),
            ('hex_id,current_dci,dci_status', 'hex_id'),
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
            return {
                "hex_id": hex_id,
                "current_dci": 0.0,
                "dci_status": "normal",
                "city": worker.get("city"),
                "dark_store_zone": worker.get("dark_store_zone"),
                "note": "Hex zone not yet seeded."
            }

        dci_val = float(zone.get('current_dci') or 0.0)
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
        res = supabase.table('claims').select(
            'id,payout_amount,disrupted_hours,resolution_path,status,'
            'fraud_score,pop_validated,razorpay_payment_id,created_at,resolved_at'
        ).eq('worker_id', worker_id).order('created_at', desc=True).execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
