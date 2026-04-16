"""
gigHood synthetic training data generator
==========================================
Generates actuarially grounded training data for the XGBoost tier classifier.

Design principles:
  1. Feature distributions reflect real gig worker risk profiles from:
       - IFMR LEAD Gig Worker Income Survey 2024
       - RedSeer Consulting Q-commerce Ops Report 2023
       - IMD monsoon rainfall records (city-level variation)
  2. Target variable uses an actuarial formula with documented derivation,
     NOT a hardcoded rule. 5% label noise is injected to ensure XGBoost
     learns a distribution rather than memorising a rule.
  3. DCI history columns have temporal autocorrelation (AR-1) — monsoon
     storms cluster week-to-week, consistent with IMD historical patterns.
  4. City-level stratification across 9 tier-1/tier-2 Indian cities with
     distinct flood-risk and seasonal profiles.
"""

import os
import numpy as np
import pandas as pd

# ── Reproducibility ────────────────────────────────────────────────────────
np.random.seed(42)

NUM_ROWS = 5000
SAVE_DIR = os.path.join(os.path.dirname(__file__))
FILE_PATH = os.path.join(SAVE_DIR, "synthetic_training_data.csv")

print(f"Generating {NUM_ROWS} rows of actuarially grounded gigHood training data...")

# ── 1. Worker IDs ──────────────────────────────────────────────────────────
worker_ids = [f"w_{str(i).zfill(4)}" for i in range(1, NUM_ROWS + 1)]

# ── 2. City Stratification ─────────────────────────────────────────────────
# City weights reflect Q-commerce operational density (Zepto/Blinkit dark stores)
CITIES = {
    #  city              weight  flood_risk_base  monsoon_intensity
    "Bengaluru":        (0.22,   0.35,            0.70),
    "Mumbai":           (0.20,   0.80,            0.95),
    "Delhi":            (0.18,   0.65,            0.55),
    "Chennai":          (0.12,   0.75,            0.80),
    "Hyderabad":        (0.10,   0.40,            0.65),
    "Kolkata":          (0.08,   0.70,            0.85),
    "Jaipur":           (0.04,   0.15,            0.30),
    "Lucknow":          (0.04,   0.45,            0.60),
    "Guwahati":         (0.02,   0.65,            0.90),
}
city_names   = list(CITIES.keys())
city_weights = [CITIES[c][0] for c in city_names]
city_weights_arr = np.array(city_weights) / sum(city_weights)

city_col = np.random.choice(city_names, size=NUM_ROWS, p=city_weights_arr)

# City-level flood proximity (base + noise to represent variation within city)
flood_base = np.array([CITIES[c][1] for c in city_col])
flood_proximity_score = np.clip(
    flood_base + np.random.normal(0, 0.08, NUM_ROWS),
    0.0, 1.0
).round(3)

# City-level monsoon intensity affects seasonal_flag probability
monsoon_intensity = np.array([CITIES[c][2] for c in city_col])
# Seasonal flag: 30% base rate, amplified by city monsoon intensity
seasonal_prob = np.clip(0.15 + monsoon_intensity * 0.30, 0.0, 1.0)
is_high_risk_season = (np.random.uniform(size=NUM_ROWS) < seasonal_prob).astype(int)

# ── 3. DCI History (AR-1 Temporal Autocorrelation) ─────────────────────────
# Base risk per worker: lower in dry cities, higher in flood-prone cities
base_risk_mu = flood_base * 0.6 + np.random.uniform(0.05, 0.35, NUM_ROWS)
base_risk = np.clip(base_risk_mu, 0.05, 0.85)

dci_data = {}
prev_week = base_risk.copy()
for i in range(1, 13):
    # AR-1 process: 60% autocorrelation + 40% new shock
    # This reflects real monsoon storm clustering: a rainy week predicts the next
    ar1_component = 0.60 * prev_week
    shock = np.random.normal(0, 0.12, NUM_ROWS)
    seasonal_boost = (is_high_risk_season * np.random.uniform(0.0, 0.15, NUM_ROWS))
    week_dci = np.clip(ar1_component + 0.40 * base_risk + shock + seasonal_boost, 0.0, 1.0)
    dci_data[f"dci_w{i}"] = week_dci.round(3)
    prev_week = week_dci

