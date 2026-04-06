from datetime import datetime, timezone
import json
import logging
from backend.db.client import supabase
from backend.db.supabase_retry import execute_with_retry

logger = logging.getLogger("api")

def check_trigger_transitions(hex_id: str, new_dci: float):
    """
    Detects when a Hex Zone breaches the `0.85` threshold (opening an event) 
    or drops below `0.65` for 2 consecutive cycles (closing an event via hysteresis).
    """
    try:
        res = execute_with_retry(
            lambda: supabase.table('hex_zones').select('is_disrupted', 'consecutive_normal_cycles').eq('h3_index', hex_id).execute(),
            op_name=f"trigger_monitor:fetch_zone:{hex_id}",
        )
        if not res.data:
            return
            
        zone = res.data[0]
        is_disrupted = zone.get('is_disrupted', False)
        consecutive_normal_cycles = zone.get('consecutive_normal_cycles', 0)
        
        if not is_disrupted and new_dci > 0.85:
            # TRIGGER OPEN DISRUPTION EVENT
            logger.info(f"Triggering HOT Disruption Event for zone {hex_id}!")
            execute_with_retry(
                lambda: supabase.table('hex_zones').update({
                    'is_disrupted': True,
                    'consecutive_normal_cycles': 0
                }).eq('h3_index', hex_id).execute(),
                op_name=f"trigger_monitor:open_update:{hex_id}",
            )
            
            _open_disruption_event(hex_id, new_dci)
            
        elif is_disrupted:
            if new_dci < 0.65:
                consecutive_normal_cycles += 1
                if consecutive_normal_cycles >= 2:
                    # CLOSE DISRUPTION EVENT strictly after hysteresis limit is met
                    logger.info(f"Closing Disruption Event for zone {hex_id} (Hysteresis met).")
                    execute_with_retry(
                        lambda: supabase.table('hex_zones').update({
                            'is_disrupted': False,
                            'consecutive_normal_cycles': 0
                        }).eq('h3_index', hex_id).execute(),
                        op_name=f"trigger_monitor:close_update:{hex_id}",
                    )
                    
                    _close_disruption_event(hex_id)
                else:
                    execute_with_retry(
                        lambda: supabase.table('hex_zones').update({
                            'consecutive_normal_cycles': consecutive_normal_cycles
                        }).eq('h3_index', hex_id).execute(),
                        op_name=f"trigger_monitor:increment_normal_cycles:{hex_id}",
                    )
            else:
                # Reset counts if it spikes back up
                if consecutive_normal_cycles > 0:
                     execute_with_retry(
                         lambda: supabase.table('hex_zones').update({
                             'consecutive_normal_cycles': 0
                         }).eq('h3_index', hex_id).execute(),
                         op_name=f"trigger_monitor:reset_normal_cycles:{hex_id}",
                     )

    except Exception as e:
        logger.error(f"Failed to check trigger transitions for hex {hex_id}: {e}")

def get_active_policyholders_in_hex(hex_id: str) -> list[dict]:
    """
    Queries `workers` + `policies` mapping all workers inside the hex boundary with an active policy.
    Returns list of dicts: [{'worker_id': id, 'policy_id': id}]
    """
    try:
        workers_res = None
        try:
            workers_res = execute_with_retry(
                lambda: supabase.table('workers').select('id, device_token').eq('hex_id', hex_id).eq('status', 'active').execute(),
                op_name=f"trigger_monitor:fetch_workers_hex_id:{hex_id}",
            )
        except Exception:
            workers_res = execute_with_retry(
                lambda: supabase.table('workers').select('id, device_token').eq('home_hex', hex_id).eq('status', 'active').execute(),
                op_name=f"trigger_monitor:fetch_workers_home_hex:{hex_id}",
            )
        worker_map = {w['id']: w.get('device_token') for w in workers_res.data}
        worker_ids = list(worker_map.keys())
        
        if not worker_ids:
            return []
            
        policies_res = execute_with_retry(
            lambda: supabase.table('policies').select('worker_id', 'id').in_('worker_id', worker_ids).eq('status', 'active').execute(),
            op_name=f"trigger_monitor:fetch_policies:{hex_id}",
        )
        return [{'worker_id': p['worker_id'], 'id': p['id'], 'device_token': worker_map.get(p['worker_id'])} for p in policies_res.data]
    except Exception as e:
        logger.error(f"Error fetching policy holders in hex {hex_id}: {e}")
        return []

