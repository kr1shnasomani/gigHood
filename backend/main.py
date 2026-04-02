from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import backend.api.workers as workers
import backend.api.policies as policies
import backend.api.claims as claims
import backend.api.chat as chat
import backend.api.admin as admin
import backend.api.notifications as notifications
import backend.api.demo as demo
import backend.scheduler.jobs as jobs
import backend.api.location_pings as location_pings
from backend.config import settings

logger = logging.getLogger("startup")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.AUTO_TRAIN_RISK_MODEL_ON_STARTUP:
        try:
            from backend.services.risk_profiler import load_model
            load_model()
            logger.info("Risk profiler model loaded at startup.")
        except Exception as exc:
            logger.exception(f"Risk profiler startup preload failed: {exc}")

    jobs.start_scheduler()
    yield
    jobs.shutdown_scheduler()

app = FastAPI(title="gigHood API", version="0.1.0", lifespan=lifespan)

# CORS origins are configured via BACKEND_CORS_ORIGINS (comma-separated).
cors_origins = [origin.strip() for origin in settings.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workers.router, prefix="/workers", tags=["workers"])
app.include_router(demo.router, prefix="/workers", tags=["demo"])
app.include_router(policies.router, prefix="/policies", tags=["policies"])
app.include_router(claims.router, prefix="/claims", tags=["claims"])
app.include_router(location_pings.router, prefix="/location-pings", tags=["location_pings"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
# app.include_router(admin.router, prefix="/admin", tags=["admin"])

@app.get("/")
async def root():
    return {"message": "gigHood API is running"}
