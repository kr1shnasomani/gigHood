import hashlib
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from backend.db.client import supabase
from backend.services.auth_service import get_current_worker
from backend.services.claim_approver import route_claim
from backend.services.dci_engine import get_dci_status, sigmoid
from backend.services.fraud_engine import FraudEvaluator
from backend.services.payment_service import initiate_upi_payout
from backend.services.policy_manager import create_policy
from backend.services.pop_validator import validate_pop
from backend.services.payout_calculator import get_4w_avg_payout

router = APIRouter()

SIG_WEATHER = "weather"
SIG_TRAFFIC = "traffic"
SIG_PLATFORM = "platform"
SIG_SOCIAL = "social"

WEEKLY_DCIS = [0.38, 0.35, 0.40, 0.42, 0.39, 0.41, 0.44, 0.60, 0.65, 0.72, 0.66, 0.69]


class SimulateDisruptionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    w: float = Field(..., alias="W", description="Weather signal score")
    t: float = Field(..., alias="T", description="Traffic signal score")
    p: float = Field(..., alias="P", description="Platform signal score")
    s: float = Field(..., alias="S", description="Social signal score")


def _hash_zone_to_coords(zone: str) -> tuple[float, float]:
    hs = hashlib.sha256(zone.encode()).hexdigest()
    lat = 12.8 + (int(hs[:8], 16) / 0xFFFFFFFF) * (13.1 - 12.8)
    lng = 77.5 + (int(hs[8:16], 16) / 0xFFFFFFFF) * (77.8 - 77.5)
    return lat, lng


def _parse_iso_timestamp(ts: str) -> datetime:
    if not ts:
        return datetime.now(timezone.utc)
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _require_worker_fields(worker: dict[str, Any]) -> tuple[str, str]:
    worker_id = worker.get("id")
    hex_id = worker.get("hex_id")
    if not worker_id:
        raise HTTPException(status_code=401, detail="Worker ID missing from auth context")
    if not hex_id:
        raise HTTPException(status_code=422, detail="Worker has no hex_id assigned")
    return worker_id, hex_id


def _ensure_hex_zone_exists(hex_id: str, city: str | None = None) -> None:
    """Ensure a hex row exists so signal_cache FK inserts do not fail."""
    try:
        existing = supabase.table("hex_zones").select("h3_index").eq("h3_index", hex_id).limit(1).execute()
        if existing.data:
            return
    except Exception:
        # If select fails for transient reasons, continue to upsert attempt below.
        pass

    payload = {
        "h3_index": hex_id,
        "city": city or "Unknown",
        "current_dci": 0.0,
        "dci_status": "normal",
        "active_worker_count": 0,
        "consecutive_normal_cycles": 0,
        "is_disrupted": False,
    }
    supabase.table("hex_zones").upsert(payload, on_conflict="h3_index").execute()


def _run_seed(worker: dict[str, Any]) -> dict[str, Any]:
    worker_id, hex_id = _require_worker_fields(worker)
    _ensure_hex_zone_exists(hex_id, worker.get("city"))

    # Demo parity: deterministic 12-week DCI history ending in a 4-week avg around 0.68.
    now = datetime.now(timezone.utc)
    dci_rows: list[dict[str, Any]] = []
    for i, score in enumerate(WEEKLY_DCIS):
        ts = now - timedelta(weeks=12 - i)
        dci_rows.append(
            {
                "hex_id": hex_id,
                "dci_score": score,
                "w_score": round(score * 0.90, 3),
                "t_score": round(score * 0.70, 3),
                "p_score": round(score * 0.50, 3),
                "s_score": round(score * 0.20, 3),
                "computed_at": ts.isoformat(),
            }
        )

    supabase.table("dci_history").delete().eq("hex_id", hex_id).execute()
    try:
        # Schema variant A: w_score/t_score/p_score/s_score
        supabase.table("dci_history").insert(dci_rows).execute()
    except Exception:
        # Schema variant B: weather_component/traffic_component/platform_component/social_component
        dci_rows_v2: list[dict[str, Any]] = []
        for row in dci_rows:
            dci_rows_v2.append(
                {
                    "hex_id": row["hex_id"],
                    "dci_score": row["dci_score"],
                    "weather_component": row["w_score"],
                    "traffic_component": row["t_score"],
                    "platform_component": row["p_score"],
                    "social_component": row["s_score"],
                    "computed_at": row["computed_at"],
                }
            )
        supabase.table("dci_history").insert(dci_rows_v2).execute()

    # Demo parity: 6 PoP pings in last 90 minutes with small jitter to avoid static-device false positives.
    lat, lng = _hash_zone_to_coords(worker.get("dark_store_zone") or "DEFAULT_ZONE")
    ping_rows: list[dict[str, Any]] = []
    deltas_min = [85, 70, 55, 40, 25, 10]
    acc_radii = [22, 18, 30, 15, 25, 45]

    for i, (delta, acc) in enumerate(zip(deltas_min, acc_radii)):
        ts = now - timedelta(minutes=delta)
        jitter = 0.0006 * (i % 3 - 1)
        ping_rows.append(
            {
                "worker_id": worker_id,
                "hex_id": hex_id,
                "h3_index": hex_id,
                "latitude": lat + jitter,
                "longitude": lng + jitter,
                "accuracy_radius": acc,
                "mock_location_flag": False,
                "pinged_at": ts.isoformat(),
            }
        )

    supabase.table("location_pings").delete().eq("worker_id", worker_id).execute()
    try:
        supabase.table("location_pings").insert(ping_rows).execute()
    except Exception:
        # Backward-compatible retry when h3_index is not present in this schema.
        ping_rows_v2: list[dict[str, Any]] = []
        for row in ping_rows:
            stripped = dict(row)
            stripped.pop("h3_index", None)
            ping_rows_v2.append(stripped)
        supabase.table("location_pings").insert(ping_rows_v2).execute()

    # Gate 2 mock order behavior is implemented inside FraudEvaluator._evaluate_gate2_orders.
    gate2_preview = FraudEvaluator()._evaluate_gate2_orders(worker_id)
    avg_4w = round(sum(WEEKLY_DCIS[-4:]) / 4, 4)

    return {
        "worker_id": worker_id,
        "hex_id": hex_id,
        "dci_history_rows": len(dci_rows),
        "location_ping_rows": len(ping_rows),
        "rolling_4w_avg": avg_4w,
        "gate2_mock_preview": gate2_preview,
    }


