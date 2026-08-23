import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "@/lib/authApi";
import { useSession } from "@/context/SessionContext";
import { deriveKeys, cacheEncKey, loadEncKey, clearEncKey } from "@/lib/crypto";

const LS_TOKEN = "pasalberapa.token";
const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const { resetSession } = useSession();
  const [token, setToken] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(LS_TOKEN) || null;
      } catch (_) {}
    }
    return null;
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return Boolean(localStorage.getItem(LS_TOKEN));
      } catch (_) {}
    }
    return false;
  });

  useEffect(() => {
    let alive = true;
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me(token)
      .then((d) => alive && setUser(d.user))
      .catch(() => {
        if (!alive) return;
        try { localStorage.removeItem(LS_TOKEN); } catch (_) {}
        setToken(null);
        setUser(null);
        clearEncKey();
        setEncKey(null);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token]);

  // The AES key that decrypts PII mappings. Lives in sessionStorage only, so it
  // survives a refresh but not a browser restart — at which point the user is
  // still signed in but must unlock() before real values can be shown.
  const [encKey, setEncKey] = useState(() => (typeof window !== "undefined" ? loadEncKey() : null));

  const applyKey = useCallback((raw) => {
    cacheEncKey(raw);
    setEncKey(raw);
  }, []);

  const persist = useCallback((tok, usr) => {
    try { localStorage.setItem(LS_TOKEN, tok); } catch (_) {}
    setToken(tok);
    setUser(usr);
  }, []);

  const login = useCallback(async (email, password) => {
    const { kdf_version: kdf } = await authApi.authParams(email).catch(() => ({ kdf_version: 1 }));
    const { authSecret, encKeyRaw } = await deriveKeys(email, password);

    // v0 accounts were hashed over the raw password, so they must authenticate
    // with it once — then immediately move to the derived secret, after which
    // the server never sees the password again.
    const d = kdf >= 1
      ? await authApi.login({ email, auth_secret: authSecret })
      : await authApi.login({ email, password });
    persist(d.token, d.user);
    applyKey(encKeyRaw);

    if ((d.kdf_version ?? kdf) < 1) {
      try { await authApi.upgradeKdf(authSecret, d.token); } catch (_) {}
    }
    return d.user;
  }, [persist, applyKey]);

  const register = useCallback(async (email, password, name) => {
    const { authSecret, encKeyRaw } = await deriveKeys(email, password);
    const d = await authApi.register({ email, auth_secret: authSecret, name });
    persist(d.token, d.user);
    applyKey(encKeyRaw);
    return d.user;
  }, [persist, applyKey]);

  // Re-derive the key for an already-signed-in session (browser restart). No
  // network call: a wrong password simply fails to decrypt, since the server
  // has nothing to validate it against.
  const unlock = useCallback(async (password) => {
    if (!user?.email) return false;
    const { encKeyRaw } = await deriveKeys(user.email, password);
    applyKey(encKeyRaw);
    return true;
  }, [user, applyKey]);

  // Logging out must also drop the in-memory/sessionStorage conversation: it
  // belongs to the account that just left (visible to whoever logs in next),
  // and its convId would otherwise be autosaved against the new account.
  const logout = useCallback(() => {
    try { localStorage.removeItem(LS_TOKEN); } catch (_) {}
    setToken(null);
    setUser(null);
    clearEncKey();
    setEncKey(null);
    resetSession();
  }, [resetSession]);

  return (
    <Ctx.Provider value={{ token, user, loading, encKey, login, register, logout, unlock }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
