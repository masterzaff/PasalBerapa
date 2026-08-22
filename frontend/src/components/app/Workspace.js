import React from "react";
import { FileText, Bot, Gauge, Lock } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DocumentPanel from "@/components/app/DocumentPanel";
import AnalysisPanel from "@/components/app/AnalysisPanel";
import RiskDashboard from "@/components/app/RiskDashboard";
import PrivacyVault from "@/components/app/PrivacyVault";

export default function Workspace({ onOpenSettings }) {
  return (
    <div className="mx-auto max-w-[1400px] px-2 py-3 md:px-4">
      {/* Desktop: 3-panel resizable */}
      <div className="hidden md:block" style={{ height: "calc(100vh - 88px)" }}>
        <ResizablePanelGroup direction="horizontal" className="gap-1">
          <ResizablePanel defaultSize={35} minSize={22}>
            <DocumentPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={26}>
            <AnalysisPanel onOpenSettings={onOpenSettings} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={25} minSize={20}>
            <Tabs defaultValue="risk" className="flex h-full flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="risk" data-testid="tab-risk" className="gap-1.5">
                  <Gauge className="h-3.5 w-3.5" /> Risiko
                </TabsTrigger>
                <TabsTrigger value="vault" data-testid="tab-vault" className="gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Vault
                </TabsTrigger>
              </TabsList>
              <TabsContent value="risk" className="mt-2 min-h-0 flex-1">
                <RiskDashboard />
              </TabsContent>
              <TabsContent value="vault" className="mt-2 min-h-0 flex-1">
                <PrivacyVault onOpenSettings={onOpenSettings} />
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: stacked tabs */}
      <div className="md:hidden" style={{ height: "calc(100vh - 96px)" }}>
        <Tabs defaultValue="chat" className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="doc" className="gap-1 text-xs"><FileText className="h-3.5 w-3.5" /> Dok</TabsTrigger>
            <TabsTrigger value="chat" className="gap-1 text-xs"><Bot className="h-3.5 w-3.5" /> Analisis</TabsTrigger>
            <TabsTrigger value="risk" className="gap-1 text-xs"><Gauge className="h-3.5 w-3.5" /> Risiko</TabsTrigger>
            <TabsTrigger value="vault" className="gap-1 text-xs"><Lock className="h-3.5 w-3.5" /> Vault</TabsTrigger>
          </TabsList>
          <TabsContent value="doc" className="mt-2 min-h-0 flex-1"><DocumentPanel /></TabsContent>
          <TabsContent value="chat" className="mt-2 min-h-0 flex-1"><AnalysisPanel onOpenSettings={onOpenSettings} /></TabsContent>
          <TabsContent value="risk" className="mt-2 min-h-0 flex-1"><RiskDashboard /></TabsContent>
          <TabsContent value="vault" className="mt-2 min-h-0 flex-1"><PrivacyVault onOpenSettings={onOpenSettings} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
