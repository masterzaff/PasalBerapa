import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Session state is kept in memory AND mirrored to sessionStorage so a page
// refresh doesn't wipe the current chat/analysis. sessionStorage (bukan
// localStorage) dipilih supaya tetap privacy-first: data cuma hidup selama tab
// terbuka, dan otomatis hilang saat tab ditutup. Tidak ada yang dikirim keluar.

const SessionContext = createContext(null);

const SS_KEY = "pasalberapa.session.v1";

// This id is now the conversation's database primary key (the client mints it
// so /chat/:id is stable from the first message and there is no separate
// convId), so it needs real uniqueness — Math.random is not good enough for a PK.
const newSessionId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return "sess_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

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
  const [piiConfirmed, setPiiConfirmed] = useState(false);
  const [showPiiModal, setShowPiiModal] = useState(false);

  // Analysis
  const [messages, setMessages] = useState([]); // {id, role, mode, content, ts}
  const [risks, setRisks] = useState([]);
  const [riskScore, setRiskScore] = useState(null);
  const [citations, setCitations] = useState([]);

  // Link ke percakapan tersimpan di DB (biar autosave meng-UPDATE, bukan bikin
  // duplikat setelah refresh). null = sesi baru yang belum pernah disimpan.
  const [convId, setConvId] = useState(null);
  const [convTitle, setConvTitle] = useState(null);
  // Server version last seen, for optimistic concurrency on autosave.
  const [convVersion, setConvVersion] = useState(0);

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
      if (snap.piiConfirmed) setPiiConfirmed(true);
      if (snap.messages) setMessages(snap.messages);
      if (snap.risks) setRisks(snap.risks);
      if (snap.riskScore !== undefined) setRiskScore(snap.riskScore);
      if (snap.citations) setCitations(snap.citations);
      if (snap.convId) setConvId(snap.convId);
      if (snap.convTitle) setConvTitle(snap.convTitle);
      if (typeof snap.convVersion === "number") setConvVersion(snap.convVersion);
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
          piiConfirmed,
          messages,
          risks,
          riskScore,
          citations,
          convId,
          convTitle,
          convVersion,
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
    sessionId, file, rawText, extractInfo, maskedText, piiMapping,
    piiConfirmed, messages, risks, riskScore, citations, convId, convTitle, convVersion,
  ]);

  // Everything derived from the currently attached document. Swapping or
  // removing a document MUST clear all of it — otherwise the masked text,
  // mapping and "PII already reviewed" flag of the *previous* document leak
  // into the next analysis (wrong document sent to the LLM, review skipped).
  const resetDocument = useCallback(() => {
    setFile(null);
    setRawText("");
    setExtractInfo(null);
    setMaskedText("");
    setPiiMapping({});
    setPiiConfirmed(false);
    setShowPiiModal(false);
    setRisks([]);
    setRiskScore(null);
    setCitations([]);
    setHighlightExcerpt(null);
  }, []);

  const resetSession = useCallback(() => {
    try { sessionStorage.removeItem(SS_KEY); } catch (_) {}
    persistRef.current = false;
    setSessionId(newSessionId());
    resetDocument();
    setMessages([]);
    setConvId(null);
    setConvTitle(null);
    setConvVersion(0);
  }, [resetDocument]);

  // Load a saved conversation (from history/DB) into the active session.
  // Keeps the given id so the URL /chat/:id stays stable across refresh.
  const loadConversation = useCallback(({ id, messages: msgs, docName, title, piiMapping, maskedText, version } = {}) => {
    setSessionId(id || newSessionId());
    resetDocument();
    // The RAW document is never persisted (it is the unmasked original), but the
    // masked copy is — that is what gives a resumed conversation its document
    // context back, so follow-up questions aren't answered against nothing.
    setFile(docName ? { name: docName } : null);
    setMaskedText(maskedText || "");
    setPiiMapping(piiMapping && typeof piiMapping === "object" ? piiMapping : {});
    // The mapping was already reviewed when this conversation was created, and
    // there is no raw text left to review — don't re-prompt on an empty doc.
    setPiiConfirmed(true);
    setMessages(Array.isArray(msgs) ? msgs : []);
    setConvId(id || null);
    setConvTitle(title || null);
    setConvVersion(typeof version === "number" ? version : 0);
  }, [resetDocument]);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [
      ...prev,
      { id: "msg_" + Math.random().toString(36).slice(2, 9), ts: Date.now(), ...msg },
    ]);
  }, []);

  const hasDocument = Boolean(rawText && rawText.trim());

  const value = useMemo(
    () => ({
      sessionId, setSessionId,
      file, setFile,
      rawText, setRawText,
      extractInfo, setExtractInfo,
      maskedText, setMaskedText,
      piiMapping, setPiiMapping,
      piiConfirmed, setPiiConfirmed,
      showPiiModal, setShowPiiModal,
      messages, setMessages, addMessage,
      risks, setRisks,
      riskScore, setRiskScore,
      citations, setCitations,
      convId, setConvId,
      convTitle, setConvTitle,
      convVersion, setConvVersion,
      highlightExcerpt, setHighlightExcerpt,
      resetSession,
      resetDocument,
      loadConversation,
      hasDocument,
    }),
    [
      sessionId, file, rawText, extractInfo, maskedText, piiMapping,
      piiConfirmed, showPiiModal,
      messages, risks, riskScore, citations, convId, convTitle, convVersion, highlightExcerpt, addMessage,
      resetSession, resetDocument, loadConversation, hasDocument,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
