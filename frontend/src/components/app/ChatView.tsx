import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileText, Gauge, Lock, Bot, FileCheck2, Scale, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ChatComposer from "@/components/app/ChatComposer";
import { Message, TypingBubble } from "@/components/app/ChatMessage";
import DocumentPanel from "@/components/app/DocumentPanel";
import RiskDashboard from "@/components/app/RiskDashboard";
import PrivacyVault from "@/components/app/PrivacyVault";
import { useSession } from "@/context/SessionContext";
import { useAnalysis, MODE_LABELS } from "@/context/AnalysisContext";
import { useUI } from "@/context/UIContext";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/authApi";

function PanelButton({ onClick, icon: Icon, label, count, testId }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} data-testid={testId} className="gap-1.5">
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
      {count > 0 && (
        <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{count}</span>
      )}
    </Button>
  );
}

export default function ChatView({ onOpenAuth }) {
  const s = useSession();
  const { busy: analyzing, busyMode, busyMessageId } = useAnalysis();
  const ui = useUI();
  const { user, token } = useAuth();
  const router = useRouter();
  const feedRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renamingBusy, setRenamingBusy] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const { convId, setConvId, convTitle, setConvTitle } = s;

  // Stick to the bottom only when the user is already there. Scrolling back up
  // to re-read an earlier answer used to get yanked to the bottom by the next
  // render (including every typing-indicator toggle).
  const stickToBottomRef = useRef(true);
  const onFeedScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [s.messages, analyzing]);

  const firstUserMsg = s.messages.find((m) => m.role === "user");
  const headerTitle =
    convTitle ||
    s.file?.name ||
    (firstUserMsg && firstUserMsg.content ? firstUserMsg.content.slice(0, 50) : null) ||
    "Obrolan hukum";

  const openRename = () => {
    if (!user) { onOpenAuth(); return; }
    setRenameValue(headerTitle);
    setRenaming(true);
  };

  const submitRename = async (e) => {
    e?.preventDefault?.();
    const title = renameValue.trim();
    if (!title || !convId) return;
    setRenamingBusy(true);
    try {
      await authApi.renameConversation(convId, title, token);
      setConvTitle(title);
      setRenaming(false);
      toast.success("Judul diganti.");
    } catch (e) {
      toast.error(e.message || "Gagal ganti judul.");
    } finally {
      setRenamingBusy(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    try {
      if (convId) await authApi.deleteConversation(convId, token);
      toast.success("Percakapan dihapus.");
    } catch (e) {
      toast.error(e.message || "Gagal hapus.");
    } finally {
      setConvId(null);
      setConvTitle(null);
      s.resetSession();
      router.push("/");
    }
  };

  // hasDocument is rawText-only (it gates the PII review, which needs the
  // original). Panels care about whether there is any document to show at all.
  const hasAnyDocument = s.hasDocument || Boolean(s.maskedText && s.maskedText.trim());
  const vaultCount = Object.keys(s.piiMapping || {}).length;

  const isFreshNewChat = !s.hasDocument && s.messages.length === 0 && !analyzing;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!isFreshNewChat && (
        <div className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              {hasAnyDocument ? (
                <FileCheck2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Scale className="h-4 w-4 shrink-0 text-primary" />
              )}
              <span className="truncate font-medium" data-testid="conversation-title">{headerTitle}</span>
              {s.hasDocument && s.extractInfo && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {s.extractInfo.totalPages} hlm{s.extractInfo.usedOcr ? " · OCR" : ""}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="manage-conversation-button"
                    disabled={s.messages.length === 0}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={openRename} data-testid="menu-rename">
                    <Pencil className="mr-2 h-4 w-4" /> Ganti judul
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => (user ? setConfirmDelete(true) : onOpenAuth())}
                    data-testid="menu-delete"
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Gate on the MASKED document too, not just the raw one: a
                  restored conversation has no rawText by design, but it does
                  have masked_text and a decrypted mapping, so Dokumen and Vault
                  are both meaningful there and used to vanish. Risiko is gated
                  on actual risks — they aren't persisted, and an empty
                  dashboard reads as broken rather than as "not run yet". */}
              {hasAnyDocument && (
                <>
                  <PanelButton onClick={() => ui.openPanel("doc")} icon={FileText} label="Dokumen" testId="open-doc-panel-button" />
                  {s.risks.length > 0 && (
                    <PanelButton onClick={() => ui.openPanel("risk")} icon={Gauge} label="Risiko" count={s.risks.length} testId="open-risk-panel-button" />
                  )}
                  {vaultCount > 0 && (
                    <PanelButton onClick={() => ui.openPanel("vault")} icon={Lock} label="Vault" count={vaultCount} testId="open-vault-panel-button" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isFreshNewChat ? (
        <div className="flex flex-1 flex-col items-center justify-start pt-12 sm:pt-16 md:pt-20 pb-12 px-4">
          <div className="w-full max-w-2xl text-center space-y-6">
            <div className="space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-sm">
                <Scale className="h-6 w-6" />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
                Mulai Percakapan Baru
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Tanyakan pasal hukum, upload draf kontrak untuk di-audit, atau konsultasikan klausul bisnis Anda.
              </p>
            </div>

            <div className="w-full text-left">
              <ChatComposer variant="hero" autoFocus onOpenAuth={onOpenAuth} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={feedRef} onScroll={onFeedScroll} className="scroll-slim min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {s.hasDocument && s.messages.length === 0 && !analyzing && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl border bg-accent px-4 py-3 text-sm leading-6">
                    Dokumen <span className="font-medium">{s.file?.name}</span> udah kebaca
                    {s.extractInfo ? ` (${s.extractInfo.totalPages} halaman)` : ""}. Mau mulai dari mana?
                    Klik chip di bawah — <b>Bedah Risiko</b>, <b>Ringkas Isi</b>, atau <b>Jelaskan Pasal Penting</b> — atau ketik pertanyaanmu.
                  </div>
                </motion.div>
              )}

              {s.messages.map((m) => (
                <Message key={m.id} m={m} />
              ))}

              {analyzing && !busyMessageId && (
                <div className="flex gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="mb-0.5 text-[11px] text-muted-foreground">
                      PasalBerapa?
                      {busyMode ? ` · ${busyMode === "masking" ? "Menyensor data pribadi" : MODE_LABELS[busyMode] || busyMode}` : ""}
                    </div>
                    <TypingBubble />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-30 border-t bg-background/80 backdrop-blur">
            <div className="mx-auto max-w-3xl px-4 py-3">
              <ChatComposer variant="docked" autoFocus onOpenAuth={onOpenAuth} />
            </div>
          </div>
        </>
      )}

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Ganti judul percakapan</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitRename} className="space-y-3">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={140}
              placeholder="Judul percakapan"
              data-testid="rename-input"
            />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setRenaming(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={!renameValue.trim() || renamingBusy} data-testid="rename-submit">
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus percakapan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              “{headerTitle}” bakal dihapus permanen, termasuk semua pesannya. Nggak bisa dibalikin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              data-testid="confirm-delete-conversation"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={ui.panelOpen} onOpenChange={ui.setPanelOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-xl md:max-w-2xl">
          <SheetTitle className="sr-only">Panel Dokumen, Risiko, dan Vault</SheetTitle>
          <Tabs value={ui.panelTab} onValueChange={ui.setPanelTab} className="flex h-full flex-col p-3 pt-12">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="doc" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Dokumen</TabsTrigger>
              <TabsTrigger value="risk" className="gap-1.5"><Gauge className="h-3.5 w-3.5" /> Risiko</TabsTrigger>
              <TabsTrigger value="vault" className="gap-1.5"><Lock className="h-3.5 w-3.5" /> Vault</TabsTrigger>
            </TabsList>
            <TabsContent value="doc" className="mt-2 min-h-0 flex-1"><DocumentPanel /></TabsContent>
            <TabsContent value="risk" className="mt-2 min-h-0 flex-1">
              <RiskDashboard onViewInDoc={(ex) => { s.setHighlightExcerpt(ex); ui.setPanelTab("doc"); }} />
            </TabsContent>
            <TabsContent value="vault" className="mt-2 min-h-0 flex-1"><PrivacyVault /></TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
