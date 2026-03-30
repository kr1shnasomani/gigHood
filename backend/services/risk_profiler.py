import os
import pickle
import numpy as np
import pandas as pd
import xgboost as xgb
import logging

logger = logging.getLogger("api")

ML_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml")
MODEL_PATH = os.path.join(ML_DIR, "risk_profiler.pkl")

# Global in-memory cache for the loaded model to prevent I/O blocking
_model = None



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
    
    # Serialize model securely
    os.makedirs(ML_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
        
    logger.info(f"Successfully trained and serialized XGBoost model to {MODEL_PATH}")

def load_model():
    """
    Loads and caches the XGBoost model. If the file is missing, automatically train it.
    """
    global _model
    if _model is not None:
        return _model
        
    if not os.path.exists(MODEL_PATH):
        logger.warning(f"XGBoost model file {MODEL_PATH} missing. Automatically triggering training cycle...")
        train_and_save_model()
        
    with open(MODEL_PATH, "rb") as f:
        _model = pickle.load(f)
        
    return _model

def predict_tier(worker_hex_history: list[float], seasonal_flag: bool, flood_proximity: float, claim_frequency: float) -> str:
    """
    Computes the insurance risk Tier ('A', 'B', or 'C') based on physical properties of the assigned Hex zone.
    """
    model = load_model()
    
    # Extract the average of the 12-week history array, fallback to 0.0 if empty
    dci_avg = float(np.mean(worker_hex_history)) if worker_hex_history else 0.0
    season_int = 1 if seasonal_flag else 0
    
    # Construct singleton DataFrame explicitly mirroring training schema
    # We must normalize the raw distance (meters) into the 0.0-1.0 risk score used in the new synthetic schema
    # where 0.0 = 5000m (safe), 1.0 = 0m (high chance of flood)
    normalized_flood_score = max(0.0, (5000.0 - flood_proximity) / 5000.0)
    
    df_inf = pd.DataFrame([{
        "dci_avg": dci_avg,
        "seasonal_flag": season_int,
        "flood_proximity_score": normalized_flood_score,
        "claim_frequency": claim_frequency
    }])
    
    # Predict deterministic class
    pred = model.predict(df_inf)[0]
    
    # Safely route the predicted integer back to String Tier definitions
    mapping = {0: 'A', 1: 'B', 2: 'C'}
    return mapping.get(int(pred), 'B') # Fallback safely to B if corrupted prediction occurs
