from datetime import datetime, timedelta, timezone
from typing import Dict
import logging

from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from backend.config import settings
from backend.db.client import supabase

logger = logging.getLogger("auth_service")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="workers/auth/token")


# =========================================================
# JWT CREATION
# =========================================================
def create_jwt(worker_id: str) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": worker_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )

    return token


# =========================================================
# JWT DECODE
# =========================================================
def decode_jwt(token: str) -> Dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )

        return payload

    except ExpiredSignatureError:
        logger.warning("Expired JWT token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    except JWTError:
        logger.warning("Invalid JWT token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# =========================================================
# CURRENT USER DEPENDENCY
# =========================================================
def get_current_worker(token: str = Depends(oauth2_scheme)) -> Dict:
    payload = decode_jwt(token)

    worker_id = payload.get("sub")
    if not worker_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload"
        )

    try:
        res = supabase.table("workers") \
            .select("*") \
            .eq("id", worker_id) \
            .execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Worker not found")

        worker = res.data[0]

        return worker

    except HTTPException:
        raise

    except Exception:
        logger.error("Auth DB fetch failed", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal authentication error"
        )