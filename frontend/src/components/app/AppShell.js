"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/authApi";
import TopBar from "@/components/app/TopBar";
import Landing from "@/components/app/Landing";
import ChatView from "@/components/app/ChatView";
import AuthPage from "@/components/app/AuthPage";
import HistorySheet from "@/components/app/HistorySheet";

export default function AppShell({ sessionId: urlId }) {
  const { hasDocument, messages, sessionId, loadConversation } = useSession();
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const started = hasDocument || messages.length > 0;
  const openAuth = () => setShowAuth(true);
  const openHistory = () => setShowHistory(true);

  // 1) Reflect the active session in the URL (so refresh keeps /chat/:id).
  useEffect(() => {
    if (!started) return;
    const target = `/chat/${sessionId}`;
    if (pathname !== target) {
      router.replace(target);
    }
  }, [started, sessionId, pathname, router]);

  // 2) If we land on /chat/:id with nothing in memory, try to restore from DB
  const triedRef = useRef(false);
  const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    if (!urlId || started || authLoading || triedRef.current) return;
    triedRef.current = true;
    if (!token) {
      router.replace("/");
      return;
    }
    setRestoring(true);
    authApi
      .getConversation(urlId, token)
      .then((d) => loadConversation({ id: urlId, messages: d.messages || [], docName: d.doc_name }))
      .catch(() => router.replace("/"))
      .finally(() => setRestoring(false));
  }, [urlId, started, token, authLoading, router, loadConversation]);

  const goHome = () => {
    router.push("/");
  };

  return (
    <div className="App flex min-h-screen flex-col bg-background text-foreground paper-grain">
      <TopBar onOpenAuth={openAuth} onOpenHistory={openHistory} onGoHome={goHome} />
      <main className="flex min-h-0 flex-1 flex-col">
        {started || restoring ? (
          <ChatView onOpenAuth={openAuth} onOpenHistory={openHistory} />
        ) : (
          <Landing onOpenAuth={openAuth} />
        )}
      </main>
      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}
      <HistorySheet open={showHistory} onOpenChange={setShowHistory} />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
