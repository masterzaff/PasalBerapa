"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { hydrateConversation } from "@/lib/conversation";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/authApi";
import TopBar from "@/components/app/TopBar";
import Landing from "@/components/app/Landing";
import ChatView from "@/components/app/ChatView";
import AuthPage from "@/components/app/AuthPage";
import HistorySheet from "@/components/app/HistorySheet";
import PiiReviewModal from "@/components/app/PiiReviewModal";
import UnlockModal from "@/components/app/UnlockModal";

interface AppShellProps {
  sessionId?: string;
  isNewChat?: boolean;
}

export default function AppShell({ sessionId: urlId, isNewChat = false }: AppShellProps = {}) {
  const { hasDocument, messages, sessionId, loadConversation, showPiiModal, setShowPiiModal } = useSession();
  const { token, encKey, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [restoring, setRestoring] = useState(false);

  const started = hasDocument || messages.length > 0;
  const isChat = Boolean(isNewChat || urlId || (pathname !== "/" && mounted && (started || restoring)));
  const openAuth = () => setShowAuth(true);
  const openHistory = () => setShowHistory(true);

  // 1) Reflect the active session in the URL (so refresh keeps /chat/:id).
  useEffect(() => {
    if (!mounted || !started || !sessionId) return;
    if (pathname === "/") return; // Jangan redirect paksa jika user berada di home "/"
    const target = `/chat/${sessionId}`;
    if (pathname !== target && pathname.startsWith("/chat")) {
      router.replace(target);
    }
  }, [mounted, started, sessionId, pathname, router]);

  // 2) If /chat/:id doesn't match what's in memory, restore that conversation
  //    from the DB. Keyed on the URL id (not a one-shot ref) so navigating
  //    between two saved conversations restores each one — and comparing
  //    against sessionId rather than `started` means a deep link no longer
  //    silently shows whatever stale session sessionStorage happened to hold.
  const triedRef = useRef(null);
  useEffect(() => {
    if (!mounted || !urlId || urlId === "new" || isNewChat || authLoading) return;
    if (!sessionId) return; // session state not hydrated yet
    if (sessionId === urlId || triedRef.current === urlId) return;
    triedRef.current = urlId;
    if (!token) {
      router.replace("/");
      return;
    }
    setRestoring(true);
    authApi
      .getConversation(urlId, token)
      .then(async (d) => {
        const h = await hydrateConversation(d, encKey);
        loadConversation({ ...h, id: urlId });
        if (h.locked) toast.info("Data pribadi terkunci — masukkan kata sandi untuk membukanya.");
      })
      .catch(() => router.replace("/"))
      .finally(() => setRestoring(false));
  }, [mounted, urlId, isNewChat, sessionId, token, encKey, authLoading, router, loadConversation]);

  const goHome = () => {
    router.push("/");
  };

  return (
    <div className="App flex min-h-screen flex-col bg-background text-foreground paper-grain">
      <TopBar onOpenAuth={openAuth} onOpenHistory={openHistory} onGoHome={goHome} onOpenUnlock={() => setShowUnlock(true)} />
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
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
