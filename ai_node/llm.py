"""
PasalBerapa? — Klien LLM (OpenAI-compatible)
============================================
Memanggil endpoint Chat Completions yang kompatibel OpenAI. Konfigurasi lewat
ENV (JANGAN hardcode kredensial):

    LLM_BASE_URL   contoh: https://api.openai.com/v1  (atau URL server-mu)
    LLM_API_KEY    kunci rahasia (dikirim sbg Bearer token)
    LLM_MODEL      contoh: gpt-4o-mini / llama-3.1-8b-instruct / dst
    LLM_TIMEOUT    detik (default 90)
    LLM_TEMPERATURE default 0.3

Fungsi `chat_json()` meminta model membalas JSON, lalu parsing dengan toleran
(kalau bukan JSON murni, kita ekstrak blok {...} pertama; kalau tetap gagal,
bungkus sebagai {"reply": <teks mentah>}).
"""
import os
import re
import json
import logging
from typing import List, Dict, Any

import httpx

logger = logging.getLogger("pasalberapa.llm")

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "").rstrip("/")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "90"))
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0.3"))


class LLMNotConfigured(Exception):
    pass


class LLMError(Exception):
    pass


def is_configured() -> bool:
    return bool(LLM_BASE_URL and LLM_API_KEY)


def _extract_json(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    # buang code fence ```json ... ```
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    # coba ambil blok {...} pertama yang balance
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start:i + 1]
                    try:
                        return json.loads(candidate)
                    except Exception:
                        break
    # fallback: bungkus teks mentah
    return {"reply": text}


def _raw_chat(messages: List[Dict], response_format_json: bool) -> str:
    if not is_configured():
        raise LLMNotConfigured(
            "LLM belum dikonfigurasi. Set LLM_BASE_URL & LLM_API_KEY di environment."
        )
    url = f"{LLM_BASE_URL}/chat/completions"
    payload: Dict[str, Any] = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": LLM_TEMPERATURE,
    }
    if response_format_json:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=LLM_TIMEOUT) as client:
        resp = client.post(url, json=payload, headers=headers)
    if resp.status_code >= 400:
        raise LLMError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        raise LLMError(f"Format respons LLM tak terduga: {e} | {str(data)[:300]}")


def chat_json(messages: List[Dict]) -> Dict[str, Any]:
    """Panggil LLM & kembalikan dict hasil parsing JSON.
    Coba dulu dengan response_format=json_object; kalau server tidak mendukung
    (error 400/422), ulangi tanpa response_format."""
    try:
        content = _raw_chat(messages, response_format_json=True)
    except LLMError as e:
        msg = str(e)
        if msg.startswith("HTTP 4"):
            logger.info("[llm] response_format json_object ditolak, retry polos. (%s)", msg[:120])
            content = _raw_chat(messages, response_format_json=False)
        else:
            raise
    return _extract_json(content)


def status() -> Dict[str, Any]:
    return {
        "configured": is_configured(),
        "base_url_set": bool(LLM_BASE_URL),
        "model": LLM_MODEL if is_configured() else None,
    }
