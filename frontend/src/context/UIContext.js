import React, { createContext, useCallback, useContext, useState } from "react";

const Ctx = createContext(null);

export function UIProvider({ children }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("doc"); // doc | risk | vault

  const openPanel = useCallback((tab) => {
    if (tab) setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  const value = { panelOpen, setPanelOpen, panelTab, setPanelTab, openPanel };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUI must be used within UIProvider");
  return c;
}
