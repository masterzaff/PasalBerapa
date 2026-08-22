"use client";

import React from "react";
import { Bug } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DebugRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Array<{ role: string; name?: string; content?: unknown }>;
}

const ROLE_STYLES: Record<string, string> = {
  system: "bg-primary/10 text-primary border-primary/20",
  user: "bg-muted text-foreground border-border",
  assistant: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  tool: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
};

export default function DebugRequestModal({ open, onOpenChange, messages }: DebugRequestModalProps) {
  const turns = Array.isArray(messages) ? messages : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 border-b bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Bug className="h-4 w-4" />
            <span>Debug</span>
          </div>
          <DialogTitle className="font-display text-lg font-semibold mt-1">
            Request ke LLM
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Persis pesan (system/user/assistant/tool) yang dilihat LLM sebelum menghasilkan balasan ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
          {turns.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tidak ada data debug untuk pesan ini.</p>
          ) : (
            turns.map((m, i) => {
              const badge = ROLE_STYLES[m.role] || "bg-muted text-foreground border-border";
              const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2);
              return (
                <div key={i} className="rounded-xl border bg-card/60 overflow-hidden">
                  <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b ${badge}`}>
                    {i + 1}. {m.role}
                    {m.name ? ` · ${m.name}` : ""}
                  </div>
                  <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono text-foreground/90 max-h-64 overflow-y-auto select-text">
                    {content || "(kosong)"}
                  </pre>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
