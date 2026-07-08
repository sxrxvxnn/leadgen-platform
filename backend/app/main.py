from .instrumentation import setup_logging
from contextlib import asynccontextmanager

import posthog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from dotenv import load_dotenv
import os

from .routes import router
from .database import supabase
from .rate_limit import limiter
from .security import path_rate_limit_middleware, log_api_error

load_dotenv()

import sentry_sdk as _sentry_sdk
_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    _sentry_sdk.init(dsn=_sentry_dsn, traces_sample_rate=0.1, profiles_sample_rate=0.05)

_IS_PROD = os.getenv("ENVIRONMENT", "development").lower() == "production"


_DEFAULT_FLAGS = [
    {"name": "ui_sounds", "label": "UI Sound Effects", "description": "Keyboard click and button tap sounds throughout the app", "enabled": True, "category": "ui"},
    {"name": "find_dms", "label": "DM Finder", "description": "Find decision-maker LinkedIn DMs via automated Playwright scan", "enabled": True, "category": "outreach"},
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    posthog.api_key = os.getenv("POSTHOG_PROJECT_TOKEN", "")
    posthog.host = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")
    posthog.enable_exception_autocapture = True
    try:
        existing = {r["name"] for r in supabase.table("feature_flags").select("name").execute().data or []}
        to_seed = [f for f in _DEFAULT_FLAGS if f["name"] not in existing]
        if to_seed:
            supabase.table("feature_flags").insert(to_seed).execute()
    except Exception:
        pass
    yield
    posthog.flush()


app = FastAPI(
    title="LeadGen Engine API",
    version="1.0.0",
    lifespan=lifespan,
    # Disable interactive docs in production — avoids exposing API surface
    docs_url=None if _IS_PROD else "/docs",
    redoc_url=None if _IS_PROD else "/redoc",
    openapi_url=None if _IS_PROD else "/openapi.json",
)

security = HTTPBearer()

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait before trying again."},
        headers={"Retry-After": str(exc.retry_after) if hasattr(exc, "retry_after") else "60"},
    )


app.add_middleware(SlowAPIMiddleware)

# ── Body size limit — reject payloads over 2 MB (prevents resource exhaustion) ─
_MAX_BODY = 2 * 1024 * 1024  # 2 MB


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > _MAX_BODY:
        return JSONResponse(status_code=413, content={"detail": "Request body too large (max 2 MB)"})
    return await call_next(request)


# ── Path-based sliding-window rate limiter ─────────────────────────────────────
app.middleware("http")(path_rate_limit_middleware)

# ── Security headers ───────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"  # deprecated; CSP is the right control
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-site"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "frame-ancestors 'none'; "
        "form-action 'none';"
    )
    if _IS_PROD:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response

# ── CORS ───────────────────────────────────────────────────────────────────────
_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "LeadGen Engine API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
