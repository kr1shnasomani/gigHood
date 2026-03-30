import os
import pandas as pd
import numpy as np

# Set random seed for reproducibility
np.random.seed(42)

NUM_ROWS = 3000
SAVE_DIR = "/Users/apple/Documents/Projects/gigHood/dataset"
FILE_NAME = "synthetic_training_data.csv"
FILE_PATH = os.path.join(SAVE_DIR, FILE_NAME)

# Ensure the directory exists so the export doesn't fail
os.makedirs(SAVE_DIR, exist_ok=True)

print(f"Generating {NUM_ROWS} rows of synthetic gigHood data...")

# 1. Identifier
worker_ids = [f"w_{str(i).zfill(4)}" for i in range(1, NUM_ROWS + 1)]

# 2. Core Spatial Risk (12-Week DCI History with Temporal Realism)
# Give each worker a base risk, then add slight weekly variations (simulates storm clusters)
base_risk = np.random.uniform(0.1, 0.8, NUM_ROWS)
dci_data = {}
for i in range(1, 13):
    # Base risk + random weekly noise, clipped to stay between 0.0 and 1.0
    dci_data[f"dci_w{i}"] = np.clip(base_risk + np.random.normal(0, 0.15, NUM_ROWS), 0.0, 1.0).round(3)

# 3. Environmental Context
# 30% chance of being in a high-risk season (Monsoon/AQI/Heatwave)
is_high_risk_season = np.random.choice([0, 1], NUM_ROWS, p=[0.7, 0.3]) 
flood_proximity_score = np.random.uniform(0.0, 1.0, NUM_ROWS).round(3)

# 4. Behavioral Risk
# Skewed towards lower claims (most people don't claim constantly)
historical_claim_freq = np.random.beta(a=1.5, b=5, size=NUM_ROWS).round(3) 

# Create DataFrame
df = pd.DataFrame({"worker_id": worker_ids})
for col, values in dci_data.items():
    df[col] = values
df["is_high_risk_season"] = is_high_risk_season
df["flood_proximity_score"] = flood_proximity_score
df["historical_claim_freq"] = historical_claim_freq

# 5. The Target Variable (Rule-Based Assignment for ML to learn)
dci_columns = [f"dci_w{i}" for i in range(1, 13)]
df['avg_12w_dci'] = df[dci_columns].mean(axis=1)

def assign_tier(row):
    # Hidden actuarial formula
    risk_score = (row['avg_12w_dci'] * 0.5) + \
                 (row['flood_proximity_score'] * 0.25) + \
                 (row['is_high_risk_season'] * 0.15) + \
                 (row['historical_claim_freq'] * 0.10)
    
    # Adjusted thresholds to fix Tier C class imbalance
    if risk_score < 0.40:
        return "Tier A" # Low Risk (₹20)
    elif risk_score < 0.55:
        return "Tier B" # Medium Risk (₹30)
    else:
        return "Tier C" # High Risk (₹42)

df['target_tier'] = df.apply(assign_tier, axis=1)

# Drop the temporary helper column
df = df.drop(columns=['avg_12w_dci'])

# Export to CSV at the specified absolute path
df.to_csv(FILE_PATH, index=False)

print(f"Success! Data exported to {FILE_PATH}")
print("\nTier Distribution:")
print(df['target_tier'].value_counts(normalize=True).round(2) * 100)