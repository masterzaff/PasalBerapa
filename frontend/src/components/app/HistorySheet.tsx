import React, { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, Trash2, MessageSquareText, Clock, SquarePen } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { authApi } from "@/lib/authApi";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import { hydrateConversation } from "@/lib/conversation";

export default function HistorySheet({ open, onOpenChange }) {
  const { token, encKey } = useAuth();
  const s = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const d = await authApi.listConversations(token);
      setItems(d.items || []);
    } catch (e) {
      toast.error(e.message || "Gagal ambil riwayat.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const startNewChat = () => {
    s.resetSession();
    onOpenChange(false);
    router.push("/chat/new");
  };

  const openConv = async (id) => {
    try {
      const d = await authApi.getConversation(id, token);
      const h = await hydrateConversation(d, encKey);
      s.loadConversation({ ...h, id });
      onOpenChange(false);
      router.push(`/chat/${id}`);
      if (h.locked) toast.info("Data pribadi terkunci — masukkan kata sandi untuk membukanya.");
      else toast.success("Percakapan dibuka.");
    } catch (e) {
      toast.error(e.message || "Gagal buka percakapan.");
    }
  };

  const remove = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await authApi.deleteConversation(target.id, token);
      setItems((prev) => prev.filter((i) => i.id !== target.id));
      // Deleting the conversation you're currently looking at has to clear it
      // from view too, otherwise autosave immediately re-creates it.
      if (target.id === s.convId || target.id === s.sessionId) {
        s.resetSession();
        router.push("/chat/new");
        onOpenChange(false);
      }
      toast.success("Percakapan dihapus.");
    } catch (err) {
      toast.error(err.message || "Gagal hapus.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Riwayat Percakapan</SheetTitle>
          <SheetDescription>Percakapan yang kamu simpan — private, cuma kamu yang bisa lihat.</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <Button
            data-testid="history-new-chat-button"
            onClick={startNewChat}
            className="w-full justify-center gap-2 shadow-sm font-medium"
          >
            <SquarePen className="h-4 w-4" />
            <span>Percakapan Baru</span>
          </Button>
        </div>

        <div className="scroll-slim mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <MessageSquareText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Belum ada percakapan tersimpan.</p>
            </div>
          ) : (
            items.map((it) => {
              const isActive = it.id === s.convId || it.id === s.sessionId || pathname === `/chat/${it.id}`;
              // Two sibling buttons, not a button nested inside a button —
              // nested interactive elements are invalid HTML and leave the
              // delete control unreachable by keyboard.
              return (
                <div
                  key={it.id}
                  className={`group flex w-full items-center gap-1 rounded-xl border pr-2 transition-all ${
                    isActive
                      ? "border-primary/60 bg-primary/10 text-foreground ring-1 ring-primary/30 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  <button
                    type="button"
                    data-testid="history-item"
                    onClick={() => (isActive ? onOpenChange(false) : openConv(it.id))}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive ? "cursor-default" : "cursor-pointer"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isActive ? "bg-primary text-primary-foreground" : "bg-accent text-primary"}`}>
                      <MessageSquareText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.title}</p>
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        {it.count} pesan{it.doc_name ? ` · ${it.doc_name}` : ""}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(it)}
                    data-testid="history-item-delete"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-opacity hover:bg-[hsl(var(--risk-high-bg))] hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100"
                    title="Hapus percakapan"
                    aria-label={`Hapus percakapan ${it.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus percakapan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” bakal dihapus permanen, termasuk semua pesannya. Nggak bisa dibalikin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              data-testid="confirm-delete-history-item"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
