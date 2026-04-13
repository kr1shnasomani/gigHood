from fastapi import APIRouter, Response, HTTPException
from pydantic import BaseModel
import httpx
import os

router = APIRouter()

ELEVEN_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

class TTSRequest(BaseModel):
    text: str

@router.post("/tts")
async def generate_tts(req: TTSRequest):
    if not ELEVEN_API_KEY:
        # Fallback empty proxy if no API key is provided so UI doesn't crash completely
        raise HTTPException(status_code=500, detail="Missing ElevenLabs API key")

    url = "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL"

    headers = {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "text": req.text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.4,
            "similarity_boost": 0.8
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return Response(content=response.content, media_type="audio/mpeg")
