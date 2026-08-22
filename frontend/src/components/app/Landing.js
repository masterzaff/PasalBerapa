import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Lock, ScanSearch, ShieldAlert, UploadCloud, Loader2,
  Briefcase, Home, FileLock2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import ChatComposer from "@/components/app/ChatComposer";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";

const TRUST = [
  { icon: Lock, text: "Privasi kejaga" },
  { icon: ScanSearch, text: "Baca PDF & scan (OCR)" },
  { icon: ShieldAlert, text: "Bongkar red flags" },
];

const EXAMPLES = [
  { icon: Briefcase, name: "Kontrak Kerja", desc: "PKWT dengan denda resign & pasal lembur", file: "kontrak_kerja.pdf" },
  { icon: Home, name: "Perjanjian Sewa", desc: "Sewa rumah, deposit bisa hangus", file: "perjanjian_sewa.pdf" },
  { icon: FileLock2, name: "NDA / Kerahasiaan", desc: "Sanksi besar & berlaku selamanya", file: "nda.pdf" },
];

const QUESTIONS = [
  "Ada denda tersembunyi nggak?",
  "Aku boleh resign kapan aja?",
  "Ringkas isinya dong, singkat aja",
];

export default function Landing() {
  const { uploadFile, busy, progress } = useDocumentUpload();
  const [dragging, setDragging] = useState(false);
  const [seed, setSeed] = useState(null);
  const depth = useRef(0);

  useEffect(() => {
    const hasFiles = (e) =>
      e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    const onOver = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const onEnter = (e) => { if (hasFiles(e)) { depth.current += 1; setDragging(true); } };
    const onLeave = () => { depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false); };
    const onDrop = async (e) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await uploadFile(f);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [uploadFile]);

  const loadSample = async (file) => {
    if (busy) return;
    try {
      const res = await fetch(`${process.env.PUBLIC_URL || ""}/samples/${file}`);
      if (!res.ok) throw new Error("not found");
      const blob = await res.blob();
      const f = new File([blob], file, { type: "application/pdf" });
      await uploadFile(f);
    } catch (e) {
      toast.error("Gagal memuat contoh.");
    }
  };

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 hero-mist" aria-hidden />

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-primary/10 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary bg-card px-10 py-8 shadow-lg">
              <UploadCloud className="h-10 w-10 text-primary" />
              <p className="font-display text-xl font-semibold">Lepas di sini buat mulai</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Asisten hukum yang ngomong manusiawi
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Bingung isi kontrak?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Lampirin PDF-nya, terus tanya apa aja. Aku bedah risikonya, ringkas isinya,
            dan jelasin pasal pentingnya — bahasa santai tapi tetap akurat.
          </p>

          <div className="mx-auto mt-7 w-full max-w-xl">
            <ChatComposer variant="hero" seed={seed} />
          </div>

          {busy && (
            <div className="mx-auto mt-3 flex max-w-xl items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {progress?.message || "Membaca contoh…"}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST.map((t) => (
              <span key={t.text} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <t.icon className="h-4 w-4 text-primary" />
                {t.text}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Contoh penggunaan */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-10 w-full"
        >
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Belum punya file? Coba contoh ini
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.file}
                data-testid={`example-${ex.file.replace(".pdf", "")}`}
                disabled={busy}
                onClick={() => loadSample(ex.file)}
                className="group flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-left shadow-sm transition-transform hover:-translate-y-1 hover:border-primary/40 hover:shadow-md disabled:opacity-50"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                  <ex.icon className="h-5 w-5" />
                </div>
                <div className="font-display text-base font-semibold">{ex.name}</div>
                <div className="text-xs leading-relaxed text-muted-foreground">{ex.desc}</div>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Coba sekarang <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Atau tanya kayak gini:</span>
            {QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => setSeed({ text: q, id: Date.now() })}
                className="rounded-full border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:border-primary hover:bg-accent"
              >
                “{q}”
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
