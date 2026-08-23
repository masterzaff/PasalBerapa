// External-endpoint config for PasalBerapa?.
//
// The frontend is a privacy-first WRAPPER: PII masking + LLM analysis run on the
// AI node. Endpoints come from build-time env only.
//
// There used to be a Settings panel that wrote overrides to localStorage and a
// whole read-merge-reset layer behind it. Both are gone: deployment config
// belongs to the deployment, not to per-browser state that silently diverges
// from it and can only be inspected by opening devtools.
//
// NOTE: NEXT_PUBLIC_* is inlined by Next at build time, so changing any of these
// requires a rebuild — that is the intended contract now, not a limitation.

const ENDPOINTS = Object.freeze({
  aiNodeUrl: process.env.NEXT_PUBLIC_AI_NODE_URL || process.env.REACT_APP_AI_NODE_URL || "http://localhost:8000/api",
  piiEndpoint: process.env.NEXT_PUBLIC_PII_ENDPOINT || process.env.REACT_APP_PII_ENDPOINT || "http://localhost:8000/api/mask",
  analyzeEndpoint: process.env.NEXT_PUBLIC_ANALYZE_ENDPOINT || process.env.REACT_APP_ANALYZE_ENDPOINT || "http://localhost:8000/api/analyze",
  timeoutMs: Number(process.env.NEXT_PUBLIC_TIMEOUT_MS) || 60000,
});

// Stable identity on purpose: callers use it in useMemo/useState deps.
export function getEndpoints() {
  return ENDPOINTS;
}

// Whether analysis features can even be attempted (an endpoint is configured).
export function hasAnalyzeConfigured(cfg = getEndpoints()) {
  return Boolean(cfg.analyzeEndpoint && cfg.analyzeEndpoint.trim());
}

export function hasMaskConfigured(cfg = getEndpoints()) {
  return Boolean(cfg.piiEndpoint && cfg.piiEndpoint.trim());
}
