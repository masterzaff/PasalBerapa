import React, { useEffect, useRef, useState } from "react";
import { Paperclip, ArrowUp, X, Loader2, ShieldAlert, FileText, Sparkles, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";

const QUICK = [
  { mode: "risk", label: "Bedah Risiko", icon: ShieldAlert },
  { mode: "summary", label: "Ringkas Isi", icon: FileText },
  { mode: "key_articles", label: "Jelaskan Pasal Penting", icon: Sparkles },
];

export default function ChatComposer({ variant = "docked", seed }) {
  const s = useSession();
  const { run, busy: analyzing } = useAnalysis();
  const { uploadFile, progress, busy: extracting, cancel } = useDocumentUpload();
  const [input, setInput] = useState("");
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const disabled = analyzing || extracting;
  const hero = variant === "hero";

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  // Prefill from example question chips.
  useEffect(() => {
    if (seed && seed.text) {
      setInput(seed.text);
      if (taRef.current) taRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed && seed.id]);

  const pickFile = () => fileRef.current && fileRef.current.click();
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) await uploadFile(f);
  };

  const send = async () => {
    const q = input.trim();
    if (!q || disabled) return;
    if (!s.hasDocument) {
      toast.message("Lampirin PDF dulu ya, biar ada yang aku bedah.");
      pickFile();
      return;
    }
    setInput("");
    try {
      await run({ mode: "chat", question: q });
    } catch (_) {}
  };

  const quick = async (mode) => {
    if (disabled) return;
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
        <button
          onClick={cancel}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Batalin
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {s.hasDocument && (
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

      <div
        className={`rounded-[1.4rem] border bg-card shadow-sm transition-shadow focus-within:shadow-md ${
          hero ? "p-2" : "p-1.5"
        }`}
      >
        {s.hasDocument && s.file && (
          <div className="mx-1 mb-1 mt-1 flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
            <FileCheck2 className="h-3.5 w-3.5 text-primary" />
            <span className="truncate font-medium">{s.file.name}</span>
            {s.extractInfo && (
              <span className="shrink-0 text-muted-foreground">
                · {s.extractInfo.totalPages} hlm{s.extractInfo.usedOcr ? " · OCR" : ""}
              </span>
            )}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="attach-pdf-button"
            onClick={pickFile}
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-primary"
            title="Lampirkan PDF"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <textarea
            ref={taRef}
            data-testid="chat-composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={
              s.hasDocument
                ? "Tanya apa aja soal dokumen ini…"
                : hero
                ? "Tanya soal kontrakmu… (lampirin PDF-nya dulu di ikon 📎)"
                : "Tanya apa aja…"
            }
            className={`max-h-[160px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground ${
              hero ? "md:text-base" : ""
            }`}
          />
          <Button
            type="button"
            data-testid="chat-send-button"
            onClick={send}
            disabled={disabled || !input.trim()}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="mt-2 px-1 text-center text-[11px] text-muted-foreground">
        {hero ? (
          <span>Tarik &amp; lepas PDF ke mana aja · data pribadi dimasking sebelum dianalisis</span>
        ) : (
          <span>Jawaban bisa keliru — tetap cek dokumen aslinya ya.</span>
        )}
      </div>

      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile} />
    </div>
  );
}
