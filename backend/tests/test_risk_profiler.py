import os
import pytest
import numpy as np
from backend.services.risk_profiler import predict_tier, MODEL_PATH_JSON, train_and_save_model

def test_train_and_save_generates_pkl():
    """Verify that training securely serializes the JSON model artifact"""
    if os.path.exists(MODEL_PATH_JSON):
        os.remove(MODEL_PATH_JSON)
        
    assert not os.path.exists(MODEL_PATH_JSON)
    train_and_save_model()
    assert os.path.exists(MODEL_PATH_JSON)

def test_predict_tier_A_low_risk_zone():
    """Verify that a safe zone accurately lands in Tier A (lowest risk)"""
    history = [0.10, 0.15, 0.20, 0.15, 0.10, 0.12]
    seasonal = False # Dry season
    city = "Jaipur"
    claim_frequency = 0.05 # Rarely any claims
    
    tier = predict_tier(history, seasonal, city, claim_frequency)
    assert tier == 'A'
    
def test_predict_tier_C_high_risk_zone():
    """Verify that predicting a dangerous zone lands in Tier C (highest risk)"""
    history = [0.85, 0.90, 0.95, 0.88, 0.90, 0.92]
    seasonal = True # Monsoon season
    city = "Mumbai"
    claim_frequency = 0.95 # Highly frequent historical claims
    
    tier = predict_tier(history, seasonal, city, claim_frequency)
    assert tier == 'C'

def test_predict_tier_empty_history_graceful_fallback():
    """If a zone has absolutely no history, the prediction should gracefully default to an average"""
    # Just checking it doesn't crash on an empty list
    tier = predict_tier([], False, "Bengaluru", 0.1)
    
    assert tier in ['A', 'B', 'C']
