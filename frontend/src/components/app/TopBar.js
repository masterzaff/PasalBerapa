import React from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnection } from "@/context/ConnectionContext";
import { useSession } from "@/context/SessionContext";

function StatusChip() {
  const { status, latency } = useConnection();
  const styles = {
    idle: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: "Cek koneksi…", cls: "border-border text-muted-foreground" },
    testing: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: "Menyambung…", cls: "border-border text-muted-foreground" },
    connected: { icon: <Wifi className="h-3.5 w-3.5" />, text: `Backend tersambung${latency ? ` · ${latency}ms` : ""}`, cls: "border-[hsl(var(--risk-safe))]/40 text-[hsl(var(--risk-safe))] bg-[hsl(var(--risk-safe-bg))]" },
    failed: { icon: <WifiOff className="h-3.5 w-3.5" />, text: "Backend gagal nyambung", cls: "border-destructive/40 text-destructive bg-[hsl(var(--risk-high-bg))]" },
    unconfigured: { icon: <AlertTriangle className="h-3.5 w-3.5" />, text: "Backend belum diatur", cls: "border-[hsl(var(--risk-warn))]/40 text-[hsl(var(--risk-warn))] bg-[hsl(var(--risk-warn-bg))]" },
  };
  const st = styles[status] || styles.idle;
  return (
    <span
      data-testid="connection-status-chip"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${st.cls}`}
    >
      {st.icon}
      <span className="hidden sm:inline">{st.text}</span>
    </span>
  );
}

export default function TopBar({ onOpenSettings }) {
  const { resetSession, hasDocument } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2.5">
          <motion.div
            initial={{ rotate: -8, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"
          >
            <ShieldCheck className="h-5 w-5" />
          </motion.div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold tracking-tight md:text-lg">
              PasalBerapa?
            </div>
            <div className="hidden text-[11px] text-muted-foreground sm:block">
              Bedah kontrak tanpa ribet, privasi kejaga.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                data-testid="stateless-indicator"
                className="hidden rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground md:inline-flex"
              >
                Data nggak disimpen · refresh = hilang
              </span>
            </TooltipTrigger>
            <TooltipContent>Stateless &amp; privacy-first. Nggak ada login, nggak ada penyimpanan.</TooltipContent>
          </Tooltip>

          <StatusChip />

          {hasDocument && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="reset-session-button"
                  variant="ghost"
                  size="icon"
                  onClick={resetSession}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mulai sesi baru (hapus dokumen ini)</TooltipContent>
            </Tooltip>
          )}

          <Button
            data-testid="settings-open-button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
