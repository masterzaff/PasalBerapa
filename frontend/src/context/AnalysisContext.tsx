import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { useConnection } from "@/context/ConnectionContext";
import { maskPII, analyzeDocument, NotConfiguredError, CancelledError } from "@/lib/api";
import { unmaskText, remaskText } from "@/lib/pii";

export const MODE_LABELS = {
  risk: "Bedah Risiko (Red Flags)",
  summary: "Ringkas Isi",
  key_articles: "Jelaskan Pasal Terpenting",
  chat: "Pertanyaan",
};

const Ctx = createContext(null);

export function AnalysisProvider({ children }) {
  const s = useSession();
  const conn = useConnection();
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState(null);
  const pendingActionRef = useRef(null);
  // Set when a queued analysis is abandoned (PII review dismissed) so the
  // composer can hand the user their typed question back instead of losing it.
  const [restoredQuestion, setRestoredQuestion] = useState(null);
  const abortRef = useRef(null);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  // Mask a free-text question before it leaves the browser.
  //
  // Two passes, cheapest and most reliable first:
  //   1. remaskText against the mapping the document already established —
  //      exact string substitution, zero false positives, no round-trip.
  //   2. the masker, for PII the document never contained (a name typed from
  //      memory, a pasted clause). `knownMapping` keeps tag numbering
  //      continuous so it can't collide with the document's tags.
  //
  // Only the transported copy is masked; the user's own bubble keeps what they
  // actually typed.
  const maskQuestion = useCallback(
    async (question, mapping) => {
      if (!question) return { masked: question, mapping };
      const remasked = remaskText(question, mapping);
      if (!conn.maskConfigured) return { masked: remasked, mapping };
      try {
        const r = await maskPII({
          text: remasked,
          sessionId: s.sessionId,
          knownMapping: mapping,
        });
        const merged = r.mapping || mapping;
        if (r.entities?.length) s.setPiiMapping(merged);
        return { masked: r.maskedText || remasked, mapping: merged };
      } catch (_) {
        // Never block the question on the masker being down — pass 1 already
        // covered everything the document taught us about.
        return { masked: remasked, mapping };
      }
    },
    [conn.maskConfigured, s]
  );

  const ensureMasked = useCallback(async () => {
    if (s.maskedText && s.piiMapping && Object.keys(s.piiMapping).length > 0) {
      return { text: s.maskedText, mapping: s.piiMapping };
    }
    if (conn.maskConfigured) {
      try {
        // Document pass: no prior mapping, tags start fresh at _1.
        const r = await maskPII({ text: s.rawText, sessionId: s.sessionId, knownMapping: null });
        s.setMaskedText(r.maskedText);
        s.setPiiMapping(r.mapping || {});
        return { text: r.maskedText, mapping: r.mapping || {} };
      } catch (err) {
        toast.warning("Gagal scan PII otomatis, menggunakan teks dokumen.");
        return { text: s.rawText, mapping: {} };
      }
    }
    return { text: s.rawText, mapping: {} };
  }, [s, conn]);

  const executeAnalysis = useCallback(
    async ({ mode, question, customMaskedText, customMapping, regenerateMessageId }) => {
      if (!conn.analyzeConfigured) {
        toast.error("Endpoint Analisis belum dikonfigurasi di build ini.");
        throw new NotConfiguredError("Analisis");
      }
      setBusy(true);
      setBusyMode(mode);
      if (!regenerateMessageId) {
        const userContent = question || MODE_LABELS[mode] || "Analisis";
        s.addMessage({ role: "user", mode, content: userContent });
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const baseMapping = customMapping ?? s.piiMapping ?? {};
        const { masked: maskedQuestion, mapping } = await maskQuestion(question, baseMapping);
        // s.maskedText first: a conversation restored from storage has no raw
        // text (never persisted) but does have the masked document, and without
        // this the LLM would be answering follow-ups with no document at all.
        const maskedText =
          customMaskedText ?? (s.maskedText || (s.hasDocument ? remaskText(s.rawText, mapping) : ""));

        const history = s.messages
          .filter((m) => m.role && !m.error && m.id !== regenerateMessageId)
          .slice(-8)
          .map((m) => ({ role: m.role, content: remaskText(m.content, mapping) }));

        const data = await analyzeDocument({
          maskedText: maskedText || "",
          mode,
          question: maskedQuestion,
          history,
          sessionId: s.sessionId,
          signal: controller.signal,
        });

        const replyRaw = data.reply || data.summary || "Selesai.";
        const reply = unmaskText(replyRaw, mapping);
        const citations = (data.citations || []).map((c) => ({
          ...c,
          snippet: unmaskText(c.snippet || "", mapping),
        }));

        const assistantMsg = {
          role: "assistant",
          mode,
          content: reply,
          citations,
          actions: data.actions || [],
          debugMessages: data.debug?.llm_messages || [],
        };
        if (regenerateMessageId) {
          s.setMessages((prev) =>
            prev.map((m) => (m.id === regenerateMessageId ? { ...m, ...assistantMsg, ts: Date.now() } : m))
          );
        } else {
          s.addMessage(assistantMsg);
        }

        if (Array.isArray(data.risks)) {
          s.setRisks(
            data.risks.map((r, i) => ({
              id: r.id || `risk_${i}`,
              level: r.level || "warning",
              title: unmaskText(r.title || "Poin", mapping),
              explanation: unmaskText(r.explanation || "", mapping),
              suggestion: unmaskText(r.suggestion || "", mapping),
              article_refs: r.article_refs || [],
              source_excerpt: unmaskText(r.source_excerpt || "", mapping),
            }))
          );
        }

        if (typeof data.risk_score === "number") s.setRiskScore(data.risk_score);
        if (Array.isArray(data.citations)) s.setCitations(citations);

        return data;
      } catch (e) {
        // A cancel is a deliberate act, not a failure: no error bubble, no
        // toast. The user's own turn stays so they can edit or retry from it.
        if (e instanceof CancelledError) {
          toast.info("Analisis dibatalkan.");
          throw e;
        }
        if (!regenerateMessageId) {
          s.addMessage({ role: "assistant", mode, error: true, content: `Waduh, gagal: ${e.message}` });
        }
        if (!(e instanceof NotConfiguredError)) toast.error(e.message || "Analisis gagal.");
        throw e;
      } finally {
        abortRef.current = null;
        setBusy(false);
        setBusyMode(null);
      }
    },
    [s, conn, maskQuestion]
  );

  const run = useCallback(
    async ({ mode, question, regenerateMessageId }) => {
      // If there is a document and user has not yet reviewed/confirmed the PII redaction
      if (s.hasDocument && !s.piiConfirmed) {
        setBusy(true);
        setBusyMode("masking");
        try {
          await ensureMasked();
        } finally {
          setBusy(false);
          setBusyMode(null);
        }
        pendingActionRef.current = { mode, question, regenerateMessageId };
        s.setShowPiiModal(true);
        return;
      }

      return executeAnalysis({ mode, question, regenerateMessageId });
    },
    [s, ensureMasked, executeAnalysis]
  );

  const runPending = useCallback(async () => {
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pending) {
      return executeAnalysis(pending);
    }
  }, [executeAnalysis]);

  // PII review dismissed without a decision: drop the queued analysis, but give
  // a free-text question back to the composer so nothing the user typed is lost.
  const cancelPending = useCallback(() => {
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pending?.question) setRestoredQuestion({ text: pending.question, id: Date.now() });
    if (pending) toast.info("Analisis dibatalkan.");
  }, []);

  const consumeRestoredQuestion = useCallback(() => setRestoredQuestion(null), []);

  return (
    <Ctx.Provider
      value={{
        run, runPending, cancelPending, cancel, busy, busyMode, ensureMasked,
        restoredQuestion, consumeRestoredQuestion,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAnalysis() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAnalysis must be used within AnalysisProvider");
  return c;
}
