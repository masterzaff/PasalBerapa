import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Gauge, Lock, Bot, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ChatComposer from "@/components/app/ChatComposer";
import { Message, TypingBubble } from "@/components/app/ChatMessage";
import DocumentPanel from "@/components/app/DocumentPanel";
import RiskDashboard from "@/components/app/RiskDashboard";
import PrivacyVault from "@/components/app/PrivacyVault";
import { useSession } from "@/context/SessionContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { useUI } from "@/context/UIContext";

function PanelButton({ onClick, icon: Icon, label, count, testId }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} data-testid={testId} className="gap-1.5">
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
      {count > 0 && (
        <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </Button>
  );
}

export default function ChatView() {
  const s = useSession();
  const { busy: analyzing, busyMode } = useAnalysis();
  const ui = useUI();
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [s.messages, analyzing]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <FileCheck2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium">{s.file?.name || "Dokumen"}</span>
            {s.extractInfo && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {s.extractInfo.totalPages} hlm{s.extractInfo.usedOcr ? " · OCR" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <PanelButton onClick={() => ui.openPanel("doc")} icon={FileText} label="Dokumen" testId="open-doc-panel-button" />
            <PanelButton onClick={() => ui.openPanel("risk")} icon={Gauge} label="Risiko" count={s.risks.length} testId="open-risk-panel-button" />
            <PanelButton onClick={() => ui.openPanel("vault")} icon={Lock} label="Vault" count={Object.keys(s.piiMapping || {}).length} testId="open-vault-panel-button" />
          </div>
        </div>
      </div>

      <div ref={feedRef} className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {s.messages.length === 0 && !analyzing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[85%] rounded-2xl border bg-accent px-4 py-3 text-sm leading-6">
                Dokumen <span className="font-medium">{s.file?.name}</span> udah kebaca
                {s.extractInfo ? ` (${s.extractInfo.totalPages} halaman)` : ""}. Mau mulai dari
                mana? Klik salah satu chip di bawah — <b>Bedah Risiko</b>, <b>Ringkas Isi</b>,
                atau <b>Jelaskan Pasal Penting</b> — atau langsung ketik pertanyaanmu.
              </div>
            </motion.div>
          )}

          {s.messages.map((m) => (
            <Message key={m.id} m={m} />
          ))}

          {analyzing && (
            <div className="flex gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="mb-0.5 text-[11px] text-muted-foreground">
                  PasalBerapa? {busyMode ? `· ${busyMode === "key_articles" ? "Jelaskan Pasal" : busyMode}` : ""}
                </div>
                <TypingBubble />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <ChatComposer variant="docked" />
        </div>
      </div>

      <Sheet open={ui.panelOpen} onOpenChange={ui.setPanelOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-xl md:max-w-2xl">
          <SheetTitle className="sr-only">Panel Dokumen, Risiko, dan Vault</SheetTitle>
          <Tabs value={ui.panelTab} onValueChange={ui.setPanelTab} className="flex h-full flex-col p-3 pt-12">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="doc" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Dokumen</TabsTrigger>
              <TabsTrigger value="risk" className="gap-1.5"><Gauge className="h-3.5 w-3.5" /> Risiko</TabsTrigger>
              <TabsTrigger value="vault" className="gap-1.5"><Lock className="h-3.5 w-3.5" /> Vault</TabsTrigger>
            </TabsList>
            <TabsContent value="doc" className="mt-2 min-h-0 flex-1">
              <DocumentPanel />
            </TabsContent>
            <TabsContent value="risk" className="mt-2 min-h-0 flex-1">
              <RiskDashboard
                onViewInDoc={(ex) => {
                  s.setHighlightExcerpt(ex);
                  ui.setPanelTab("doc");
                }}
              />
            </TabsContent>
            <TabsContent value="vault" className="mt-2 min-h-0 flex-1">
              <PrivacyVault />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
