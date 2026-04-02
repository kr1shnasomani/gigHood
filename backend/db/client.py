import os
from supabase import create_client, Client
from backend.config import settings

def get_supabase_client() -> Client:
    """Returns a connected Supabase client using the URL and API key from config."""
    url: str = settings.SUPABASE_URL
    key: str = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
    return create_client(url, key)

class _SupabaseProxy:
    """Create a fresh client per top-level call to avoid stale transport state."""

    def __getattr__(self, name: str):
        client = get_supabase_client()
        return getattr(client, name)


supabase = _SupabaseProxy()
