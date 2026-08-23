import React, { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Bot, User, BookMarked, Copy, Check, Scale, ShieldAlert, Wrench, ChevronDown, Bug, RotateCw } from "lucide-react";
import { MODE_LABELS, useAnalysis } from "@/context/AnalysisContext";
import { useSession } from "@/context/SessionContext";
import { toast } from "sonner";
import DebugRequestModal from "@/components/app/DebugRequestModal";

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
  const [debugOpen, setDebugOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const s = useSession();
  const { run, busy: analyzing } = useAnalysis();

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

  const handleCopy = async () => {
    if (!m.content) return;
    await navigator.clipboard.writeText(m.content);
    setCopied(true);
    toast.success("Pesan disalin ke clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        className="flex w-full justify-end"
      >
        <div className="max-w-[82%] rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
          <div className="whitespace-pre-wrap select-text">{m.content}</div>
        </div>
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
            m.error
              ? "border border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300 font-medium"
              : "border bg-card/60 backdrop-blur text-foreground shadow-xs"
          }`}
        >
          <div className="select-text text-sm leading-6">
            <ReactMarkdown components={MARKDOWN_COMPONENTS}>{m.content}</ReactMarkdown>
          </div>

          {/* Citations / Legal references */}
          {Array.isArray(m.citations) && m.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <BookMarked className="h-3.5 w-3.5 text-primary" />
                <span>Rujukan Pasal &amp; Regulasi:</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
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
        </div>

        {/* Action buttons (Copy, Debug, Regenerate). Always visible on
            touch/narrow screens — hover-only controls are unreachable there —
            and focus-within keeps them usable from the keyboard. */}
        {!m.error && (
          <div className="flex items-center gap-1 opacity-100 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
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
              onClick={() => setDebugOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
              title="Lihat request ke LLM"
            >
              <Bug className="h-3 w-3" />
              <span>Debug</span>
            </button>
            {prevUserMsg && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating || analyzing}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Buat ulang jawaban ini"
              >
                <RotateCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>

      <DebugRequestModal open={debugOpen} onOpenChange={setDebugOpen} messages={m.debugMessages || []} />
    </motion.div>
  );
}
