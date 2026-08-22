import "@/App.css";
import React, { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider, useSession } from "@/context/SessionContext";
import { AuthProvider } from "@/context/AuthContext";
import { ConnectionProvider } from "@/context/ConnectionContext";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { UIProvider } from "@/context/UIContext";
import TopBar from "@/components/app/TopBar";
import Landing from "@/components/app/Landing";
import ChatView from "@/components/app/ChatView";
import AuthPage from "@/components/app/AuthPage";
import HistorySheet from "@/components/app/HistorySheet";

function Shell() {
  const { hasDocument, messages } = useSession();
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const started = hasDocument || messages.length > 0;
  const openAuth = () => setShowAuth(true);
  const openHistory = () => setShowHistory(true);
  return (
    <div className="App flex min-h-screen flex-col bg-background text-foreground paper-grain">
      <TopBar onOpenAuth={openAuth} onOpenHistory={openHistory} />
      <main className="flex min-h-0 flex-1 flex-col">
        {started ? (
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
                <Shell />
              </TooltipProvider>
            </UIProvider>
          </AnalysisProvider>
        </ConnectionProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
