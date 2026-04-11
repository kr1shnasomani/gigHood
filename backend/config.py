try:
    from pydantic_settings import BaseSettings
except Exception:
    # Fallback for corrupted/missing pydantic-settings installations.
    from pydantic.v1 import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: Optional[str] = None
    
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
    
    # Missing App Configurations
    APP_VERSION: str = "1.0.0"
    TRIGGER_RAINFALL_MM_PER_HR: float = 35.0
    TRIGGER_WIND_KM_PER_HR: float = 45.0
    TRIGGER_AQI_HAZARDOUS: float = 300.0
    CPCB_BASE_URL: str = "https://api.data.gov.in/resource"
    CPCB_TIMEOUT_SECONDS: int = 5
    GOV_ALERT_FEED_TIMEOUT_SECONDS: int = 5
    GOV_ALERT_FEED_URL: str = ""
    OPENWEATHER_BASE_URL: str = "https://api.openweathermap.org/data/2.5/weather"
    OPENWEATHER_TIMEOUT_SECONDS: int = 5
    SIGNAL_FETCH_DEFAULT_TIMEOUT_SECONDS: int = 5
    USE_MOCK_PLATFORM_API: bool = True
    USE_MOCK_SOCIAL_API: bool = True
    USE_MOCK_TRAFFIC_API: bool = True

    DCI_THRESHOLD_DISRUPTED: float = 0.7
    DCI_THRESHOLD_ELEVATED_WATCH: float = 0.5
    DCI_WEIGHT_ALPHA: float = 0.4
    DCI_WEIGHT_BETA: float = 0.2
    DCI_WEIGHT_DELTA: float = 0.2
    DCI_WEIGHT_GAMMA: float = 0.2
    SIGNAL_DEGRADED_MODE_THRESHOLD: int = 2

    FRAUD_CLAIM_FREQUENCY_PCT_THRESHOLD: float = 20.0
    FRAUD_SCORE_ACTIVE_VERIFY: float = 0.4
    FRAUD_SCORE_DENY: float = 0.7
    FRAUD_SCORE_SOFT_QUEUE: float = 0.5
    FRAUD_WEIGHT_GATE1: float = 0.4
    FRAUD_WEIGHT_GATE2: float = 0.3
    FRAUD_WEIGHT_MOCK_LOCATION: float = 0.3
    POP_MIN_PINGS_IN_HEX: int = 2
    POP_WINDOW_MINUTES: int = 30

    # Scheduler
    ENABLE_SCHEDULER: bool = True
    SIGNAL_JOB_CRON_MINUTE: str = "*/10"
    DCI_JOB_CRON_MINUTE: str = "1,11,21,31,41,51"
    SCHEDULER_MAX_INSTANCES: int = 1
    SCHEDULER_COALESCE: bool = True
    SCHEDULER_MISFIRE_GRACE_SECONDS: int = 300
    SCHEDULER_HEX_LIMIT: int = 150
    SCHEDULER_ROTATE_HEX_BATCH: bool = True

    # Smooth out write pressure against Supabase connection pools
    SIGNAL_INGESTION_HEX_SLEEP_SECONDS: float = 0.02
    DCI_CYCLE_HEX_SLEEP_SECONDS: float = 0.01

    # Supabase network resilience
    SUPABASE_RETRY_ATTEMPTS: int = 5
    SUPABASE_RETRY_BACKOFF_SECONDS: float = 0.5

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
