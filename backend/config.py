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
    
    # Security
    JWT_SECRET: str = "fallback_secret_key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    class Config:
        import os
        env_file = os.path.join(os.path.dirname(__file__), ".env")
        env_file_encoding = "utf-8"

settings = Settings()
