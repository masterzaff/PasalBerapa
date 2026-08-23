import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { useConnection } from "@/context/ConnectionContext";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/authApi";
import { maskPII, NotConfiguredError } from "@/lib/api";
import { encryptMapping } from "@/lib/crypto";
import { unmaskText, remaskText } from "@/lib/pii";

export const MODE_LABELS = {
  risk: "Bedah Risiko (Red Flags)",
  summary: "Ringkas Isi",
  key_articles: "Jelaskan Pasal Terpenting",
  chat: "Pertanyaan",
};

// extractInfo.pages[].text is raw/OCR'd document text — unmasked PII that must
// never reach the server. Everything else (page count, whether OCR ran) is
// just metadata, sent once (on the first message) so a resumed conversation
// still shows its "N hlm · OCR" badge.
function stripPageText(extractInfo) {
  if (!extractInfo) return null;
  const { pages, ...rest } = extractInfo;
  return {
    ...rest,
    pages: Array.isArray(pages) ? pages.map(({ text, ...p }) => p) : [],
  };
}

// Unmask an assistant reply (+ its citations) coming back from the server —
// the server only ever sees/returns masked/tagged text.
function unmaskAssistant(msg, mapping) {
  if (!msg) return msg;
  const content = msg.error ? msg.content : unmaskText(msg.content || "", mapping);
  const citations = (msg.citations || []).map((c) => ({
    ...c,
    snippet: unmaskText(c.snippet || "", mapping),
  }));
  return { ...msg, content, citations };
}

const Ctx = createContext(null);

