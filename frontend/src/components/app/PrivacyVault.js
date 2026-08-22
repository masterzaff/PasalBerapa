import React, { useState } from "react";
import { Lock, Copy, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { tagTypeFromTag, tagTypeLabel } from "@/lib/pii";
import EmptyState from "@/components/app/EmptyState";

export default function PrivacyVault() {
  const { piiMapping } = useSession();
  const [reveal, setReveal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const entries = Object.entries(piiMapping || {});

  const copyTag = async (tag) => {
    await navigator.clipboard.writeText(tag);
    toast.success(`Tag ${tag} disalin.`);
  };

  const onToggle = (val) => {
    if (val) setConfirmOpen(true);
    else setReveal(false);
  };

  return (
    <Card data-testid="privacy-vault-panel" className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[hsl(var(--vault))]" />
          <span className="text-sm font-semibold">Privacy Vault</span>
          {entries.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{entries.length} item</Badge>
          )}
        </div>
        {entries.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Data asli
            <Switch
              data-testid="privacy-vault-reveal-toggle"
              checked={reveal}
              onCheckedChange={onToggle}
            />
          </label>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 p-4">
          <EmptyState
            icon={ShieldCheck}
            title="Belum ada yang disamarin"
            description="Jalankan analisis — data sensitif bakal otomatis dimasking & muncul di sini."
            testId="vault-empty-state"
          />
        </div>
      ) : (
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
          <table data-testid="privacy-vault-table" className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Tag</th>
                <th className="px-2 py-2">Jenis</th>
                <th className="px-2 py-2">Nilai Asli</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map(([tag, value]) => (
                <tr key={tag} className="border-t hover:bg-muted/40">
                  <td className="px-2 py-2">
                    <span className="tag-chip">{tag}</span>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {tagTypeLabel(tagTypeFromTag(tag))}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={
                        reveal
                          ? ""
                          : "select-none blur-sm transition-[filter] duration-200 hover:blur-none"
                      }
                    >
                      {value}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyTag(tag)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 px-2 text-[11px] leading-relaxed text-muted-foreground">
            Mapping ini cuma ada di browser kamu &amp; hilang begitu halaman di-refresh.
            LLM cuma nerima tag, bukan data aslinya.
          </p>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tampilin data asli?</AlertDialogTitle>
            <AlertDialogDescription>
              Nilai asli (nama, NIK, dll) bakal keliatan di layar. Pastikan lagi nggak
              ada yang ngintip atau kamu lagi share screen ya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReveal(false)}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => setReveal(true)}>Ya, tampilin</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
