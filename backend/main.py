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
import backend.api.tts as tts
from backend.config import settings
from backend.services.neo4j_graph import close_neo4j_driver

logger = logging.getLogger("startup")

@asynccontextmanager
async def lifespan(app: FastAPI):
    jobs.start_scheduler()
    logger.info("Scheduler started. Risk profiler will lazy-load on first request.")
    yield
    close_neo4j_driver()
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

@app.middleware("http")
async def add_cache_headers(request, call_next):
    response = await call_next(request)
    if request.method == "GET" and response.status_code == 200:
        path = request.url.path
        if "/workers/me" in path or "/policies" in path or "/claims" in path:
            response.headers["Cache-Control"] = "public, max-age=60"
    return response

app.include_router(workers.router, prefix="/workers", tags=["workers"])
app.include_router(demo.router, prefix="/workers", tags=["demo"])
app.include_router(policies.router, prefix="/policies", tags=["policies"])
app.include_router(claims.router, prefix="/claims", tags=["claims"])
app.include_router(location_pings.router, prefix="/location-pings", tags=["location_pings"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(tts.router, tags=["tts"])

@app.get("/")
async def root():
    return {"message": "gigHood API is running"}
