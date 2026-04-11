"""
Chat Service — AI Assistant context builder and LLM query interface.

Priority chain:
    1. Groq (env-configurable model)       — fast, cheap, primary
    2. OpenRouter (env-configurable model) — fallback if Groq fails
    3. Rule-based fallback                 — if both APIs fail

Context (policy, DCI, last claim) is injected as a system prompt
so workers get personalised answers about their own coverage.

Production improvements (v2):
    - Connection pooling via shared httpx.Client
    - Response cleaning pipeline (no ** markdown in UI/voice)
    - Prompt injection guard
    - Reduced token cost (max_tokens: 200, temperature: 0.5)
    - Latency logging per LLM call
"""

import re
import time
import logging
import httpx
from backend.db.client import supabase
from backend.config import settings
from backend.services.dci_engine import get_dci_status

logger = logging.getLogger("chat")

# ── API config ─────────────────────────────────────────────
GROQ_API_KEY        = settings.GROQ_API_KEY or ""
OPENROUTER_API_KEY  = settings.OPENROUTER_API_KEY or ""

GROQ_URL            = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL      = "https://openrouter.ai/api/v1/chat/completions"

GROQ_MODEL          = settings.GROQ_MODEL_NAME
OPENROUTER_MODEL    = settings.OPENROUTER_MODEL_NAME
OPENROUTER_REFERER  = settings.OPENROUTER_HTTP_REFERER
OPENROUTER_APP_NAME = settings.OPENROUTER_APP_TITLE

# ── Global HTTP client (connection pooling) ─────────────────
# A single shared client reuses TCP connections across calls,
# eliminating the handshake overhead of httpx.post() per request.
http_client = httpx.Client(
    timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
    follow_redirects=True,
    limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
)

# Startup diagnostics — visible in uvicorn logs
print(f"[chat_service] GROQ_API_KEY loaded:       {bool(GROQ_API_KEY)}  (len={len(GROQ_API_KEY)})")
print(f"[chat_service] OPENROUTER_API_KEY loaded: {bool(OPENROUTER_API_KEY)}  (len={len(OPENROUTER_API_KEY)})")

# ── System prompt ───────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are Gig Copilot, an AI assistant for gigHood parametric income insurance.
You are speaking with {name}, a Q-commerce delivery worker in {city}, {dark_store_zone}.

Their active policy is {tier} with weekly premium ₹{premium} and coverage cap ₹{coverage_cap}/day.
Their current zone DCI score is {dci_score} ({dci_status}).
Last claim: {last_payout}. Total paid claims: {total_payouts}.

