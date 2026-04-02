import logging
import traceback
from apscheduler.schedulers.background import BackgroundScheduler
from backend.services.signal_fetchers import run_signal_ingestion_cycle
from backend.services.dci_engine import run_dci_cycle
from backend.db.client import supabase
from backend.config import settings

logger = logging.getLogger("api")

def fetch_all_hexes() -> list[str]:
    """Helper to get the current system hex IDs dynamically for the jobs."""
    try:
        # Current schema uses h3_index as canonical zone id.
        response = supabase.table('hex_zones').select('h3_index').execute()
        rows = response.data or []
        hexes = [row.get('h3_index') for row in rows if row.get('h3_index')]
        return hexes
    except Exception as e:
        logger.error(f"Failed to fetch hex zones for scheduler: {e}")
        logger.error(traceback.format_exc())
        return []

def signal_job():
    logger.info("Starting scheduled signal ingestion cycle...")
    hexes = fetch_all_hexes()
    if not hexes:
        logger.warning("No hex zones found. Skipping signal ingestion.")
        return
    res = run_signal_ingestion_cycle(hexes)
    logger.info(f"Signal cycle complete for {len(res)} zones.")

def dci_job():
    logger.info("Starting scheduled DCI computation cycle...")
    hexes = fetch_all_hexes()
    if not hexes:
        logger.warning("No hex zones found. Skipping DCI computation.")
        return
        
    res = run_dci_cycle(hexes)
    logger.info(f"DCI cycle complete for {len(res)} zones.")
    logger.info(f"DCI cycle complete for {len(res)} zones.")

from backend.scheduler.weekly_jobs import run_monday_policy_cycle, run_sunday_forecast_cycle, run_sunday_xgboost_retrain

def premium_debit_job():
    logger.info("Running weekly Premium Debit job...")
    run_monday_policy_cycle()

def forecast_alert_stub():
    logger.info("Running Sunday evening forecast notification...")
    run_sunday_forecast_cycle()

def xgboost_retrain_stub():
    logger.info("Running XGBoost weekly retraining pipeline...")
    run_sunday_xgboost_retrain()

# Create the global scheduler instance
scheduler = BackgroundScheduler()

# Register the 5-minute repeating jobs
# T+0: Ingestion
scheduler.add_job(
    signal_job,
    'cron',
    minute=settings.SIGNAL_JOB_CRON_MINUTE,
    id='signal_ingestion',
    replace_existing=True,
    max_instances=settings.SCHEDULER_MAX_INSTANCES,
    coalesce=settings.SCHEDULER_COALESCE,
    misfire_grace_time=settings.SCHEDULER_MISFIRE_GRACE_SECONDS,
)
# T+1: DCI Engine handles the ingested data exactly 1 minute later
# Since '*/5' offset + 1 is tricky in simple cron strings, we can use an explicit delay or staggered minute list.
# A robust staggered list: 1,6,11,16,21,26,31,36,41,46,51,56
scheduler.add_job(
    dci_job,
    'cron',
    minute=settings.DCI_JOB_CRON_MINUTE,
    id='dci_computation',
    replace_existing=True,
    max_instances=settings.SCHEDULER_MAX_INSTANCES,
    coalesce=settings.SCHEDULER_COALESCE,
    misfire_grace_time=settings.SCHEDULER_MISFIRE_GRACE_SECONDS,
)

# Stubs for subsequent phases
# Monday 00:00
scheduler.add_job(premium_debit_job, 'cron', day_of_week='mon', hour=0, minute=0, id='premium_debit_job', replace_existing=True)
# Sunday 18:00
scheduler.add_job(forecast_alert_stub, 'cron', day_of_week='sun', hour=18, minute=0, id='forecast_alert_job', replace_existing=True)
# Sunday 23:00
scheduler.add_job(xgboost_retrain_stub, 'cron', day_of_week='sun', hour=23, minute=0, id='xgboost_retrain_job', replace_existing=True)

def start_scheduler():
    if not settings.ENABLE_SCHEDULER:
        logger.info("Scheduler disabled via ENABLE_SCHEDULER=false")
        return

    scheduler.start()
    logger.info("APScheduler started.")

def shutdown_scheduler():
    if not scheduler.running:
        return

    scheduler.shutdown()
    logger.info("APScheduler stopped.")
