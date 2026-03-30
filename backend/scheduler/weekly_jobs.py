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
    Run on Sundays to mock-forecast DCI probabilities and send proactive Tier Upgrade
    pushes to users who show improved safety trends before Monday's renewal.
    """
    logger.info("Initializing Sunday Tier Upgrade Forecast Cycle...")
    try:
        from backend.services.notification_service import notification_service
        # Fetch active workers
        workers_res = supabase.table('workers').select('id, name, fcm_token').eq('status', 'active').execute()
        
        count = 0
        for worker in workers_res.data:
            if worker.get('fcm_token'):
                # Mock logic: we pretend the backend predicted they can upgrade from B -> A
                # In production this calls a timeseries forecast model
                notification_service.notify_tier_upgrade(worker['fcm_token'], "B", "A")
                count += 1
                
        logger.info(f"Sunday Forecast completed. Sent {count} tier upgrade offers.")
    except Exception as e:
        logger.error(f"Sunday forecast cycle failed: {e}")

def run_sunday_xgboost_retrain():
    """
    Weekly automated MLOps pipeline executing on Sundays to refresh the model 
    weights on the latest collected data.
    """
    logger.info("Initializing Sunday XGBoost Auto-Retrain Pipeline...")
    try:
        from backend.services.risk_profiler import train_and_save_model
        train_and_save_model()
        logger.info("XGBoost retraining successfully completed.")
    except Exception as e:
        logger.error(f"XGBoost retraining cycle failed: {e}")
