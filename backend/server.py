"""
=============================================
 Data Dev AI — Backend Server
 Protected by NVIDIA NeMo Guardrails
=============================================

This FastAPI server provides an AI chat endpoint
that is protected by NeMo Guardrails against:
  • Prompt injection / Jailbreaks
  • Off-topic requests
  • PII leakage
  • Harmful content generation
  • System prompt extraction
=============================================
"""

import os
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ==================== NeMo Guardrails ====================
try:
    from nemoguardrails import RailsConfig, LLMRails
    GUARDRAILS_AVAILABLE = True
except ImportError:
    GUARDRAILS_AVAILABLE = False
    print("⚠️  NeMo Guardrails not installed. Running without AI guardrails.")
    print("   Install with: pip install nemoguardrails")

# ==================== App Setup ====================
app = FastAPI(
    title="Data Dev AI — Guardrailed Backend",
    description="Data Dev AI backend protected by NeMo Guardrails",
    version="1.0.0"
)

# CORS — allow the frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Security Log ====================
security_log: list[dict] = []
MAX_LOG_SIZE = 1000

def log_security_event(event_type: str, severity: str, message: str, details: dict = None):
    """Log a security event."""
    event = {
        "timestamp": datetime.now().isoformat(),
        "type": event_type,
        "severity": severity,
        "message": message,
        "details": details or {}
    }
    security_log.append(event)
    if len(security_log) > MAX_LOG_SIZE:
        security_log.pop(0)
    if severity == "critical":
        print(f"🛡️ [BLOCKED] {event_type}: {message}")

# ==================== Rate Limiter ====================
rate_limit_store: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 30     # max requests per window

def check_rate_limit(client_ip: str) -> bool:
    """Simple rate limiter. Returns True if allowed."""
    import time
    now = time.time()
    
    if client_ip not in rate_limit_store:
        rate_limit_store[client_ip] = []
    
    # Clean old entries
    rate_limit_store[client_ip] = [
        t for t in rate_limit_store[client_ip] 
        if now - t < RATE_LIMIT_WINDOW
    ]
    
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
        log_security_event("RATE_LIMIT", "warning", f"Rate limit exceeded for {client_ip}")
        return False
    
    rate_limit_store[client_ip].append(now)
    return True

# ==================== NeMo Guardrails Init ====================
rails = None

def init_guardrails():
    """Initialize NeMo Guardrails with our configuration."""
    global rails
    if not GUARDRAILS_AVAILABLE:
        return
    
    config_path = Path(__file__).parent / "config"
    
    if not config_path.exists():
        print(f"⚠️  Config directory not found at {config_path}")
        return
    
    try:
        config = RailsConfig.from_path(str(config_path))
        rails = LLMRails(config)
        print("✅ NeMo Guardrails initialized successfully!")
    except Exception as e:
        print(f"⚠️  Failed to initialize NeMo Guardrails: {e}")
        print("   The server will run without guardrails protection.")

# ==================== Request Models ====================
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None
    context: Optional[dict] = None

class ChatResponse(BaseModel):
    reply: str
    blocked: bool = False
    block_reason: Optional[str] = None
    guardrails_active: bool = True
    security_flags: list[str] = []

# ==================== Fallback Guardrails ====================
# These work even without the NeMo Guardrails library

import re

INJECTION_PATTERNS = [
    re.compile(r'ignore\s+(all\s+)?previous\s+instructions', re.I),
    re.compile(r'disregard\s+(all\s+)?(your\s+)?previous', re.I),
    re.compile(r'forget\s+(all\s+)?(your\s+)?instructions', re.I),
    re.compile(r'you\s+are\s+now\s+(?:a|an)\s+(?:different|new)', re.I),
    re.compile(r'pretend\s+(?:you\s+are|to\s+be)', re.I),
    re.compile(r'jailbreak', re.I),
    re.compile(r'DAN\s+mode', re.I),
    re.compile(r'developer\s+mode', re.I),
    re.compile(r'bypass\s+(?:your|the|all)\s+(?:rules|restrictions|safety|filters)', re.I),
    re.compile(r'override\s+(?:your|the|all)\s+(?:rules|restrictions)', re.I),
    re.compile(r'reveal\s+(?:your|the)\s+(?:system|initial|original)\s+prompt', re.I),
    re.compile(r'(?:system|admin|root)\s*(?:override|access|privilege)', re.I),
    re.compile(r'from\s+now\s+on,?\s+(?:you|ignore|forget)', re.I),
]

HARMFUL_PATTERNS = [
    re.compile(r'(?:how\s+to\s+)?(?:hack|exploit|attack|crack|breach|phish)', re.I),
    re.compile(r'(?:make|create|build|generate)\s+(?:a\s+)?(?:virus|malware|trojan|ransomware)', re.I),
    re.compile(r'(?:bypass|break|circumvent)\s+(?:security|authentication|firewall)', re.I),
    re.compile(r'(?:steal|dump|exfiltrate)\s+(?:data|credentials|passwords)', re.I),
]

def fallback_check_input(message: str) -> tuple[bool, str]:
    """Check input using regex patterns when NeMo is not available."""
    for pattern in INJECTION_PATTERNS:
        if pattern.search(message):
            log_security_event("PROMPT_INJECTION", "critical", "Prompt injection blocked", {"message": message[:200]})
            return False, "I'm Data Dev AI, your data analysis assistant. I can't change my role or ignore my guidelines."
    
    for pattern in HARMFUL_PATTERNS:
        if pattern.search(message):
            log_security_event("HARMFUL_CONTENT", "critical", "Harmful request blocked", {"message": message[:200]})
            return False, "I specialize in data analysis. I can't help with that topic. Would you like to analyze some data instead?"
    
    return True, ""

