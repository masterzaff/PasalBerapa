import asyncio
import os
import time
from collections import deque
from typing import Optional

import httpx

AI_NODE_URL = os.environ.get("AI_NODE_URL", "http://ai_node:8000").rstrip("/")

# Shared across server.py's /mask,/analyze proxy routes AND auth.py's
# message-action routes (both live in the same FastAPI process) — one
# connection pool instead of each module opening its own.
client: Optional[httpx.AsyncClient] = None


class AiNodeBusyError(Exception):
    """Raised instead of forwarding a request when /analyze has already hit
    AI_NODE_ANALYZE_RPM calls in the trailing 60s. Fail fast with a clear
    "busy" signal rather than letting requests queue up behind the LLM call
    (which can take tens of seconds) — this is a global cap across all
    callers, not per-IP. /mask (Presidio, local and fast) is not gated by
    this, only /analyze."""


AI_NODE_ANALYZE_RPM = int(os.environ.get("AI_NODE_ANALYZE_RPM", "20"))
_analyze_calls: deque = deque()  # monotonic timestamps of /analyze calls in the trailing 60s
_analyze_lock = asyncio.Lock()


async def start():
    global client
    client = httpx.AsyncClient(base_url=AI_NODE_URL, timeout=60.0)


async def stop():
    global client
    if client:
        await client.aclose()
        client = None


async def _check_analyze_rpm():
    now = time.monotonic()
    async with _analyze_lock:
        while _analyze_calls and now - _analyze_calls[0] > 60:
            _analyze_calls.popleft()
        if len(_analyze_calls) >= AI_NODE_ANALYZE_RPM:
            raise AiNodeBusyError()
        _analyze_calls.append(now)


async def analyze(payload: dict, timeout: float = 90.0) -> dict:
    """Call ai_node's /analyze and return the parsed JSON body.

    Raises AiNodeBusyError when the global /analyze RPM cap is already hit
    (no queueing — fail fast), or httpx.ConnectError/ConnectTimeout/
    TimeoutException on failure — callers translate those into the
    appropriate HTTPException."""
    await _check_analyze_rpm()
    res = await client.post("/analyze", json=payload, timeout=timeout)
    res.raise_for_status()
    return res.json()