export function AnalysisProvider({ children }) {
  const s = useSession();
  const conn = useConnection();
  const { token, encKey } = useAuth();
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState(null);
  const [busyMessageId, setBusyMessageId] = useState(null);
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
    [conn, s]
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

  // Sends a new message OR regenerates an existing assistant reply. Editing a
  // user message is handled separately by editUserMessage — the server
  // chains that reply's regeneration itself, no round-trip through here.
  const executeAnalysis = useCallback(
    async ({ mode, question, customMaskedText, customMapping, regenerateMessageId }) => {
      if (!conn.analyzeConfigured) {
        toast.error("Endpoint Analisis belum dikonfigurasi di build ini.");
        throw new NotConfiguredError("Analisis");
      }
      setBusy(true);
      setBusyMode(mode);
      setBusyMessageId(regenerateMessageId || null);

      // Optimistic local bubble for a new question — shown instantly, then
      // reconciled with the server-minted id/ts once the request resolves.
      // Regenerate has nothing new to add up front; it mutates in place.
      const tempUserId = regenerateMessageId ? null : "tmp_" + Math.random().toString(36).slice(2, 9);
      if (!regenerateMessageId) {
        const userContent = question || MODE_LABELS[mode] || "Analisis";
        s.addMessage({ id: tempUserId, role: "user", mode, content: userContent });
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const convId = s.convId || s.sessionId;
        let mapping = customMapping ?? s.piiMapping ?? {};
        let assistantOut;
        let userOut = null;
        let resultRisks, resultRiskScore, resultCitations;

        if (regenerateMessageId) {
          const res = await authApi.regenerateMessage(convId, regenerateMessageId, token, controller.signal);
          assistantOut = res.assistant_message;
          resultRisks = res.risks; resultRiskScore = res.risk_score; resultCitations = res.citations;
        } else {
          const { masked: maskedQuestion, mapping: mergedMapping } = await maskQuestion(question, mapping);
          mapping = mergedMapping;
          // s.maskedText first: a conversation restored from storage has no raw
          // text (never persisted) but does have the masked document, and without
          // this the LLM would be answering follow-ups with no document at all.
          const maskedText =
            customMaskedText ?? (s.maskedText || (s.hasDocument ? remaskText(s.rawText, mapping) : ""));
          // Only honored server-side on first creation of this conversation —
          // an anonymous session has no key, so there is never a mapping to send.
          const mappingEnc = !s.convId && encKey ? await encryptMapping(encKey, mapping || {}) : undefined;

          const res = await authApi.sendMessage(
            convId,
            {
              mode,
              question: maskedQuestion,
              masked_text: maskedText,
              doc_name: s.file?.name || null,
              doc_meta: stripPageText(s.extractInfo),
              pii_mapping_enc: mappingEnc,
            },
            token,
            controller.signal
          );
          if (!s.convId) s.setConvId(convId);
          if (typeof res.version === "number") s.setConvVersion(res.version);
          if (res.title) s.setConvTitle(res.title);
          userOut = res.user_message;
          assistantOut = res.assistant_message;
          resultRisks = res.risks; resultRiskScore = res.risk_score; resultCitations = res.citations;
        }

        const displayAssistant = unmaskAssistant(assistantOut, mapping);

        if (regenerateMessageId) {
          s.setMessages((prev) =>
            prev.map((m) => (m.id === regenerateMessageId ? { ...displayAssistant, id: m.id } : m))
          );
        } else {
          s.setMessages((prev) => {
            const withRealUser = prev.map((m) =>
              m.id === tempUserId ? { ...m, id: userOut.id, ts: userOut.ts } : m
            );
            return [...withRealUser, displayAssistant];
          });
        }

        if (Array.isArray(resultRisks)) {
          s.setRisks(
            resultRisks.map((r, i) => ({
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
        if (typeof resultRiskScore === "number") s.setRiskScore(resultRiskScore);
        if (Array.isArray(resultCitations)) {
          s.setCitations(resultCitations.map((c) => ({ ...c, snippet: unmaskText(c.snippet || "", mapping) })));
        }

        return { assistant_message: displayAssistant };
      } catch (e) {
        // A cancel is a deliberate act, not a failure: no error bubble, no
        // toast. The user's own turn stays so they can edit or retry from it.
        if (e.name === "AbortError") {
          toast.info("Analisis dibatalkan.");
        } else if (e.message && (e.message.includes("Mode tamu") || e.message.includes("Buat akun"))) {
          // Rollback optimistic user message
          if (tempUserId) {
            s.setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
          }
          toast.warning("Mode tamu dibatasi 1 pesan per percakapan. Silakan buat akun untuk melanjutkan.");
        } else {
          const errorMsg = {
            role: "assistant",
            mode,
            content: `Terjadi kendala saat menganalisis dokumen: ${e.message || "Unknown error"}. Silakan coba lagi.`,
            error: true,
          };
          if (regenerateMessageId) {
            s.setMessages((prev) =>
              prev.map((m) => (m.id === regenerateMessageId ? { ...m, ...errorMsg, ts: Date.now() } : m))
            );
          } else {
            s.setMessages((prev) => [
              ...prev.map((m) => (m.id === tempUserId ? { ...m, id: "msg_" + Math.random().toString(36).slice(2, 9) } : m)),
              { id: "msg_" + Math.random().toString(36).slice(2, 9), ts: Date.now(), ...errorMsg },
            ]);
          }
          if (!(e instanceof NotConfiguredError)) toast.error(e.message || "Analisis gagal.");
        }
        throw e;
      } finally {
        abortRef.current = null;
        setBusy(false);
        setBusyMode(null);
        setBusyMessageId(null);
      }
    },
    [s, conn, maskQuestion, token, encKey]
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

        const autoConfirm =
          typeof window !== "undefined" &&
          localStorage.getItem("pasalberapa_auto_confirm_pii") === "true";

        if (autoConfirm) {
          s.setPiiConfirmed(true);
          return executeAnalysis({ mode, question, regenerateMessageId });
        }

        pendingActionRef.current = { mode, question, regenerateMessageId };
        s.setShowPiiModal(true);
        return;
      }

      return executeAnalysis({ mode, question, regenerateMessageId });
    },
    [s, ensureMasked, executeAnalysis]
  );

  // Edit a user message. The server chains regenerating the following
  // assistant reply (if any) into the same request — no separate
  // run({regenerateMessageId}) round-trip needed from here anymore.
  const editUserMessage = useCallback(
    async ({ messageId, newContent }) => {
      const trimmed = (newContent || "").trim();
      if (!trimmed) return;

      const idx = s.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const targetUserMsg = s.messages[idx];
      if (targetUserMsg.content === trimmed) return;

      const nextMsg = s.messages[idx + 1];
      const hasFollowingAssistant = nextMsg && nextMsg.role === "assistant";

      setBusy(true);
      setBusyMode(targetUserMsg.mode || "chat");
      setBusyMessageId(hasFollowingAssistant ? nextMsg.id : null);

      try {
        const convId = s.convId || s.sessionId;
        const mapping = s.piiMapping || {};
        const { masked: maskedContent, mapping: mergedMapping } = await maskQuestion(trimmed, mapping);

        const res = await authApi.editMessage(convId, messageId, { content: maskedContent }, token);

        const displayUser = { ...res.user_message, content: trimmed };
        const displayAssistant = res.assistant_message ? unmaskAssistant(res.assistant_message, mergedMapping) : null;

        s.setMessages((prev) => {
          const next = prev.map((m) => (m.id === messageId ? displayUser : m));
          if (!displayAssistant) return next;
          const followIdx = next.findIndex((m) => m.id === messageId) + 1;
          const following = next[followIdx];
          if (following && following.role === "assistant") {
            next[followIdx] = { ...displayAssistant, id: following.id };
            return [...next];
          }
          // No prior assistant reply existed — insert the new one right after.
          return [...next.slice(0, followIdx), displayAssistant, ...next.slice(followIdx)];
        });

        if (typeof res.version === "number") s.setConvVersion(res.version);
        if (Array.isArray(res.risks)) {
          s.setRisks(
            res.risks.map((r, i) => ({
              id: r.id || `risk_${i}`,
              level: r.level || "warning",
              title: unmaskText(r.title || "Poin", mergedMapping),
              explanation: unmaskText(r.explanation || "", mergedMapping),
              suggestion: unmaskText(r.suggestion || "", mergedMapping),
              article_refs: r.article_refs || [],
              source_excerpt: unmaskText(r.source_excerpt || "", mergedMapping),
            }))
          );
        }
        if (typeof res.risk_score === "number") s.setRiskScore(res.risk_score);
        if (Array.isArray(res.citations)) {
          s.setCitations(res.citations.map((c) => ({ ...c, snippet: unmaskText(c.snippet || "", mergedMapping) })));
        }
      } catch (e) {
        toast.error(e.message || "Gagal mengedit pesan.");
      } finally {
        setBusy(false);
        setBusyMode(null);
        setBusyMessageId(null);
      }
    },
    [s, maskQuestion, token]
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
        run, runPending, cancelPending, cancel, busy, busyMode, busyMessageId, ensureMasked,
        restoredQuestion, consumeRestoredQuestion, editUserMessage,
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
