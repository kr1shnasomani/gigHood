import pandas as pd
from sklearn.linear_model import LogisticRegression
import joblib
import os

def train_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    dataset_path = os.path.join(base_dir, "dataset", "synthetic_training_data.csv")
    model_path = os.path.join(base_dir, "backend", "ml", "fraud_model.pkl")

    if not os.path.exists(dataset_path):
        print(f"❌ Dataset not found at {dataset_path}")
        # Create a dummy dataset for demo purposes if it doesn't exist
        print("Creating a dummy dataset to allow training...")
        os.makedirs(os.path.dirname(dataset_path), exist_ok=True)
        dummy_data = {
            "claim_frequency": [1.0, 5.0, 2.0, 8.0, 1.5, 9.0],
            "zone_risk": [10.0, 50.0, 20.0, 80.0, 15.0, 90.0],
            "location_anomaly": [5.0, 40.0, 10.0, 70.0, 5.0, 85.0],
            "time_of_day": [14.5, 2.0, 10.0, 3.5, 12.0, 1.5],
            "fraud_label": [0, 1, 0, 1, 0, 1]
        }
        df = pd.DataFrame(dummy_data)
        df.to_csv(dataset_path, index=False)
    else:
        df = pd.read_csv(dataset_path)

    features = ["claim_frequency", "zone_risk", "location_anomaly", "time_of_day"]
    
    # Handle missing columns gracefully
    for f in features:
        if f not in df.columns:
            df[f] = 0.0
            
    if "fraud_label" not in df.columns:
        df["fraud_label"] = 0

    X = df[features].fillna(0)
    y = df["fraud_label"]

    model = LogisticRegression(class_weight='balanced')
    model.fit(X, y)

    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(model, model_path)

    print(f"✅ Model trained and saved to {model_path}")

if __name__ == "__main__":
    train_model()
