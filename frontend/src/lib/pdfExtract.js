// Client-side PDF text extraction + OCR (for scanned PDFs).
// Uses pdf.js for embedded text and tesseract.js (Indonesian) for image-only pages.
// Runs entirely in the browser — no document ever leaves the device during extraction.

import * as pdfjsLib from "pdfjs-dist";
import { createWorker } from "tesseract.js";

// Match worker to the exact installed version, served with CORS from unpkg.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Below this many characters, a page is considered "scanned" and eligible for OCR.
const TEXT_PAGE_MIN_CHARS = 24;

export const EXTRACT_MODES = {
  AUTO: "auto", // text first, OCR only where needed
  TEXT: "text", // embedded text only
  OCR: "ocr", // force OCR on every page
};

async function getPdf(file) {
  const buffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: buffer }).promise;
}

async function extractPageText(page) {
  const content = await page.getTextContent();
  const items = content.items || [];
  // Reconstruct rough line breaks using item positions.
  let text = "";
  let lastY = null;
  for (const item of items) {
    const str = item.str || "";
    const y = item.transform ? item.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
      text += "\n";
    } else if (text && !text.endsWith(" ") && !text.endsWith("\n")) {
      text += " ";
    }
    text += str;
    lastY = y;
  }
  return text.trim();
}

async function renderPageToCanvas(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Main entry.
// options: { mode, onProgress, signal }
// onProgress({ stage, page, totalPages, percent, message })
// Returns { text, pages:[{page,text,usedOcr,chars}], usedOcr, totalPages }
export async function extractPdf(file, options = {}) {
  const { mode = EXTRACT_MODES.AUTO, onProgress = () => {}, signal } = options;
  const isCancelled = () => signal && signal.aborted;

  onProgress({ stage: "loading", percent: 2, message: "Membuka PDF…" });
  const pdf = await getPdf(file);
  const totalPages = pdf.numPages;

  let ocrWorker = null;
  const ensureOcr = async () => {
    if (ocrWorker) return ocrWorker;
    onProgress({ stage: "ocr-init", percent: 5, message: "Menyiapkan mesin OCR (bahasa Indonesia)…" });
    ocrWorker = await createWorker("ind");
    return ocrWorker;
  };

  const pages = [];
  let usedOcrAnywhere = false;

  try {
    for (let i = 1; i <= totalPages; i++) {
      if (isCancelled()) throw new DOMException("Dibatalkan", "AbortError");

      const base = Math.round(((i - 1) / totalPages) * 90) + 6;
      onProgress({
        stage: "text",
        page: i,
        totalPages,
        percent: base,
        message: `Membaca halaman ${i} dari ${totalPages}…`,
      });

      const page = await pdf.getPage(i);
      let text = "";
      let usedOcr = false;

      if (mode !== EXTRACT_MODES.OCR) {
        text = await extractPageText(page);
      }

      const needsOcr =
        mode === EXTRACT_MODES.OCR ||
        (mode === EXTRACT_MODES.AUTO && text.length < TEXT_PAGE_MIN_CHARS);

      if (needsOcr && mode !== EXTRACT_MODES.TEXT) {
        onProgress({
          stage: "ocr",
          page: i,
          totalPages,
          percent: base,
          message: `Halaman ${i} kelihatannya hasil scan — jalanin OCR…`,
        });
        const worker = await ensureOcr();
        const canvas = await renderPageToCanvas(page, 2);
        const { data } = await worker.recognize(canvas);
        const ocrText = (data.text || "").trim();
        canvas.width = 0;
        canvas.height = 0;
        if (ocrText.length > text.length) {
          text = ocrText;
          usedOcr = true;
          usedOcrAnywhere = true;
        }
      }

      pages.push({ page: i, text, usedOcr, chars: text.length });
      page.cleanup && page.cleanup();
    }
  } finally {
    if (ocrWorker) {
      try { await ocrWorker.terminate(); } catch (_) {}
    }
  }

  onProgress({ stage: "done", percent: 100, message: "Ekstraksi selesai." });

  const text = pages
    .map((p) => p.text)
    .filter(Boolean)
    .join("\n\n");

  return { text, pages, usedOcr: usedOcrAnywhere, totalPages };
}

export async function getPdfMeta(file) {
  const pdf = await getPdf(file);
  return { numPages: pdf.numPages };
}
