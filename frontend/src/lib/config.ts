// Configurable external-endpoint layer for PasalBerapa?.
// The frontend is a privacy-first WRAPPER: PII masking + RAG/LLM analysis run on
// the user's own server. These values default to env vars but can be overridden
// at runtime from the Settings panel (stored ONLY as connection config, never
// document/PII content).

const LS_KEY = "pasalberapa.endpoints.v1";

const ENV_DEFAULTS = {
  aiNodeUrl: process.env.NEXT_PUBLIC_AI_NODE_URL || process.env.REACT_APP_AI_NODE_URL || "http://localhost:8000/api",
  piiEndpoint: process.env.NEXT_PUBLIC_PII_ENDPOINT || process.env.REACT_APP_PII_ENDPOINT || "http://localhost:8000/api/mask",
  analyzeEndpoint: process.env.NEXT_PUBLIC_ANALYZE_ENDPOINT || process.env.REACT_APP_ANALYZE_ENDPOINT || "http://localhost:8000/api/analyze",
  timeoutMs: 60000,
};

// The build-time defaults. NEXT_PUBLIC_* is inlined by Next at build time, so
// these are effectively baked into the bundle and cannot change without a
// rebuild — which is exactly why the localStorage override below exists.
export function getEnvDefaults() {
  return { ...ENV_DEFAULTS };
}

export function getEndpoints() {
  let stored = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      stored = {};
    }
  }
  return {
    aiNodeUrl: stored.aiNodeUrl ?? ENV_DEFAULTS.aiNodeUrl,
    piiEndpoint: stored.piiEndpoint ?? ENV_DEFAULTS.piiEndpoint,
    analyzeEndpoint: stored.analyzeEndpoint ?? ENV_DEFAULTS.analyzeEndpoint,
    timeoutMs: stored.timeoutMs ?? ENV_DEFAULTS.timeoutMs,
  };
}

export function saveEndpoints(next) {
  const merged = { ...getEndpoints(), ...next };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch (_) {}
  }
  return merged;
}

export function resetEndpoints() {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(LS_KEY);
    } catch (_) {}
  }
  return getEndpoints();
}

// Whether analysis features can even be attempted (an endpoint is configured).
export function hasAnalyzeConfigured(cfg = getEndpoints()) {
  return Boolean(cfg.analyzeEndpoint && cfg.analyzeEndpoint.trim());
}

export function hasMaskConfigured(cfg = getEndpoints()) {
  return Boolean(cfg.piiEndpoint && cfg.piiEndpoint.trim());
}
