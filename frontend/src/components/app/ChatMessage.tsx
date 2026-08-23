import React, { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Bot, User, BookMarked, Copy, Check, Scale, ShieldAlert, Wrench, ChevronDown, RotateCw, Eye, Pencil, ThumbsUp, ThumbsDown, Flag } from "lucide-react";
import { MODE_LABELS, useAnalysis } from "@/context/AnalysisContext";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/authApi";
import { toast } from "sonner";
import OriginalMessageModal from "@/components/app/OriginalMessageModal";
import ReportMessageModal from "@/components/app/ReportMessageModal";

// Komponen markdown minimal — cukup buat gaya balasan LLM (bold, list, paragraf, link).
const MARKDOWN_COMPONENTS = {
  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
  em: ({ node, ...props }) => <em {...props} />,
  ul: ({ node, ...props }) => <ul className="mb-2 last:mb-0 list-disc pl-5 space-y-0.5" {...props} />,
  ol: ({ node, ...props }) => <ol className="mb-2 last:mb-0 list-decimal pl-5 space-y-0.5" {...props} />,
  li: ({ node, ...props }) => <li {...props} />,
  a: ({ node, ...props }) => (
    <a className="text-primary underline underline-offset-2 hover:no-underline" target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ node, ...props }) => <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...props} />,
};

