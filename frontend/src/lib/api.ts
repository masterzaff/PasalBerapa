// Thin, resilient client for the user-hosted AI gateway.
// Every call fails GRACEFULLY: if an endpoint is not configured or unreachable,
// we throw a typed error the UI turns into a friendly "waiting for backend" state.

import { getEndpoints } from "@/lib/config";

export class NotConfiguredError extends Error {
  constructor(what) {
    super(`Endpoint "${what}" belum dikonfigurasi.`);
    this.name = "NotConfiguredError";
    this.code = "NOT_CONFIGURED";
  }
}

export class GatewayError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GatewayError";
    this.code = "GATEWAY_ERROR";
    this.status = status;
  }
}

export class CancelledError extends Error {
  constructor() {
    super("Analisis dibatalkan.");
    this.name = "CancelledError";
    this.code = "CANCELLED";
  }
}

// Combine the internal timeout with an optional caller-supplied signal, so a
// user-initiated cancel and a timeout stay distinguishable (one is an error to
// report, the other is not).
function linkSignals(controller, external) {
  if (!external) return () => {};
  if (external.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  external.addEventListener("abort", onAbort, { once: true });
  return () => external.removeEventListener("abort", onAbort);
}

async function postJson(url, body, timeoutMs, signal = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 60000);
  const unlink = linkSignals(controller, signal);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j.detail || j.message || detail;
      } catch (_) {}
      throw new GatewayError(detail, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      // Both a cancel and a timeout surface as AbortError; only the caller's
      // signal tells them apart, and a cancel is not a failure to report.
      if (signal?.aborted) throw new CancelledError();
      throw new GatewayError("Timeout — server kelamaan merespons.", 408);
    }
    if (err instanceof GatewayError) throw err;
    throw new GatewayError(err.message || "Gagal terhubung ke server.");
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

// Health check against the Backend Server. Returns {ok, latencyMs, detail}.
export async function testConnection(cfg = getEndpoints()) {
  const url = (cfg.healthEndpoint || `${cfg.apiRoot || "/api"}/health`).trim();
  if (!url) throw new NotConfiguredError("Health check URL");
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(cfg.timeoutMs || 15000, 15000));
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const latencyMs = Math.round(performance.now() - started);
    if (!res.ok) throw new GatewayError(`Health check gagal (HTTP ${res.status})`, res.status);
    let detail = null;
    try { detail = await res.json(); } catch (_) {}
    return { ok: true, latencyMs, detail };
  } catch (err) {
    if (err.name === "AbortError") throw new GatewayError("Timeout saat cek koneksi.", 408);
    if (err instanceof GatewayError) throw err;
    throw new GatewayError(err.message || "Server tidak dapat dihubungi.");
  } finally {
    clearTimeout(timer);
  }
}

// PII masking: send raw text, receive masked text + mapping.
// `knownMapping` continues an in-flight session so an already-tagged value keeps
// its tag and new tags carry on numbering instead of restarting at _1 — required
// when masking a chat question against a document that was already masked.
// Expected response shape:
//   { masked_text: string, mapping: {"<PERSON_1>":"Andi"}, entities: [{tag,type,value}] }
export async function maskPII({ text, sessionId, knownMapping }, cfg = getEndpoints()) {
  const url = (cfg.piiEndpoint || "").trim();
  if (!url) throw new NotConfiguredError("PII Masking");
  const data = await postJson(
    url,
    { text, session_id: sessionId, known_mapping: knownMapping || null },
    cfg.timeoutMs
  );
  return {
    maskedText: data.masked_text ?? data.maskedText ?? text,
    mapping: data.mapping ?? {},
    entities: data.entities ?? [],
  };
}

// Analysis: send MASKED text + a mode, receive structured analysis (tags preserved).
// Modes: "risk" | "summary" | "key_articles" | "chat"
// Expected response shape (all optional except reply):
//   { reply, summary, risk_score, risks:[{id,level,title,explanation,article_refs,suggestion,source_excerpt}],
//     citations:[{regulation,article,snippet,url}] }
export async function analyzeDocument(
  { maskedText, mode, question, history, sessionId, signal },
  cfg = getEndpoints()
) {
  const url = (cfg.analyzeEndpoint || "").trim();
  if (!url) throw new NotConfiguredError("Analisis");
  const data = await postJson(
    url,
    {
      masked_text: maskedText,
      mode,
      question: question || null,
      history: history || [],
      session_id: sessionId,
    },
    cfg.timeoutMs,
    signal
  );
  return data;
}
