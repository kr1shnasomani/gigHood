from datetime import datetime, timezone
from typing import Dict

from backend.db.client import supabase
import logging

logger = logging.getLogger("feature_store")


# =========================================================
# STORE FEATURES (WITH HISTORY MANAGEMENT)
# =========================================================
def store_worker_features(worker_id: str, new_features: Dict):
    """
    Upserts worker features with history-safe updates.
    """

    try:
        # ----------------------------
        # Fetch existing features
        # ----------------------------
        res = supabase.table("worker_features") \
            .select("features") \
            .eq("worker_id", worker_id) \
            .execute()

        existing = res.data[0]["features"] if res.data else {}

        # ----------------------------
        # Maintain DCI history 🔥
        # ----------------------------
        history = existing.get("dci_history", [])

        new_dci = new_features.get("dci_avg")

        if new_dci is not None:
            history.append(new_dci)
            history = history[-12:]  # keep last 12 values

        # ----------------------------
        # Merge features
        # ----------------------------
        merged = {
            "dci_avg": new_features.get("dci_avg", existing.get("dci_avg", 0.0)),
            "dci_history": history,
            "seasonal_flag": new_features.get("seasonal_flag", existing.get("seasonal_flag", False)),
            "city": new_features.get("city", existing.get("city", "Bengaluru")),
            "claim_frequency": new_features.get("claim_frequency", existing.get("claim_frequency", 0.2)),
            "last_updated": datetime.now(timezone.utc).isoformat()
        }

        # ----------------------------
        # Upsert into DB
        # ----------------------------
        supabase.table("worker_features").upsert({
            "worker_id": worker_id,
            "features": merged,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).execute()

        logger.info(f"[FEATURE_STORE] Updated {worker_id}")

    except Exception as e:
        logger.error(f"[FEATURE_STORE] Failed for {worker_id}: {e}")


# =========================================================
# FETCH FEATURES
# =========================================================
def get_worker_features(worker_id: str) -> Dict:
    try:
        res = supabase.table("worker_features") \
            .select("features") \
            .eq("worker_id", worker_id) \
            .execute()

        if res.data:
            return res.data[0]["features"]

    except Exception as e:
        logger.error(f"[FEATURE_STORE] Fetch failed: {e}")

    return {}