"""
DCI Weight Optimizer
====================
Trains an XGBoost classifier on historical disruption events to derive
the optimal α, β, γ, δ signal weights for the DCI formula.

SOLUTION.md commitment (§XGBoost's Exact Role):
  "XGBoost performs two specific tasks: (1) risk band classification —
   assigning each worker to Tier A, B, or C; and (2) DCI weight
   optimization — updating the α, β, γ, δ coefficients weekly based on
   actual disruption outcomes."

How weight optimization works:
  1. Collect labeled disruption events from dci_history + disruption_events
  2. Features: [w_score, t_score, p_score, s_score] per hex per event
  3. Label: 1 if hex was truly disrupted (DCI > 0.85 confirmed by event),
            0 if hex was normal
  4. Train XGBClassifier on this binary classification task
  5. Extract feature_importances_ from trained model
  6. Normalize to sum to 1.0 → these become the new α, β, γ, δ
  7. Write to dci_weights table and invalidate the engine's in-memory cache

Cold-start safety:
  Requires ≥ 50 labeled disruption events before updating weights.
  Below this threshold, the function logs and exits without writing —
  the cold-start priors (0.45, 0.25, 0.20, 0.10) remain active.
"""

from __future__ import annotations

import logging
import os
import time

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

from backend.db.client import supabase

logger = logging.getLogger("dci_weight_trainer")

# ── Constants ────────────────────────────────────────────────────────────────

MIN_SAMPLES = 50          # minimum disruption events before updating weights
COLD_START_ALPHA = 0.45
COLD_START_BETA  = 0.25
COLD_START_GAMMA = 0.20
COLD_START_DELTA = 0.10

# XGBoost hyperparameters (conservative — small dataset friendly)
_XGB_PARAMS = dict(
    n_estimators=100,
    max_depth=3,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="logloss",
    random_state=42,
    use_label_encoder=False,
)

# Feature column order — MUST match DCI formula variable order
FEATURE_COLS = ["w_score", "t_score", "p_score", "s_score"]
FEATURE_TO_WEIGHT = {
    "w_score": "alpha",
    "t_score": "beta",
    "p_score": "gamma",
    "s_score": "delta",
}


# ── Data Fetching ────────────────────────────────────────────────────────────

