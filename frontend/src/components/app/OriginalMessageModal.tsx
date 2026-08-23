"use client";

import React from "react";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface OriginalMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sentMasked?: string;
  receivedRaw?: string;
}

// User-facing transparency view: exactly what left the browser (masked
// question) and what came back from the LLM (raw masked reply, before
// client-side unmasking) — NOT the developer Debug view, which shows the
// full system/tool/history message list sent to the model.
export default function OriginalMessageModal({ open, onOpenChange, sentMasked, receivedRaw }: OriginalMessageModalProps) {
  const hasContent = Boolean(sentMasked || receivedRaw);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 border-b bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Eye className="h-4 w-4" />
            <span>Pesan Asli</span>
          </div>
          <DialogTitle className="font-display text-lg font-semibold mt-1">
            Yang dikirim &amp; diterima
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Teks persis yang meninggalkan browser kamu (sudah tersamar) dan balasan mentah dari LLM,
            sebelum data pribadi dibalikin buat ditampilin di layar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {!hasContent ? (
            <p className="text-xs text-muted-foreground">Tidak ada data untuk pesan ini.</p>
          ) : (
            <>
              <div className="rounded-xl border bg-card/60 overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b bg-muted text-foreground border-border">
                  Terkirim ke LLM (tersamar)
                </div>
                <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono text-foreground/90 max-h-64 overflow-y-auto select-text">
                  {sentMasked || "(kosong)"}
                </pre>
              </div>
              <div className="rounded-xl border bg-card/60 overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                  Diterima dari LLM (mentah)
                </div>
                <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono text-foreground/90 max-h-64 overflow-y-auto select-text">
                  {receivedRaw || "(kosong)"}
                </pre>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
