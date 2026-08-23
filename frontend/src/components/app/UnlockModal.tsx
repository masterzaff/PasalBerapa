"use client";

import React, { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

/**
 * Re-derives the encryption key for an already-signed-in session.
 *
 * The key lives in sessionStorage, not localStorage — it unlocks real PII,
 * whereas the token in localStorage only reaches masked data, so the two must
 * not share exposure. The cost is this prompt after a browser restart.
 *
 * There is nothing to verify the password against (that is the whole point), so
 * a wrong one is only discovered when a mapping fails to decrypt.
 */
export default function UnlockModal({ open, onOpenChange }) {
  const { unlock } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!password || busy) return;
    setBusy(true);
    try {
      await unlock(password);
      setPassword("");
      onOpenChange(false);
      toast.success("Data pribadi dibuka. Muat ulang percakapan untuk melihatnya.");
    } catch (err) {
      toast.error(err?.message || "Gagal membuka kunci.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Kunci Lokal</span>
          </div>
          <DialogTitle className="font-display text-lg">Buka Kunci Data Pribadi</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Nama, NIK, dan data pribadi lain di percakapan tersimpan dalam bentuk
            terenkripsi. Kuncinya diturunkan dari kata sandimu di browser ini saja —
            server tidak pernah memilikinya, jadi hanya kamu yang bisa membukanya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kata sandi akunmu"
            data-testid="unlock-password-input"
          />
          <p className="text-[11px] text-muted-foreground">
            Salah kata sandi tidak memunculkan error langsung — datanya hanya tetap
            tampil sebagai tag seperti <code className="rounded bg-muted px-1">&lt;PERSON_1&gt;</code>.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Nanti
            </Button>
            <Button type="submit" size="sm" disabled={!password || busy} data-testid="unlock-submit" className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Buka Kunci
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
