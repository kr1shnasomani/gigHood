"""
Chat API Router — POST /chat
Handles worker AI assistant queries with injected context.
Thin route layer: delegates all logic to chat_service.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal

from backend.services.auth_service import get_current_worker
from backend.services.chat_service import build_context, query_llm, detect_language

router = APIRouter()

SUPPORTED_LANGUAGES = {"en", "hi", "ta", "te", "kn", "mr", "bn", "as"}


class ChatRequest(BaseModel):
    message: str
    language: str = "en"


class ChatResponse(BaseModel):
    reply: str
    language: str
    worker_name: str


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest, worker: dict = Depends(get_current_worker)):
    """
    Accepts a worker's message and returns a context-aware LLM response.
    Worker context (policy, DCI, last payout) is injected automatically.
    Supports: en, hi, ta, te, kn, mr, bn, as
    """
    worker_id = worker.get("id")
    if not worker_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    language = req.language if req.language in SUPPORTED_LANGUAGES else "en"

    try:
        context = build_context(worker_id)
        
        detected_lang = detect_language(req.message)
        if detected_lang:
            language = detected_lang
            
        reply = query_llm(context, req.message, language)
        return ChatResponse(
            reply=reply,
            language=language,
            worker_name=context.get("name", "Worker"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat service error: {str(e)}")
