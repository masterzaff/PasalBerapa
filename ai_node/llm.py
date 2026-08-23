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
from typing import List, Dict, Any, Optional, Tuple

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


def _parse_chat_response(text: str) -> Dict[str, Any]:
    """Parse respons baik berupa JSON tunggal standar, JSON dengan trailing data: [DONE], maupun stream SSE."""
    text = (text or "").strip()
    if not text:
        return {"choices": [{"message": {"role": "assistant", "content": ""}}]}
    
    # 1. Bersihkan trailing "data: [DONE]" atau "[DONE]" jika ada di akhir teks
    cleaned = re.sub(r"(?:data:\s*)?\[DONE\]\s*$", "", text, flags=re.IGNORECASE).strip()

    # 2. Coba decode JSON utuh langsung
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            if "error" in data:
                err_msg = data["error"].get("message") if isinstance(data["error"], dict) else str(data["error"])
                raise LLMError(f"LLM Error: {err_msg}")
            return data
    except Exception:
        pass

    # 3. Coba ekstrak blok JSON pertama {...} jika ada data/karakter tambahan di belakangnya
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            data = json.loads(cleaned[start:end+1])
            if isinstance(data, dict) and ("choices" in data or "error" in data):
                if "error" in data:
                    err_msg = data["error"].get("message") if isinstance(data["error"], dict) else str(data["error"])
                    raise LLMError(f"LLM Error: {err_msg}")
                return data
        except Exception:
            pass

    # 4. Jika murni format SSE stream chunk (data: {"choices": [{"delta": ...}]})
    combined_content = []
    tool_calls_map = {}

    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue
        chunk_str = line[5:].strip()
        if chunk_str in ("[DONE]", ""):
            continue
        try:
            chunk = json.loads(chunk_str)
            choices = chunk.get("choices", [])
            if not choices:
                continue
            delta = choices[0].get("delta", {})
            if "content" in delta and delta["content"]:
                combined_content.append(delta["content"])
            if "tool_calls" in delta and delta["tool_calls"]:
                for tc in delta["tool_calls"]:
                    idx = tc.get("index", 0)
                    if idx not in tool_calls_map:
                        tool_calls_map[idx] = {
                            "id": tc.get("id", f"call_{idx}"),
                            "type": "function",
                            "function": {"name": "", "arguments": ""}
                        }
                    fn = tc.get("function", {})
                    if "name" in fn and fn["name"]:
                        tool_calls_map[idx]["function"]["name"] += fn["name"]
                    if "arguments" in fn and fn["arguments"]:
                        tool_calls_map[idx]["function"]["arguments"] += fn["arguments"]
        except Exception:
            continue

    tool_calls_list = list(tool_calls_map.values()) if tool_calls_map else None
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "".join(combined_content),
                    **({"tool_calls": tool_calls_list} if tool_calls_list else {})
                }
            }
        ]
    }


def _raw_chat(messages: List[Dict], response_format: Optional[Dict[str, Any]] = None) -> str:
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
    if response_format:
        payload["response_format"] = response_format

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=LLM_TIMEOUT) as client:
        resp = client.post(url, json=payload, headers=headers)
    if resp.status_code >= 400:
        raise LLMError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    
    data = _parse_chat_response(resp.text)
    try:
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        raise LLMError(f"Format respons LLM tak terduga: {e} | {str(data)[:300]}")


# Mode yang butuh konten terstruktur langsung dari reasoning LLM (risks/citations).
# Mode lain (chat/summary) cukup teks biasa — lihat prompts.JSON_MODES (harus selaras).
_JSON_MODES = ("risk", "key_articles")

_RISK_SCHEMA: Dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "risk_analysis",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "reply": {"type": "string"},
                "risk_score": {"type": "integer"},
                "risks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "level": {"type": "string", "enum": ["high", "warning", "safe"]},
                            "title": {"type": "string"},
                            "explanation": {"type": "string"},
                            "article_refs": {"type": "array", "items": {"type": "string"}},
                            "suggestion": {"type": "string"},
                            "source_excerpt": {"type": "string"},
                        },
                        "required": ["id", "level", "title", "explanation", "article_refs", "suggestion", "source_excerpt"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["reply", "risk_score", "risks"],
            "additionalProperties": False,
        },
    },
}

