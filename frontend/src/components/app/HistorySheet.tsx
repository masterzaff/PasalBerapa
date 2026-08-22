import React, { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, Trash2, MessageSquareText, Clock, SquarePen } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { authApi } from "@/lib/authApi";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";

export default function HistorySheet({ open, onOpenChange }) {
  const { token } = useAuth();
  const s = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

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
      s.loadConversation({ id, messages: d.messages || [], docName: d.doc_name, piiMapping: d.pii_mapping });
      onOpenChange(false);
      router.push(`/chat/${id}`);
      toast.success("Percakapan dibuka.");
    } catch (e) {
      toast.error(e.message || "Gagal buka percakapan.");
    }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    try {
      await authApi.deleteConversation(id, token);
      setItems((prev) => prev.filter((i) => i.id !== id));
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
              return (
                <button
                  key={it.id}
                  data-testid="history-item"
                  onClick={() => {
                    if (!isActive) {
                      openConv(it.id);
                    } else {
                      onOpenChange(false);
                    }
                  }}
                  className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    isActive
                      ? "border-primary/60 bg-primary/10 text-foreground ring-1 ring-primary/30 shadow-sm cursor-default"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent cursor-pointer"
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
                  <span
                    onClick={(e) => remove(it.id, e)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-[hsl(var(--risk-high-bg))] hover:text-destructive group-hover:opacity-100 cursor-pointer"
                    title="Hapus percakapan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
