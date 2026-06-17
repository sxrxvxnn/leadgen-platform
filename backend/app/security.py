"""Security utilities: structured audit logging, UUID validation, rate-limit middleware."""
import json
import logging
import re
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

# ─── Structured security logger ───────────────────────────────────────────────
_log = logging.getLogger("leadgen.security")

# Make sure security events always reach the log sink even if root level is WARNING
if not _log.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(message)s"))
    _log.addHandler(_h)
    _log.setLevel(logging.INFO)
    _log.propagate = False


def _emit(event: str, **kw: Any) -> None:
    _log.info(json.dumps({"ts": round(time.time(), 3), "event": event, **kw}))


def log_auth_success(user_id: str, ip: str, method: str = "password") -> None:
    _emit("auth.login.success", user_id=user_id, ip=ip, method=method)


def log_auth_failure(email: str, ip: str, reason: str = "invalid_credentials") -> None:
    _emit("auth.login.failure", email=email, ip=ip, reason=reason)


def log_signup(user_id: str, ip: str) -> None:
    _emit("auth.signup", user_id=user_id, ip=ip)


def log_password_reset_request(email: str, ip: str) -> None:
    _emit("auth.password_reset.requested", email=email, ip=ip)


def log_password_reset_success(user_id: str, ip: str) -> None:
    _emit("auth.password_reset.completed", user_id=user_id, ip=ip)


def log_token_refresh(user_id: str | None, ip: str) -> None:
    _emit("auth.token.refresh", user_id=user_id, ip=ip)


def log_api_error(path: str, status: int, ip: str = "?", user_id: str | None = None, detail: str = "") -> None:
    _emit("api.error", path=path, status=status, ip=ip, user_id=user_id, detail=detail[:200])


def log_bulk_op(user_id: str, operation: str, count: int, ip: str = "?") -> None:
    _emit("api.bulk_op", user_id=user_id, operation=operation, count=count, ip=ip)


def log_rate_limit_hit(ip: str, path: str, limit: int) -> None:
    _emit("security.rate_limit", ip=ip, path=path, limit=limit)


def log_suspicious(reason: str, ip: str, path: str = "", user_id: str | None = None) -> None:
    _log.warning(json.dumps({"ts": round(time.time(), 3), "event": "security.suspicious",
                              "reason": reason, "ip": ip, "path": path, "user_id": user_id}))


# ─── UUID validation ──────────────────────────────────────────────────────────
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I
)


def validate_uuid(value: str, field: str = "id") -> str:
    """Raise 422 if value is not a valid UUID. Returns the value unchanged."""
    if not value or not _UUID_RE.match(str(value)):
        log_suspicious(f"invalid_uuid_in_path:{field}", ip="?", path=f"?/{value}")
        raise HTTPException(status_code=422, detail=f"Invalid {field}: must be a UUID")
    return value


# ─── In-process path-based rate limiter ───────────────────────────────────────
# Per-IP sliding-window counters keyed by "category:ip".
# NOTE: counters are per-process — multi-worker K8s deployments need Redis-backed
# limiting (e.g. slowapi with redis storage) for strict enforcement.
_WINDOW_SECS = 60
_buckets: dict[str, deque] = defaultdict(deque)

# Most-specific match wins (checked in order).
_PATH_LIMITS: list[tuple[str, int]] = [
    # Bulk AI / scraping — most expensive; tight limit per IP
    ("/bulk-autofill",     4),
    ("/bulk-analyze",      4),
    ("/bulk-maps-enrich",  4),
    ("/autofill-bulk",     4),
    # Single-company AI calls
    ("/analyze-website",  10),
    ("/check-compliance", 10),
    ("/autofill-linkedin",10),
    ("/autofill",         20),   # single-lead autofill
    # Discovery & enrichment  (paid external APIs)
    ("/maps-discover",    15),
    ("/people-search",    20),
    ("/enrich",           40),
    ("/prefill",          40),
    # Everything else
    ("",                 200),   # global fallback
]

_SKIP_PATHS = frozenset(["/", "/health", "/api/health", "/docs", "/redoc", "/openapi.json"])


def _path_limit(path: str) -> int:
    for fragment, limit in _PATH_LIMITS:
        if fragment and fragment in path:
            return limit
    return 200


async def path_rate_limit_middleware(request: Request, call_next):
    """Sliding-window rate limiter applied to every route by path category."""
    path = request.url.path
    if path in _SKIP_PATHS:
        return await call_next(request)

    ip  = request.client.host if request.client else "0.0.0.0"
    lim = _path_limit(path)
    key = f"{lim}:{ip}"   # group IPs by the limit tier they triggered
    now = time.monotonic()

    bucket = _buckets[key]
    # Evict expired entries (no lock needed — GIL protects deque ops)
    while bucket and bucket[0] < now - _WINDOW_SECS:
        bucket.popleft()

    if len(bucket) >= lim:
        log_rate_limit_hit(ip=ip, path=path, limit=lim)
        # Flag as suspicious if WAY over limit (possible bot)
        if len(bucket) >= lim * 3:
            log_suspicious("excessive_rate_limit_hits", ip=ip, path=path)
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please slow down and try again."},
            headers={"Retry-After": "60"},
        )

    bucket.append(now)
    response = await call_next(request)

    # Log 5xx errors for observability
    if response.status_code >= 500:
        log_api_error(path=path, status=response.status_code, ip=ip)

    return response
