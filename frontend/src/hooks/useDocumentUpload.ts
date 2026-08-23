import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { extractPdf, EXTRACT_MODES } from "@/lib/pdfExtract";
import { useSession } from "@/context/SessionContext";

// Handles PDF -> text/OCR extraction into session state, with progress + cancel.
// AUTO mode: reads embedded text first, falls back to OCR (Indonesian) per scanned page.
export function useDocumentUpload() {
  const { setFile, setRawText, setExtractInfo, resetDocument } = useSession();
  const [progress, setProgress] = useState(null); // {percent, message}
  const abortRef = useRef(null);
  const busy = Boolean(progress);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const uploadFile = useCallback(
    async (f) => {
      if (!f) return false;
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        toast.error("File harus PDF ya.");
        return false;
      }
      // Drop everything derived from the previous document first. Without this,
      // the old maskedText/piiMapping survive and the next analysis sends the
      // PREVIOUS document to the LLM with the PII review already marked done.
      resetDocument();
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ percent: 2, message: "Membuka PDF…" });
      try {
        const result = await extractPdf(f, {
          mode: EXTRACT_MODES.AUTO,
          signal: controller.signal,
          onProgress: (p) => setProgress({ percent: p.percent, message: p.message }),
        });
        if (!result.text || !result.text.trim()) {
          toast.error("Nggak nemu teks di PDF ini. Kualitas scan-nya mungkin terlalu rendah.");
          setProgress(null);
          return false;
        }
        setFile({ name: f.name, size: f.size });
        setRawText(result.text);
        setExtractInfo({ totalPages: result.totalPages, usedOcr: result.usedOcr, pages: result.pages });
        toast.success(`Dokumen kebaca! ${result.totalPages} halaman${result.usedOcr ? " (OCR)" : ""}.`);
        setProgress(null);
        return true;
      } catch (e) {
        if (e.name === "AbortError") toast.message("Ekstraksi dibatalkan.");
        else {
          console.error(e);
          toast.error("Gagal baca PDF: " + (e.message || "unknown"));
        }
        setProgress(null);
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [setFile, setRawText, setExtractInfo, resetDocument]
  );

  return { uploadFile, progress, busy, cancel };
}
