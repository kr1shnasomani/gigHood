import time
import logging
from typing import Callable, TypeVar

from backend.config import settings

T = TypeVar("T")
logger = logging.getLogger("api")

_TRANSIENT_MARKERS = (
    "Server disconnected",
    "ConnectionTerminated",
    "StreamIDTooLowError",
    "RemoteProtocolError",
)


def _is_transient_error(exc: Exception) -> bool:
    text = str(exc)
    return any(marker in text for marker in _TRANSIENT_MARKERS)


def execute_with_retry(query_builder: Callable[[], T], op_name: str = "supabase_query") -> T:
    """Execute a Supabase query with short retries for transient transport errors."""
    attempts = max(1, settings.SUPABASE_RETRY_ATTEMPTS)

    for attempt in range(1, attempts + 1):
        try:
            return query_builder()
        except Exception as exc:
            if attempt >= attempts or not _is_transient_error(exc):
                raise

            sleep_s = settings.SUPABASE_RETRY_BACKOFF_SECONDS * attempt
            logger.warning(
                "Transient Supabase error in %s (attempt %s/%s): %s",
                op_name,
                attempt,
                attempts,
                exc,
            )
            time.sleep(sleep_s)

    # Unreachable, but keeps static analyzers happy.
    return query_builder()
