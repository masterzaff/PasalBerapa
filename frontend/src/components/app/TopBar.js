import React from "react";
import { useNavigate } from "react-router-dom";
import { Gavel, RotateCcw, History, LogOut, UserPlus, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";

export default function TopBar({ onOpenAuth, onOpenHistory, onGoHome }) {
  const { resetSession, hasDocument } = useSession();
  const { user, logout } = useAuth();
  const { mode, setMode } = useUI();
  const navigate = useNavigate();

  const newSession = () => {
    resetSession();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={newSession}
          data-testid="home-logo-button"
          aria-label="Kembali ke menu utama"
          className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Gavel className="h-6 w-6 -rotate-12 text-primary" />
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold tracking-tight md:text-xl">
              PasalBerapa?
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode Switch: Bisnis <> Personal */}
          <div className="flex items-center rounded-full border bg-muted/60 p-0.5 text-xs font-medium" data-testid="mode-toggle-group">
            <button
              type="button"
              data-testid="mode-switch-bisnis"
              onClick={() => setMode("bisnis")}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all ${
                mode === "bisnis"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Bisnis</span>
            </button>
            <button
              type="button"
              data-testid="mode-switch-personal"
              onClick={() => setMode("personal")}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all ${
                mode === "personal"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-3.5 w-3.5 text-primary" />
              <span>Personal</span>
            </button>
          </div>

          {hasDocument && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="reset-session-button" variant="ghost" size="sm" onClick={newSession} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden sm:inline">Sesi baru</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mulai lagi dengan dokumen baru</TooltipContent>
            </Tooltip>
          )}

          {user ? (
            <>
              <Button data-testid="open-history-button" variant="outline" size="sm" onClick={onOpenHistory} className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Riwayat</span>
              </Button>
              <span className="hidden max-w-[140px] truncate rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground md:inline-flex">
                {user.name || user.email}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button data-testid="logout-button" variant="ghost" size="icon" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Keluar</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Button data-testid="open-auth-button" size="sm" onClick={onOpenAuth} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Daftar sekarang
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
