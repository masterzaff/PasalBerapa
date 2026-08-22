import "@/App.css";
import React, { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider, useSession } from "@/context/SessionContext";
import { ConnectionProvider } from "@/context/ConnectionContext";
import TopBar from "@/components/app/TopBar";
import HeroUpload from "@/components/app/HeroUpload";
import Workspace from "@/components/app/Workspace";
import SettingsModal from "@/components/app/SettingsModal";

function Shell() {
  const { hasDocument } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);
  return (
    <div className="App min-h-screen bg-background text-foreground paper-grain">
      <TopBar onOpenSettings={openSettings} />
      <main>
        {hasDocument ? (
          <Workspace onOpenSettings={openSettings} />
        ) : (
          <HeroUpload onOpenSettings={openSettings} />
        )}
      </main>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <ConnectionProvider>
        <TooltipProvider delayDuration={150}>
          <Shell />
        </TooltipProvider>
      </ConnectionProvider>
    </SessionProvider>
  );
}
