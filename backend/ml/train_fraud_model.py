import os
import joblib
import numpy as np

import pandas as pd
import xgboost as xgb
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split


FEATURE_COLUMNS = ["claim_frequency", "zone_risk", "location_anomaly", "time_of_day"]


def _derive_fraud_label(df: pd.DataFrame) -> pd.Series:
    """
    Build a probabilistic fraud label when historical labels are unavailable.
    This keeps cold-start training deterministic and auditable.
    """
    cf = pd.to_numeric(df.get("claim_frequency", 0.0), errors="coerce").fillna(0.0).clip(0.0, 1.0)
    zr = pd.to_numeric(df.get("zone_risk", 0.0), errors="coerce").fillna(0.0).clip(0.0, 1.0)
    la = pd.to_numeric(df.get("location_anomaly", 0.0), errors="coerce").fillna(0.0).clip(0.0, 1.0)
    hour = pd.to_numeric(df.get("time_of_day", 12.0), errors="coerce").fillna(12.0).clip(0.0, 23.99)

    unusual_hour = hour.apply(lambda h: 1.0 if (1.0 <= h <= 5.0) else 0.0)

    risk_score = (
        (0.30 * cf)
        + (0.25 * zr)
        + (0.35 * la)
        + (0.10 * unusual_hour)
    )

    # Conservative threshold with light noise to avoid overfitting to a hard rule.
    noisy = risk_score + pd.Series(np.random.normal(0.0, 0.03, len(risk_score)))
    return (noisy >= 0.55).astype(int)

def train_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    dataset_path = os.path.join(base_dir, "dataset", "synthetic_training_data.csv")
    model_path = os.path.join(base_dir, "backend", "ml", "fraud_model.pkl")

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    df = pd.read_csv(dataset_path)

    # Backward compatibility with existing synthetic dataset columns.
    if "historical_claim_freq" in df.columns and "claim_frequency" not in df.columns:
        df["claim_frequency"] = pd.to_numeric(df["historical_claim_freq"], errors="coerce")
    if "avg_12w_dci" in df.columns and "zone_risk" not in df.columns:
        df["zone_risk"] = pd.to_numeric(df["avg_12w_dci"], errors="coerce")
    if "flood_proximity_score" in df.columns and "location_anomaly" not in df.columns:
        df["location_anomaly"] = pd.to_numeric(df["flood_proximity_score"], errors="coerce")

    if "time_of_day" not in df.columns:
        # Sample plausible delivery-hour distribution for training when absent.
        df["time_of_day"] = (pd.Series(range(len(df))) % 24).astype(float)

    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0

    if "fraud_label" not in df.columns:
        df["fraud_label"] = _derive_fraud_label(df)

    X = df[FEATURE_COLUMNS].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    y = pd.to_numeric(df["fraud_label"], errors="coerce").fillna(0).astype(int)

    if y.nunique() < 2:
        raise ValueError("Fraud training requires at least two classes in fraud_label")

    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = xgb.XGBClassifier(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        eval_metric="logloss",
        random_state=42,
        use_label_encoder=False,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

    y_prob = model.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, y_prob)

    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(model, model_path)

    print(f"✅ Fraud model trained and saved to {model_path}")
    print(f"   Validation ROC-AUC: {auc:.4f}")

if __name__ == "__main__":
    train_model()