def _fetch_training_data() -> pd.DataFrame:
    """
    Joins dci_history with disruption_events to produce labeled training rows.

    Returns a DataFrame with columns:
        w_score, t_score, p_score, s_score, disrupted (0/1)

    Logic:
      - All rows in dci_history where computed_at falls within ±15 min of
        a disruption_events.started_at for the same hex → label 1
      - Remaining dci_history rows → label 0
      - Balanced sampling: 1:1 disrupted:normal (up to 2× min class size)
    """
    try:
        # Fetch dci_history (last 90 days to keep dataset fresh)
        history_res = supabase.table("dci_history") \
            .select("hex_id,dci_score,w_score,t_score,p_score,s_score,computed_at,"
                    "weather_component,traffic_component,platform_component,social_component") \
            .order("computed_at", desc=True) \
            .limit(10000) \
            .execute()

        # Fetch confirmed disruption events
        events_res = supabase.table("disruption_events") \
            .select("hex_id,started_at,ended_at,peak_dci") \
            .order("started_at", desc=True) \
            .limit(5000) \
            .execute()

    except Exception as exc:
        logger.error(f"[dci_weight_trainer] DB fetch failed: {exc}")
        return pd.DataFrame()

    if not history_res.data or not events_res.data:
        logger.info("[dci_weight_trainer] No data available yet")
        return pd.DataFrame()

    history_df = pd.DataFrame(history_res.data)
    events_df  = pd.DataFrame(events_res.data)

    # Normalize column names — schema has two naming variants
    col_map = {
        "weather_component":  "w_score",
        "traffic_component":  "t_score",
        "platform_component": "p_score",
        "social_component":   "s_score",
    }
    history_df = history_df.rename(columns=col_map)

    # Ensure required columns exist with safe defaults
    for col in FEATURE_COLS:
        if col not in history_df.columns:
            history_df[col] = 0.0

    history_df = history_df.dropna(subset=FEATURE_COLS)

    if history_df.empty or events_df.empty:
        return pd.DataFrame()

    # Convert timestamps
    history_df["computed_at"] = pd.to_datetime(history_df["computed_at"], utc=True, errors="coerce")
    events_df["started_at"]   = pd.to_datetime(events_df["started_at"],   utc=True, errors="coerce")
    events_df["ended_at"]     = pd.to_datetime(events_df["ended_at"],     utc=True, errors="coerce")

    history_df = history_df.dropna(subset=["computed_at"])
    events_df  = events_df.dropna(subset=["started_at"])

    # Label: 1 if this dci_history row's (hex, time) matches a disruption event
    # Use a set of (hex_id, floored-to-15min) tuples for fast lookup
    disrupted_keys: set[tuple] = set()
    for _, ev in events_df.iterrows():
        mask = history_df["hex_id"] == ev["hex_id"]
        hex_hist = history_df[mask]
        window_start = ev["started_at"] - pd.Timedelta(minutes=15)
        window_end   = (ev.get("ended_at") or (ev["started_at"] + pd.Timedelta(hours=6)))
        in_window = (hex_hist["computed_at"] >= window_start) & \
                    (hex_hist["computed_at"] <= window_end)
        for idx in hex_hist[in_window].index:
            disrupted_keys.add(idx)

    history_df["disrupted"] = history_df.index.map(
        lambda i: 1 if i in disrupted_keys else 0
    )

    df = history_df[FEATURE_COLS + ["disrupted"]].copy()
    df = df.dropna()

    return df


