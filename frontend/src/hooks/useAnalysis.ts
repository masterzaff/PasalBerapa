import { useCallback, useState } from "react";
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

export function useAnalysis() {
  const s = useSession();
  const conn = useConnection();
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState(null);

  const ensureMasked = useCallback(async () => {
    if (s.maskedText) return { text: s.maskedText, mapping: s.piiMapping };
    if (conn.maskConfigured) {
      const r = await maskPII({ text: s.rawText, sessionId: s.sessionId });
      s.setMaskedText(r.maskedText);
      s.setPiiMapping(r.mapping);
      s.setPiiEntities(r.entities);
      const n = Object.keys(r.mapping || {}).length;
      toast.success(`Data sensitif diamankan (${n} item dimasking).`);
      return { text: r.maskedText, mapping: r.mapping };
    }
    return { text: s.rawText, mapping: {} };
  }, [s, conn]);

  const run = useCallback(
    async ({ mode, question }) => {
      if (!conn.analyzeConfigured) {
        toast.error("Endpoint Analisis belum diatur. Buka Settings dulu ya.");
        throw new NotConfiguredError("Analisis");
      }
      setBusy(true);
      setBusyMode(mode);
      const userContent = question || MODE_LABELS[mode] || "Analisis";
      s.addMessage({ role: "user", mode, content: userContent });
      try {
        const masked = await ensureMasked();
        if (!conn.maskConfigured) {
          toast.warning("Endpoint PII belum diatur — teks dikirim tanpa masking.");
        }
        const mapping = masked.mapping && Object.keys(masked.mapping).length ? masked.mapping : s.piiMapping;
        const history = s.messages
          .filter((m) => m.role && !m.error)
          .slice(-8)
          .map((m) => ({ role: m.role, content: remaskText(m.content, mapping) }));
        const data = await analyzeDocument({
          maskedText: masked.text,
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
        s.addMessage({ role: "assistant", mode, content: reply, citations });
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
    [s, conn, ensureMasked]
  );

  return { run, busy, busyMode };
}
