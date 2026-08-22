import React, { useState } from "react";
import { motion } from "framer-motion";
import { Gavel, Lock, Loader2, ArrowLeft, Mail, KeyRound, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function AuthPage({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("register"); // register | login
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "register") {
        await register(email, password, name || undefined);
        toast.success("Akun kebuat! Sekarang percakapanmu bisa disimpan.");
      } else {
        await login(email, password);
        toast.success("Selamat datang lagi 👋");
      }
      onClose();
    } catch (err) {
      toast.error(err.message || "Gagal, coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background paper-grain">
      <div className="pointer-events-none absolute inset-0 hero-mist" aria-hidden />
      <div className="relative flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <Gavel className="h-6 w-6 -rotate-12 text-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">PasalBerapa?</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5" data-testid="auth-close-button">
          <ArrowLeft className="h-4 w-4" /> Balik
        </Button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md rounded-3xl border bg-card/90 p-6 shadow-[0_24px_70px_-40px_hsl(var(--foreground)/0.4)] backdrop-blur-sm sm:p-8"
        >
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--vault-bg))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--vault))]">
            <Lock className="h-3 w-3" /> Cuma buat simpan percakapan · tetap private
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === "register" ? "Daftar sekarang" : "Masuk ke akunmu"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "register"
              ? "Bikin akun biar riwayat obrolan hukummu kesimpen & bisa dibuka lagi."
              : "Masuk buat lihat percakapan yang udah kamu simpan."}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama (opsional)</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" data-testid="auth-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Budi" className="pl-9" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" required data-testid="auth-email-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" required minLength={6} data-testid="auth-password-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="minimal 6 karakter" className="pl-9" />
              </div>
            </div>
            <Button type="submit" disabled={busy} data-testid="auth-submit-button" className="w-full gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "register" ? "Daftar" : "Masuk"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "register" ? "Udah punya akun?" : "Belum punya akun?"}{" "}
            <button
              onClick={() => setMode(mode === "register" ? "login" : "register")}
              className="font-semibold text-primary hover:underline"
              data-testid="auth-switch-mode"
            >
              {mode === "register" ? "Masuk" : "Daftar"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
