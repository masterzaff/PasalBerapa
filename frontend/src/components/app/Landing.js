import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ScanText, TriangleAlert, UploadCloud, Loader2,
  Briefcase, Home, FileLock2,
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import ChatComposer from "@/components/app/ChatComposer";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";

const TRUST = [
  { icon: Shield, title: "Privasi dulu, no login", desc: "Dokumen kamu nggak disimpen. Refresh = hilang.", color: "var(--vault)" },
  { icon: ScanText, title: "Bisa baca hasil scan", desc: "PDF foto/scan tetap kebaca lewat OCR.", color: "var(--primary)" },
  { icon: TriangleAlert, title: "Bongkar red flags", desc: "Pasal berisiko ditandai & dijelasin simpel.", color: "var(--risk-warn)" },
];

const EXAMPLES = [
  { icon: Briefcase, name: "Kontrak Kerja", file: "kontrak_kerja.pdf", slug: "kontrak-kerja" },
  { icon: Home, name: "Perjanjian Sewa", file: "perjanjian_sewa.pdf", slug: "perjanjian-sewa" },
  { icon: FileLock2, name: "NDA / Kerahasiaan", file: "nda.pdf", slug: "nda" },
];

const QUESTIONS = [
  { q: "Apa itu wanprestasi?", slug: "wanprestasi" },
  { q: "Bedanya PKWT sama PKWTT?", slug: "pkwt" },
  { q: "Deposit sewa boleh hangus nggak?", slug: "deposit" },
  { q: "Aku boleh resign kapan aja?", slug: "resign" },
];

const STEPS = [
  { n: "01", title: "Tanya atau lampirin", desc: "Ketik pertanyaan hukum, atau tarik & lepas PDF-nya." },
  { n: "02", title: "Pakai bahasa kamu", desc: "Nggak perlu istilah hukum yang ribet." },
  { n: "03", title: "Dapet jawaban + pasal", desc: "Kalau ada dokumen, kita tunjukin bagiannya." },
];

const FLOAT_TAGS = [
  { t: "<NAMA_ORANG>", cls: "-left-6 top-[14%]", d: 0 },
  { t: "<NOMINAL>", cls: "-right-8 top-[8%]", d: 0.8 },
  { t: "<TANGGAL>", cls: "-right-2 bottom-[6%]", d: 1.4 },
];

export default function Landing() {
  const { uploadFile, busy, progress } = useDocumentUpload();
  const [dragging, setDragging] = useState(false);
  const [seed, setSeed] = useState(null);
  const depth = useRef(0);

  useEffect(() => {
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
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
      await uploadFile(new File([blob], file, { type: "application/pdf" }));
    } catch (e) {
      toast.error("Gagal memuat contoh.");
    }
  };

  // Marquee items: interleave example questions + example documents.
  const MIXED = [];
  const maxLen = Math.max(QUESTIONS.length, EXAMPLES.length);
  for (let i = 0; i < maxLen; i++) {
    if (QUESTIONS[i]) MIXED.push({ type: "q", ...QUESTIONS[i] });
    if (EXAMPLES[i]) MIXED.push({ type: "doc", ...EXAMPLES[i] });
  }

  const renderItem = (item, i) => {
    if (item.type === "doc") {
      const Icon = item.icon;
      return (
        <button
          key={`d-${item.slug}-${i}`}
          data-testid={`example-${item.slug}-button`}
          disabled={busy}
          onClick={() => loadSample(item.file)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/30 bg-accent/60 px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:border-primary hover:bg-accent disabled:opacity-50 sm:text-sm"
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
          {item.name}
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
            contoh
          </span>
        </button>
      );
    }
    return (
      <button
        key={`q-${item.slug}-${i}`}
        data-testid={`example-question-${item.slug}-chip`}
        onClick={() => setSeed({ text: item.q, id: Date.now() })}
        className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:bg-accent sm:text-sm"
      >
        “{item.q}”
      </button>
    );
  };

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 hero-mist" aria-hidden />

      <AnimatePresence>
        {dragging && (
          <motion.div
            data-testid="pdf-dropzone-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
          >
            <div className="mx-auto mt-28 max-w-xl rounded-3xl border-2 border-dashed border-primary/50 bg-card/80 p-10 text-center shadow-lg">
              <UploadCloud className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-2xl font-semibold">Lepasin PDF di sini</p>
              <p className="mt-1 text-sm text-muted-foreground">Tenang, dokumen kamu nggak disimpen.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto w-full max-w-5xl px-4 pb-14 pt-10 sm:px-6 lg:pt-16">
        {/* HERO (centered) */}
        <div className="relative mx-auto max-w-3xl text-center">
          {FLOAT_TAGS.map((f) => (
            <motion.span
              key={f.t}
              className={`tag-chip pointer-events-none absolute hidden opacity-70 lg:block ${f.cls}`}
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 5 + f.d, repeat: Infinity, ease: "easeInOut", delay: f.d }}
            >
              {f.t}
            </motion.span>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h1 className="font-display text-[2.7rem] font-semibold leading-[1.03] tracking-tight sm:text-6xl">
              Urusan hukum, dijelasin
              <br className="hidden sm:block" /> kayak{" "}
              <span className="marker-underline">ngobrol.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Kontrak, perjanjian, surat, atau sekadar penasaran soal hak kamu — tanya
              pakai bahasa sehari-hari. Mau lebih dalam? Lampirin PDF-nya, nanti kita
              bedah pasal penting &amp; red flags-nya. Tanpa login, tanpa nyimpen dokumen.
            </p>
          </motion.div>

          {/* Spotlight composer */}
          <div className="relative mx-auto mt-8 max-w-2xl">
            <div className="absolute -left-2 -top-3 -z-10 h-3 w-40 rounded-full bg-foreground/10" aria-hidden />
            <div className="absolute -right-1 top-6 -z-10 h-3 w-28 rounded-full bg-primary/15" aria-hidden />
            <div className="absolute -bottom-3 left-10 -z-10 h-3 w-36 rounded-full bg-foreground/[0.07]" aria-hidden />
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="paper-grain relative overflow-hidden rounded-[calc(var(--radius)+0.35rem)] border bg-card/85 p-3 text-left shadow-[0_18px_50px_-30px_hsl(var(--foreground)/0.35)] backdrop-blur-sm"
            >
              <ChatComposer variant="hero" seed={seed} />
            </motion.div>
          </div>

          {busy && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {progress?.message || "Membaca contoh…"}
            </div>
          )}
        </div>

        {/* MARQUEE: pertanyaan + dokumen contoh, jalan */}
        <div className="marquee-pause mt-8">
          <div className="marquee-mask overflow-hidden">
            <div className="animate-marquee flex w-max gap-2.5 py-1">
              {[...MIXED, ...MIXED].map((item, i) => renderItem(item, i))}
            </div>
          </div>
        </div>

        {/* BOTTOM: trust + tahapan (didekatkan) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-14 rounded-2xl border bg-card/60 p-5 backdrop-blur-sm sm:p-6"
        >
          <div className="grid gap-5 sm:grid-cols-3">
            {TRUST.map((t) => (
              <div key={t.title} className="flex items-start gap-3">
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: `hsl(${t.color} / 0.12)`, color: `hsl(${t.color})` }}
                >
                  <t.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-5" />

          <div className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((st) => (
              <div key={st.n} className="flex items-start gap-3">
                <span className="font-mono-plex text-lg font-semibold text-primary">{st.n}</span>
                <div>
                  <p className="text-sm font-semibold">{st.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
