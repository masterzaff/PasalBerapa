import os
import time
from collections import deque

from starlette.requests import Request
from starlette.responses import JSONResponse

# General per-IP request cap across the whole backend — meant to blunt abuse
# once this is reachable publicly (Cloudflare Tunnel), independent of the
# separate /analyze RPM cap in ai_client.py which protects ai_node itself.
RATE_LIMIT_RPM = int(os.environ.get("RATE_LIMIT_RPM", "60"))

# ip -> deque of monotonic timestamps in the trailing 60s. Single-process,
# in-memory — matches this deployment (one uvicorn worker, no Redis).
_buckets: dict = {}
_last_sweep = time.monotonic()


def _client_ip(request: Request) -> str:
    # Behind Cloudflare Tunnel, request.client.host is the tunnel daemon, not
    # the visitor — CF-Connecting-IP is Cloudflare's own header for the real
    # client IP and can't be spoofed through the tunnel. X-Forwarded-For is a
    # fallback for a plain reverse proxy. Only trust these when the backend
    # itself isn't also exposed directly to the internet (tunnel-only).
    cf = request.headers.get("CF-Connecting-IP")
    if cf:
        return cf.strip()
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit_middleware(request: Request, call_next):
    global _last_sweep
    if request.method == "OPTIONS":
        return await call_next(request)

    ip = _client_ip(request)
    now = time.monotonic()
    bucket = _buckets.setdefault(ip, deque())
    while bucket and now - bucket[0] > 60:
        bucket.popleft()

    if len(bucket) >= RATE_LIMIT_RPM:
        return JSONResponse(
            status_code=429,
            content={"detail": "Terlalu banyak permintaan, coba lagi sebentar."},
            headers={"Retry-After": "60"},
        )
    bucket.append(now)

    # Bound memory from IPs that stop sending requests — sweep occasionally
    # rather than on every request.
    if now - _last_sweep > 300:
        _last_sweep = now
        stale = [k for k, v in _buckets.items() if not v or now - v[-1] > 300]
        for k in stale:
            _buckets.pop(k, None)

    return await call_next(request)
