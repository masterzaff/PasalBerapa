"use client";

import React, { useEffect, useState } from "react";
import { KeyRound, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const MIN = 6;

/**
 * Password change is a KEY ROTATION here, not just a credential update: the
 * mapping key is derived from the password, so every stored mapping has to be
 * decrypted with the old key and re-encrypted with the new one, and land in the
 * same transaction as the new password.
 *
 * Anything that cannot be decrypted with the current password would become
 * permanently unreadable, so a dry run counts those first and makes the user
 * confirm explicitly instead of finding out afterwards.
 */
export default function ChangePasswordModal({ open, onOpenChange }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState(null);

  useEffect(() => {
    if (open) { setCurrent(""); setNext(""); setConfirm(""); setWarn(null); }
  }, [open]);

  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = current && next.length >= MIN && next === confirm && next !== current;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!valid || busy) return;
    setBusy(true);
    try {
      // Dry run first: find out what we would lose before touching anything.
      if (!warn) {
        const p = await changePassword(current, next, { preview: true });
        if (p.unreadable > 0) {
          setWarn(p);
          return; // require a second, informed click
        }
      }
      const r = await changePassword(current, next);
      onOpenChange(false);
      toast.success(
        r.rotated > 0
          ? `Kata sandi diganti. ${r.rotated} percakapan dienkripsi ulang.`
          : "Kata sandi diganti."
      );
      if (r.unreadable > 0) {
        toast.warning(`${r.unreadable} percakapan tidak bisa dibuka dan kini tetap tampil sebagai tag.`);
      }
    } catch (err) {
      toast.error(err?.message || "Gagal mengganti kata sandi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Ganti Kata Sandi</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Kunci enkripsi data pribadimu diturunkan dari kata sandi ini, jadi semua
            percakapan tersimpan akan dienkripsi ulang sekaligus. Jangan tutup jendela
            ini sampai selesai.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pw">Kata sandi saat ini</Label>
            <Input id="cur-pw" type="password" autoFocus value={current}
                   onChange={(e) => { setCurrent(e.target.value); setWarn(null); }}
                   data-testid="cp-current" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">Kata sandi baru</Label>
            <Input id="new-pw" type="password" value={next} minLength={MIN}
                   onChange={(e) => { setNext(e.target.value); setWarn(null); }}
                   placeholder={`minimal ${MIN} karakter`} data-testid="cp-new" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-pw">Ulangi kata sandi baru</Label>
            <Input id="cf-pw" type="password" value={confirm}
                   onChange={(e) => setConfirm(e.target.value)} data-testid="cp-confirm" />
            {mismatch && <p className="text-[11px] text-destructive">Kata sandinya belum sama.</p>}
          </div>

          {warn && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-[11px] leading-relaxed">
              <p className="flex items-center gap-1.5 font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> {warn.unreadable} dari {warn.total} percakapan tidak bisa dibuka
              </p>
              <p className="mt-1 text-muted-foreground">
                Data itu terenkripsi dengan kata sandi lain dan tidak bisa ikut dipindahkan.
                Kalau dilanjutkan, nama/NIK di dalamnya akan tetap tampil sebagai tag
                selamanya. Klik sekali lagi untuk melanjutkan.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!valid || busy}
              data-testid="cp-submit"
              className={`gap-1.5 ${warn ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {warn ? "Lanjutkan" : "Ganti Kata Sandi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
