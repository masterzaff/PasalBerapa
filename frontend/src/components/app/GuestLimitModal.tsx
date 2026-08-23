"use client";

import React from "react";
import { Sparkles, UserPlus, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GuestLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAuth: () => void;
}

export default function GuestLimitModal({
  open,
  onOpenChange,
  onOpenAuth,
}: GuestLimitModalProps) {
  const handleProceedAuth = () => {
    onOpenChange(false);
    onOpenAuth();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[92vw] sm:w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-gradient-to-br from-primary/10 via-accent/30 to-background">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Batas Mode Tamu</span>
          </div>
          <DialogTitle className="font-display text-xl font-semibold mt-1.5 text-foreground">
            Buat Akun untuk Melanjutkan
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            Di mode tamu, Anda hanya dapat mengirim 1 pesan per percakapan. Buat akun gratis untuk melanjutkan konsultasi tanpa batas.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><b>Tanya Jawab Tanpa Batas</b> — Bedah risiko & diskusikan klausul kontrak sepuasnya.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><b>Simpan Riwayat Percakapan</b> — Buka kembali hasil analisis kapan saja dari perangkat mana pun.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><b>Privasi Terenkripsi (E2EE)</b> — Data sensitif & pemetaan PII terenkripsi aman di browser Anda.</span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Nanti Saja
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleProceedAuth}
            className="gap-1.5 font-medium shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            <span>Buat Akun / Masuk</span>
            <ArrowRight className="h-3.5 w-3.5 ml-0.5 opacity-70" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