_KEY_ARTICLES_SCHEMA: Dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "key_articles_analysis",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "reply": {"type": "string"},
                "citations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "regulation": {"type": "string"},
                            "article": {"type": "string"},
                            "snippet": {"type": "string"},
                            "url": {"type": "string"},
                        },
                        "required": ["regulation", "article", "snippet", "url"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["reply", "citations"],
            "additionalProperties": False,
        },
    },
}


def _describe_tool_call(fname: str, fargs: Dict[str, Any]) -> str:
    """Label singkat & manusiawi utk breakdown aksi agent di frontend."""
    if fname == "search_indonesian_law":
        q = fargs.get("query", "")
        reg = fargs.get("regulation")
        return f"Cari pasal hukum: \"{q}\"" + (f" ({reg})" if reg else "")
    if fname == "read_law":
        ident = fargs.get("identifier", "")
        pasal = fargs.get("pasal")
        if pasal:
            return f"Baca {pasal} ({ident})"
        s_line = fargs.get("start_line")
        e_line = fargs.get("end_line")
        if s_line and e_line:
            return f"Baca isi peraturan {ident} baris {s_line}-{e_line}"
        return f"Baca isi peraturan {ident}"
    if fname == "search_user_document":
        return f"Cari di dokumen pengguna: \"{fargs.get('query', '')}\""
    if fname == "read_document_lines":
        return f"Baca dokumen baris {fargs.get('start_line', '?')}-{fargs.get('end_line', '?')}"
    return f"Panggil tool '{fname}'"


def _schema_for_mode(mode: str) -> Optional[Dict[str, Any]]:
    if mode == "risk":
        return _RISK_SCHEMA
    if mode == "key_articles":
        return _KEY_ARTICLES_SCHEMA
    return None


