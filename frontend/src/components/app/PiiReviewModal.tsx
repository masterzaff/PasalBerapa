"use client";

import React, { useState, useEffect, useRef } from "react";
import { Shield, Lock, Trash2, Plus, Check, Eye, EyeOff, AlertTriangle, Sparkles, FileText, ArrowRight, Merge, X } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { tagTypeFromTag, tagTypeLabel, parseTag, remaskText, unmaskText, TAG_REGEX } from "@/lib/pii";

interface PiiReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PiiReviewModal({ open, onOpenChange }: PiiReviewModalProps) {
  const s = useSession();
  const { runPending, cancelPending } = useAnalysis();

  // Closing without approving/skipping abandons the queued analysis. Route every
  // dismissal (Batal, Esc, overlay click) through cancelPending so the pending
  // action is dropped and the typed question is handed back to the composer.
  const dismiss = () => {
    cancelPending();
    onOpenChange(false);
  };

  // Local state for interactive editing before approving
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState("");
  const [customType, setCustomType] = useState("CUSTOM");
  const [activeTab, setActiveTab] = useState("list");
  // Tags picked to be merged as "same entity, different spelling" —
  // e.g. "Budi Santoso" and "Pak Budi" get retagged <PERSON_1a>/<PERSON_1b>
  // so the LLM (and the human reading the vault) treats them as one person.
  const [groupSelection, setGroupSelection] = useState<string[]>([]);

  // State for floating pop-up on text selection in the preview tab
  const [selectedText, setSelectedText] = useState("");
  const [selectedTextType, setSelectedTextType] = useState("PERSON");
  const [selectionPopupPos, setSelectionPopupPos] = useState<{ top: number; left: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);

  // Synchronize with session state when modal opens
  useEffect(() => {
    if (open) {
      setMapping(s.piiMapping && Object.keys(s.piiMapping).length > 0 ? { ...s.piiMapping } : {});
      setCustomText("");
      setGroupSelection([]);
      setSelectionPopupPos(null);
      setSelectedText("");
    }
  }, [open, s.piiMapping]);

  // Clear selection popup when active tab changes
  useEffect(() => {
    setSelectionPopupPos(null);
    setSelectedText("");
  }, [activeTab]);

  // Dismiss popup if user clicks outside of the preview wrapper
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (previewWrapperRef.current && !previewWrapperRef.current.contains(e.target as Node)) {
        setSelectionPopupPos(null);
        setSelectedText("");
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  const entries = Object.entries(mapping);

  const toggleGroupSelect = (tag: string) => {
    setGroupSelection((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  // Re-tag the selected entries to share one base number with distinct letter
  // suffixes (<PERSON_1a>, <PERSON_1b>, …) — same convention parseTag() and
  // the LLM system prompt already understand. Values stay as-is: each variant
  // is still its own literal string in the document that needs its own
  // redaction, they just now read as one entity instead of unrelated ones.
  const handleGroupVariants = () => {
    if (groupSelection.length < 2) return;
    const types = new Set(groupSelection.map((t) => tagTypeFromTag(t)));
    if (types.size > 1) {
      toast.error("Cuma bisa gabungin tag dengan jenis yang sama (mis. semua Nama).");
      return;
    }
    const type = [...types][0];
    const parsed = groupSelection.map((t) => parseTag(t)).filter(Boolean);
    const baseNum = Math.min(...parsed.map((p) => p.num));
    const untouched = new Set(Object.keys(mapping).filter((t) => !groupSelection.includes(t)));

    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    let li = 0;
    const nextFreeTag = () => {
      while (li < letters.length) {
        const candidate = `<${type}_${baseNum}${letters[li]}>`;
        li += 1;
        if (!untouched.has(candidate)) return candidate;
      }
      return `<${type}_${baseNum}${Date.now().toString(36)}>`; // pathological fallback
    };

    setMapping((prev) => {
      const next = { ...prev };
      // Sort so the lowest/oldest tag keeps letter "a" — stable, predictable.
      const ordered = [...groupSelection].sort((a, b) => {
        const pa = parseTag(a), pb = parseTag(b);
        return pa.num - pb.num || pa.letter.localeCompare(pb.letter);
      });
      for (const oldTag of ordered) {
        const value = next[oldTag];
        delete next[oldTag];
        next[nextFreeTag()] = value;
      }
      return next;
    });
    setGroupSelection([]);
    toast.success(`${groupSelection.length} tag digabung sebagai satu entitas.`);
  };

  // Remove a specific mapping entry
  const handleRemove = (tag: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[tag];
      return next;
    });
    setGroupSelection((prev) => prev.filter((t) => t !== tag));
    toast.info(`Sensor tag ${tag} dihapus.`);
  };

  // Helper to compute the next available numeric tag for an entity type,
  // taking into account both simple tags (<PERSON_1>) and grouped variants (<PERSON_1a>, <PERSON_1b>).
  const getNextEntityTag = (type: string) => {
    const cleanType = (type || "CUSTOM").toUpperCase();
    const usedNumbers = new Set<number>();

    for (const tag of Object.keys(mapping)) {
      const parsed = parseTag(tag);
      if (parsed && parsed.type === cleanType) {
        usedNumbers.add(parsed.num);
      }
    }

    let nextIndex = 1;
    while (usedNumbers.has(nextIndex) || Object.prototype.hasOwnProperty.call(mapping, `<${cleanType}_${nextIndex}>`)) {
      nextIndex += 1;
    }
    return `<${cleanType}_${nextIndex}>`;
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

    const newTag = getNextEntityTag(customType);

    setMapping((prev) => ({
      ...prev,
      [newTag]: text,
    }));

    setCustomText("");
    toast.success(`Berhasil menambahkan sensor untuk "${text}"`);
  };

  // Detect text selection inside the preview tab
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !previewRef.current || !previewWrapperRef.current) {
      return;
    }

    if (!previewRef.current.contains(selection.anchorNode) || !previewRef.current.contains(selection.focusNode)) {
      return;
    }

    const raw = selection.toString().trim();
    if (!raw || raw.length > 300) {
      return;
    }

    // Ignore if selection is already a tag like <PERSON_1>
    if (/^<[A-Z_]+_\d+[a-z]?>$/.test(raw)) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const wrapperRect = previewWrapperRef.current.getBoundingClientRect();

    const popupWidth = 320;
    const popupHeight = 115;
    const relLeft = rect.left - wrapperRect.left + rect.width / 2 - popupWidth / 2;
    const clampedLeft = Math.max(10, Math.min(relLeft, wrapperRect.width - popupWidth - 10));

    let topPos = rect.top - wrapperRect.top - popupHeight - 8;
    if (topPos < 10) {
      topPos = rect.bottom - wrapperRect.top + 8;
    }

    setSelectedText(raw);
    setSelectionPopupPos({ top: topPos, left: clampedLeft });
  };

