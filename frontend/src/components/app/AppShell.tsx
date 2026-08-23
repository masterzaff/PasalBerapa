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
import ChangePasswordModal from "@/components/app/ChangePasswordModal";

interface AppShellProps {
  sessionId?: string;
  isNewChat?: boolean;
}

export default function AppShell({ sessionId: urlId, isNewChat = false }: AppShellProps = {}) {
  const { hasDocument, messages, sessionId, convVersion, loadConversation, showPiiModal, setShowPiiModal } = useSession();
  const { token, encKey, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

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

  // 2) The server is the source of truth for a saved conversation, not
  //    sessionStorage — so fetch on every /chat/:id mount, not only when the
  //    local sessionId doesn't match. Keyed on the URL id (via triedRef, once
  //    per mount) so navigating between two saved conversations restores each.
  //
  //    When the local sessionId already matches urlId (e.g. sessionStorage
  //    already holds this conversation), paint from that instantly — no
  //    restoring spinner, no redirect if the fetch fails — and reconcile in
  //    the background: apply the fetch only if the server isn't behind what
  //    we already have. A just-finished autosave bumps convVersionRef
  //    immediately, so this can't clobber our own write; it picks up another
  //    tab/device's edits and backfills risks/citations an older local
  //    snapshot never had.
  const convVersionRef = useRef(convVersion);
  useEffect(() => { convVersionRef.current = convVersion; }, [convVersion]);

  const triedRef = useRef(null);
  useEffect(() => {
    if (!mounted || !urlId || urlId === "new" || isNewChat || authLoading) return;
    if (!sessionId) return; // session state not hydrated yet
    if (triedRef.current === urlId) return;
    triedRef.current = urlId;
    const isFreshLoad = sessionId !== urlId;
    if (!token) {
      if (isFreshLoad) router.replace("/");
      return; // logged out: nothing server-side to reconcile with
    }
    if (isFreshLoad) setRestoring(true);
    authApi
      .getConversation(urlId, token)
      .then(async (d) => {
        const serverVersion = typeof d.version === "number" ? d.version : 0;
        if (!isFreshLoad && serverVersion < convVersionRef.current) return;
        const h = await hydrateConversation(d, encKey);
        loadConversation({ ...h, id: urlId });
        if (h.locked) toast.info("Data pribadi terkunci — masukkan kata sandi untuk membukanya.");
      })
      .catch(() => { if (isFreshLoad) router.replace("/"); })
      .finally(() => { if (isFreshLoad) setRestoring(false); });
  }, [mounted, urlId, isNewChat, sessionId, token, encKey, authLoading, router, loadConversation]);

  const goHome = () => {
    router.push("/");
  };

  return (
    <div className="App flex min-h-screen flex-col bg-background text-foreground paper-grain">
      <TopBar onOpenAuth={openAuth} onOpenHistory={openHistory} onGoHome={goHome} onOpenUnlock={() => setShowUnlock(true)} onOpenChangePw={() => setShowChangePw(true)} />
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
