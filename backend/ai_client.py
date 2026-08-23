import os
from typing import Optional

import httpx

AI_NODE_URL = os.environ.get("AI_NODE_URL", "http://ai_node:8000").rstrip("/")

# Shared across server.py's /mask,/analyze proxy routes AND auth.py's
# message-action routes (both live in the same FastAPI process) — one
# connection pool instead of each module opening its own.
client: Optional[httpx.AsyncClient] = None


async def start():
    global client
    client = httpx.AsyncClient(base_url=AI_NODE_URL, timeout=60.0)


async def stop():
    global client
    if client:
        await client.aclose()
        client = None


async def analyze(payload: dict, timeout: float = 90.0) -> dict:
    """Call ai_node's /analyze and return the parsed JSON body.

    Raises httpx.ConnectError/ConnectTimeout/TimeoutException on failure —
    callers translate those into the appropriate HTTPException."""
    res = await client.post("/analyze", json=payload, timeout=timeout)
    res.raise_for_status()
    return res.json()
