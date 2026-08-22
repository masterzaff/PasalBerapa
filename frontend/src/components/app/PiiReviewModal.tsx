"use client";

import React, { useState, useEffect } from "react";
import { Shield, Lock, Trash2, Plus, Check, Eye, EyeOff, AlertTriangle, Sparkles, FileText, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { tagTypeFromTag, tagTypeLabel, remaskText } from "@/lib/pii";

interface PiiReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PiiReviewModal({ open, onOpenChange }: PiiReviewModalProps) {
  const s = useSession();
  const { runPending } = useAnalysis();

  // Local state for interactive editing before approving
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState("");
  const [customType, setCustomType] = useState("CUSTOM");
  const [activeTab, setActiveTab] = useState("list");

  // Synchronize with session state when modal opens
  useEffect(() => {
    if (open) {
      setMapping(s.piiMapping && Object.keys(s.piiMapping).length > 0 ? { ...s.piiMapping } : {});
      setCustomText("");
    }
  }, [open, s.piiMapping]);

  const entries = Object.entries(mapping);

  // Remove a specific mapping entry
  const handleRemove = (tag: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[tag];
      return next;
    });
    toast.info(`Sensor tag ${tag} dihapus.`);
  };

  // Add a new custom keyword to mask
  const handleAddCustom = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = customText.trim();
    if (!text) return;

    // Check if already mapped
    const existingTag = Object.entries(mapping).find(([_, v]) => v.toLowerCase() === text.toLowerCase());
    if (existingTag) {
      toast.warning(`Kata "${text}" sudah disamarkan dengan tag ${existingTag[0]}`);
      return;
    }

    const nextIndex = entries.length + 1;
    const cleanType = (customType || "CUSTOM").toUpperCase();
    const newTag = `<${cleanType}_${nextIndex}>`;

    setMapping((prev) => ({
      ...prev,
      [newTag]: text,
    }));

    setCustomText("");
    toast.success(`Berhasil menambahkan sensor untuk "${text}"`);
  };

  // Compute live masked text preview
  const liveMaskedText = remaskText(s.rawText || "", mapping);

  // Approve & Proceed
  const handleConfirm = () => {
    s.setPiiMapping(mapping);
    s.setMaskedText(liveMaskedText);
    s.setPiiConfirmed(true);
    onOpenChange(false);
    toast.success(`Penyamaran disetujui (${Object.keys(mapping).length} data disensor).`);
    runPending();
  };

  // Skip / Unmask
  const handleSkip = () => {
    s.setPiiMapping({});
    s.setMaskedText(s.rawText || "");
    s.setPiiConfirmed(true);
    onOpenChange(false);
    toast.warning("Melanjutkan tanpa penyamaran PII.");
    runPending();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span>Human-In-The-Loop Privacy Layer</span>
          </div>
          <DialogTitle className="font-display text-xl font-semibold flex items-center justify-between gap-2 mt-1">
            <span>Tinjau Penyamaran Data Pribadi</span>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              {entries.length} Item Terdeteksi
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Data di bawah ini akan disamarkan menjadi token anonim sebelum dikirim ke AI. Anda dapat menambah atau menghapus kata sensor sesuai kebutuhan.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-3 border-b bg-background shrink-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list" className="gap-2 text-xs">
                <Lock className="h-3.5 w-3.5" />
                Daftar Sensor ({entries.length})
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2 text-xs">
                <Eye className="h-3.5 w-3.5" />
                Pratinjau Teks Bersensor
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: List & Add Sensor */}
          <TabsContent value="list" className="flex-1 min-h-0 flex flex-col p-5 space-y-4 m-0 overflow-y-auto">
            {/* Form Tambah Manual */}
            <form onSubmit={handleAddCustom} className="flex items-center gap-2 p-2.5 rounded-xl border bg-muted/30 shrink-0">
              <Input
                placeholder="Tambah kata/nama rahasia lain untuk disamarkan…"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="text-xs h-9 bg-background"
              />
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="h-9 px-2.5 rounded-md border text-xs bg-background text-foreground shrink-0 focus-visible:ring-2"
              >
                <option value="PERSON">Nama (PERSON)</option>
                <option value="ORG">Perusahaan / PT</option>
                <option value="MONEY">Nominal Uang</option>
                <option value="ACCOUNT">No. Rekening</option>
                <option value="CUSTOM">Data Kustom</option>
              </select>
              <Button type="submit" size="sm" className="h-9 gap-1 text-xs shrink-0" disabled={!customText.trim()}>
                <Plus className="h-3.5 w-3.5" />
                Tambah
              </Button>
            </form>

            {/* List of Detected Entities */}
            <div className="flex-1 min-h-[220px] rounded-xl border bg-card overflow-hidden flex flex-col">
              {entries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Shield className="h-8 w-8 mb-2 opacity-40 text-emerald-600" />
                  <p className="text-sm font-medium">Tidak ada data sensitif yang disamarkan</p>
                  <p className="text-xs mt-1 max-w-sm">
                    Gunakan kolom di atas jika ingin menyamarkan kata kunci atau nama entitas tertentu.
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto flex-1 divide-y">
                  {entries.map(([tag, value]) => {
                    const type = tagTypeFromTag(tag);
                    const label = tagTypeLabel(type);
                    return (
                      <div key={tag} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0 border border-primary/20">
                            {tag}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                            ({label})
                          </span>
                          <span className="text-xs font-medium text-foreground truncate">
                            {value}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(tag)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          title="Hapus / Jangan samarkan data ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              💡 <strong>Tips Privasi</strong>: Nilai asli di atas hanya tersimpan di memori browser Anda dan <strong>tidak pernah dikirim ke LLM</strong>.
            </p>
          </TabsContent>

          {/* TAB 2: Live Masked Preview */}
          <TabsContent value="preview" className="flex-1 min-h-0 p-5 m-0 overflow-y-auto">
            <div className="rounded-xl border bg-muted/20 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text text-foreground/90 max-h-[380px] overflow-y-auto">
              {liveMaskedText || "Tidak ada teks dokumen."}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              Ini adalah teks eksak yang akan dikirim ke LLM untuk proses analisis hukum.
            </p>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/30 flex items-center justify-between gap-2 sm:justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Lewati Penyamaran
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <Check className="h-4 w-4" />
              Setujui &amp; Lanjutkan Analisis
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
