from contextlib import asynccontextmanager
from fastapi import FastAPI

import backend.api.workers as workers
import backend.api.policies as policies
import backend.api.claims as claims
import backend.api.notifications as notifications
import backend.api.chat as chat
import backend.api.admin as admin
import backend.scheduler.jobs as jobs

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic: start APScheduler
    jobs.start_scheduler()
    yield
    # Shutdown logic: shutdown APScheduler
    jobs.shutdown_scheduler()

app = FastAPI(title="gigHood API", version="0.1.0", lifespan=lifespan)

app.include_router(workers.router, prefix="/workers", tags=["workers"])
app.include_router(policies.router, prefix="/policies", tags=["policies"])
app.include_router(claims.router, prefix="/claims", tags=["claims"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
# app.include_router(admin.router, prefix="/admin", tags=["admin"])

@app.get("/")
async def root():
    return {"message": "gigHood API is running"}
