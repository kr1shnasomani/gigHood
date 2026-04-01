from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime, timezone
from backend.services.auth_service import get_current_worker
from backend.db.client import supabase

logger = logging.getLogger("api")
router = APIRouter()

class LocationPingParams(BaseModel):
    hex_id: str                            # Required: H3 hex index
    h3_index: Optional[str] = None        # Alias from mobile (if sent separately)
    latitude: float
    longitude: float
    accuracy_radius: float = 0.0
    network_signal_strength: int = 100
    mock_location_flag: bool = False

@router.post("")
def ingest_location_ping(payload: LocationPingParams, worker: dict = Depends(get_current_worker)):
    """
    Ingests 15-minute PoP telemetry pings from the worker's mobile device.
    Accepts both hex_id and h3_index (mobile may send either or both).
    """
    worker_id = worker.get("id")
    # Normalise: h3_index takes priority if provided, else fall back to hex_id
    effective_hex = payload.h3_index or payload.hex_id
    try:
        supabase.table("location_pings").insert({
            "worker_id": worker_id,
            "hex_id": effective_hex,
            "h3_index": effective_hex,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "accuracy_radius": payload.accuracy_radius,
            "network_signal_strength": payload.network_signal_strength,
            "mock_location_flag": payload.mock_location_flag,
            "pinged_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        return {"status": "success", "message": "Location cleanly tracked."}
    except Exception as e:
        logger.error(f"Failed to ingest location ping for {worker_id}: {e}")
        raise HTTPException(status_code=500, detail="Database write error")
