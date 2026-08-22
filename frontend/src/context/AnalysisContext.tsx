import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { useConnection } from "@/context/ConnectionContext";
import { maskPII, analyzeDocument, NotConfiguredError } from "@/lib/api";
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

  const ensureMasked = useCallback(async () => {
    if (s.maskedText && s.piiMapping && Object.keys(s.piiMapping).length > 0) {
      return { text: s.maskedText, mapping: s.piiMapping };
    }
    if (conn.maskConfigured) {
      try {
        const r = await maskPII({ text: s.rawText, sessionId: s.sessionId });
        s.setMaskedText(r.maskedText);
        s.setPiiMapping(r.mapping || {});
        s.setPiiEntities(r.entities || []);
        return { text: r.maskedText, mapping: r.mapping || {} };
      } catch (err) {
        toast.warning("Gagal scan PII otomatis, menggunakan teks dokumen.");
        return { text: s.rawText, mapping: {} };
      }
    }
    return { text: s.rawText, mapping: {} };
  }, [s, conn]);

  const executeAnalysis = useCallback(
    async ({ mode, question, customMaskedText, customMapping }) => {
      if (!conn.analyzeConfigured) {
        toast.error("Endpoint Analisis belum diatur. Buka Settings dulu ya.");
        throw new NotConfiguredError("Analisis");
      }
      setBusy(true);
      setBusyMode(mode);
      const userContent = question || MODE_LABELS[mode] || "Analisis";
      s.addMessage({ role: "user", mode, content: userContent });

      try {
        const mapping = customMapping ?? s.piiMapping ?? {};
        const maskedText = customMaskedText ?? (s.hasDocument ? (s.maskedText || remaskText(s.rawText, mapping)) : "");

        const history = s.messages
          .filter((m) => m.role && !m.error)
          .slice(-8)
          .map((m) => ({ role: m.role, content: remaskText(m.content, mapping) }));

        const data = await analyzeDocument({
          maskedText: maskedText || "",
          mode,
          question,
          history,
          sessionId: s.sessionId,
        });

        const replyRaw = data.reply || data.summary || "Selesai.";
        const reply = unmaskText(replyRaw, mapping);
        const citations = (data.citations || []).map((c) => ({
          ...c,
          snippet: unmaskText(c.snippet || "", mapping),
        }));

        s.addMessage({
          role: "assistant",
          mode,
          content: reply,
          citations,
          actions: data.actions || [],
          debugMessages: data.debug?.llm_messages || [],
        });

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
        s.addMessage({ role: "assistant", mode, error: true, content: `Waduh, gagal: ${e.message}` });
        if (!(e instanceof NotConfiguredError)) toast.error(e.message || "Analisis gagal.");
        throw e;
      } finally {
        setBusy(false);
        setBusyMode(null);
      }
    },
    [s, conn]
  );

  const run = useCallback(
    async ({ mode, question }) => {
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
        pendingActionRef.current = { mode, question };
        s.setShowPiiModal(true);
        return;
      }

      return executeAnalysis({ mode, question });
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

  return (
    <Ctx.Provider value={{ run, runPending, busy, busyMode, ensureMasked }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAnalysis() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAnalysis must be used within AnalysisProvider");
  return c;
}
