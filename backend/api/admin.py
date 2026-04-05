import traceback
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from backend.db.client import supabase

router = APIRouter()

@router.get("/dashboard/kpis")
def get_kpis():
    try:
        # 1. Active policies count
        pol_res = supabase.table('policies').select('id', count='exact').eq('status', 'active').execute()
        active_policies = pol_res.count if pol_res.count is not None else len(pol_res.data)
        
        # 2. Total premium collected
        prem_res = supabase.table('premium_payments').select('amount').execute()
        total_premium = sum(float(p['amount']) for p in prem_res.data) if prem_res.data else 0.0
        
        # 3. Total claims paid
        claims_res = supabase.table('claims').select('payout_amount').eq('status', 'paid').execute()
        total_claims_paid = sum(float(c['payout_amount'] or 0.0) for c in claims_res.data) if claims_res.data else 0.0
        
        # 4. System Loss Ratio
        loss_ratio = (total_claims_paid / total_premium * 100) if total_premium > 0 else 0.0
        
        return {
            "active_policies": active_policies,
            "total_premium": total_premium,
            "total_claims_paid": total_claims_paid,
            "system_loss_ratio": round(loss_ratio, 2)
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
    # Mock data for 7-day predictive risk forecast
    return [
        {"city": "Bengaluru", "risk": 85},
        {"city": "Chennai", "risk": 40},
        {"city": "Mumbai", "risk": 15},
        {"city": "Delhi", "risk": 20},
    ]

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
            'id, created_at, status, resolution_path, fraud_score, worker_id, payout_amount'
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

        if event_ids:
            event_res = supabase.table('disruption_events').select('id,hex_id').in_('id', event_ids).execute()
            for e in (event_res.data or []):
                if e.get('id') and e.get('hex_id'):
                    event_hex_map[e['id']] = e['hex_id']

        if event_hex_map:
            hex_ids = list(set(event_hex_map.values()))
            zone_res = supabase.table('hex_zones').select('hex_id,current_dci').in_('hex_id', hex_ids).execute()
            for z in (zone_res.data or []):
                if z.get('hex_id'):
                    zone_dci_map[z['hex_id']] = float(z.get('current_dci') or 0.0)

        flags_dict = {cid: [] for cid in claim_ids}
        if claim_ids:
            flags_res = supabase.table('fraud_flags').select('claim_id, flag_type').in_('claim_id', claim_ids).execute()
            for f in (flags_res.data or []):
                if f['claim_id'] in flags_dict:
                    flags_dict[f['claim_id']].append(f['flag_type'])
                    
        result = []
        for c in claims_data:
            c_worker = workers_dict.get(c['worker_id'], {})
            event_hex = event_hex_map.get(c.get('event_id'))
            result.append({
                "claim_id": c['id'],
                "created_at": c['created_at'],
                "worker_name": c_worker.get('name', 'Unknown Worker'),
                "city": c_worker.get('city', 'Unknown City'),
                "status": c.get('status', 'unknown'),
                "resolution_path": c.get('resolution_path', 'unknown'),
                "fraud_score": c.get('fraud_score', 0),
                "dci_score": zone_dci_map.get(event_hex, 0.0),
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
        
        prem_res = supabase.table('premium_payments').select('amount').execute()
        total_value_locked = sum(float(p['amount']) for p in prem_res.data) if prem_res.data else 0.0
        
        claims_res = supabase.table('claims').select('payout_amount').eq('status', 'paid').execute()
        total_claims_paid = sum(float(c['payout_amount'] or 0.0) for c in claims_res.data) if claims_res.data else 0.0
        
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
        claims_res = supabase.table('claims').select('fraud_score').execute()
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
        claims_res = supabase.table('claims').select('worker_id, fraud_score, created_at').gt('fraud_score', 50).order('fraud_score', desc=True).limit(10).execute()
        claims = claims_res.data or []
        
        worker_ids = list(set(c.get('worker_id') for c in claims if c.get('worker_id')))
        workers_dict = {}
        
        if worker_ids:
            workers_res = supabase.table('workers').select('id, name').in_('id', worker_ids).execute()
            for w in (workers_res.data or []):
                workers_dict[w['id']] = w.get('name', 'Unknown')
        
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
                'violation': violation,
                'risk': risk,
                'lastActive': last_active
            })
        
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fraud/events")
def get_fraud_events():
    try:
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
        
        return events
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
