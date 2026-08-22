import React from "react";
import { motion } from "framer-motion";
import { Bot, User, BookMarked } from "lucide-react";
import { MODE_LABELS } from "@/context/AnalysisContext";

export function TypingBubble() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-2xl border bg-accent px-4 py-3">
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
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
          className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-6 ${
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
                  <span className="font-medium text-foreground">
                    {c.regulation} {c.article}
                  </span>
                  {c.snippet ? ` — ${c.snippet}` : ""}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
