import React, { createContext, useCallback, useContext, useState } from "react";

const Ctx = createContext(null);
const LS_MODE_KEY = "pasalberapa.audience_mode";

export function UIProvider({ children }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("doc"); // doc | risk | vault
  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem(LS_MODE_KEY) || "bisnis";
    } catch (_) {
      return "bisnis";
    }
  });

  const setMode = useCallback((newMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(LS_MODE_KEY, newMode);
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

