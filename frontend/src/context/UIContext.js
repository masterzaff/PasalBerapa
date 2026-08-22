import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const Ctx = createContext(null);
const LS_MODE_KEY = "pasalberapa.audience_mode";

export function UIProvider({ children }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("doc"); // doc | risk | vault
  const [mode, setModeState] = useState("bisnis");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_MODE_KEY);
      if (stored) setModeState(stored);
    } catch (_) {}
  }, []);

  const setMode = useCallback((newMode) => {
    setModeState(newMode);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LS_MODE_KEY, newMode);
      }
    } catch (_) {}
  }, []);

  const openPanel = useCallback((tab) => {
    if (tab) setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  const value = { panelOpen, setPanelOpen, panelTab, setPanelTab, openPanel, mode, setMode };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUI must be used within UIProvider");
  return c;
}