# ── 4. Claim Frequency ─────────────────────────────────────────────────────
# Beta distribution: most workers claim rarely (a=1.5, b=6 → skewed right)
# Workers in high-risk cities claim more often (shift beta parameter)
beta_b = np.where(flood_base > 0.60, 4.0, 6.0)
historical_claim_freq = np.array([
    np.random.beta(1.5, b) for b in beta_b
]).round(3)

# ── 5. Assemble DataFrame ──────────────────────────────────────────────────
df = pd.DataFrame({"worker_id": worker_ids})
for col, values in dci_data.items():
    df[col] = values

df["is_high_risk_season"]   = is_high_risk_season
df["flood_proximity_score"] = flood_proximity_score
df["historical_claim_freq"] = historical_claim_freq
df["city"]                  = city_col

# ── 6. Target Variable — Actuarial Risk Score → Tier Assignment ────────────
# Derivation (documented per SOLUTION.md §Cold-Start Strategy):
#
#   risk_score = α_data × avg_12w_dci               [0-1]
#              + β_data × flood_proximity_score      [0-1]
#              + γ_data × is_high_risk_season        [0 or 1]
#              + δ_data × historical_claim_freq      [0-1]
#
#   Weights sourced from:
#     α_data = 0.50  (DCI history dominant — matches SOLUTION.md α=0.45 plus historical weight)
#     β_data = 0.25  (flood risk — actuarial proxy for structural zone risk)
#     γ_data = 0.15  (seasonality — IMD monsoon amplitude adjustment)
#     δ_data = 0.10  (claims — credibility component, low weight at cold-start)
#
#   Tier thresholds calibrated so ~ 40:40:20 distribution (A:B:C) mirrors
#   expected distribution in Zepto/Blinkit zone density across Indian cities.

dci_cols = [f"dci_w{i}" for i in range(1, 13)]
df["avg_12w_dci"] = df[dci_cols].mean(axis=1)

risk_score = (
    0.50 * df["avg_12w_dci"]
    + 0.25 * df["flood_proximity_score"]
    + 0.15 * df["is_high_risk_season"]
    + 0.10 * df["historical_claim_freq"]
)

# Tier thresholds (calibrated to ~40:40:20 split)
tier_raw = np.where(risk_score < 0.38, "Tier A",
           np.where(risk_score < 0.56, "Tier B",
                    "Tier C"))

# ── 5% Label Noise — XGBoost learns a distribution, not a rule ────────────
# Without noise, XGBoost perfectly memorises the rule. With noise, it learns
# a probabilistic boundary — which is what real actuarial models produce.
noise_mask = np.random.uniform(size=NUM_ROWS) < 0.05
tier_adjacent = {"Tier A": "Tier B", "Tier B": "Tier C", "Tier C": "Tier B"}
tier_noisy = np.where(noise_mask,
                      np.vectorize(tier_adjacent.get)(tier_raw),
                      tier_raw)

df["target_tier"] = tier_noisy

# ── 8. Fraud Training Features + Label ─────────────────────────────────────
# These columns are consumed by backend/ml/train_fraud_model.py.
df["claim_frequency"] = df["historical_claim_freq"].astype(float)
df["zone_risk"] = df[dci_cols].mean(axis=1).astype(float)
df["location_anomaly"] = (
    0.7 * df["flood_proximity_score"].astype(float)
    + 0.3 * (1.0 - df["historical_claim_freq"].astype(float))
)
df["time_of_day"] = np.random.uniform(0.0, 23.99, NUM_ROWS).round(2)

unusual_hours = df["time_of_day"].between(1.0, 5.0).astype(float)
fraud_risk = (
    0.30 * df["claim_frequency"]
    + 0.25 * df["zone_risk"]
    + 0.35 * df["location_anomaly"]
    + 0.10 * unusual_hours
)
fraud_noise = np.random.normal(0.0, 0.035, NUM_ROWS)
df["fraud_label"] = ((fraud_risk + fraud_noise) >= 0.55).astype(int)

# Drop helper column (not a model feature)
df = df.drop(columns=["avg_12w_dci"])

# ── 7. Export ──────────────────────────────────────────────────────────────
df.to_csv(FILE_PATH, index=False)

print(f"✅ Data exported to {FILE_PATH}")
print(f"   Rows: {len(df)}")
print(f"   Cities: {df['city'].nunique()}")
print("\nTier Distribution:")
print((df["target_tier"].value_counts(normalize=True).round(3) * 100).to_string())
print("\nCity Distribution:")
print(df["city"].value_counts().to_string())