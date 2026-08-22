import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Lock, ScanSearch, ShieldAlert, UploadCloud, Server } from "lucide-react";
import ChatComposer from "@/components/app/ChatComposer";
import { useConnection } from "@/context/ConnectionContext";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";

const TRUST = [
  { icon: Lock, text: "Privasi kejaga" },
  { icon: ScanSearch, text: "Baca PDF & scan (OCR)" },
  { icon: ShieldAlert, text: "Bongkar red flags" },
];

export default function Landing({ onOpenSettings }) {
  const { status } = useConnection();
  const { uploadFile } = useDocumentUpload();
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const onOver = (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) {
        e.preventDefault();
      }
    };
    const onEnter = (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) {
        depth.current += 1;
        setDragging(true);
      }
    };
    const onLeave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
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

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 hero-mist" aria-hidden />

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-primary/10 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary bg-card px-10 py-8 shadow-lg">
              <UploadCloud className="h-10 w-10 text-primary" />
              <p className="font-display text-lg font-semibold">Lepas di sini buat mulai</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Asisten hukum yang ngomong manusiawi
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Bingung isi kontrak?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
            Lampirin PDF-nya, terus tanya apa aja. Aku bedah risikonya, ringkas isinya,
            dan jelasin pasal pentingnya — bahasa santai tapi tetap akurat.
          </p>

          <div className="mx-auto mt-7 w-full max-w-xl">
            <ChatComposer variant="hero" onOpenSettings={onOpenSettings} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST.map((t) => (
              <span key={t.text} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <t.icon className="h-4 w-4 text-primary" />
                {t.text}
              </span>
            ))}
          </div>

          {status !== "connected" && (
            <button
              onClick={onOpenSettings}
              className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--risk-warn))]/40 bg-[hsl(var(--risk-warn-bg))] px-3 py-1.5 text-xs text-[hsl(var(--risk-warn))]"
            >
              <Server className="h-3.5 w-3.5" />
              Server AI belum tersambung — atur endpoint
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
