from apscheduler.schedulers.background import BackgroundScheduler
import logging

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

def start_scheduler():
    logger.info("Initializing APScheduler")
    if not scheduler.running:
        scheduler.start()
        logger.info("APScheduler started")

def shutdown_scheduler():
    logger.info("Shutting down APScheduler")
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler stopped")
