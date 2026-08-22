import React, { useEffect, useState } from "react";
import { Loader2, Wifi, WifiOff, AlertTriangle, CheckCircle2, ShieldQuestion } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getEndpoints, saveEndpoints } from "@/lib/config";
import { useConnection } from "@/context/ConnectionContext";

export default function SettingsModal({ open, onOpenChange }) {
  const conn = useConnection();
  const [form, setForm] = useState(getEndpoints());
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) setForm(getEndpoints());
  }, [open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const persist = () => {
    saveEndpoints({
      aiNodeUrl: form.aiNodeUrl.trim(),
      piiEndpoint: form.piiEndpoint.trim(),
      analyzeEndpoint: form.analyzeEndpoint.trim(),
      timeoutMs: Number(form.timeoutMs) || 60000,
    });
    conn.refreshCfg();
  };

  const onSave = () => {
    persist();
    conn.check();
    toast.success("Pengaturan endpoint disimpan.");
    onOpenChange(false);
  };

  const onTest = async () => {
    persist();
    setTesting(true);
    const r = await conn.check();
    setTesting(false);
    if (r.status === "connected") toast.success(`Tersambung! (${r.latencyMs}ms)`);
    else if (r.status === "unconfigured") toast.warning("Isi dulu AI Node URL buat tes koneksi.");
    else toast.error("Gagal nyambung: " + (r.error || "unknown"));
  };

  const StatusLine = () => {
    const map = {
      idle: { icon: <ShieldQuestion className="h-4 w-4" />, text: "Belum dites", cls: "text-muted-foreground" },
      testing: { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: "Menyambung…", cls: "text-muted-foreground" },
      connected: { icon: <CheckCircle2 className="h-4 w-4" />, text: `Tersambung${conn.latency ? ` · ${conn.latency}ms` : ""}`, cls: "text-[hsl(var(--risk-safe))]" },
      failed: { icon: <WifiOff className="h-4 w-4" />, text: conn.error || "Gagal", cls: "text-destructive" },
      unconfigured: { icon: <AlertTriangle className="h-4 w-4" />, text: "AI Node URL belum diisi", cls: "text-[hsl(var(--risk-warn))]" },
    };
    const st = map[conn.status] || map.idle;
    return (
      <div className={`flex items-center gap-2 text-sm ${st.cls}`}>
        {st.icon}
        <span>{st.text}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="settings-connection-modal" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Sambungkan Server AI-mu</DialogTitle>
          <DialogDescription>
            Frontend ini cuma wrapper. Masking PII, RAG, & LLM jalan di server kamu
            sendiri. Isi endpoint-nya di bawah. Config disimpan lokal di browser (bukan dokumen).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-node">AI Node / Gateway Base URL <span className="text-muted-foreground">(buat /health)</span></Label>
            <Input
              id="ai-node"
              data-testid="settings-gateway-url-input"
              placeholder="https://ai-node.server-kamu.com"
              value={form.aiNodeUrl}
              onChange={set("aiNodeUrl")}
              className="font-mono-plex text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pii">PII Masking Endpoint <span className="text-muted-foreground">(POST)</span></Label>
            <Input
              id="pii"
              data-testid="settings-pii-url-input"
              placeholder="https://.../upload-and-mask"
              value={form.piiEndpoint}
              onChange={set("piiEndpoint")}
              className="font-mono-plex text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analyze">Analyze Endpoint <span className="text-muted-foreground">(POST — RAG + LLM)</span></Label>
            <Input
              id="analyze"
              data-testid="settings-analyze-url-input"
              placeholder="https://.../analyze"
              value={form.analyzeEndpoint}
              onChange={set("analyzeEndpoint")}
              className="font-mono-plex text-xs"
            />
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                value={form.timeoutMs}
                onChange={set("timeoutMs")}
                className="font-mono-plex text-xs"
              />
            </div>
            <Button
              data-testid="settings-test-connection-button"
              variant="outline"
              onClick={onTest}
              disabled={testing}
              className="gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Tes Koneksi
            </Button>
          </div>
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <StatusLine />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button data-testid="settings-save-button" onClick={onSave}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
