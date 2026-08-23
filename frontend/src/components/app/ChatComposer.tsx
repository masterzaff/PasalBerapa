import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, X, Loader2, ShieldAlert, FileText, Sparkles, FileCheck2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { useAuth } from "@/context/AuthContext";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { useUI } from "@/context/UIContext";

const QUICK = [
  { mode: "risk", label: "Bedah Risiko", icon: ShieldAlert },
  { mode: "summary", label: "Ringkas Isi", icon: FileText },
  { mode: "key_articles", label: "Jelaskan Pasal Penting", icon: Sparkles },
];

const PERSONAL_PROMPTS = [
  "Klausul mana yang paling ngerugiin aku?",
  "Ini kontrak kerja apa kemitraan sih?",
  "Denda telat bayarnya wajar nggak?",
  "Jelasin Pasal 1266 KUHPerdata dong",
];

const BUSINESS_PROMPTS = [
  "Apakah ada klausul penalti sepihak yang merugikan?",
  "Audit klausul PKWT ini sesuai UU Cipta Kerja",
  "Bagaimana batasan liabilitas (liability cap) di kontrak ini?",
  "Siapa pemegang hak kekayaan intelektual (IP)?",
  "Cek kepatuhan klausul kerahasiaan & UU PDP",
];

export default function ChatComposer({ variant = "docked", seed, onOpenAuth, autoFocus = false }) {
  const s = useSession();
  // `cancel` below is the PDF-extraction cancel; this one stops the LLM run.
  const { run, cancel: cancelAnalysis, busy: analyzing, restoredQuestion, consumeRestoredQuestion } = useAnalysis();
  const { user } = useAuth();
  const { uploadFile, progress, busy: extracting, cancel } = useDocumentUpload();
  const { audienceMode } = useUI();
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const disabled = analyzing || extracting;
  const hero = variant === "hero";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Audience mode is cosmetic homepage copy only — the docked composer inside
  // an actual chat session always uses the neutral/personal copy, since the
  // toggle that sets it isn't even visible there (see TopBar.tsx).
  const isBisnis = hero && audienceMode === "bisnis";
  const activePrompts = isBisnis ? BUSINESS_PROMPTS : PERSONAL_PROMPTS;

  const BASE_PH = s.hasDocument
    ? (isBisnis ? "Tanya risiko, denda, atau rujukan pasal dokumen ini…" : "Tanya apa aja soal dokumen ini…")
    : (isBisnis ? "Tanya risiko hukum bisnis, audit PKWT, atau regulasi…" : "Tanya apa aja soal hukum, kontrak, atau hak kamu…");

  const [phIdx, setPhIdx] = useState(-1);
  useEffect(() => {
    if (input) { setPhIdx(-1); return; }
    const id = setInterval(
      () => setPhIdx((p) => (p >= activePrompts.length - 1 ? -1 : p + 1)),
      2800
    );
    return () => clearInterval(id);
  }, [input, activePrompts.length]);
  // Clamp: the two prompt lists differ in length, so a stale index can point
  // past the end after an audience switch and blank the placeholder entirely.
  const placeholder = phIdx < 0 ? BASE_PH : activePrompts[phIdx] || BASE_PH;

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  useEffect(() => {
    if (!autoFocus) return;
    // Auto-focus input on mount only when enabled (e.g. on chat page)
    const timer = setTimeout(() => {
      if (taRef.current) {
        taRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    if (seed && seed.text) {
      setInput(seed.text);
      if (taRef.current) taRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed && seed.id]);

  // A question that was queued behind the PII review and then abandoned comes
  // back here instead of vanishing. Only the composer actually on screen takes
  // it — hero and docked are never mounted at the same time.
  useEffect(() => {
    if (!restoredQuestion) return;
    setInput((cur) => (cur.trim() ? cur : restoredQuestion.text));
    consumeRestoredQuestion();
    if (taRef.current) taRef.current.focus();
  }, [restoredQuestion, consumeRestoredQuestion]);

  const pickFile = () => fileRef.current && fileRef.current.click();
  // Starting anything from "/" (or the not-yet-initialized "/chat/new") must
  // begin a brand-new conversation — resetSession() first, then navigate
  // using the id it returns. Without the reset, a leftover sessionId from a
  // previous conversation (Landing doesn't clear SessionContext on its own)
  // would silently absorb this new message/document into the old chat.
  const startFresh = () => {
    if (pathname === "/" || pathname === "/chat/new") {
      const id = s.resetSession();
      router.push(`/chat/${id}`);
    }
  };

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) {
      startFresh();
      await uploadFile(f);
    }
  };

  const removeFile = (e) => {
    e?.stopPropagation?.();
    s.resetDocument();
    toast.info("Lampiran dokumen dibatalkan.");
  };

  const send = async () => {
    const q = input.trim();
    if (!q || disabled) return;
    setInput("");
    startFresh();
    try {
      await run({ mode: "chat", question: q });
    } catch (_) {}
  };

  const quick = async (mode) => {
    if (disabled) return;
    startFresh();
    try {
      await run({ mode });
    } catch (_) {}
  };

  if (extracting) {
    return (
      <div className="w-full rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {progress?.message || "Memproses…"}
        </div>
        <Progress value={progress?.percent || 0} className="mt-3 h-2" data-testid="extraction-progress" />
        <button onClick={cancel} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" /> Batalin
        </button>
      </div>
    );
  }

  const showOverlay = !input && !focused;

  return (
    <div className="w-full">
      {/* Quick Action Chips bila ada dokumen tapi belum pernah analisis */}
      {s.hasDocument && s.messages.length === 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q.mode}
              data-testid={`quick-action-${q.mode === "key_articles" ? "key-articles" : q.mode}-button`}
              disabled={disabled}
              onClick={() => quick(q.mode)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent/60 px-3 py-1.5 text-xs font-medium text-accent-foreground transition-transform hover:-translate-y-0.5 hover:bg-accent disabled:opacity-50"
            >
              <q.icon className="h-3.5 w-3.5 text-primary" />
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div className={`rounded-[1.4rem] border bg-card shadow-sm transition-shadow focus-within:shadow-md ${hero ? "p-2" : "p-1.5"}`}>
        {/* Once a message has gone out, the document is already visible in
            the "Dokumen" panel (sidebar) — showing it again here just to
            offer a remove button that would blank the maskedText/piiMapping
            follow-ups depend on (see maskQuestion/executeAnalysis) is both
            redundant and a footgun. Only show the chip pre-send, when it's
            a pending attachment the user may still want to cancel. */}
        {s.hasDocument && s.file && s.messages.length === 0 && (
          <div className="mx-1 mb-1 mt-1 flex items-center justify-between gap-2 rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate font-medium">{s.file.name}</span>
              {s.extractInfo && (
                <span className="shrink-0 text-muted-foreground">
                  · {s.extractInfo.totalPages} hlm{s.extractInfo.usedOcr ? " · OCR" : ""}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={removeFile}
              data-testid="remove-document-button"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none"
              title="Batal lampiran dokumen"
              aria-label="Batal lampiran dokumen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <Button
            type="button" variant="ghost" size="icon" data-testid="attach-pdf-button"
            onClick={pickFile}
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-primary"
            title="Lampirkan PDF"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <div className="relative flex-1">
            <textarea
              ref={taRef}
              data-testid="chat-composer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder=""
              className={`max-h-[160px] min-h-[40px] w-full resize-none bg-transparent px-1 py-2 text-sm leading-6 outline-none ${hero ? "md:text-base" : ""}`}
            />
            {showOverlay && (
              <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-1">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={placeholder}
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -14, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                    className={`block truncate text-muted-foreground ${hero ? "text-sm md:text-base" : "text-sm"}`}
                  >
                    {placeholder}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* While a run is in flight this is a STOP button, not a disabled
              send — an agentic run with tool calls can block for up to a
              minute and there was previously no way out of it. */}
          {analyzing ? (
            <Button
              type="button"
              data-testid="chat-stop-button"
              onClick={cancelAnalysis}
              size="icon"
              variant="secondary"
              className="h-10 w-10 shrink-0 rounded-full"
              title="Hentikan analisis"
              aria-label="Hentikan analisis"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              data-testid="chat-send-button"
              onClick={send}
              disabled={!mounted || Boolean(disabled || !input.trim())}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              suppressHydrationWarning
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2 px-1 text-center text-[11px] text-muted-foreground">
        {!user ? (
          <span>
            Percakapan anonim — atau{" "}
            <button onClick={onOpenAuth} className="font-semibold text-primary hover:underline" data-testid="composer-auth-link">
              daftar buat simpan
            </button>
          </span>
        ) : hero ? (
          <span>PDF opsional · bisa langsung nanya</span>
        ) : (
          <span>Jawaban bisa keliru — tetap cek dokumen aslinya ya.</span>
        )}
      </div>

      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile} />
    </div>
  );
}
