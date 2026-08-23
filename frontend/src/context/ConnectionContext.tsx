import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getEndpoints, hasAnalyzeConfigured, hasMaskConfigured } from "@/lib/config";
import { testConnection } from "@/lib/api";

const Ctx = createContext(null);

export function ConnectionProvider({ children }) {
  // Config is build-time constant now (no runtime override layer), so this is a
  // stable value rather than state that has to be refreshed.
  const cfg = getEndpoints();
  const [status, setStatus] = useState("idle"); // idle|testing|connected|failed|unconfigured
  const [detail, setDetail] = useState(null);
  const [latency, setLatency] = useState(null);
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    const c = getEndpoints();
    if (!c.aiNodeUrl || !c.aiNodeUrl.trim()) {
      setStatus("unconfigured");
      setError(null);
      setLatency(null);
      return { status: "unconfigured" };
    }
    setStatus("testing");
    setError(null);
    try {
      const r = await testConnection(c);
      setStatus("connected");
      setLatency(r.latencyMs);
      setDetail(r.detail);
      return { status: "connected", ...r };
    } catch (e) {
      setStatus("failed");
      setError(e.message);
      setLatency(null);
      return { status: "failed", error: e.message };
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const value = useMemo(
    () => ({
      cfg,
      status,
      detail,
      latency,
      error,
      check,
      analyzeConfigured: hasAnalyzeConfigured(cfg),
      maskConfigured: hasMaskConfigured(cfg),
    }),
    [cfg, status, detail, latency, error, check]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnection() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConnection must be used within ConnectionProvider");
  return c;
}
