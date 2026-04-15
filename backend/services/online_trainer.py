import logging
import pandas as pd
from backend.db.client import supabase
from backend.services.risk_profiler import train_and_save_model

logger = logging.getLogger("online_trainer")

def fetch_training_data():
    res = supabase.table("training_data").select("*").execute()
    return pd.DataFrame(res.data or [])


def run_online_training():

    df = fetch_training_data()

    if len(df) < 100:
        logger.info("Not enough data for retraining")
        return

    df.to_csv("dataset/online_training.csv", index=False)

    train_and_save_model()

    logger.info("Online model retrained successfully 🚀")