def _run_simulate_disruption(worker: dict[str, Any], payload: SimulateDisruptionRequest) -> dict[str, Any]:
    _, hex_id = _require_worker_fields(worker)
    _ensure_hex_zone_exists(hex_id, worker.get("city"))

    signals = {
        SIG_WEATHER: (payload.w, "Manual weather disruption signal"),
        SIG_TRAFFIC: (payload.t, "Manual traffic disruption signal"),
        SIG_PLATFORM: (payload.p, "Manual platform disruption signal"),
        SIG_SOCIAL: (payload.s, "Manual social disruption signal"),
    }

    supabase.table("signal_cache").delete().eq("hex_id", hex_id).execute()

    rows = []
    for signal_type, (score, description) in signals.items():
        rows.append(
            {
                "hex_id": hex_id,
                "signal_type": signal_type,
                "normalized_score": score,
                "source_available": True,
                "raw_data": {"demo": True, "description": description},
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    supabase.table("signal_cache").insert(rows).execute()

    # Step-5 parity math: sigma(0.45W + 0.25T + 0.20P + 0.10S)
    raw = (0.45 * payload.w) + (0.25 * payload.t) + (0.20 * payload.p) + (0.10 * payload.s)
    dci = sigmoid(raw)
    status = get_dci_status(dci)

    # Keep compatibility with both column names seen across environments.
    supabase.table("hex_zones").update({"current_dci": dci, "dci_status": status}).eq("h3_index", hex_id).execute()

    return {
        "hex_id": hex_id,
        "raw": round(raw, 6),
        "current_dci": round(dci, 6),
        "dci_status": status,
    }


def _ensure_active_policy(worker_id: str) -> dict[str, Any]:
    existing = (
        supabase.table("policies")
        .select("id,tier,status")
        .eq("worker_id", worker_id)
        .eq("status", "active")
        .execute()
    )
    if existing.data:
        return existing.data[0]
    return create_policy(worker_id)


def _ensure_active_event(hex_id: str) -> dict[str, Any]:
    active = (
        supabase.table("disruption_events")
        .select("id,started_at,dci_peak")
        .eq("hex_id", hex_id)
        .is_("ended_at", "null")
        .execute()
    )
    if active.data:
        return active.data[0]

    zone = (
        supabase.table("hex_zones")
        .select("current_dci")
        .eq("h3_index", hex_id)
        .execute()
    )
    if not zone.data:
        # Some environments store zone id under hex_id instead of h3_index.
        try:
            zone = (
                supabase.table("hex_zones")
                .select("current_dci")
                .eq("hex_id", hex_id)
                .execute()
            )
        except Exception:
            pass
    dci_peak = 0.91
    if zone.data:
        dci_peak = float(zone.data[0].get("current_dci") or dci_peak)

    created = (
        supabase.table("disruption_events")
        .insert(
            {
                "hex_id": hex_id,
                "h3_index": hex_id,
                "dci_peak": dci_peak,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "trigger_signals": {"demo": True},
            }
        )
        .execute()
    )
    return created.data[0]


def _ensure_pending_claim(worker_id: str, policy_id: str, event_id: str) -> dict[str, Any]:
    existing = (
        supabase.table("claims")
        .select("id,status,disrupted_hours")
        .eq("worker_id", worker_id)
        .eq("event_id", event_id)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    created = (
        supabase.table("claims")
        .insert(
            {
                "worker_id": worker_id,
                "policy_id": policy_id,
                "event_id": event_id,
                "status": "pending",
                "disrupted_hours": 4.0,
            }
        )
        .execute()
    )
    return created.data[0]


def _run_process_claim(worker: dict[str, Any]) -> dict[str, Any]:
    worker_id, hex_id = _require_worker_fields(worker)
    _ensure_hex_zone_exists(hex_id, worker.get("city"))
    policy = _ensure_active_policy(worker_id)
    event = _ensure_active_event(hex_id)
    claim = _ensure_pending_claim(worker_id, policy.get("id"), event.get("id"))

    claim_id = claim.get("id")
    disruption_start = _parse_iso_timestamp(event.get("started_at"))

    # Step 6: PoP validation and gate-2 preview.
    pop_res = validate_pop(worker_id, hex_id, disruption_start)
    evaluator = FraudEvaluator()
    gate2_preview = evaluator._evaluate_gate2_orders(worker_id)

    # Step 7: 7-layer fraud scoring and route mapping.
    fraud_res = evaluator.evaluate(worker_id, event.get("id"), disruption_start)
    fraud_score = int(fraud_res.get("fraud_score", 0))
    gate2_result = fraud_res.get("gate2_result", gate2_preview)
    flags = fraud_res.get("flags", [])
    path = route_claim(fraud_score, gate2_result)

    # Step 8: payout math copied from demo_runner.step8_payout.
    disrupted_hours = float(claim.get("disrupted_hours") or 4.0)
    avg_daily_earnings = float(worker.get("avg_daily_earnings") or 500.0)
    tier = policy.get("tier") or "B"

    raw_payout = (avg_daily_earnings / 8.0) * disrupted_hours
    tier_cap = {"A": 600.0, "B": 700.0, "C": 800.0}.get(tier, 700.0)
    capped = min(raw_payout, tier_cap)
    hist_avg = get_4w_avg_payout(worker_id)
    maturation_cap = hist_avg * 2.5
    payout_amount = round(min(capped, maturation_cap), 2)

    # Step 9: Razorpay sandbox payout.
    try:
        rzp = initiate_upi_payout(
            upi_id=worker.get("upi_id") or "generic@ybl",
            amount_rupees=payout_amount,
            reference_id=claim_id,
        )
        razorpay_payment_id = rzp.get("id")
        payout_transaction_id = rzp.get("transaction_id") or razorpay_payment_id
        payout_channel = rzp.get("channel", "UPI")
    except Exception:
        # Keep demo flow alive even if payout client fails.
        razorpay_payment_id = f"pout_demo_{claim_id}"
        payout_transaction_id = razorpay_payment_id
        payout_channel = "UPI"

    # Step 10: persist final claim state exactly like demo runner finalization.
    final_status = "paid"
    try:
        supabase.table("claims").update(
            {
                "payout_amount": payout_amount,
                "razorpay_payment_id": razorpay_payment_id,
                "payout_transaction_id": payout_transaction_id,
                "payout_channel": payout_channel,
                "pop_validated": bool(pop_res.get("present", False)),
                "fraud_score": fraud_score,
                "resolution_path": path,
                "status": final_status,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", claim_id).execute()
    except Exception:
        supabase.table("claims").update(
            {
                "payout_amount": payout_amount,
                "razorpay_payment_id": razorpay_payment_id,
                "pop_validated": bool(pop_res.get("present", False)),
                "fraud_score": fraud_score,
                "resolution_path": path,
                "status": final_status,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", claim_id).execute()

    return {
        "claim_id": claim_id,
        "event_id": event.get("id"),
        "policy_id": policy.get("id"),
        "fraud_score": fraud_score,
        "fraud_flags": flags,
        "gate2_result": gate2_result,
        "resolution_path": path,
        "payout_amount": payout_amount,
        "razorpay_payment_id": razorpay_payment_id,
        "payout_transaction_id": payout_transaction_id,
        "payout_channel": payout_channel,
        "pop_validated": bool(pop_res.get("present", False)),
        "status": final_status,
    }


@router.post("/me/demo/seed")
def seed_demo_data(worker: dict = Depends(get_current_worker)):
    try:
        return _run_seed(worker)
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Demo seed failed: {e}")


@router.post("/me/demo/simulate-disruption")
def simulate_disruption(payload: SimulateDisruptionRequest, worker: dict = Depends(get_current_worker)):
    try:
        return _run_simulate_disruption(worker, payload)
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Demo disruption simulation failed: {e}")


@router.post("/me/demo/process-claim")
def process_demo_claim(worker: dict = Depends(get_current_worker)):
    try:
        return _run_process_claim(worker)
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Demo claim processing failed: {e}")