# ==================== API ENDPOINTS ====================

@app.on_event("startup")
async def startup():
    """Initialize guardrails on server start."""
    init_guardrails()

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Data Dev AI — Guardrailed Backend",
        "status": "running",
        "guardrails_active": rails is not None,
        "guardrails_library": GUARDRAILS_AVAILABLE,
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    """Detailed health check."""
    summary = get_security_summary()
    return {
        "status": "healthy",
        "guardrails": "active" if rails else "fallback_mode",
        "security_summary": summary
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, req: Request):
    """
    Main chat endpoint protected by NeMo Guardrails.
    All messages pass through input rails before reaching the AI,
    and responses pass through output rails before reaching the user.
    """
    client_ip = req.client.host if req.client else "unknown"
    
    # Rate limit check
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment before trying again."
        )
    
    message = request.message.strip()
    security_flags = []
    
    # ===== STEP 1: Input validation (always active) =====
    is_safe, block_reason = fallback_check_input(message)
    if not is_safe:
        return ChatResponse(
            reply=block_reason,
            blocked=True,
            block_reason="Input blocked by security guardrails",
            guardrails_active=True,
            security_flags=["BLOCKED_INPUT"]
        )
    
    # ===== STEP 2: NeMo Guardrails processing =====
    if rails:
        try:
            # Pass through NeMo Guardrails
            response = await rails.generate_async(
                messages=[{
                    "role": "user",
                    "content": message
                }]
            )
            
            reply = response.get("content", "I'm sorry, I couldn't process that request.")
            
            # Check if NeMo blocked the message
            if "I can't" in reply and "role" in reply.lower():
                security_flags.append("NEMO_GUARDRAIL_TRIGGERED")
                log_security_event("NEMO_BLOCK", "warning", "NeMo Guardrails triggered", {"message": message[:200]})
            
            return ChatResponse(
                reply=reply,
                blocked=False,
                guardrails_active=True,
                security_flags=security_flags
            )
            
        except Exception as e:
            log_security_event("NEMO_ERROR", "warning", f"NeMo error: {str(e)}")
            # Fall through to fallback response
    
    # ===== STEP 3: Fallback response (no LLM) =====
    fallback_reply = generate_fallback_response(message)
    
    return ChatResponse(
        reply=fallback_reply,
        blocked=False,
        guardrails_active=True,
        security_flags=["FALLBACK_MODE"]
    )

@app.get("/security/summary")
async def security_summary():
    """Get security event summary."""
    return get_security_summary()

@app.get("/security/log")
async def get_log():
    """Get recent security events."""
    return {"events": security_log[-50:]}

@app.post("/security/clear")
async def clear_log():
    """Clear security log."""
    security_log.clear()
    return {"status": "cleared"}

# ==================== HELPERS ====================

def get_security_summary() -> dict:
    """Get a summary of security events."""
    critical = sum(1 for e in security_log if e["severity"] == "critical")
    warnings = sum(1 for e in security_log if e["severity"] == "warning")
    
    return {
        "total_events": len(security_log),
        "critical_blocks": critical,
        "warnings": warnings,
        "status": "threats_blocked" if critical > 0 else "warnings_present" if warnings > 0 else "all_clear",
        "status_label": "🛡️ Threats Blocked" if critical > 0 else "⚠️ Warnings" if warnings > 0 else "✅ All Clear"
    }

def generate_fallback_response(message: str) -> str:
    """Generate a simple response when NeMo/LLM is not available."""
    message_lower = message.lower()
    
    if any(w in message_lower for w in ["hi", "hello", "hey", "greetings"]):
        return "Hello! I'm Data Dev AI, your data analysis assistant. Upload a CSV file to get started, or ask me anything about data analysis!"
    
    if any(w in message_lower for w in ["help", "what can you", "how do", "capabilities"]):
        return ("I can help you with:\n"
                "📂 Understanding your data\n"
                "🧹 Finding data quality issues\n" 
                "📊 Creating visual charts\n"
                "💡 Discovering patterns and insights\n"
                "🔮 Predicting future values\n"
                "📄 Generating reports\n\n"
                "Just upload your CSV file to begin!")
    
    if any(w in message_lower for w in ["thank", "thanks", "great", "awesome"]):
        return "You're welcome! Let me know if there's anything else you'd like to explore in your data."
    
    if any(w in message_lower for w in ["data", "csv", "upload", "file", "analyze"]):
        return "Great! To analyze your data, use the upload area on the main page to drop in your CSV file. I'll take it from there!"
    
    return ("I'm here to help with data analysis! You can:\n"
            "• Upload a CSV file for automatic analysis\n"
            "• Ask me about data patterns and trends\n"
            "• Request charts and visualizations\n"
            "• Generate reports from your data\n\n"
            "What would you like to do?")


# ==================== RUN ====================
if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print("=" * 50)
    print("  Data Dev AI — Guardrailed Backend")
    print("  Protected by NeMo Guardrails")
    print(f"  Running on http://{host}:{port}")
    print("=" * 50)
    
    uvicorn.run(app, host=host, port=port, reload=True)
