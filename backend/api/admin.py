import traceback
import math
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.db.client import supabase
from backend.services.dci_engine import run_dci_cycle
from backend.services.neo4j_graph import (
    backfill_claim_graph,
    get_syndicate_graph,
    is_neo4j_configured,
)

router = APIRouter()


class SandboxSignalOverrideRequest(BaseModel):
    hex_id: str = Field(..., description="Target H3/hex zone id")
    rainfall_mm_per_hr: float = Field(..., ge=0, le=300)
    aqi: float = Field(..., ge=0, le=1000)
    traffic_congestion_percent: float = Field(..., ge=0, le=100)


class SandboxSignalBatchOverrideRequest(BaseModel):
    rainfall_mm_per_hr: float = Field(..., ge=0, le=300)
    aqi: float = Field(..., ge=0, le=1000)
    traffic_congestion_percent: float = Field(..., ge=0, le=100)


def _normalize_weather_from_rainfall(rainfall_mm_per_hr: float) -> float:
    # Aggressive rainfall should visibly push DCI in sandbox simulations.
    return max(0.0, min(3.2, rainfall_mm_per_hr / 35.0))


def _normalize_aqi(aqi: float) -> float:
    return max(0.0, min(1.6, aqi / 320.0))


def _normalize_traffic(traffic_congestion_percent: float) -> float:
    return max(0.0, min(2.2, traffic_congestion_percent / 40.0))


@router.post("/sandbox/override-signals")
def override_zone_signals(payload: SandboxSignalOverrideRequest):
    """
    Admin actuary sandbox:
    Writes manual signal overrides for a hex zone, then recomputes DCI and
    lets trigger monitoring open/close disruption events based on thresholds.
    """
    try:
        hex_id = payload.hex_id.strip()
        if not hex_id:
            raise HTTPException(status_code=422, detail="hex_id is required")

        weather_score = _normalize_weather_from_rainfall(payload.rainfall_mm_per_hr)
        aqi_score = _normalize_aqi(payload.aqi)
        traffic_score = _normalize_traffic(payload.traffic_congestion_percent)

        # Keep platform/social as elevated baselines to simulate broad disruption pressure.
        platform_score = 1.55
        social_score = 0.95

        now_iso = datetime.now(timezone.utc).isoformat()
        rows = [
            {
                "hex_id": hex_id,
                "signal_type": "WEATHER",
                "normalized_score": weather_score,
                "source_available": True,
                "raw_data": {
                    "source": "admin_sandbox",
                    "rainfall_mm_per_hr": payload.rainfall_mm_per_hr,
                },
                "fetched_at": now_iso,
            },
            {
                "hex_id": hex_id,
                "signal_type": "AQI",
                "normalized_score": aqi_score,
                "source_available": True,
                "raw_data": {
                    "source": "admin_sandbox",
                    "aqi": payload.aqi,
                },
                "fetched_at": now_iso,
            },
            {
                "hex_id": hex_id,
                "signal_type": "TRAFFIC",
                "normalized_score": traffic_score,
                "source_available": True,
                "raw_data": {
                    "source": "admin_sandbox",
                    "traffic_congestion_percent": payload.traffic_congestion_percent,
                },
                "fetched_at": now_iso,
            },
            {
                "hex_id": hex_id,
                "signal_type": "PLATFORM",
                "normalized_score": platform_score,
                "source_available": True,
                "raw_data": {"source": "admin_sandbox", "default": True},
                "fetched_at": now_iso,
            },
            {
                "hex_id": hex_id,
                "signal_type": "SOCIAL",
                "normalized_score": social_score,
                "source_available": True,
                "raw_data": {"source": "admin_sandbox", "default": True},
                "fetched_at": now_iso,
            },
        ]

        # Replace prior sandbox signal rows for deterministic what-if outcomes.
        for signal_type in ("WEATHER", "AQI", "TRAFFIC", "PLATFORM", "SOCIAL"):
            try:
                supabase.table("signal_cache").delete().eq("hex_id", hex_id).eq("signal_type", signal_type).execute()
            except Exception:
                pass

        supabase.table("signal_cache").insert(rows).execute()

        dci_res = run_dci_cycle([hex_id]).get(hex_id, {})
        dci_score = dci_res.get("dci")
        dci_status = dci_res.get("status")

        open_event_id = None
        try:
            event_res = (
                supabase.table("disruption_events")
                .select("id")
                .eq("hex_id", hex_id)
                .is_("ended_at", "null")
                .order("started_at", desc=True)
                .limit(1)
                .execute()
            )
            if event_res.data:
                open_event_id = event_res.data[0].get("id")
        except Exception:
            open_event_id = None

        return {
            "hex_id": hex_id,
            "input": {
                "rainfall_mm_per_hr": payload.rainfall_mm_per_hr,
                "aqi": payload.aqi,
                "traffic_congestion_percent": payload.traffic_congestion_percent,
            },
            "normalized": {
                "W": round(weather_score, 3),
                "A": round(aqi_score, 3),
                "T": round(traffic_score, 3),
                "P": round(platform_score, 3),
                "S": round(social_score, 3),
            },
            "dci": dci_score,
            "dci_status": dci_status,
            "triggered": bool(open_event_id),
            "open_event_id": open_event_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sandbox/override-signals/batch")
def override_all_live_zone_signals(payload: SandboxSignalBatchOverrideRequest):
    """
    Batch override for actuary sandbox to simulate city-wide/live-zone disruptions.
    Applies same manual signal vector to every currently active zone.
    """
    try:
        zones = get_zones()
        hex_ids = [z.get("h3_index") for z in zones if z.get("h3_index")]
        if not hex_ids:
            raise HTTPException(status_code=404, detail="No live zones available for batch override")

        results = []
        for hex_id in hex_ids:
            res = override_zone_signals(
                SandboxSignalOverrideRequest(
                    hex_id=hex_id,
                    rainfall_mm_per_hr=payload.rainfall_mm_per_hr,
                    aqi=payload.aqi,
                    traffic_congestion_percent=payload.traffic_congestion_percent,
                )
            )
            results.append(res)

        triggered_count = sum(1 for item in results if item.get("triggered"))
        return {
            "zones_targeted": len(hex_ids),
            "zones_triggered": triggered_count,
            "results": results,
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fraud/network-graph")
def get_fraud_network_graph(seed_if_empty: bool = True, city: str | None = None):
    if not is_neo4j_configured():
        raise HTTPException(
            status_code=503,
            detail="Neo4j is not configured. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD.",
        )

    try:
        return get_syndicate_graph(seed_if_empty=seed_if_empty, city=city)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fraud/network-graph/backfill")
def backfill_fraud_network_graph(limit: int = 1000):
    if not is_neo4j_configured():
        raise HTTPException(
            status_code=503,
            detail="Neo4j is not configured. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD.",
        )

    try:
        return backfill_claim_graph(limit=max(1, min(limit, 5000)))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))

