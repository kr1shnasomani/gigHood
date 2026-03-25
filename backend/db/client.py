import os
from supabase import create_client, Client
from backend.config import settings

def get_supabase_client() -> Client:
    """Returns a connected Supabase client using the URL and API key from config."""
    url: str = settings.SUPABASE_URL
    key: str = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
    return create_client(url, key)

# Create a singleton instance for global use
supabase: Client = get_supabase_client()
