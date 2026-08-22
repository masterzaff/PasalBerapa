import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, FileText, Sparkles, Send, Bot, User, Settings2, BookMarked } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/context/SessionContext";
import { useConnection } from "@/context/ConnectionContext";
import { useAnalysis, MODE_LABELS } from "@/hooks/useAnalysis";

const QUICK_ACTIONS = [
  { mode: "risk", label: "Bedah Risiko (Red Flags)", icon: ShieldAlert, variant: "default", testid: "quick-action-risk-button" },
  { mode: "summary", label: "Ringkas Isi", icon: FileText, variant: "secondary", testid: "quick-action-summary-button" },
  { mode: "key_articles", label: "Jelaskan Pasal Terpenting", icon: Sparkles, variant: "outline", testid: "quick-action-key-articles-button" },
];

function TypingBubble() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl border bg-accent px-4 py-3">
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

function Message({ m }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? "items-end text-right" : ""}`}>
        <div className="mb-0.5 text-[11px] text-muted-foreground">
          {isUser ? "Kamu" : "PasalBerapa?"}
          {m.mode && !isUser ? ` · ${MODE_LABELS[m.mode] || ""}` : ""}
        </div>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6 ${
            isUser
              ? "bg-secondary text-secondary-foreground"
              : m.error
              ? "border border-destructive/30 bg-[hsl(var(--risk-high-bg))] text-foreground"
              : "border bg-accent text-foreground"
          }`}
        >
          {m.content}
        </div>
        {Array.isArray(m.citations) && m.citations.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {m.citations.map((c, i) => (
              <a
                key={i}
                href={c.url || undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-1.5 rounded-lg border bg-card px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:border-primary"
              >
                <BookMarked className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>
                  <span className="font-medium text-foreground">{c.regulation} {c.article}</span>
                  {c.snippet ? ` — ${c.snippet}` : ""}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalysisPanel({ onOpenSettings }) {
  const { messages } = useSession();
  const conn = useConnection();
  const { run, busy, busyMode } = useAnalysis();
  const [input, setInput] = useState("");
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, busy]);

  const trigger = async (mode, question) => {
    try {
      await run({ mode, question });
    } catch (_) {}
  };

  const onSend = () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    trigger("chat", q);
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Analisis — Santai tapi Nendang</span>
      </div>

      {!conn.analyzeConfigured && (
        <div className="flex items-start gap-2 border-b bg-[hsl(var(--risk-warn-bg))] px-4 py-2.5 text-xs">
          <Settings2 className="mt-0.5 h-3.5 w-3.5 text-[hsl(var(--risk-warn))]" />
          <span>
            Backend analisis belum nyambung.{" "}
            <button onClick={onOpenSettings} className="font-semibold text-primary underline">
              Atur endpoint di Settings
            </button>{" "}
            biar tombol-tombol di bawah aktif.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 border-b p-3 md:grid-cols-3">
        {QUICK_ACTIONS.map((a) => (
          <Button
            key={a.mode}
            data-testid={a.testid}
            variant={a.variant}
            disabled={busy}
            onClick={() => trigger(a.mode)}
            className="h-auto justify-start gap-2 py-2.5 text-left transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <a.icon className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold leading-tight">{a.label}</span>
          </Button>
        ))}
      </div>

      <div ref={feedRef} className="scroll-slim min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !busy && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-display text-base font-semibold">Mau mulai dari mana?</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Klik salah satu tombol di atas, atau tanya langsung apa aja soal dokumen ini.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {busy && (
          <div className="flex gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="mb-0.5 text-[11px] text-muted-foreground">
                PasalBerapa? {busyMode ? `· ${MODE_LABELS[busyMode] || ""}` : ""}
              </div>
              <TypingBubble />
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            data-testid="chat-composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Tanya apa aja… misal: 'aku boleh resign kapan aja nggak?'"
            className="min-h-[44px] resize-none"
            rows={1}
          />
          <Button
            data-testid="chat-send-button"
            onClick={onSend}
            disabled={busy || !input.trim()}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