def _compute_dci_from_signals(trigger_signals: dict | None) -> float | None:
    if not isinstance(trigger_signals, dict):
        return None

    # SOLUTION.md formula: DCI = sigmoid(0.45*W + 0.25*T + 0.20*P + 0.10*S)
    weights = {'W': 0.45, 'T': 0.25, 'P': 0.20, 'S': 0.10}
    weighted_sum = 0.0
    seen = False

    for key, weight in weights.items():
        raw = trigger_signals.get(key)
        if raw is None:
            continue
        try:
            val = float(raw)
        except (TypeError, ValueError):
            continue
        weighted_sum += weight * val
        seen = True

    if not seen:
        return None

    sigmoid = 1.0 / (1.0 + math.exp(-weighted_sum))
    return _clamp01(sigmoid)

def _derive_fraud_score(claim: dict, flag_contributions: list[int]) -> int:
    raw = claim.get('fraud_score')
    if raw is not None:
        try:
            return max(0, min(100, int(float(raw))))
        except (TypeError, ValueError):
            pass

    if flag_contributions:
        return max(0, min(100, int(sum(flag_contributions))))

    path = str(claim.get('resolution_path') or '').lower()
    status = str(claim.get('status') or '').lower()

    # Path bands aligned to SOLUTION.md:
    # <30 fast_track, 30-59 soft_queue, 60-79 active_verify, >=80 denied.
    if status == 'denied' or path == 'denied':
        return 80
    if path == 'active_verify':
        return 65
    if path == 'soft_queue':
        return 35
    if path == 'fast_track':
        return 15
    return 30