You are read-only — you explain policies, payouts and zone risk. Never file or modify claims.
Always answer in {response_language}. Do not switch to any other language unless explicitly asked to change language.
Be concise and warm — this worker may be stressed.
Keep answers under 150 words. Use simple language suitable for a delivery worker.
Do not use markdown formatting like **bold**, *italic*, or bullet points. Write in plain natural language."""

LANGUAGE_LABELS = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "mr": "Marathi",
    "bn": "Bengali",
    "as": "Assamese",
}

LANGUAGE_FALLBACKS = {
    "en": "I'm having trouble connecting right now. Please try again in a moment.",
    "hi": "अभी कनेक्शन में समस्या है। कृपया थोड़ी देर बाद फिर प्रयास करें।",
    "ta": "இப்போது இணைப்பில் சிக்கல் உள்ளது. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.",
    "te": "ప్రస్తుతం కనెక్షన్ సమస్య ఉంది. కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.",
    "kn": "ಈಗ ಸಂಪರ್ಕ ಸಮಸ್ಯೆ ಇದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    "mr": "आत्ता कनेक्शनमध्ये अडचण आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.",
    "bn": "এখন সংযোগে সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    "as": "এতিয়া সংযোগত সমস্যা হৈছে। অনুগ্ৰহ কৰি অলপ পিছত পুনৰ চেষ্টা কৰক।",
}

# ── Prompt injection guard ──────────────────────────────────

_INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore all instructions",
    "disregard the above",
    "system prompt",
    "act as",
    "you are now",
    "jailbreak",
    "pretend you are",
    "forget your instructions",
    "new persona",
    "override your",
]


def _sanitize_user_input(text: str) -> str:
    """
    Block obvious prompt injection attempts.
    Returns a safe replacement string if a pattern is detected,
    so the LLM still responds — just to a neutralised message.
    """
    lowered = text.lower()
    for pattern in _INJECTION_PATTERNS:
        if pattern in lowered:
            logger.warning(f"[chat_service] Prompt injection attempt blocked: '{text[:80]}'")
            return "Tell me about my insurance policy and coverage."
    return text


# ── Response cleaner ────────────────────────────────────────

def _clean_response(text: str) -> str:
    """
    Strip markdown formatting from LLM output so the UI shows clean text
    and the TTS system reads natural speech (no 'asterisk asterisk').

    Applied AFTER _strip_thinking — the combined pipeline is:
        raw → _strip_thinking → _clean_response → returned to user
    """
    if not text:
        return ""

    # Remove bold: **word** → word
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    # Remove italic: *word* → word  (single asterisks not part of bold)
    text = re.sub(r"\*([^*\n]+?)\*", r"\1", text)
    # Remove inline code: `word` → word
    text = re.sub(r"`([^`]+?)`", r"\1", text)
    # Remove code blocks
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Remove heading markers: ### Title → Title
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove bullet/dash list markers at line start
    text = re.sub(r"^\s*[-•*]\s+", "", text, flags=re.MULTILINE)
    # Replace unicode bullet
    text = text.replace("•", "-")
    # Collapse multiple blank lines into one
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ── Context builder ─────────────────────────────────────────

def build_context(worker_id: str) -> dict:
    """
    Fetches worker profile, active policy, DCI score, and last claim.
    Returns a flat dict for string-formatting into the system prompt.
    """
    ctx = {
        "name":            "Worker",
        "city":            "Unknown",
        "dark_store_zone": "Unknown",
        "tier":            "Unknown",
        "premium":         "?",
        "coverage_cap":    "?",
        "policy_status":   "Unknown",
        "dci_score":       "N/A",
        "dci_status":      "unknown",
        "last_payout":     "None yet",
        "total_payouts":   0,
    }

    # 1. Worker profile
    hex_id = None
    try:
        res = supabase.table('workers').select(
            'name,city,dark_store_zone,hex_id,avg_daily_earnings'
        ).eq('id', worker_id).single().execute()
        if res.data:
            w = res.data
            ctx.update({
                "name":            w.get("name", "Worker"),
                "city":            w.get("city", "Unknown"),
                "dark_store_zone": w.get("dark_store_zone", "Unknown"),
            })
            hex_id = w.get("hex_id")
    except Exception as e:
        logger.warning(f"Worker profile fetch failed: {e}")

    # 2. Active policy — use real DB column names
    try:
        res = supabase.table('policies').select(
            'tier,weekly_premium,coverage_cap_daily,status'
        ).eq('worker_id', worker_id).eq('status', 'active').execute()
        if res.data:
            p = res.data[0]
            tier_label = p.get("tier", "?")
            tier_map = {
                "A": "Tier A (₹600/day cap)",
                "B": "Tier B (₹700/day cap)",
                "C": "Tier C (₹800/day cap)",
            }
            ctx.update({
                "tier":          tier_map.get(tier_label, f"Tier {tier_label}"),
                "premium":       str(p.get("weekly_premium", "?")),
                "coverage_cap":  str(p.get("coverage_cap_daily", "?")),
                "policy_status": p.get("status", "unknown"),
            })
    except Exception as e:
        logger.warning(f"Policy fetch failed: {e}")

    # 3. DCI for worker's hex zone
    if hex_id:
        try:
            res = supabase.table('hex_zones').select(
                'current_dci,dci_status'
            ).eq('h3_index', hex_id).execute()
            if res.data:
                dci_val = float(res.data[0].get('current_dci') or 0.5)
                ctx.update({
                    "dci_score":  round(dci_val, 3),
                    "dci_status": res.data[0].get('dci_status') or get_dci_status(dci_val),
                })
        except Exception as e:
            logger.warning(f"DCI fetch failed: {e}")

    # 4. Last paid claim
    try:
        res = supabase.table('claims').select(
            'payout_amount,created_at'
        ).eq('worker_id', worker_id).eq('status', 'paid').order(
            'created_at', desc=True
        ).limit(1).execute()
        if res.data:
            c = res.data[0]
            ctx["last_payout"] = f"₹{c.get('payout_amount','?')} on {str(c.get('created_at',''))[:10]}"

        all_paid = supabase.table('claims').select('id').eq(
            'worker_id', worker_id
        ).eq('status', 'paid').execute()
        ctx["total_payouts"] = len(all_paid.data) if all_paid.data else 0
    except Exception as e:
        logger.warning(f"Claims fetch failed: {e}")

    return ctx


# ── LLM callers ─────────────────────────────────────────────

def _call_groq(system_prompt: str, user_message: str) -> str:
    """
    Call Groq via the shared http_client (connection pooling).
    Logs latency. Returns cleaned plain-text response.
    Raises on any failure so query_llm can fall through to OpenRouter.
    """
    start = time.time()

    response = http_client.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type":  "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            "max_tokens":  200,   # reduced from 500 — keeps cost low, answers concise
            "temperature": 0.5,   # reduced from 0.7 — more stable, less hallucination
        },
    )

    response.raise_for_status()
    raw = response.json()["choices"][0]["message"]["content"].strip()
    cleaned = _clean_response(_strip_thinking(raw))

    latency = round(time.time() - start, 2)
    logger.info(f"[Groq] responded in {latency}s | chars={len(cleaned)} | model={GROQ_MODEL}")

    return cleaned


def _call_openrouter(system_prompt: str, user_message: str) -> str:
    """
    Call OpenRouter via the shared http_client (connection pooling).
    Logs latency. Returns cleaned plain-text response.
    Raises on any failure so query_llm can fall through to rule-based.
    """
    start = time.time()

    response = http_client.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type":  "application/json",
            "HTTP-Referer":  OPENROUTER_REFERER,
            "X-Title":       OPENROUTER_APP_NAME,
        },
        json={
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            "max_tokens":  200,   # reduced from 500
            "temperature": 0.5,   # reduced from 0.7
        },
    )

    response.raise_for_status()
    raw = response.json()["choices"][0]["message"]["content"].strip()
    cleaned = _clean_response(_strip_thinking(raw))

    latency = round(time.time() - start, 2)
    logger.info(f"[OpenRouter] responded in {latency}s | chars={len(cleaned)} | model={OPENROUTER_MODEL}")

    return cleaned


def _strip_thinking(text: str) -> str:
    """
    Qwen3 and some other models emit chain-of-thought inside <think>...</think>
    blocks before the actual answer. Strip these entirely so users never see
    raw internal reasoning in the chat UI.
    """
    if not text:
        return ""

    cleaned = text

    # Remove normal closed <think>...</think> blocks.
    cleaned = re.sub(r"<think\b[^>]*>[\s\S]*?</think>", "", cleaned, flags=re.IGNORECASE)

    # Remove malformed/unclosed <think> blocks that run until message end.
    cleaned = re.sub(r"<think\b[^>]*>[\s\S]*$", "", cleaned, flags=re.IGNORECASE)

    # If a stray closing tag exists, keep only content after it.
    if "</think>" in cleaned.lower():
        cleaned = re.split(r"</think>", cleaned, flags=re.IGNORECASE, maxsplit=1)[-1]

    return cleaned.strip()


# ── Public interface ────────────────────────────────────────


def query_llm(context: dict, user_message: str, language: str = "en") -> str:
    """
    Call Groq first. If it fails for any reason, try OpenRouter.
    If both fail, return a friendly error message.
    Never return the hardcoded template.
    """
    # Guard against prompt injection before it reaches the LLM
    user_message = _sanitize_user_input(user_message)

    lang_label     = LANGUAGE_LABELS.get(language, "English")
    prompt_context = {**context, "response_language": lang_label}
    system_prompt  = SYSTEM_PROMPT_TEMPLATE.format(**prompt_context)

    # ── Attempt 1: Groq ─────────────────────────────────────
    if GROQ_API_KEY:
        try:
            reply = _call_groq(system_prompt, user_message)
            logger.info(f"Groq served request for worker '{context.get('name')}'")
            return reply
        except Exception as e:
            logger.warning(f"Groq failed ({type(e).__name__}: {e}), trying OpenRouter…")

    # ── Attempt 2: OpenRouter ────────────────────────────────
    if OPENROUTER_API_KEY:
        try:
            reply = _call_openrouter(system_prompt, user_message)
            logger.info(f"OpenRouter served request for worker '{context.get('name')}'")
            return reply
        except Exception as e:
            logger.warning(f"OpenRouter also failed ({type(e).__name__}: {e})")

    # ── Both failed ──────────────────────────────────────────
    logger.error("Both Groq and OpenRouter failed. Returning language fallback.")
    return LANGUAGE_FALLBACKS.get(language, LANGUAGE_FALLBACKS["en"])
