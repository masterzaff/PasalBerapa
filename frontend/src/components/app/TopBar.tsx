import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Gavel, History, LogOut, UserPlus, Building2, User, SquarePen, Lock, KeyRound, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";

import { navigateToNewChat, navigateToHome } from "@/lib/navigation";

export default function TopBar({ onOpenAuth, onOpenHistory, onGoHome, onOpenUnlock, onOpenChangePw }) {
  const { resetSession, hasDocument, messages } = useSession();
  const { user, logout, encKey } = useAuth();
  const { audienceMode, setAudienceMode } = useUI();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isSessionActive = mounted && (hasDocument || messages.length > 0);
  const isHashActive = mounted && Boolean(typeof window !== "undefined" && window.location.hash && window.location.hash !== "#new" && window.location.hash !== "#");
  const isChatPage = pathname?.startsWith("/chat");
  const isNewChatPage = pathname === "/chat/new" || (mounted && typeof window !== "undefined" && window.location.hash === "#new");
  const showNewChatButton = mounted && (isSessionActive || isHashActive || (isChatPage && !isNewChatPage));
  const showModeSwitch = mounted ? (!isChatPage && !isSessionActive) : (!isChatPage);

  const goHome = onGoHome || (() => {
    resetSession();
    navigateToHome();
  });

  const startNewChat = () => {
    resetSession();
    navigateToNewChat();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={goHome}
          data-testid="home-logo-button"
          aria-label="Kembali ke menu utama"
          className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Gavel className="h-6 w-6 -rotate-12 text-primary" />
          <div className="hidden leading-tight sm:block">
            <div className="font-display text-lg font-semibold tracking-tight md:text-xl">
              PasalBerapa?
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode Switch: Bisnis <> Personal (Hanya tampil di Landing page) */}
          {showModeSwitch && (
            <div className="flex items-center rounded-full border bg-muted/60 p-0.5 text-xs font-medium" data-testid="mode-toggle-group">
              <button
                type="button"
                data-testid="mode-switch-bisnis"
                onClick={() => setAudienceMode("bisnis")}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all ${
                  audienceMode === "bisnis"
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
                onClick={() => setAudienceMode("personal")}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all ${
                  audienceMode === "personal"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-3.5 w-3.5 text-primary" />
                <span>Personal</span>
              </button>
            </div>
          )}

          {showNewChatButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid="reset-session-button" variant="outline" size="sm" onClick={startNewChat} className="gap-1.5">
                  <SquarePen className="h-4 w-4 text-primary" />
                  <span className="hidden sm:inline">Chat baru</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mulai chat atau analisis dokumen baru</TooltipContent>
            </Tooltip>
          )}

          {user ? (
            <>
              {/* Signed in but no key in this browser session (restart, or a
                  second device): saved PII stays as tags until unlocked. */}
              {!encKey && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      data-testid="unlock-button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenUnlock}
                      className="gap-1.5 border-amber-500/40 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                    >
                      <Lock className="h-4 w-4" />
                      <span className="hidden sm:inline">Terkunci</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Buka kunci data pribadi di percakapan tersimpan</TooltipContent>
                </Tooltip>
              )}
              <Button data-testid="open-history-button" variant="outline" size="sm" onClick={onOpenHistory} className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Riwayat</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-testid="user-menu-button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 max-w-[180px]"
                  >
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <span className="hidden max-w-[110px] truncate sm:inline">{user.name || user.email}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="change-password-button" onClick={onOpenChangePw}>
                    <KeyRound className="h-4 w-4" />
                    Ganti kata sandi
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="logout-button"
                    onClick={logout}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button data-testid="open-auth-button" size="sm" onClick={onOpenAuth} className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="sm:hidden">Daftar</span>
              <span className="hidden sm:inline">Daftar sekarang</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