def _balance_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Up/down-sample to balance disrupted vs normal classes.
    Limits total size to 5000 rows to keep retraining fast.
    """
    disrupted = df[df["disrupted"] == 1]
    normal    = df[df["disrupted"] == 0]

    if min(len(disrupted), len(normal)) < MIN_SAMPLES:
        return df

    # Balance: sample normal down to 3× disrupted (mild imbalance, realistic)
    n_disrupted = min(len(disrupted), 2000)
    n_normal    = min(len(normal), n_disrupted * 3)

    disrupted_s = disrupted.sample(n=n_disrupted, random_state=42)
    normal_s    = normal.sample(n=n_normal, random_state=42)

    return pd.concat([disrupted_s, normal_s]).sample(frac=1, random_state=42)


# ── Training ─────────────────────────────────────────────────────────────────

def run_dci_weight_optimization() -> dict:
    """
    Main entry point. Called weekly by APScheduler (Sunday 23:00).

    Returns:
        dict with keys: alpha, beta, gamma, delta, accuracy, sample_count, status
    """
    logger.info("[dci_weight_trainer] Starting DCI weight optimization run...")
    t0 = time.time()

    df = _fetch_training_data()

    if df.empty or len(df) < MIN_SAMPLES:
        n = len(df) if not df.empty else 0
        logger.info(
            f"[dci_weight_trainer] Insufficient data ({n} samples, need {MIN_SAMPLES}). "
            "Keeping cold-start priors."
        )
        return {
            "status":       "skipped_insufficient_data",
            "alpha":        COLD_START_ALPHA,
            "beta":         COLD_START_BETA,
            "gamma":        COLD_START_GAMMA,
            "delta":        COLD_START_DELTA,
            "sample_count": n,
        }

    df = _balance_dataset(df)
    logger.info(
        f"[dci_weight_trainer] Training on {len(df)} samples "
        f"({df['disrupted'].sum()} disrupted, {(df['disrupted'] == 0).sum()} normal)"
    )

    X = df[FEATURE_COLS].values
    y = df["disrupted"].values

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    model = xgb.XGBClassifier(**_XGB_PARAMS)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    val_preds = model.predict(X_val)
    accuracy  = float(accuracy_score(y_val, val_preds))

    # ── Extract feature importances → weights ─────────────────────────────
    importances = model.feature_importances_  # shape: (4,) one per FEATURE_COL
    total = importances.sum()

    if total <= 0:
        logger.warning("[dci_weight_trainer] All feature importances zero — keeping priors")
        return {
            "status":   "error_zero_importances",
            "alpha":    COLD_START_ALPHA,
            "beta":     COLD_START_BETA,
            "gamma":    COLD_START_GAMMA,
            "delta":    COLD_START_DELTA,
            "accuracy": accuracy,
        }

    # Normalize to sum to 1.0
    normalized = (importances / total).tolist()
    alpha, beta_w, gamma, delta = normalized

    # Safety clamp: no single signal should dominate (0.05–0.70 range)
    def _clamp(v: float) -> float:
        return max(0.05, min(0.70, v))

    alpha_c = _clamp(alpha)
    beta_c  = _clamp(beta_w)
    gamma_c = _clamp(gamma)
    delta_c = _clamp(delta)

    # Re-normalize after clamping
    total_c = alpha_c + beta_c + gamma_c + delta_c
    alpha_f = round(alpha_c / total_c, 4)
    beta_f  = round(beta_c  / total_c, 4)
    gamma_f = round(gamma_c / total_c, 4)
    delta_f = round(1.0 - alpha_f - beta_f - gamma_f, 4)  # force exact sum to 1

    feature_importances_dict = {
        col: round(float(imp), 6)
        for col, imp in zip(FEATURE_COLS, importances)
    }

    logger.info(
        f"[dci_weight_trainer] New weights | "
        f"α={alpha_f} β={beta_f} γ={gamma_f} δ={delta_f} | "
        f"accuracy={accuracy:.3f} | samples={len(df)} | "
        f"elapsed={time.time()-t0:.1f}s"
    )

    # ── Persist to DB ─────────────────────────────────────────────────────
    _persist_weights(
        alpha=alpha_f,
        beta=beta_f,
        gamma=gamma_f,
        delta=delta_f,
        accuracy=accuracy,
        sample_count=len(df),
        feature_importances=feature_importances_dict,
    )

    return {
        "status":       "updated",
        "alpha":        alpha_f,
        "beta":         beta_f,
        "gamma":        gamma_f,
        "delta":        delta_f,
        "accuracy":     accuracy,
        "sample_count": len(df),
    }


def _persist_weights(
    alpha: float,
    beta: float,
    gamma: float,
    delta: float,
    accuracy: float,
    sample_count: int,
    feature_importances: dict,
) -> None:
    """
    Writes new weights to dci_weights table.
    Deactivates the previous active row first, then inserts the new one.
    Soft-fail: DB errors are logged but do not crash the scheduler.
    """
    try:
        # Deactivate existing active row
        supabase.table("dci_weights") \
            .update({"is_active": False}) \
            .eq("is_active", True) \
            .execute()

        # Insert new active row
        supabase.table("dci_weights").insert({
            "alpha":                  alpha,
            "beta":                   beta,
            "gamma":                  gamma,
            "delta":                  delta,
            "model_accuracy":         accuracy,
            "training_sample_count":  sample_count,
            "feature_importances":    feature_importances,
            "notes":                  f"weekly retrain — {sample_count} disruption events",
            "is_active":              True,
        }).execute()

        logger.info(
            f"[dci_weight_trainer] Weights persisted to dci_weights table. "
            f"α={alpha} β={beta} γ={gamma} δ={delta}"
        )

        # Invalidate the dci_engine in-memory weight cache
        try:
            from backend.services.dci_engine import invalidate_weight_cache
            invalidate_weight_cache()
        except Exception:
            pass  # engine will pick up new weights on next TTL expiry

    except Exception as exc:
        logger.error(f"[dci_weight_trainer] Failed to persist weights: {exc}")
