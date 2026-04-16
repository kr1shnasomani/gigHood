import os
import pickle
import threading
import logging
import random
from typing import List

import numpy as np
import pandas as pd
import xgboost as xgb

from backend.config import settings
from backend.services.feature_store import get_worker_features
logger = logging.getLogger("risk_profiler")

# =========================================================
# PATH RESOLUTION
# =========================================================
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

def _resolve_path(path_value: str) -> str:
    if os.path.isabs(path_value):
        return path_value
    return os.path.abspath(os.path.join(PROJECT_ROOT, path_value))


# ✅ VERSIONED MODEL PATH
def get_model_path():
    version = settings.RISK_MODEL_VERSION
    return _resolve_path(f"backend/ml/models/risk_model_{version}.json")


MODEL_PATH_JSON = get_model_path()
MODEL_PATH_PKL = _resolve_path(settings.RISK_PROFILER_MODEL_PKL_PATH)
DATASET_PATH = _resolve_path(settings.RISK_PROFILER_DATASET_PATH)


# =========================================================
# THREAD-SAFE MODEL CACHE
# =========================================================
_model = None
_model_lock = threading.Lock()


# =========================================================
# STATIC CITY RISK
# =========================================================
CITY_FLOOD_PROXIMITY = {
    "Bengaluru": 0.35,
    "Chennai": 0.75,
    "Mumbai": 0.80,
    "Delhi": 0.65,
    "Jaipur": 0.15,
    "Hyderabad": 0.40,
    "Lucknow": 0.45,
    "Kolkata": 0.70,
    "Guwahati": 0.65
}

def predict_tier_from_store(worker_id: str, fallback_inputs: dict = None):
    """
    Fetch features dynamically from feature store and compute tier.
    Falls back to provided inputs if missing.
    """

    features = get_worker_features(worker_id)

    if not features and fallback_inputs:
        features = fallback_inputs

    if not features:
        # Hard fallback (cold start)
        return "B"

    worker_hex_history = features.get("dci_history", [])
    seasonal_flag = features.get("seasonal_flag", False)
    city = features.get("city", "Bengaluru")
    claim_frequency = features.get("claim_frequency", 0.2)

    return predict_tier(
        worker_hex_history=worker_hex_history,
        seasonal_flag=seasonal_flag,
        city=city,
        claim_frequency=claim_frequency,
        worker_id=worker_id
    )

# =========================================================
# A/B TESTING
# =========================================================
def is_ab_user(worker_id: str) -> bool:
    random.seed(worker_id)
    return random.random() < settings.AB_TEST_RATIO


# =========================================================
# TRAIN MODEL
# =========================================================
def train_and_save_model():
    df = pd.read_csv(DATASET_PATH)

    dci_cols = [f"dci_w{i}" for i in range(1, 13)]
    df["dci_avg"] = df[dci_cols].mean(axis=1)

    if "claim_frequency" in df.columns:
        df.drop(columns=["claim_frequency"], inplace=True)

    df.rename(columns={
        "is_high_risk_season": "seasonal_flag",
        "historical_claim_freq": "claim_frequency"
    }, inplace=True)

    tier_map = {"Tier A": 0, "Tier B": 1, "Tier C": 2}
    df["tier"] = df["target_tier"].map(tier_map)

    X = df[["dci_avg", "seasonal_flag", "flood_proximity_score", "claim_frequency"]]
    y = df["tier"]

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        eval_metric="mlogloss",
        random_state=42
    )

    model.fit(X, y)

    os.makedirs(os.path.dirname(get_model_path()), exist_ok=True)
    model.save_model(get_model_path())

    logger.info(f"Model saved → {get_model_path()}")


# =========================================================
# LOAD MODEL
# =========================================================
def load_model():
    global _model

    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model

        if not os.path.exists(get_model_path()):
            if os.path.exists(MODEL_PATH_PKL):
                with open(MODEL_PATH_PKL, "rb") as f:
                    migrated = pickle.load(f)
                migrated.save_model(get_model_path())
            else:
                train_and_save_model()

        model = xgb.XGBClassifier()
        model.load_model(get_model_path())

        _model = model
        return _model


# =========================================================
# PREDICT TIER
# =========================================================
def predict_tier(
    worker_hex_history: List[float],
    seasonal_flag: bool,
    city: str,
    claim_frequency: float,
    worker_id: str = "default"
) -> str:

    model = load_model()

    dci_avg = float(np.mean(worker_hex_history)) if worker_hex_history else 0.0
    dci_avg = max(0.0, min(dci_avg, 1.0))

    claim_frequency = max(0.0, min(claim_frequency, 1.0))
    season_int = 1 if seasonal_flag else 0

    flood_score = CITY_FLOOD_PROXIMITY.get(city, 0.35)

    df_inf = pd.DataFrame([{
        "dci_avg": dci_avg,
        "seasonal_flag": season_int,
        "flood_proximity_score": flood_score,
        "claim_frequency": claim_frequency
    }])

    pred = model.predict(df_inf)[0]
    mapping = {0: "A", 1: "B", 2: "C"}
    ml_tier = mapping.get(int(pred), "B")

    # RULE SYSTEM
    if dci_avg >= 0.65 and flood_score >= 0.70:
        rule_tier = "C"
    elif dci_avg >= 0.50 or (dci_avg >= 0.45 and flood_score >= 0.60):
        rule_tier = "B"
    else:
        rule_tier = "A"

    order = {"A": 0, "B": 1, "C": 2}

    # ✅ A/B TESTING
    if settings.ENABLE_AB_TESTING and is_ab_user(worker_id):
        final_tier = ml_tier
        mode = "ML"
    else:
        final_tier = rule_tier if order[rule_tier] > order[ml_tier] else ml_tier
        mode = "HYBRID"

    logger.info(f"[AB_TEST] worker={worker_id} mode={mode} tier={final_tier}")

    return final_tier


# =========================================================
# EXPLAINABILITY
# =========================================================
def explain_tier(worker_hex_history, seasonal_flag, city, claim_frequency, worker_id="default"):

    dci_avg = float(np.mean(worker_hex_history)) if worker_hex_history else 0.0
    flood_score = CITY_FLOOD_PROXIMITY.get(city, 0.35)

    reasons = []

    if dci_avg > 0.6:
        reasons.append(f"High disruption score ({round(dci_avg, 2)})")

    if flood_score > 0.7:
        reasons.append(f"High flood risk in {city}")

    if claim_frequency > 0.5:
        reasons.append("Frequent past claims")

    if seasonal_flag:
        reasons.append("High-risk seasonal period")

    tier = predict_tier(
        worker_hex_history,
        seasonal_flag,
        city,
        claim_frequency,
        worker_id
    )

    return {
        "tier": tier,
        "reasons": reasons,
        "confidence": round(dci_avg, 2)
    }