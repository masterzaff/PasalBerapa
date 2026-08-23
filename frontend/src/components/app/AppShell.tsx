"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { hydrateConversation } from "@/lib/conversation";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/authApi";
import { parseRoute, navigateToChat, navigateToNewChat, navigateToHome, RouteState } from "@/lib/navigation";
import TopBar from "@/components/app/TopBar";
import Landing from "@/components/app/Landing";
import ChatView from "@/components/app/ChatView";
import AuthPage from "@/components/app/AuthPage";
import HistorySheet from "@/components/app/HistorySheet";
import PiiReviewModal from "@/components/app/PiiReviewModal";
import UnlockModal from "@/components/app/UnlockModal";
import ChangePasswordModal from "@/components/app/ChangePasswordModal";

interface AppShellProps {
  sessionId?: string;
  isNewChat?: boolean;
}

export default function AppShell({ sessionId: propId, isNewChat: propIsNew = false }: AppShellProps = {}) {
  const { hasDocument, messages, sessionId, convId, convVersion, loadConversation, resetSession, showPiiModal, setShowPiiModal } = useSession();
  const { token, encKey, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState<RouteState>({ sessionId: propId, isNewChat: propIsNew, isHome: !propId && !propIsNew });
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Sync route from URL / hash
  const updateRoute = useCallback(() => {
    const r = parseRoute();
    setRoute({
      sessionId: r.sessionId || propId,
      isNewChat: r.isNewChat || propIsNew,
      isHome: r.isHome && !propId && !propIsNew,
    });
  }, [propId, propIsNew]);

  useEffect(() => {
    setMounted(true);
    updateRoute();

    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, [updateRoute]);

  const activeUrlId = route.sessionId && route.sessionId !== "_" ? route.sessionId : undefined;
  const isExplicitNewChat = route.isNewChat;

  const started = hasDocument || messages.length > 0;
  const isChat = Boolean(!route.isHome && (isExplicitNewChat || activeUrlId || restoring || started));
  const openAuth = () => setShowAuth(true);
  const openHistory = () => setShowHistory(true);

  // 1) Reflect the active session in the URL hash (e.g. #id=xxx) so refresh keeps the session on CDN
  useEffect(() => {
    if (!mounted || route.isHome) return;
    if (!started || !sessionId) return;
    navigateToChat(sessionId);
  }, [mounted, started, sessionId, route.isHome]);

  // 2) Restore conversation from server on direct URL load or hash change
  const convVersionRef = useRef(convVersion);
  useEffect(() => { convVersionRef.current = convVersion; }, [convVersion]);

  const triedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mounted || !activeUrlId || activeUrlId === "new" || isExplicitNewChat || authLoading) return;
    if (!sessionId) return;
    if (triedRef.current === activeUrlId) return;
    const isFreshLoad = sessionId !== activeUrlId;
    if (!isFreshLoad && !convId) {
      // Session minted locally and never sent to the server yet — e.g.
      // Landing navigates to /chat/:id right after upload, before the first
      // message creates the conversation row. Nothing to restore; a GET here
      // would just 404 (always, in guest mode, since it has no history to
      // fall back on).
      triedRef.current = activeUrlId;
      return;
    }
    triedRef.current = activeUrlId;
    if (isFreshLoad) setRestoring(true);
    authApi
      .getConversation(activeUrlId, token)
      .then(async (d) => {
        const serverVersion = typeof d.version === "number" ? d.version : 0;
        if (!isFreshLoad && serverVersion < convVersionRef.current) return;
        const h = await hydrateConversation(d, encKey);
        const feedback = token
          ? await authApi.getConversationFeedback(activeUrlId, token).catch(() => ({}))
          : {};
        loadConversation({ ...h, id: activeUrlId, feedback });
        if (h.locked) toast.info("Data pribadi terkunci — masukkan kata sandi untuk membukanya.");
      })
      .catch(() => {
        if (isFreshLoad) {
          navigateToHome();
          setRoute({ sessionId: undefined, isNewChat: false, isHome: true });
        }
      })
      .finally(() => { if (isFreshLoad) setRestoring(false); });
  }, [mounted, activeUrlId, isExplicitNewChat, sessionId, convId, token, encKey, authLoading, loadConversation]);

  const handleGoHome = () => {
    navigateToHome();
    setRoute({ sessionId: undefined, isNewChat: false, isHome: true });
  };

  return (
    <div className="App flex min-h-screen flex-col bg-background text-foreground paper-grain">
      <TopBar
        onOpenAuth={openAuth}
        onOpenHistory={openHistory}
        onGoHome={handleGoHome}
        onOpenUnlock={() => setShowUnlock(true)}
        onOpenChangePw={() => setShowChangePw(true)}
      />
      <main className="flex min-h-0 flex-1 flex-col">
        {isChat ? (
          <ChatView onOpenAuth={openAuth} onOpenHistory={openHistory} />
        ) : (
          <Landing onOpenAuth={openAuth} />
        )}
      </main>
      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}
      <HistorySheet open={showHistory} onOpenChange={setShowHistory} />
      <PiiReviewModal open={showPiiModal} onOpenChange={setShowPiiModal} />
      <UnlockModal open={showUnlock} onOpenChange={setShowUnlock} />
      <ChangePasswordModal open={showChangePw} onOpenChange={setShowChangePw} />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
