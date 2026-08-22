import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "@/lib/authApi";

const LS_TOKEN = "pasalberapa.token";
const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(LS_TOKEN)));

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
        localStorage.removeItem(LS_TOKEN);
        setToken(null);
        setUser(null);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token]);

  const persist = useCallback((tok, usr) => {
    localStorage.setItem(LS_TOKEN, tok);
    setToken(tok);
    setUser(usr);
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await authApi.login({ email, password });
    persist(d.token, d.user);
    return d.user;
  }, [persist]);

  const register = useCallback(async (email, password, name) => {
    const d = await authApi.register({ email, password, name });
    persist(d.token, d.user);
    return d.user;
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(LS_TOKEN);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