def chat_json(messages: List[Dict], response_schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Panggil LLM & kembalikan dict hasil.
    Kalau `response_schema` diberikan: coba dulu dengan schema itu (strict JSON), retry
    polos kalau server menolak (400/422). Kalau tidak: minta teks biasa, bungkus sebagai
    {"reply": ...} tanpa parsing JSON sama sekali."""
    if response_schema is None:
        content = _raw_chat(messages, response_format=None)
        return {"reply": content}
    try:
        content = _raw_chat(messages, response_format=response_schema)
    except LLMError as e:
        msg = str(e)
        if msg.startswith("HTTP 4") or "json" in msg.lower():
            logger.info("[llm] response_format json_schema ditolak, retry polos. (%s)", msg[:120])
            content = _raw_chat(messages, response_format=None)
        else:
            raise
    return _extract_json(content)


def chat_agentic(
    messages: List[Dict],
    tools: Optional[List[Dict]] = None,
    tool_executor: Optional[Any] = None,
    max_steps: int = 3,
    mode: str = "chat",
) -> tuple:
    """Menjalankan loop Agentic Tool Calling (ReAct) hingga LLM menghasilkan jawaban akhir.
    Untuk mode di _JSON_MODES, jawaban akhir di-enforce lewat response_format json_schema
    (strict). Mode lain (chat/summary) tidak diminta JSON sama sekali — teks mentah jadi 'reply'.
    Mengembalikan: (result_dict, collected_citations_list, actions_list, debug_messages)
    `debug_messages` adalah messages persis yg dilihat LLM di panggilan terakhir — buat
    keperluan debug di frontend, bukan bagian dari kontrak /analyze utama."""
    if not is_configured():
        raise LLMNotConfigured(
            "LLM belum dikonfigurasi. Set LLM_BASE_URL & LLM_API_KEY di environment."
        )

    schema = _schema_for_mode(mode)

    if not tools or not tool_executor:
        return chat_json(messages, response_schema=schema), [], [], messages

    url = f"{LLM_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    current_messages = list(messages)
    collected_citations: List[Dict[str, Any]] = []
    actions: List[Dict[str, Any]] = []

    with httpx.Client(timeout=LLM_TIMEOUT) as client:
        for step in range(max_steps):
            payload: Dict[str, Any] = {
                "model": LLM_MODEL,
                "messages": current_messages,
                "temperature": LLM_TEMPERATURE,
            }
            if tools:
                payload["tools"] = tools
                payload["tool_choice"] = "auto"
            if schema:
                payload["response_format"] = schema

            try:
                resp = client.post(url, json=payload, headers=headers)
            except Exception as e:
                logger.error("[llm] Gagal request agentic chat: %s", e)
                raise LLMError(f"Koneksi LLM error: {e}")

            if resp.status_code >= 400:
                # Jika endpoint model tidak mendukung tools/response_format, fallback ke chat_json standar
                if "tool" in resp.text.lower() or resp.status_code in (400, 422):
                    logger.warning("[llm] Tool calling ditolak endpoint, fallback ke chat_json standar: %s", resp.text[:200])
                    return chat_json(messages, response_schema=schema), collected_citations, actions, current_messages
                raise LLMError(f"HTTP {resp.status_code}: {resp.text[:500]}")

            data = _parse_chat_response(resp.text)
            choice = data["choices"][0]["message"]
            tool_calls = choice.get("tool_calls")

            # Jika LLM memutuskan untuk memanggil tool
            if tool_calls and tool_executor:
                current_messages.append(choice)
                for tc in tool_calls:
                    call_id = tc["id"]
                    func = tc["function"]
                    fname = func["name"]
                    fargs_str = func.get("arguments", "{}")
                    try:
                        fargs = json.loads(fargs_str) if isinstance(fargs_str, str) else (fargs_str or {})
                    except Exception:
                        fargs = {}

                    logger.info("[agent] Step %d: Memanggil tool %s(%s)", step + 1, fname, fargs)
                    tool_result = tool_executor(fname, fargs)
                    actions.append({"tool": fname, "label": _describe_tool_call(fname, fargs)})

                    # Simpan citations jika ada hasil pasal hukum dari tool
                    if fname == "search_indonesian_law" and isinstance(tool_result, dict) and tool_result.get("results"):
                        for r in tool_result["results"]:
                            if r not in collected_citations:
                                collected_citations.append(r)
                    elif fname == "read_law" and isinstance(tool_result, dict) and tool_result.get("found"):
                        cit = {
                            "regulation": tool_result.get("regulation", ""),
                            "article": tool_result.get("pasal", ""),
                            "snippet": (tool_result.get("content", "") or "")[:500],
                            "url": tool_result.get("url", ""),
                        }
                        if cit.get("regulation") and cit not in collected_citations:
                            collected_citations.append(cit)

                    current_messages.append({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "name": fname,
                        "content": json.dumps(tool_result, ensure_ascii=False)
                    })
                # Lanjutkan ke loop berikutnya agar LLM membaca hasil tool
                continue

            # Jika LLM sudah menghasilkan jawaban akhir (tanpa tool calls)
            content = choice.get("content") or ""
            if schema:
                return _extract_json(content), collected_citations, actions, current_messages
            return {"reply": content}, collected_citations, actions, current_messages

        # Jika loop selesai mencapai batas max_steps, minta jawaban final
        # (masih di dalam blok `with` agar `client` belum ditutup)
        logger.info("[agent] Mencapai batas max_steps (%d), meminta jawaban final...", max_steps)
        try:
            wrap_hint = " sesuai skema JSON yang diminta." if schema else "."
            current_messages.append({
                "role": "user",
                "content": "Sekarang susun kesimpulan analisis final kamu" + wrap_hint
            })
            final_payload: Dict[str, Any] = {
                "model": LLM_MODEL,
                "messages": current_messages,
                "temperature": LLM_TEMPERATURE,
            }
            if schema:
                final_payload["response_format"] = schema
            final_resp = client.post(url, json=final_payload, headers=headers)

            if final_resp.status_code == 200:
                parsed_final = _parse_chat_response(final_resp.text)
                raw_content = parsed_final["choices"][0]["message"]["content"]
                if schema:
                    return _extract_json(raw_content), collected_citations, actions, current_messages
                return {"reply": raw_content}, collected_citations, actions, current_messages
        except Exception as e:
            logger.warning("[agent] Gagal mengambil final response: %s", e)

    return chat_json(messages, response_schema=schema), collected_citations, actions, current_messages


def status() -> Dict[str, Any]:
    return {
        "configured": is_configured(),
        "base_url_set": bool(LLM_BASE_URL),
        "model": LLM_MODEL if is_configured() else None,
    }
