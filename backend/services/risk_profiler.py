import os
import pickle
import numpy as np
import pandas as pd
import xgboost as xgb
import logging

logger = logging.getLogger("api")

ML_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml")
MODEL_PATH_JSON = os.path.join(ML_DIR, "risk_profiler.json")
MODEL_PATH_PKL  = os.path.join(ML_DIR, "risk_profiler.pkl")  # legacy — migrated on first load

# Global in-memory cache for the loaded model to prevent I/O blocking
_model = None

CITY_FLOOD_PROXIMITY = {
    "Bengaluru": 0.35,
    "Chennai": 0.75,    # High — coastal + cyclone risk
    "Mumbai": 0.80,     # Very high — sea level flooding
    "Delhi": 0.65,      # AQI spikes — not flood but equally disruptive
    "Jaipur": 0.15,     # Low — dry climate
    "Hyderabad": 0.40,
    "Lucknow": 0.45,
    "Kolkata": 0.70,    # High — delta flooding
    "Guwahati": 0.65    # High — Brahmaputra flooding
}



def train_and_save_model():
    """
    Trains the XGBoost classifier on realistic data loaded from the dataset artifacts and saves weights.
    """
    logger.info("Loading realistic dataset CSV...")
    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "../dataset/synthetic_training_data.csv")
    df = pd.read_csv(csv_path)
    
    # Calculate DCI Avg dynamically
    dci_cols = [f"dci_w{i}" for i in range(1, 13)]
    df["dci_avg"] = df[dci_cols].mean(axis=1)
    
    # Rename columns to match the ML signature natively across the backend code
    df.rename(columns={
        "is_high_risk_season": "seasonal_flag",
        "historical_claim_freq": "claim_frequency"
    }, inplace=True)
    
    # Encode target tier integers
    tier_map = {"Tier A": 0, "Tier B": 1, "Tier C": 2}
    df["tier"] = df["target_tier"].map(tier_map)
    
    X = df[["dci_avg", "seasonal_flag", "flood_proximity_score", "claim_frequency"]]
    y = df["tier"]
    
    logger.info("Training XGBoost Classifier...")
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        eval_metric='mlogloss',
        random_state=42
    )
    
    model.fit(X, y)
    
    # Serialize model using XGBoost native JSON (no pickle deprecation warnings)
    os.makedirs(ML_DIR, exist_ok=True)
    model.save_model(MODEL_PATH_JSON)

    logger.info(f"Successfully trained and serialized XGBoost model to {MODEL_PATH_JSON}")

def load_model():
    """
    Loads and caches the XGBoost model using native JSON format (no pickle warnings).
    On first call, migrates any legacy .pkl to .json automatically.
    If neither exists, triggers a fresh training cycle.
    """
    global _model
    if _model is not None:
        return _model

    if not os.path.exists(MODEL_PATH_JSON):
        # One-time migration: re-save existing pkl as JSON to eliminate UserWarning
        if os.path.exists(MODEL_PATH_PKL):
            logger.info("Migrating legacy risk_profiler.pkl → risk_profiler.json (one-time)…")
            with open(MODEL_PATH_PKL, "rb") as f:
                migrated = pickle.load(f)
            migrated.save_model(MODEL_PATH_JSON)
            logger.info(f"Migration complete. JSON model saved to {MODEL_PATH_JSON}")
        else:
            logger.warning("No model file found. Triggering training cycle…")
            train_and_save_model()

    model = xgb.XGBClassifier()
    model.load_model(MODEL_PATH_JSON)
    _model = model
    return _model

def predict_tier(worker_hex_history: list[float], seasonal_flag: bool, city: str, claim_frequency: float) -> str:
    """
    Computes the insurance risk Tier ('A', 'B', or 'C') based on physical properties of the assigned Hex zone.
    """
    model = load_model()
    
    # Extract the average of the 12-week history array, fallback to 0.0 if empty
    dci_avg = float(np.mean(worker_hex_history)) if worker_hex_history else 0.0
    season_int = 1 if seasonal_flag else 0
    
    # Flood score is sourced from a deterministic city-risk lookup for the demo.
    flood_proximity_score = CITY_FLOOD_PROXIMITY.get(city, 0.35)
    
    df_inf = pd.DataFrame([{
        "dci_avg": dci_avg,
        "seasonal_flag": season_int,
        "flood_proximity_score": flood_proximity_score,
        "claim_frequency": claim_frequency
    }])
    
    # Predict deterministic class
    pred = model.predict(df_inf)[0]

    # Safely route the predicted integer back to String Tier definitions
    mapping = {0: 'A', 1: 'B', 2: 'C'}
    ml_tier = mapping.get(int(pred), 'B')  # Fallback safely to B if corrupted prediction occurs

    # Deterministic calibration layer for demo consistency:
    # - Keep low-risk dry zones in A
    # - Promote moderate DCI to at least B
    # - Promote high DCI + flood-prone cities to C
    if dci_avg >= 0.65 and flood_proximity_score >= 0.70:
        rule_tier = 'C'
    elif dci_avg >= 0.50 or (dci_avg >= 0.45 and flood_proximity_score >= 0.60):
        rule_tier = 'B'
    else:
        rule_tier = 'A'

    order = {'A': 0, 'B': 1, 'C': 2}
    return rule_tier if order[rule_tier] > order[ml_tier] else ml_tier
