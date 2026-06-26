"""Security utilities: structured audit logging, UUID validation, rate-limit middleware,
SSRF protection, cron authentication, and input sanitisation."""
import ipaddress as _ip
import json
import logging
import os
import re
import socket as _socket
import time
from collections import defaultdict, deque
from typing import Any
from urllib.parse import urlparse as _urlparse

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


# ─── SSRF protection ──────────────────────────────────────────────────────────
_PRIVATE_NETS = [
    _ip.ip_network("10.0.0.0/8"),
    _ip.ip_network("172.16.0.0/12"),
    _ip.ip_network("192.168.0.0/16"),
    _ip.ip_network("127.0.0.0/8"),
    _ip.ip_network("169.254.0.0/16"),   # link-local + cloud metadata (169.254.169.254)
    _ip.ip_network("100.64.0.0/10"),    # carrier-grade NAT
    _ip.ip_network("0.0.0.0/8"),
    _ip.ip_network("::1/128"),
    _ip.ip_network("fc00::/7"),
    _ip.ip_network("fe80::/10"),
]

_BLOCKED_HOSTS = frozenset({
    "localhost", "127.0.0.1", "::1",
    "169.254.169.254",               # AWS/Azure/DO metadata
    "metadata.google.internal",      # GCP metadata
    "100.100.100.200",               # Alibaba Cloud metadata
    "fd00:ec2::254",                 # AWS IPv6 metadata
})


def _ip_is_safe(addr: str) -> bool:
    try:
        ip_obj = _ip.ip_address(addr)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_unspecified:
            return False
        for net in _PRIVATE_NETS:
            if ip_obj in net:
                return False
        return True
    except ValueError:
        return True  # not an IP literal; handled by hostname block


def validate_external_url(url: str, field: str = "url") -> str:
    """SSRF guard — validate a user-supplied URL is safe for server-side fetching.
    Blocks private/loopback/link-local IPs and known cloud metadata endpoints.
    Raises HTTPException 422 on bad input, 403 on SSRF risk."""
    if not url or len(url) > 2048:
        raise HTTPException(status_code=422, detail=f"{field}: URL missing or exceeds maximum length")
    try:
        parsed = _urlparse(url)
    except Exception:
        raise HTTPException(status_code=422, detail=f"{field}: malformed URL")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=422, detail=f"{field}: only http/https URLs are permitted")

    hostname = (parsed.hostname or "").lower().rstrip(".")
    if not hostname:
        raise HTTPException(status_code=422, detail=f"{field}: URL has no hostname")
    if hostname in _BLOCKED_HOSTS:
        log_suspicious("ssrf_blocked_host", ip="?", path=url)
        raise HTTPException(status_code=403, detail=f"{field}: target not permitted")

    # IP literal — check directly without DNS
    try:
        _ip.ip_address(hostname)
        if not _ip_is_safe(hostname):
            log_suspicious("ssrf_blocked_ip", ip="?", path=url)
            raise HTTPException(status_code=403, detail=f"{field}: target not permitted")
        return url
    except ValueError:
        pass  # hostname, not an IP literal

    # Resolve and check all returned IPs (catches SSRF via DNS pointing to internal IPs)
    try:
        addrs = _socket.getaddrinfo(hostname, None, 0, _socket.SOCK_STREAM)
        for _, _, _, _, sockaddr in addrs:
            if not _ip_is_safe(sockaddr[0]):
                log_suspicious("ssrf_blocked_resolved_ip", ip="?", path=url)
                raise HTTPException(status_code=403, detail=f"{field}: target not permitted")
    except HTTPException:
        raise
    except Exception:
        pass  # DNS failure at validation time — let the actual fetch fail naturally

    return url


# ─── Cron job authentication ───────────────────────────────────────────────────

def verify_cron_auth(request: Request) -> None:
    """Verify the request originates from Vercel's cron runner via CRON_SECRET env var.
    Set CRON_SECRET in Vercel env; Vercel automatically passes it as Authorization: Bearer.
    No-op in development when CRON_SECRET is not set."""
    secret = os.getenv("CRON_SECRET")
    if not secret:
        return  # Dev mode — skip enforcement
    auth = request.headers.get("authorization", "")
    if auth != f"Bearer {secret}":
        log_suspicious(
            "unauthorized_cron_trigger",
            ip=request.client.host if request.client else "?",
            path=str(request.url.path),
        )
        raise HTTPException(status_code=401, detail="Cron authentication required")


# ─── Input sanitisation ───────────────────────────────────────────────────────

def sanitize_text(value: str | None, max_len: int = 500, field: str = "field") -> str:
    """Strip whitespace and enforce a maximum length on text input.
    Raises 422 if the value exceeds max_len characters."""
    val = (value or "").strip()
    if len(val) > max_len:
        raise HTTPException(status_code=422, detail=f"{field} exceeds maximum length ({max_len} chars)")
    return val


# ─── In-process path-based rate limiter ───────────────────────────────────────
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
