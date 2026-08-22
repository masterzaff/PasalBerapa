import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const Ctx = createContext(null);
const LS_MODE_KEY = "pasalberapa.audience_mode";

// "audienceMode" (bisnis/personal) is purely cosmetic homepage copy — it never
// reaches the backend and is unrelated to the analysis "mode" (chat/risk/
// summary/key_articles) used everywhere else. Kept under its own name here on
// purpose so the two concepts don't get confused/shadowed at call sites.
export function UIProvider({ children }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("doc"); // doc | risk | vault
  const [audienceMode, setAudienceModeState] = useState("bisnis");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_MODE_KEY);
      if (stored) setAudienceModeState(stored);
    } catch (_) {}
  }, []);

  const setAudienceMode = useCallback((next) => {
    setAudienceModeState(next);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LS_MODE_KEY, next);
      }
    } catch (_) {}
  }, []);

  const openPanel = useCallback((tab) => {
    if (tab) setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  const value = { panelOpen, setPanelOpen, panelTab, setPanelTab, openPanel, audienceMode, setAudienceMode };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUI must be used within UIProvider");
  return c;
}

