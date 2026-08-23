import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { extractPdf, extractImage, EXTRACT_MODES } from "@/lib/pdfExtract";
import { useSession } from "@/context/SessionContext";
import { useConnection } from "@/context/ConnectionContext";
import { maskPII } from "@/lib/api";

const IMAGE_TYPES = /^image\/(jpeg|jpg|png|webp|bmp|gif)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|bmp|gif)$/i;

function isPdf(f) {
  return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
}
function isImage(f) {
  return IMAGE_TYPES.test(f.type || "") || IMAGE_EXT.test(f.name || "");
}

// Handles PDF/photo -> text/OCR extraction into session state, with progress
// + cancel. PDFs: embedded text first, OCR (Indonesian) per scanned page.
// Photos: OCR (Indonesian) directly on the image.
export function useDocumentUpload() {
  const {
    sessionId,
    setFile,
    setRawText,
    setExtractInfo,
    setMaskedText,
    setPiiMapping,
    setPiiConfirmed,
    setShowPiiModal,
    resetDocument,
  } = useSession();
  const conn = useConnection();
  const [progress, setProgress] = useState(null); // {percent, message}
  const abortRef = useRef(null);
  const busy = Boolean(progress);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const uploadFile = useCallback(
    async (f) => {
      if (!f) return false;
      const pdf = isPdf(f);
      const image = !pdf && isImage(f);
      if (!pdf && !image) {
        toast.error("File harus PDF atau foto (JPG/PNG) ya.");
        return false;
      }
      // Drop everything derived from the previous document first. Without this,
      // the old maskedText/piiMapping survive and the next analysis sends the
      // PREVIOUS document to the LLM with the PII review already marked done.
      resetDocument();
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ percent: 2, message: pdf ? "Membuka PDF…" : "Membuka foto…" });
      try {
        const result = pdf
          ? await extractPdf(f, {
              mode: EXTRACT_MODES.AUTO,
              signal: controller.signal,
              onProgress: (p) => setProgress({ percent: p.percent, message: p.message }),
            })
          : await extractImage(f, {
              signal: controller.signal,
              onProgress: (p) => setProgress({ percent: p.percent, message: p.message }),
            });
        if (!result.text || !result.text.trim()) {
          toast.error(
            pdf
              ? "Nggak nemu teks di PDF ini. Kualitas scan-nya mungkin terlalu rendah."
              : "Nggak nemu teks di foto ini. Coba foto yang lebih jelas/terang."
          );
          setProgress(null);
          return false;
        }
        setFile({ name: f.name, size: f.size });
        setRawText(result.text);
        setExtractInfo({ totalPages: result.totalPages, usedOcr: result.usedOcr, pages: result.pages });

        // Scan PII immediately upon upload / OCR
        if (conn.maskConfigured) {
          setProgress({ percent: 95, message: "Memindai sensor data pribadi (PII)…" });
          try {
            const r = await maskPII({
              text: result.text,
              sessionId,
              knownMapping: null,
            });
            setMaskedText(r.maskedText || result.text);
            setPiiMapping(r.mapping || {});

            const autoConfirm =
              typeof window !== "undefined" &&
              localStorage.getItem("pasalberapa_auto_confirm_pii") === "true";

            if (autoConfirm) {
              setPiiConfirmed(true);
            } else {
              setShowPiiModal(true);
            }
          } catch (err) {
            console.error("PII scan error on upload:", err);
            setMaskedText(result.text);
            setPiiMapping({});
          }
        } else {
          setMaskedText(result.text);
          setPiiMapping({});
        }

        toast.success(
          pdf
            ? `Dokumen kebaca! ${result.totalPages} halaman${result.usedOcr ? " (OCR)" : ""}.`
            : "Foto kebaca (OCR)."
        );
        setProgress(null);
        return true;
      } catch (e) {
        if (e.name === "AbortError") toast.message("Ekstraksi dibatalkan.");
        else {
          console.error(e);
          toast.error(`Gagal baca ${pdf ? "PDF" : "foto"}: ` + (e.message || "unknown"));
        }
        setProgress(null);
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [
      sessionId,
      conn.maskConfigured,
      setFile,
      setRawText,
      setExtractInfo,
      setMaskedText,
      setPiiMapping,
      setPiiConfirmed,
      setShowPiiModal,
      resetDocument,
    ]
  );

  return { uploadFile, progress, busy, cancel };
}
