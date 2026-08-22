import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

// All session state lives in memory only (privacy-first / stateless).
// Refresh = everything gone. Nothing here is persisted.

const SessionContext = createContext(null);

const newSessionId = () =>
  "sess_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(newSessionId);

  // Document / extraction
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState("");
  const [extractInfo, setExtractInfo] = useState(null); // {totalPages, usedOcr, pages}

  // PII masking (from user endpoint)
  const [maskedText, setMaskedText] = useState("");
  const [piiMapping, setPiiMapping] = useState({}); // {"<PERSON_1>":"Andi"}
  const [piiEntities, setPiiEntities] = useState([]);

  // Analysis
  const [messages, setMessages] = useState([]); // {id, role, mode, content, ts}
  const [risks, setRisks] = useState([]);
  const [riskScore, setRiskScore] = useState(null);
  const [citations, setCitations] = useState([]);

  // UI
  const [highlightExcerpt, setHighlightExcerpt] = useState(null);

  const resetSession = useCallback(() => {
    setSessionId(newSessionId());
    setFile(null);
    setRawText("");
    setExtractInfo(null);
    setMaskedText("");
    setPiiMapping({});
    setPiiEntities([]);
    setMessages([]);
    setRisks([]);
    setRiskScore(null);
    setCitations([]);
    setHighlightExcerpt(null);
  }, []);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [
      ...prev,
      { id: "msg_" + Math.random().toString(36).slice(2, 9), ts: Date.now(), ...msg },
    ]);
  }, []);

  const hasDocument = Boolean(rawText && rawText.trim());
  const isMasked = Boolean(maskedText && Object.keys(piiMapping).length >= 0 && maskedText.trim());

  const value = useMemo(
    () => ({
      sessionId,
      file, setFile,
      rawText, setRawText,
      extractInfo, setExtractInfo,
      maskedText, setMaskedText,
      piiMapping, setPiiMapping,
      piiEntities, setPiiEntities,
      messages, setMessages, addMessage,
      risks, setRisks,
      riskScore, setRiskScore,
      citations, setCitations,
      highlightExcerpt, setHighlightExcerpt,
      resetSession,
      hasDocument,
      isMasked,
    }),
    [
      sessionId, file, rawText, extractInfo, maskedText, piiMapping, piiEntities,
      messages, risks, riskScore, citations, highlightExcerpt, addMessage,
      resetSession, hasDocument, isMasked,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
