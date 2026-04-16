import logging
from backend.db.client import supabase
from backend.services.policy_manager import renew_policy
from backend.services.payment_service import debit_premium_mock

logger = logging.getLogger("api")

def run_monday_policy_cycle():
    """
    Executed dynamically strictly on Mondays 00:00.
    1. Grabs all active workers.
    2. Renews their risk policy bounds checking the physical XGBoost model for current tier mappings.
    3. Calculates raw rupee premium amounts.
    4. Triggers the Razorpay Debit securely withdrawing from their wallet.
    """
    logger.info("Initializing Weekly Monday 00:00 Policy Cycle...")
    
    # 1. Grabs all active workers securely
    try:
        workers_res = supabase.table('workers').select('id, name, upi_id').eq('status', 'active').execute()
        if not workers_res.data:
            logger.info("No active workers in database. Skipping cycle.")
            return
            
        success_count = 0
            
        for worker in workers_res.data:
             worker_id = worker['id']
             upi = worker['upi_id']
             
             # 2. Renew their structural bounds
             try:
                 new_policy = renew_policy(worker_id)
                 if new_policy:
                     premium = new_policy.get('weekly_premium', 0.0)
                     
                     # 3/4. Run automatic Debit process mimicking Razorpay mandates 
                     debit_premium_mock(upi, premium, worker_id)
                     success_count += 1
                     
             except Exception as policy_err:
                 logger.error(f"Failed handling Monday Rollover for Worker {worker_id}: {policy_err}")
                 
        logger.info(f"Monday Cycle completed completely terminating. Mapped {success_count} renewed workers.")
        
    except Exception as db_err:
        logger.error(f"Failed fetching active workers during cycle boot: {db_err}")

def run_sunday_forecast_cycle():
    """
    Run on Sundays to send proactive tier-upgrade nudges based on recent
    worker-level DCI trends (instead of mock broadcast notifications).
    """
    logger.info("Initializing Sunday Tier Upgrade Forecast Cycle...")
    try:
        from backend.services.notification_service import notification_service

        workers_res = (
            supabase.table('workers')
            .select('id,name,fcm_token,hex_id,home_hex')
            .eq('status', 'active')
            .execute()
        )

        count = 0
        for worker in workers_res.data or []:
            token = worker.get('fcm_token')
            if not token:
                continue

            hex_id = worker.get('hex_id') or worker.get('home_hex')
            if not hex_id:
                continue

            hist_res = (
                supabase.table('dci_history')
                .select('dci_score,computed_at')
                .eq('hex_id', hex_id)
                .order('computed_at', desc=True)
                .limit(14)
                .execute()
            )
            history = hist_res.data or []
            if len(history) < 6:
                continue

            scores = [float(row.get('dci_score') or 0.0) for row in history]
            latest_window = scores[:7]
            prior_window = scores[7:14] if len(scores) >= 14 else scores[3:10]
            if not prior_window:
                continue

            latest_avg = sum(latest_window) / len(latest_window)
            prior_avg = sum(prior_window) / len(prior_window)

            # Notify when risk trend is materially improving.
            if latest_avg <= 0.45 and (prior_avg - latest_avg) >= 0.08:
                notification_service.notify_tier_upgrade(token, "B", "A")
                count += 1

        logger.info(f"Sunday Forecast completed. Sent {count} tier upgrade offers.")
    except Exception as e:
        logger.error(f"Sunday forecast cycle failed: {e}")

def run_sunday_xgboost_retrain():
    """
    Weekly automated MLOps pipeline executing on Sundays to refresh all
    model artifacts used by runtime decisions.
    """
    logger.info("Initializing Sunday ML Retraining Pipeline...")
    try:
        from backend.services.risk_profiler import train_and_save_model
        from backend.ml.train_fraud_model import train_model as train_fraud_model
        from backend.services.dci_weight_trainer import run_dci_weight_optimization

        train_and_save_model()
        train_fraud_model()
        weight_result = run_dci_weight_optimization()
        logger.info(
            "ML retraining completed | risk_profiler=ok | fraud_model=ok | "
            f"dci_weight_status={weight_result.get('status')}"
        )
    except Exception as e:
        logger.error(f"ML retraining cycle failed: {e}")


def run_fraud_threshold_retrain():
    """
    Weekly fraud threshold recalibration.

    Reads all rows from fraud_feedback, recomputes APPROVE/DENY thresholds
    using the weighted-average algorithm in fraud_engine.refresh_adaptive_thresholds,
    and resets the in-process TTL cache so the next inference request picks
    up the fresh thresholds immediately.

    Scheduled: Sunday 22:00 (before XGBoost retrain at 23:00).
    """
    logger.info("[fraud_threshold_retrain] Starting weekly threshold recalibration...")
    try:
        from backend.services.fraud_engine import refresh_adaptive_thresholds, _thresholds

        state = refresh_adaptive_thresholds()

        logger.info(
            f"[fraud_threshold_retrain] Recalibration complete "
            f"| samples={state.sample_count} "
            f"| approve_threshold={state.approve:.1f} "
            f"| deny_threshold={state.deny:.1f} "
            f"| override_rate={state.override_rate:.1%}"
        )

        # Emit a DB-level audit row so the ops team can track threshold drift.
        try:
            supabase.table("fraud_threshold_audit").insert({
                "approve_threshold": state.approve,
                "deny_threshold":    state.deny,
                "sample_count":      state.sample_count,
                "override_rate":     state.override_rate,
            }).execute()
        except Exception:
            # Table may not exist yet — non-fatal, log and continue.
            logger.debug("[fraud_threshold_retrain] Audit table not available yet, skipping.")

    except Exception as e:
        logger.error(f"[fraud_threshold_retrain] Recalibration failed: {e}")