@router.get("/alerts/count")
def get_alerts_count():
    try:
        from backend.services.notification_service import notification_service
        count = len(notification_service.list_admin_alerts(limit=100))
        return {"count": count}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard/kpis")
def get_kpis():
    try:
        # 1. Active policies count
        pol_res = supabase.table('policies').select('id', count='exact').eq('status', 'active').execute()
        active_policies = pol_res.count if pol_res.count is not None else len(pol_res.data)

        # 2. Premiums collected from active policies pool
        prem_res = supabase.table('policies').select('weekly_premium').eq('status', 'active').execute()
        total_premium = sum(float(p.get('weekly_premium') or 0.0) for p in (prem_res.data or []))

        # 3. Total disbursed = approved + paid claims
        claims_res = (
            supabase.table('claims')
            .select('payout_amount,status')
            .in_('status', ['approved', 'paid'])
            .execute()
        )
        total_claims_paid = sum(float(c.get('payout_amount') or 0.0) for c in (claims_res.data or []))

        # 4. System loss ratio (same as BCR) as ratio, not percent
        loss_ratio = (total_claims_paid / total_premium) if total_premium > 0 else 0.0
        
        return {
            "active_policies": active_policies,
            "total_premium": total_premium,
            "total_claims_paid": total_claims_paid,
            "system_loss_ratio": round(loss_ratio, 4)
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard/zones")
def get_zones():
    try:
        res = supabase.table('hex_zones').select('*').gt('current_dci', 0).execute()
        zones = []
        for z in res.data:
            zones.append({
                "city": z.get('city'),
                "h3_index": z.get('h3_index') or z.get('hex_id'),
                "dci_score": float(z.get('current_dci', 0.0)),
                "status": z.get('dci_status', 'normal')
            })
        return zones
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard/risk-forecast")
def get_risk_forecast():
    try:
        res = supabase.table('hex_zones').select('city,current_dci').execute()
        rows = res.data or []

        city_agg: dict[str, dict[str, float]] = {}
        for row in rows:
            city = str(row.get('city') or '').strip()
            if not city:
                continue

            try:
                dci = float(row.get('current_dci') or 0.0)
            except (TypeError, ValueError):
                dci = 0.0

            bucket = city_agg.setdefault(city, {'sum': 0.0, 'count': 0.0})
            bucket['sum'] += dci
            bucket['count'] += 1.0

        forecast = []
        for city, agg in city_agg.items():
            avg_dci = (agg['sum'] / agg['count']) if agg['count'] > 0 else 0.0
            risk_pct = max(0.0, min(100.0, avg_dci * 100.0))
            forecast.append({
                'city': city,
                'risk': round(risk_pct, 1),
            })

        forecast.sort(key=lambda x: x['risk'], reverse=True)
        return forecast[:6]
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard/payout-trends")
def get_payout_trends():
    try:
        res = supabase.table('claims').select('created_at,payout_amount,status').execute()
        claims = res.data or []
        monthly_totals: dict[str, float] = {}
        now = datetime.now(timezone.utc)

        for claim in claims:
            if claim.get('status') != 'paid':
                continue

            created_at = claim.get('created_at')
            if not created_at:
                continue

            try:
                created_ts = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except Exception:
                continue

            month_label = created_ts.strftime('%b')
            monthly_totals[month_label] = monthly_totals.get(month_label, 0.0) + float(claim.get('payout_amount') or 0.0)

        trends = []
        for offset in range(5, -1, -1):
            month = (now.month - offset - 1) % 12 + 1
            year = now.year + ((now.month - offset - 1) // 12)
            label = datetime(year, month, 1).strftime('%b')
            trends.append({
                'month': label,
                'payouts': round(monthly_totals.get(label, 0.0), 2),
            })

        return trends
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payouts/summary")
def get_payout_summary():
    try:
        res = supabase.table('claims').select('payout_amount,status').execute()
        claims = res.data or []
        total_payouts = sum(float(item.get('payout_amount') or 0.0) for item in claims if item.get('status') == 'paid')
        paid_count = sum(1 for item in claims if item.get('status') == 'paid')
        total_claims = len(claims)
        avg_payout = total_payouts / paid_count if paid_count else 0.0
        pending_amount = sum(float(item.get('payout_amount') or 0.0) for item in claims if item.get('status') == 'pending')
        success_rate = (paid_count / total_claims * 100) if total_claims else 0.0

        return {
            'total_payouts': round(total_payouts, 2),
            'avg_payout': round(avg_payout, 2),
            'success_rate': round(success_rate, 2),
            'pending_amount': round(pending_amount, 2),
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payouts/recent")
def get_recent_payouts():
    try:
        claims_res = supabase.table('claims').select('id,worker_id,payout_amount,status,created_at').order('created_at', desc=True).limit(20).execute()
        claims_data = claims_res.data or []
        worker_ids = [claim['worker_id'] for claim in claims_data if claim.get('worker_id')]
        workers = {}

        if worker_ids:
            workers_res = supabase.table('workers').select('id,name').in_('id', worker_ids).execute()
            for worker in (workers_res.data or []):
                workers[worker['id']] = worker.get('name', 'Unknown Worker')

        result = []
        for claim in claims_data:
            result.append({
                'id': claim['id'],
                'worker_name': workers.get(claim.get('worker_id'), 'Unknown Worker'),
                'amount': float(claim.get('payout_amount') or 0.0),
                'status': claim.get('status', 'pending'),
                'created_at': claim.get('created_at'),
            })

        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard/fraud-queue")
def get_fraud_queue():
    try:
        # Join logic from claims, workers, and fraud_flags
        claims_res = supabase.table('claims').select(
            'id, created_at, status, resolution_path, fraud_score, worker_id, payout_amount, event_id'
        ).order('created_at', desc=True).limit(50).execute()
        
        claims_data = claims_res.data or []
        worker_ids = list(set([c['worker_id'] for c in claims_data if c.get('worker_id')]))
        claim_ids = [c['id'] for c in claims_data]
        
        workers_dict = {}
        if worker_ids:
            workers_res = supabase.table('workers').select('id, name, city').in_('id', worker_ids).execute()
            for w in (workers_res.data or []):
                workers_dict[w['id']] = w

        event_ids = [c['event_id'] for c in claims_data if c.get('event_id')]
        event_hex_map: dict[str, str] = {}
        zone_dci_map: dict[str, float] = {}
        event_dci_map: dict[str, float] = {}

        if event_ids:
            event_res = supabase.table('disruption_events').select('id,hex_id,dci_peak,trigger_signals').in_('id', event_ids).execute()
            for e in (event_res.data or []):
                if e.get('id') and e.get('hex_id'):
                    event_hex_map[e['id']] = e['hex_id']

                if e.get('id'):
                    dci_peak = e.get('dci_peak')
                    dci_value = None
                    try:
                        if dci_peak is not None:
                            dci_value = _clamp01(float(dci_peak))
                    except (TypeError, ValueError):
                        dci_value = None

                    if dci_value is None:
                        dci_value = _compute_dci_from_signals(e.get('trigger_signals'))

                    if dci_value is not None:
                        event_dci_map[e['id']] = dci_value

        if event_hex_map:
            hex_ids = list(set(event_hex_map.values()))
            zone_res = supabase.table('hex_zones').select('h3_index,current_dci').in_('h3_index', hex_ids).execute()
            for z in (zone_res.data or []):
                if z.get('h3_index'):
                    zone_dci_map[z['h3_index']] = float(z.get('current_dci') or 0.0)

        flags_dict = {cid: [] for cid in claim_ids}
        flag_score_dict: dict[str, list[int]] = {cid: [] for cid in claim_ids}
        if claim_ids:
            flags_res = supabase.table('fraud_flags').select('claim_id, flag_type, score_contribution').in_('claim_id', claim_ids).execute()
            for f in (flags_res.data or []):
                if f['claim_id'] in flags_dict:
                    flags_dict[f['claim_id']].append(f['flag_type'])
                    score = f.get('score_contribution')
                    if score is not None:
                        try:
                            flag_score_dict[f['claim_id']].append(int(score))
                        except (TypeError, ValueError):
                            pass
                    
        result = []
        for c in claims_data:
            c_worker = workers_dict.get(c['worker_id'], {})
            event_id = c.get('event_id')
            event_hex = event_hex_map.get(event_id)
            fraud_score = _derive_fraud_score(c, flag_score_dict.get(c['id'], []))

            dci_score = event_dci_map.get(event_id) if event_id else None
            if dci_score is None and event_hex:
                dci_score = zone_dci_map.get(event_hex)
            if dci_score is None:
                dci_score = 0.0

            result.append({
                "claim_id": c['id'],
                "created_at": c['created_at'],
                "worker_name": c_worker.get('name', 'Unknown Worker'),
                "city": c_worker.get('city', 'Unknown City'),
                "status": c.get('status', 'unknown'),
                "resolution_path": c.get('resolution_path', 'unknown'),
                "fraud_score": fraud_score,
                "dci_score": round(float(dci_score), 3),
                "payout": float(c.get('payout_amount') or 0.0),
                "flags": flags_dict.get(c['id'], [])
            })
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/policies/stats")
def get_policy_stats():
    try:
        # Reuse KPI logic for policy stats
        pol_res = supabase.table('policies').select('id', count='exact').eq('status', 'active').execute()
        active_nodes = pol_res.count if pol_res.count is not None else len(pol_res.data)

        prem_res = supabase.table('policies').select('weekly_premium').eq('status', 'active').execute()
        total_value_locked = sum(float(p.get('weekly_premium') or 0.0) for p in (prem_res.data or []))

        claims_res = (
            supabase.table('claims')
            .select('payout_amount,status')
            .in_('status', ['approved', 'paid'])
            .execute()
        )
        total_claims_paid = sum(float(c.get('payout_amount') or 0.0) for c in (claims_res.data or []))
        
        loss_ratio = (total_claims_paid / total_value_locked) if total_value_locked > 0 else 0.0
        
        return {
            "total_value_locked": round(total_value_locked, 2),
            "active_nodes": active_nodes,
            "loss_ratio": round(loss_ratio, 2)
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/policies/tiers")
def get_policy_tiers():
    try:
        # Mock tier data based on policies - in real app, this would be from policy tiers table
        pol_res = supabase.table('policies').select('coverage_cap_daily').eq('status', 'active').execute()
        policies = pol_res.data or []
        
        # Group by coverage ranges
        tiers = {
            'Tier 1 Basic': {'min': 0, 'max': 600, 'count': 0, 'total_coverage': 0},
            'Tier 2 Standard': {'min': 600, 'max': 1500, 'count': 0, 'total_coverage': 0},
            'Tier 3 Premium': {'min': 1500, 'max': float('inf'), 'count': 0, 'total_coverage': 0}
        }
        
        for p in policies:
            coverage = float(p.get('coverage_cap_daily') or 0)
            for tier_name, tier_data in tiers.items():
                if tier_data['min'] <= coverage < tier_data['max']:
                    tier_data['count'] += 1
                    tier_data['total_coverage'] += coverage
                    break
        
        result = []
        for tier_name, tier_data in tiers.items():
            avg_coverage = tier_data['total_coverage'] / tier_data['count'] if tier_data['count'] > 0 else 0
            result.append({
                'tier': tier_name,
                'workers': tier_data['count'],
                'avg_coverage': round(avg_coverage, 2)
            })

        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fraud/metrics")
def get_fraud_metrics():
    try:
        # Calculate fraud metrics from claims and fraud_flags
        claims_res = supabase.table('claims').select('worker_id,fraud_score').execute()
        claims = claims_res.data or []
        
        if claims:
            avg_fraud_score = sum(float(c.get('fraud_score') or 0) for c in claims) / len(claims)
        else:
            avg_fraud_score = 0.0
        
        # Mock locations - count claims with high fraud scores (proxy for mock locations)
        mock_locations_24h = sum(1 for c in claims if (c.get('fraud_score') or 0) > 70)
        
        # Velocity violations - count claims with very high fraud scores
        velocity_violations = sum(1 for c in claims if (c.get('fraud_score') or 0) > 80)
        
        # Blacklisted devices - count unique workers with multiple high-fraud claims
        worker_fraud_count = {}
        for c in claims:
            worker_id = c.get('worker_id')
            if worker_id and (c.get('fraud_score') or 0) > 60:
                worker_fraud_count[worker_id] = worker_fraud_count.get(worker_id, 0) + 1
        
        blacklisted_devices = sum(1 for count in worker_fraud_count.values() if count >= 3)
        
        return {
            "avg_fraud_score": round(avg_fraud_score, 1),
            "mock_locations_24h": mock_locations_24h,
            "velocity_violations": velocity_violations,
            "blacklisted_devices": blacklisted_devices
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fraud/signals")
def get_fraud_signals():
    try:
        # Get fraud flags distribution
        flags_res = supabase.table('fraud_flags').select('flag_type').execute()
        flags = flags_res.data or []
        
        signal_counts = {}
        for f in flags:
            flag_type = f.get('flag_type', 'UNKNOWN')
            signal_counts[flag_type] = signal_counts.get(flag_type, 0) + 1
        
        total_flags = len(flags)
        signals = []
        for signal, count in signal_counts.items():
            density = (count / total_flags * 100) if total_flags > 0 else 0
            signals.append({
                'label': signal,
                'value': round(density, 0)
            })
        
        # Ensure we have some default signals if none
        if not signals:
            signals = [
                {'label': 'STATIC_DEVICE_FLAG', 'value': 84},
                {'label': 'MODEL_CONCENTRATION', 'value': 62},
                {'label': 'HEX_JUMPING_VELOCITY', 'value': 41},
                {'label': 'ROOT_KIT_DETECTION', 'value': 12},
            ]
        
        return signals
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fraud/workers")
def get_fraud_workers():
    try:
        # Get workers with high fraud scores
        claims_res = (
            supabase.table('claims')
            .select('worker_id, fraud_score, created_at')
            .gt('fraud_score', 50)
            .order('fraud_score', desc=True)
            .limit(10)
            .execute()
        )
        claims = claims_res.data or []
        
        worker_ids = list(set(c.get('worker_id') for c in claims if c.get('worker_id')))
        workers_dict: dict[str, dict] = {}
        
        if worker_ids:
            workers_res = supabase.table('workers').select('id, name, city').in_('id', worker_ids).execute()
            for w in (workers_res.data or []):
                workers_dict[w['id']] = w
        
        # Mock violations and risk levels based on fraud score
        result = []
        for c in claims[:10]:  # Limit to 10
            worker_id = c.get('worker_id')
            fraud_score = c.get('fraud_score', 0)
            
            if fraud_score > 80:
                risk = 'CRITICAL'
                violation = 'Mock Location Overflow'
            elif fraud_score > 65:
                risk = 'HIGH'
                violation = 'Velocity Anomaly'
            else:
                risk = 'MEDIUM'
                violation = 'Multi-Account Hash Match'
            
            # Mock last active time
            last_active = f"{(fraud_score % 60) + 1}m ago"
            
            result.append({
                'id': worker_id or 'UNKNOWN',
                'display_id': (worker_id or 'UNKNOWN')[:8].upper(),
                'name': workers_dict.get(worker_id, {}).get('name') or 'Unknown Worker',
                'city': workers_dict.get(worker_id, {}).get('city') or 'Unknown City',
                'violation': violation,
                'risk': risk,
                'fraud_score': float(fraud_score),
                'lastActive': last_active
            })
        
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fraud/events")
def get_fraud_events():
    try:
        from backend.services.notification_service import notification_service

        # Get recent fraud flags as events
        flags_res = supabase.table('fraud_flags').select('flag_type').order('id', desc=True).limit(10).execute()
        flags = flags_res.data or []
        
        events = []
        for f in flags:
            flag_type = f.get('flag_type', 'UNKNOWN_FLAG')
            # Format as event messages
            event_msg = f"FLAG_TRIGGERED — {flag_type.replace('_', ' ').title()}"
            events.append(event_msg)
        
        # If no real events, provide mock ones
        if not events:
            events = [
                'FLAG_TRIGGERED — Mock GPS',
                'AUTH_ANOMALY — Rooted Android',
                'VELOCITY_VIOLATION — 45 km/h spike',
                'FRAUD_TRIGGERED — Emulator detect',
                'IP_GEO_MISMATCH detected',
                'CRITICAL_ALERT — Multi-login',
            ]

        admin_events = notification_service.list_admin_alerts(limit=10)
        if admin_events:
            events = admin_events + events
        
        return events
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
