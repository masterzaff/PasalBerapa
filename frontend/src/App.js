import "@/App.css";
import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider, useSession } from "@/context/SessionContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ConnectionProvider } from "@/context/ConnectionContext";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { UIProvider } from "@/context/UIContext";
import { authApi } from "@/lib/authApi";
import TopBar from "@/components/app/TopBar";
import Landing from "@/components/app/Landing";
import ChatView from "@/components/app/ChatView";
import AuthPage from "@/components/app/AuthPage";
import HistorySheet from "@/components/app/HistorySheet";

function Shell() {
  const { hasDocument, messages, sessionId, loadConversation } = useSession();
  const { token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId: urlId } = useParams();

  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const started = hasDocument || messages.length > 0;
  const openAuth = () => setShowAuth(true);
  const openHistory = () => setShowHistory(true);

  // 1) Reflect the active session in the URL (so refresh keeps /chat/:id).
  useEffect(() => {
    if (!started) return;
    const target = `/chat/${sessionId}`;
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [started, sessionId, location.pathname, navigate]);

  // 2) If we land on /chat/:id with nothing in memory, try to restore from DB
  //    (for logged-in users). sessionStorage restore already handles refresh
  //    within the same tab; this covers fresh loads / other devices.
  const triedRef = useRef(false);
  const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    if (!urlId || started || authLoading || triedRef.current) return;
    triedRef.current = true;
    if (!token) {
      navigate("/", { replace: true });
      return;
    }
    setRestoring(true);
    authApi
      .getConversation(urlId, token)
      .then((d) => loadConversation({ id: urlId, messages: d.messages || [], docName: d.doc_name }))
      .catch(() => navigate("/", { replace: true }))
      .finally(() => setRestoring(false));
  }, [urlId, started, token, authLoading, navigate, loadConversation]);

  const goHome = () => {
    // kembali ke menu utama (mulai sesi baru) ditangani di TopBar
    navigate("/");
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

export default function App() {
  return (
    <SessionProvider>
      <AuthProvider>
        <ConnectionProvider>
          <AnalysisProvider>
            <UIProvider>
              <TooltipProvider delayDuration={150}>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Shell />} />
                    <Route path="/chat/:sessionId" element={<Shell />} />
                    <Route path="*" element={<Shell />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </UIProvider>
          </AnalysisProvider>
        </ConnectionProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
