import React, { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { extractPdf, EXTRACT_MODES } from "@/lib/pdfExtract";
import { useSession } from "@/context/SessionContext";

export default function UploadDropzone() {
  const { setFile, setRawText, setExtractInfo } = useSession();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null); // {percent, message}
  const [mode, setMode] = useState(EXTRACT_MODES.AUTO);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const handleFile = useCallback(
    async (f) => {
      if (!f) return;
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        toast.error("File harus PDF ya.");
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ percent: 2, message: "Membuka PDF…" });
      try {
        const result = await extractPdf(f, {
          mode,
          signal: controller.signal,
          onProgress: (p) => setProgress({ percent: p.percent, message: p.message }),
        });
        if (!result.text || !result.text.trim()) {
          toast.error("Nggak nemu teks di PDF ini. Coba mode OCR kalau ini hasil scan.");
          setProgress(null);
          return;
        }
        setFile({ name: f.name, size: f.size });
        setRawText(result.text);
        setExtractInfo({
          totalPages: result.totalPages,
          usedOcr: result.usedOcr,
          pages: result.pages,
        });
        toast.success(
          `Dokumen kebaca! ${result.totalPages} halaman${result.usedOcr ? " (pakai OCR)" : ""}.`
        );
      } catch (e) {
        if (e.name === "AbortError") {
          toast.message("Ekstraksi dibatalkan.");
        } else {
          console.error(e);
          toast.error("Gagal baca PDF: " + (e.message || "unknown"));
        }
        setProgress(null);
      } finally {
        abortRef.current = null;
      }
    },
    [mode, setFile, setRawText, setExtractInfo]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  };

  const busy = Boolean(progress);

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {[
          { k: EXTRACT_MODES.AUTO, label: "Auto" },
          { k: EXTRACT_MODES.TEXT, label: "Teks aja" },
          { k: EXTRACT_MODES.OCR, label: "Paksa OCR" },
        ].map((m) => (
          <button
            key={m.k}
            data-testid={`extract-mode-${m.k}`}
            disabled={busy}
            onClick={() => setMode(m.k)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              mode === m.k
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={busy ? (e) => e.preventDefault() : onDrop}
        animate={{ scale: dragOver ? 1.01 : 1 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        data-testid="pdf-dropzone"
        className={`group relative flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-2px)] border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-primary bg-accent"
            : "border-border bg-background/60 hover:border-primary hover:bg-accent/50"
        }`}
      >
        {busy ? (
          <div className="w-full max-w-sm">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
            <Progress value={progress.percent} className="h-2" data-testid="extraction-progress" />
            <p className="mt-3 text-sm text-muted-foreground">{progress.message}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 gap-1.5 text-xs"
              onClick={() => abortRef.current && abortRef.current.abort()}
            >
              <X className="h-3.5 w-3.5" /> Batalin
            </Button>
          </div>
        ) : (
          <>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">Tarik PDF ke sini</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                Atau klik buat pilih file. Kontrak, surat perjanjian, MoU — semua bisa.
              </p>
            </div>
            <Button
              data-testid="pdf-file-picker-button"
              onClick={() => inputRef.current && inputRef.current.click()}
              className="gap-2"
            >
              <FileText className="h-4 w-4" /> Pilih File PDF
            </Button>
            <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
              Nama, email, NIK, alamat, & nomor HP bakal disamarin jadi tag kayak{" "}
              <span className="tag-chip">&lt;PERSON_1&gt;</span> sebelum dianalisis.
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files && e.target.files[0])}
        />
      </motion.div>
    </div>
  );
}