def _open_disruption_event(hex_id: str, dci_peak: float):
    # 1. Create the `disruption_events` record
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        event_res = execute_with_retry(
            lambda: supabase.table('disruption_events').insert({
                'hex_id': hex_id,
                'h3_index': hex_id,
                'dci_peak': dci_peak,
                'started_at': now_iso,
                'trigger_signals': {"note": "Triggered by engine loop crossing 0.85 threshold"}
            }).execute(),
            op_name=f"trigger_monitor:open_event:{hex_id}",
        )
        
        if not event_res.data:
            return
            
        event_id = event_res.data[0]['id']
        
        # 2. Get exposed policyholders
        active_policies = get_active_policyholders_in_hex(hex_id)
        
        # 3. Insert blank pending Claims for all of them
        for pol in active_policies:
            try:
                execute_with_retry(
                    lambda: supabase.table('claims').insert({
                        'worker_id': pol['worker_id'],
                        'policy_id': pol['id'],
                        'event_id': event_id,
                        'status': 'pending',
                        # Provisional defaults; claim approver will overwrite with final path/score.
                        'resolution_path': 'soft_queue',
                        'fraud_score': 30,
                    }).execute(),
                    op_name=f"trigger_monitor:create_claim:{pol['worker_id']}",
                )
                
                # TRIGGER FCM HERE (Phase 12)
                device_token = pol.get('device_token')
                if device_token:
                    from backend.services.notification_service import notification_service
                    notification_service.notify_elevated_watch(device_token, hex_id, "DISRUPTED")
                    
            except Exception as e:
                logger.error(f"Failed to bind initial Claim for worker {pol['worker_id']}: {e}")
                
    except Exception as e:
        logger.error(f"Failed opening disruption event for {hex_id}: {e}")

def _close_disruption_event(hex_id: str):
    # 1. Find the currently active (no ended_at) disruption_event
    try:
        event_res = execute_with_retry(
            lambda: supabase.table('disruption_events').select('*').eq('hex_id', hex_id).is_('ended_at', 'null').execute(),
            op_name=f"trigger_monitor:find_open_event:{hex_id}",
        )
        if not event_res.data:
            return
            
        event = event_res.data[0]
        event_id = event['id']
        
        start_time = datetime.fromisoformat(event['started_at'].replace('Z', '+00:00'))
        end_time = datetime.now(timezone.utc)
        duration_hrs = (end_time - start_time).total_seconds() / 3600.0
        
        # 2. Close it
        execute_with_retry(
            lambda: supabase.table('disruption_events').update({
                'ended_at': end_time.isoformat(),
                'duration_hours': round(duration_hrs, 2)
            }).eq('id', event_id).execute(),
            op_name=f"trigger_monitor:close_event:{event_id}",
        )
        
        # 3. Trigger Claim Approver Pipeline dynamically for all pending claims attached!
        # Deferred import resolving circular dependency bounds gracefully
        from backend.services.claim_approver import process_claim
        
        claims_res = execute_with_retry(
            lambda: supabase.table('claims').select('id', 'worker_id', 'policy_id').eq('event_id', event_id).execute(),
            op_name=f"trigger_monitor:list_claims:{event_id}",
        )
        for c in claims_res.data:
            process_claim(c['worker_id'], event_id, c['policy_id'])
            
    except Exception as e:
        logger.error(f"Failed shutting down event cleanly for {hex_id}: {e}")
