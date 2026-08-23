// Client-side key derivation and mapping encryption.
//
// The PII mapping ({"<PERSON_1>": "Budi Santoso"}) is the one artefact that must
// never be readable by the server. pasalberapa is headed for hosted/multi-user,
// so "trust the operator" stops being self-trust: an operator, a database dump,
// or a leaked credential must all learn nothing.
//
// Split-KDF, so the server never even sees the password it could derive a key
// from:
//
//   masterKey  = PBKDF2-SHA256(password, "pasalberapa|"+email, 600k)
//   authSecret = HKDF(masterKey, info="auth")  -> sent instead of the password
//   encKey     = HKDF(masterKey, info="enc")   -> AES-GCM-256, never transmitted
//
// The salt is derived from the email so the client can compute it with no
// round-trip (the Bitwarden model). That trades a per-user random salt for
// client-derivability; 600k iterations covers the precomputation risk.
//
// NOTE: this is NOT a defence against the AI node, which receives the raw
// document at /mask and must, in order to mask it at all. This protects storage.
//
// WARNING: there is no password-change route. If one is added it MUST re-derive
// encKey and re-encrypt every mapping. A password reset destroys them for good.

const KDF_ITERATIONS = 600_000;
const SS_KEY = "pasalberapa.enckey";

function subtle(): SubtleCrypto {
  const c = typeof window !== "undefined" ? window.crypto : undefined;
  if (!c?.subtle) {
    // crypto.subtle is only exposed in a secure context: https, or localhost.
    throw new Error(
      "Enkripsi butuh koneksi aman (HTTPS). Buka lewat https:// atau localhost."
    );
  }
  return c.subtle;
}

const enc = new TextEncoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function hkdf(masterBits: ArrayBuffer, info: string): Promise<ArrayBuffer> {
  const base = await subtle().importKey("raw", masterBits, "HKDF", false, ["deriveBits"]);
  return subtle().deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) },
    base,
    256
  );
}

/**
 * Derive the auth secret (sent to the server) and the encryption key (never
 * sent) from the user's password. Deliberately slow — ~1s is the point.
 */
export async function deriveKeys(email: string, password: string) {
  const pw = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const masterBits = await subtle().deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(`pasalberapa|${(email || "").trim().toLowerCase()}`),
      iterations: KDF_ITERATIONS,
    },
    pw,
    256
  );

  const authBits = await hkdf(masterBits, "auth");
  const encBits = await hkdf(masterBits, "enc");

  return { authSecret: toB64(authBits), encKeyRaw: toB64(encBits) };
}

async function importEncKey(raw: string): Promise<CryptoKey> {
  return subtle().importKey("raw", fromB64(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** base64(iv ‖ ciphertext). Fresh 96-bit IV per call — never reuse one under AES-GCM. */
export async function encryptMapping(encKeyRaw: string, mapping: Record<string, string>) {
  if (!encKeyRaw) return null;
  const key = await importEncKey(encKeyRaw);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(mapping || {}));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, data);
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return toB64(out);
}

/**
 * Returns null when the blob cannot be read — wrong key, or tampered-with data
 * (AES-GCM authenticates, so a modified ciphertext fails rather than decoding
 * to garbage). Callers fall back to showing tags, which is safe.
 */
export async function decryptMapping(encKeyRaw: string, blob: string) {
  if (!encKeyRaw || !blob) return null;
  try {
    const key = await importEncKey(encKeyRaw);
    const bytes = fromB64(blob);
    const pt = await subtle().decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12)
    );
    const parsed = JSON.parse(new TextDecoder().decode(pt));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

// --- key cache -------------------------------------------------------------
// sessionStorage, NOT localStorage. The JWT in localStorage only grants access
// to masked data; this key unlocks real PII, so the two must not share exposure.
// Cost: after a browser restart the user is still signed in but must unlock.

export function cacheEncKey(raw: string) {
  try { sessionStorage.setItem(SS_KEY, raw); } catch (_) {}
}

export function loadEncKey(): string | null {
  try { return sessionStorage.getItem(SS_KEY); } catch (_) { return null; }
}

export function clearEncKey() {
  try { sessionStorage.removeItem(SS_KEY); } catch (_) {}
}