  // Add selected text as a new sensor entity
  const handleAddSelectedAsSensor = (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const text = selectedText.trim();
    if (!text) return;

    const existingTag = Object.entries(mapping).find(([_, v]) => v.toLowerCase() === text.toLowerCase());
    if (existingTag) {
      toast.warning(`Kata "${text}" sudah disamarkan dengan tag ${existingTag[0]}`);
      setSelectionPopupPos(null);
      setSelectedText("");
      window.getSelection()?.removeAllRanges();
      return;
    }

    const newTag = getNextEntityTag(selectedTextType);

    setMapping((prev) => ({
      ...prev,
      [newTag]: text,
    }));

    setSelectionPopupPos(null);
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
    toast.success(`Berhasil menambahkan sensor untuk "${text}" (${newTag})`);
  };

  // Close floating selection popup
  const handleClosePopup = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSelectionPopupPos(null);
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  };

  // Compute live masked text preview
  const baseText = s.rawText || unmaskText(s.maskedText || "", s.piiMapping);
  const liveMaskedText = remaskText(baseText, mapping);

  // Helper to render masked text with non-selectable, distinct entity chips
  // so dragging the mouse selects only the unmasked words easily.
  const renderMaskedPreview = (text: string) => {
    if (!text) return "Tidak ada teks dokumen.";
    const re = new RegExp(TAG_REGEX.source, "g");
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        nodes.push(
          <span key={key++} className="select-text">
            {text.slice(last, m.index)}
          </span>
        );
      }
      const tag = m[0];
      const type = tagTypeFromTag(tag);
      const label = tagTypeLabel(type);
      nodes.push(
        <span
          key={key++}
          className="select-none pointer-events-none inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 align-baseline shadow-xs"
          title={`${tag} (${label}) - Entitas sensor`}
        >
          <Lock className="inline h-2.5 w-2.5 opacity-70 shrink-0" />
          <span>{tag}</span>
        </span>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      nodes.push(
        <span key={key++} className="select-text">
          {text.slice(last)}
        </span>
      );
    }
    return nodes;
  };

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
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : dismiss())}>
      <DialogContent className="max-w-2xl w-full h-[85vh] max-h-[620px] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span>Human-In-The-Loop Privacy Layer</span>
          </div>
          <DialogTitle className="font-display text-lg font-semibold flex items-center justify-between gap-2 mt-1">
            <span>Tinjau Penyamaran Data Pribadi</span>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              {entries.length} Item Terdeteksi
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Data di bawah ini akan disamarkan menjadi token anonim sebelum dikirim ke AI. Anda dapat menambah atau menghapus kata sensor sesuai kebutuhan.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-5 py-2.5 border-b bg-muted/20 shrink-0">
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
          <TabsContent
            value="list"
            className="flex-1 min-h-0 data-[state=active]:flex data-[state=inactive]:hidden flex-col p-5 gap-3.5 m-0 overflow-hidden"
          >
            {/* Top Toolbar: Form Tambah Manual by default, replaced by Bulk Merge/Hint bar when 1+ selected */}
            {groupSelection.length === 0 ? (
              <form onSubmit={handleAddCustom} className="flex items-center gap-2 p-2 rounded-xl border bg-muted/30 shrink-0 animate-in fade-in duration-150">
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
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2 shrink-0 animate-in fade-in duration-150 min-h-[46px]">
                <div className="flex items-center gap-2 text-xs text-foreground min-w-0 pl-1">
                  <Merge className="h-3.5 w-3.5 text-primary shrink-0" />
                  {groupSelection.length === 1 ? (
                    <span className="truncate">
                      <strong>1 tag dipilih</strong> — pilih 2 atau lebih item untuk menggabungkan.
                    </span>
                  ) : (
                    <span className="truncate">
                      <strong>{groupSelection.length} tag dipilih</strong> — anggap sebagai satu entitas yang sama?
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setGroupSelection([])}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-medium"
                    onClick={handleGroupVariants}
                    disabled={groupSelection.length < 2}
                  >
                    <Merge className="h-3.5 w-3.5" />
                    Gabungkan
                  </Button>
                </div>
              </div>
            )}

            {/* List of Detected Entities */}
            <div className="flex-1 min-h-0 rounded-xl border bg-card overflow-hidden flex flex-col">
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
                    const parsed = parseTag(tag);
                    const isGrouped = Boolean(
                      parsed && entries.some(([t]) => t !== tag && parseTag(t)?.type === parsed.type && parseTag(t)?.num === parsed.num)
                    );
                    return (
                      <div key={tag} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={groupSelection.includes(tag)}
                            onCheckedChange={() => toggleGroupSelect(tag)}
                            className="shrink-0"
                            aria-label={`Pilih ${tag} untuk digabung`}
                          />
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0 border border-primary/20">
                            {tag}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                            ({label})
                          </span>
                          {isGrouped && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground shrink-0"
                              title="Ditandai sebagai entitas yang sama dengan tag lain bernomor sama"
                            >
                              varian
                            </span>
                          )}
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

            <p className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Data dienkripsi menggunakan kunci Anda — bahkan kami tidak dapat melihatnya.</span>
            </p>
          </TabsContent>

          {/* TAB 2: Live Masked Preview */}
          <TabsContent
            value="preview"
            className="flex-1 min-h-0 data-[state=active]:flex data-[state=inactive]:hidden flex-col p-5 gap-3 m-0 overflow-hidden"
          >
            <div ref={previewWrapperRef} className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Floating Sensor Popup */}
              {selectionPopupPos && selectedText && (
                <div
                  style={{ top: `${selectionPopupPos.top}px`, left: `${selectionPopupPos.left}px` }}
                  className="absolute z-50 w-[320px] rounded-xl border border-emerald-500/40 bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-md p-3 ring-1 ring-emerald-500/20 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-border/60">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Samarkan Entitas Terpilih</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClosePopup}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      title="Tutup"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="px-2.5 py-1.5 bg-muted/70 rounded-md border border-border/50 text-[11px] font-mono truncate text-foreground select-text">
                    &quot;{selectedText}&quot;
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTextType}
                      onChange={(e) => setSelectedTextType(e.target.value)}
                      className="h-8 flex-1 px-2 rounded-md border text-xs bg-background text-foreground shrink-0 focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <option value="PERSON">Nama (PERSON)</option>
                      <option value="ORG">Perusahaan / PT (ORG)</option>
                      <option value="MONEY">Nominal Uang (MONEY)</option>
                      <option value="ACCOUNT">No. Rekening (ACCOUNT)</option>
                      <option value="NIK">NIK (NIK)</option>
                      <option value="PHONE">No. Telepon (PHONE)</option>
                      <option value="EMAIL">Email (EMAIL)</option>
                      <option value="ADDRESS">Alamat (ADDRESS)</option>
                      <option value="NPWP">NPWP (NPWP)</option>
                      <option value="DATE">Tanggal (DATE)</option>
                      <option value="CUSTOM">Data Kustom (CUSTOM)</option>
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddSelectedAsSensor}
                      className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shrink-0 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Samarkan
                    </Button>
                  </div>
                </div>
              )}

              <div
                ref={previewRef}
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                className="rounded-xl border bg-muted/20 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text text-foreground/90 flex-1 min-h-0 overflow-y-auto cursor-text focus:outline-none"
                tabIndex={0}
              >
                {renderMaskedPreview(liveMaskedText)}
              </div>
            </div>
            <div className="flex items-center justify-end text-[11px] text-muted-foreground shrink-0">
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span>💡</span>
                <span>Sorot teks di atas untuk menambah sensor baru</span>
              </span>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="px-5 py-3.5 border-t bg-muted/30 flex items-center justify-between gap-2 sm:justify-between shrink-0">
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
              onClick={dismiss}
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
