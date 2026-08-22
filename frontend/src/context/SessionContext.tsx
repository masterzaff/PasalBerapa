import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Session state is kept in memory AND mirrored to sessionStorage so a page
// refresh doesn't wipe the current chat/analysis. sessionStorage (bukan
// localStorage) dipilih supaya tetap privacy-first: data cuma hidup selama tab
// terbuka, dan otomatis hilang saat tab ditutup. Tidak ada yang dikirim keluar.

const SessionContext = createContext(null);

const SS_KEY = "pasalberapa.session.v1";

const newSessionId = () =>
  "sess_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function loadSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (snap && typeof snap === "object") return snap;
  } catch (_) {}
  return null;
}

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState("");

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

  // Link ke percakapan tersimpan di DB (biar autosave meng-UPDATE, bukan bikin
  // duplikat setelah refresh). null = sesi baru yang belum pernah disimpan.
  const [convId, setConvId] = useState(null);
  const [convTitle, setConvTitle] = useState(null);

  // UI (not persisted)
  const [highlightExcerpt, setHighlightExcerpt] = useState(null);

  // Hydrate from sessionStorage once mounted on client
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    const snap = loadSnapshot();
    if (snap) {
      if (snap.sessionId) setSessionId(snap.sessionId);
      if (snap.file) setFile(snap.file);
      if (snap.rawText) setRawText(snap.rawText);
      if (snap.extractInfo) setExtractInfo(snap.extractInfo);
      if (snap.maskedText) setMaskedText(snap.maskedText);
      if (snap.piiMapping) setPiiMapping(snap.piiMapping);
      if (snap.piiEntities) setPiiEntities(snap.piiEntities);
      if (snap.messages) setMessages(snap.messages);
      if (snap.risks) setRisks(snap.risks);
      if (snap.riskScore !== undefined) setRiskScore(snap.riskScore);
      if (snap.citations) setCitations(snap.citations);
      if (snap.convId) setConvId(snap.convId);
      if (snap.convTitle) setConvTitle(snap.convTitle);
    } else {
      setSessionId(newSessionId());
    }
    setInitialized(true);
  }, []);

  // --- Persist snapshot on any meaningful change ---
  const persistRef = useRef(false);
  useEffect(() => {
    if (!initialized) return;
    const hasContent = messages.length > 0 || (rawText && rawText.trim());
    try {
      if (hasContent) {
        const payload = {
          sessionId,
          file,
          rawText,
          extractInfo,
          maskedText,
          piiMapping,
          piiEntities,
          messages,
          risks,
          riskScore,
          citations,
          convId,
          convTitle,
        };
        sessionStorage.setItem(SS_KEY, JSON.stringify(payload));
        persistRef.current = true;
      } else if (persistRef.current) {
        // session emptied (reset) -> clear storage
        sessionStorage.removeItem(SS_KEY);
        persistRef.current = false;
      }
    } catch (_) {}
  }, [
    sessionId, file, rawText, extractInfo, maskedText, piiMapping, piiEntities,
    messages, risks, riskScore, citations, convId, convTitle,
  ]);

  const resetSession = useCallback(() => {
    try { sessionStorage.removeItem(SS_KEY); } catch (_) {}
    persistRef.current = false;
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
    setConvId(null);
    setConvTitle(null);
    setHighlightExcerpt(null);
  }, []);

  // Load a saved conversation (from history/DB) into the active session.
  // Keeps the given id so the URL /chat/:id stays stable across refresh.
  const loadConversation = useCallback(({ id, messages: msgs, docName, title } = {}) => {
    setSessionId(id || newSessionId());
    setFile(docName ? { name: docName } : null);
    setRawText("");
    setExtractInfo(null);
    setMaskedText("");
    setPiiMapping({});
    setPiiEntities([]);
    setMessages(Array.isArray(msgs) ? msgs : []);
    setRisks([]);
    setRiskScore(null);
    setCitations([]);
    setConvId(id || null);
    setConvTitle(title || null);
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
      sessionId, setSessionId,
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
      convId, setConvId,
      convTitle, setConvTitle,
      highlightExcerpt, setHighlightExcerpt,
      resetSession,
      loadConversation,
      hasDocument,
      isMasked,
    }),
    [
      sessionId, file, rawText, extractInfo, maskedText, piiMapping, piiEntities,
      messages, risks, riskScore, citations, convId, convTitle, highlightExcerpt, addMessage,
      resetSession, loadConversation, hasDocument, isMasked,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
