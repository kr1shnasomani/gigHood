from supabase import create_client, Client
from backend.config import settings


def _clean_env_value(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().strip('"').strip("'")


def _looks_like_jwt(value: str) -> bool:
    # Supabase anon/service_role keys are JWTs (three dot-separated segments).
    return value.count('.') == 2


def _resolve_supabase_key() -> str:
    """Resolve a valid Supabase key for supabase-py create_client.

    The python client expects anon/service_role JWT-style keys. If a non-JWT
    key is set in a higher-priority env var (for example sb_secret_*), it can
    cause production failures even when a valid anon key is available.
    """
    # Preferred order: service role JWT, anon JWT, then other fallback values.
    jwt_candidates = [
        settings.SUPABASE_SERVICE_ROLE_KEY,
        settings.SUPABASE_KEY,
        settings.SUPABASE_PUBLISHABLE_KEY,
        settings.SUPABASE_SECRET_KEY,
    ]

    cleaned_candidates = [_clean_env_value(v) for v in jwt_candidates]
    for candidate in cleaned_candidates:
        if candidate and _looks_like_jwt(candidate):
            return candidate

    # If no JWT-style value exists, return first non-empty key for explicit failure.
    for candidate in cleaned_candidates:
        if candidate:
            return candidate

    raise RuntimeError(
        "No Supabase API key configured. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY."
    )

def get_supabase_client() -> Client:
    """Returns a connected Supabase client using the URL and API key from config."""
    url: str = _clean_env_value(settings.SUPABASE_URL)
    if not url:
        raise RuntimeError("SUPABASE_URL is not configured.")

    key: str = _resolve_supabase_key()
    return create_client(url, key)


# Provide supabase_admin for elevated database privileges
def get_supabase_admin_client() -> Client:
    url: str = _clean_env_value(settings.SUPABASE_URL)
    key: str = _clean_env_value(settings.SUPABASE_SERVICE_ROLE_KEY) or _resolve_supabase_key()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.")
    return create_client(url, key)

supabase_admin: Client = get_supabase_admin_client()


import threading

class _SupabaseProxy:
    """Provides a thread-local Supabase client.
    
    This fixes connection pool corruption across background scheduler jobs
    and FastAPI requests, while preventing ephemeral port exhaustion (Errno 54)
    caused by creating a fresh client on every single attribute access.
    """
    
    def __init__(self):
        self._local = threading.local()

    @property
    def _client(self):
        if not hasattr(self._local, "client"):
            try:
                self._local.client = get_supabase_client()
            except RuntimeError as err:
                def _missing_supabase_attr(*args, **kwargs):
                    raise RuntimeError(str(err))
                return _missing_supabase_attr
        return self._local.client

    def __getattr__(self, name: str):
        # unittest.mock and other tooling probe special attrs with hasattr().
        # Avoid creating network clients for those introspection checks.
        if name.startswith('__'):
            raise AttributeError(name)
            
        client = self._client
        if callable(client): # If it's the error fallback
            return client
            
        return getattr(client, name)

supabase = _SupabaseProxy()


# Provide asyncpg connection helpers for performance-critical batch operations
import os
import asyncpg
from contextlib import asynccontextmanager

_asyncpg_pool = None

async def init_db_pool():
    global _asyncpg_pool
    db_url = getattr(settings, "DATABASE_URL", None) or os.getenv("DATABASE_URL")
    if not db_url:
        import logging
        logger = logging.getLogger("api")
        logger.warning("DATABASE_URL not found; asyncpg pool cannot be initialized.")
        return
    _asyncpg_pool = await asyncpg.create_pool(db_url)

@asynccontextmanager
async def get_db_connection():
    global _asyncpg_pool
    if not _asyncpg_pool:
        db_url = getattr(settings, "DATABASE_URL", None) or os.getenv("DATABASE_URL")
        if not db_url:
            raise RuntimeError("DATABASE_URL is not set. Cannot establish asyncpg connection.")
        # Fallback to single connection if pooling failed
        conn = await asyncpg.connect(db_url)
        try:
            yield conn
        finally:
            await conn.close()
        return

    async with _asyncpg_pool.acquire() as conn:
        yield conn

@asynccontextmanager
async def get_db_transaction():
    async with get_db_connection() as conn:
        async with conn.transaction():
            yield conn
