import "@/App.css";
import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider, useSession } from "@/context/SessionContext";
import { ConnectionProvider } from "@/context/ConnectionContext";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { UIProvider } from "@/context/UIContext";
import TopBar from "@/components/app/TopBar";
import Landing from "@/components/app/Landing";
import ChatView from "@/components/app/ChatView";

function Shell() {
  const { hasDocument, messages } = useSession();
  const started = hasDocument || messages.length > 0;
  return (
    <div className="App flex min-h-screen flex-col bg-background text-foreground paper-grain">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col">
        {started ? <ChatView /> : <Landing />}
      </main>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <ConnectionProvider>
        <AnalysisProvider>
          <UIProvider>
            <TooltipProvider delayDuration={150}>
              <Shell />
            </TooltipProvider>
          </UIProvider>
        </AnalysisProvider>
      </ConnectionProvider>
    </SessionProvider>
  );
}
