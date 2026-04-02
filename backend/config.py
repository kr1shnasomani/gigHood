from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_PUBLISHABLE_KEY: Optional[str] = None
    SUPABASE_SECRET_KEY: Optional[str] = None
    
    # External Signals
    OPENWEATHER_API_KEY: str = ""
    CPCB_API_KEY: str = ""
    
    # Payments
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    
    # Notifications
    FIREBASE_CREDENTIALS_PATH: str = ""
    
    # AI Chat
    OPENROUTER_API_KEY: str = ""
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL_NAME: str = "qwen/qwen3-32b"
    OPENROUTER_MODEL_NAME: str = "google/gemma-3-27b-it"
    OPENROUTER_HTTP_REFERER: str = "https://gighood.app"
    OPENROUTER_APP_TITLE: str = "gigHood Gig Copilot"

    # ML (Risk Profiler)
    RISK_PROFILER_MODEL_JSON_PATH: str = "backend/ml/risk_profiler.json"
    RISK_PROFILER_MODEL_PKL_PATH: str = "backend/ml/risk_profiler.pkl"
    RISK_PROFILER_DATASET_PATH: str = "dataset/synthetic_training_data.csv"
    AUTO_TRAIN_RISK_MODEL_ON_STARTUP: bool = True

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,https://gighood.vercel.app"
    
    # Security
    JWT_SECRET: str = "fallback_secret_key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    class Config:
        import os
        env_file = os.path.join(os.path.dirname(__file__), ".env")
        env_file_encoding = "utf-8"

settings = Settings()
