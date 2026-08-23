import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "@/lib/authApi";
import { useSession } from "@/context/SessionContext";
import { deriveKeys, cacheEncKey, loadEncKey, clearEncKey, encryptMapping, decryptMapping } from "@/lib/crypto";

const LS_TOKEN = "pasalberapa.token";
const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const { resetSession } = useSession();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // The AES key that decrypts PII mappings. Lives in sessionStorage only, so it
  // survives a refresh but not a browser restart — at which point the user is
  // still signed in but must unlock() before real values can be shown.
  // Declared above the effect below, which clears it on an invalid token.
  const [encKey, setEncKey] = useState(null);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(LS_TOKEN);
      if (savedToken) setToken(savedToken);
      else setLoading(false);
      setEncKey(loadEncKey());
    } catch (_) {
      setLoading(false);
    }
  }, []);

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
      try { await authApi.upgradeKdf(authSecret, password, d.token); } catch (_) {}
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

  /**
   * Rotate the password and every PII mapping together.
   *
   * The encryption key is derived from the password, so changing one without
   * the other orphans every mapping. Sequence: derive both keys, pull every
   * encrypted blob, decrypt with old and re-encrypt with new, then send the
   * whole set alongside the new authSecret so the server applies it in one
   * transaction.
   *
   * `preview` (dry run) reports how many blobs cannot be decrypted with the
   * current key — those would become permanently unreadable, so the caller must
   * surface that and get explicit consent rather than discovering it after.
   */
  const changePassword = useCallback(async (currentPassword, newPassword, { preview = false } = {}) => {
    if (!user?.email) throw new Error("Belum masuk.");
    const oldKeys = await deriveKeys(user.email, currentPassword);
    const newKeys = await deriveKeys(user.email, newPassword);

    const { items = [] } = await authApi.conversationSecrets(token);
    const reencrypted = [];
    const unreadable = [];
    for (const it of items) {
      const mapping = await decryptMapping(oldKeys.encKeyRaw, it.pii_mapping_enc);
      if (!mapping) { unreadable.push(it.id); continue; }
      reencrypted.push({ id: it.id, pii_mapping_enc: await encryptMapping(newKeys.encKeyRaw, mapping) });
    }
    if (preview) return { total: items.length, rotated: reencrypted.length, unreadable: unreadable.length };

    const d = await authApi.changePassword({
      current_auth_secret: oldKeys.authSecret,
      new_auth_secret: newKeys.authSecret,
      reencrypted,
    }, token);

    // Only now is the new key the right one — swapping earlier would leave the
    // session unable to read anything if the request failed.
    if (d.token) persist(d.token, user);
    applyKey(newKeys.encKeyRaw);
    return { total: items.length, rotated: reencrypted.length, unreadable: unreadable.length };
  }, [user, token, persist, applyKey]);

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
    <Ctx.Provider value={{ token, user, loading, encKey, login, register, logout, unlock, changePassword }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