export function TypingBubble() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-2xl border bg-muted/40 px-4 py-3 shadow-xs">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-primary"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function Message({ m }) {
  const isUser = m.role === "user";
  const [copied, setCopied] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [originalOpen, setOriginalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(m.content || "");
  const s = useSession();
  const { token } = useAuth();
  const { run, editUserMessage, busy: analyzing, busyMessageId } = useAnalysis();
  const isThisMessageBusy = m.role === "assistant" && busyMessageId === m.id;
  const currentFeedback = s.feedback?.[m.id];

  // Nearest preceding USER turn — messages[i-1] is not necessarily one (an
  // errored reply, or a mode reply, can sit directly above this message).
  const msgIndex = s.messages.findIndex((msg) => msg.id === m.id);
  const prevUserMsg =
    msgIndex > 0
      ? [...s.messages.slice(0, msgIndex)].reverse().find((msg) => msg.role === "user") || null
      : null;

  const handleRegenerate = async () => {
    if (!prevUserMsg || regenerating || analyzing) return;
    setRegenerating(true);
    try {
      await run({
        mode: m.mode,
        question: m.mode === "chat" ? prevUserMsg.content : undefined,
        regenerateMessageId: m.id,
      });
    } catch (e) {
      // run() sudah menampilkan toast error sendiri
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    const trimmed = (editContent || "").trim();
    if (!trimmed) {
      toast.warning("Pesan tidak boleh kosong.");
      return;
    }
    if (trimmed === m.content) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    try {
      await editUserMessage({ messageId: m.id, newContent: trimmed });
    } catch (e) {
      // handled by run()
    }
  };

  const handleCopy = async () => {
    if (!m.content) return;
    await navigator.clipboard.writeText(m.content);
    setCopied(true);
    toast.success("Pesan disalin ke clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleThumb = async (type) => {
    if (feedbackBusy) return;
    setFeedbackBusy(true);
    try {
      if (currentFeedback === type) {
        await authApi.clearMessageFeedback(m.id, token);
        s.setFeedback((prev) => {
          const next = { ...prev };
          delete next[m.id];
          return next;
        });
      } else {
        await authApi.setMessageFeedback(m.id, { type, conversation_id: s.convId || null }, token);
        s.setFeedback((prev) => ({ ...prev, [m.id]: type }));
      }
    } catch (e) {
      toast.error(e.message || "Gagal mengirim masukan.");
    } finally {
      setFeedbackBusy(false);
    }
  };

  const handleReportSubmit = async ({ reason, censoredExcerpt }) => {
    try {
      await authApi.setMessageFeedback(
        m.id,
        { type: "report", conversation_id: s.convId || null, report_reason: reason || null, censored_excerpt: censoredExcerpt },
        token
      );
      s.setFeedback((prev) => ({ ...prev, [m.id]: "report" }));
      toast.success("Laporan terkirim. Terima kasih.");
    } catch (e) {
      toast.error(e.message || "Gagal mengirim laporan.");
      throw e;
    }
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        className="flex w-full justify-end"
      >
        {isEditing ? (
          <div className="w-full max-w-[85%] sm:max-w-[70%] space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditContent(m.content);
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                }
              }}
              className="w-full min-h-[75px] bg-background text-foreground border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none shadow-xs"
              autoFocus
              placeholder="Edit pesan..."
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(m.content);
                }}
                className="px-3 py-1 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={analyzing}
                className="px-3 py-1 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Simpan &amp; Kirim
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1 max-w-[82%] group">
            <div className="rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm w-full">
              <div className="whitespace-pre-wrap select-text">{m.content}</div>
            </div>
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
                title="Salin pesan"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Tersalin" : "Salin"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditContent(m.content);
                  setIsEditing(true);
                }}
                disabled={analyzing}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                title="Edit pesan"
              >
                <Pencil className="h-3 w-3" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex w-full items-start gap-3 group"
    >
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs mt-0.5">
        <Scale className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">PasalBerapa?</span>
          {m.mode && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {MODE_LABELS[m.mode] || m.mode}
            </span>
          )}
        </div>

        <div
          className={`rounded-2xl rounded-tl-xs px-4 py-3 text-sm leading-relaxed ${
            m.error && !isThisMessageBusy
              ? "border border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300 font-medium"
              : "border bg-card/60 backdrop-blur text-foreground shadow-xs"
          }`}
        >
          {isThisMessageBusy ? (
            <div className="py-0.5">
              <TypingBubble />
            </div>
          ) : (
            <>
              <div className="select-text text-sm leading-6">
                <ReactMarkdown components={MARKDOWN_COMPONENTS}>{m.content}</ReactMarkdown>
              </div>

              {/* Citations / Legal references */}
              {Array.isArray(m.citations) && m.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setCitationsOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <BookMarked className="h-3.5 w-3.5 text-primary" />
                    <span>{m.citations.length} rujukan pasal &amp; regulasi</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${citationsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {citationsOpen && (
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {m.citations.map((c, i) => (
                        <a
                          key={i}
                          href={c.url || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex flex-col rounded-lg border bg-background/80 p-2 text-left text-xs transition-colors hover:border-primary hover:bg-accent/40"
                        >
                          <span className="font-semibold text-primary">
                            {c.regulation} {c.article}
                          </span>
                          {c.snippet && (
                            <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                              {c.snippet}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions breakdown (tools the agent called this request) */}
              {Array.isArray(m.actions) && m.actions.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setActionsOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Wrench className="h-3.5 w-3.5 text-primary" />
                    <span>{m.actions.length} aksi dilakukan</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {actionsOpen && (
                    <ol className="mt-2 space-y-1 pl-0.5">
                      {m.actions.map((a, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                          <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                          <span>{a.label}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons (Copy, Debug, Regenerate). Always visible on
            touch/narrow screens — hover-only controls are unreachable there —
            and focus-within keeps them usable from the keyboard.
            An errored reply keeps Regenerate: it is the one message where
            retrying matters most, and it used to be the one that hid it. */}
        {!isThisMessageBusy && (
          <div
            className={`flex items-center gap-1 transition-opacity focus-within:opacity-100 ${
              m.error ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            }`}
          >
            {!m.error && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
                  title="Salin jawaban"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Tersalin" : "Salin"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOriginalOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
                  title="Lihat pesan asli yang dikirim/diterima"
                >
                  <Eye className="h-3 w-3" />
                  <span>Pesan Asli</span>
                </button>
                <span className="w-px h-3.5 bg-border mx-0.5" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => handleThumb("up")}
                  disabled={feedbackBusy}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md transition-colors disabled:opacity-50 ${
                    currentFeedback === "up"
                      ? "text-[hsl(var(--risk-safe))] bg-[hsl(var(--risk-safe))]/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title="Jawaban ini membantu"
                >
                  <ThumbsUp className={`h-3 w-3 ${currentFeedback === "up" ? "fill-current" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleThumb("down")}
                  disabled={feedbackBusy}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md transition-colors disabled:opacity-50 ${
                    currentFeedback === "down"
                      ? "text-destructive bg-destructive/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title="Jawaban ini kurang membantu"
                >
                  <ThumbsDown className={`h-3 w-3 ${currentFeedback === "down" ? "fill-current" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  disabled={feedbackBusy}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md transition-colors disabled:opacity-50 ${
                    currentFeedback === "report"
                      ? "text-destructive bg-destructive/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title="Laporkan pesan ini"
                >
                  <Flag className={`h-3 w-3 ${currentFeedback === "report" ? "fill-current" : ""}`} />
                </button>
              </>
            )}
            {prevUserMsg && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating || analyzing}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Buat ulang jawaban ini"
              >
                <RotateCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                <span>{m.error ? "Coba lagi" : "Regenerate"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <OriginalMessageModal
        open={originalOpen}
        onOpenChange={setOriginalOpen}
        sentMasked={m.sentMasked}
        receivedRaw={m.receivedRaw}
      />
      <ReportMessageModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSubmit={handleReportSubmit}
        sensitiveMapping={s.piiMapping}
        title="Laporkan pesan ini"
        description="Ceritakan apa yang salah dengan jawaban ini. Laporan membantu kami memperbaiki kualitas AI."
      />
    </motion.div>
  );
}
