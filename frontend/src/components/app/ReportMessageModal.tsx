"use client";

import React, { useEffect, useState } from "react";
import { Flag, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface ReportMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { reason: string; censoredExcerpt: string | null }) => Promise<void> | void;
  // The real, decrypted tag -> value pairs (e.g. "<PERSON_1>": "Budi Santoso")
  // this report is offering to attach, UNMASKED. Normally this mapping is
  // encrypted client-side and never leaves the browser — sending it is an
  // explicit opt-in, off by default, so the checkbox and warning below are
  // not cosmetic. Omit/empty to hide the checkbox (nothing to attach).
  sensitiveMapping?: Record<string, string>;
  title?: string;
  description?: string;
}

// Shared by the per-message Report button (ChatMessage) and the HITL masking
// review modal — same shape, same "optional original data" behavior, just a
// different mapping/copy passed in by the caller.
export default function ReportMessageModal({
  open,
  onOpenChange,
  onSubmit,
  sensitiveMapping,
  title = "Laporkan pesan ini",
  description = "Ceritakan apa yang salah. Laporan membantu kami memperbaiki jawaban AI.",
}: ReportMessageModalProps) {
  const [reason, setReason] = useState("");
  const [includeMapping, setIncludeMapping] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mappingEntries = Object.entries(sensitiveMapping || {});
  const hasMapping = mappingEntries.length > 0;

  useEffect(() => {
    if (open) {
      setReason("");
      setIncludeMapping(false);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        reason: reason.trim(),
        censoredExcerpt: includeMapping && hasMapping ? JSON.stringify(sensitiveMapping) : null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[92vw] sm:w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b bg-muted/40">
          <div className="flex items-center gap-2 text-destructive font-semibold text-xs tracking-wider uppercase">
            <Flag className="h-4 w-4" />
            <span>Laporkan</span>
          </div>
          <DialogTitle className="font-display text-lg font-semibold mt-1">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-3">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Opsional: jelaskan masalahnya (mis. jawaban salah, tidak relevan, atau berbahaya)…"
            className="text-sm min-h-[90px]"
            maxLength={1000}
            autoFocus
          />

          {hasMapping ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
              <label className="flex items-start gap-2 cursor-pointer select-none p-2.5">
                <Checkbox
                  checked={includeMapping}
                  onCheckedChange={(v) => setIncludeMapping(Boolean(v))}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-xs text-foreground leading-relaxed">
                  <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Sertakan data asli (belum disamarkan)
                  </span>
                  <span className="text-muted-foreground block mt-0.5">
                    <span className="sm:hidden">
                      Kirim data pribadi asli (biasanya terenkripsi) untuk konteks laporan.
                      <b> Bisa memuat data sensitif Anda.</b>
                    </span>
                    <span className="hidden sm:inline">
                      Kirim pemetaan data pribadi yang biasanya terenkripsi dan tidak pernah kami lihat
                      (nama, nomor, dll.) supaya tim kami bisa meninjau laporan ini dengan konteks penuh.
                      <b> Ini bisa memuat data pribadi/sensitif Anda</b> — hanya centang jika Anda yakin.
                    </span>
                  </span>
                </span>
              </label>
              {includeMapping && (
                <div className="border-t border-amber-500/20 bg-background/60 px-3 py-2 max-h-28 overflow-y-auto">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Yang akan dikirim
                  </p>
                  <ul className="space-y-0.5">
                    {mappingEntries.map(([tag, value]) => (
                      <li key={tag} className="text-[11px] font-mono text-foreground/80 flex gap-1.5">
                        <span className="text-muted-foreground shrink-0">{tag}:</span>
                        <span className="truncate">{value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/20">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Mengirim…" : "Kirim Laporan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
