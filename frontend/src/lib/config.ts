// External-endpoint config for PasalBerapa?.
//
// The frontend is a static client that connects to the PasalBerapa Backend Hub.
// The backend server is the single entry point (handling health, auth, conversations,
// and reverse-proxying AI node analysis and PII masking).

const RAW_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_AI_NODE_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "")
).trim();

// Strip trailing slash
const BASE_URL = RAW_API_URL.replace(/\/+$/, "");

// Ensure apiRoot is properly formatted (e.g. "http://localhost:8000/api" or "/api")
const API_ROOT = BASE_URL
  ? BASE_URL.endsWith("/api")
    ? BASE_URL
    : `${BASE_URL}/api`
  : "/api";

const ENDPOINTS = Object.freeze({
  baseUrl: BASE_URL,
  apiRoot: API_ROOT,
  healthEndpoint: `${API_ROOT}/health`,
  piiEndpoint: `${API_ROOT}/mask`,
  analyzeEndpoint: `${API_ROOT}/analyze`,
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

