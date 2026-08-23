// Persistent per-browser credential for anonymous (logged-out) conversations.
//
// Distinct from SessionContext's sessionId: sessionId is minted fresh per
// conversation (it's that conversation's DB primary key) and lives in
// sessionStorage. This key is minted ONCE per browser, lives in localStorage
// so it survives tab close/reopen, and is sent on every request as the
// X-Anon-Key header — the server requires it to match before letting an
// anonymous request read/write a conversation it didn't create.

const LS_KEY = "pasalberapa.anon_key.v1";

let cached: string | null = null;

export function getAnonKey(): string | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    let key = localStorage.getItem(LS_KEY);
    if (!key) {
      key =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "anon_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(LS_KEY, key);
    }
    cached = key;
    return key;
  } catch (_) {
    // localStorage unavailable (private mode, disabled storage) — anonymous
    // conversations just fall back to being unauthenticated for this
    // browser; nothing to persist.
    return null;
  }
}
