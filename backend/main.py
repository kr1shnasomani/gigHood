from contextlib import asynccontextmanager
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    jobs.start_scheduler()
    yield
    jobs.shutdown_scheduler()

app = FastAPI(title="gigHood API", version="0.1.0", lifespan=lifespan)

# ── CORS — allow browser requests from the Next.js dev server and any mobile browser ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten to specific origins in production
    allow_credentials=True,
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
