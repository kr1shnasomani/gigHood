import logging
from backend.db.client import supabase
from backend.services.risk_profiler import predict_tier_from_store

logger = logging.getLogger("tier_updater")

def update_worker_tier(worker_id: str):
    """
    Automatically fetch features → predict → update tier
    """

    try:
        new_tier = predict_tier_from_store(worker_id)

        supabase.table("workers") \
            .update({"tier": new_tier}) \
            .eq("id", worker_id) \
            .execute()

        logger.info(f"Tier updated → {worker_id}: {new_tier}")

    except Exception as e:
        logger.error(f"Tier update failed for {worker_id}: {e}")